import { Module } from "@nestjs/common";
import { AiController } from "./controllers/ai.controller";
import { AiInsightController } from "./controllers/ai-insight.controller";
import { AiFeatureStoreService } from "./services/ai-feature-store.service";
import { AiTrainingService } from "./services/ai-training.service";
import { AiPredictionService } from "./services/ai-prediction.service";
import { AiRecommendationService } from "./services/ai-recommendation.service";
import { AiAnomalyService } from "./services/ai-anomaly.service";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [AiController, AiInsightController],
  providers: [
    AiFeatureStoreService,
    AiTrainingService,
    AiPredictionService,
    AiRecommendationService,
    AiAnomalyService,
    AuditService,
  ],
  exports: [
    AiFeatureStoreService,
    AiTrainingService,
    AiPredictionService,
    AiRecommendationService,
    AiAnomalyService,
  ],
})
export class AiModule {}
