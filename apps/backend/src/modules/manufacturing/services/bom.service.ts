import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { CreateBOMDto, BOMItemDto } from "../dto/create-bom.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { BOMStatus } from "@amdox/database/generated";
import { ModuleRef } from "@nestjs/core";

@Injectable()
export class BOMService {
  private readonly logger = new Logger(BOMService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async create(dto: CreateBOMDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    // Check duplicate code
    const existing = await this.prisma.bOM.findFirst({
      where: { tenantId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`BOM with code ${dto.code} already exists.`);
    }

    // Verify finished product exists
    const finishedProduct = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, deletedAt: null },
    });
    if (!finishedProduct) {
      throw new NotFoundException(`Finished product not found.`);
    }

    // Verify all item products and units exist
    for (const item of dto.items) {
      const itemProd = await this.prisma.product.findFirst({
        where: { id: item.productId, tenantId, deletedAt: null },
      });
      if (!itemProd) {
        throw new NotFoundException(
          `BOM component product ${item.productId} not found.`,
        );
      }
      const itemUnit = await this.prisma.unit.findFirst({
        where: { id: item.unitId, tenantId, deletedAt: null },
      });
      if (!itemUnit) {
        throw new NotFoundException(`Unit ${item.unitId} not found.`);
      }
    }

    // Create BOM and items
    const bom = await this.prisma.bOM.create({
      data: {
        tenantId,
        productId: dto.productId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        quantity: dto.quantity,
        status: BOMStatus.DRAFT,
        items: {
          create: dto.items.map((item) => ({
            tenantId,
            productId: item.productId,
            quantity: item.quantity,
            unitId: item.unitId,
            scrapFactor: item.scrapFactor || 0.0,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    await this.auditService.log({
      action: "BOM_CREATED",
      entity: "BOM",
      entityId: bom.id,
      newValues: bom as unknown as Record<string, unknown>,
    });

    return bom;
  }

  async findAll(user: AuthUser) {
    return this.prisma.bOM.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      include: {
        product: true,
        items: {
          include: {
            product: true,
            unit: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const bom = await this.prisma.bOM.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
      include: {
        product: true,
        items: {
          include: {
            product: true,
            unit: true,
          },
        },
      },
    });
    if (!bom) {
      throw new NotFoundException(`BOM not found.`);
    }
    return bom;
  }

  async update(
    id: string,
    dto: Partial<CreateBOMDto> & { expectedVersion?: number },
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;
    const bom = await this.findOne(id, user);

    if (
      dto.expectedVersion !== undefined &&
      bom.version !== dto.expectedVersion
    ) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    if (bom.status !== BOMStatus.DRAFT) {
      throw new BadRequestException("BOM can only be updated in DRAFT status.");
    }

    if (dto.code && dto.code !== bom.code) {
      const existing = await this.prisma.bOM.findFirst({
        where: { tenantId, code: dto.code, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(
          `BOM with code ${dto.code} already exists.`,
        );
      }
    }

    // Wrap items update in transaction if items provided
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        // Clear existing items
        await tx.bOMItem.deleteMany({
          where: { bomId: id },
        });

        // Verify items
        for (const item of dto.items) {
          const itemProd = await tx.product.findFirst({
            where: { id: item.productId, tenantId, deletedAt: null },
          });
          if (!itemProd) {
            throw new NotFoundException(
              `BOM component product ${item.productId} not found.`,
            );
          }
          const itemUnit = await tx.unit.findFirst({
            where: { id: item.unitId, tenantId, deletedAt: null },
          });
          if (!itemUnit) {
            throw new NotFoundException(`Unit ${item.unitId} not found.`);
          }
        }
      }

      return tx.bOM.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          quantity: dto.quantity,
          version: { increment: 1 },
          items: dto.items
            ? {
                create: dto.items.map((item: BOMItemDto) => ({
                  tenantId,
                  productId: item.productId,
                  quantity: item.quantity,
                  unitId: item.unitId,
                  scrapFactor: item.scrapFactor || 0.0,
                })),
              }
            : undefined,
        },
        include: {
          items: true,
        },
      });
    });

    await this.auditService.log({
      action: "BOM_UPDATED",
      entity: "BOM",
      entityId: id,
      newValues: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);

    const deleted = await this.prisma.bOM.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.auditService.log({
      action: "BOM_DELETED",
      entity: "BOM",
      entityId: id,
      newValues: { deletedAt: deleted.deletedAt } as unknown as Record<
        string,
        unknown
      >,
    });

    return { success: true };
  }

  async submit(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const bom = await this.findOne(id, user);

    if (bom.status !== BOMStatus.DRAFT) {
      throw new BadRequestException(
        "BOM can only be submitted in DRAFT status.",
      );
    }

    // Submit to Workflow Engine dynamically to prevent compile-time circular imports
    let workflowInstanceId: string | undefined;
    try {
      const workflowService = this.moduleRef.get("WorkflowService", {
        strict: false,
      });
      if (workflowService) {
        // Find active definition for BOM_APPROVAL
        const def = await this.prisma.workflowDefinition.findFirst({
          where: {
            tenantId,
            code: "BOM_APPROVAL",
            isActive: true,
            deletedAt: null,
          },
        });
        if (def) {
          const res = await (
            workflowService as unknown as {
              submitInstance: (
                p: {
                  entityType: string;
                  entityId: string;
                  definitionCode: string;
                },
                u: AuthUser,
              ) => Promise<{ id: string }>;
            }
          ).submitInstance(
            {
              entityType: "BOM",
              entityId: bom.id,
              definitionCode: "BOM_APPROVAL",
            },
            user,
          );
          workflowInstanceId = res.id;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to automatically route BOM to workflow engine: ${err}`,
      );
    }

    const updatedStatus = workflowInstanceId
      ? BOMStatus.PENDING_APPROVAL
      : BOMStatus.ACTIVE;

    const updated = await this.prisma.bOM.update({
      where: { id },
      data: {
        status: updatedStatus,
        version: { increment: 1 },
      },
    });

    await this.auditService.log({
      action: "BOM_SUBMITTED",
      entity: "BOM",
      entityId: id,
      newValues: {
        status: updatedStatus,
        workflowInstanceId,
      } as unknown as Record<string, unknown>,
    });

    return updated;
  }
}
