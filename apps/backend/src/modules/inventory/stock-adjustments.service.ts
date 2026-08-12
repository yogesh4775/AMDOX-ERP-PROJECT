import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { AuditService } from "../../common/audit/audit.service";
import { StockService } from "./stock.service";
import { CreateStockAdjustmentDto } from "./dto/create-adjustment.dto";
import { UpdateStockAdjustmentDto } from "./dto/update-adjustment.dto";
import { QueryStockAdjustmentDto } from "./dto/query-adjustment.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import {
  Prisma,
  StockAdjustmentStatus,
  StockAdjustmentType,
  StockTransactionType,
} from "@amdox/database/generated";

@Injectable()
export class StockAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly transactionHelper: TransactionHelper,
    private readonly stockService: StockService,
  ) {}

  async create(dto: CreateStockAdjustmentDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const productIds = dto.lines.map((l) => l.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException(
        "Duplicate products in adjustment lines are not allowed.",
      );
    }

    return this.transactionHelper.run(async (tx) => {
      // Validate warehouse belongs to tenant and is active
      const warehouse = await tx.warehouse.findFirst({
        where: {
          id: dto.warehouseId,
          tenantId: user.tenantId!,
          deletedAt: null,
        },
      });
      if (!warehouse) {
        throw new BadRequestException("Warehouse not found or inactive.");
      }

      // Validate products exist, are active, and belong to tenant
      for (const line of dto.lines) {
        const product = await tx.product.findFirst({
          where: {
            id: line.productId,
            tenantId: user.tenantId!,
            deletedAt: null,
          },
        });
        if (!product) {
          throw new BadRequestException(
            `Product with ID ${line.productId} not found or inactive.`,
          );
        }
      }

      const adjustmentNumber = `ADJ-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const adjustment = await tx.stockAdjustment.create({
        data: {
          tenantId: user.tenantId!,
          adjustmentNumber,
          warehouseId: dto.warehouseId,
          status: StockAdjustmentStatus.DRAFT,
          note: dto.note || null,
          performedBy: user.id,
          version: 1,
          lines: {
            create: dto.lines.map((l) => ({
              productId: l.productId,
              type: l.type,
              quantity: l.quantity,
              reason: l.reason || null,
            })),
          },
        },
        include: {
          lines: true,
        },
      });

      await this.auditService.log({
        tenantId: user.tenantId!,
        userId: user.id,
        entity: "StockAdjustment",
        entityId: adjustment.id,
        action: "STOCK_ADJUSTMENT_CREATED",
        oldValues: null,
        newValues: adjustment,
      });

      return adjustment;
    });
  }

  async findAll(query: QueryStockAdjustmentDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockAdjustmentWhereInput = {
      tenantId: user.tenantId!,
      deletedAt: query.includeDeleted ? undefined : null,
    };

    if (query.status) {
      where.status = query.status;
    }

    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [totalItems, data] = await Promise.all([
      this.prisma.stockAdjustment.count({ where }),
      this.prisma.stockAdjustment.findMany({
        where,
        orderBy: { [sortField]: order },
        skip,
        take: limit,
        include: {
          lines: {
            select: {
              id: true,
              productId: true,
              type: true,
              quantity: true,
              reason: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        total: totalItems,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string, user: AuthUser) {
    const record = await this.prisma.stockAdjustment.findUnique({
      where: { id },
      include: {
        lines: {
          select: {
            id: true,
            productId: true,
            type: true,
            quantity: true,
            reason: true,
          },
        },
      },
    });

    if (!record || record.deletedAt) {
      throw new NotFoundException("Stock adjustment not found");
    }

    if (record.tenantId !== user.tenantId) {
      throw new ForbiddenException("Access denied.");
    }

    return record;
  }

  async update(id: string, dto: UpdateStockAdjustmentDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.stockAdjustment.findUnique({
        where: { id },
        include: { lines: true },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Stock adjustment not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.status !== StockAdjustmentStatus.DRAFT) {
        throw new BadRequestException(
          "Only adjustments in DRAFT status can be modified.",
        );
      }

      if (record.version !== dto.expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      if (dto.warehouseId !== undefined) {
        const warehouse = await tx.warehouse.findFirst({
          where: {
            id: dto.warehouseId,
            tenantId: user.tenantId!,
            deletedAt: null,
          },
        });
        if (!warehouse) {
          throw new BadRequestException("Warehouse not found or inactive.");
        }
      }

      if (dto.lines !== undefined) {
        const productIds = dto.lines.map((l) => l.productId);
        if (new Set(productIds).size !== productIds.length) {
          throw new BadRequestException(
            "Duplicate products in adjustment lines are not allowed.",
          );
        }

        for (const line of dto.lines) {
          const product = await tx.product.findFirst({
            where: {
              id: line.productId,
              tenantId: user.tenantId!,
              deletedAt: null,
            },
          });
          if (!product) {
            throw new BadRequestException(
              `Product with ID ${line.productId} not found or inactive.`,
            );
          }
        }
      }

      const updateData: Prisma.StockAdjustmentUncheckedUpdateInput = {
        note: dto.note !== undefined ? dto.note || null : undefined,
        warehouseId: dto.warehouseId,
        version: { increment: 1 },
      };

      if (dto.lines !== undefined) {
        // Delete old lines
        await tx.stockAdjustmentLine.deleteMany({
          where: { adjustmentId: id },
        });
        // Create new lines
        updateData.lines = {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            type: l.type,
            quantity: l.quantity,
            reason: l.reason || null,
          })),
        };
      }

      const updated = await tx.stockAdjustment.update({
        where: { id },
        data: updateData,
        include: { lines: true },
      });

      await this.auditService.log({
        tenantId: user.tenantId!,
        userId: user.id,
        entity: "StockAdjustment",
        entityId: id,
        action: "STOCK_ADJUSTMENT_UPDATED",
        oldValues: record,
        newValues: updated,
      });

      return updated;
    });
  }

  async delete(id: string, expectedVersion: number, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.stockAdjustment.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Stock adjustment not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.status !== StockAdjustmentStatus.DRAFT) {
        throw new BadRequestException(
          "Only adjustments in DRAFT status can be deleted.",
        );
      }

      if (record.version !== expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      const updated = await tx.stockAdjustment.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.log({
        tenantId: user.tenantId!,
        userId: user.id,
        entity: "StockAdjustment",
        entityId: id,
        action: "STOCK_ADJUSTMENT_DELETED",
        oldValues: record,
        newValues: updated,
      });

      return updated;
    });
  }

  async approve(id: string, expectedVersion: number, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.stockAdjustment.findUnique({
        where: { id },
        include: { lines: true },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Stock adjustment not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.status === StockAdjustmentStatus.APPROVED) {
        throw new BadRequestException("Adjustment is already approved.");
      }

      if (record.status === StockAdjustmentStatus.CANCELLED) {
        throw new BadRequestException(
          "Cancelled adjustments cannot be approved.",
        );
      }

      if (record.version !== expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      if (!record.lines.length) {
        throw new BadRequestException(
          "Cannot approve an adjustment with no lines.",
        );
      }

      // Lock stock rows in deterministic order (by productId ascending)
      const sortedLines = [...record.lines].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      );

      for (const line of sortedLines) {
        const delta =
          line.type === StockAdjustmentType.INCREMENT
            ? Number(line.quantity)
            : -Number(line.quantity);

        await this.stockService.mutateStock(
          tx,
          user.tenantId!,
          record.warehouseId,
          line.productId,
          StockTransactionType.ADJUSTMENT,
          delta,
          "StockAdjustment",
          record.id,
          user.id,
          line.reason || `Stock adjustment: ${line.type}`,
        );
      }

      // Update adjustment status
      const updated = await tx.stockAdjustment.update({
        where: { id },
        data: {
          status: StockAdjustmentStatus.APPROVED,
          version: { increment: 1 },
        },
        include: { lines: true },
      });

      await this.auditService.log({
        tenantId: user.tenantId!,
        userId: user.id,
        entity: "StockAdjustment",
        entityId: id,
        action: "STOCK_ADJUSTMENT_APPROVED",
        oldValues: record,
        newValues: updated,
      });

      return updated;
    });
  }
}
