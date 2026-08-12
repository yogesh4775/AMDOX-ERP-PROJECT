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
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { PmsService } from "./pms.service";
import { CreateCycleDto } from "./dto/create-cycle.dto";
import { CreateGoalDto } from "./dto/create-goal.dto";
import { UpdateGoalDto } from "./dto/update-goal.dto";
import { SubmitSelfReviewDto } from "./dto/submit-self-review.dto";
import { SubmitManagerReviewDto } from "./dto/submit-manager-review.dto";
import { FinalizeReviewDto } from "./dto/finalize-review.dto";
import { QueryPmsDto } from "./dto/query-pms.dto";

@Controller("pms")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PmsController {
  constructor(private readonly pmsService: PmsService) {}

  // --- Appraisal Cycle Management ---

  @Post("cycles")
  @Permissions(PermissionsList.PMS_CYCLE_WRITE)
  async createCycle(
    @Body() dto: CreateCycleDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.pmsService.createCycle(dto, req.user);
  }

  @Post("cycles/:id/activate")
  @Permissions(PermissionsList.PMS_CYCLE_WRITE)
  async activateCycle(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.pmsService.activateCycle(id, req.user);
  }

  @Post("cycles/:id/complete")
  @Permissions(PermissionsList.PMS_CYCLE_WRITE)
  async completeCycle(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.pmsService.completeCycle(id, req.user);
  }

  // --- Goal Management ---

  @Post("goals")
  @Permissions(PermissionsList.PMS_GOAL_WRITE)
  async createGoal(
    @Body() dto: CreateGoalDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.pmsService.createGoal(dto, req.user);
  }

  @Patch("goals/:id")
  @Permissions(PermissionsList.PMS_GOAL_WRITE)
  async updateGoal(
    @Param("id") id: string,
    @Body() dto: UpdateGoalDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.pmsService.updateGoal(id, dto, req.user);
  }

  // --- Review Submissions ---

  @Post("reviews/self-submit")
  @Permissions(PermissionsList.PMS_REVIEW_SUBMIT)
  async submitSelfReview(
    @Body() dto: SubmitSelfReviewDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.pmsService.submitSelfReview(dto, req.user);
  }

  @Patch("reviews/:id/manager-submit")
  @Permissions(PermissionsList.PMS_REVIEW_SUBMIT)
  async submitManagerReview(
    @Param("id") id: string,
    @Body() dto: SubmitManagerReviewDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.pmsService.submitManagerReview(id, dto, req.user);
  }

  @Patch("reviews/:id/finalize")
  @Permissions(PermissionsList.PMS_REVIEW_FINALIZE)
  async finalizeReview(
    @Param("id") id: string,
    @Body() dto: FinalizeReviewDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.pmsService.finalizeReview(id, dto, req.user);
  }

  // --- Dashboard ---

  @Get("dashboard")
  @Permissions(PermissionsList.PMS_GOAL_READ)
  async getDashboardSummary(@Req() req: { user: AuthUser }) {
    return this.pmsService.getDashboardSummary(req.user);
  }

  // --- Reviews & CSV / PDF Export ---

  @Get("reviews")
  @Permissions(PermissionsList.PMS_GOAL_READ)
  async findAll(
    @Query() query: QueryPmsDto,
    @Req() req: { user: AuthUser; query: Record<string, string | undefined> },
    @Res() res: Response,
  ) {
    if (req.query.export === "csv") {
      const list = await this.pmsService.findAll(query, req.user);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=performance-reviews.csv",
      );
      let csv =
        "Review ID,Employee Code,Employee Name,Cycle Name,Self Score,Manager Score,Final Score,Status\n";
      for (const r of list) {
        csv += `"${r.id}","${r.employee.employeeCode}","${r.employee.firstName} ${r.employee.lastName}","${r.appraisalCycle.name}",${r.selfScore || ""},${r.managerScore || ""},${r.finalScore || ""},"${r.status}"\n`;
      }
      return res.status(200).send(csv);
    }

    const data = await this.pmsService.findAll(query, req.user);
    return res.status(200).json(data);
  }

  @Get("reviews/:id")
  @Permissions(PermissionsList.PMS_GOAL_READ)
  async findOne(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.pmsService.findOne(id, req.user);
  }

  // --- PDF Reports ---

  @Get("reports/performance/pdf")
  @Permissions(PermissionsList.PMS_GOAL_READ)
  async exportPerformanceReportPdf(
    @Query() query: QueryPmsDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const buffer = await this.pmsService.exportPerformanceReportPdf(query, req.user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=performance-report.pdf",
    );
    return res.status(200).send(buffer);
  }
}
