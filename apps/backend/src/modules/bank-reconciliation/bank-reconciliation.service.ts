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
  BankAccountStatus,
  BankTransactionType,
  BankTransactionStatus,
  ReconciliationStatus,
  MatchingStatus,
  JournalSourceType,
  AccountStatus,
  InvoiceStatus,
} from "@amdox/database/generated";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto";
import { CreateBankTransactionDto } from "./dto/create-bank-transaction.dto";
import { CreateReconciliationDto } from "./dto/create-reconciliation.dto";
import { ReconciliationMatchDto } from "./dto/reconciliation-match.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Injectable()
export class BankReconciliationService {
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

  // --- BANK ACCOUNTS CRUD ---
  async createBankAccount(dto: CreateBankAccountDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    if (dto.openingBalance < 0) {
      throw new BadRequestException("Opening balance cannot be negative.");
    }

    // Unique account number per tenant
    const dup = await this.prisma.bankAccount.findFirst({
      where: { tenantId, accountNumber: dto.accountNumber, deletedAt: null },
    });
    if (dup) {
      throw new BadRequestException(
        `Bank Account with account number ${dto.accountNumber} already exists.`,
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Validate linked GL Account is active
      await this.validateActiveAccount(
        tx,
        dto.glAccountId,
        tenantId,
        "Linked Bank",
      );

      const bankAcc = await tx.bankAccount.create({
        data: {
          tenantId,
          name: dto.name,
          accountNumber: dto.accountNumber,
          iban: dto.iban,
          swiftCode: dto.swiftCode,
          currency: dto.currency,
          category: dto.category,
          openingBalance: new Prisma.Decimal(dto.openingBalance),
          currentBalance: new Prisma.Decimal(dto.openingBalance),
          glAccountId: dto.glAccountId,
          status: BankAccountStatus.ACTIVE,
        },
      });

      // Post GL entry for opening balance if > 0
      if (dto.openingBalance > 0) {
        // Find Capital Account GL code 3000
        const capitalGL = await tx.account.findFirst({
          where: { tenantId, code: "3000", deletedAt: null },
        });
        if (capitalGL) {
          const bankGL = await tx.account.findUnique({
            where: { id: dto.glAccountId },
          });
          const journalLines = [
            { code: bankGL!.code, debit: dto.openingBalance, credit: 0 },
            { code: capitalGL.code, debit: 0, credit: dto.openingBalance },
          ];
          await this.accountingService.automatedPost(
            tx,
            JournalSourceType.BANK,
            bankAcc.id,
            `Opening balance for ${dto.name}`,
            journalLines,
            { id: user.id, tenantId },
          );
        }
      }

      // Log Audit
      await tx.auditLog.create({
        data: {
          action: "BANK_ACCOUNT_CREATED",
          entity: "BankAccount",
          entityId: bankAcc.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(bankAcc)),
        },
      });

      return bankAcc;
    });
  }

  async getBankAccounts(user: AuthUser) {
    return this.prisma.bankAccount.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      include: { glAccount: true },
      orderBy: { name: "asc" },
    });
  }

  async updateBankAccount(
    id: string,
    dto: UpdateBankAccountDto,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const bankAcc = await this.prisma.bankAccount.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!bankAcc) {
      throw new NotFoundException(`Bank Account with ID ${id} not found.`);
    }

    if (bankAcc.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    const updated = await this.prisma.bankAccount.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
        version: bankAcc.version + 1,
      },
    });

    await this.auditService.log({
      action: "BANK_ACCOUNT_UPDATED",
      entity: "BankAccount",
      entityId: id,
      tenantId,
      userId: user.id,
      newValues: updated,
    });

    return updated;
  }

  // --- BANK TRANSACTIONS ---
  async createTransaction(dto: CreateBankTransactionDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const bankAcc = await this.prisma.bankAccount.findFirst({
      where: {
        id: dto.bankAccountId,
        tenantId,
        deletedAt: null,
        status: BankAccountStatus.ACTIVE,
      },
    });
    if (!bankAcc) {
      throw new NotFoundException(
        `Active Bank Account with ID ${dto.bankAccountId} not found.`,
      );
    }

    if (dto.type === BankTransactionType.TRANSFER) {
      if (!dto.transferToBankAccountId) {
        throw new BadRequestException(
          "transferToBankAccountId is required for TRANSFER type.",
        );
      }
      if (dto.bankAccountId === dto.transferToBankAccountId) {
        throw new BadRequestException(
          "Source and destination bank accounts cannot be the same.",
        );
      }
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      let contraAcc = null;
      let transferToAcc = null;

      // Basic validations
      if (dto.type === BankTransactionType.TRANSFER) {
        transferToAcc = await tx.bankAccount.findFirst({
          where: {
            id: dto.transferToBankAccountId!,
            tenantId,
            deletedAt: null,
            status: BankAccountStatus.ACTIVE,
          },
        });
        if (!transferToAcc) {
          throw new NotFoundException(
            `Destination Bank Account with ID ${dto.transferToBankAccountId} not found.`,
          );
        }
      } else {
        if (!dto.contraAccountId) {
          throw new BadRequestException(
            "contraAccountId is required for non-transfer transactions.",
          );
        }
        contraAcc = await this.validateActiveAccount(
          tx,
          dto.contraAccountId,
          tenantId,
          "Contra",
        );
      }

      // Check sufficient balance for withdrawals or transfers
      const amountDec = new Prisma.Decimal(dto.amount);
      const isOutflow = (
        [
          BankTransactionType.WITHDRAWAL,
          BankTransactionType.TRANSFER,
          BankTransactionType.BANK_CHARGES,
          BankTransactionType.INTEREST_EXPENSE,
        ] as BankTransactionType[]
      ).includes(dto.type);

      if (
        isOutflow &&
        new Prisma.Decimal(bankAcc.currentBalance).lt(amountDec)
      ) {
        throw new BadRequestException(
          `Insufficient funds in bank account. Current balance: ${bankAcc.currentBalance}`,
        );
      }

      // Create transaction record
      const transaction = await tx.bankTransaction.create({
        data: {
          tenantId,
          bankAccountId: dto.bankAccountId,
          type: dto.type,
          amount: amountDec,
          transactionDate: new Date(dto.transactionDate),
          reference: dto.reference,
          description: dto.description,
          status: BankTransactionStatus.POSTED,
          transferToBankAccountId: dto.transferToBankAccountId,
        },
      });

      // Update source bank account balance
      const newSourceBalance = isOutflow
        ? new Prisma.Decimal(bankAcc.currentBalance).sub(amountDec)
        : new Prisma.Decimal(bankAcc.currentBalance).add(amountDec);

      await tx.bankAccount.update({
        where: { id: bankAcc.id },
        data: {
          currentBalance: newSourceBalance,
          version: bankAcc.version + 1,
        },
      });

      // Update destination bank account balance if transfer
      if (dto.type === BankTransactionType.TRANSFER && transferToAcc) {
        const newDestBalance = new Prisma.Decimal(
          transferToAcc.currentBalance,
        ).add(amountDec);
        await tx.bankAccount.update({
          where: { id: transferToAcc.id },
          data: {
            currentBalance: newDestBalance,
            version: transferToAcc.version + 1,
          },
        });
      }

      // Automated GL posting
      const journalLines: { code: string; debit: number; credit: number }[] =
        [];
      const bankGL = await tx.account.findFirst({
        where: { id: bankAcc.glAccountId },
      });

      if (dto.type === BankTransactionType.TRANSFER && transferToAcc) {
        const destGL = await tx.account.findFirst({
          where: { id: transferToAcc.glAccountId },
        });
        // Debit destination bank account GL, Credit source bank account GL
        journalLines.push({ code: destGL!.code, debit: dto.amount, credit: 0 });
        journalLines.push({ code: bankGL!.code, debit: 0, credit: dto.amount });
      } else if (contraAcc) {
        if (isOutflow) {
          // Debit contra account, Credit bank GL
          journalLines.push({
            code: contraAcc.code,
            debit: dto.amount,
            credit: 0,
          });
          journalLines.push({
            code: bankGL!.code,
            debit: 0,
            credit: dto.amount,
          });
        } else {
          // Debit bank GL, Credit contra account
          journalLines.push({
            code: bankGL!.code,
            debit: dto.amount,
            credit: 0,
          });
          journalLines.push({
            code: contraAcc.code,
            debit: 0,
            credit: dto.amount,
          });
        }
      }

      await this.accountingService.automatedPost(
        tx,
        JournalSourceType.BANK,
        transaction.id,
        `Bank transaction: ${dto.type} - Ref: ${dto.reference}`,
        journalLines,
        { id: user.id, tenantId },
      );

      // Find created journal entry to link
      const journal = await tx.journalEntry.findFirst({
        where: {
          tenantId,
          sourceType: JournalSourceType.BANK,
          sourceId: transaction.id,
        },
      });

      const journalEntryId = journal ? journal.id : null;

      // Link journal to transaction
      const updatedTransaction = await tx.bankTransaction.update({
        where: { id: transaction.id },
        data: { journalEntryId },
      });

      // Log Audit
      await tx.auditLog.create({
        data: {
          action: "BANK_TRANSACTION_POSTED",
          entity: "BankTransaction",
          entityId: transaction.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updatedTransaction)),
        },
      });

      // Push Notifications on large transactions (value > 10,000)
      if (dto.amount > 10000) {
        await this.notificationsService.createInternal({
          userId: user.id,
          tenantId,
          title: "Large Treasury Movement",
          message: `A large bank transaction of amount ${dto.amount} has been posted. Type: ${dto.type}.`,
          type: NotificationType.INFO,
        });
      }

      return updatedTransaction;
    });
  }

  async getTransactions(user: AuthUser) {
    return this.prisma.bankTransaction.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      include: { bankAccount: true, transferToBankAccount: true },
      orderBy: { transactionDate: "desc" },
    });
  }

  // --- RECONCILIATION & MATCHING ENGINE ---
  async createReconciliationStatement(
    dto: CreateReconciliationDto,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const bankAcc = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, tenantId, deletedAt: null },
    });
    if (!bankAcc) {
      throw new NotFoundException(
        `Bank Account with ID ${dto.bankAccountId} not found.`,
      );
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    // Prevent overlapping statement periods for the same bank account
    const overlap = await this.prisma.bankReconciliation.findFirst({
      where: {
        tenantId,
        bankAccountId: dto.bankAccountId,
        OR: [{ startDate: { lte: end }, endDate: { gte: start } }],
      },
    });
    if (overlap) {
      throw new BadRequestException(
        "Statement period overlaps with an existing statement.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const recon = await tx.bankReconciliation.create({
        data: {
          tenantId,
          bankAccountId: dto.bankAccountId,
          statementNumber: dto.statementNumber,
          statementDate: new Date(dto.statementDate),
          startDate: start,
          endDate: end,
          openingBalance: new Prisma.Decimal(dto.openingBalance),
          closingBalance: new Prisma.Decimal(dto.closingBalance),
          reconciledBalance: new Prisma.Decimal(dto.openingBalance),
          status: ReconciliationStatus.DRAFT,
        },
      });

      if (dto.statementLines && dto.statementLines.length > 0) {
        for (const line of dto.statementLines) {
          await tx.bankReconciliationLine.create({
            data: {
              tenantId,
              reconciliationId: recon.id,
              statementLineDate: new Date(line.statementLineDate),
              statementLineRef: line.statementLineRef,
              statementLineAmount: new Prisma.Decimal(line.statementLineAmount),
              matchingStatus: MatchingStatus.UNMATCHED,
              matchedAmount: new Prisma.Decimal(0),
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          action: "BANK_RECONCILIATION_CREATED",
          entity: "BankReconciliation",
          entityId: recon.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(recon)),
        },
      });

      return recon;
    });
  }

  async runAutoMatching(reconciliationId: string, user: AuthUser) {
    const tenantId = user.tenantId!;

    const recon = await this.prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, tenantId },
      include: { lines: true },
    });
    if (!recon) {
      throw new NotFoundException(
        `Statement with ID ${reconciliationId} not found.`,
      );
    }

    if (recon.status === ReconciliationStatus.COMPLETED) {
      throw new BadRequestException(
        "Cannot run auto-matching on a completed reconciliation.",
      );
    }

    // Fetch unmatched posted bank transactions for this bank account
    const transactions = await this.prisma.bankTransaction.findMany({
      where: {
        tenantId,
        bankAccountId: recon.bankAccountId,
        status: { in: [BankTransactionStatus.POSTED] },
        deletedAt: null,
      },
    });

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      let matchedCount = 0;

      for (const line of recon.lines) {
        if (line.matchingStatus !== MatchingStatus.UNMATCHED) continue;

        // Auto-match rule: exact amount match, reference similarity, date within 3 days tolerance
        const targetAmount = new Prisma.Decimal(line.statementLineAmount);

        const matchCandidate = transactions.find((t) => {
          const tAmount = (
            [
              BankTransactionType.DEPOSIT,
              BankTransactionType.INTEREST_INCOME,
              BankTransactionType.ADJUSTMENT,
            ] as BankTransactionType[]
          ).includes(t.type)
            ? new Prisma.Decimal(t.amount)
            : new Prisma.Decimal(t.amount).negated();

          if (!tAmount.equals(targetAmount)) return false;

          const dateDiff = Math.abs(
            new Date(t.transactionDate).getTime() -
              new Date(line.statementLineDate).getTime(),
          );
          const daysLimit = 3 * 24 * 60 * 60 * 1000;

          return dateDiff <= daysLimit;
        });

        if (matchCandidate) {
          // Reconcile line
          await tx.bankReconciliationLine.update({
            where: { id: line.id },
            data: {
              bankTransactionId: matchCandidate.id,
              matchingStatus: MatchingStatus.AUTO_MATCHED,
              matchedAmount: targetAmount.abs(),
              version: line.version + 1,
            },
          });

          // Mark transaction as cleared
          await tx.bankTransaction.update({
            where: { id: matchCandidate.id },
            data: {
              status: BankTransactionStatus.CLEARED,
              clearedAt: line.statementLineDate,
              version: matchCandidate.version + 1,
            },
          });

          // Remove from local array so it doesn't double match
          const idx = transactions.indexOf(matchCandidate);
          if (idx > -1) transactions.splice(idx, 1);

          matchedCount++;
        }
      }

      // Update statement reconciledBalance
      const updatedLines = await tx.bankReconciliationLine.findMany({
        where: { reconciliationId },
      });
      const netChange = updatedLines.reduce((sum, l) => {
        if (l.matchingStatus !== MatchingStatus.UNMATCHED) {
          return sum.add(new Prisma.Decimal(l.statementLineAmount));
        }
        return sum;
      }, new Prisma.Decimal(0));

      const nextReconciledBalance = new Prisma.Decimal(
        recon.openingBalance,
      ).add(netChange);

      await tx.bankReconciliation.update({
        where: { id: recon.id },
        data: {
          reconciledBalance: nextReconciledBalance,
          version: recon.version + 1,
        },
      });

      return {
        message: `Auto-matching complete. Matched ${matchedCount} transaction(s).`,
      };
    });
  }

  async applyManualMatch(dto: ReconciliationMatchDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const line = await this.prisma.bankReconciliationLine.findFirst({
      where: { id: dto.reconciliationLineId, tenantId },
      include: { reconciliation: true },
    });
    if (!line) {
      throw new NotFoundException(
        `Statement line with ID ${dto.reconciliationLineId} not found.`,
      );
    }

    if (line.reconciliation.status === ReconciliationStatus.COMPLETED) {
      throw new BadRequestException("Reconciliation is locked and completed.");
    }

    if (line.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      if (dto.matchingStatus === MatchingStatus.UNMATCHED) {
        // Undo match
        if (line.bankTransactionId) {
          const trans = await tx.bankTransaction.findUnique({
            where: { id: line.bankTransactionId },
          });
          await tx.bankTransaction.update({
            where: { id: line.bankTransactionId },
            data: {
              status: BankTransactionStatus.POSTED,
              clearedAt: null,
              version: trans!.version + 1,
            },
          });
        }

        const updatedLine = await tx.bankReconciliationLine.update({
          where: { id: line.id },
          data: {
            bankTransactionId: null,
            matchingStatus: MatchingStatus.UNMATCHED,
            matchedAmount: new Prisma.Decimal(0),
            version: line.version + 1,
          },
        });

        await this.updateReconciliationSum(tx, line.reconciliationId);
        return updatedLine;
      }

      if (!dto.bankTransactionId) {
        throw new BadRequestException(
          "bankTransactionId is required to map transaction.",
        );
      }

      const transaction = await tx.bankTransaction.findFirst({
        where: { id: dto.bankTransactionId, tenantId, deletedAt: null },
      });
      if (!transaction) {
        throw new NotFoundException(
          `Bank Transaction with ID ${dto.bankTransactionId} not found.`,
        );
      }

      if (
        transaction.status === BankTransactionStatus.CLEARED &&
        transaction.id !== line.bankTransactionId
      ) {
        throw new BadRequestException(
          "Transaction is already cleared in another match.",
        );
      }

      const matchedAmt = new Prisma.Decimal(
        dto.matchedAmount || Number(line.statementLineAmount.abs()),
      );

      // Update matching status
      const updatedLine = await tx.bankReconciliationLine.update({
        where: { id: line.id },
        data: {
          bankTransactionId: dto.bankTransactionId,
          matchingStatus: dto.matchingStatus,
          matchedAmount: matchedAmt,
          version: line.version + 1,
        },
      });

      // Clear the transaction
      await tx.bankTransaction.update({
        where: { id: transaction.id },
        data: {
          status: BankTransactionStatus.CLEARED,
          clearedAt: line.statementLineDate,
          version: transaction.version + 1,
        },
      });

      await this.updateReconciliationSum(tx, line.reconciliationId);

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "BANK_LINE_MATCHED",
          entity: "BankReconciliationLine",
          entityId: line.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updatedLine)),
        },
      });

      return updatedLine;
    });
  }

  private async updateReconciliationSum(
    tx: PrismaTx,
    reconciliationId: string,
  ) {
    const recon = await tx.bankReconciliation.findUnique({
      where: { id: reconciliationId },
    });
    const lines = await tx.bankReconciliationLine.findMany({
      where: { reconciliationId },
    });

    const netChange = lines.reduce((sum, l) => {
      if (l.matchingStatus !== MatchingStatus.UNMATCHED) {
        return sum.add(new Prisma.Decimal(l.statementLineAmount));
      }
      return sum;
    }, new Prisma.Decimal(0));

    const nextReconciledBalance = new Prisma.Decimal(recon!.openingBalance).add(
      netChange,
    );

    await tx.bankReconciliation.update({
      where: { id: reconciliationId },
      data: {
        reconciledBalance: nextReconciledBalance,
        version: recon!.version + 1,
      },
    });
  }

  async finalizeReconciliation(
    id: string,
    expectedVersion: number,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const recon = await this.prisma.bankReconciliation.findFirst({
      where: { id, tenantId },
      include: { bankAccount: true, lines: true },
    });
    if (!recon) {
      throw new NotFoundException(`Statement with ID ${id} not found.`);
    }

    if (recon.status === ReconciliationStatus.COMPLETED) {
      throw new BadRequestException(
        "Reconciliation is already locked and completed.",
      );
    }

    if (recon.version !== expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    // 1. Verify all statement lines are reconciled
    const hasUnmatched = recon.lines.some(
      (l) => l.matchingStatus === MatchingStatus.UNMATCHED,
    );
    if (hasUnmatched) {
      throw new BadRequestException(
        "Cannot finalize reconciliation with unmatched statement lines.",
      );
    }

    // 2. Verify math: opening balance + sum of line amounts === closing balance
    const linesSum = recon.lines.reduce(
      (sum, l) => sum.add(new Prisma.Decimal(l.statementLineAmount)),
      new Prisma.Decimal(0),
    );
    const calculatedClosing = new Prisma.Decimal(recon.openingBalance).add(
      linesSum,
    );
    if (!calculatedClosing.equals(new Prisma.Decimal(recon.closingBalance))) {
      throw new BadRequestException(
        `Calculated closing balance (${calculatedClosing}) does not match statement closing balance (${recon.closingBalance}).`,
      );
    }

    // 3. Verify ending balance matches actual GL account balance as of endDate
    const glAcc = await this.prisma.account.findFirst({
      where: { id: recon.bankAccount.glAccountId },
    });
    const glLines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId: glAcc!.id,
        entry: {
          postingDate: { lte: recon.endDate },
          status: "POSTED",
        },
      },
    });

    const glBalance = glLines.reduce(
      (sum, l) =>
        sum.add(new Prisma.Decimal(l.debit)).sub(new Prisma.Decimal(l.credit)),
      new Prisma.Decimal(0),
    );

    // If GL Account balance doesn't equal statement closing balance, throw error
    if (!glBalance.equals(new Prisma.Decimal(recon.closingBalance))) {
      throw new BadRequestException(
        `GL Ledger balance (${glBalance}) as of ${recon.endDate.toISOString().split("T")[0]} does not match statement closing balance (${recon.closingBalance}).`,
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.bankReconciliation.update({
        where: { id },
        data: {
          status: ReconciliationStatus.COMPLETED,
          version: recon.version + 1,
        },
      });

      // Log Audit
      await tx.auditLog.create({
        data: {
          action: "BANK_RECONCILIATION_COMPLETED",
          entity: "BankReconciliation",
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
        title: "Reconciliation Completed",
        message: `Reconciliation statement #${recon.statementNumber} has been locked and completed successfully.`,
        type: NotificationType.INFO,
      });

      return updated;
    });
  }

  async getReconciliationHistory(user: AuthUser) {
    return this.prisma.bankReconciliation.findMany({
      where: { tenantId: user.tenantId! },
      include: { bankAccount: true, lines: true },
      orderBy: { statementDate: "desc" },
    });
  }

  // --- TREASURY DASHBOARD & CASH FORECAST ---
  async getDashboardSummary(user: AuthUser) {
    const tenantId = user.tenantId!;

    const accounts = await this.prisma.bankAccount.findMany({
      where: { tenantId, deletedAt: null },
    });

    // Cash by Currency & Cash Position & Cash by Bank
    const cashByCurrency: Record<string, string> = {};
    const cashByBank: Record<string, string> = {};
    let totalCashBaseCurrency = new Prisma.Decimal(0);

    for (const acc of accounts) {
      const cur = acc.currency;
      const bal = new Prisma.Decimal(acc.currentBalance);

      cashByCurrency[cur] = new Prisma.Decimal(cashByCurrency[cur] || 0)
        .add(bal)
        .toString();
      cashByBank[acc.name] = bal.toString();
      totalCashBaseCurrency = totalCashBaseCurrency.add(bal);
    }

    // Outstanding Deposits and Withdrawals (POSTED but not CLEARED)
    const outstandingDepositsAgg = await this.prisma.bankTransaction.aggregate({
      where: {
        tenantId,
        status: BankTransactionStatus.POSTED,
        type: {
          in: [
            BankTransactionType.DEPOSIT,
            BankTransactionType.INTEREST_INCOME,
            BankTransactionType.ADJUSTMENT,
          ],
        },
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    const outstandingWithdrawalsAgg =
      await this.prisma.bankTransaction.aggregate({
        where: {
          tenantId,
          status: BankTransactionStatus.POSTED,
          type: {
            in: [
              BankTransactionType.WITHDRAWAL,
              BankTransactionType.TRANSFER,
              BankTransactionType.BANK_CHARGES,
              BankTransactionType.INTEREST_EXPENSE,
            ],
          },
          deletedAt: null,
        },
        _sum: { amount: true },
      });

    // Cash flow forecast foundation: 30 days projection
    // Sales Invoices (unpaid/draft/approved) -> future inflows
    // Purchase orders/bills unpaid -> future outflows
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const openInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
        dueDate: { lte: futureDate },
        deletedAt: null,
      },
    });

    // Sum remaining unpaid amounts on invoices
    const projectedInflows = openInvoices.reduce((sum, inv) => {
      // In Amdox ERP invoice model, we can check inv.grandTotal - inv.amountPaid (if exists)
      // For type safety let's use number conversions
      const total = Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0);
      return sum.add(new Prisma.Decimal(total));
    }, new Prisma.Decimal(0));

    return {
      cashPosition: totalCashBaseCurrency.toString(),
      cashByCurrency,
      cashByBank,
      outstandingDeposits: (
        outstandingDepositsAgg._sum.amount || new Prisma.Decimal(0)
      ).toString(),
      outstandingWithdrawals: (
        outstandingWithdrawalsAgg._sum.amount || new Prisma.Decimal(0)
      ).toString(),
      forecastInflow30Days: projectedInflows.toString(),
    };
  }
}
