import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { CreateTaxRuleDto } from "./dto/create-tax-rule.dto";
import { UpdateTaxRuleDto } from "./dto/update-tax-rule.dto";
import { CreateTaxExemptionDto } from "./dto/create-tax-exemption.dto";
import { UpdateTaxExemptionDto } from "./dto/update-tax-exemption.dto";
import { CalculateTaxDto } from "./dto/calculate-tax.dto";
import { QueryTaxTransactionDto } from "./dto/query-tax-transaction.dto";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import {
  Prisma,
  ExemptionEntityType,
  TaxTransactionSourceType,
} from "@amdox/database/generated";
import { PrismaTx } from "../../common/transactions/transaction.helper";

@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // --- TAX RULES CRUD ---
  async createRule(dto: CreateTaxRuleDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    if (dto.rate < 0 || dto.rate > 100) {
      throw new BadRequestException("Tax rate must be between 0 and 100.");
    }

    // Check unique name within tenant
    const duplicate = await this.prisma.taxRule.findFirst({
      where: { tenantId, name: dto.name, deletedAt: null },
    });
    if (duplicate) {
      throw new BadRequestException(
        `Tax rule with name '${dto.name}' already exists.`,
      );
    }

    // Only one active default rule per TaxCategory
    if (!dto.jurisdiction && dto.isActive !== false) {
      const activeDefault = await this.prisma.taxRule.findFirst({
        where: {
          tenantId,
          taxCategoryId: dto.taxCategoryId,
          jurisdiction: null,
          isActive: true,
          deletedAt: null,
        },
      });
      if (activeDefault) {
        throw new BadRequestException(
          "Only one active default rule is allowed per TaxCategory.",
        );
      }
    }

    const rule = await this.prisma.taxRule.create({
      data: {
        tenantId,
        name: dto.name,
        taxCategoryId: dto.taxCategoryId,
        rate: new Prisma.Decimal(dto.rate),
        jurisdiction: dto.jurisdiction || null,
        isActive: dto.isActive !== false,
      },
    });

    await this.auditService.log({
      action: "TAX_RULE_CREATED",
      entity: "TaxRule",
      entityId: rule.id,
      tenantId,
      userId: user.id,
      newValues: rule,
    });

    await this.notifyAdmins(
      tenantId,
      "Tax Rule Created",
      `Tax rule '${rule.name}' has been created with rate ${rule.rate.toString()}%.`,
    );

    return rule;
  }

  async findAllRules(user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    return this.prisma.taxRule.findMany({
      where: { tenantId: user.tenantId, deletedAt: null },
      include: { taxCategory: true },
    });
  }

  async updateRule(id: string, dto: UpdateTaxRuleDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const rule = await this.prisma.taxRule.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!rule) {
      throw new NotFoundException(`Tax Rule with ID ${id} not found.`);
    }

    if (rule.version !== dto.expectedVersion) {
      throw new ConflictException(
        `Optimistic concurrency lock failed. Expected version: ${rule.version}`,
      );
    }

    if (dto.rate !== undefined && (dto.rate < 0 || dto.rate > 100)) {
      throw new BadRequestException("Tax rate must be between 0 and 100.");
    }

    if (dto.name) {
      const duplicate = await this.prisma.taxRule.findFirst({
        where: { tenantId, name: dto.name, NOT: { id }, deletedAt: null },
      });
      if (duplicate) {
        throw new BadRequestException(
          `Tax rule with name '${dto.name}' already exists.`,
        );
      }
    }

    // Only one active default rule check
    const newJurisdiction =
      dto.jurisdiction !== undefined ? dto.jurisdiction : rule.jurisdiction;
    const newActive = dto.isActive !== undefined ? dto.isActive : rule.isActive;
    if (!newJurisdiction && newActive) {
      const activeDefault = await this.prisma.taxRule.findFirst({
        where: {
          tenantId,
          taxCategoryId: rule.taxCategoryId,
          jurisdiction: null,
          isActive: true,
          NOT: { id },
          deletedAt: null,
        },
      });
      if (activeDefault) {
        throw new BadRequestException(
          "Only one active default rule is allowed per TaxCategory.",
        );
      }
    }

    const updated = await this.prisma.taxRule.updateMany({
      where: { id, tenantId, version: dto.expectedVersion },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.rate !== undefined && { rate: new Prisma.Decimal(dto.rate) }),
        ...(dto.jurisdiction !== undefined && {
          jurisdiction: dto.jurisdiction || null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: rule.version + 1,
      },
    });

    if (updated.count === 0) {
      throw new ConflictException("Optimistic concurrency lock failed.");
    }

    const nextRule = await this.prisma.taxRule.findUnique({ where: { id } });

    await this.auditService.log({
      action: "TAX_RULE_UPDATED",
      entity: "TaxRule",
      entityId: id,
      tenantId,
      userId: user.id,
      oldValues: rule,
      newValues: nextRule,
    });

    await this.notifyAdmins(
      tenantId,
      "Tax Rule Updated",
      `Tax rule '${rule.name}' has been updated.`,
    );

    return nextRule;
  }

  // --- TAX EXEMPTIONS CRUD ---
  async createExemption(dto: CreateTaxExemptionDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    // Check unique name within tenant
    const duplicate = await this.prisma.taxExemption.findFirst({
      where: { tenantId, name: dto.name, deletedAt: null },
    });
    if (duplicate) {
      throw new BadRequestException(
        `Tax exemption with name '${dto.name}' already exists.`,
      );
    }

    // Verify tax rule exists
    const rule = await this.prisma.taxRule.findFirst({
      where: { id: dto.taxRuleId, tenantId, deletedAt: null },
    });
    if (!rule) {
      throw new NotFoundException(
        `Tax Rule with ID ${dto.taxRuleId} not found.`,
      );
    }

    const exemption = await this.prisma.taxExemption.create({
      data: {
        tenantId,
        name: dto.name,
        entityType: dto.entityType,
        entityId: dto.entityId,
        taxRuleId: dto.taxRuleId,
        reason: dto.reason || null,
        isActive: dto.isActive !== false,
      },
    });

    await this.auditService.log({
      action: "TAX_EXEMPTION_CREATED",
      entity: "TaxExemption",
      entityId: exemption.id,
      tenantId,
      userId: user.id,
      newValues: exemption,
    });

    await this.notifyAdmins(
      tenantId,
      "Tax Exemption Created",
      `Tax exemption '${exemption.name}' has been configured.`,
    );

    return exemption;
  }

  async findAllExemptions(user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    return this.prisma.taxExemption.findMany({
      where: { tenantId: user.tenantId, deletedAt: null },
      include: { taxRule: true },
    });
  }

  async updateExemption(
    id: string,
    dto: UpdateTaxExemptionDto,
    user: AuthUser,
  ) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const exemption = await this.prisma.taxExemption.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!exemption) {
      throw new NotFoundException(`Tax Exemption with ID ${id} not found.`);
    }

    if (exemption.version !== dto.expectedVersion) {
      throw new ConflictException(
        `Optimistic concurrency lock failed. Expected version: ${exemption.version}`,
      );
    }

    if (dto.name) {
      const duplicate = await this.prisma.taxExemption.findFirst({
        where: { tenantId, name: dto.name, NOT: { id }, deletedAt: null },
      });
      if (duplicate) {
        throw new BadRequestException(
          `Tax exemption with name '${dto.name}' already exists.`,
        );
      }
    }

    const updated = await this.prisma.taxExemption.updateMany({
      where: { id, tenantId, version: dto.expectedVersion },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.reason !== undefined && { reason: dto.reason || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: exemption.version + 1,
      },
    });

    if (updated.count === 0) {
      throw new ConflictException("Optimistic concurrency lock failed.");
    }

    const nextExemption = await this.prisma.taxExemption.findUnique({
      where: { id },
    });

    await this.auditService.log({
      action: "TAX_EXEMPTION_UPDATED",
      entity: "TaxExemption",
      entityId: id,
      tenantId,
      userId: user.id,
      oldValues: exemption,
      newValues: nextExemption,
    });

    await this.notifyAdmins(
      tenantId,
      "Tax Exemption Updated",
      `Tax exemption '${exemption.name}' has been updated.`,
    );

    return nextExemption;
  }

  // --- CENTRALIZED TAX CALCULATION ENGINE ---
  async calculateTax(dto: CalculateTaxDto, tenantId: string) {
    const results = [];
    let totalTaxAmount = new Prisma.Decimal(0);
    let totalBaseAmount = new Prisma.Decimal(0);

    for (const item of dto.items) {
      const baseVal = new Prisma.Decimal(item.baseAmount);
      totalBaseAmount = totalBaseAmount.add(baseVal);

      // 1. Check Product Exemption
      let matchedExemption = await this.prisma.taxExemption.findFirst({
        where: {
          tenantId,
          entityType: ExemptionEntityType.PRODUCT,
          entityId: item.productId,
          isActive: true,
          deletedAt: null,
        },
      });

      // 2. Check Customer Exemption
      if (!matchedExemption && dto.customerId) {
        matchedExemption = await this.prisma.taxExemption.findFirst({
          where: {
            tenantId,
            entityType: ExemptionEntityType.CUSTOMER,
            entityId: dto.customerId,
            isActive: true,
            deletedAt: null,
          },
        });
      }

      // 3. Check Supplier Exemption
      if (!matchedExemption && dto.supplierId) {
        matchedExemption = await this.prisma.taxExemption.findFirst({
          where: {
            tenantId,
            entityType: ExemptionEntityType.SUPPLIER,
            entityId: dto.supplierId,
            isActive: true,
            deletedAt: null,
          },
        });
      }

      if (matchedExemption) {
        // Exemption applies, tax rate is 0
        results.push({
          productId: item.productId,
          taxCategoryId: item.taxCategoryId,
          baseAmount: item.baseAmount.toString(),
          rate: "0.00",
          taxAmount: "0.0000",
          taxRuleId: matchedExemption.taxRuleId,
          exemptionId: matchedExemption.id,
        });
        continue;
      }

      // 4. Resolve Tax Rule
      let matchedRule = null;

      // Try jurisdiction-specific rule first
      if (dto.jurisdiction) {
        matchedRule = await this.prisma.taxRule.findFirst({
          where: {
            tenantId,
            taxCategoryId: item.taxCategoryId,
            jurisdiction: dto.jurisdiction,
            isActive: true,
            deletedAt: null,
          },
        });
      }

      // Fallback to default rule (jurisdiction: null)
      if (!matchedRule) {
        matchedRule = await this.prisma.taxRule.findFirst({
          where: {
            tenantId,
            taxCategoryId: item.taxCategoryId,
            jurisdiction: null,
            isActive: true,
            deletedAt: null,
          },
        });
      }

      let rateVal = new Prisma.Decimal(0);
      let taxRuleId: string | null = null;

      if (matchedRule) {
        rateVal = matchedRule.rate;
        taxRuleId = matchedRule.id;
      } else {
        // Fallback to default rate on TaxCategory itself
        const taxCat = await this.prisma.taxCategory.findFirst({
          where: { id: item.taxCategoryId, tenantId, deletedAt: null },
        });
        if (taxCat && taxCat.rate) {
          rateVal = taxCat.rate;
        }
      }

      const taxVal = baseVal.mul(rateVal).div(100);
      totalTaxAmount = totalTaxAmount.add(taxVal);

      results.push({
        productId: item.productId,
        taxCategoryId: item.taxCategoryId,
        baseAmount: item.baseAmount.toString(),
        rate: rateVal.toString(),
        taxAmount: taxVal.toString(),
        taxRuleId,
        exemptionId: null,
      });
    }

    return {
      totalBaseAmount: totalBaseAmount.toString(),
      totalTaxAmount: totalTaxAmount.toString(),
      items: results,
    };
  }

  async recordTaxTransaction(
    tx: PrismaTx,
    dto: {
      sourceType: TaxTransactionSourceType;
      sourceId: string;
      taxRuleId: string;
      baseAmount: number | Prisma.Decimal;
      taxAmount: number | Prisma.Decimal;
      rate: number | Prisma.Decimal;
    },
    tenantId: string,
  ) {
    // Prevent duplicates
    const duplicate = await tx.taxTransaction.findFirst({
      where: {
        tenantId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        taxRuleId: dto.taxRuleId,
      },
    });

    if (duplicate) {
      return duplicate;
    }

    const record = await tx.taxTransaction.create({
      data: {
        tenantId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        taxRuleId: dto.taxRuleId,
        baseAmount: new Prisma.Decimal(dto.baseAmount),
        taxAmount: new Prisma.Decimal(dto.taxAmount),
        rate: new Prisma.Decimal(dto.rate),
      },
    });

    // Logging audit
    await this.auditService.log(
      {
        action: "TAX_TRANSACTION_RECORDED",
        entity: "TaxTransaction",
        entityId: record.id,
        tenantId,
        newValues: record,
      },
      tx,
    );

    return record;
  }

  // --- TAX REPORTING & COMPILATION ---
  async getTaxReport(query: QueryTaxTransactionDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (query.periodId) {
      const period = await this.prisma.financialPeriod.findFirst({
        where: { id: query.periodId, tenantId, deletedAt: null },
      });
      if (period) {
        startDate = period.startDate;
        endDate = period.endDate;
      }
    } else {
      if (query.startDate) startDate = new Date(query.startDate);
      if (query.endDate) endDate = new Date(query.endDate);
    }

    const whereClause: Prisma.TaxTransactionWhereInput = {
      tenantId,
      ...(startDate &&
        endDate && {
          createdAt: { gte: startDate, lte: endDate },
        }),
    };

    const transactions = await this.prisma.taxTransaction.findMany({
      where: whereClause,
      include: {
        taxRule: {
          include: {
            taxCategory: true,
          },
        },
      },
    });

    let collectedTax = new Prisma.Decimal(0);
    let paidTax = new Prisma.Decimal(0);

    const jurisdictionMap = new Map<string, Prisma.Decimal>();
    const categoryMap = new Map<string, Prisma.Decimal>();

    for (const tx of transactions) {
      const amt = tx.taxAmount;

      // Collected Tax: Sales / Invoices
      if (
        tx.sourceType === TaxTransactionSourceType.INVOICE ||
        tx.sourceType === TaxTransactionSourceType.SALES
      ) {
        collectedTax = collectedTax.add(amt);
      } else if (tx.sourceType === TaxTransactionSourceType.PURCHASE) {
        // Paid Tax: Purchase
        paidTax = paidTax.add(amt);
      }

      // Jurisdiction aggregation
      const jurName = tx.taxRule.jurisdiction || "Default";
      const jurVal = jurisdictionMap.get(jurName) || new Prisma.Decimal(0);
      jurisdictionMap.set(jurName, jurVal.add(amt));

      // Category aggregation
      const catName = tx.taxRule.taxCategory.name;
      const catVal = categoryMap.get(catName) || new Prisma.Decimal(0);
      categoryMap.set(catName, catVal.add(amt));
    }

    const jurisdictionReport = Array.from(jurisdictionMap.entries()).map(
      ([jurisdiction, amount]) => ({
        jurisdiction,
        amount: amount.toString(),
      }),
    );

    const categoryReport = Array.from(categoryMap.entries()).map(
      ([category, amount]) => ({
        category,
        amount: amount.toString(),
      }),
    );

    return {
      startDate: startDate?.toISOString() || null,
      endDate: endDate?.toISOString() || null,
      collectedTax: collectedTax.toString(),
      paidTax: paidTax.toString(),
      jurisdictionReport,
      categoryReport,
      transactions: transactions.map((t) => ({
        id: t.id,
        sourceType: t.sourceType,
        sourceId: t.sourceId,
        baseAmount: t.baseAmount.toString(),
        taxAmount: t.taxAmount.toString(),
        rate: t.rate.toString(),
        jurisdiction: t.taxRule.jurisdiction || "Default",
        category: t.taxRule.taxCategory.name,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  // --- PRIVATE NOTIFIER ---
  private async notifyAdmins(tenantId: string, title: string, msg: string) {
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        userRoles: {
          some: {
            role: {
              name: { in: ["Admin", "Super Admin"] },
            },
          },
        },
      },
    });
    for (const admin of admins) {
      await this.notificationsService.createInternal({
        title,
        message: msg,
        type: NotificationType.INFO,
        userId: admin.id,
        tenantId,
      });
    }
  }
}
