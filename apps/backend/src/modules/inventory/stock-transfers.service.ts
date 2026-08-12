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
import { CreateStockTransferDto } from "./dto/create-transfer.dto";
import { UpdateStockTransferDto } from "./dto/update-transfer.dto";
import { QueryStockTransferDto } from "./dto/query-transfer.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import {
  Prisma,
  StockTransferStatus,
  StockTransactionType,
} from "@amdox/database/generated";

@Injectable()
export class StockTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly transactionHelper: TransactionHelper,
    private readonly stockService: StockService,
  ) {}

  async create(dto: CreateStockTransferDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException(
        "Source and destination warehouses must be different.",
      );
    }

    // Check duplicate products in lines
    const productIds = dto.lines.map((l) => l.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException(
        "Duplicate products in transfer lines are not allowed.",
      );
    }

    return this.transactionHelper.run(async (tx) => {
      // Validate warehouses belong to tenant and are active
      const fromWh = await tx.warehouse.findFirst({
        where: {
          id: dto.fromWarehouseId,
          tenantId: user.tenantId!,
          deletedAt: null,
        },
      });
      if (!fromWh) {
        throw new BadRequestException(
          "Source warehouse not found or inactive.",
        );
      }

      const toWh = await tx.warehouse.findFirst({
        where: {
          id: dto.toWarehouseId,
          tenantId: user.tenantId!,
          deletedAt: null,
        },
      });
      if (!toWh) {
        throw new BadRequestException(
          "Destination warehouse not found or inactive.",
        );
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

      const transferNumber = `TRF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const transfer = await tx.stockTransfer.create({
        data: {
          tenantId: user.tenantId!,
          transferNumber,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          status: StockTransferStatus.DRAFT,
          note: dto.note || null,
          performedBy: user.id,
          version: 1,
          lines: {
            create: dto.lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
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
        entity: "StockTransfer",
        entityId: transfer.id,
        action: "STOCK_TRANSFER_CREATED",
        oldValues: null,
        newValues: transfer,
      });

      return transfer;
    });
  }

  async findAll(query: QueryStockTransferDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockTransferWhereInput = {
      tenantId: user.tenantId!,
      deletedAt: query.includeDeleted ? undefined : null,
    };

    if (query.status) {
      where.status = query.status;
    }

    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [totalItems, data] = await Promise.all([
      this.prisma.stockTransfer.count({ where }),
      this.prisma.stockTransfer.findMany({
        where,
        orderBy: { [sortField]: order },
        skip,
        take: limit,
        include: {
          lines: {
            select: {
              id: true,
              productId: true,
              quantity: true,
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
    const record = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        lines: {
          select: {
            id: true,
            productId: true,
            quantity: true,
          },
        },
      },
    });

    if (!record || record.deletedAt) {
      throw new NotFoundException("Stock transfer not found");
    }

    if (record.tenantId !== user.tenantId) {
      throw new ForbiddenException("Access denied.");
    }

    return record;
  }

  async update(id: string, dto: UpdateStockTransferDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.stockTransfer.findUnique({
        where: { id },
        include: { lines: true },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Stock transfer not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.status !== StockTransferStatus.DRAFT) {
        throw new BadRequestException(
          "Only stock transfers in DRAFT status can be modified.",
        );
      }

      if (record.version !== dto.expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      const fromWhId =
        dto.fromWarehouseId !== undefined
          ? dto.fromWarehouseId
          : record.fromWarehouseId;
      const toWhId =
        dto.toWarehouseId !== undefined
          ? dto.toWarehouseId
          : record.toWarehouseId;

      if (fromWhId === toWhId) {
        throw new BadRequestException(
          "Source and destination warehouses must be different.",
        );
      }

      if (dto.fromWarehouseId !== undefined) {
        const fromWh = await tx.warehouse.findFirst({
          where: {
            id: dto.fromWarehouseId,
            tenantId: user.tenantId!,
            deletedAt: null,
          },
        });
        if (!fromWh) {
          throw new BadRequestException(
            "Source warehouse not found or inactive.",
          );
        }
      }

      if (dto.toWarehouseId !== undefined) {
        const toWh = await tx.warehouse.findFirst({
          where: {
            id: dto.toWarehouseId,
            tenantId: user.tenantId!,
            deletedAt: null,
          },
        });
        if (!toWh) {
          throw new BadRequestException(
            "Destination warehouse not found or inactive.",
          );
        }
      }

      if (dto.lines !== undefined) {
        const productIds = dto.lines.map((l) => l.productId);
        if (new Set(productIds).size !== productIds.length) {
          throw new BadRequestException(
            "Duplicate products in transfer lines are not allowed.",
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

      // Perform update using UncheckedUpdateInput to directly write warehouse ID scalar properties
      const updateData: Prisma.StockTransferUncheckedUpdateInput = {
        note: dto.note !== undefined ? dto.note || null : undefined,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        version: { increment: 1 },
      };

      if (dto.lines !== undefined) {
        // Delete old lines
        await tx.stockTransferLine.deleteMany({
          where: { transferId: id },
        });
        // Create new lines
        updateData.lines = {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
          })),
        };
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: updateData,
        include: { lines: true },
      });

      await this.auditService.log({
        tenantId: user.tenantId!,
        userId: user.id,
        entity: "StockTransfer",
        entityId: id,
        action: "STOCK_TRANSFER_UPDATED",
        oldValues: record,
        newValues: updated,
      });

      return updated;
    });
  }

  async delete(id: string, expectedVersion: number, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.stockTransfer.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Stock transfer not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.status !== StockTransferStatus.DRAFT) {
        throw new BadRequestException(
          "Only stock transfers in DRAFT status can be deleted.",
        );
      }

      if (record.version !== expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.log({
        tenantId: user.tenantId!,
        userId: user.id,
        entity: "StockTransfer",
        entityId: id,
        action: "STOCK_TRANSFER_DELETED",
        oldValues: record,
        newValues: updated,
      });

      return updated;
    });
  }

  async process(id: string, expectedVersion: number, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.stockTransfer.findUnique({
        where: { id },
        include: { lines: true },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Stock transfer not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.status === StockTransferStatus.COMPLETED) {
        throw new BadRequestException("Transfer is already completed.");
      }

      if (record.status === StockTransferStatus.CANCELLED) {
        throw new BadRequestException(
          "Cancelled transfers cannot be processed.",
        );
      }

      if (record.version !== expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      if (!record.lines.length) {
        throw new BadRequestException(
          "Cannot process a stock transfer with no lines.",
        );
      }

      // Lock stock rows in deterministic order (by productId ascending) to prevent deadlocks
      const sortedLines = [...record.lines].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      );

      // Process movements under row locks
      for (const line of sortedLines) {
        // Decrease source warehouse
        await this.stockService.mutateStock(
          tx,
          user.tenantId!,
          record.fromWarehouseId,
          line.productId,
          StockTransactionType.TRANSFER_OUT,
          -Number(line.quantity),
          "StockTransfer",
          record.id,
          user.id,
          `Transfer OUT from warehouse ${record.fromWarehouseId} to ${record.toWarehouseId}`,
        );

        // Increase destination warehouse
        await this.stockService.mutateStock(
          tx,
          user.tenantId!,
          record.toWarehouseId,
          line.productId,
          StockTransactionType.TRANSFER_IN,
          Number(line.quantity),
          "StockTransfer",
          record.id,
          user.id,
          `Transfer IN from warehouse ${record.fromWarehouseId} to ${record.toWarehouseId}`,
        );
      }

      // Update transfer status
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.COMPLETED,
          version: { increment: 1 },
        },
        include: { lines: true },
      });

      await this.auditService.log({
        tenantId: user.tenantId!,
        userId: user.id,
        entity: "StockTransfer",
        entityId: id,
        action: "STOCK_TRANSFER_COMPLETED",
        oldValues: record,
        newValues: updated,
      });

      return updated;
    });
  }
}
