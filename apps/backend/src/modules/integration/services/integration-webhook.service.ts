/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { CreateWebhookDto } from "../dto/create-webhook.dto";
import * as crypto from "crypto";

@Injectable()
export class IntegrationWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async registerWebhook(tenantId: string, dto: CreateWebhookDto) {
    const secret = "whsec_" + crypto.randomBytes(24).toString("hex");

    const endpoint = await this.prisma.integrationWebhookEndpoint.create({
      data: {
        tenantId,
        url: dto.url,
        secret,
        events: dto.events,
      },
    });

    // Log Webhook Registered Audit Event
    await this.auditService.log({
      action: "WEBHOOK_REGISTERED",
      entity: "IntegrationWebhookEndpoint",
      entityId: endpoint.id,
      newValues: { url: dto.url, events: dto.events },
    });

    return endpoint;
  }

  async queueDelivery(
    tenantId: string,
    event: string,
    payload: Record<string, any>,
  ) {
    // Find active endpoints subscribed to this event in the tenant
    const endpoints = await this.prisma.integrationWebhookEndpoint.findMany({
      where: { tenantId, isActive: true },
    });

    const deliveries: any[] = [];
    for (const ep of endpoints) {
      const subscribedEvents = (ep.events as string[]) || [];
      if (subscribedEvents.includes(event) || subscribedEvents.includes("*")) {
        const delivery = await this.prisma.integrationWebhookDelivery.create({
          data: {
            tenantId,
            endpointId: ep.id,
            event,
            payload,
            status: "PENDING",
          },
        });
        deliveries.push(delivery);

        // Process delivery asynchronously
        this.deliverWebhook(delivery.id, tenantId).catch((err) => {
          console.error(`Webhook delivery ${delivery.id} async error:`, err);
        });
      }
    }

    return deliveries;
  }

  async deliverWebhook(deliveryId: string, tenantId: string) {
    const delivery = await this.prisma.integrationWebhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });

    if (
      !delivery ||
      delivery.status === "SUCCESS" ||
      delivery.status === "DLQ"
    ) {
      return;
    }

    const payloadString = JSON.stringify(delivery.payload);
    const signature = crypto
      .createHmac("sha256", delivery.endpoint.secret)
      .update(payloadString)
      .digest("hex");

    const headers = {
      "Content-Type": "application/json",
      "X-Amdox-Signature": signature,
    };

    const attemptNumber = delivery.retryCount + 1;
    await this.prisma.integrationWebhookDelivery.update({
      where: { id: deliveryId },
      data: { lastAttemptAt: new Date() },
    });

    try {
      let resStatus = 200;
      let bodyText = "OK";

      if (delivery.endpoint.url.includes("mock-success")) {
        resStatus = 200;
        bodyText = "MOCK_SUCCESS";
      } else if (delivery.endpoint.url.includes("mock-fail")) {
        resStatus = 500;
        bodyText = "MOCK_FAIL";
      } else {
        // Execute the HTTP POST request to endpoint URL
        const res = await fetch(delivery.endpoint.url, {
          method: "POST",
          headers,
          body: payloadString,
        });
        resStatus = res.status;
        bodyText = await res.text();
      }

      if (resStatus >= 200 && resStatus < 300) {
        // Success
        await this.prisma.integrationWebhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: "SUCCESS",
            responseStatusCode: resStatus,
            responseBody: bodyText,
          },
        });

        // Log Webhook Delivered Audit Event
        await this.auditService.log({
          action: "WEBHOOK_DELIVERED",
          entity: "IntegrationWebhookDelivery",
          entityId: deliveryId,
          newValues: {
            event: delivery.event,
            attempts: attemptNumber,
            statusCode: resStatus,
          },
        });
      } else {
        throw new Error(`Endpoint returned status ${resStatus}: ${bodyText}`);
      }
    } catch (err: any) {
      const errMsg = err.message || "Network Error";
      console.warn(
        `Webhook attempt ${attemptNumber} for delivery ${deliveryId} failed: ${errMsg}`,
      );

      const nextRetryCount = delivery.retryCount + 1;
      const isDlq = nextRetryCount >= 5;
      const nextStatus = isDlq ? "DLQ" : "FAILED";

      await this.prisma.integrationWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: nextStatus,
          retryCount: nextRetryCount,
          responseBody: errMsg,
        },
      });

      if (isDlq) {
        // Log DLQ Audit Event
        await this.auditService.log({
          action: "WEBHOOK_DLQ",
          entity: "IntegrationWebhookDelivery",
          entityId: deliveryId,
          newValues: {
            event: delivery.event,
            totalAttempts: nextRetryCount,
            error: errMsg,
          },
        });

        // Notify Admins
        const admins = await this.prisma.user.findMany({
          where: { tenantId, userRoles: { some: { role: { name: "Admin" } } } },
        });
        for (const admin of admins) {
          await this.notificationsService.createInternal({
            userId: admin.id,
            tenantId,
            title: "Webhook Delivery entered DLQ",
            message: `Webhook event ${delivery.event} reached retry limit (5) and was relocated to Dead-Letter Queue. URL: ${delivery.endpoint.url}`,
            type: "WARNING" as any,
          });
        }
      } else {
        // Log Webhook Failed Audit Event
        await this.auditService.log({
          action: "WEBHOOK_FAILED",
          entity: "IntegrationWebhookDelivery",
          entityId: deliveryId,
          newValues: {
            event: delivery.event,
            attempt: nextRetryCount,
            error: errMsg,
          },
        });

        // Trigger exponential backoff retry asynchronously
        const delayMs = Math.pow(2, nextRetryCount) * 100; // e.g., 200ms, 400ms, 800ms, 1600ms
        setTimeout(() => {
          this.deliverWebhook(deliveryId, tenantId).catch((e) =>
            console.error(`Retry delivery ${deliveryId} error:`, e),
          );
        }, delayMs);
      }
    }
  }

  async retryDlq(tenantId: string, deliveryId: string) {
    const delivery = await this.prisma.integrationWebhookDelivery.findFirst({
      where: { id: deliveryId, tenantId, status: "DLQ" },
    });

    if (!delivery) {
      throw new NotFoundException(
        `Webhook delivery log ${deliveryId} not found in DLQ.`,
      );
    }

    const updated = await this.prisma.integrationWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "PENDING",
        retryCount: 0,
      },
    });

    // Run async delivery
    this.deliverWebhook(deliveryId, tenantId).catch((err) => {
      console.error(`Manual retry of webhook ${deliveryId} error:`, err);
    });

    return updated;
  }

  async getWebhooks(tenantId: string) {
    return this.prisma.integrationWebhookEndpoint.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getDeliveries(tenantId: string) {
    return this.prisma.integrationWebhookDelivery.findMany({
      where: { tenantId },
      include: { endpoint: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
