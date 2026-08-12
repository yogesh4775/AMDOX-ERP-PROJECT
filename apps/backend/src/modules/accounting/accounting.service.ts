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
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";
import { CreateJournalDto } from "./dto/create-journal.dto";
import { PostJournalDto } from "./dto/post-journal.dto";
import { QueryAccountDto, QueryJournalDto } from "./dto/query-accounting.dto";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import {
  Prisma,
  Account,
  JournalEntry,
  AccountType,
  AccountStatus,
  JournalEntryStatus,
  JournalSourceType,
} from "@amdox/database/generated";

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- CHART OF ACCOUNTS SEEDING ---
  async seedChartOfAccounts(tx: PrismaTx, tenantId: string): Promise<void> {
    const defaultAccounts = [
      // Assets
      {
        code: "1010",
        name: "Cash",
        type: AccountType.ASSET,
        description: "Physical cash in hand",
      },
      {
        code: "1020",
        name: "Bank",
        type: AccountType.ASSET,
        description: "Bank operational account",
      },
      {
        code: "1200",
        name: "Accounts Receivable",
        type: AccountType.ASSET,
        description: "Outstanding customer invoices",
      },
      {
        code: "1400",
        name: "Inventory",
        type: AccountType.ASSET,
        description: "Inventory stock asset value",
      },

      // Liabilities
      {
        code: "2000",
        name: "Accounts Payable",
        type: AccountType.LIABILITY,
        description: "Outstanding supplier invoices",
      },
      {
        code: "2100",
        name: "Accrued Liabilities",
        type: AccountType.LIABILITY,
        description: "Accrued purchase costs",
      },

      // Equity
      {
        code: "3000",
        name: "Owner Equity",
        type: AccountType.EQUITY,
        description: "Owner's capital equity",
      },

      // Revenue
      {
        code: "4000",
        name: "Sales Revenue",
        type: AccountType.REVENUE,
        description: "Revenue from product sales",
      },

      // Expenses
      {
        code: "5100",
        name: "Purchase Expense",
        type: AccountType.EXPENSE,
        description: "Direct purchase expenses",
      },
      {
        code: "5000",
        name: "Cost of Goods Sold",
        type: AccountType.EXPENSE,
        description: "Cost of products delivered to customers",
      },
      // Fixed Asset Management Accounts
      {
        code: "1500",
        name: "Fixed Assets",
        type: AccountType.ASSET,
        description: "Capital assets at acquisition cost",
      },
      {
        code: "1501",
        name: "Accumulated Depreciation",
        type: AccountType.ASSET,
        description: "Contra-asset tracking total depreciation",
      },
      {
        code: "5200",
        name: "Depreciation Expense",
        type: AccountType.EXPENSE,
        description: "Depreciation expenses on fixed assets",
      },
      {
        code: "4100",
        name: "Gain on Asset Disposal",
        type: AccountType.REVENUE,
        description: "Gains realized from asset sales",
      },
      {
        code: "5300",
        name: "Loss on Asset Disposal",
        type: AccountType.EXPENSE,
        description: "Losses realized from asset sales or write-offs",
      },
      {
        code: "5400",
        name: "Maintenance Expense",
        type: AccountType.EXPENSE,
        description: "Maintenance expenses on fixed assets",
      },
      // Bank Reconciliation & Treasury Accounts
      {
        code: "4200",
        name: "Interest Income",
        type: AccountType.REVENUE,
        description: "Interest income earned on bank accounts",
      },
      {
        code: "5500",
        name: "Interest Expense",
        type: AccountType.EXPENSE,
        description: "Interest expenses paid on bank accounts",
      },
      {
        code: "5600",
        name: "Bank Charges",
        type: AccountType.EXPENSE,
        description: "Bank fees and transaction charges",
      },
      {
        code: "3000",
        name: "Owner's Capital",
        type: AccountType.EQUITY,
        description: "Initial equity contribution",
      },
    ];

    for (const acc of defaultAccounts) {
      await tx.account.upsert({
        where: {
          tenantId_code: {
            tenantId,
            code: acc.code,
          },
        },
        update: {},
        create: {
          tenantId,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          description: acc.description,
          balance: new Prisma.Decimal(0.0),
          status: AccountStatus.ACTIVE,
        },
      });
    }
  }

  // --- ACCOUNT CRUD ---
  async createAccount(dto: CreateAccountDto, user: AuthUser): Promise<Account> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const existing = await this.prisma.account.findFirst({
      where: { tenantId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(
        `Account with code ${dto.code} already exists.`,
      );
    }

    const account = await this.prisma.account.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        description: dto.description || null,
        balance: new Prisma.Decimal(0.0),
        status: AccountStatus.ACTIVE,
      },
    });

    await this.auditService.log({
      action: "ACCOUNT_CREATED",
      entity: "Account",
      entityId: account.id,
      tenantId,
      userId: user.id,
      newValues: account,
    });

    return account;
  }

  async updateAccount(
    id: string,
    dto: UpdateAccountDto,
    user: AuthUser,
  ): Promise<Account> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const account = await tx.account.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!account) {
        throw new NotFoundException(`Account with ID ${id} not found.`);
      }

      if (account.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${account.version}`,
        );
      }

      const updated = await tx.account.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          status: dto.status,
          version: account.version + 1,
        },
      });

      await this.auditService.log({
        action: "ACCOUNT_UPDATED",
        entity: "Account",
        entityId: account.id,
        tenantId,
        userId: user.id,
        oldValues: account,
        newValues: updated,
      });

      return updated;
    });
  }

  async findAccount(id: string, user: AuthUser): Promise<Account> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const account = await this.prisma.account.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found.`);
    }
    return account;
  }

  async findAllAccounts(query: QueryAccountDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const { page = 1, limit = 10, type, status, code } = query;
    const skip = (page - 1) * limit;

    // Auto-seed if no accounts exist for tenant
    const count = await this.prisma.account.count({
      where: { tenantId: user.tenantId, deletedAt: null },
    });
    if (count === 0) {
      await this.transactionHelper.run(async (tx) => {
        await this.seedChartOfAccounts(tx, user.tenantId!);
      });
    }

    const where: Prisma.AccountWhereInput = {
      tenantId: user.tenantId,
      deletedAt: null,
      ...(type && { type }),
      ...(status && { status }),
      ...(code && { code: { contains: code, mode: "insensitive" } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: "asc" },
      }),
      this.prisma.account.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- MANUAL JOURNAL ENTRY ---
  async createJournalEntry(
    dto: CreateJournalDto,
    user: AuthUser,
  ): Promise<JournalEntry> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    // Validate debit/credit balance
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    for (const line of dto.lines) {
      totalDebit = totalDebit.add(new Prisma.Decimal(line.debit));
      totalCredit = totalCredit.add(new Prisma.Decimal(line.credit));
      if (line.debit > 0 && line.credit > 0) {
        throw new BadRequestException(
          "Line cannot have both debit and credit greater than zero.",
        );
      }
      if (line.debit === 0 && line.credit === 0) {
        throw new BadRequestException(
          "Line must have either debit or credit greater than zero.",
        );
      }
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Journal entry is out of balance. Total Debit: ${totalDebit.toString()}, Total Credit: ${totalCredit.toString()}`,
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Check closed period
      await this.checkClosedPeriod(tx, tenantId, new Date(dto.postingDate));

      // Check accounts exist
      for (const line of dto.lines) {
        const acc = await tx.account.findFirst({
          where: { id: line.accountId, tenantId, deletedAt: null },
        });
        if (!acc) {
          throw new NotFoundException(`Account ${line.accountId} not found.`);
        }
        if (acc.status !== AccountStatus.ACTIVE) {
          throw new BadRequestException(`Account ${acc.code} is inactive.`);
        }
      }

      const entryNumber = await this.generateEntryNumber(tx, tenantId);

      const entry = await tx.journalEntry.create({
        data: {
          tenantId,
          entryNumber,
          postingDate: new Date(dto.postingDate),
          status: JournalEntryStatus.DRAFT,
          description: dto.description || null,
          sourceType: JournalSourceType.MANUAL,
          lines: {
            create: dto.lines.map((line) => ({
              tenantId,
              accountId: line.accountId,
              debit: new Prisma.Decimal(line.debit),
              credit: new Prisma.Decimal(line.credit),
              description: line.description || null,
            })),
          },
        },
        include: {
          lines: true,
        },
      });

      await this.auditService.log({
        action: "JOURNAL_CREATED",
        entity: "JournalEntry",
        entityId: entry.id,
        tenantId,
        userId: user.id,
        newValues: entry,
      });

      return entry;
    });
  }

  async postJournalEntry(
    id: string,
    dto: PostJournalDto,
    user: AuthUser,
    tx?: PrismaTx,
  ): Promise<JournalEntry> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const execute = async (transaction: PrismaTx) => {
      const entry = await transaction.journalEntry.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { lines: true },
      });

      if (!entry) {
        throw new NotFoundException(`Journal Entry with ID ${id} not found.`);
      }

      // Check closed period
      await this.checkClosedPeriod(transaction, tenantId, entry.postingDate);

      if (entry.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${entry.version}`,
        );
      }

      if (entry.status !== JournalEntryStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT journal entries can be posted. Current status: ${entry.status}`,
        );
      }

      // Check balance again
      let totalDebit = new Prisma.Decimal(0);
      let totalCredit = new Prisma.Decimal(0);
      for (const line of entry.lines) {
        totalDebit = totalDebit.add(line.debit);
        totalCredit = totalCredit.add(line.credit);
      }
      if (!totalDebit.equals(totalCredit)) {
        throw new BadRequestException(
          `Journal entry is out of balance. Total Debit: ${totalDebit.toString()}, Total Credit: ${totalCredit.toString()}`,
        );
      }

      // Lock affected accounts sorted alphabetically to prevent deadlocks
      const accountIds = Array.from(
        new Set(entry.lines.map((l) => l.accountId)),
      ).sort();
      for (const accId of accountIds) {
        await transaction.$executeRaw`
          SELECT id FROM accounts WHERE id = ${accId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE
        `;
      }

      // Update account balances and verify status
      for (const line of entry.lines) {
        const acc = await transaction.account.findFirst({
          where: { id: line.accountId, tenantId, deletedAt: null },
        });
        if (!acc) {
          throw new NotFoundException(`Account ${line.accountId} not found.`);
        }
        if (acc.status !== AccountStatus.ACTIVE) {
          throw new BadRequestException(`Account ${acc.code} is inactive.`);
        }

        const debit = line.debit;
        const credit = line.credit;
        let balanceDelta = new Prisma.Decimal(0);

        if (
          acc.type === AccountType.ASSET ||
          acc.type === AccountType.EXPENSE
        ) {
          balanceDelta = debit.sub(credit);
        } else {
          balanceDelta = credit.sub(debit);
        }

        const nextBalance = acc.balance.add(balanceDelta);

        await transaction.account.update({
          where: { id: acc.id },
          data: {
            balance: nextBalance,
            version: acc.version + 1,
          },
        });
      }

      const posted = await transaction.journalEntry.update({
        where: { id },
        data: {
          status: JournalEntryStatus.POSTED,
          version: entry.version + 1,
        },
        include: { lines: true },
      });

      await this.auditService.log({
        action: "JOURNAL_POSTED",
        entity: "JournalEntry",
        entityId: entry.id,
        tenantId,
        userId: user.id,
        oldValues: entry,
        newValues: posted,
      });

      await this.notificationsService.createInternal({
        title: "Journal Entry Posted",
        message: `Journal entry ${entry.entryNumber} has been posted successfully.`,
        type: NotificationType.INFO,
        userId: user.id,
        tenantId,
      });

      return posted;
    };

    if (tx) {
      return execute(tx);
    }
    return this.transactionHelper.run(execute);
  }

  async reverseJournalEntry(
    id: string,
    dto: PostJournalDto,
    user: AuthUser,
  ): Promise<JournalEntry> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const entry = await tx.journalEntry.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { lines: true },
      });

      if (!entry) {
        throw new NotFoundException(`Journal Entry with ID ${id} not found.`);
      }

      if (entry.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${entry.version}`,
        );
      }

      if (entry.status !== JournalEntryStatus.POSTED) {
        throw new BadRequestException(
          `Only POSTED journal entries can be reversed. Current status: ${entry.status}`,
        );
      }

      // Mark original entry as REVERSED
      const reversedOriginal = await tx.journalEntry.update({
        where: { id },
        data: {
          status: JournalEntryStatus.REVERSED,
          version: entry.version + 1,
        },
        include: { lines: true },
      });

      // Create reversing entry (Invert Debits/Credits)
      const reversalNumber = await this.generateEntryNumber(tx, tenantId);
      const reversalEntry = await tx.journalEntry.create({
        data: {
          tenantId,
          entryNumber: reversalNumber,
          postingDate: new Date(),
          status: JournalEntryStatus.DRAFT,
          description: `Reversal of journal entry ${entry.entryNumber}`,
          sourceType: entry.sourceType,
          sourceId: entry.id,
          lines: {
            create: entry.lines.map((line) => ({
              tenantId,
              accountId: line.accountId,
              debit: line.credit, // inverted
              credit: line.debit, // inverted
              description: `Reversing line: ${line.description || ""}`,
            })),
          },
        },
        include: { lines: true },
      });

      // Post the reversing entry immediately inside the same transaction
      await this.postJournalEntry(
        reversalEntry.id,
        { expectedVersion: 1 },
        user,
        tx,
      );

      await this.auditService.log({
        action: "JOURNAL_REVERSED",
        entity: "JournalEntry",
        entityId: entry.id,
        tenantId,
        userId: user.id,
        oldValues: entry,
        newValues: reversedOriginal,
      });

      await this.notificationsService.createInternal({
        title: "Journal Entry Reversed",
        message: `Journal entry ${entry.entryNumber} has been reversed. Reversal entry: ${reversalNumber}`,
        type: NotificationType.INFO,
        userId: user.id,
        tenantId,
      });

      return reversedOriginal;
    });
  }

  async findJournal(id: string, user: AuthUser): Promise<JournalEntry> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      include: { lines: { include: { account: true } } },
    });
    if (!entry) {
      throw new NotFoundException(`Journal Entry with ID ${id} not found.`);
    }
    return entry;
  }

  async findAllJournals(query: QueryJournalDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const { page = 1, limit = 10, status, sourceType, entryNumber } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = {
      tenantId: user.tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(sourceType && { sourceType }),
      ...(entryNumber && {
        entryNumber: { contains: entryNumber, mode: "insensitive" },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { postingDate: "desc" },
        include: { lines: true },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- AUTOMATED POSTINGS INTEGRATION HOOK ---
  async automatedPost(
    tx: PrismaTx,
    type: JournalSourceType,
    sourceId: string,
    description: string,
    lines: { code: string; debit: number; credit: number }[],
    user: { id: string; tenantId: string },
  ): Promise<void> {
    const tenantId = user.tenantId;

    // Check closed period
    await this.checkClosedPeriod(tx, tenantId, new Date());

    // Seeding protection (ensure accounts exist before posting)
    await this.seedChartOfAccounts(tx, tenantId);

    // Fetch accounts in batch
    const codes = lines.map((l) => l.code);
    const dbAccounts = await tx.account.findMany({
      where: { tenantId, code: { in: codes }, deletedAt: null },
    });

    const accountMap = new Map<string, Account>();
    for (const acc of dbAccounts) {
      accountMap.set(acc.code, acc);
    }

    // Map lines to account IDs
    const journalLines: {
      accountId: string;
      debit: number;
      credit: number;
      description: string;
    }[] = [];
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const line of lines) {
      const acc = accountMap.get(line.code);
      if (!acc) {
        throw new NotFoundException(
          `Required GL Account with code ${line.code} is missing.`,
        );
      }
      if (acc.status !== AccountStatus.ACTIVE) {
        throw new BadRequestException(
          `GL Account with code ${line.code} is inactive.`,
        );
      }

      totalDebit = totalDebit.add(new Prisma.Decimal(line.debit));
      totalCredit = totalCredit.add(new Prisma.Decimal(line.credit));

      journalLines.push({
        accountId: acc.id,
        debit: line.debit,
        credit: line.credit,
        description,
      });
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Automated Journal entry is out of balance. Total Debit: ${totalDebit.toString()}, Total Credit: ${totalCredit.toString()}`,
      );
    }

    const entryNumber = await this.generateEntryNumber(tx, tenantId);

    // Create journal entry in POSTED status directly
    const entry = await tx.journalEntry.create({
      data: {
        tenantId,
        entryNumber,
        postingDate: new Date(),
        status: JournalEntryStatus.POSTED,
        description,
        sourceType: type,
        sourceId,
        lines: {
          create: journalLines.map((line) => ({
            tenantId,
            accountId: line.accountId,
            debit: new Prisma.Decimal(line.debit),
            credit: new Prisma.Decimal(line.credit),
            description: line.description,
          })),
        },
      },
      include: {
        lines: true,
      },
    });

    // Lock accounts
    const accountIds = Array.from(
      new Set(journalLines.map((l) => l.accountId)),
    ).sort();
    for (const accId of accountIds) {
      await tx.$executeRaw`
        SELECT id FROM accounts WHERE id = ${accId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE
      `;
    }

    // Update balances
    for (const line of entry.lines) {
      const acc = dbAccounts.find((a) => a.id === line.accountId);
      if (!acc) continue;

      const debit = line.debit;
      const credit = line.credit;
      let balanceDelta = new Prisma.Decimal(0);

      if (acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE) {
        balanceDelta = debit.sub(credit);
      } else {
        balanceDelta = credit.sub(debit);
      }

      const nextBalance = acc.balance.add(balanceDelta);

      await tx.account.update({
        where: { id: acc.id },
        data: {
          balance: nextBalance,
          version: acc.version + 1,
        },
      });
    }

    // Log GL posting audit trail
    await tx.auditLog.create({
      data: {
        action: "JOURNAL_POSTED",
        entity: "JournalEntry",
        entityId: entry.id,
        tenantId,
        userId: user.id,
        newValues: JSON.parse(JSON.stringify(entry)),
      },
    });
  }

  // --- TRIAL BALANCE ---
  async generateTrialBalance(user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    // Auto-seed if no accounts exist for tenant
    const count = await this.prisma.account.count({
      where: { tenantId, deletedAt: null },
    });
    if (count === 0) {
      await this.transactionHelper.run(async (tx) => {
        await this.seedChartOfAccounts(tx, tenantId);
      });
    }

    const accounts = await this.prisma.account.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { code: "asc" },
    });

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    const rows = accounts.map((acc) => {
      const balance = acc.balance;
      let debit = new Prisma.Decimal(0);
      let credit = new Prisma.Decimal(0);

      if (acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE) {
        if (balance.gte(0)) {
          debit = balance;
        } else {
          credit = balance.abs();
        }
      } else {
        if (balance.gte(0)) {
          credit = balance;
        } else {
          debit = balance.abs();
        }
      }

      totalDebit = totalDebit.add(debit);
      totalCredit = totalCredit.add(credit);

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit: debit.toString(),
        credit: credit.toString(),
        balance: balance.toString(),
      };
    });

    return {
      rows,
      totals: {
        debit: totalDebit.toString(),
        credit: totalCredit.toString(),
        isBalanced: totalDebit.equals(totalCredit),
      },
    };
  }

  // --- PRIVATE UTILITY METHODS ---
  private async generateEntryNumber(
    tx: PrismaTx,
    tenantId: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      const lastEntry = await tx.journalEntry.findFirst({
        where: {
          tenantId,
          entryNumber: { startsWith: prefix },
        },
        orderBy: { entryNumber: "desc" },
      });

      let nextNum = 1;
      if (lastEntry) {
        const parts = lastEntry.entryNumber.split("-");
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) {
          nextNum = lastSeq + 1;
        }
      }

      const entryNumber = `${prefix}${String(nextNum).padStart(6, "0")}`;

      // Check uniqueness
      const dup = await tx.journalEntry.findFirst({
        where: { tenantId, entryNumber },
      });

      if (!dup) {
        return entryNumber;
      }
    }

    throw new ConflictException(
      "Failed to generate unique journal entry number after maximum retries.",
    );
  }

  async checkClosedPeriod(
    tx: PrismaTx,
    tenantId: string,
    date: Date,
  ): Promise<void> {
    const closedPeriod = await tx.financialPeriod.findFirst({
      where: {
        tenantId,
        status: "CLOSED",
        startDate: { lte: date },
        endDate: { gte: date },
        deletedAt: null,
      },
    });
    if (closedPeriod) {
      throw new BadRequestException(
        `Cannot post transactions in closed financial period '${closedPeriod.name}'.`,
      );
    }
  }
}
