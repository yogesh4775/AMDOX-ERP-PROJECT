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
import { TaxService } from "./tax.service";
import { CreateTaxRuleDto } from "./dto/create-tax-rule.dto";
import { UpdateTaxRuleDto } from "./dto/update-tax-rule.dto";
import { CreateTaxExemptionDto } from "./dto/create-tax-exemption.dto";
import { UpdateTaxExemptionDto } from "./dto/update-tax-exemption.dto";
import { CalculateTaxDto } from "./dto/calculate-tax.dto";
import { QueryTaxTransactionDto } from "./dto/query-tax-transaction.dto";
import { AuditService } from "../../common/audit/audit.service";

@Controller("tax")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TaxController {
  constructor(
    private readonly taxService: TaxService,
    private readonly auditService: AuditService,
  ) {}

  // --- TAX RULES ---
  @Post("rules")
  @Permissions(PermissionsList.TAX_RULE_WRITE)
  async createRule(
    @Body() dto: CreateTaxRuleDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.taxService.createRule(dto, req.user);
  }

  @Get("rules")
  @Permissions(PermissionsList.TAX_RULE_READ)
  async findAllRules(@Req() req: { user: AuthUser }) {
    return this.taxService.findAllRules(req.user);
  }

  @Patch("rules/:id")
  @Permissions(PermissionsList.TAX_RULE_WRITE)
  async updateRule(
    @Param("id") id: string,
    @Body() dto: UpdateTaxRuleDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.taxService.updateRule(id, dto, req.user);
  }

  // --- TAX EXEMPTIONS ---
  @Post("exemptions")
  @Permissions(PermissionsList.TAX_EXEMPTION_WRITE)
  async createExemption(
    @Body() dto: CreateTaxExemptionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.taxService.createExemption(dto, req.user);
  }

  @Get("exemptions")
  @Permissions(PermissionsList.TAX_EXEMPTION_READ)
  async findAllExemptions(@Req() req: { user: AuthUser }) {
    return this.taxService.findAllExemptions(req.user);
  }

  @Patch("exemptions/:id")
  @Permissions(PermissionsList.TAX_EXEMPTION_WRITE)
  async updateExemption(
    @Param("id") id: string,
    @Body() dto: UpdateTaxExemptionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.taxService.updateExemption(id, dto, req.user);
  }

  // --- TAX CALCULATOR ---
  @Post("calculate")
  @Permissions(PermissionsList.TAX_RULE_READ)
  async calculateTax(
    @Body() dto: CalculateTaxDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.taxService.calculateTax(dto, req.user.tenantId!);
  }

  // --- REPORTS ---
  @Get("reports")
  @Permissions(PermissionsList.TAX_REPORT_READ)
  async getTaxReport(
    @Query() query: QueryTaxTransactionDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const data = await this.taxService.getTaxReport(query, req.user);

    // Support CSV Export
    if (query.export === "csv") {
      let csv =
        "ID,Source Type,Source ID,Base Amount,Tax Amount,Rate,Jurisdiction,Category,Created At\n";
      for (const row of data.transactions) {
        csv += `"${row.id}","${row.sourceType}","${row.sourceId}",${row.baseAmount},${row.taxAmount},${row.rate},"${row.jurisdiction}","${row.category}","${row.createdAt}"\n`;
      }
      csv += `,,,Total Collected:,${data.collectedTax},,Total Paid:,${data.paidTax}\n`;

      await this.auditService.log({
        action: "TAX_REPORT_EXPORTED",
        entity: "TaxReport",
        entityId: req.user.tenantId!,
        tenantId: req.user.tenantId!,
        userId: req.user.id,
        newValues: { format: "csv" },
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="tax_report.csv"',
      );
      return res.send(csv);
    }

    // Support PDF Export foundation
    if (query.export === "pdf") {
      const pdfLayout = {
        title: "ENTERPRISE TAX REPORT",
        tenantId: req.user.tenantId,
        date: new Date().toISOString(),
        data,
      };

      await this.auditService.log({
        action: "TAX_REPORT_EXPORTED",
        entity: "TaxReport",
        entityId: req.user.tenantId!,
        tenantId: req.user.tenantId!,
        userId: req.user.id,
        newValues: { format: "pdf" },
      });

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="tax_report_pdf_layout.json"',
      );
      return res.json(pdfLayout);
    }

    return res.json(data);
  }
}
