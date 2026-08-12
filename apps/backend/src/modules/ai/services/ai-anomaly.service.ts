/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { ResolveAnomalyDto } from "../dto/anomaly.dto";

@Injectable()
export class AiAnomalyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createAnomaly(
    tenantId: string,
    source: string,
    severity: string,
    description: string,
    evidence: Record<string, any>,
  ) {
    const anomaly = await this.prisma.aiAnomalyEvent.create({
      data: {
        tenantId,
        source,
        severity,
        description,
        evidence,
      },
    });

    // Log Anomaly Detected Audit Event
    await this.auditService.log({
      action: "AI_ANOMALY_DETECTED",
      entity: "AiAnomalyEvent",
      entityId: anomaly.id,
      newValues: { source, severity, description },
    });

    return anomaly;
  }

  async getAnomalies(tenantId: string) {
    return this.prisma.aiAnomalyEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async resolveAnomaly(
    tenantId: string,
    id: string,
    dto: ResolveAnomalyDto,
    user: AuthUser,
  ) {
    const anomaly = await this.prisma.aiAnomalyEvent.findFirst({
      where: { id, tenantId },
    });

    if (!anomaly) {
      throw new NotFoundException(`Anomaly event ${id} not found.`);
    }

    if (anomaly.isResolved) {
      throw new ConflictException("Anomaly has already been resolved.");
    }

    if (anomaly.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic Concurrency conflict: Version mismatch.",
      );
    }

    const updated = await this.prisma.aiAnomalyEvent.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.auditService.log({
      action: "AI_ANOMALY_RESOLVED",
      entity: "AiAnomalyEvent",
      entityId: id,
      newValues: { source: anomaly.source, resolvedBy: user.id },
    });

    return updated;
  }
}
