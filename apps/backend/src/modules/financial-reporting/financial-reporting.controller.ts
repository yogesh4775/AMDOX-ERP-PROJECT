import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { FinancialReportingService } from "./financial-reporting.service";
import { CreatePeriodDto } from "./dto/create-period.dto";
import { UpdatePeriodDto } from "./dto/update-period.dto";
import { QueryFinancialReportDto } from "./dto/query-financial-report.dto";
import { AuditService } from "../../common/audit/audit.service";

@Controller("financial")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinancialReportingController {
  constructor(
    private readonly financialReportingService: FinancialReportingService,
    private readonly auditService: AuditService,
  ) {}

  // --- PERIODS ---
  @Post("periods")
  @Permissions(PermissionsList.ACCOUNTING_WRITE)
  async createPeriod(
    @Body() dto: CreatePeriodDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.financialReportingService.createPeriod(dto, req.user);
  }

  @Get("periods")
  @Permissions(PermissionsList.ACCOUNTING_READ)
  async findAllPeriods(@Req() req: { user: AuthUser }) {
    return this.financialReportingService.findAllPeriods(req.user);
  }

  @Patch("periods/:id/close")
  @Permissions(PermissionsList.ACCOUNTING_WRITE)
  async closePeriod(
    @Param("id") id: string,
    @Body() dto: UpdatePeriodDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.financialReportingService.closePeriod(id, dto, req.user);
  }

  // --- REPORTS ---
  @Get("trial-balance")
  @Permissions(PermissionsList.FINANCIAL_REPORT_READ)
  async getTrialBalance(
    @Query() query: QueryFinancialReportDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const data = await this.financialReportingService.getTrialBalance(
      query,
      req.user,
    );

    if (query.export === "csv") {
      let csv = "Code,Name,Type,Debit,Credit,Balance\n";
      for (const row of data.rows) {
        csv += `"${row.code}","${row.name}","${row.type}",${row.debit},${row.credit},${row.balance}\n`;
      }
      csv += `,,,Total Debit:,${data.totalDebits},\n`;
      csv += `,,,Total Credit:,,${data.totalCredits}\n`;

      await this.logExportAudit(
        req.user.tenantId!,
        req.user.id,
        "TRIAL_BALANCE",
      );

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="trial_balance.csv"',
      );
      return res.send(csv);
    }

    if (query.export === "pdf") {
      // Return a layout representation of the PDF for verification
      const pdfLayout = {
        title: "TRIAL BALANCE REPORT",
        tenantId: req.user.tenantId,
        date: new Date().toISOString(),
        data,
      };

      await this.logExportAudit(
        req.user.tenantId!,
        req.user.id,
        "TRIAL_BALANCE",
      );

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="trial_balance_pdf_layout.json"',
      );
      return res.json(pdfLayout);
    }

    return res.json(data);
  }

  @Get("profit-loss")
  @Permissions(PermissionsList.FINANCIAL_REPORT_READ)
  async getProfitLoss(
    @Query() query: QueryFinancialReportDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const data = await this.financialReportingService.getProfitLoss(
      query,
      req.user,
    );

    if (query.export === "csv") {
      let csv = "Category,Account Code,Account Name,Balance\n";
      csv += `REVENUE,,,\n`;
      for (const row of data.statement.revenueDetails) {
        csv += `,"${row.code}","${row.name}",${row.balance}\n`;
      }
      csv += `,Total Revenue,,${data.statement.revenue}\n`;
      csv += `COST OF GOODS SOLD,,,\n`;
      csv += `,Cost of Goods Sold,,${data.statement.cogs}\n`;
      csv += `Gross Profit,,${data.statement.grossProfit}\n`;
      csv += `OPERATING EXPENSES,,,\n`;
      for (const row of data.statement.expenseDetails) {
        if (row.code !== "5000") {
          csv += `,"${row.code}","${row.name}",${row.balance}\n`;
        }
      }
      csv += `,Total Operating Expenses,,${data.statement.operatingExpenses}\n`;
      csv += `Net Profit,,${data.statement.netProfit}\n`;

      await this.logExportAudit(req.user.tenantId!, req.user.id, "PROFIT_LOSS");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="profit_loss.csv"',
      );
      return res.send(csv);
    }

    if (query.export === "pdf") {
      const pdfLayout = {
        title: "PROFIT & LOSS STATEMENT",
        tenantId: req.user.tenantId,
        date: new Date().toISOString(),
        data,
      };

      await this.logExportAudit(req.user.tenantId!, req.user.id, "PROFIT_LOSS");

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="profit_loss_pdf_layout.json"',
      );
      return res.json(pdfLayout);
    }

    return res.json(data);
  }

  @Get("balance-sheet")
  @Permissions(PermissionsList.FINANCIAL_REPORT_READ)
  async getBalanceSheet(
    @Query() query: QueryFinancialReportDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const data = await this.financialReportingService.getBalanceSheet(
      query,
      req.user,
    );

    if (query.export === "csv") {
      let csv = "Section,Account Code,Account Name,Balance\n";
      csv += `ASSETS,,,\n`;
      for (const row of data.assets.rows) {
        csv += `,"${row.code}","${row.name}",${row.balance}\n`;
      }
      csv += `,Total Assets,,${data.assets.total}\n`;
      csv += `LIABILITIES,,,\n`;
      for (const row of data.liabilities.rows) {
        csv += `,"${row.code}","${row.name}",${row.balance}\n`;
      }
      csv += `,Total Liabilities,,${data.liabilities.total}\n`;
      csv += `EQUITY,,,\n`;
      for (const row of data.equity.rows) {
        csv += `,"${row.code}","${row.name}",${row.balance}\n`;
      }
      csv += `,Total Equity,,${data.equity.total}\n`;
      csv += `Total Liabilities & Equity,,${data.totalLiabilitiesAndEquity}\n`;

      await this.logExportAudit(
        req.user.tenantId!,
        req.user.id,
        "BALANCE_SHEET",
      );

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="balance_sheet.csv"',
      );
      return res.send(csv);
    }

    if (query.export === "pdf") {
      const pdfLayout = {
        title: "BALANCE SHEET STATEMENT",
        tenantId: req.user.tenantId,
        date: new Date().toISOString(),
        data,
      };

      await this.logExportAudit(
        req.user.tenantId!,
        req.user.id,
        "BALANCE_SHEET",
      );

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="balance_sheet_pdf_layout.json"',
      );
      return res.json(pdfLayout);
    }

    return res.json(data);
  }

  @Get("summary")
  @Permissions(PermissionsList.FINANCIAL_REPORT_READ)
  async getFinancialSummary(
    @Query() query: QueryFinancialReportDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.financialReportingService.getFinancialSummary(query, req.user);
  }

  private async logExportAudit(
    tenantId: string,
    userId: string,
    reportType: string,
  ) {
    await this.auditService.log({
      action: "FINANCIAL_REPORT_EXPORTED",
      entity: "FinancialReport",
      entityId: tenantId,
      tenantId,
      userId,
      newValues: { reportType },
    });
  }
}
