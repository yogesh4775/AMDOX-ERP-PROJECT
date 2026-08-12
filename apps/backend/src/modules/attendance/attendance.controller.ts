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
import { AttendanceService } from "./attendance.service";
import { CreatePolicyDto } from "./dto/create-policy.dto";
import { CreateShiftDto } from "./dto/create-shift.dto";
import { AssignShiftDto } from "./dto/assign-shift.dto";
import { CheckInOutDto } from "./dto/check-in-out.dto";
import { RequestCorrectionDto } from "./dto/request-correction.dto";
import { QueryAttendanceDto } from "./dto/query-attendance.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { AuditService } from "../../common/audit/audit.service";

@Controller("attendance")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly auditService: AuditService,
  ) {}

  @Post("policies")
  @Permissions(PermissionsList.ATTENDANCE_POLICY_WRITE)
  async createPolicy(
    @Body() dto: CreatePolicyDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.attendanceService.createPolicy(dto, req.user);
  }

  @Post("shifts")
  @Permissions(PermissionsList.ATTENDANCE_POLICY_WRITE)
  async createShift(
    @Body() dto: CreateShiftDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.attendanceService.createShift(dto, req.user);
  }

  @Post("shifts/assign")
  @Permissions(PermissionsList.ATTENDANCE_POLICY_WRITE)
  async assignShift(
    @Body() dto: AssignShiftDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.attendanceService.assignShift(dto, req.user);
  }

  @Post("check-in")
  @Permissions(PermissionsList.ATTENDANCE_RECORD_WRITE)
  async checkIn(@Body() dto: CheckInOutDto, @Req() req: { user: AuthUser }) {
    return this.attendanceService.checkIn(dto, req.user);
  }

  @Post("check-out")
  @Permissions(PermissionsList.ATTENDANCE_RECORD_WRITE)
  async checkOut(@Body() dto: CheckInOutDto, @Req() req: { user: AuthUser }) {
    return this.attendanceService.checkOut(dto, req.user);
  }

  @Post("records/:id/corrections")
  @Permissions(PermissionsList.ATTENDANCE_RECORD_WRITE)
  async requestCorrection(
    @Param("id") recordId: string,
    @Body() dto: RequestCorrectionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.attendanceService.requestCorrection(recordId, dto, req.user);
  }

  @Patch("corrections/:id/approve")
  @Permissions(PermissionsList.ATTENDANCE_CORRECTION_APPROVE)
  async approveCorrection(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.attendanceService.approveCorrection(id, req.user);
  }

  @Patch("corrections/:id/reject")
  @Permissions(PermissionsList.ATTENDANCE_CORRECTION_APPROVE)
  async rejectCorrection(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.attendanceService.rejectCorrection(id, req.user);
  }

  @Get("records")
  @Permissions(PermissionsList.ATTENDANCE_RECORD_READ)
  async getRecords(
    @Query() query: QueryAttendanceDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const list = await this.attendanceService.getRecords(query, req.user);

    if (query.export === "csv") {
      let csv =
        "Record ID,Employee Code,Employee Name,Date,Check-In,Check-Out,Working Hours,Overtime Hours,Late Arrival,Early Departure,Status\n";
      for (const r of list) {
        const empCode = r.employee?.employeeCode || "";
        const empName =
          `${r.employee?.firstName || ""} ${r.employee?.lastName || ""}`.trim();
        const dStr = r.date ? r.date.toISOString().split("T")[0] : "";
        const cIn = r.checkIn ? r.checkIn.toISOString() : "";
        const cOut = r.checkOut ? r.checkOut.toISOString() : "";
        const working = r.workingHours ? r.workingHours.toString() : "0";
        const ot = r.overtimeHours ? r.overtimeHours.toString() : "0";

        csv += `"${r.id}","${empCode}","${empName}","${dStr}","${cIn}","${cOut}",${working},${ot},${r.isLate},${r.isEarlyOut},"${r.status}"\n`;
      }

      await this.auditService.log({
        action: "ATTENDANCE_SHEET_EXPORTED",
        entity: "AttendanceRecord",
        entityId: "all",
        tenantId: req.user.tenantId!,
        userId: req.user.id,
        newValues: { format: "csv" },
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="attendance_records.csv"',
      );
      return res.send(csv);
    }

    return res.json(list);
  }

  @Get("dashboard")
  @Permissions(PermissionsList.ATTENDANCE_DASHBOARD_READ)
  async getDashboardSummary(@Req() req: { user: AuthUser }) {
    return this.attendanceService.getDashboardSummary(req.user);
  }
}
