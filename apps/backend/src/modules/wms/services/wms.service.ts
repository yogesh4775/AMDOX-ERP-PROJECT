import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { StockService } from "../../inventory/stock.service";
import { AccountingService } from "../../accounting/accounting.service";
import {
  TransactionHelper,
  PrismaTx,
} from "../../../common/transactions/transaction.helper";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import {
  CreateWarehouseZoneDto,
  UpdateWarehouseZoneDto,
} from "../dto/zone.dto";
import { CreateWarehouseBinDto, UpdateWarehouseBinDto } from "../dto/bin.dto";
import { CreatePutawayRuleDto } from "../dto/putaway-rule.dto";
import { CreateWarehouseMovementDto } from "../dto/movement.dto";
import { CreateCycleCountDto } from "../dto/cycle-count.dto";
import { NotificationType } from "../../notifications/dto/query-notification.dto";
import {
  Prisma,
  BinStatus,
  WmsMovementStatus,
  CycleCountStatus,
  WarehouseZone,
  WarehouseBin,
  BinStock,
  PutawayRule,
  WarehouseMovement,
  CycleCount,
  AccountType,
  StockTransactionType,
  JournalSourceType,
} from "@amdox/database/generated";
import * as crypto from "crypto";

@Injectable()
export class WmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly stockService: StockService,
    private readonly accountingService: AccountingService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- ZONES MANAGEMENT ---

  async createZone(
    tenantId: string,
    dto: CreateWarehouseZoneDto,
    user: AuthUser,
  ): Promise<WarehouseZone> {
    const exist = await this.prisma.warehouseZone.findFirst({
      where: { warehouseId: dto.warehouseId, code: dto.code, deletedAt: null },
    });
    if (exist) {
      throw new ConflictException(
        `Zone code ${dto.code} already exists for this warehouse.`,
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const zone = await tx.warehouseZone.create({
        data: {
          tenantId,
          warehouseId: dto.warehouseId,
          code: dto.code,
          name: dto.name,
          description: dto.description || null,
          isHazardous: dto.isHazardous ?? false,
          temperatureClass: dto.temperatureClass || "AMBIENT",
          version: 1,
        },
      });

      await this.auditService.log({
        action: "BIN_CREATED",
        entity: "WarehouseZone",
        entityId: zone.id,
        tenantId,
        userId: user.id,
        newValues: zone,
      });

      return zone;
    });
  }

  async updateZone(
    tenantId: string,
    id: string,
    dto: UpdateWarehouseZoneDto,
    user: AuthUser,
  ): Promise<WarehouseZone> {
    const zone = await this.prisma.warehouseZone.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!zone) {
      throw new NotFoundException(`Zone ${id} not found.`);
    }

    if (
      dto.expectedVersion !== undefined &&
      zone.version !== dto.expectedVersion
    ) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.warehouseZone.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name : zone.name,
          description:
            dto.description !== undefined ? dto.description : zone.description,
          isHazardous:
            dto.isHazardous !== undefined ? dto.isHazardous : zone.isHazardous,
          temperatureClass:
            dto.temperatureClass !== undefined
              ? dto.temperatureClass
              : zone.temperatureClass,
          version: zone.version + 1,
        },
      });

      await this.auditService.log({
        action: "BIN_UPDATED",
        entity: "WarehouseZone",
        entityId: updated.id,
        tenantId,
        userId: user.id,
        newValues: updated,
      });

      return updated;
    });
  }

  async getZones(tenantId: string): Promise<WarehouseZone[]> {
    return this.prisma.warehouseZone.findMany({
      where: { tenantId, deletedAt: null },
      include: { warehouse: true },
    });
  }

  // --- BINS MANAGEMENT ---

  async createBin(
    tenantId: string,
    dto: CreateWarehouseBinDto,
    user: AuthUser,
  ): Promise<WarehouseBin> {
    const exist = await this.prisma.warehouseBin.findFirst({
      where: { zoneId: dto.zoneId, code: dto.code, deletedAt: null },
    });
    if (exist) {
      throw new ConflictException(
        `Bin code ${dto.code} already exists for this zone.`,
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const bin = await tx.warehouseBin.create({
        data: {
          tenantId,
          zoneId: dto.zoneId,
          code: dto.code,
          aisle: dto.aisle || null,
          rack: dto.rack || null,
          shelf: dto.shelf || null,
          position: dto.position || null,
          maxVolume: dto.maxVolume ? new Prisma.Decimal(dto.maxVolume) : null,
          maxWeight: dto.maxWeight ? new Prisma.Decimal(dto.maxWeight) : null,
          status: BinStatus.ACTIVE,
          version: 1,
        },
      });

      await this.auditService.log({
        action: "BIN_CREATED",
        entity: "WarehouseBin",
        entityId: bin.id,
        tenantId,
        userId: user.id,
        newValues: bin,
      });

      return bin;
    });
  }

  async updateBin(
    tenantId: string,
    id: string,
    dto: UpdateWarehouseBinDto,
    user: AuthUser,
  ): Promise<WarehouseBin> {
    const bin = await this.prisma.warehouseBin.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!bin) {
      throw new NotFoundException(`Bin ${id} not found.`);
    }

    if (
      dto.expectedVersion !== undefined &&
      bin.version !== dto.expectedVersion
    ) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.warehouseBin.update({
        where: { id },
        data: {
          status: dto.status !== undefined ? dto.status : bin.status,
          maxVolume:
            dto.maxVolume !== undefined
              ? dto.maxVolume
                ? new Prisma.Decimal(dto.maxVolume)
                : null
              : bin.maxVolume,
          maxWeight:
            dto.maxWeight !== undefined
              ? dto.maxWeight
                ? new Prisma.Decimal(dto.maxWeight)
                : null
              : bin.maxWeight,
          version: bin.version + 1,
        },
      });

      await this.auditService.log({
        action: "BIN_UPDATED",
        entity: "WarehouseBin",
        entityId: updated.id,
        tenantId,
        userId: user.id,
        newValues: updated,
      });

      return updated;
    });
  }

  async getBins(tenantId: string): Promise<WarehouseBin[]> {
    return this.prisma.warehouseBin.findMany({
      where: { tenantId, deletedAt: null },
      include: { zone: { include: { warehouse: true } } },
    });
  }

  async getBinStock(tenantId: string, binId: string): Promise<BinStock[]> {
    return this.prisma.binStock.findMany({
      where: { tenantId, binId },
      include: { product: true },
    });
  }

  // --- PUTAWAY RULES & SUGGESTIONS ---

  async createPutawayRule(
    tenantId: string,
    dto: CreatePutawayRuleDto,
  ): Promise<PutawayRule> {
    return this.prisma.putawayRule.create({
      data: {
        tenantId,
        productId: dto.productId || null,
        categoryId: dto.categoryId || null,
        preferredZoneId: dto.preferredZoneId,
        priority: dto.priority || 1,
      },
    });
  }

  async getPutawayRules(tenantId: string): Promise<PutawayRule[]> {
    return this.prisma.putawayRule.findMany({
      where: { tenantId },
      include: { preferredZone: true, product: true, category: true },
    });
  }

  async suggestPutawayBin(
    tenantId: string,
    warehouseId: string,
    productId: string,
    quantity: number,
  ): Promise<WarehouseBin | null> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { category: true },
    });
    if (!product) return null;

    const isHazardousProduct =
      product.name.toLowerCase().includes("hazard") ||
      product.description?.toLowerCase().includes("hazard") ||
      product.category.name.toLowerCase().includes("hazard") ||
      product.category.description?.toLowerCase().includes("hazard");

    let tempReq = "AMBIENT";
    if (
      product.category.name.toLowerCase().includes("cold") ||
      product.name.toLowerCase().includes("cold")
    ) {
      tempReq = "COLD";
    } else if (
      product.category.name.toLowerCase().includes("frozen") ||
      product.name.toLowerCase().includes("frozen")
    ) {
      tempReq = "FROZEN";
    }

    const rules = await this.prisma.putawayRule.findMany({
      where: {
        tenantId,
        OR: [{ productId }, { categoryId: product.categoryId }],
      },
      orderBy: { priority: "asc" },
      include: {
        preferredZone: {
          include: {
            bins: {
              where: { status: BinStatus.ACTIVE, deletedAt: null },
            },
          },
        },
      },
    });

    let zones = [];
    if (rules.length > 0) {
      zones = rules.map((r) => r.preferredZone);
    } else {
      zones = await this.prisma.warehouseZone.findMany({
        where: {
          tenantId,
          warehouseId,
          isHazardous: isHazardousProduct,
          temperatureClass: tempReq,
          deletedAt: null,
        },
        include: {
          bins: {
            where: { status: BinStatus.ACTIVE, deletedAt: null },
          },
        },
      });
    }

    for (const zone of zones) {
      if (
        zone.isHazardous !== isHazardousProduct ||
        zone.temperatureClass !== tempReq
      ) {
        continue;
      }
      for (const bin of zone.bins) {
        const binStocks = await this.prisma.binStock.findMany({
          where: { binId: bin.id, tenantId },
        });
        const currentQty = binStocks.reduce(
          (sum, bs) => sum + Number(bs.quantity),
          0,
        );

        let hasCapacity = true;
        if (bin.maxVolume && currentQty + quantity > Number(bin.maxVolume)) {
          hasCapacity = false;
        }
        if (bin.maxWeight && currentQty + quantity > Number(bin.maxWeight)) {
          hasCapacity = false;
        }

        if (hasCapacity) {
          return bin;
        }
      }
    }

    const fallbackZone = await this.prisma.warehouseZone.findFirst({
      where: { tenantId, warehouseId, deletedAt: null },
      include: {
        bins: {
          where: { status: BinStatus.ACTIVE, deletedAt: null },
        },
      },
    });
    if (fallbackZone && fallbackZone.bins.length > 0) {
      return fallbackZone.bins[0];
    }

    return null;
  }

  // --- PICKING SUGGESTIONS ---

  async suggestPickBins(
    tenantId: string,
    warehouseId: string,
    productId: string,
    quantity: number,
    strategy: "FIFO" | "FEFO" = "FIFO",
  ): Promise<
    {
      binId: string;
      quantity: number;
      batchNumber: string | null;
      expiryDate: Date | null;
    }[]
  > {
    const binStocks = await this.prisma.binStock.findMany({
      where: {
        tenantId,
        productId,
        bin: {
          status: BinStatus.ACTIVE,
          deletedAt: null,
          zone: {
            warehouseId,
            deletedAt: null,
          },
        },
      },
      include: { bin: true },
    });

    if (strategy === "FEFO") {
      binStocks.sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.getTime() - b.expiryDate.getTime();
      });
    } else {
      binStocks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    const picks = [];
    let remaining = quantity;
    for (const stock of binStocks) {
      if (remaining <= 0) break;
      const qtyInBin = Number(stock.quantity);
      if (qtyInBin <= 0) continue;
      const pickQty = Math.min(qtyInBin, remaining);
      picks.push({
        binId: stock.binId,
        quantity: pickQty,
        batchNumber: stock.batchNumber,
        expiryDate: stock.expiryDate,
      });
      remaining -= pickQty;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `Insufficient bin-level stock in warehouse ${warehouseId} for product ${productId}. Required: ${quantity}, Available: ${quantity - remaining}`,
      );
    }

    return picks;
  }

  // --- STOCK MOVEMENTS ---

  async moveStock(
    tenantId: string,
    dto: CreateWarehouseMovementDto,
    user: AuthUser,
    txClient?: PrismaTx,
  ): Promise<WarehouseMovement> {
    const executor = async (tx: PrismaTx) => {
      const toBin = await tx.warehouseBin.findFirst({
        where: { id: dto.toBinId, tenantId, deletedAt: null },
        include: { zone: true },
      });
      if (!toBin) {
        throw new NotFoundException(
          `Destination bin ${dto.toBinId} not found.`,
        );
      }
      if (toBin.status !== BinStatus.ACTIVE) {
        throw new BadRequestException("Destination bin is full or blocked.");
      }

      if (dto.batchNumber) {
        const blockingLot = await tx.inspectionLot.findFirst({
          where: {
            tenantId,
            productId: dto.productId,
            status: { in: ["PENDING", "IN_PROGRESS", "FAILED"] },
            deletedAt: null,
          },
        });
        if (blockingLot) {
          const targetZone = toBin.zone;
          const targetZoneCode = targetZone.code.toUpperCase();
          if (
            !targetZoneCode.includes("REJ") &&
            !targetZoneCode.includes("RWK")
          ) {
            throw new BadRequestException(
              `Cannot move stock: batch ${dto.batchNumber} is currently under quality quarantine (Inspection Lot: ${blockingLot.code}, Status: ${blockingLot.status}).`,
            );
          }
        }
      }

      let fromWarehouseId = "";
      if (dto.fromBinId) {
        const fromBin = await tx.warehouseBin.findFirst({
          where: { id: dto.fromBinId, tenantId, deletedAt: null },
          include: { zone: true },
        });
        if (!fromBin) {
          throw new NotFoundException(`Source bin ${dto.fromBinId} not found.`);
        }
        fromWarehouseId = fromBin.zone.warehouseId;

        const sourceStock = await tx.binStock.findFirst({
          where: {
            tenantId,
            binId: dto.fromBinId,
            productId: dto.productId,
            batchNumber: dto.batchNumber || null,
          },
        });
        if (!sourceStock || Number(sourceStock.quantity) < dto.quantity) {
          throw new BadRequestException("Insufficient quantity in source bin.");
        }

        const newSourceQty = Number(sourceStock.quantity) - dto.quantity;
        if (newSourceQty === 0) {
          await tx.binStock.delete({ where: { id: sourceStock.id } });
        } else {
          await tx.binStock.update({
            where: { id: sourceStock.id },
            data: { quantity: newSourceQty },
          });
        }
      }

      const toWarehouseId = toBin.zone.warehouseId;
      const expiryDate = dto.fromBinId
        ? (
            await tx.binStock.findFirst({
              where: {
                tenantId,
                binId: dto.fromBinId,
                productId: dto.productId,
                batchNumber: dto.batchNumber || null,
              },
            })
          )?.expiryDate
        : null;

      const destStockId = crypto.randomUUID();
      await tx.$executeRaw`
        INSERT INTO "bin_stocks" ("id", "tenant_id", "bin_id", "product_id", "quantity", "batch_number", "expiry_date", "created_at", "updated_at")
        VALUES (
          ${destStockId}::uuid, 
          ${tenantId}::uuid, 
          ${dto.toBinId}::uuid, 
          ${dto.productId}::uuid, 
          ${dto.quantity}, 
          ${dto.batchNumber || null}, 
          ${expiryDate}, 
          NOW(), 
          NOW()
        )
        ON CONFLICT ("tenant_id", "bin_id", "product_id", "batch_number")
        DO UPDATE SET "quantity" = bin_stocks.quantity + ${dto.quantity}, "updated_at" = NOW()
      `;

      if (dto.fromBinId && fromWarehouseId !== toWarehouseId) {
        await this.stockService.mutateStock(
          tx,
          tenantId,
          fromWarehouseId,
          dto.productId,
          StockTransactionType.TRANSFER_OUT,
          -dto.quantity,
          "WarehouseMovement",
          dto.toBinId,
          user.id,
          dto.reason ||
            `Inter-warehouse transfer from ${fromWarehouseId} to ${toWarehouseId}`,
        );

        await this.stockService.mutateStock(
          tx,
          tenantId,
          toWarehouseId,
          dto.productId,
          StockTransactionType.TRANSFER_IN,
          dto.quantity,
          "WarehouseMovement",
          dto.toBinId,
          user.id,
          dto.reason ||
            `Inter-warehouse transfer from ${fromWarehouseId} to ${toWarehouseId}`,
        );

        await this.notificationsService.createInternal(
          {
            tenantId,
            userId: user.id,
            title: "Warehouse Transfer Completed",
            message: `Stock transfer of ${dto.quantity} units for product ${dto.productId} completed successfully.`,
            type: NotificationType.INFO,
          },
          tx,
        );
      }

      const movement = await tx.warehouseMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          fromBinId: dto.fromBinId || null,
          toBinId: dto.toBinId,
          quantity: new Prisma.Decimal(dto.quantity),
          status: WmsMovementStatus.COMPLETED,
          reason: dto.reason || null,
          movedById: user.id,
          version: 1,
        },
      });

      await this.auditService.log({
        action: "STOCK_MOVED",
        entity: "WarehouseMovement",
        entityId: movement.id,
        tenantId,
        userId: user.id,
        newValues: movement,
      });

      const binStocks = await tx.binStock.findMany({
        where: { binId: dto.toBinId, tenantId },
      });
      const currentQty = binStocks.reduce(
        (sum, bs) => sum + Number(bs.quantity),
        0,
      );
      if (toBin.maxVolume && currentQty >= Number(toBin.maxVolume)) {
        await this.notificationsService.createInternal(
          {
            tenantId,
            userId: user.id,
            title: "Bin Reached Capacity",
            message: `Bin ${toBin.code} in Zone ${toBin.zone.code} is now full.`,
            type: NotificationType.WARNING,
          },
          tx,
        );
      }

      return movement;
    };

    return txClient ? executor(txClient) : this.transactionHelper.run(executor);
  }

  // --- CYCLE COUNTING & AUDITS ---

  async startCycleCount(
    tenantId: string,
    dto: CreateCycleCountDto,
    user: AuthUser,
  ): Promise<CycleCount> {
    const exist = await this.prisma.cycleCount.findFirst({
      where: { tenantId, code: dto.code, deletedAt: null },
    });
    if (exist) {
      throw new ConflictException(
        `Cycle count audit with code ${dto.code} already exists.`,
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const cycleCount = await tx.cycleCount.create({
        data: {
          tenantId,
          warehouseId: dto.warehouseId,
          code: dto.code,
          status: CycleCountStatus.DRAFT,
          countedById: user.id,
          version: 1,
        },
      });

      for (const line of dto.lines) {
        const binStocks = await tx.binStock.findMany({
          where: { tenantId, binId: line.binId, productId: line.productId },
        });
        const systemQty = binStocks.reduce(
          (sum, bs) => sum + Number(bs.quantity),
          0,
        );
        const variance = line.countedQty - systemQty;

        await tx.cycleCountLine.create({
          data: {
            tenantId,
            cycleCountId: cycleCount.id,
            binId: line.binId,
            productId: line.productId,
            systemQty: new Prisma.Decimal(systemQty),
            countedQty: new Prisma.Decimal(line.countedQty),
            variance: new Prisma.Decimal(variance),
          },
        });
      }

      await this.auditService.log({
        action: "CYCLE_COUNT_STARTED",
        entity: "CycleCount",
        entityId: cycleCount.id,
        tenantId,
        userId: user.id,
        newValues: cycleCount,
      });

      await this.notificationsService.createInternal(
        {
          tenantId,
          userId: user.id,
          title: "Cycle Count Started",
          message: `Cycle count audit ${dto.code} has been initiated.`,
          type: NotificationType.INFO,
        },
        tx,
      );

      return cycleCount;
    });
  }

  async recordCycleCountResults(
    tenantId: string,
    id: string,
    lines: { binId: string; productId: string; countedQty: number }[],
    user: AuthUser,
  ): Promise<CycleCount> {
    const cycle = await this.prisma.cycleCount.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { lines: true },
    });
    if (!cycle) {
      throw new NotFoundException(`Cycle count ${id} not found.`);
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      for (const input of lines) {
        const line = cycle.lines.find(
          (l) => l.binId === input.binId && l.productId === input.productId,
        );
        const systemQty = line ? Number(line.systemQty) : 0;
        const variance = input.countedQty - systemQty;

        if (line) {
          await tx.cycleCountLine.update({
            where: { id: line.id },
            data: {
              countedQty: new Prisma.Decimal(input.countedQty),
              variance: new Prisma.Decimal(variance),
            },
          });
        } else {
          await tx.cycleCountLine.create({
            data: {
              tenantId,
              cycleCountId: cycle.id,
              binId: input.binId,
              productId: input.productId,
              systemQty: new Prisma.Decimal(0),
              countedQty: new Prisma.Decimal(input.countedQty),
              variance: new Prisma.Decimal(input.countedQty),
            },
          });
        }
      }

      const updated = await tx.cycleCount.update({
        where: { id },
        data: {
          status: CycleCountStatus.COMPLETED,
          version: cycle.version + 1,
        },
        include: { lines: true },
      });

      await this.auditService.log({
        action: "CYCLE_COUNT_COMPLETED",
        entity: "CycleCount",
        entityId: updated.id,
        tenantId,
        userId: user.id,
        newValues: updated,
      });

      await this.notificationsService.createInternal(
        {
          tenantId,
          userId: user.id,
          title: "Cycle Count Completed",
          message: `Cycle count ${cycle.code} has been completed and variance calculated.`,
          type: NotificationType.INFO,
        },
        tx,
      );

      return updated;
    });
  }

  async approveCycleCount(
    tenantId: string,
    id: string,
    user: AuthUser,
  ): Promise<CycleCount> {
    const cycle = await this.prisma.cycleCount.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { lines: { include: { product: true } } },
    });
    if (!cycle) {
      throw new NotFoundException(`Cycle count ${id} not found.`);
    }

    if (cycle.status !== CycleCountStatus.COMPLETED) {
      throw new BadRequestException(
        "Only completed cycle counts can be approved.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      for (const line of cycle.lines) {
        const variance = Number(line.variance);
        if (variance === 0) continue;

        if (variance < 0) {
          const binStocks = await tx.binStock.findMany({
            where: { tenantId, binId: line.binId, productId: line.productId },
            orderBy: { expiryDate: "asc" },
          });
          let toDeduct = Math.abs(variance);
          for (const bs of binStocks) {
            if (toDeduct <= 0) break;
            const qty = Number(bs.quantity);
            if (qty <= toDeduct) {
              toDeduct -= qty;
              await tx.binStock.delete({ where: { id: bs.id } });
            } else {
              await tx.binStock.update({
                where: { id: bs.id },
                data: { quantity: qty - toDeduct },
              });
              toDeduct = 0;
            }
          }
        } else if (variance > 0) {
          const firstBinStock = await tx.binStock.findFirst({
            where: { tenantId, binId: line.binId, productId: line.productId },
          });
          if (firstBinStock) {
            await tx.binStock.update({
              where: { id: firstBinStock.id },
              data: { quantity: Number(firstBinStock.quantity) + variance },
            });
          } else {
            await tx.binStock.create({
              data: {
                tenantId,
                binId: line.binId,
                productId: line.productId,
                quantity: new Prisma.Decimal(variance),
                batchNumber: "CC-ADJ",
              },
            });
          }
        }

        await this.stockService.mutateStock(
          tx,
          tenantId,
          cycle.warehouseId,
          line.productId,
          StockTransactionType.ADJUSTMENT,
          variance,
          "CycleCount",
          cycle.id,
          user.id,
          `Cycle Count Adjustment for ${cycle.code}`,
        );

        const costPrice = Number(line.product.costPrice || 10.0);
        const adjustAmount = Math.abs(variance * costPrice);

        if (adjustAmount > 0) {
          const inventoryAccount = await this.getOrCreateAccount(
            tx,
            tenantId,
            "1400",
            "Inventory",
            AccountType.ASSET,
          );
          const adjustAccount = await this.getOrCreateAccount(
            tx,
            tenantId,
            "5700",
            "Inventory Adjustment",
            AccountType.EXPENSE,
          );

          const entryCode = `WMS-ADJ-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
          const entry = await tx.journalEntry.create({
            data: {
              tenantId,
              entryNumber: entryCode,
              postingDate: new Date(),
              description: `Cycle count variance adjustment for ${cycle.code}`,
              sourceType: JournalSourceType.STOCK_MOVEMENT,
              sourceId: cycle.id,
              status: "DRAFT",
              lines: {
                create: [
                  {
                    tenantId,
                    accountId:
                      variance > 0 ? inventoryAccount.id : adjustAccount.id,
                    debit: adjustAmount,
                    credit: 0,
                    description: `Debit: ${variance > 0 ? "Inventory increase" : "Adjustment loss"}`,
                  },
                  {
                    tenantId,
                    accountId:
                      variance > 0 ? adjustAccount.id : inventoryAccount.id,
                    debit: 0,
                    credit: adjustAmount,
                    description: `Credit: ${variance > 0 ? "Adjustment gain" : "Inventory decrease"}`,
                  },
                ],
              },
            },
          });

          await this.accountingService.postJournalEntry(
            entry.id,
            { expectedVersion: 1 },
            user,
            tx,
          );
        }

        if (adjustAmount > 500) {
          await this.notificationsService.createInternal(
            {
              tenantId,
              userId: user.id,
              title: "Large Inventory Variance Detected",
              message: `Product ${line.productId} variance exceeds threshold with value $${adjustAmount}.`,
              type: NotificationType.WARNING,
            },
            tx,
          );
        }
      }

      const approved = await tx.cycleCount.update({
        where: { id },
        data: {
          status: CycleCountStatus.COMPLETED,
        },
      });

      await this.auditService.log({
        action: "INVENTORY_ADJUSTED",
        entity: "CycleCount",
        entityId: approved.id,
        tenantId,
        userId: user.id,
        newValues: approved,
      });

      return approved;
    });
  }

  // --- ACCOUNTING COA UTILITY ---

  private async getOrCreateAccount(
    tx: PrismaTx,
    tenantId: string,
    code: string,
    name: string,
    type: AccountType,
  ) {
    let acc = await tx.account.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    if (!acc) {
      acc = await tx.account.create({
        data: {
          tenantId,
          code,
          name,
          type,
          description: `WMS automatic account for ${name}`,
          balance: new Prisma.Decimal(0),
          status: "ACTIVE",
        },
      });
    }
    return acc;
  }

  // --- WORKFLOW COMPLETION INTEGRATION ---

  async onWorkflowComplete(
    tx: PrismaTx,
    tenantId: string,
    entityId: string,
    status: string,
    user: AuthUser,
  ) {
    if (status === "APPROVED") {
      const count = await tx.cycleCount.findFirst({
        where: { id: entityId, tenantId, deletedAt: null },
      });
      if (count && count.status === CycleCountStatus.COMPLETED) {
        await this.approveCycleCount(tenantId, entityId, user);
      }
    }
  }

  // --- MODULE INTERCEPTOR EVENTS ---

  async handlePurchaseReceiptEvent(poId: string, user: AuthUser, tx: unknown) {
    const tenantId = user.tenantId!;
    const client = tx as PrismaTx;
    const receipt = await client.purchaseReceipt.findFirst({
      where: { purchaseOrderId: poId, tenantId },
      include: { items: true },
      orderBy: { receivedAt: "desc" },
    });
    if (!receipt) return;

    for (const item of receipt.items) {
      const qty = Number(item.quantityReceived);
      const optimalBin = await this.suggestPutawayBin(
        tenantId,
        receipt.warehouseId,
        item.productId,
        qty,
      );
      if (optimalBin) {
        const batchCode = `BATCH-PO-${receipt.id.substring(0, 8)}-${crypto.randomUUID().substring(0, 4).toUpperCase()}`;

        await client.binStock.upsert({
          where: {
            tenantId_binId_productId_batchNumber: {
              tenantId,
              binId: optimalBin.id,
              productId: item.productId,
              batchNumber: batchCode,
            },
          },
          update: {
            quantity: { increment: qty },
          },
          create: {
            tenantId,
            binId: optimalBin.id,
            productId: item.productId,
            quantity: qty,
            batchNumber: batchCode,
          },
        });
      }
    }
  }

  async handleWorkOrderStartEvent(woId: string, user: AuthUser, tx: unknown) {
    const tenantId = user.tenantId!;
    const client = tx as PrismaTx;
    const wo = await client.workOrder.findFirst({
      where: { id: woId, tenantId },
      include: { bom: { include: { items: { include: { product: true } } } } },
    });
    if (!wo || !wo.bom) return;

    const warehouse = await client.warehouse.findFirst({
      where: { tenantId, deletedAt: null },
    });
    if (!warehouse) return;
    const warehouseId = warehouse.id;

    for (const item of wo.bom.items) {
      const qtyNeeded = Number(item.quantity) * Number(wo.quantity);
      try {
        const picks = await this.suggestPickBins(
          tenantId,
          warehouseId,
          item.productId,
          qtyNeeded,
          "FIFO",
        );
        for (const pick of picks) {
          const binStock = await client.binStock.findFirst({
            where: {
              tenantId,
              binId: pick.binId,
              productId: item.productId,
              batchNumber: pick.batchNumber || null,
            },
          });
          if (binStock) {
            const nextQty = Number(binStock.quantity) - pick.quantity;
            if (nextQty <= 0) {
              await client.binStock.delete({ where: { id: binStock.id } });
            } else {
              await client.binStock.update({
                where: { id: binStock.id },
                data: { quantity: nextQty },
              });
            }
          }
        }
      } catch (err) {
        console.error("WMS picking error during work order start:", err);
      }
    }
  }

  async handleWorkOrderCompleteEvent(
    woId: string,
    user: AuthUser,
    tx: unknown,
  ) {
    const tenantId = user.tenantId!;
    const client = tx as PrismaTx;
    const wo = await client.workOrder.findFirst({
      where: { id: woId, tenantId },
    });
    if (!wo) return;

    const warehouse = await client.warehouse.findFirst({
      where: { tenantId, deletedAt: null },
    });
    if (!warehouse) return;
    const warehouseId = warehouse.id;

    const qty = Number(wo.quantity);
    const optimalBin = await this.suggestPutawayBin(
      tenantId,
      warehouseId,
      wo.productId,
      qty,
    );
    if (optimalBin) {
      const batchCode = `BATCH-WO-${wo.code}-${crypto.randomUUID().substring(0, 4).toUpperCase()}`;
      await client.binStock.upsert({
        where: {
          tenantId_binId_productId_batchNumber: {
            tenantId,
            binId: optimalBin.id,
            productId: wo.productId,
            batchNumber: batchCode,
          },
        },
        update: {
          quantity: { increment: qty },
        },
        create: {
          tenantId,
          binId: optimalBin.id,
          productId: wo.productId,
          quantity: qty,
          batchNumber: batchCode,
        },
      });
    }
  }

  async handleSalesOrderShipEvent(soId: string, user: AuthUser, tx: unknown) {
    const tenantId = user.tenantId!;
    const client = tx as PrismaTx;
    const so = await client.salesOrder.findFirst({
      where: { id: soId, tenantId },
      include: { items: true },
    });
    if (!so) return;

    const warehouse = await client.warehouse.findFirst({
      where: { tenantId, deletedAt: null },
    });
    if (!warehouse) return;
    const warehouseId = warehouse.id;

    for (const item of so.items) {
      const qty = Number(item.quantity);
      try {
        const picks = await this.suggestPickBins(
          tenantId,
          warehouseId,
          item.productId,
          qty,
          "FIFO",
        );
        for (const pick of picks) {
          const binStock = await client.binStock.findFirst({
            where: {
              tenantId,
              binId: pick.binId,
              productId: item.productId,
              batchNumber: pick.batchNumber || null,
            },
          });
          if (binStock) {
            const nextQty = Number(binStock.quantity) - pick.quantity;
            if (nextQty <= 0) {
              await client.binStock.delete({ where: { id: binStock.id } });
            } else {
              await client.binStock.update({
                where: { id: binStock.id },
                data: { quantity: nextQty },
              });
            }
          }
        }
      } catch (err) {
        console.error("WMS picking error during sales order ship:", err);
      }
    }
  }
}
