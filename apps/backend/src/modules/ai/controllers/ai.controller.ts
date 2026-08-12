/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { AiFeatureStoreService } from "../services/ai-feature-store.service";
import { AiTrainingService } from "../services/ai-training.service";
import { AiPredictionService } from "../services/ai-prediction.service";
import { TrainModelDto } from "../dto/train-model.dto";
import { PredictDto } from "../dto/predict.dto";

@Controller("ai")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiController {
  constructor(
    private readonly featureStoreService: AiFeatureStoreService,
    private readonly trainingService: AiTrainingService,
    private readonly predictionService: AiPredictionService,
  ) {}

  @Get("dashboards/predictive")
  @Permissions("ai:insight:read")
  async getPredictiveDashboard(@Req() req: { user: AuthUser }) {
    const tenantId = req.user.tenantId!;
    return {
      salesForecastScore: 84000.0,
      inventoryStockOnHandPrediction: 1200,
      workforceAttritionProbability: 0.12,
      securityAnomalyAlertsCount: 0,
      slaBreachRiskRate: 0.05,
    };
  }

  @Post("feature-store/sync")
  @Permissions("ai:model:write")
  async syncFeatures(@Req() req: { user: AuthUser }) {
    return this.featureStoreService.syncFeatures(req.user.tenantId!, req.user);
  }

  @Post("models/train")
  @Permissions("ai:model:write")
  async startTraining(
    @Body() dto: TrainModelDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.trainingService.startTrainingJob(dto, req.user);
  }

  @Get("models/jobs")
  @Permissions("ai:model:read")
  async getTrainingJobs(@Req() req: { user: AuthUser }) {
    return this.trainingService.getTrainingJobs(req.user.tenantId!);
  }

  @Get("models/registry")
  @Permissions("ai:model:read")
  async getModelRegistry(@Req() req: { user: AuthUser }) {
    return this.trainingService.getModelRegistry(req.user.tenantId!);
  }

  @Patch("models/registry/:id/promote")
  @Permissions("ai:model:write")
  async promoteModel(
    @Param("id") id: string,
    @Body("status") status: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.trainingService.promoteModel(
      req.user.tenantId!,
      id,
      status,
      req.user,
    );
  }

  @Post("predictions/evaluate")
  @Permissions("ai:prediction:read")
  async evaluatePrediction(
    @Body() dto: PredictDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.predictionService.predict(dto, req.user);
  }

  @Get("predictions/history")
  @Permissions("ai:prediction:read")
  async getPredictionHistory(@Req() req: { user: AuthUser }) {
    return this.predictionService.getPredictionHistory(req.user.tenantId!);
  }
}
