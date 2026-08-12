import { Module } from "@nestjs/common";
import { IntegrationPublicController } from "./controllers/integration-public.controller";
import { IntegrationDevController } from "./controllers/integration-dev.controller";
import { IntegrationWebhookController } from "./controllers/integration-webhook.controller";
import { IntegrationKeyService } from "./services/integration-key.service";
import { IntegrationWebhookService } from "./services/integration-webhook.service";
import { IntegrationProviderService } from "./services/integration-provider.service";
import { IntegrationAnalyticsService } from "./services/integration-analytics.service";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [
    IntegrationPublicController,
    IntegrationDevController,
    IntegrationWebhookController,
  ],
  providers: [
    IntegrationKeyService,
    IntegrationWebhookService,
    IntegrationProviderService,
    IntegrationAnalyticsService,
    AuditService,
  ],
  exports: [
    IntegrationKeyService,
    IntegrationWebhookService,
    IntegrationProviderService,
    IntegrationAnalyticsService,
  ],
})
export class IntegrationModule {}
