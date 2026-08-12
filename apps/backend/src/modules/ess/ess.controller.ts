/* eslint-disable */
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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { EssService } from "./ess.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { EssRequestLeaveDto, EssCreateClaimDto } from "./dto/ess-requests.dto";
import { QueryEssDto } from "./dto/query-ess.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { MediaService } from "../media/media.service";
import { MulterFile } from "../media/storage/storage-provider.interface";
import { AuditService } from "../../common/audit/audit.service";

@Controller("ess")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EssController {
  constructor(
    private readonly essService: EssService,
    private readonly mediaService: MediaService,
    private readonly auditService: AuditService,
  ) {}

  @Get("profile")
  @Permissions(PermissionsList.ESS_PORTAL_READ)
  async getProfile(@Req() req: { user: AuthUser }) {
    return this.essService.getProfile(req.user);
  }

  @Patch("profile")
  @Permissions(PermissionsList.ESS_PORTAL_WRITE)
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.essService.updateProfile(dto, req.user);
  }

  @Post("profile/photo")
  @Permissions(PermissionsList.ESS_PORTAL_WRITE)
  @UseInterceptors(FileInterceptor("file"))
  async uploadProfilePhoto(
    @UploadedFile() file: MulterFile,
    @Req() req: { user: AuthUser },
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }
    const media = await this.mediaService.upload(file, { isPublic: true }, req.user);
    return this.essService.updateProfilePhoto(`/api/media/${media.id}/download`, req.user);
  }

  @Get("attendance")
  @Permissions(PermissionsList.ESS_PORTAL_READ)
  async getAttendanceHistory(@Req() req: { user: AuthUser }) {
    return this.essService.getAttendanceHistory(req.user);
  }

  @Post("attendance/check-in")
  @Permissions(PermissionsList.ESS_PORTAL_WRITE)
  async checkIn(
    @Body() body: { timestamp: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.essService.checkIn(body, req.user);
  }

  @Post("attendance/check-out")
  @Permissions(PermissionsList.ESS_PORTAL_WRITE)
  async checkOut(
    @Body() body: { timestamp: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.essService.checkOut(body, req.user);
  }

  @Get("leave/balances")
  @Permissions(PermissionsList.ESS_PORTAL_READ)
  async getLeaveBalances(@Req() req: { user: AuthUser }) {
    return this.essService.getLeaveBalances(req.user);
  }

  @Get("leave/requests")
  @Permissions(PermissionsList.ESS_PORTAL_READ)
  async getLeaveRequests(
    @Query() query: QueryEssDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const list = await this.essService.getLeaveRequests(req.user);

    if (query.export === "csv") {
      let csv = "Leave ID,Leave Type,Start Date,End Date,Half Day,Reason,Status\n";
      for (const r of list) {
        const typeCode = r.leaveType?.code || "";
        const start = r.startDate ? r.startDate.toISOString().split("T")[0] : "";
        const end = r.endDate ? r.endDate.toISOString().split("T")[0] : "";
        csv += `"${r.id}","${typeCode}","${start}","${end}",${r.isHalfDay},"${r.reason}","${r.status}"\n`;
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="leave_requests.csv"');
      return res.status(200).send(csv);
    }

    return res.status(200).json(list);
  }

  @Post("leave/requests")
  @Permissions(PermissionsList.ESS_PORTAL_WRITE)
  async applyLeave(
    @Body() dto: EssRequestLeaveDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.essService.applyLeave(dto, req.user);
  }

  @Post("leave/requests/:id/cancel")
  @Permissions(PermissionsList.ESS_PORTAL_WRITE)
  async cancelLeave(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.essService.cancelLeave(id, req.user);
  }

  @Get("payroll/payslips")
  @Permissions(PermissionsList.ESS_PORTAL_READ)
  async getPayslips(@Req() req: { user: AuthUser }) {
    return this.essService.getPayslips(req.user);
  }

  @Get("payroll/payslips/:id/pdf")
  @Permissions(PermissionsList.ESS_PORTAL_READ)
  async getPayslipPdf(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const buffer = await this.essService.getPayslipPdf(id, req.user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=payslip-${id}.pdf`);
    return res.status(200).send(buffer);
  }

  @Get("expense/claims")
  @Permissions(PermissionsList.ESS_PORTAL_READ)
  async getExpenseClaims(
    @Query() query: QueryEssDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const list = await this.essService.getExpenseClaims(req.user);

    if (query.export === "csv") {
      let csv = "Claim ID,Title,Claim Date,Total Amount,Status\n";
      for (const c of list) {
        const date = c.claimDate ? c.claimDate.toISOString().split("T")[0] : "";
        csv += `"${c.id}","${c.title}","${date}",${c.totalAmount},"${c.status}"\n`;
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="expense_claims.csv"');
      return res.status(200).send(csv);
    }

    return res.status(200).json(list);
  }

  @Post("expense/claims")
  @Permissions(PermissionsList.ESS_PORTAL_WRITE)
  async createExpenseClaim(
    @Body() dto: EssCreateClaimDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.essService.createExpenseClaim(dto, req.user);
  }

  @Post("expense/claims/:id/submit")
  @Permissions(PermissionsList.ESS_PORTAL_WRITE)
  async submitExpenseClaim(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.essService.submitExpenseClaim(id, req.user);
  }

  @Get("pms/goals")
  @Permissions(PermissionsList.ESS_PORTAL_READ)
  async getPmsGoals(@Req() req: { user: AuthUser }) {
    return this.essService.getPmsGoals(req.user);
  }

  @Get("pms/reviews")
  @Permissions(PermissionsList.ESS_PORTAL_READ)
  async getPmsReviews(@Req() req: { user: AuthUser }) {
    return this.essService.getPmsReviews(req.user);
  }

  @Post("pms/reviews/self-submit")
  @Permissions(PermissionsList.ESS_PORTAL_WRITE)
  async submitSelfReview(
    @Body() dto: { appraisalCycleId: string; selfScore: number; selfFeedback: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.essService.submitSelfReview(dto, req.user);
  }

  @Get("dashboard")
  @Permissions(PermissionsList.ESS_PORTAL_READ)
  async getDashboardSummary(@Req() req: { user: AuthUser }) {
    return this.essService.getDashboardSummary(req.user);
  }

  @Get("announcements")
  @Permissions(PermissionsList.ESS_PORTAL_READ)
  async getAnnouncements(@Req() req: { user: AuthUser }) {
    return this.essService.getAnnouncements(req.user);
  }

  @Post("announcements")
  @Permissions(PermissionsList.ESS_ANNOUNCEMENT_WRITE)
  async createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.essService.createAnnouncement(dto, req.user);
  }
}
