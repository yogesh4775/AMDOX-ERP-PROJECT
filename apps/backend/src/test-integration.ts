/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-console */
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module";
import { PrismaService } from "@amdox/database";
import * as crypto from "crypto";
import { IntegrationWebhookService } from "./modules/integration/services/integration-webhook.service";
import { IntegrationProviderService } from "./modules/integration/services/integration-provider.service";

const prisma = new PrismaService();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("Starting NestJS application for Integration E2E tests...");
  const app: INestApplication = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.setGlobalPrefix("api", { exclude: ["health"] });
  await app.listen(3090);

  const baseUrl = "http://localhost:3090/api";
  let token = "";

  // 1. Authenticate Admin
  console.log("Authenticating Admin...");
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(
    loginRes.status === 200 || loginRes.status === 201,
    "Admin login should succeed",
  );
  const loginData = (await loginRes.json()) as any;
  token = loginData.accessToken;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@amdox.com" },
  });
  assert(!!adminUser, "Admin user must exist");
  const tenantId = adminUser!.tenantId!;

  console.log("Cleaning up integration tables...");
  await prisma.integrationApiLog.deleteMany({ where: { tenantId } });
  await prisma.integrationWebhookDelivery.deleteMany({ where: { tenantId } });
  await prisma.integrationWebhookEndpoint.deleteMany({ where: { tenantId } });
  await prisma.integrationApiKey.deleteMany({ where: { tenantId } });
  await prisma.integrationConfig.deleteMany({ where: { tenantId } });

  // 2. API Key Generation
  console.log("Generating API Key...");
  const keyRes = await fetch(`${baseUrl}/integration/keys`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Test Partner Key",
      scopes: ["sales:read"],
      rateLimitTps: 5,
      dailyQuotaLimit: 100,
    }),
  });
  assert(keyRes.status === 201, "Should create API key");
  const keyData = (await keyRes.json()) as any;
  const rawKey = keyData.plainTextKey;
  const keyId = keyData.apiKey.id;
  assert(rawKey.startsWith("amdox_live_"), "Raw key must have prefix");

  // 3. API Key Rotation
  console.log("Rotating API Key...");
  const rotateRes = await fetch(`${baseUrl}/integration/keys/${keyId}/rotate`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: keyData.apiKey.version }),
  });
  assert(rotateRes.status === 200, "Key rotation should succeed");
  const rotatedData = (await rotateRes.json()) as any;
  const rotatedRawKey = rotatedData.plainTextKey;
  assert(rotatedRawKey !== rawKey, "Rotated key must be different");

  // 4. Public Gateway & Scope Validation
  console.log("Testing Public Gateway and Scope Validation...");

  // Lookup or create a mock customer for sales order creation
  let customer = await prisma.customer.findFirst({ where: { tenantId } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        tenantId,
        name: "Gateway Test Customer",
        email: "partner@gateway.com",
        status: "ACTIVE" as any,
      } as any,
    });
  }

  // Create a mock sales order to query
  const salesOrder = await prisma.salesOrder.create({
    data: {
      tenantId,
      customerId: customer.id,
      orderNumber: "SO-GW-TEST-" + Date.now(),
      status: "DRAFT" as any,
      expectedDeliveryDate: new Date(),
      totalAmount: 100.0,
      createdBy: adminUser!.id,
    },
  });

  // Call with valid key and valid scope
  const getOrdersRes = await fetch(`${baseUrl}/public/v1/sales/orders`, {
    headers: { "x-api-key": rotatedRawKey },
  });
  assert(getOrdersRes.status === 200, "Authorized query should succeed");
  const orders = (await getOrdersRes.json()) as any[];
  assert(orders.length > 0, "Query should return orders");

  // Call with unauthorized scope (payments:write)
  const stripeRes = await fetch(
    `${baseUrl}/public/v1/payments/stripe-checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": rotatedRawKey,
      },
      body: JSON.stringify({ amount: 150 }),
    },
  );
  assert(stripeRes.status === 403, "Missing scope must return 403 Forbidden");

  // 5. Rate Limiting (TPS) and Quota limits
  console.log("Testing Rate Limiting and Quota Limits...");
  // Key rateLimitTps is configured to 5. Let's make 7 simultaneous requests.
  const requests: Promise<Response>[] = [];
  for (let i = 0; i < 7; i++) {
    requests.push(
      fetch(`${baseUrl}/public/v1/sales/orders`, {
        headers: { "x-api-key": rotatedRawKey },
      }),
    );
  }
  const responses = await Promise.all(requests);
  const tooMany = responses.filter((r) => r.status === 429);
  assert(
    tooMany.length > 0,
    "Simultaneous bursts exceeding TPS limits must return 429 Too Many Requests",
  );

  // 6. Webhooks registration, Signature header, and Retry queue
  console.log("Testing Webhooks Framework...");

  // Register a mock receiver endpoint
  const webhookUrl = "http://mock-success/webhook";
  const registerRes = await fetch(`${baseUrl}/integration/webhooks`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: webhookUrl,
      events: ["sales.order.created"],
    }),
  });
  assert(registerRes.status === 201, "Webhook registration should succeed");
  const endpoint = (await registerRes.json()) as any;

  // Trigger outbound webhook event
  console.log("Simulating event queue delivery...");
  const triggerRes = await prisma.integrationWebhookDelivery.create({
    data: {
      tenantId,
      endpointId: endpoint.id,
      event: "sales.order.created",
      payload: { orderId: salesOrder.id, value: 100.0 },
      status: "PENDING",
    },
  });

  // Call webhook delivery logic
  const webhookServiceModule = app.get(IntegrationWebhookService);
  await webhookServiceModule.deliverWebhook(triggerRes.id, tenantId);

  // Assert successful dispatch
  const deliverySuccess = await prisma.integrationWebhookDelivery.findUnique({
    where: { id: triggerRes.id },
  });
  assert(
    deliverySuccess!.status === "SUCCESS",
    "Webhook delivery should succeed and update status",
  );
  assert(
    deliverySuccess!.responseStatusCode === 200,
    "Should record response code",
  );

  // 7. Dead-Letter Queue (DLQ) retry limit
  console.log("Testing Dead-Letter Queue (DLQ) retry backoff limits...");
  // Register a failing webhook url
  const failingWebhookUrl = "http://mock-fail/webhook";
  const failingRegisterRes = await fetch(`${baseUrl}/integration/webhooks`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: failingWebhookUrl,
      events: ["sales.order.created"],
    }),
  });
  const failingEndpoint = (await failingRegisterRes.json()) as any;

  const failingDelivery = await prisma.integrationWebhookDelivery.create({
    data: {
      tenantId,
      endpointId: failingEndpoint.id,
      event: "sales.order.created",
      payload: { orderId: salesOrder.id },
      status: "PENDING",
    },
  });

  // Execute delivery until it enters DLQ (failures = 5)
  for (let i = 0; i < 5; i++) {
    await webhookServiceModule.deliverWebhook(failingDelivery.id, tenantId);
  }

  const deliveryDlq = await prisma.integrationWebhookDelivery.findUnique({
    where: { id: failingDelivery.id },
  });
  assert(
    deliveryDlq!.status === "DLQ",
    "Failed delivery exceeding 5 attempts must move to DLQ",
  );

  // Verify DLQ alert notification created
  const dlqAlerts = await prisma.notification.findMany({
    where: { tenantId, title: { contains: "DLQ" } },
  });
  assert(
    dlqAlerts.length > 0,
    "DLQ transitions must generate warning notifications",
  );

  // Verify manual retry reset DLQ
  console.log("Testing Manual DLQ retry endpoint...");
  const manualRetryRes = await fetch(
    `${baseUrl}/integration/webhooks/deliveries/${deliveryDlq!.id}/retry`,
    {
      method: "POST",
      headers,
    },
  );
  assert(
    manualRetryRes.status === 201,
    "Manual retry of DLQ should return 201",
  );
  const retriedDelivery = (await manualRetryRes.json()) as any;
  assert(
    retriedDelivery.status === "PENDING" && retriedDelivery.retryCount === 0,
    "Manual retry must reset statuses to PENDING/0",
  );

  // 8. Stripe Webhook checkout capture
  console.log("Testing Stripe Checkout Webhook Integration...");

  // Seed a payment in the database
  let payment = await prisma.payment.findFirst({
    where: { tenantId, amount: 250.0 },
  });
  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        tenantId,
        type: "RECEIPT",
        method: "CREDIT_CARD",
        paymentNumber: "PAY-GW-" + Date.now(),
        amount: 250.0,
        status: "DRAFT",
        paymentDate: new Date(),
        createdBy: adminUser!.id,
      },
    });
  }

  // Create payments:write key for gateway call
  const stripeKeyData = await prisma.integrationApiKey.create({
    data: {
      tenantId,
      name: "Stripe Gateway Key",
      keyPrefix: "amdox_live_",
      hashedKey: crypto
        .createHash("sha256")
        .update("amdox_live_stripe_secret")
        .digest("hex"),
      scopes: ["payments:write"],
    },
  });

  const stripeCheckoutRes = await fetch(
    `${baseUrl}/public/v1/payments/stripe-checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "amdox_live_stripe_secret",
      },
      body: JSON.stringify({ paymentId: payment.id, amount: 250.0 }),
    },
  );
  assert(
    stripeCheckoutRes.status === 200,
    "Stripe capture endpoint should return 200",
  );
  const paymentUpdated = await prisma.payment.findUnique({
    where: { id: payment.id },
  });
  assert(
    paymentUpdated!.status === "POSTED",
    "Capture Checkout must update payment status to POSTED",
  );

  // 9. Twilio & SendGrid connector configs
  console.log("Testing Provider connections Twilio/SendGrid...");
  const connectRes = await fetch(`${baseUrl}/integration/providers/connect`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider: "TWILIO",
      credentials: { accountSid: "AC123", authToken: "secret_token" },
    }),
  });
  assert(connectRes.status === 201, "Should connect provider successfully");

  const providerServiceModule = app.get(IntegrationProviderService);
  const smsResult = await providerServiceModule.sendTwilioSms(
    tenantId,
    "+123456789",
    "Test Message",
  );
  assert(
    smsResult.success === true && !!smsResult.messageId,
    "Mock Twilio send should succeed",
  );

  // 10. Audit Logging
  console.log("Verifying Audit logs...");
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      action: {
        in: [
          "API_KEY_CREATED",
          "API_KEY_ROTATED",
          "API_KEY_REVOKED",
          "WEBHOOK_REGISTERED",
          "WEBHOOK_DELIVERED",
          "WEBHOOK_FAILED",
          "WEBHOOK_DLQ",
          "PROVIDER_CONNECTED",
          "PROVIDER_DISCONNECTED",
        ],
      },
    },
  });
  assert(
    auditLogs.length >= 4,
    "Gateway operations must be saved in Audit logs",
  );

  // 11. Health Endpoint check
  console.log("Verifying Health Endpoint...");
  const healthRes = await fetch("http://localhost:3090/health");
  assert(healthRes.status === 200, "Health endpoint should return 200");

  // Cleanup E2E seeded data
  console.log("Cleaning up E2E seeded data...");
  await prisma.integrationApiLog.deleteMany({ where: { tenantId } });
  await prisma.integrationWebhookDelivery.deleteMany({ where: { tenantId } });
  await prisma.integrationWebhookEndpoint.deleteMany({ where: { tenantId } });
  await prisma.integrationApiKey.deleteMany({ where: { tenantId } });
  await prisma.integrationConfig.deleteMany({ where: { tenantId } });

  await prisma.salesOrder.deleteMany({
    where: { tenantId, orderNumber: { startsWith: "SO-GW-TEST-" } },
  });
  await prisma.customer.deleteMany({
    where: { tenantId, email: "partner@gateway.com" },
  });
  await prisma.payment.deleteMany({ where: { tenantId, amount: 250.0 } });
  await prisma.notification.deleteMany({
    where: { tenantId, title: { contains: "Webhook" } },
  });
  await prisma.auditLog.deleteMany({
    where: {
      tenantId,
      action: {
        in: [
          "API_KEY_CREATED",
          "API_KEY_ROTATED",
          "API_KEY_REVOKED",
          "WEBHOOK_REGISTERED",
          "WEBHOOK_DELIVERED",
          "WEBHOOK_FAILED",
          "WEBHOOK_DLQ",
          "PROVIDER_CONNECTED",
          "PROVIDER_DISCONNECTED",
        ],
      },
    },
  });

  console.log(
    "All Phase 47 Integration E2E integration tests completed successfully!",
  );
  await app.close();
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
