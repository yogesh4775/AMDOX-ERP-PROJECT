import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { QueryStockDto } from "./dto/query-stock.dto";
import { QueryStockMovementDto } from "./dto/query-movement.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { Prisma, StockTransactionType } from "@amdox/database/generated";
import * as crypto from "crypto";

interface LockedStock {
  id: string;
  quantity: string;
}

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllStocks(query: QueryStockDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockWhereInput = {
      tenantId: user.tenantId!,
    };

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    const sortField = query.sort || "updatedAt";
    const order = query.order || "desc";

    const [totalItems, data] = await Promise.all([
      this.prisma.stock.count({ where }),
      this.prisma.stock.findMany({
        where,
        orderBy: { [sortField]: order },
        skip,
        take: limit,
        select: {
          id: true,
          productId: true,
          warehouseId: true,
          quantity: true,
          version: true,
          createdAt: true,
          updatedAt: true,
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

  async findAllMovements(query: QueryStockMovementDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {
      tenantId: user.tenantId!,
    };

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.type) {
      where.type = query.type;
    }

    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [totalItems, data] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { [sortField]: order },
        skip,
        take: limit,
        select: {
          id: true,
          productId: true,
          warehouseId: true,
          type: true,
          quantity: true,
          referenceType: true,
          referenceId: true,
          note: true,
          performedBy: true,
          createdAt: true,
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

  /**
   * Helper to modify stock balance & log movement under an active transaction client.
   * Lock rows deterministically to prevent deadlocks and negative balance anomalies.
   */
  async mutateStock(
    tx: Prisma.TransactionClient,
    tenantId: string,
    warehouseId: string,
    productId: string,
    type: StockTransactionType,
    quantityDelta: number,
    referenceType: string,
    referenceId: string,
    performedBy: string,
    note?: string,
  ) {
    // 1. Ensure Stock row exists
    const stockId = crypto.randomUUID();
    await tx.$executeRaw`
      INSERT INTO "stocks" ("id", "tenant_id", "product_id", "warehouse_id", "quantity", "version", "created_at", "updated_at")
      VALUES (${stockId}::uuid, ${tenantId}::uuid, ${productId}::uuid, ${warehouseId}::uuid, 0.0, 1, NOW(), NOW())
      ON CONFLICT ("tenant_id", "product_id", "warehouse_id") DO NOTHING
    `;

    // 2. Select FOR UPDATE to lock the row deterministically
    const stocks = await tx.$queryRaw<LockedStock[]>`
      SELECT id, quantity::text FROM "stocks"
      WHERE "tenant_id" = ${tenantId}::uuid
        AND "warehouse_id" = ${warehouseId}::uuid
        AND "product_id" = ${productId}::uuid
      FOR UPDATE
    `;

    if (!stocks.length) {
      throw new BadRequestException("Failed to acquire row lock on stock.");
    }

    const stock = stocks[0];
    const currentQty = Number(stock.quantity);
    const newQty = currentQty + quantityDelta;

    if (newQty < 0) {
      throw new BadRequestException(
        `Transaction rejected: Insufficient stock. Current: ${currentQty}, Delta: ${quantityDelta}, Product: ${productId}`,
      );
    }

    // 3. Update stock balance
    await tx.$executeRaw`
      UPDATE "stocks"
      SET "quantity" = ${newQty}, "version" = "version" + 1, "updated_at" = NOW()
      WHERE "id" = ${stock.id}::uuid
    `;

    // 4. Create historical movement record
    const movementId = crypto.randomUUID();
    await tx.$executeRaw`
      INSERT INTO "stock_movements" ("id", "tenant_id", "product_id", "warehouse_id", "type", "quantity", "reference_type", "reference_id", "note", "performed_by", "created_at")
      VALUES (${movementId}::uuid, ${tenantId}::uuid, ${productId}::uuid, ${warehouseId}::uuid, ${type}::"StockTransactionType", ${quantityDelta}, ${referenceType}, ${referenceId}::uuid, ${note || null}, ${performedBy}::uuid, NOW())
    `;
  }
}
