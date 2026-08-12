import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { NotificationType } from "../../notifications/dto/query-notification.dto";
import { ExchangeRateService } from "./exchange-rate.service";
import { RunConsolidationDto } from "../dto/run-consolidation.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Injectable()
export class ConsolidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async runConsolidation(
    tenantId: string,
    dto: RunConsolidationDto,
    user: AuthUser,
  ) {
    const parentCompany = await this.prisma.company.findFirst({
      where: { tenantId, id: dto.parentCompanyId },
    });

    if (!parentCompany) {
      throw new NotFoundException("Parent company not found.");
    }

    // 1. Create ConsolidationRun record
    const run = await this.prisma.consolidationRun.create({
      data: {
        tenantId,
        parentCompanyId: dto.parentCompanyId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: "RUNNING",
        runBy: user.id,
      },
    });

    await this.auditService.log({
      action: "CONSOLIDATION_STARTED",
      entity: "ConsolidationRun",
      entityId: run.id,
      newValues: {
        parentCompanyId: dto.parentCompanyId,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
      userId: user.id,
      tenantId,
    });

    try {
      // Find or create virtual consolidation company
      let consolidationEntity = await this.prisma.company.findFirst({
        where: { tenantId, code: "CONSOLIDATION_ENTITY" },
      });
      if (!consolidationEntity) {
        consolidationEntity = await this.prisma.company.create({
          data: {
            tenantId,
            parentId: dto.parentCompanyId,
            name: "Consolidation Entity",
            code: "CONSOLIDATION_ENTITY",
            legalName: "Amdox Consolidation Entity",
            baseCurrency: parentCompany.baseCurrency,
            country: parentCompany.country,
            isConsolidationEntity: true,
          },
        });
      }

      // Fetch subsidiaries
      const subsidiaries = await this.prisma.company.findMany({
        where: { tenantId, parentId: dto.parentCompanyId },
      });

      const allCompanies = [parentCompany, ...subsidiaries];

      // Prepare exchange rates
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);

      // Financial balance maps
      const balanceSheet: Record<string, number> = {
        Asset: 0,
        Liability: 0,
        Equity: 0,
      };
      const profitAndLoss: Record<string, number> = { Revenue: 0, Expense: 0 };
      const cashFlow: Record<string, number> = {
        Operations: 0,
        Investing: 0,
        Financing: 0,
      };

      // Process ledger entries for each company
      for (const comp of allCompanies) {
        const journalLines = await this.prisma.journalEntryLine.findMany({
          where: {
            tenantId,
            entry: {
              companyId: comp.id,
              postingDate: { gte: startDate, lte: endDate },
              status: "POSTED",
            },
          },
          include: { account: true },
        });

        // Translate subsidiary balances into parent currency
        const avgRate = await this.exchangeRateService.getExchangeRate(
          tenantId,
          comp.baseCurrency,
          parentCompany.baseCurrency,
          midDate,
          user,
        );
        const spotRate = await this.exchangeRateService.getExchangeRate(
          tenantId,
          comp.baseCurrency,
          parentCompany.baseCurrency,
          endDate,
          user,
        );

        for (const line of journalLines) {
          const balanceVal = Number(line.debit) - Number(line.credit);
          const type = line.account.type;

          if (type === "REVENUE" || type === "EXPENSE") {
            const parentCurrencyVal = balanceVal * avgRate;
            if (type === "REVENUE") {
              profitAndLoss.Revenue += parentCurrencyVal;
            } else {
              profitAndLoss.Expense += parentCurrencyVal;
            }
          } else {
            const parentCurrencyVal = balanceVal * spotRate;
            if (type === "ASSET") {
              balanceSheet.Asset += parentCurrencyVal;
            } else if (type === "LIABILITY") {
              balanceSheet.Liability += parentCurrencyVal;
            } else if (type === "EQUITY") {
              balanceSheet.Equity += parentCurrencyVal;
            }
          }

          // Simple cash flow categorization based on asset accounts
          if (line.account.code.startsWith("1100")) {
            cashFlow.Operations += balanceVal;
          }
        }
      }

      // 2. Automated Elimination Entries for Inter-Company Transactions
      const interCompanyTxs =
        await this.prisma.interCompanyTransaction.findMany({
          where: {
            tenantId,
            createdAt: { gte: startDate, lte: endDate },
            eliminated: false,
          },
        });

      for (const tx of interCompanyTxs) {
        // Find corresponding offset accounts or use defaults
        const revenueAccount = await this.prisma.account.findFirst({
          where: { tenantId, type: "REVENUE" },
        });
        const expenseAccount = await this.prisma.account.findFirst({
          where: { tenantId, type: "EXPENSE" },
        });

        if (!revenueAccount || !expenseAccount) {
          await this.notificationsService.createInternal({
            userId: user.id,
            tenantId,
            title: "Elimination Entry Failed",
            message:
              "Default Revenue/Expense accounts are missing; cannot run ledger elimination.",
            type: NotificationType.ERROR,
          });
          throw new BadRequestException(
            "Default accounting configuration is missing.",
          );
        }

        // Generate concrete JournalEntry for elimination
        const je = await this.prisma.journalEntry.create({
          data: {
            tenantId,
            entryNumber: `ELIM-${Date.now()}-${tx.id.substring(0, 8)}`,
            postingDate: new Date(),
            status: "POSTED",
            description: `Auto-elimination for intercompany transaction ${tx.id}`,
            sourceType: "MANUAL",
            companyId: consolidationEntity.id,
          },
        });

        // Debit Revenue, Credit Expense to eliminate intercompany trade
        await this.prisma.journalEntryLine.create({
          data: {
            tenantId,
            journalEntryId: je.id,
            accountId: revenueAccount.id,
            debit: tx.amount,
            credit: 0,
          },
        });

        await this.prisma.journalEntryLine.create({
          data: {
            tenantId,
            journalEntryId: je.id,
            accountId: expenseAccount.id,
            debit: 0,
            credit: tx.amount,
          },
        });

        // Update transaction status
        await this.prisma.interCompanyTransaction.update({
          where: { id: tx.id },
          data: { eliminated: true, eliminationId: je.id },
        });

        // Adjust consolidated statements
        profitAndLoss.Revenue -= Number(tx.amount);
        profitAndLoss.Expense -= Number(tx.amount);

        await this.auditService.log({
          action: "ELIMINATION_CREATED",
          entity: "JournalEntry",
          entityId: je.id,
          newValues: { id: je.id, entryNumber: je.entryNumber },
          userId: user.id,
          tenantId,
        });
      }

      // 3. Save consolidated reports in JSON fields
      await this.prisma.consolidatedReport.create({
        data: {
          tenantId,
          consolidationRunId: run.id,
          reportType: "BALANCE_SHEET",
          periodName: `${dto.startDate} to ${dto.endDate}`,
          currency: parentCompany.baseCurrency,
          data: balanceSheet,
        },
      });

      await this.prisma.consolidatedReport.create({
        data: {
          tenantId,
          consolidationRunId: run.id,
          reportType: "PROFIT_AND_LOSS",
          periodName: `${dto.startDate} to ${dto.endDate}`,
          currency: parentCompany.baseCurrency,
          data: profitAndLoss,
        },
      });

      await this.prisma.consolidatedReport.create({
        data: {
          tenantId,
          consolidationRunId: run.id,
          reportType: "CASH_FLOW",
          periodName: `${dto.startDate} to ${dto.endDate}`,
          currency: parentCompany.baseCurrency,
          data: cashFlow,
        },
      });

      // Update ConsolidationRun status to COMPLETED
      await this.prisma.consolidationRun.update({
        where: { id: run.id },
        data: { status: "COMPLETED" },
      });

      await this.auditService.log({
        action: "CONSOLIDATION_COMPLETED",
        entity: "ConsolidationRun",
        entityId: run.id,
        newValues: { id: run.id, status: "COMPLETED" },
        userId: user.id,
        tenantId,
      });

      return {
        runId: run.id,
        status: "COMPLETED",
        reports: {
          balanceSheet,
          profitAndLoss,
          cashFlow,
        },
      };
    } catch (error) {
      // Mark run as failed
      await this.prisma.consolidationRun.update({
        where: { id: run.id },
        data: { status: "FAILED" },
      });

      const errMessage = error instanceof Error ? error.message : String(error);

      // Notify administrator of failure
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Consolidation Run Failed",
        message: `Consolidation for period starting ${dto.startDate} encountered a critical error: ${errMessage}`,
        type: NotificationType.ERROR,
      });

      throw error;
    }
  }
}
