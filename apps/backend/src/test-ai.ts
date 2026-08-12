/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-console */
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module";
import { PrismaService } from "@amdox/database";

const prisma = new PrismaService();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("Starting NestJS application for AI E2E tests...");
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
  await app.listen(3070);

  const baseUrl = "http://localhost:3070/api";
  let token = "";

  // 1. Authenticate Admin
  console.log("Authenticating Admin User...");
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

  console.log("Cleaning up AI tables...");
  await prisma.aiAnomalyEvent.deleteMany({ where: { tenantId } });
  await prisma.aiRecommendation.deleteMany({ where: { tenantId } });
  await prisma.aiPredictionHistory.deleteMany({ where: { tenantId } });
  await prisma.aiModelRegistry.deleteMany({ where: { tenantId } });
  await prisma.aiTrainingJob.deleteMany({ where: { tenantId } });
  await prisma.aiFeatureStore.deleteMany({ where: { tenantId } });

  // 2. Seed conformed dimensions/facts in BI tables to serve as features
  console.log("Seeding conformed dimensions and facts...");
  let category = await prisma.category.findFirst({
    where: { tenantId, name: "AI Test Category" },
  });
  if (!category) {
    category = await prisma.category.create({
      data: { tenantId, name: "AI Test Category" },
    });
  }

  let unit = await prisma.unit.findFirst({
    where: { tenantId, symbol: "AI" },
  });
  if (!unit) {
    unit = await prisma.unit.create({
      data: { tenantId, name: "AI Unit", symbol: "AI" },
    });
  }

  let product = await prisma.product.findFirst({
    where: { tenantId, sku: "SKU-AI-TEST" },
  });
  if (product) {
    await prisma.product.delete({ where: { id: product.id } });
  }
  product = await prisma.product.create({
    data: {
      tenantId,
      sku: "SKU-AI-TEST",
      name: "AI Test Product",
      categoryId: category.id,
      unitId: unit.id,
      costPrice: 80.0,
      salePrice: 120.0,
      status: "ACTIVE",
    },
  });

  // Seed BI dimension product (Simulating DWH sync)
  await prisma.biDimensionProduct.upsert({
    where: { tenantId_id: { tenantId, id: product.id } },
    update: { sku: "SKU-AI-TEST", name: "AI Test Product" },
    create: {
      id: product.id,
      tenantId,
      sku: "SKU-AI-TEST",
      name: "AI Test Product",
      costPrice: 80.0,
      salePrice: 120.0,
    },
  });

  // Seed customer dimension
  const customerId = "a0a0a0a0-b0b0-c0c0-d0d0-e0e0e0e0e0e0";
  await prisma.biDimensionCustomer.upsert({
    where: { tenantId_id: { tenantId, id: customerId } },
    update: { name: "AI Corp" },
    create: { id: customerId, tenantId, name: "AI Corp", email: "corp@ai.com" },
  });

  // Seed BI facts: Sales, Quality, CSAT
  await prisma.biFactSales.create({
    data: {
      tenantId,
      customerId,
      productId: product.id,
      quantity: 5,
      orderValue: 600.0,
      costValue: 400.0,
      grossMargin: 200.0,
      orderDate: new Date(),
    },
  });

  await prisma.biFactQuality.create({
    data: {
      tenantId,
      productId: product.id,
      lotQuantity: 100,
      sampleSize: 10,
      acceptedQuantity: 9,
      rejectedQuantity: 1,
      defectCount: 1,
      ncCount: 0,
      passRate: 0.9,
      inspectionDate: new Date(),
    },
  });

  await prisma.biFactCustomerService.create({
    data: {
      tenantId,
      customerId,
      productId: product.id,
      ticketCount: 1,
      resolvedCount: 1,
      slaBreachedCount: 0,
      csatRating: 5.0,
      logDate: new Date(),
    },
  });

  // 3. Feature Store sync execution
  console.log("Executing Feature Store Sync...");
  const syncRes = await fetch(`${baseUrl}/ai/feature-store/sync`, {
    method: "POST",
    headers,
  });
  assert(syncRes.status === 201, "Sync features should trigger successfully");
  const syncResult = (await syncRes.json()) as any;
  assert(syncResult.success === true, "Feature store sync success return true");

  const productFeatures = await prisma.aiFeatureStore.findFirst({
    where: { tenantId, entityType: "PRODUCT", entityId: product.id },
  });
  assert(!!productFeatures, "Features must be persisted to the database");
  const feats = productFeatures!.features as any;
  assert(
    feats.avgPassRate === 0.9,
    "Synced features must match aggregate metrics",
  );

  // 4. Model Training Jobs
  console.log("Triggering async Model Training...");
  const trainRes = await fetch(`${baseUrl}/ai/models/train`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      modelName: "demand_forecast",
      hyperparameters: { epochs: 15, learningRate: 0.05 },
    }),
  });
  assert(trainRes.status === 201, "Training should trigger successfully");
  const job = (await trainRes.json()) as any;
  assert(
    job.status === "PENDING" || job.status === "RUNNING",
    "Job state should initiate as PENDING/RUNNING",
  );

  // Poll for completion
  console.log("Polling training job completion...");
  let jobCompleted = false;
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const jobRes = await fetch(`${baseUrl}/ai/models/jobs`, { headers });
    const jobs = (await jobRes.json()) as any[];
    const currentJob = jobs.find((j) => j.id === job.id);
    if (currentJob && currentJob.status === "COMPLETED") {
      jobCompleted = true;
      break;
    }
  }
  assert(jobCompleted, "Asynchronous training job must complete successfully");

  // Verify Model Registry
  const registry = await prisma.aiModelRegistry.findFirst({
    where: { tenantId, name: "demand_forecast" },
  });
  assert(!!registry, "Model should be saved in registry");
  assert(
    registry!.status === "STAGING",
    "Model version starts in STAGING status",
  );

  // 5. Model Promotion
  console.log("Promoting model to ACTIVE...");
  const promoteRes = await fetch(
    `${baseUrl}/ai/models/registry/${registry!.id}/promote`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "ACTIVE" }),
    },
  );
  assert(promoteRes.status === 200, "Promotion endpoint should return 200");
  const promoted = (await promoteRes.json()) as any;
  assert(promoted.status === "ACTIVE", "Status must promote to ACTIVE");

  // 6. Inferences / Predictions
  console.log("Evaluating demand forecast prediction...");
  const predRes = await fetch(`${baseUrl}/ai/predictions/evaluate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      modelName: "demand_forecast",
      inputData: { periods: 5 },
    }),
  });
  assert(predRes.status === 201, "Prediction request should succeed");
  const predResult = (await predRes.json()) as any;
  assert(predResult.predictedValue !== null, "Prediction must yield value");
  // Check Explainability Attributions (XAI)
  assert(
    predResult.contributions !== undefined,
    "Explainable AI contributions mapping must be present",
  );
  assert(
    predResult.contributions.slope_coefficient > 0,
    "Attr contributions should specify weights",
  );

  // Verify Prediction history logs
  const predHist = await prisma.aiPredictionHistory.findFirst({
    where: { tenantId, modelName: "demand_forecast" },
  });
  assert(!!predHist, "Prediction history record must be persisted");

  // 7. Anomaly Detection evaluation
  // Register anomaly model first
  console.log("Testing Anomaly detection pipeline...");
  const trainAnomalyRes = await fetch(`${baseUrl}/ai/models/train`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      modelName: "security_failed_logins_anomaly",
      hyperparameters: { threshold: 3 },
    }),
  });
  const anomalyJob = (await trainAnomalyRes.json()) as any;
  // Wait to complete
  await new Promise((resolve) => setTimeout(resolve, 150));
  const anomalyModel = await prisma.aiModelRegistry.findFirst({
    where: { tenantId, name: "security_failed_logins_anomaly" },
  });
  assert(!!anomalyModel, "Anomaly model must be registered");
  // Promote to active
  await fetch(`${baseUrl}/ai/models/registry/${anomalyModel!.id}/promote`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "ACTIVE" }),
  });

  // Evaluate normal prediction
  const predNormal = await fetch(`${baseUrl}/ai/predictions/evaluate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      modelName: "security_failed_logins_anomaly",
      inputData: { failedLogins: 1 },
    }),
  });
  const normalRes = (await predNormal.json()) as any;
  assert(
    normalRes.isAnomaly === false,
    "Input within threshold must NOT flag anomaly",
  );

  // Evaluate breaching prediction (Failed logins = 5, limit = 3)
  const predBreached = await fetch(`${baseUrl}/ai/predictions/evaluate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      modelName: "security_failed_logins_anomaly",
      inputData: { failedLogins: 5 },
    }),
  });
  const breachedResult = (await predBreached.json()) as any;
  assert(
    breachedResult.isAnomaly === true,
    "Input breaching threshold must flag anomaly",
  );

  // Verify Anomaly warning notification generated
  const breaches = await prisma.notification.findMany({
    where: { tenantId, title: { contains: "Anomaly" } },
  });
  assert(
    breaches.length > 0,
    "Anomaly triggers should fire warning notifications",
  );

  // Verify Anomaly Event generated
  const anomalyEv = await prisma.aiAnomalyEvent.findFirst({
    where: { tenantId, source: "security_failed_logins_anomaly" },
  });
  assert(!!anomalyEv, "Anomaly events table must log a record");

  // Resolve Anomaly event (Optimistic Concurrency verification)
  console.log("Resolving Anomaly with optimistic concurrency...");
  const resolveRes = await fetch(
    `${baseUrl}/ai/insights/anomalies/${anomalyEv!.id}/resolve`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ expectedVersion: anomalyEv!.version }),
    },
  );
  assert(resolveRes.status === 200, "Resolve anomaly should succeed");
  const resolved = (await resolveRes.json()) as any;
  assert(resolved.isResolved === true, "Event resolved status should be true");

  // Test version mismatch conflict
  const resolveConflictRes = await fetch(
    `${baseUrl}/ai/insights/anomalies/${anomalyEv!.id}/resolve`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ expectedVersion: 1 }), // Old/mismatched version
    },
  );
  assert(
    resolveConflictRes.status === 409,
    "Version mismatch should throw 409 ConflictException",
  );

  // 8. Recommendations Engine
  console.log("Testing Recommendations engine...");
  const rec = await prisma.aiRecommendation.create({
    data: {
      tenantId,
      targetType: "PROCUREMENT_REORDER",
      targetEntityId: product.id,
      title: "Replenish AI Test Product",
      recommendation: "Reorder 100 units due to high demand forecast",
      score: 0.95,
    },
  });

  const applyRes = await fetch(
    `${baseUrl}/ai/insights/recommendations/${rec.id}/apply`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ expectedVersion: rec.version }),
    },
  );
  assert(applyRes.status === 201, "Apply recommendation should return 201");
  const appliedRec = (await applyRes.json()) as any;
  assert(appliedRec.isApplied === true, "isApplied must toggle to true");

  // 9. Verify Audit logging
  console.log("Checking AI audit logs...");
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      action: {
        in: [
          "AI_MODEL_TRAINED",
          "AI_MODEL_DEPLOYED",
          "AI_PREDICTION_EXECUTED",
          "AI_RECOMMENDATION_APPLIED",
          "AI_ANOMALY_DETECTED",
        ],
      },
    },
  });
  assert(
    auditLogs.length >= 4,
    "Platform events must be tracked in audit logs",
  );

  // 10. Security Guards permissions
  console.log("Verifying Security permissions restrictions...");
  const badGuard = await fetch(`${baseUrl}/ai/models/jobs`, { method: "GET" });
  assert(badGuard.status === 401, "Requests without headers must return 401");

  // Cleanup seeded mock master data
  console.log("Cleaning up E2E seeded data...");
  await prisma.aiAnomalyEvent.deleteMany({ where: { tenantId } });
  await prisma.aiRecommendation.deleteMany({ where: { tenantId } });
  await prisma.aiPredictionHistory.deleteMany({ where: { tenantId } });
  await prisma.aiModelRegistry.deleteMany({ where: { tenantId } });
  await prisma.aiTrainingJob.deleteMany({ where: { tenantId } });
  await prisma.aiFeatureStore.deleteMany({ where: { tenantId } });

  await prisma.biFactCustomerService.deleteMany({ where: { tenantId } });
  await prisma.biFactQuality.deleteMany({ where: { tenantId } });
  await prisma.biFactSales.deleteMany({ where: { tenantId } });
  await prisma.biDimensionCustomer.deleteMany({
    where: { tenantId, id: customerId },
  });
  await prisma.biDimensionProduct.deleteMany({
    where: { tenantId, id: product.id },
  });

  await prisma.product.deleteMany({ where: { tenantId, sku: "SKU-AI-TEST" } });
  await prisma.unit.deleteMany({ where: { tenantId, symbol: "AI" } });
  await prisma.category.deleteMany({
    where: { tenantId, name: "AI Test Category" },
  });
  await prisma.notification.deleteMany({
    where: { tenantId, title: { contains: "Anomaly" } },
  });
  await prisma.auditLog.deleteMany({
    where: {
      tenantId,
      action: {
        in: [
          "AI_MODEL_TRAINED",
          "AI_MODEL_DEPLOYED",
          "AI_PREDICTION_EXECUTED",
          "AI_RECOMMENDATION_APPLIED",
          "AI_ANOMALY_DETECTED",
          "AI_FEATURE_STORE_SYNCED",
          "AI_ANOMALY_RESOLVED",
        ],
      },
    },
  });

  console.log("All Phase 46 AI E2E integration tests completed successfully!");
  await app.close();
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
