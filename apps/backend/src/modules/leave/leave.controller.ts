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
import { LeaveService } from "./leave.service";
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { RequestLeaveDto } from "./dto/request-leave.dto";
import { ApproveLeaveDto } from "./dto/approve-leave.dto";
import { QueryLeaveDto } from "./dto/query-leave.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { AuditService } from "../../common/audit/audit.service";

@Controller("leave")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeaveController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly auditService: AuditService,
  ) {}

  @Post("types")
  @Permissions(PermissionsList.LEAVE_POLICY_WRITE)
  async createLeaveType(
    @Body() dto: CreateLeaveTypeDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.leaveService.createLeaveType(dto, req.user);
  }

  @Post("balances/allocate")
  @Permissions(PermissionsList.LEAVE_POLICY_WRITE)
  async allocateBalance(
    @Body()
    body: { employeeId: string; leaveTypeId: string; allocatedDays: number },
    @Req() req: { user: AuthUser },
  ) {
    return this.leaveService.allocateBalance(
      body.employeeId,
      body.leaveTypeId,
      body.allocatedDays,
      req.user,
    );
  }

  @Post("accruals")
  @Permissions(PermissionsList.LEAVE_POLICY_WRITE)
  async runMonthlyAccrual(@Req() req: { user: AuthUser }) {
    return this.leaveService.runMonthlyAccrual(req.user);
  }

  @Post("carry-forward")
  @Permissions(PermissionsList.LEAVE_POLICY_WRITE)
  async runCarryForward(@Req() req: { user: AuthUser }) {
    return this.leaveService.runCarryForward(req.user);
  }

  @Post("compoff")
  @Permissions(PermissionsList.LEAVE_POLICY_WRITE)
  async generateCompOff(
    @Body() body: { employeeId: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.leaveService.generateCompOffFromOvertime(
      body.employeeId,
      req.user,
    );
  }

  @Post("requests")
  @Permissions(PermissionsList.LEAVE_REQUEST_WRITE)
  async requestLeave(
    @Body() dto: RequestLeaveDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.leaveService.requestLeave(dto, req.user);
  }

  @Patch("requests/:id/approve")
  @Permissions(PermissionsList.LEAVE_APPROVAL_APPROVE)
  async approveLeave(
    @Param("id") id: string,
    @Body() body: ApproveLeaveDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.leaveService.approveLeave(id, 2, body.comment, req.user); // Stage 2 is final approval
  }

  @Patch("requests/:id/reject")
  @Permissions(PermissionsList.LEAVE_APPROVAL_APPROVE)
  async rejectLeave(
    @Param("id") id: string,
    @Body() body: ApproveLeaveDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.leaveService.rejectLeave(id, 2, body.comment, req.user);
  }

  @Post("requests/:id/cancel")
  @Permissions(PermissionsList.LEAVE_REQUEST_WRITE)
  async cancelLeave(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.leaveService.cancelLeave(id, req.user);
  }

  @Get("requests")
  @Permissions(PermissionsList.LEAVE_REQUEST_READ)
  async getLeaves(
    @Query() query: QueryLeaveDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const list = await this.leaveService.getLeaves(query, req.user);

    if (query.export === "csv") {
      let csv =
        "Leave ID,Employee Code,Employee Name,Leave Type,Start Date,End Date,Half Day,Reason,Status\n";
      for (const r of list) {
        const empCode = r.employee?.employeeCode || "";
        const empName =
          `${r.employee?.firstName || ""} ${r.employee?.lastName || ""}`.trim();
        const typeCode = r.leaveType?.code || "";
        const start = r.startDate
          ? r.startDate.toISOString().split("T")[0]
          : "";
        const end = r.endDate ? r.endDate.toISOString().split("T")[0] : "";

        csv += `"${r.id}","${empCode}","${empName}","${typeCode}","${start}","${end}",${r.isHalfDay},"${r.reason}","${r.status}"\n`;
      }

      await this.auditService.log({
        action: "LEAVE_SHEET_EXPORTED",
        entity: "LeaveRequest",
        entityId: "all",
        tenantId: req.user.tenantId!,
        userId: req.user.id,
        newValues: { format: "csv" },
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="leaves_register.csv"',
      );
      return res.send(csv);
    }

    return res.json(list);
  }

  @Get("dashboard")
  @Permissions(PermissionsList.LEAVE_DASHBOARD_READ)
  async getDashboardSummary(@Req() req: { user: AuthUser }) {
    return this.leaveService.getDashboardSummary(req.user);
  }
}
