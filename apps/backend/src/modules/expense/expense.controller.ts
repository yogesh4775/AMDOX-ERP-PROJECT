import {
  Controller,
  UseGuards,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { ExpenseService } from "./expense.service";
import { AuditService } from "../../common/audit/audit.service";
import { CreateClaimDto } from "./dto/create-claim.dto";
import { ApproveClaimDto } from "./dto/approve-claim.dto";
import { ReimburseClaimDto } from "./dto/reimburse-claim.dto";
import { QueryClaimDto } from "./dto/query-claim.dto";

@Controller("expense")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpenseController {
  constructor(
    private readonly expenseService: ExpenseService,
    private readonly auditService: AuditService,
  ) {}

  @Post("claims")
  @Permissions(PermissionsList.EXPENSE_CLAIM_WRITE)
  async createClaim(
    @Body() dto: CreateClaimDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.expenseService.createClaim(dto, req.user);
  }

  @Post("claims/:id/submit")
  @Permissions(PermissionsList.EXPENSE_CLAIM_WRITE)
  async submitClaim(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.expenseService.submitClaim(id, req.user);
  }

  @Patch("claims/:id/approve")
  @Permissions(PermissionsList.EXPENSE_APPROVAL_APPROVE)
  async approveClaim(
    @Param("id") id: string,
    @Body() dto: ApproveClaimDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.expenseService.approveClaim(id, req.user, dto);
  }

  @Patch("claims/:id/reject")
  @Permissions(PermissionsList.EXPENSE_APPROVAL_APPROVE)
  async rejectClaim(
    @Param("id") id: string,
    @Body() dto: ApproveClaimDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.expenseService.rejectClaim(id, req.user, dto);
  }

  @Post("claims/:id/reimburse")
  @Permissions(PermissionsList.EXPENSE_REIMBURSE_WRITE)
  async reimburseClaim(
    @Param("id") id: string,
    @Body() dto: ReimburseClaimDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.expenseService.reimburseClaim(id, req.user, dto);
  }

  @Get("dashboard")
  @Permissions(PermissionsList.EXPENSE_CLAIM_READ)
  async getDashboardSummary(@Req() req: { user: AuthUser }) {
    return this.expenseService.getDashboardSummary(req.user);
  }

  @Get("claims")
  @Permissions(PermissionsList.EXPENSE_CLAIM_READ)
  async findAll(
    @Query() query: QueryClaimDto,
    @Req() req: { user: AuthUser; query: Record<string, string | undefined> },
    @Res() res: Response,
  ) {
    const list = await this.expenseService.findAll(query, req.user);

    // Check if CSV export is requested
    if (req.query.export === "csv") {
      let csv =
        "Claim ID,Employee Code,Employee Name,Title,Claim Date,Total Amount,Status\n";
      for (const r of list) {
        const empCode = r.employee?.employeeCode || "";
        const empName =
          `${r.employee?.firstName || ""} ${r.employee?.lastName || ""}`.trim();
        const dateStr = r.claimDate
          ? new Date(r.claimDate).toISOString().split("T")[0]
          : "";
        csv += `"${r.id}","${empCode}","${empName}","${r.title}","${dateStr}",${r.totalAmount},"${r.status}"\n`;
      }

      await this.auditService.log({
        action: "EXPENSE_SHEET_EXPORTED",
        entity: "ExpenseClaim",
        entityId: "all",
        tenantId: req.user.tenantId!,
        userId: req.user.id,
        newValues: { format: "csv" },
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="expense_register.csv"',
      );
      return res.send(csv);
    }

    return res.json(list);
  }

  @Get("claims/:id")
  @Permissions(PermissionsList.EXPENSE_CLAIM_READ)
  async findOne(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.expenseService.findOne(id, req.user);
  }
}
