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
import { CRMService } from "./crm.service";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";
import { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import { UpdateOpportunityDto } from "./dto/update-opportunity.dto";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { ConvertLeadDto } from "./dto/convert-lead.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { AuditService } from "../../common/audit/audit.service";
import { Prisma } from "@amdox/database/generated";

@Controller("crm")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CRMController {
  constructor(
    private readonly crmService: CRMService,
    private readonly auditService: AuditService,
  ) {}

  // --- LEADS ---
  @Get("leads")
  @Permissions(PermissionsList.CRM_LEAD_READ)
  async getLeads(@Req() req: { user: AuthUser }) {
    return this.crmService.getLeads(req.user);
  }

  @Post("leads")
  @Permissions(PermissionsList.CRM_LEAD_WRITE)
  async createLead(@Body() dto: CreateLeadDto, @Req() req: { user: AuthUser }) {
    return this.crmService.createLead(dto, req.user);
  }

  @Get("leads/:id")
  @Permissions(PermissionsList.CRM_LEAD_READ)
  async getLeadById(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.crmService.getLeadById(id, req.user);
  }

  @Patch("leads/:id")
  @Permissions(PermissionsList.CRM_LEAD_WRITE)
  async updateLead(
    @Param("id") id: string,
    @Body() dto: UpdateLeadDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.updateLead(id, dto, req.user);
  }

  @Post("leads/:id/convert")
  @Permissions(PermissionsList.CRM_LEAD_WRITE)
  async convertLead(
    @Param("id") id: string,
    @Body() dto: ConvertLeadDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.convertLead(id, dto, req.user);
  }

  // --- CONTACTS ---
  @Get("contacts")
  @Permissions(PermissionsList.CRM_OPPORTUNITY_READ)
  async getContacts(@Req() req: { user: AuthUser }) {
    return this.crmService.getContacts(req.user);
  }

  @Post("contacts")
  @Permissions(PermissionsList.CRM_OPPORTUNITY_WRITE)
  async createContact(
    @Body() dto: CreateContactDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.createContact(dto, req.user);
  }

  @Patch("contacts/:id")
  @Permissions(PermissionsList.CRM_OPPORTUNITY_WRITE)
  async updateContact(
    @Param("id") id: string,
    @Body() dto: UpdateContactDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.updateContact(id, dto, req.user);
  }

  // --- ACCOUNTS ---
  @Get("accounts")
  @Permissions(PermissionsList.CRM_OPPORTUNITY_READ)
  async getAccounts(@Req() req: { user: AuthUser }) {
    return this.crmService.getAccounts(req.user);
  }

  @Post("accounts")
  @Permissions(PermissionsList.CRM_OPPORTUNITY_WRITE)
  async createAccount(
    @Body() dto: CreateAccountDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.createAccount(dto, req.user);
  }

  @Patch("accounts/:id")
  @Permissions(PermissionsList.CRM_OPPORTUNITY_WRITE)
  async updateAccount(
    @Param("id") id: string,
    @Body() dto: UpdateAccountDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.updateAccount(id, dto, req.user);
  }

  // --- OPPORTUNITIES ---
  @Get("opportunities")
  @Permissions(PermissionsList.CRM_OPPORTUNITY_READ)
  async getOpportunities(
    @Query("export") exportType: string,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const opps = await this.crmService.getOpportunities(req.user);

    if (exportType === "csv") {
      let csv =
        "ID,Name,Stage,Amount,Probability %,Forecast Value,Close Date\n";
      for (const opp of opps) {
        const amt = new Prisma.Decimal(opp.amount);
        const prob = new Prisma.Decimal(opp.probability);
        const forecastVal = amt.mul(prob).div(100).toString();
        const closeDate = opp.expectedCloseDate
          ? opp.expectedCloseDate.toISOString()
          : "";

        csv += `"${opp.id}","${opp.name}","${opp.stage}",${amt.toString()},${prob.toString()},${forecastVal},"${closeDate}"\n`;
      }

      await this.auditService.log({
        action: "CRM_PIPELINE_EXPORTED",
        entity: "Opportunity",
        entityId: "all",
        tenantId: req.user.tenantId!,
        userId: req.user.id,
        newValues: { format: "csv" },
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="crm_opportunities.csv"',
      );
      return res.send(csv);
    }

    return res.json(opps);
  }

  @Post("opportunities")
  @Permissions(PermissionsList.CRM_OPPORTUNITY_WRITE)
  async createOpportunity(
    @Body() dto: CreateOpportunityDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.createOpportunity(dto, req.user);
  }

  @Get("opportunities/:id")
  @Permissions(PermissionsList.CRM_OPPORTUNITY_READ)
  async getOpportunityById(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.getOpportunityById(id, req.user);
  }

  @Patch("opportunities/:id")
  @Permissions(PermissionsList.CRM_OPPORTUNITY_WRITE)
  async updateOpportunity(
    @Param("id") id: string,
    @Body() dto: UpdateOpportunityDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.updateOpportunity(id, dto, req.user);
  }

  // --- ACTIVITIES TIMELINE ---
  @Post("activities")
  @Permissions(PermissionsList.CRM_ACTIVITY_WRITE)
  async createActivity(
    @Body() dto: CreateActivityDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.createActivity(dto, req.user);
  }

  @Get("opportunities/:id/timeline")
  @Permissions(PermissionsList.CRM_ACTIVITY_READ)
  async getOpportunityTimeline(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.getTimeline(id, "opportunity", req.user);
  }

  @Get("leads/:id/timeline")
  @Permissions(PermissionsList.CRM_ACTIVITY_READ)
  async getLeadTimeline(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.crmService.getTimeline(id, "lead", req.user);
  }

  // --- DASHBOARD ---
  @Get("dashboard")
  @Permissions(PermissionsList.CRM_DASHBOARD_READ)
  async getDashboardSummary(@Req() req: { user: AuthUser }) {
    return this.crmService.getDashboardSummary(req.user);
  }
}
