import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { IntegrationKeyService } from "../services/integration-key.service";
import { IntegrationProviderService } from "../services/integration-provider.service";
import { IntegrationAnalyticsService } from "../services/integration-analytics.service";
import { CreateApiKeyDto } from "../dto/create-api-key.dto";
import { RotateApiKeyDto } from "../dto/rotate-api-key.dto";
import { ConnectProviderDto } from "../dto/connect-provider.dto";

@Controller("integration")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IntegrationDevController {
  constructor(
    private readonly keyService: IntegrationKeyService,
    private readonly providerService: IntegrationProviderService,
    private readonly analyticsService: IntegrationAnalyticsService,
  ) {}

  @Post("keys")
  @Permissions("integration:key:write")
  async createKey(
    @Body() dto: CreateApiKeyDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.keyService.createKey(req.user.tenantId!, dto);
  }

  @Patch("keys/:id/rotate")
  @Permissions("integration:key:write")
  async rotateKey(
    @Param("id") id: string,
    @Body() dto: RotateApiKeyDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.keyService.rotateKey(req.user.tenantId!, id, dto);
  }

  @Delete("keys/:id")
  @Permissions("integration:key:write")
  async revokeKey(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.keyService.revokeKey(req.user.tenantId!, id);
  }

  @Get("keys")
  @Permissions("integration:key:read")
  async getKeys(@Req() req: { user: AuthUser }) {
    return this.keyService.getKeys(req.user.tenantId!);
  }

  @Post("providers/connect")
  @Permissions("integration:provider:write")
  async connectProvider(
    @Body() dto: ConnectProviderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.providerService.connectProvider(req.user.tenantId!, dto);
  }

  @Delete("providers/:provider/disconnect")
  @Permissions("integration:provider:write")
  async disconnectProvider(
    @Param("provider") provider: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.providerService.disconnectProvider(
      req.user.tenantId!,
      provider,
    );
  }

  @Get("providers/configs")
  @Permissions("integration:provider:read")
  async getConfigs(@Req() req: { user: AuthUser }) {
    return this.providerService.getConfigs(req.user.tenantId!);
  }

  @Get("analytics")
  @Permissions("integration:analytics:read")
  async getAnalytics(@Req() req: { user: AuthUser }) {
    return this.analyticsService.getAnalytics(req.user.tenantId!);
  }
}
