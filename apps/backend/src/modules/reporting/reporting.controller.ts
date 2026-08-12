import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { ReportingService } from "./reporting.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { QueryReportDto } from "./dto/query-report.dto";
import { DeleteReportDto } from "./dto/delete-report.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("reporting")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.REPORT_CREATE)
  async create(@Body() dto: CreateReportDto, @Req() req: { user: AuthUser }) {
    return this.reportingService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.REPORT_READ)
  async findAll(
    @Query() query: QueryReportDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.reportingService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.REPORT_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.reportingService.findOne(id, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.REPORT_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteReportDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.reportingService.delete(id, dto, req.user);
  }

  @Get(":id/download")
  @Permissions(PermissionsList.REPORT_READ)
  async download(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const { stream, originalName, mimeType, size } =
      await this.reportingService.getDownloadStream(id, req.user);

    res.setHeader("Content-Type", mimeType);
    const safeFilename = encodeURIComponent(originalName);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
    );
    res.setHeader("Content-Length", size.toString());

    stream.pipe(res);
  }
}
