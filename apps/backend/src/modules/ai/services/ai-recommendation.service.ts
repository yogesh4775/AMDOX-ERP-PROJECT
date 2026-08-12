/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { ApplyRecommendationDto } from "../dto/recommendation.dto";

@Injectable()
export class AiRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createRecommendation(
    tenantId: string,
    targetType: string,
    targetEntityId: string | null,
    title: string,
    recommendationText: string,
    score: number,
  ) {
    return this.prisma.aiRecommendation.create({
      data: {
        tenantId,
        targetType,
        targetEntityId,
        title,
        recommendation: recommendationText,
        score,
      },
    });
  }

  async getRecommendations(tenantId: string) {
    return this.prisma.aiRecommendation.findMany({
      where: { tenantId },
      orderBy: { score: "desc" },
    });
  }

  async applyRecommendation(
    tenantId: string,
    id: string,
    dto: ApplyRecommendationDto,
    user: AuthUser,
  ) {
    const rec = await this.prisma.aiRecommendation.findFirst({
      where: { id, tenantId },
    });

    if (!rec) {
      throw new NotFoundException(`Recommendation ${id} not found.`);
    }

    if (rec.isApplied) {
      throw new ConflictException("Recommendation has already been applied.");
    }

    if (rec.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic Concurrency conflict: Version mismatch.",
      );
    }

    const updated = await this.prisma.aiRecommendation.update({
      where: { id },
      data: {
        isApplied: true,
        appliedAt: new Date(),
        version: { increment: 1 },
      },
    });

    // Post-apply operational mappings:
    if (rec.targetType === "PROCUREMENT_REORDER" && rec.targetEntityId) {
      // Proactively auto-generate a Purchase Order
      const reqCount = await this.prisma.purchaseOrder.count({
        where: { tenantId },
      });
      const reqNum = `PO-AI-REORDER-${reqCount + 1}`;

      await this.prisma.purchaseOrder.create({
        data: {
          tenantId,
          supplierName: "AI Auto Reorder Supplier",
          orderNumber: reqNum,
          status: "DRAFT" as any,
          expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          totalAmount: 0,
          createdBy: user.id,
          notes: `Auto-generated purchase order from AI Reorder recommendation: ${rec.title}`,
        },
      });
    }

    // Log Recommendation Applied Audit Event
    await this.auditService.log({
      action: "AI_RECOMMENDATION_APPLIED",
      entity: "AiRecommendation",
      entityId: id,
      newValues: {
        targetType: rec.targetType,
        targetEntityId: rec.targetEntityId,
      },
    });

    return updated;
  }
}
