import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { BiService } from "../services/bi.service";
import { BiForecastingService } from "../services/bi-forecasting.service";
import { EtlSyncDto } from "../dto/etl-sync.dto";
import { ForecastQueryDto } from "../dto/forecast.dto";

@Controller("bi")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BiController {
  constructor(
    private readonly biService: BiService,
    private readonly biForecastingService: BiForecastingService,
  ) {}

  @Get("dashboards/executive")
  @Permissions("bi:dashboard:read")
  async getExecutiveDashboard(@Req() req: { user: AuthUser }) {
    return this.biService.getExecutiveDashboard(req.user);
  }

  @Get("variance")
  @Permissions("bi:dashboard:read")
  async getVarianceAnalysis(@Req() req: { user: AuthUser }) {
    return this.biService.getVarianceAnalysis(req.user);
  }

  @Get("kpis")
  @Permissions("bi:kpi:read")
  async getKpis(@Req() req: { user: AuthUser }) {
    return this.biService.getKpis(req.user);
  }

  @Post("kpis/evaluate")
  @Permissions("bi:kpi:write")
  async evaluateKpis(@Body() dto: EtlSyncDto, @Req() req: { user: AuthUser }) {
    return this.biService.evaluateKpis(dto, req.user);
  }

  @Get("forecasts")
  @Permissions("bi:dashboard:read")
  async getForecasts(
    @Query() dto: ForecastQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.biForecastingService.generateForecast(dto, req.user);
  }

  @Post("etl/sync")
  @Permissions("bi:kpi:write")
  async runEtlSync(@Body() dto: EtlSyncDto, @Req() req: { user: AuthUser }) {
    return this.biService.runEtlSync(dto, req.user);
  }
}
