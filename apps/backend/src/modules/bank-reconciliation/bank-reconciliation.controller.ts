import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { BankReconciliationService } from "./bank-reconciliation.service";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto";
import { CreateBankTransactionDto } from "./dto/create-bank-transaction.dto";
import { CreateReconciliationDto } from "./dto/create-reconciliation.dto";
import { ReconciliationMatchDto } from "./dto/reconciliation-match.dto";
import { QueryParamsDto } from "./dto/query-params.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { AuditService } from "../../common/audit/audit.service";

@Controller("bank")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BankReconciliationController {
  constructor(
    private readonly bankReconciliationService: BankReconciliationService,
    private readonly auditService: AuditService,
  ) {}

  // --- BANK ACCOUNTS ---
  @Get("accounts")
  @Permissions(PermissionsList.BANK_ACCOUNT_READ)
  async getBankAccounts(@Req() req: { user: AuthUser }) {
    return this.bankReconciliationService.getBankAccounts(req.user);
  }

  @Post("accounts")
  @Permissions(PermissionsList.BANK_ACCOUNT_WRITE)
  async createBankAccount(
    @Body() dto: CreateBankAccountDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.bankReconciliationService.createBankAccount(dto, req.user);
  }

  @Patch("accounts/:id")
  @Permissions(PermissionsList.BANK_ACCOUNT_WRITE)
  async updateBankAccount(
    @Param("id") id: string,
    @Body() dto: UpdateBankAccountDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.bankReconciliationService.updateBankAccount(id, dto, req.user);
  }

  // --- BANK TRANSACTIONS ---
  @Get("transactions")
  @Permissions(PermissionsList.BANK_TRANSACTION_READ)
  async getTransactions(
    @Query() query: QueryParamsDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const transactions = await this.bankReconciliationService.getTransactions(
      req.user,
    );

    if (query.export === "csv") {
      let csv =
        "ID,Bank Account,Type,Amount,Date,Reference,Status,Journal ID\n";
      for (const t of transactions) {
        csv += `"${t.id}","${t.bankAccount.name}","${t.type}",${t.amount},"${t.transactionDate.toISOString()}","${t.reference}","${t.status}","${t.journalEntryId || ""}"\n`;
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="bank_transactions.csv"',
      );
      return res.send(csv);
    }

    return res.json(transactions);
  }

  @Post("transactions")
  @Permissions(PermissionsList.BANK_TRANSACTION_WRITE)
  async createTransaction(
    @Body() dto: CreateBankTransactionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.bankReconciliationService.createTransaction(dto, req.user);
  }

  // --- BANK RECONCILIATION ---
  @Post("reconciliation")
  @Permissions(PermissionsList.BANK_RECONCILE_WRITE)
  async createReconciliationStatement(
    @Body() dto: CreateReconciliationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.bankReconciliationService.createReconciliationStatement(
      dto,
      req.user,
    );
  }

  @Post("reconciliation/:id/auto-match")
  @Permissions(PermissionsList.BANK_RECONCILE_WRITE)
  async runAutoMatching(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.bankReconciliationService.runAutoMatching(id, req.user);
  }

  @Post("reconciliation/match")
  @Permissions(PermissionsList.BANK_RECONCILE_WRITE)
  async applyManualMatch(
    @Body() dto: ReconciliationMatchDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.bankReconciliationService.applyManualMatch(dto, req.user);
  }

  @Post("reconciliation/:id/finalize")
  @Permissions(PermissionsList.BANK_RECONCILE_WRITE)
  async finalizeReconciliation(
    @Param("id") id: string,
    @Body("expectedVersion") expectedVersion: number,
    @Req() req: { user: AuthUser },
  ) {
    return this.bankReconciliationService.finalizeReconciliation(
      id,
      expectedVersion,
      req.user,
    );
  }

  @Get("reconciliation")
  @Permissions(PermissionsList.BANK_RECONCILE_READ)
  async getReconciliationHistory(
    @Query() query: QueryParamsDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const history =
      await this.bankReconciliationService.getReconciliationHistory(req.user);

    if (query.export === "csv") {
      let csv =
        "ID,Bank Account,Statement Number,Statement Date,Start Date,End Date,Opening Balance,Closing Balance,Reconciled Balance,Status\n";
      for (const h of history) {
        csv += `"${h.id}","${h.bankAccount.name}","${h.statementNumber}","${h.statementDate.toISOString()}","${h.startDate.toISOString()}","${h.endDate.toISOString()}",${h.openingBalance},${h.closingBalance},${h.reconciledBalance},"${h.status}"\n`;
      }

      await this.auditService.log({
        action: "BANK_RECONCILIATION_EXPORTED",
        entity: "BankReconciliation",
        entityId: req.user.tenantId!,
        tenantId: req.user.tenantId!,
        userId: req.user.id,
        newValues: { format: "csv" },
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="reconciliation_history.csv"',
      );
      return res.send(csv);
    }

    return res.json(history);
  }

  // --- TREASURY DASHBOARD ---
  @Get("dashboard")
  @Permissions(PermissionsList.BANK_DASHBOARD_READ)
  async getDashboardSummary(@Req() req: { user: AuthUser }) {
    return this.bankReconciliationService.getDashboardSummary(req.user);
  }
}
