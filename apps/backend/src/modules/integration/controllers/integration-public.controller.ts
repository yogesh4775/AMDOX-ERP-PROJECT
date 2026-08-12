/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { PublicApiKeyGuard } from "../guards/public-api-key.guard";
import { IntegrationAnalyticsService } from "../services/integration-analytics.service";
import { IntegrationProviderService } from "../services/integration-provider.service";
import { PrismaService } from "@amdox/database";

@Controller("public/v1")
@UseGuards(PublicApiKeyGuard)
export class IntegrationPublicController {
  constructor(
    private readonly analyticsService: IntegrationAnalyticsService,
    private readonly providerService: IntegrationProviderService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("sales/orders")
  async getSalesOrders(@Req() req: any) {
    const startTime = Date.now();
    const apiKey = req.apiKey;
    const tenantId = apiKey.tenantId;

    const scopes = (apiKey.scopes as string[]) || [];
    if (!scopes.includes("sales:read") && !scopes.includes("*")) {
      await this.analyticsService.logApiRequest(
        tenantId,
        apiKey.id,
        "GET",
        "/public/v1/sales/orders",
        HttpStatus.FORBIDDEN,
        Date.now() - startTime,
        req.ip,
      );
      throw new ForbiddenException("Missing required scope: sales:read");
    }

    const orders = await this.prisma.salesOrder.findMany({
      where: { tenantId },
      take: 10,
    });

    await this.analyticsService.logApiRequest(
      tenantId,
      apiKey.id,
      "GET",
      "/public/v1/sales/orders",
      HttpStatus.OK,
      Date.now() - startTime,
      req.ip,
    );

    return orders;
  }

  @Post("payments/stripe-checkout")
  @HttpCode(HttpStatus.OK)
  async processStripeCheckout(@Body() body: any, @Req() req: any) {
    const startTime = Date.now();
    const apiKey = req.apiKey;
    const tenantId = apiKey.tenantId;

    const scopes = (apiKey.scopes as string[]) || [];
    if (!scopes.includes("payments:write") && !scopes.includes("*")) {
      await this.analyticsService.logApiRequest(
        tenantId,
        apiKey.id,
        "POST",
        "/public/v1/payments/stripe-checkout",
        HttpStatus.FORBIDDEN,
        Date.now() - startTime,
        req.ip,
      );
      throw new ForbiddenException("Missing required scope: payments:write");
    }

    const result = await this.providerService.triggerStripeCheckout(
      tenantId,
      body,
    );

    await this.analyticsService.logApiRequest(
      tenantId,
      apiKey.id,
      "POST",
      "/public/v1/payments/stripe-checkout",
      HttpStatus.OK,
      Date.now() - startTime,
      req.ip,
    );

    return result;
  }
}
