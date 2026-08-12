import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import {
  Prisma,
  BudgetStatus,
  AccountStatus,
  AccountType,
} from "@amdox/database/generated";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { UpdateBudgetDto } from "./dto/update-budget.dto";
import { CreateRevisionDto } from "./dto/create-revision.dto";
import { BudgetApprovalDto } from "./dto/budget-approval.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Injectable()
export class BudgetingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- PRIVATE VALiDATION HELPERS ---
  private async validateBudgetItems(
    tx: PrismaTx,
    tenantId: string,
    items: {
      glAccountId: string;
      category: string;
      amount: number;
      periodStart: string;
      periodEnd: string;
    }[],
  ) {
    const glAccountIds = items.map((i) => i.glAccountId);
    const dbAccounts = await tx.account.findMany({
      where: { id: { in: glAccountIds }, tenantId, deletedAt: null },
    });

    const accountMap = new Map(dbAccounts.map((a) => [a.id, a]));

    for (const item of items) {
      if (item.amount <= 0) {
        throw new BadRequestException(
          "Budget amounts must be greater than zero.",
        );
      }

      const acc = accountMap.get(item.glAccountId);
      if (!acc) {
        throw new NotFoundException(
          `GL Account with ID ${item.glAccountId} not found.`,
        );
      }
      if (acc.status !== AccountStatus.ACTIVE) {
        throw new BadRequestException(
          `GL Account with code ${acc.code} is inactive.`,
        );
      }

      // Check period bounds
      const start = new Date(item.periodStart);
      const end = new Date(item.periodEnd);
      if (start >= end) {
        throw new BadRequestException(
          "Period start date must be before end date.",
        );
      }
    }

    // Check overlaps within the input items
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];

        if (a.glAccountId === b.glAccountId) {
          const aStart = new Date(a.periodStart).getTime();
          const aEnd = new Date(a.periodEnd).getTime();
          const bStart = new Date(b.periodStart).getTime();
          const bEnd = new Date(b.periodEnd).getTime();

          const overlap = aStart < bEnd && bStart < aEnd;
          if (overlap) {
            throw new BadRequestException(
              "Budget periods must not overlap for the same GL Account.",
            );
          }
        }
      }
    }
  }

  // --- BUDGET CRUD ---
  async createBudget(dto: CreateBudgetDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    // Unique budget name per tenant and fiscal year
    const dup = await this.prisma.budget.findFirst({
      where: {
        tenantId,
        fiscalYear: dto.fiscalYear,
        name: dto.name,
        versionNumber: dto.versionNumber || 1,
        deletedAt: null,
      },
    });
    if (dup) {
      throw new BadRequestException(
        `Budget with name "${dto.name}" already exists for fiscal year ${dto.fiscalYear} (Version ${dto.versionNumber || 1}).`,
      );
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, tenantId, deletedAt: null },
      });
      if (!dept) {
        throw new NotFoundException(
          `Department with ID ${dto.departmentId} not found.`,
        );
      }
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Validate items
      await this.validateBudgetItems(tx, tenantId, dto.items);

      const budget = await tx.budget.create({
        data: {
          tenantId,
          name: dto.name,
          fiscalYear: dto.fiscalYear,
          periodType: dto.periodType,
          versionNumber: dto.versionNumber || 1,
          departmentId: dto.departmentId,
          costCenter: dto.costCenter,
          status: BudgetStatus.DRAFT,
          items: {
            create: dto.items.map((item) => ({
              tenantId,
              glAccountId: item.glAccountId,
              category: item.category,
              amount: new Prisma.Decimal(item.amount),
              periodStart: new Date(item.periodStart),
              periodEnd: new Date(item.periodEnd),
            })),
          },
        },
        include: { items: true },
      });

      // Log Audit
      await tx.auditLog.create({
        data: {
          action: "BUDGET_CREATED",
          entity: "Budget",
          entityId: budget.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(budget)),
        },
      });

      return budget;
    });
  }

  async getBudgets(user: AuthUser) {
    return this.prisma.budget.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      include: { department: true, items: true },
      orderBy: { fiscalYear: "desc" },
    });
  }

  async getBudgetById(id: string, user: AuthUser) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
      include: {
        department: true,
        items: { include: { glAccount: true } },
        revisions: { include: { revisionItems: true } },
      },
    });
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found.`);
    }
    return budget;
  }

  async updateBudget(id: string, dto: UpdateBudgetDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found.`);
    }

    if (budget.status === BudgetStatus.LOCKED) {
      throw new BadRequestException("Locked budgets cannot be modified.");
    }
    if (budget.status === BudgetStatus.APPROVED) {
      throw new BadRequestException(
        "Approved budgets can only change through revisions.",
      );
    }

    if (budget.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    const updated = await this.prisma.budget.update({
      where: { id },
      data: {
        name: dto.name,
        version: budget.version + 1,
      },
    });

    await this.auditService.log({
      action: "BUDGET_UPDATED",
      entity: "Budget",
      entityId: id,
      tenantId,
      userId: user.id,
      newValues: updated,
    });

    return updated;
  }

  // --- APPROVAL WORKFLOW ---
  async submitBudget(id: string, expectedVersion: number, user: AuthUser) {
    const tenantId = user.tenantId!;

    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found.`);
    }

    if (
      budget.status !== BudgetStatus.DRAFT &&
      budget.status !== BudgetStatus.REJECTED
    ) {
      throw new BadRequestException(
        "Budget can only be submitted from Draft or Rejected status.",
      );
    }

    if (budget.version !== expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.budget.update({
        where: { id },
        data: {
          status: BudgetStatus.PENDING_APPROVAL,
          version: budget.version + 1,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "BUDGET_SUBMITTED",
          entity: "Budget",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updated)),
        },
      });

      // Push Notification
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Budget Submitted",
        message: `Budget "${budget.name}" has been submitted for approval.`,
        type: NotificationType.INFO,
      });

      return updated;
    });
  }

  async approveBudget(id: string, dto: BudgetApprovalDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    // Check permissions (only users with budget:approve can execute)
    // Handled by Controller Guard, but let's double check or allow custom checks.
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found.`);
    }

    if (budget.status !== BudgetStatus.PENDING_APPROVAL) {
      throw new BadRequestException("Budget is not pending approval.");
    }

    if (
      dto.status !== BudgetStatus.APPROVED &&
      dto.status !== BudgetStatus.REJECTED
    ) {
      throw new BadRequestException(
        "Invalid approval status. Must be APPROVED or REJECTED.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.budget.update({
        where: { id },
        data: {
          status: dto.status,
          version: budget.version + 1,
        },
      });

      const auditAction =
        dto.status === BudgetStatus.APPROVED
          ? "BUDGET_APPROVED"
          : "BUDGET_REJECTED";

      await tx.auditLog.create({
        data: {
          action: auditAction,
          entity: "Budget",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updated)),
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title:
          dto.status === BudgetStatus.APPROVED
            ? "Budget Approved"
            : "Budget Rejected",
        message: `Budget "${budget.name}" has been ${dto.status.toLowerCase()}.`,
        type: NotificationType.INFO,
      });

      return updated;
    });
  }

  async lockBudget(id: string, expectedVersion: number, user: AuthUser) {
    const tenantId = user.tenantId!;

    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found.`);
    }

    if (budget.status !== BudgetStatus.APPROVED) {
      throw new BadRequestException("Only Approved budgets can be locked.");
    }

    if (budget.version !== expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.budget.update({
        where: { id },
        data: {
          status: BudgetStatus.LOCKED,
          version: budget.version + 1,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "BUDGET_LOCKED",
          entity: "Budget",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updated)),
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Budget Locked",
        message: `Budget "${budget.name}" is now locked.`,
        type: NotificationType.INFO,
      });

      return updated;
    });
  }

  // --- REVISIONS ---
  async createRevision(
    budgetId: string,
    dto: CreateRevisionDto,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, tenantId, deletedAt: null },
      include: { items: true },
    });
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${budgetId} not found.`);
    }

    if (
      budget.status !== BudgetStatus.APPROVED &&
      budget.status !== BudgetStatus.LOCKED
    ) {
      throw new BadRequestException(
        "Revisions can only be applied to Approved or Locked budgets.",
      );
    }

    // Determine next revision number
    const lastRev = await this.prisma.budgetRevision.findFirst({
      where: { tenantId, budgetId },
      orderBy: { revisionNumber: "desc" },
    });
    const nextRevNum = lastRev ? lastRev.revisionNumber + 1 : 1;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Create Revision header
      const revision = await tx.budgetRevision.create({
        data: {
          tenantId,
          budgetId,
          revisionNumber: nextRevNum,
          reason: dto.reason,
          approvedById: user.id,
          approvedAt: new Date(),
        },
      });

      // Map new revision amounts and apply modifications to the main budget items
      for (const item of dto.revisionItems) {
        if (item.amount <= 0) {
          throw new BadRequestException(
            "Revision amounts must be greater than zero.",
          );
        }

        // Add to revision item snapshot
        await tx.budgetRevisionItem.create({
          data: {
            tenantId,
            revisionId: revision.id,
            glAccountId: item.glAccountId,
            amount: new Prisma.Decimal(item.amount),
          },
        });

        // Update corresponding BudgetItem (historical snapshot of actual versions remains through BudgetRevision)
        const budgetItem = budget.items.find(
          (i) => i.glAccountId === item.glAccountId,
        );
        if (!budgetItem) {
          throw new NotFoundException(
            `GL Account ${item.glAccountId} is not allocated in this budget.`,
          );
        }

        await tx.budgetItem.update({
          where: { id: budgetItem.id },
          data: { amount: new Prisma.Decimal(item.amount) },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "BUDGET_REVISION_CREATED",
          entity: "BudgetRevision",
          entityId: revision.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(revision)),
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Budget Revision Created",
        message: `Revision #${nextRevNum} was registered for budget "${budget.name}".`,
        type: NotificationType.INFO,
      });

      return revision;
    });
  }

  // --- ACTUAL VS BUDGET VARIANCE REPORT ---
  async getVarianceReport(budgetId: string, user: AuthUser) {
    const tenantId = user.tenantId!;

    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, tenantId, deletedAt: null },
      include: { items: { include: { glAccount: true } } },
    });
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${budgetId} not found.`);
    }

    const reportLines = [];

    for (const item of budget.items) {
      // Pull actual posted journal entry lines
      const glLines = await this.prisma.journalEntryLine.findMany({
        where: {
          accountId: item.glAccountId,
          entry: {
            tenantId,
            status: "POSTED",
            postingDate: {
              gte: item.periodStart,
              lte: item.periodEnd,
            },
          },
        },
      });

      const actualSum = glLines.reduce((sum, line) => {
        const debit = new Prisma.Decimal(line.debit);
        const credit = new Prisma.Decimal(line.credit);

        if (
          item.glAccount.type === AccountType.ASSET ||
          item.glAccount.type === AccountType.EXPENSE
        ) {
          return sum.add(debit.sub(credit));
        } else {
          return sum.add(credit.sub(debit));
        }
      }, new Prisma.Decimal(0));

      const budgeted = new Prisma.Decimal(item.amount);
      const variance = actualSum.sub(budgeted);

      // Variance %
      let pct = 0;
      if (budgeted.gt(0)) {
        pct = Number(variance.div(budgeted).mul(100).toFixed(2));
      }

      reportLines.push({
        glAccountId: item.glAccountId,
        glAccountName: item.glAccount.name,
        glAccountCode: item.glAccount.code,
        category: item.category,
        budget: budgeted.toString(),
        actual: actualSum.toString(),
        variance: variance.toString(),
        variancePercentage: pct,
      });
    }

    return reportLines;
  }

  // --- SCENARIO FORECASTING ---
  async getForecastReport(
    budgetId: string,
    scenario: "OPTIMISTIC" | "BASE" | "PESSIMISTIC",
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, tenantId, deletedAt: null },
      include: { items: { include: { glAccount: true } } },
    });
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${budgetId} not found.`);
    }

    // Define Scenario multipliers
    let revMultiplier = new Prisma.Decimal(1.0);
    let expMultiplier = new Prisma.Decimal(1.0);

    if (scenario === "OPTIMISTIC") {
      revMultiplier = new Prisma.Decimal(1.2); // +20%
      expMultiplier = new Prisma.Decimal(0.9); // -10%
    } else if (scenario === "PESSIMISTIC") {
      revMultiplier = new Prisma.Decimal(0.8); // -20%
      expMultiplier = new Prisma.Decimal(1.15); // +15%
    }

    return budget.items.map((item) => {
      const isRev =
        item.category.toUpperCase() === "REVENUE" ||
        item.glAccount.type === AccountType.REVENUE;
      const original = new Prisma.Decimal(item.amount);
      const forecasted = isRev
        ? original.mul(revMultiplier)
        : original.mul(expMultiplier);

      return {
        glAccountId: item.glAccountId,
        glAccountName: item.glAccount.name,
        category: item.category,
        periodStart: item.periodStart,
        periodEnd: item.periodEnd,
        originalAmount: original.toString(),
        forecastedAmount: forecasted.toString(),
      };
    });
  }

  // --- DASHBOARD WIDGETS ---
  async getDashboardWidgets(user: AuthUser) {
    const tenantId = user.tenantId!;

    // Total Operating Expense budgeted vs actual
    const budgets = await this.prisma.budget.findMany({
      where: {
        tenantId,
        status: { in: [BudgetStatus.APPROVED, BudgetStatus.LOCKED] },
        deletedAt: null,
      },
      include: { items: { include: { glAccount: true } } },
    });

    let totalBudgetedExpense = new Prisma.Decimal(0);
    let totalActualExpense = new Prisma.Decimal(0);

    for (const b of budgets) {
      for (const item of b.items) {
        if (item.glAccount.type === AccountType.EXPENSE) {
          totalBudgetedExpense = totalBudgetedExpense.add(
            new Prisma.Decimal(item.amount),
          );

          // Actuals
          const glLines = await this.prisma.journalEntryLine.findMany({
            where: {
              accountId: item.glAccountId,
              entry: {
                tenantId,
                status: "POSTED",
                postingDate: { gte: item.periodStart, lte: item.periodEnd },
              },
            },
          });

          const actuals = glLines.reduce(
            (sum, line) =>
              sum.add(
                new Prisma.Decimal(line.debit).sub(
                  new Prisma.Decimal(line.credit),
                ),
              ),
            new Prisma.Decimal(0),
          );

          totalActualExpense = totalActualExpense.add(actuals);
        }
      }
    }

    let consumptionPct = 0;
    if (totalBudgetedExpense.gt(0)) {
      consumptionPct = Number(
        totalActualExpense.div(totalBudgetedExpense).mul(100).toFixed(2),
      );
    }

    return {
      totalBudgetedExpense: totalBudgetedExpense.toString(),
      totalActualExpense: totalActualExpense.toString(),
      consumptionPercentage: consumptionPct,
    };
  }
}
