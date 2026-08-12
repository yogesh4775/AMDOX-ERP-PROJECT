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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { PayrollService } from "./payroll.service";
import { CreateComponentDto } from "./dto/create-component.dto";
import { CreateStructureDto } from "./dto/create-structure.dto";
import { AssignSalaryDto } from "./dto/assign-salary.dto";
import { CreatePeriodDto } from "./dto/create-period.dto";
import { QueryPayrollDto } from "./dto/query-payroll.dto";

@Controller("payroll")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post("components")
  @Permissions(PermissionsList.PAYROLL_CONFIG_WRITE)
  async createComponent(
    @Body() dto: CreateComponentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.payrollService.createComponent(dto, req.user);
  }

  @Post("structures")
  @Permissions(PermissionsList.PAYROLL_CONFIG_WRITE)
  async createStructure(
    @Body() dto: CreateStructureDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.payrollService.createStructure(dto, req.user);
  }

  @Post("assign")
  @Permissions(PermissionsList.PAYROLL_CONFIG_WRITE)
  async assignSalary(
    @Body() dto: AssignSalaryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.payrollService.assignSalary(dto, req.user);
  }

  @Post("periods")
  @Permissions(PermissionsList.PAYROLL_CONFIG_WRITE)
  async createPeriod(
    @Body() dto: CreatePeriodDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.payrollService.createPeriod(dto, req.user);
  }

  @Post("periods/:id/process")
  @Permissions(PermissionsList.PAYROLL_PROCESS_WRITE)
  async processPayroll(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.payrollService.processPayroll(id, req.user);
  }

  @Patch("periods/:id/lock")
  @Permissions(PermissionsList.PAYROLL_PERIOD_LOCK)
  async lockPayroll(
    @Param("id") id: string,
    @Body("expectedVersion") expectedVersion: number,
    @Req() req: { user: AuthUser },
  ) {
    return this.payrollService.lockPayroll(id, expectedVersion, req.user);
  }

  @Get("payslips")
  @Permissions(PermissionsList.PAYROLL_PROCESS_READ)
  async getPayslips(
    @Query() query: QueryPayrollDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const result = await this.payrollService.getPayslips(query, req.user);
    if (
      query.export === "csv" &&
      typeof result === "object" &&
      "csv" in result
    ) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=payslips.csv");
      return res.status(200).send(result.csv);
    }
    return res.status(200).json(result);
  }

  @Get("payslips/:id/pdf")
  @Permissions(PermissionsList.PAYROLL_PROCESS_READ)
  async exportPayslipPdf(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const buffer = await this.payrollService.exportPayslipPdf(id, req.user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payslip-${id}.pdf`,
    );
    return res.status(200).send(buffer);
  }

  @Get("dashboard")
  @Permissions(PermissionsList.PAYROLL_DASHBOARD_READ)
  async getDashboardSummary(@Req() req: { user: AuthUser }) {
    return this.payrollService.getDashboardSummary(req.user);
  }
}
