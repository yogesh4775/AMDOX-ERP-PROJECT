import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from "@nestjs/common";
import { CompanyService } from "../services/company.service";
import { ExchangeRateService } from "../services/exchange-rate.service";
import { InterCompanyService } from "../services/inter-company.service";
import { ConsolidationService } from "../services/consolidation.service";
import { CreateCompanyDto } from "../dto/create-company.dto";
import { UpdateExchangeRateDto } from "../dto/update-exchange-rate.dto";
import { CreateInterCompanyDto } from "../dto/create-intercompany.dto";
import { RunConsolidationDto } from "../dto/run-consolidation.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { CompanyPermissionGuard } from "../guards/company-permission.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("consolidation")
@UseGuards(JwtAuthGuard, PermissionsGuard, CompanyPermissionGuard)
export class ConsolidationController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly interCompanyService: InterCompanyService,
    private readonly consolidationService: ConsolidationService,
  ) {}

  @Post("companies")
  @Permissions(PermissionsList.CONSOLIDATION_COMPANY_WRITE)
  async createCompany(
    @Body() dto: CreateCompanyDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.companyService.createCompany(req.user.tenantId!, dto, req.user);
  }

  @Patch("companies/:id")
  @Permissions(PermissionsList.CONSOLIDATION_COMPANY_WRITE)
  async updateCompany(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateCompanyDto>,
    @Req() req: { user: AuthUser },
  ) {
    return this.companyService.updateCompany(
      req.user.tenantId!,
      id,
      dto,
      req.user,
    );
  }

  @Get("companies/hierarchy")
  @Permissions(PermissionsList.CONSOLIDATION_COMPANY_READ)
  async getCompanyHierarchy(@Req() req: { user: AuthUser }) {
    return this.companyService.getCompanyHierarchy(req.user.tenantId!);
  }

  @Get("companies/:id")
  @Permissions(PermissionsList.CONSOLIDATION_COMPANY_READ)
  async getCompanyById(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.companyService.getCompanyById(req.user.tenantId!, id);
  }

  @Post("companies/:companyId/permissions")
  @Permissions(PermissionsList.CONSOLIDATION_COMPANY_WRITE)
  async assignPermission(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Body("userId", ParseUUIDPipe) userId: string,
    @Body("roleId", ParseUUIDPipe) roleId: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.companyService.assignPermission(
      req.user.tenantId!,
      userId,
      companyId,
      roleId,
      req.user,
    );
  }

  @Delete("companies/:companyId/permissions")
  @Permissions(PermissionsList.CONSOLIDATION_COMPANY_WRITE)
  async revokePermission(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Body("userId", ParseUUIDPipe) userId: string,
    @Body("roleId", ParseUUIDPipe) roleId: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.companyService.revokePermission(
      req.user.tenantId!,
      userId,
      companyId,
      roleId,
      req.user,
    );
  }

  @Post("exchange-rates")
  @Permissions(PermissionsList.CONSOLIDATION_EXCHANGE_WRITE)
  async updateExchangeRate(
    @Body() dto: UpdateExchangeRateDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.exchangeRateService.updateExchangeRate(
      req.user.tenantId!,
      dto,
      req.user,
    );
  }

  @Post("intercompany")
  @Permissions(PermissionsList.CONSOLIDATION_INTERCOMPANY_WRITE)
  async createInterCompanyTransaction(
    @Body() dto: CreateInterCompanyDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.interCompanyService.createInterCompanyTransaction(
      req.user.tenantId!,
      dto,
      req.user,
    );
  }

  @Patch("intercompany/:id/settle")
  @Permissions(PermissionsList.CONSOLIDATION_INTERCOMPANY_WRITE)
  async settleTransaction(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.interCompanyService.settleTransaction(
      req.user.tenantId!,
      id,
      req.user,
    );
  }

  @Post("intercompany/auto-purchase")
  @Permissions(PermissionsList.CONSOLIDATION_INTERCOMPANY_WRITE)
  async triggerAutoInterCompanyPurchase(
    @Body("salesOrderId", ParseUUIDPipe) salesOrderId: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.interCompanyService.triggerAutoInterCompanyPurchase(
      req.user.tenantId!,
      salesOrderId,
      req.user,
    );
  }

  @Post("run")
  @Permissions(PermissionsList.CONSOLIDATION_RUN_WRITE)
  async runConsolidation(
    @Body() dto: RunConsolidationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.consolidationService.runConsolidation(
      req.user.tenantId!,
      dto,
      req.user,
    );
  }
}
