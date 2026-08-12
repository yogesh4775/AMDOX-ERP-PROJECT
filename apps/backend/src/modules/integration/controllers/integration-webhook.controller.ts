import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { IntegrationWebhookService } from "../services/integration-webhook.service";
import { CreateWebhookDto } from "../dto/create-webhook.dto";

@Controller("integration/webhooks")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IntegrationWebhookController {
  constructor(private readonly webhookService: IntegrationWebhookService) {}

  @Post()
  @Permissions("integration:webhook:write")
  async registerWebhook(
    @Body() dto: CreateWebhookDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.webhookService.registerWebhook(req.user.tenantId!, dto);
  }

  @Get()
  @Permissions("integration:webhook:read")
  async getWebhooks(@Req() req: { user: AuthUser }) {
    return this.webhookService.getWebhooks(req.user.tenantId!);
  }

  @Get("deliveries")
  @Permissions("integration:webhook:read")
  async getDeliveries(@Req() req: { user: AuthUser }) {
    return this.webhookService.getDeliveries(req.user.tenantId!);
  }

  @Post("deliveries/:id/retry")
  @Permissions("integration:webhook:write")
  async retryWebhook(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.webhookService.retryDlq(req.user.tenantId!, id);
  }
}
