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
import { BudgetingService } from "./budgeting.service";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { UpdateBudgetDto } from "./dto/update-budget.dto";
import { CreateRevisionDto } from "./dto/create-revision.dto";
import { BudgetApprovalDto } from "./dto/budget-approval.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { AuditService } from "../../common/audit/audit.service";

@Controller("budget")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BudgetingController {
  constructor(
    private readonly budgetingService: BudgetingService,
    private readonly auditService: AuditService,
  ) {}

  @Get("budgets")
  @Permissions(PermissionsList.BUDGET_READ)
  async getBudgets(@Req() req: { user: AuthUser }) {
    return this.budgetingService.getBudgets(req.user);
  }

  @Post("budgets")
  @Permissions(PermissionsList.BUDGET_WRITE)
  async createBudget(
    @Body() dto: CreateBudgetDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.budgetingService.createBudget(dto, req.user);
  }

  @Get("budgets/:id")
  @Permissions(PermissionsList.BUDGET_READ)
  async getBudgetById(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.budgetingService.getBudgetById(id, req.user);
  }

  @Patch("budgets/:id")
  @Permissions(PermissionsList.BUDGET_WRITE)
  async updateBudget(
    @Param("id") id: string,
    @Body() dto: UpdateBudgetDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.budgetingService.updateBudget(id, dto, req.user);
  }

  @Post("budgets/:id/submit")
  @Permissions(PermissionsList.BUDGET_WRITE)
  async submitBudget(
    @Param("id") id: string,
    @Body("expectedVersion") expectedVersion: number,
    @Req() req: { user: AuthUser },
  ) {
    return this.budgetingService.submitBudget(id, expectedVersion, req.user);
  }

  @Post("budgets/:id/approve")
  @Permissions(PermissionsList.BUDGET_APPROVE)
  async approveBudget(
    @Param("id") id: string,
    @Body() dto: BudgetApprovalDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.budgetingService.approveBudget(id, dto, req.user);
  }

  @Post("budgets/:id/lock")
  @Permissions(PermissionsList.BUDGET_WRITE)
  async lockBudget(
    @Param("id") id: string,
    @Body("expectedVersion") expectedVersion: number,
    @Req() req: { user: AuthUser },
  ) {
    return this.budgetingService.lockBudget(id, expectedVersion, req.user);
  }

  @Post("budgets/:id/revision")
  @Permissions(PermissionsList.BUDGET_REVISION_WRITE)
  async createRevision(
    @Param("id") id: string,
    @Body() dto: CreateRevisionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.budgetingService.createRevision(id, dto, req.user);
  }

  @Get("budgets/:id/variance")
  @Permissions(PermissionsList.BUDGET_REPORT_READ)
  async getVarianceReport(
    @Param("id") id: string,
    @Query("export") exportType: string,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const report = await this.budgetingService.getVarianceReport(id, req.user);

    if (exportType === "csv") {
      let csv =
        "GL Code,GL Name,Category,Budgeted,Actual,Variance,Variance %\n";
      for (const line of report) {
        csv += `"${line.glAccountCode}","${line.glAccountName}","${line.category}",${line.budget},${line.actual},${line.variance},${line.variancePercentage}%\n`;
      }

      await this.auditService.log({
        action: "BUDGET_VARIANCE_EXPORTED",
        entity: "Budget",
        entityId: id,
        tenantId: req.user.tenantId!,
        userId: req.user.id,
        newValues: { format: "csv" },
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="budget_variance_${id}.csv"`,
      );
      return res.send(csv);
    }

    return res.json(report);
  }

  @Get("budgets/:id/forecast")
  @Permissions(PermissionsList.BUDGET_REPORT_READ)
  async getForecastReport(
    @Param("id") id: string,
    @Query("scenario") scenario: "OPTIMISTIC" | "BASE" | "PESSIMISTIC",
    @Req() req: { user: AuthUser },
  ) {
    return this.budgetingService.getForecastReport(
      id,
      scenario || "BASE",
      req.user,
    );
  }

  @Get("dashboard")
  @Permissions(PermissionsList.BUDGET_READ)
  async getDashboardWidgets(@Req() req: { user: AuthUser }) {
    return this.budgetingService.getDashboardWidgets(req.user);
  }
}
