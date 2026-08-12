/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Body,
  Controller,
  Delete,
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
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { CsmService } from "../services/csm.service";
import { CreateCategoryDto, UpdateCategoryDto } from "../dto/category.dto";
import { CreateSlaPolicyDto, UpdateSlaPolicyDto } from "../dto/sla-policy.dto";
import { CreateContractDto, UpdateContractDto } from "../dto/contract.dto";
import {
  CreateTicketDto,
  UpdateTicketDto,
  AddTicketNoteDto,
  SubmitCsatDto,
  MergeTicketsDto,
  SplitTicketDto,
} from "../dto/ticket.dto";
import { CreateRmaDto, UpdateRmaStatusDto } from "../dto/rma.dto";
import {
  CreateServiceVisitDto,
  UpdateServiceVisitStatusDto,
} from "../dto/visit.dto";
import { CreateKbArticleDto, UpdateKbArticleDto } from "../dto/kb.dto";

@Controller("csm")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CsmController {
  constructor(private readonly csmService: CsmService) {}

  // --- TICKET CATEGORIES ---
  @Post("categories")
  @Permissions("csm:ticket:write")
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.createCategory(dto, req.user);
  }

  @Patch("categories/:id")
  @Permissions("csm:ticket:write")
  async updateCategory(
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.updateCategory(id, dto, req.user);
  }

  @Delete("categories/:id")
  @Permissions("csm:ticket:write")
  async deleteCategory(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.deleteCategory(id, req.user);
  }

  @Get("categories")
  @Permissions("csm:ticket:read")
  async listCategories(@Req() req: { user: AuthUser }) {
    return this.csmService.listCategories(req.user);
  }

  // --- SLA POLICIES ---
  @Post("sla-policies")
  @Permissions("csm:ticket:write")
  async createSlaPolicy(
    @Body() dto: CreateSlaPolicyDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.createSlaPolicy(dto, req.user);
  }

  @Patch("sla-policies/:id")
  @Permissions("csm:ticket:write")
  async updateSlaPolicy(
    @Param("id") id: string,
    @Body() dto: UpdateSlaPolicyDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.updateSlaPolicy(id, dto, req.user);
  }

  @Delete("sla-policies/:id")
  @Permissions("csm:ticket:write")
  async deleteSlaPolicy(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.deleteSlaPolicy(id, req.user);
  }

  @Get("sla-policies")
  @Permissions("csm:ticket:read")
  async listSlaPolicies(@Req() req: { user: AuthUser }) {
    return this.csmService.listSlaPolicies(req.user);
  }

  // --- SERVICE CONTRACTS ---
  @Post("contracts")
  @Permissions("csm:contract:write")
  async createContract(
    @Body() dto: CreateContractDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.createContract(dto, req.user);
  }

  @Patch("contracts/:id")
  @Permissions("csm:contract:write")
  async updateContract(
    @Param("id") id: string,
    @Body() dto: UpdateContractDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.updateContract(id, dto, req.user);
  }

  @Get("contracts")
  @Permissions("csm:contract:read")
  async listContracts(@Req() req: { user: AuthUser }) {
    return this.csmService.listContracts(req.user);
  }

  // --- SUPPORT TICKETS ---
  @Post("tickets")
  @Permissions("csm:ticket:write")
  async createTicket(
    @Body() dto: CreateTicketDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.createTicket(dto, req.user);
  }

  @Patch("tickets/:id")
  @Permissions("csm:ticket:write")
  async updateTicket(
    @Param("id") id: string,
    @Body() dto: UpdateTicketDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.updateTicket(id, dto, req.user);
  }

  @Get("tickets/:id")
  @Permissions("csm:ticket:read")
  async getTicket(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.csmService.getTicket(id, req.user);
  }

  @Get("tickets")
  @Permissions("csm:ticket:read")
  async listTickets(@Query() query: any, @Req() req: { user: AuthUser }) {
    return this.csmService.listTickets(req.user, query);
  }

  @Post("tickets/:id/notes")
  @Permissions("csm:ticket:write")
  async addTicketNote(
    @Param("id") id: string,
    @Body() dto: AddTicketNoteDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.addTicketNote(id, dto, req.user);
  }

  @Post("tickets/:id/csat")
  @Permissions("csm:ticket:read")
  async submitCsat(
    @Param("id") id: string,
    @Body() dto: SubmitCsatDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.submitCsat(id, dto, req.user);
  }

  @Post("tickets/merge")
  @Permissions("csm:ticket:write")
  async mergeTickets(
    @Body() dto: MergeTicketsDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.mergeTickets(dto, req.user);
  }

  @Post("tickets/:id/split")
  @Permissions("csm:ticket:write")
  async splitTicket(
    @Param("id") id: string,
    @Body() dto: SplitTicketDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.splitTicket(id, dto, req.user);
  }

  // --- KNOWLEDGE BASE ---
  @Post("kb")
  @Permissions("csm:kb:write")
  async createKbArticle(
    @Body() dto: CreateKbArticleDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.createKbArticle(dto, req.user);
  }

  @Patch("kb/:id")
  @Permissions("csm:kb:write")
  async updateKbArticle(
    @Param("id") id: string,
    @Body() dto: UpdateKbArticleDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.updateKbArticle(id, dto, req.user);
  }

  @Get("kb")
  @Permissions("csm:kb:read")
  async listKbArticles(
    @Query("category") category: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.listKbArticles(req.user, category);
  }

  // --- EMAIL-TO-TICKET INGESTION PIPELINE ---
  @Post("email-ingest")
  @Permissions("csm:ticket:write")
  async ingestEmailTicket(
    @Body() dto: { from: string; subject: string; body: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.ingestEmailTicket(dto, req.user);
  }

  // --- RMA REQUESTS ---
  @Post("rmas")
  @Permissions("csm:rma:write")
  async createRma(@Body() dto: CreateRmaDto, @Req() req: { user: AuthUser }) {
    return this.csmService.createRma(dto, req.user);
  }

  @Patch("rmas/:id/status")
  @Permissions("csm:rma:write")
  async updateRmaStatus(
    @Param("id") id: string,
    @Body() dto: UpdateRmaStatusDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.updateRmaStatus(id, dto, req.user);
  }

  // --- FIELD SERVICE VISITS ---
  @Post("visits")
  @Permissions("csm:visit:write")
  async createServiceVisit(
    @Body() dto: CreateServiceVisitDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.createServiceVisit(dto, req.user);
  }

  @Patch("visits/:id/status")
  @Permissions("csm:visit:write")
  async updateServiceVisit(
    @Param("id") id: string,
    @Body() dto: UpdateServiceVisitStatusDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.csmService.updateServiceVisit(id, dto, req.user);
  }

  // --- DASHBOARD SUMMARY ---
  @Get("dashboard/summary")
  @Permissions("csm:ticket:read")
  async getDashboardSummary(@Req() req: { user: AuthUser }) {
    return this.csmService.getDashboardSummary(req.user);
  }

  // --- REPORT EXPORTS ---
  @Get("reports/export/csv")
  @Permissions("csm:ticket:read")
  async exportCsv(@Res() res: Response, @Req() req: { user: AuthUser }) {
    const csvContent = await this.csmService.exportCsvReport(req.user);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=csm_performance_report.csv",
    );
    return res.status(200).send(csvContent);
  }

  @Get("reports/export/pdf")
  @Permissions("csm:ticket:read")
  async exportPdf(@Res() res: Response, @Req() req: { user: AuthUser }) {
    const pdfStream = await this.csmService.exportPdfReport(req.user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=csm_performance_report.pdf",
    );
    pdfStream.pipe(res);
  }
}
