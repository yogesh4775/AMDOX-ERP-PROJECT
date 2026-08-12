import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { AiRecommendationService } from "../services/ai-recommendation.service";
import { AiAnomalyService } from "../services/ai-anomaly.service";
import { ApplyRecommendationDto } from "../dto/recommendation.dto";
import { ResolveAnomalyDto } from "../dto/anomaly.dto";

@Controller("ai/insights")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiInsightController {
  constructor(
    private readonly recommendationService: AiRecommendationService,
    private readonly anomalyService: AiAnomalyService,
  ) {}

  @Get("recommendations")
  @Permissions("ai:insight:read")
  async getRecommendations(@Req() req: { user: AuthUser }) {
    return this.recommendationService.getRecommendations(req.user.tenantId!);
  }

  @Post("recommendations/:id/apply")
  @Permissions("ai:insight:write")
  async applyRecommendation(
    @Param("id") id: string,
    @Body() dto: ApplyRecommendationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.recommendationService.applyRecommendation(
      req.user.tenantId!,
      id,
      dto,
      req.user,
    );
  }

  @Get("anomalies")
  @Permissions("ai:insight:read")
  async getAnomalies(@Req() req: { user: AuthUser }) {
    return this.anomalyService.getAnomalies(req.user.tenantId!);
  }

  @Patch("anomalies/:id/resolve")
  @Permissions("ai:insight:write")
  async resolveAnomaly(
    @Param("id") id: string,
    @Body() dto: ResolveAnomalyDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.anomalyService.resolveAnomaly(
      req.user.tenantId!,
      id,
      dto,
      req.user,
    );
  }
}
