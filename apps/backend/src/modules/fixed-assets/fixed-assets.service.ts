import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AccountingService } from "../accounting/accounting.service";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import {
  Prisma,
  AssetStatus,
  DepreciationMethod,
  JournalSourceType,
  AccountStatus,
} from "@amdox/database/generated";
import { CreateAssetCategoryDto } from "./dto/create-asset-category.dto";
import { UpdateAssetCategoryDto } from "./dto/update-asset-category.dto";
import { AcquireAssetDto } from "./dto/acquire-asset.dto";
import { DisposeAssetDto } from "./dto/dispose-asset.dto";
import { TransferAssetDto } from "./dto/transfer-asset.dto";
import { RecordMaintenanceDto } from "./dto/record-maintenance.dto";
import { RunDepreciationDto } from "./dto/run-depreciation.dto";
import { QueryAssetsDto } from "./dto/query-assets.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Injectable()
export class FixedAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly accountingService: AccountingService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- PRIVATE ACCOUNT VALIDATOR ---
  private async validateActiveAccount(
    tx: PrismaTx,
    accountId: string,
    tenantId: string,
    accountNameField: string,
  ) {
    const acc = await tx.account.findFirst({
      where: { id: accountId, tenantId, deletedAt: null },
    });
    if (!acc) {
      throw new NotFoundException(
        `${accountNameField} GL Account with ID ${accountId} not found.`,
      );
    }
    if (acc.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(
        `${accountNameField} GL Account with code ${acc.code} is inactive.`,
      );
    }
    return acc;
  }

  // --- ASSET CATEGORIES CRUD ---
  async createCategory(dto: CreateAssetCategoryDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    // Unique code check
    const dupCode = await this.prisma.assetCategory.findFirst({
      where: { tenantId, code: dto.code, deletedAt: null },
    });
    if (dupCode) {
      throw new BadRequestException(
        `Asset Category code ${dto.code} already exists.`,
      );
    }

    // Unique name check
    const dupName = await this.prisma.assetCategory.findFirst({
      where: { tenantId, name: dto.name, deletedAt: null },
    });
    if (dupName) {
      throw new BadRequestException(
        `Asset Category name ${dto.name} already exists.`,
      );
    }

    // Validate accounts are active
    await this.validateActiveAccount(
      this.prisma,
      dto.assetAccountId,
      tenantId,
      "Asset",
    );
    await this.validateActiveAccount(
      this.prisma,
      dto.accumulatedDepreciationAccountId,
      tenantId,
      "Accumulated Depreciation",
    );
    await this.validateActiveAccount(
      this.prisma,
      dto.depreciationExpenseAccountId,
      tenantId,
      "Depreciation Expense",
    );

    const category = await this.prisma.assetCategory.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        depreciationMethod: dto.depreciationMethod,
        usefulLife: dto.usefulLife,
        assetAccountId: dto.assetAccountId,
        accumulatedDepreciationAccountId: dto.accumulatedDepreciationAccountId,
        depreciationExpenseAccountId: dto.depreciationExpenseAccountId,
      },
    });

    await this.auditService.log({
      action: "ASSET_CATEGORY_CREATED",
      entity: "AssetCategory",
      entityId: category.id,
      tenantId,
      userId: user.id,
      newValues: category,
    });

    return category;
  }

  async updateCategory(
    id: string,
    dto: UpdateAssetCategoryDto,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const category = await this.prisma.assetCategory.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException(`Asset Category with ID ${id} not found.`);
    }

    if (category.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    if (dto.name && dto.name !== category.name) {
      const dup = await this.prisma.assetCategory.findFirst({
        where: { tenantId, name: dto.name, deletedAt: null, NOT: { id } },
      });
      if (dup) {
        throw new BadRequestException(
          `Asset Category name ${dto.name} already exists.`,
        );
      }
    }

    const updated = await this.prisma.assetCategory.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        depreciationMethod: dto.depreciationMethod,
        usefulLife: dto.usefulLife,
        isActive: dto.isActive,
        version: category.version + 1,
      },
    });

    await this.auditService.log({
      action: "ASSET_CATEGORY_UPDATED",
      entity: "AssetCategory",
      entityId: id,
      tenantId,
      userId: user.id,
      newValues: updated,
    });

    return updated;
  }

  async getCategories(user: AuthUser) {
    return this.prisma.assetCategory.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      orderBy: { code: "asc" },
    });
  }

  // --- ASSET ACQUISITION ---
  async acquireAsset(dto: AcquireAssetDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    if (dto.salvageValue >= dto.purchaseCost) {
      throw new BadRequestException(
        "Salvage value must be strictly less than purchase cost.",
      );
    }

    // SKU unique check
    const dupSku = await this.prisma.asset.findFirst({
      where: { tenantId, sku: dto.sku, deletedAt: null },
    });
    if (dupSku) {
      throw new BadRequestException(`Asset SKU ${dto.sku} already exists.`);
    }

    const category = await this.prisma.assetCategory.findFirst({
      where: {
        id: dto.assetCategoryId,
        tenantId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!category) {
      throw new NotFoundException(
        `Active Asset Category with ID ${dto.assetCategoryId} not found.`,
      );
    }

    // Execute within transaction for safety
    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Validate GL Accounts
      const creditAcc = await this.validateActiveAccount(
        tx,
        dto.creditAccountId,
        tenantId,
        "Credit",
      );
      const assetAcc = await tx.account.findFirst({
        where: { id: category.assetAccountId },
      });

      const asset = await tx.asset.create({
        data: {
          tenantId,
          assetCategoryId: dto.assetCategoryId,
          name: dto.name,
          sku: dto.sku,
          description: dto.description,
          status: AssetStatus.ACTIVE,
          purchaseDate: new Date(dto.purchaseDate),
          purchaseCost: new Prisma.Decimal(dto.purchaseCost),
          salvageValue: new Prisma.Decimal(dto.salvageValue),
          usefulLife: dto.usefulLife,
          depreciationMethod: dto.depreciationMethod,
          depreciationRate: new Prisma.Decimal(dto.depreciationRate || 0),
          bookValue: new Prisma.Decimal(dto.purchaseCost),
          accumulatedDepreciation: new Prisma.Decimal(0),
          location: dto.location,
          department: dto.department,
        },
      });

      // Post Journal Entry
      await this.accountingService.automatedPost(
        tx,
        JournalSourceType.ASSET,
        asset.id,
        `Acquisition of Asset ${asset.sku} - ${asset.name}`,
        [
          { code: assetAcc!.code, debit: dto.purchaseCost, credit: 0 },
          { code: creditAcc.code, debit: 0, credit: dto.purchaseCost },
        ],
        { id: user.id, tenantId },
      );

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "ASSET_ACQUIRED",
          entity: "Asset",
          entityId: asset.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(asset)),
        },
      });

      // Push Notification
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Asset Acquired",
        message: `Asset ${asset.sku} has been successfully acquired at cost ${dto.purchaseCost}.`,
        type: NotificationType.INFO,
      });

      return asset;
    });
  }

  // --- DEPRECIATION ENGINE ---
  async runDepreciation(dto: RunDepreciationDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const targetDate = new Date(dto.depreciationDate);

    // Fetch active/maintenance assets for this tenant
    const assets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        status: { in: [AssetStatus.ACTIVE, AssetStatus.UNDER_MAINTENANCE] },
        deletedAt: null,
      },
      include: { category: true },
    });

    const results: Array<{
      sku: string;
      name: string;
      amount: string;
      newBookValue: string;
    }> = [];

    // Execute in transaction
    await this.transactionHelper.run(async (tx: PrismaTx) => {
      for (const asset of assets) {
        // Determine start date of current depreciation run
        const startDate = asset.lastDepreciationDate
          ? new Date(asset.lastDepreciationDate)
          : new Date(asset.purchaseDate);

        // Calculate months difference
        const monthsDiff =
          (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
          (targetDate.getMonth() - startDate.getMonth());

        if (monthsDiff <= 0) {
          // Skip if already depreciated for this period or if target is prior to start
          continue;
        }

        let totalDeprecAmount = new Prisma.Decimal(0);
        let currentBookValue = new Prisma.Decimal(asset.bookValue);
        const salvageValue = new Prisma.Decimal(asset.salvageValue);

        // Process month by month to ensure capping
        for (let i = 0; i < monthsDiff; i++) {
          let deprecAmt = new Prisma.Decimal(0);

          if (asset.depreciationMethod === DepreciationMethod.STRAIGHT_LINE) {
            const cost = new Prisma.Decimal(asset.purchaseCost);
            deprecAmt = cost.sub(salvageValue).div(asset.usefulLife);
          } else {
            // DECLINING BALANCE
            const rate = new Prisma.Decimal(asset.depreciationRate);
            deprecAmt = currentBookValue.mul(rate).div(1200);
          }

          const remainingDepreciable = currentBookValue.sub(salvageValue);
          if (deprecAmt.gt(remainingDepreciable)) {
            deprecAmt = remainingDepreciable;
          }

          if (deprecAmt.lt(0)) {
            deprecAmt = new Prisma.Decimal(0);
          }

          totalDeprecAmount = totalDeprecAmount.add(deprecAmt);
          currentBookValue = currentBookValue.sub(deprecAmt);

          if (currentBookValue.equals(salvageValue)) {
            break;
          }
        }

        if (totalDeprecAmount.lte(0)) {
          continue;
        }

        // Validate GL Accounts
        const expAcc = await tx.account.findFirst({
          where: { id: asset.category.depreciationExpenseAccountId },
        });
        const accumAcc = await tx.account.findFirst({
          where: { id: asset.category.accumulatedDepreciationAccountId },
        });

        const bookBefore = asset.bookValue;
        const bookAfter = currentBookValue;
        const nextAccum = new Prisma.Decimal(asset.accumulatedDepreciation).add(
          totalDeprecAmount,
        );
        const fullyDepreciated = currentBookValue.equals(salvageValue);

        // Update Asset
        await tx.asset.update({
          where: { id: asset.id },
          data: {
            bookValue: bookAfter,
            accumulatedDepreciation: nextAccum,
            lastDepreciationDate: targetDate,
            status: fullyDepreciated ? AssetStatus.DEPRECIATED : asset.status,
            version: asset.version + 1,
          },
        });

        // Create Depreciation Record
        const deprecRecord = await tx.assetDepreciation.create({
          data: {
            tenantId,
            assetId: asset.id,
            depreciationDate: targetDate,
            amount: totalDeprecAmount,
            bookValueBefore: bookBefore,
            bookValueAfter: bookAfter,
          },
        });

        // GL Posting
        await this.accountingService.automatedPost(
          tx,
          JournalSourceType.ASSET,
          deprecRecord.id,
          `Monthly Depreciation for Asset ${asset.sku} (${monthsDiff} month(s))`,
          [
            { code: expAcc!.code, debit: Number(totalDeprecAmount), credit: 0 },
            {
              code: accumAcc!.code,
              debit: 0,
              credit: Number(totalDeprecAmount),
            },
          ],
          { id: user.id, tenantId },
        );

        // Log Audit Event
        await tx.auditLog.create({
          data: {
            action: "ASSET_DEPRECIATED",
            entity: "AssetDepreciation",
            entityId: deprecRecord.id,
            tenantId,
            userId: user.id,
            newValues: JSON.parse(JSON.stringify(deprecRecord)),
          },
        });

        results.push({
          sku: asset.sku,
          name: asset.name,
          amount: totalDeprecAmount.toString(),
          newBookValue: bookAfter.toString(),
        });
      }

      if (results.length > 0) {
        // Send Notification
        await this.notificationsService.createInternal({
          userId: user.id,
          tenantId,
          title: "Depreciation Completed",
          message: `Depreciation run completed successfully for ${results.length} asset(s).`,
          type: NotificationType.INFO,
        });
      }
    });

    return {
      message: "Depreciation run completed successfully.",
      processedAssets: results,
    };
  }

  // --- ASSET TRANSFERS ---
  async transferAsset(id: string, dto: TransferAssetDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found.`);
    }

    if (asset.status === AssetStatus.DISPOSED) {
      throw new BadRequestException("Cannot transfer a disposed asset.");
    }

    if (asset.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Create transfer history record
      const transfer = await tx.assetTransfer.create({
        data: {
          tenantId,
          assetId: id,
          transferDate: new Date(dto.transferDate),
          fromLocation: asset.location,
          toLocation: dto.toLocation,
          fromDepartment: asset.department,
          toDepartment: dto.toDepartment,
          reason: dto.reason,
        },
      });

      // Update location and department on Asset
      const updatedAsset = await tx.asset.update({
        where: { id },
        data: {
          location: dto.toLocation,
          department: dto.toDepartment,
          version: asset.version + 1,
        },
      });

      // Log Audit Trail
      await tx.auditLog.create({
        data: {
          action: "ASSET_TRANSFERRED",
          entity: "AssetTransfer",
          entityId: transfer.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(transfer)),
        },
      });

      // Push Notification
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Asset Transferred",
        message: `Asset ${asset.sku} transferred to ${dto.toLocation} / ${dto.toDepartment}.`,
        type: NotificationType.INFO,
      });

      return updatedAsset;
    });
  }

  // --- ASSET MAINTENANCE ---
  async recordMaintenance(
    id: string,
    dto: RecordMaintenanceDto,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { category: true },
    });
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found.`);
    }

    if (asset.status === AssetStatus.DISPOSED) {
      throw new BadRequestException(
        "Cannot record maintenance for a disposed asset.",
      );
    }

    if (asset.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    if (!dto.isCapitalized && !dto.expenseAccountId) {
      throw new BadRequestException(
        "expenseAccountId is required for expensed maintenance.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Validate accounts
      const creditAcc = await this.validateActiveAccount(
        tx,
        dto.creditAccountId,
        tenantId,
        "Credit",
      );

      let debitAccCode = "";
      if (dto.isCapitalized) {
        const catAssetAcc = await tx.account.findFirst({
          where: { id: asset.category.assetAccountId },
        });
        debitAccCode = catAssetAcc!.code;
      } else {
        const expAcc = await this.validateActiveAccount(
          tx,
          dto.expenseAccountId!,
          tenantId,
          "Expense",
        );
        debitAccCode = expAcc.code;
      }

      // Create log
      const maintenance = await tx.assetMaintenance.create({
        data: {
          tenantId,
          assetId: id,
          maintenanceDate: new Date(dto.maintenanceDate),
          description: dto.description,
          cost: new Prisma.Decimal(dto.cost),
          provider: dto.provider,
          isCapitalized: dto.isCapitalized,
        },
      });

      // GL Posting
      await this.accountingService.automatedPost(
        tx,
        JournalSourceType.ASSET,
        maintenance.id,
        `${dto.isCapitalized ? "Capitalized" : "Expensed"} maintenance on Asset ${asset.sku}`,
        [
          { code: debitAccCode, debit: dto.cost, credit: 0 },
          { code: creditAcc.code, debit: 0, credit: dto.cost },
        ],
        { id: user.id, tenantId },
      );

      let updatedAsset = asset;
      if (dto.isCapitalized) {
        // Increase bookValue by cost
        const newBookValue = new Prisma.Decimal(asset.bookValue).add(
          new Prisma.Decimal(dto.cost),
        );
        updatedAsset = await tx.asset.update({
          where: { id },
          data: {
            bookValue: newBookValue,
            version: asset.version + 1,
          },
          include: { category: true },
        });
      } else {
        // Just increment version
        updatedAsset = await tx.asset.update({
          where: { id },
          data: {
            version: asset.version + 1,
          },
          include: { category: true },
        });
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "ASSET_MAINTENANCE_RECORDED",
          entity: "AssetMaintenance",
          entityId: maintenance.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(maintenance)),
        },
      });

      // Notification
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Asset Maintenance Recorded",
        message: `Maintenance cost of ${dto.cost} recorded for Asset ${asset.sku}.`,
        type: NotificationType.INFO,
      });

      return updatedAsset;
    });
  }

  // --- ASSET DISPOSAL ---
  async disposeAsset(id: string, dto: DisposeAssetDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { category: true },
    });
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found.`);
    }

    if (asset.status === AssetStatus.DISPOSED) {
      throw new BadRequestException("Asset is already disposed.");
    }

    if (asset.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Validate accounts
      const cashAcc = await this.validateActiveAccount(
        tx,
        dto.cashAccountId,
        tenantId,
        "Cash/Proceeds",
      );
      const gainAcc = await this.validateActiveAccount(
        tx,
        dto.gainAccountId,
        tenantId,
        "Gain on Disposal",
      );
      const lossAcc = await this.validateActiveAccount(
        tx,
        dto.lossAccountId,
        tenantId,
        "Loss on Disposal",
      );

      const assetAcc = await tx.account.findFirst({
        where: { id: asset.category.assetAccountId },
      });
      const accumAcc = await tx.account.findFirst({
        where: { id: asset.category.accumulatedDepreciationAccountId },
      });

      const purchaseCost = new Prisma.Decimal(asset.purchaseCost);
      const accumulatedDeprec = new Prisma.Decimal(
        asset.accumulatedDepreciation,
      );
      const netBookValue = purchaseCost.sub(accumulatedDeprec);
      const saleVal = new Prisma.Decimal(dto.saleValue);

      const gainLoss = saleVal.sub(netBookValue);

      // Construct GL journal lines
      const journalLines: { code: string; debit: number; credit: number }[] =
        [];

      // Credit original asset cost from Asset GL Account
      journalLines.push({
        code: assetAcc!.code,
        debit: 0,
        credit: Number(purchaseCost),
      });

      // Debit Accumulated Depreciation (to write it off)
      if (accumulatedDeprec.gt(0)) {
        journalLines.push({
          code: accumAcc!.code,
          debit: Number(accumulatedDeprec),
          credit: 0,
        });
      }

      // Debit Cash/Receivables for Sale Proceed
      if (saleVal.gt(0)) {
        journalLines.push({
          code: cashAcc.code,
          debit: Number(saleVal),
          credit: 0,
        });
      }

      // Record Gain/Loss
      if (gainLoss.gt(0)) {
        journalLines.push({
          code: gainAcc.code,
          debit: 0,
          credit: Number(gainLoss),
        });
      } else if (gainLoss.lt(0)) {
        journalLines.push({
          code: lossAcc.code,
          debit: Number(gainLoss.abs()),
          credit: 0,
        });
      }

      // Write-off Asset status
      const updatedAsset = await tx.asset.update({
        where: { id },
        data: {
          bookValue: new Prisma.Decimal(0),
          status: AssetStatus.DISPOSED,
          version: asset.version + 1,
        },
      });

      // Post General Ledger journal entry
      await this.accountingService.automatedPost(
        tx,
        JournalSourceType.ASSET,
        asset.id,
        `Disposal of Asset ${asset.sku} - Net Book Value: ${netBookValue.toString()}, Proceeds: ${saleVal.toString()}`,
        journalLines,
        { id: user.id, tenantId },
      );

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "ASSET_DISPOSED",
          entity: "Asset",
          entityId: asset.id,
          tenantId,
          userId: user.id,
          newValues: {
            id,
            saleValue: dto.saleValue,
            gainLoss: gainLoss.toString(),
          },
        },
      });

      // Notification
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Asset Disposed",
        message: `Asset ${asset.sku} has been disposed. Proceeds: ${dto.saleValue}. Gain/Loss: ${gainLoss.toString()}`,
        type: NotificationType.INFO,
      });

      return updatedAsset;
    });
  }

  // --- REPORTING SERVICES ---
  async getAssetRegister(query: QueryAssetsDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const where: Prisma.AssetWhereInput = {
      tenantId,
      deletedAt: null,
    };
    if (query.status) {
      where.status = query.status;
    }
    if (query.categoryId) {
      where.assetCategoryId = query.categoryId;
    }

    return this.prisma.asset.findMany({
      where,
      include: { category: true },
      orderBy: { sku: "asc" },
    });
  }

  async getDepreciationRegister(user: AuthUser) {
    return this.prisma.assetDepreciation.findMany({
      where: { tenantId: user.tenantId! },
      include: { asset: true },
      orderBy: { depreciationDate: "desc" },
    });
  }

  async getNetBookValueReport(user: AuthUser) {
    const assets = await this.prisma.asset.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      include: { category: true },
      orderBy: { sku: "asc" },
    });

    return assets.map((a) => ({
      sku: a.sku,
      name: a.name,
      category: a.category.name,
      purchaseCost: a.purchaseCost.toString(),
      accumulatedDepreciation: a.accumulatedDepreciation.toString(),
      netBookValue: a.bookValue.toString(),
      status: a.status,
    }));
  }

  async getAssetMovementReport(user: AuthUser) {
    const transfers = await this.prisma.assetTransfer.findMany({
      where: { tenantId: user.tenantId! },
      include: { asset: true },
      orderBy: { transferDate: "desc" },
    });

    return transfers.map((t) => ({
      transferId: t.id,
      sku: t.asset.sku,
      name: t.asset.name,
      transferDate: t.transferDate,
      fromLocation: t.fromLocation,
      toLocation: t.toLocation,
      fromDepartment: t.fromDepartment,
      toDepartment: t.toDepartment,
      reason: t.reason,
    }));
  }

  // --- FIXED ASSET DASHBOARD ---
  async getDashboardSummary(user: AuthUser) {
    const tenantId = user.tenantId!;

    const aggregates = await this.prisma.asset.aggregate({
      where: { tenantId, deletedAt: null },
      _sum: {
        purchaseCost: true,
        accumulatedDepreciation: true,
        bookValue: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      totalAssetsCount: aggregates._count.id,
      totalPurchaseCost: (
        aggregates._sum.purchaseCost || new Prisma.Decimal(0)
      ).toString(),
      totalAccumDeprec: (
        aggregates._sum.accumulatedDepreciation || new Prisma.Decimal(0)
      ).toString(),
      totalNetBookValue: (
        aggregates._sum.bookValue || new Prisma.Decimal(0)
      ).toString(),
    };
  }
}
