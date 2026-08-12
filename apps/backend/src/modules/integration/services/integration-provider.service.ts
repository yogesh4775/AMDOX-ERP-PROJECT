/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-console */
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { ConnectProviderDto } from "../dto/connect-provider.dto";

@Injectable()
export class IntegrationProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async connectProvider(tenantId: string, dto: ConnectProviderDto) {
    const config = await this.prisma.integrationConfig.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider: dto.provider,
        },
      },
      update: {
        credentials: dto.credentials,
        isActive: true,
      },
      create: {
        tenantId,
        provider: dto.provider,
        credentials: dto.credentials,
        isActive: true,
      },
    });

    // Log Provider Connected Audit Event
    await this.auditService.log({
      action: "PROVIDER_CONNECTED",
      entity: "IntegrationConfig",
      entityId: config.id,
      newValues: { provider: dto.provider },
    });

    return config;
  }

  async disconnectProvider(tenantId: string, provider: string) {
    const config = await this.prisma.integrationConfig.findFirst({
      where: { tenantId, provider },
    });

    if (!config) {
      throw new NotFoundException(
        `Provider integration config ${provider} not found.`,
      );
    }

    const updated = await this.prisma.integrationConfig.update({
      where: { id: config.id },
      data: {
        isActive: false,
      },
    });

    // Log Provider Disconnected Audit Event
    await this.auditService.log({
      action: "PROVIDER_DISCONNECTED",
      entity: "IntegrationConfig",
      entityId: config.id,
      newValues: { provider },
    });

    return updated;
  }

  async getConfigs(tenantId: string) {
    return this.prisma.integrationConfig.findMany({
      where: { tenantId },
    });
  }

  // Stripe payments capture trigger (Simulation)
  async triggerStripeCheckout(
    tenantId: string,
    paymentDetails: Record<string, any>,
  ) {
    console.log("Simulating Stripe Checkout Webhook processing...");
    // Update linked payments, ledger balances, and dispatch order updates:
    const paymentId = paymentDetails.paymentId;
    if (paymentId) {
      const payment = await this.prisma.payment.findFirst({
        where: { id: paymentId, tenantId },
      });
      if (payment) {
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { status: "POSTED" as any },
        });
      }
    }

    // Trigger internal admin notifications on Stripe events
    const admins = await this.prisma.user.findMany({
      where: { tenantId, userRoles: { some: { role: { name: "Admin" } } } },
    });
    for (const admin of admins) {
      await this.notificationsService.createInternal({
        userId: admin.id,
        tenantId,
        title: "Stripe Checkout Succeeded",
        message: `Stripe charge capturing completed for amount: $${paymentDetails.amount}`,
        type: "INFO" as any,
      });
    }

    return { success: true };
  }

  // Twilio outbound messaging trigger (Simulation)
  async sendTwilioSms(tenantId: string, to: string, message: string) {
    console.log(`SimulatingTwilio SMS dispatch to ${to}: ${message}`);
    // Check credentials expiry or connection state:
    const conf = await this.prisma.integrationConfig.findFirst({
      where: { tenantId, provider: "TWILIO", isActive: true },
    });
    if (!conf) {
      throw new NotFoundException(
        "Twilio integration is not configured or deactivated.",
      );
    }
    return {
      success: true,
      messageId: "twilio_msg_sid_" + Math.random().toString(36).substr(2, 9),
    };
  }

  // SendGrid outbound mail dispatcher (Simulation)
  async sendSendGridEmail(
    tenantId: string,
    to: string,
    subject: string,
    body: string,
  ) {
    console.log(`Simulating SendGrid Email dispatch to ${to}: ${subject}`);
    const conf = await this.prisma.integrationConfig.findFirst({
      where: { tenantId, provider: "SENDGRID", isActive: true },
    });
    if (!conf) {
      throw new NotFoundException(
        "SendGrid integration is not configured or deactivated.",
      );
    }
    return {
      success: true,
      emailId: "sg_mail_id_" + Math.random().toString(36).substr(2, 9),
    };
  }
}
