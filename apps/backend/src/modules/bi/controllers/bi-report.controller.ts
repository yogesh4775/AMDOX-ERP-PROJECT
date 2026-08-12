/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Res,
  Req,
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { BiReportService } from "../services/bi-report.service";
import { BiExportService } from "../services/bi-export.service";
import {
  CreateReportDefinitionDto,
  UpdateReportDefinitionDto,
  CreateReportScheduleDto,
} from "../dto/report.dto";

@Controller("bi")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BiReportController {
  constructor(
    private readonly biReportService: BiReportService,
    private readonly biExportService: BiExportService,
  ) {}

  @Post("reports")
  @Permissions("bi:report:write")
  async createReport(
    @Body() dto: CreateReportDefinitionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.biReportService.createReportDefinition(dto, req.user);
  }

  @Patch("reports/:id")
  @Permissions("bi:report:write")
  async updateReport(
    @Param("id") id: string,
    @Body() dto: UpdateReportDefinitionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.biReportService.updateReportDefinition(id, dto, req.user);
  }

  @Post("reports/:id/run")
  @Permissions("bi:report:read")
  async runReport(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.biReportService.runReport(id, req.user);
  }

  @Get("reports/:id/export")
  @Permissions("bi:report:read")
  async exportReport(
    @Param("id") id: string,
    @Query("format") format: string,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const result = await this.biReportService.runReport(id, req.user);

    // Extract headers and rows from aggregated facts
    const sample = result.rows[0] || {};
    const headers = Object.keys(sample).filter(
      (key) => typeof sample[key] !== "object" || sample[key] === null,
    );
    const rows = result.rows.map((r: any) => headers.map((h) => r[h]));

    let stream;
    let mimeType = "text/csv";
    let filename = `report_${id}`;

    if (format?.toLowerCase() === "pdf") {
      stream = await this.biExportService.exportPdf(
        result.reportDefinition.name,
        headers,
        rows,
      );
      mimeType = "application/pdf";
      filename += ".pdf";
    } else if (
      format?.toLowerCase() === "excel" ||
      format?.toLowerCase() === "xlsx"
    ) {
      stream = await this.biExportService.exportExcel(headers, rows);
      mimeType = "application/vnd.ms-excel";
      filename += ".xls";
    } else {
      stream = await this.biExportService.exportCsv(headers, rows);
      mimeType = "text/csv";
      filename += ".csv";
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    stream.pipe(res);
  }

  @Post("reports/:id/schedules")
  @Permissions("bi:report:write")
  async createSchedule(
    @Param("id") reportDefinitionId: string,
    @Body() dto: Omit<CreateReportScheduleDto, "reportDefinitionId">,
    @Req() req: { user: AuthUser },
  ) {
    return this.biReportService.createSchedule(
      { ...dto, reportDefinitionId },
      req.user,
    );
  }

  @Delete("reports/schedules/:scheduleId")
  @Permissions("bi:report:write")
  async deleteSchedule(
    @Param("scheduleId") scheduleId: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.biReportService.deleteSchedule(scheduleId, req.user);
  }
}
