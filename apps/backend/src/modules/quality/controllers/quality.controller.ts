import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { QualityService } from "../services/quality.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import {
  CreateSamplingPlanDto,
  UpdateSamplingPlanDto,
} from "../dto/sampling-plan.dto";
import {
  CreateInspectionPlanDto,
  UpdateInspectionPlanDto,
} from "../dto/inspection-plan.dto";
import {
  CreateInspectionLotDto,
  UpdateInspectionLotDto,
} from "../dto/inspection-lot.dto";
import { RecordInspectionResultsDto } from "../dto/inspection-result.dto";
import { RecordDefectDto } from "../dto/defect.dto";
import { UpdateNCRDto } from "../dto/ncr.dto";
import { CreateCAPADto, UpdateCAPADto } from "../dto/capa.dto";
import { CreateCertificateDto } from "../dto/certificate.dto";

@Controller("quality")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  // --- SAMPLING PLANS ---
  @Post("sampling-plans")
  @Permissions("quality:plan:write")
  async createSamplingPlan(
    @Body() dto: CreateSamplingPlanDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.createSamplingPlan(dto, req.user);
  }

  @Patch("sampling-plans/:id")
  @Permissions("quality:plan:write")
  async updateSamplingPlan(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSamplingPlanDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.updateSamplingPlan(id, dto, req.user);
  }

  @Get("sampling-plans")
  @Permissions("quality:plan:read")
  async findAllSamplingPlans(@Req() req: { user: AuthUser }) {
    return this.qualityService.findAllSamplingPlans(req.user);
  }

  @Delete("sampling-plans/:id")
  @Permissions("quality:plan:write")
  async deleteSamplingPlan(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.deleteSamplingPlan(id, req.user);
  }

  // --- INSPECTION PLANS ---
  @Post("inspection-plans")
  @Permissions("quality:plan:write")
  async createInspectionPlan(
    @Body() dto: CreateInspectionPlanDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.createInspectionPlan(dto, req.user);
  }

  @Patch("inspection-plans/:id")
  @Permissions("quality:plan:write")
  async updateInspectionPlan(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateInspectionPlanDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.updateInspectionPlan(id, dto, req.user);
  }

  @Get("inspection-plans")
  @Permissions("quality:plan:read")
  async findAllInspectionPlans(@Req() req: { user: AuthUser }) {
    return this.qualityService.findAllInspectionPlans(req.user);
  }

  @Get("inspection-plans/:id")
  @Permissions("quality:plan:read")
  async findOneInspectionPlan(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.findOneInspectionPlan(id, req.user);
  }

  @Delete("inspection-plans/:id")
  @Permissions("quality:plan:write")
  async deleteInspectionPlan(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.deleteInspectionPlan(id, req.user);
  }

  // --- INSPECTION LOTS ---
  @Post("inspection-lots")
  @Permissions("quality:lot:write")
  async createInspectionLot(
    @Body() dto: CreateInspectionLotDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.createInspectionLot(dto, req.user);
  }

  @Patch("inspection-lots/:id")
  @Permissions("quality:lot:write")
  async updateInspectionLot(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateInspectionLotDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.updateInspectionLot(id, dto, req.user);
  }

  @Get("inspection-lots")
  @Permissions("quality:lot:read")
  async findAllInspectionLots(@Req() req: { user: AuthUser }) {
    return this.qualityService.findAllInspectionLots(req.user);
  }

  @Get("inspection-lots/:id")
  @Permissions("quality:lot:read")
  async findOneInspectionLot(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.findOneInspectionLot(id, req.user);
  }

  @Post("inspection-lots/:id/results")
  @Permissions("quality:lot:process")
  async recordInspectionResults(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RecordInspectionResultsDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.recordInspectionResults(id, dto, req.user);
  }

  @Post("inspection-lots/:id/defects")
  @Permissions("quality:lot:process")
  async recordDefect(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RecordDefectDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.recordDefect(id, dto, req.user);
  }

  // --- NCR REPORTS ---
  @Get("ncrs")
  @Permissions("quality:ncr:read")
  async findAllNCRs(@Req() req: { user: AuthUser }) {
    return this.qualityService.findAllNCRs(req.user);
  }

  @Get("ncrs/:id")
  @Permissions("quality:ncr:read")
  async findOneNCR(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.findOneNCR(id, req.user);
  }

  @Patch("ncrs/:id")
  @Permissions("quality:ncr:write")
  async updateNCR(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateNCRDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.updateNCR(id, dto, req.user);
  }

  // --- CAPA ACTIONS ---
  @Post("capas")
  @Permissions("quality:capa:write")
  async createCAPA(@Body() dto: CreateCAPADto, @Req() req: { user: AuthUser }) {
    return this.qualityService.createCAPA(dto, req.user);
  }

  @Patch("capas/:id")
  @Permissions("quality:capa:write")
  async updateCAPA(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCAPADto,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.updateCAPA(id, dto, req.user);
  }

  @Get("capas")
  @Permissions("quality:capa:read")
  async findAllCAPAs(@Req() req: { user: AuthUser }) {
    return this.qualityService.findAllCAPAs(req.user);
  }

  @Get("capas/:id")
  @Permissions("quality:capa:read")
  async findOneCAPA(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.findOneCAPA(id, req.user);
  }

  // --- QUALITY CERTIFICATES (COA) ---
  @Post("certificates")
  @Permissions("quality:certificate:write")
  async createCertificate(
    @Body() dto: CreateCertificateDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.createCertificate(dto, req.user);
  }

  @Get("certificates")
  @Permissions("quality:certificate:read")
  async findAllCertificates(@Req() req: { user: AuthUser }) {
    return this.qualityService.findAllCertificates(req.user);
  }

  @Post("certificates/:id/approve")
  @Permissions("quality:certificate:write")
  async approveCertificate(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.qualityService.approveCertificate(id, req.user);
  }

  // --- SUPPLIER QUALITY RATINGS ---
  @Get("supplier-ratings")
  @Permissions("quality:rating:read")
  async findAllSupplierRatings(@Req() req: { user: AuthUser }) {
    return this.qualityService.findAllSupplierRatings(req.user);
  }

  // --- REPORT EXPORTS ---
  @Get("reports/export/csv")
  @Permissions("quality:lot:read")
  async exportCSV(@Req() req: { user: AuthUser }) {
    const lots = await this.qualityService.findAllInspectionLots(req.user);
    const csvContent = [
      "ID,Code,Type,Status,Quantity,SampleSize,CreatedAt",
      ...lots.map(
        (l) =>
          `"${l.id}","${l.code}","${l.type}","${l.status}","${l.quantity}","${l.sampleSize}","${l.createdAt.toISOString()}"`,
      ),
    ].join("\n");
    return { csv: csvContent };
  }

  @Get("reports/export/pdf")
  @Permissions("quality:lot:read")
  async exportPDF(@Req() req: { user: AuthUser }) {
    const lots = await this.qualityService.findAllInspectionLots(req.user);
    return { pdf: Buffer.from(JSON.stringify(lots)).toString("base64") };
  }
}
