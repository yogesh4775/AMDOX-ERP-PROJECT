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
import { CreatePeriodDto } from "./dto/create-period.dto";
import { UpdatePeriodDto } from "./dto/update-period.dto";
import { QueryFinancialReportDto } from "./dto/query-financial-report.dto";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import {
  Prisma,
  PeriodStatus,
  AccountType,
  JournalEntryStatus,
} from "@amdox/database/generated";

@Injectable()
export class FinancialReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // --- FINANCIAL PERIOD CRUD ---
  async createPeriod(dto: CreatePeriodDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (start >= end) {
      throw new BadRequestException("Start date must be before end date.");
    }

    // Check overlapping periods
    const overlap = await this.prisma.financialPeriod.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
    });

    if (overlap) {
      throw new BadRequestException(
        `Period overlaps with existing period '${overlap.name}' (${overlap.startDate.toISOString()} - ${overlap.endDate.toISOString()}).`,
      );
    }

    const period = await this.prisma.financialPeriod.create({
      data: {
        tenantId,
        name: dto.name,
        startDate: start,
        endDate: end,
        status: PeriodStatus.OPEN,
      },
    });

    await this.auditService.log({
      action: "FINANCIAL_PERIOD_CREATED",
      entity: "FinancialPeriod",
      entityId: period.id,
      tenantId,
      userId: user.id,
      newValues: period,
    });

    return period;
  }

  async findAllPeriods(user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    return this.prisma.financialPeriod.findMany({
      where: { tenantId: user.tenantId, deletedAt: null },
      orderBy: { startDate: "asc" },
    });
  }

  async closePeriod(id: string, dto: UpdatePeriodDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const period = await this.prisma.financialPeriod.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!period) {
      throw new NotFoundException(`Financial Period with ID ${id} not found.`);
    }

    if (period.status === PeriodStatus.CLOSED) {
      throw new BadRequestException("Closed periods cannot be edited.");
    }

    if (period.version !== dto.expectedVersion) {
      throw new ConflictException(
        `Optimistic concurrency lock failed. Expected version: ${period.version}`,
      );
    }

    // Verify no draft journal entries exist in the period
    const draftJournal = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId,
        status: JournalEntryStatus.DRAFT,
        postingDate: { gte: period.startDate, lte: period.endDate },
        deletedAt: null,
      },
    });
    if (draftJournal) {
      const msg = `Cannot close period: draft journal entry '${draftJournal.entryNumber}' exists in this range.`;
      await this.notifyExportFailure(tenantId, msg);
      throw new BadRequestException(msg);
    }

    // Verify no unposted accounting transactions exist in the period
    const draftInvoice = await this.prisma.invoice.findFirst({
      where: {
        tenantId,
        status: "DRAFT",
        createdAt: { gte: period.startDate, lte: period.endDate },
      },
    });
    if (draftInvoice) {
      const msg = "Cannot close period: unposted draft invoices exist.";
      await this.notifyExportFailure(tenantId, msg);
      throw new BadRequestException(msg);
    }

    const draftPayment = await this.prisma.payment.findFirst({
      where: {
        tenantId,
        status: "DRAFT",
        paymentDate: { gte: period.startDate, lte: period.endDate },
        deletedAt: null,
      },
    });
    if (draftPayment) {
      const msg = "Cannot close period: unposted draft payments exist.";
      await this.notifyExportFailure(tenantId, msg);
      throw new BadRequestException(msg);
    }

    const draftPurchase = await this.prisma.purchaseOrder.findFirst({
      where: {
        tenantId,
        status: { in: ["DRAFT", "APPROVED"] },
        createdAt: { gte: period.startDate, lte: period.endDate },
        deletedAt: null,
      },
    });
    if (draftPurchase) {
      const msg = "Cannot close period: unposted purchase orders exist.";
      await this.notifyExportFailure(tenantId, msg);
      throw new BadRequestException(msg);
    }

    const draftSale = await this.prisma.salesOrder.findFirst({
      where: {
        tenantId,
        status: { in: ["DRAFT", "CONFIRMED"] },
        createdAt: { gte: period.startDate, lte: period.endDate },
        deletedAt: null,
      },
    });
    if (draftSale) {
      const msg = "Cannot close period: unposted sales orders exist.";
      await this.notifyExportFailure(tenantId, msg);
      throw new BadRequestException(msg);
    }

    const updated = await this.prisma.financialPeriod.updateMany({
      where: { id, tenantId, version: dto.expectedVersion },
      data: {
        status: PeriodStatus.CLOSED,
        version: period.version + 1,
      },
    });

    if (updated.count === 0) {
      throw new ConflictException("Optimistic concurrency lock failed.");
    }

    const closedPeriod = await this.prisma.financialPeriod.findUnique({
      where: { id },
    });

    await this.auditService.log({
      action: "FINANCIAL_PERIOD_CLOSED",
      entity: "FinancialPeriod",
      entityId: id,
      tenantId,
      userId: user.id,
      oldValues: period,
      newValues: closedPeriod,
    });

    // Notify administrators
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
        title: "Financial Period Closed",
        message: `Financial period '${period.name}' has been closed successfully.`,
        type: NotificationType.INFO,
        userId: admin.id,
        tenantId,
      });
    }

    return closedPeriod;
  }

  // --- TRIAL BALANCE ---
  async getTrialBalance(query: QueryFinancialReportDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const { startDate, endDate } = await this.resolveDateRange(query, tenantId);

    // Sum all debits and credits of posted journal entry lines
    const totals = await this.prisma.journalEntryLine.aggregate({
      where: {
        tenantId,
        entry: {
          status: JournalEntryStatus.POSTED,
          postingDate: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
          deletedAt: null,
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const sumDebits = totals._sum.debit || new Prisma.Decimal(0);
    const sumCredits = totals._sum.credit || new Prisma.Decimal(0);

    if (!sumDebits.equals(sumCredits)) {
      throw new BadRequestException(
        `Trial Balance is not balanced. Total Debits: ${sumDebits.toString()}, Total Credits: ${sumCredits.toString()}`,
      );
    }

    // Retrieve accounts with balances
    const accounts = await this.prisma.account.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { code: "asc" },
    });

    const rows = await Promise.all(
      accounts.map(async (acc) => {
        // Query dynamic balance for date filters
        const lineTotals = await this.prisma.journalEntryLine.aggregate({
          where: {
            tenantId,
            accountId: acc.id,
            entry: {
              status: JournalEntryStatus.POSTED,
              postingDate: {
                ...(startDate && { gte: startDate }),
                ...(endDate && { lte: endDate }),
              },
              deletedAt: null,
            },
          },
          _sum: {
            debit: true,
            credit: true,
          },
        });

        const debit = lineTotals._sum.debit || new Prisma.Decimal(0);
        const credit = lineTotals._sum.credit || new Prisma.Decimal(0);

        let balance = new Prisma.Decimal(0);
        if (
          acc.type === AccountType.ASSET ||
          acc.type === AccountType.EXPENSE
        ) {
          balance = debit.sub(credit);
        } else {
          balance = credit.sub(debit);
        }

        return {
          id: acc.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          debit: debit.toString(),
          credit: credit.toString(),
          balance: balance.toString(),
        };
      }),
    );

    return {
      startDate: startDate?.toISOString() || null,
      endDate: endDate.toISOString(),
      totalDebits: sumDebits.toString(),
      totalCredits: sumCredits.toString(),
      rows,
    };
  }

  // --- PROFIT & LOSS ---
  async getProfitLoss(query: QueryFinancialReportDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const { startDate, endDate } = await this.resolveDateRange(query, tenantId);

    const statement = await this.computeProfitLossData(
      tenantId,
      startDate,
      endDate,
    );

    let comparative = null;
    if (query.comparativePeriodId) {
      const compPeriod = await this.prisma.financialPeriod.findFirst({
        where: { id: query.comparativePeriodId, tenantId, deletedAt: null },
      });
      if (compPeriod) {
        comparative = await this.computeProfitLossData(
          tenantId,
          compPeriod.startDate,
          compPeriod.endDate,
        );
      }
    }

    return {
      startDate: startDate?.toISOString() || null,
      endDate: endDate.toISOString(),
      statement,
      comparative,
    };
  }

  // --- BALANCE SHEET ---
  async getBalanceSheet(query: QueryFinancialReportDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const { endDate } = await this.resolveDateRange(query, tenantId);

    // Compute Net Income dynamically for the current period up to endDate
    const pl = await this.computeProfitLossData(tenantId, null, endDate);
    const netIncomeVal = new Prisma.Decimal(pl.netProfit);

    const accounts = await this.prisma.account.findMany({
      where: { tenantId, deletedAt: null },
    });

    let totalAssets = new Prisma.Decimal(0);
    let totalLiabilities = new Prisma.Decimal(0);
    let totalEquity = new Prisma.Decimal(0);

    const assetRows: { code: string; name: string; balance: string }[] = [];
    const liabilityRows: { code: string; name: string; balance: string }[] = [];
    const equityRows: { code: string; name: string; balance: string }[] = [];

    for (const acc of accounts) {
      const totals = await this.prisma.journalEntryLine.aggregate({
        where: {
          tenantId,
          accountId: acc.id,
          entry: {
            status: JournalEntryStatus.POSTED,
            postingDate: { lte: endDate },
            deletedAt: null,
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const debit = totals._sum.debit || new Prisma.Decimal(0);
      const credit = totals._sum.credit || new Prisma.Decimal(0);

      if (acc.type === AccountType.ASSET) {
        const bal = debit.sub(credit);
        totalAssets = totalAssets.add(bal);
        assetRows.push({
          code: acc.code,
          name: acc.name,
          balance: bal.toString(),
        });
      } else if (acc.type === AccountType.LIABILITY) {
        const bal = credit.sub(debit);
        totalLiabilities = totalLiabilities.add(bal);
        liabilityRows.push({
          code: acc.code,
          name: acc.name,
          balance: bal.toString(),
        });
      } else if (acc.type === AccountType.EQUITY) {
        const bal = credit.sub(debit);
        totalEquity = totalEquity.add(bal);
        equityRows.push({
          code: acc.code,
          name: acc.name,
          balance: bal.toString(),
        });
      }
    }

    // Inject Net Income dynamically under Equity
    totalEquity = totalEquity.add(netIncomeVal);
    equityRows.push({
      code: "NET_INC",
      name: "Current Period Net Income",
      balance: netIncomeVal.toString(),
    });

    const liabilitiesAndEquity = totalLiabilities.add(totalEquity);

    if (!totalAssets.equals(liabilitiesAndEquity)) {
      throw new BadRequestException(
        `Balance Sheet is out of balance. Assets: ${totalAssets.toString()}, Liabilities + Equity: ${liabilitiesAndEquity.toString()}`,
      );
    }

    return {
      endDate: endDate.toISOString(),
      assets: {
        rows: assetRows,
        total: totalAssets.toString(),
      },
      liabilities: {
        rows: liabilityRows,
        total: totalLiabilities.toString(),
      },
      equity: {
        rows: equityRows,
        total: totalEquity.toString(),
      },
      totalLiabilitiesAndEquity: liabilitiesAndEquity.toString(),
    };
  }

  // --- FINANCIAL SUMMARY ---
  async getFinancialSummary(query: QueryFinancialReportDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const { startDate, endDate } = await this.resolveDateRange(query, tenantId);

    const pl = await this.computeProfitLossData(tenantId, startDate, endDate);

    // Cash: balances of 1010 and 1020
    const cashVal = await this.getAccountBalanceSum(
      tenantId,
      ["1010", "1020"],
      endDate,
    );
    // Inventory: balance of 1400
    const invVal = await this.getAccountBalanceSum(tenantId, ["1400"], endDate);
    // Accounts Receivable: balance of 1200
    const arVal = await this.getAccountBalanceSum(tenantId, ["1200"], endDate);
    // Accounts Payable: balance of 2000
    const apVal = await this.getAccountBalanceSum(tenantId, ["2000"], endDate);

    return {
      startDate: startDate?.toISOString() || null,
      endDate: endDate.toISOString(),
      revenue: pl.revenue,
      expenses: pl.expenses,
      grossProfit: pl.grossProfit,
      netProfit: pl.netProfit,
      cash: cashVal.toString(),
      inventory: invVal.toString(),
      accountsReceivable: arVal.toString(),
      accountsPayable: apVal.toString(),
    };
  }

  // --- PRIVATE HELPERS ---
  private async resolveDateRange(
    query: QueryFinancialReportDto,
    tenantId: string,
  ): Promise<{ startDate: Date | null; endDate: Date }> {
    let startDate: Date | null = null;
    let endDate: Date = new Date();

    if (query.periodId) {
      const period = await this.prisma.financialPeriod.findFirst({
        where: { id: query.periodId, tenantId, deletedAt: null },
      });
      if (period) {
        startDate = period.startDate;
        endDate = period.endDate;
      }
    } else {
      if (query.startDate) {
        startDate = new Date(query.startDate);
      }
      if (query.endDate) {
        endDate = new Date(query.endDate);
      }
    }

    return { startDate, endDate };
  }

  private async computeProfitLossData(
    tenantId: string,
    startDate: Date | null,
    endDate: Date,
  ) {
    const revenueAccounts = await this.prisma.account.findMany({
      where: { tenantId, type: AccountType.REVENUE, deletedAt: null },
    });

    const expenseAccounts = await this.prisma.account.findMany({
      where: { tenantId, type: AccountType.EXPENSE, deletedAt: null },
    });

    let totalRevenue = new Prisma.Decimal(0);
    let totalCogs = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);

    const revenueDetails: { code: string; name: string; balance: string }[] =
      [];
    const expenseDetails: { code: string; name: string; balance: string }[] =
      [];

    // Aggregate Revenue
    for (const acc of revenueAccounts) {
      const totals = await this.prisma.journalEntryLine.aggregate({
        where: {
          tenantId,
          accountId: acc.id,
          entry: {
            status: JournalEntryStatus.POSTED,
            postingDate: {
              ...(startDate && { gte: startDate }),
              lte: endDate,
            },
            deletedAt: null,
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const debit = totals._sum.debit || new Prisma.Decimal(0);
      const credit = totals._sum.credit || new Prisma.Decimal(0);
      const bal = credit.sub(debit);
      totalRevenue = totalRevenue.add(bal);
      revenueDetails.push({
        code: acc.code,
        name: acc.name,
        balance: bal.toString(),
      });
    }

    // Aggregate Expenses
    for (const acc of expenseAccounts) {
      const totals = await this.prisma.journalEntryLine.aggregate({
        where: {
          tenantId,
          accountId: acc.id,
          entry: {
            status: JournalEntryStatus.POSTED,
            postingDate: {
              ...(startDate && { gte: startDate }),
              lte: endDate,
            },
            deletedAt: null,
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const debit = totals._sum.debit || new Prisma.Decimal(0);
      const credit = totals._sum.credit || new Prisma.Decimal(0);
      const bal = debit.sub(credit);

      if (acc.code === "5000") {
        totalCogs = totalCogs.add(bal);
      } else {
        totalExpense = totalExpense.add(bal);
      }
      expenseDetails.push({
        code: acc.code,
        name: acc.name,
        balance: bal.toString(),
      });
    }

    const grossProfit = totalRevenue.sub(totalCogs);
    const netProfit = grossProfit.sub(totalExpense);

    return {
      revenue: totalRevenue.toString(),
      cogs: totalCogs.toString(),
      operatingExpenses: totalExpense.toString(),
      expenses: totalCogs.add(totalExpense).toString(),
      grossProfit: grossProfit.toString(),
      netProfit: netProfit.toString(),
      revenueDetails,
      expenseDetails,
    };
  }

  private async getAccountBalanceSum(
    tenantId: string,
    codes: string[],
    endDate: Date,
  ): Promise<Prisma.Decimal> {
    const accounts = await this.prisma.account.findMany({
      where: { tenantId, code: { in: codes }, deletedAt: null },
    });

    let sum = new Prisma.Decimal(0);
    for (const acc of accounts) {
      const totals = await this.prisma.journalEntryLine.aggregate({
        where: {
          tenantId,
          accountId: acc.id,
          entry: {
            status: JournalEntryStatus.POSTED,
            postingDate: { lte: endDate },
            deletedAt: null,
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const debit = totals._sum.debit || new Prisma.Decimal(0);
      const credit = totals._sum.credit || new Prisma.Decimal(0);

      if (acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE) {
        sum = sum.add(debit.sub(credit));
      } else {
        sum = sum.add(credit.sub(debit));
      }
    }
    return sum;
  }

  private async notifyExportFailure(tenantId: string, msg: string) {
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
        title: "Period Close Failed",
        message: msg,
        type: NotificationType.ERROR,
        userId: admin.id,
        tenantId,
      });
    }
  }
}
