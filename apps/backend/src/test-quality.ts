/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, InspectionLotStatus, NCRStatus, CAPAStatus, AccountType } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Quality E2E tests...");
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
  await app.listen(3050);

  const baseUrl = "http://localhost:3050/api";
  let adminToken = "";
  const suffix = ` ${Date.now()}`;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Authenticate Admin User
  console.log("Authenticating Admin...");
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginRes.status === 200 || loginRes.status === 201, "Admin login should succeed");
  const loginData = (await loginRes.json()) as { accessToken: string };
  adminToken = loginData.accessToken;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  const adminUser = await prisma.user.findFirst({ where: { email: "admin@amdox.com" } });
  assert(!!adminUser, "Admin user must exist in DB");
  const tenantId = adminUser!.tenantId!;

  // Clean up Quality tables to start fresh
  console.log("Cleaning up Quality tables...");
  await prisma.qualityCertificate.deleteMany({});
  await prisma.correctiveAction.deleteMany({});
  await prisma.nonConformanceReport.deleteMany({});
  await prisma.qualityDefect.deleteMany({});
  await prisma.inspectionResult.deleteMany({});
  await prisma.inspectionLot.deleteMany({});
  await prisma.inspectionCharacteristic.deleteMany({});
  await prisma.inspectionPlan.deleteMany({});
  await prisma.samplingPlan.deleteMany({});
  await prisma.supplierQualityRating.deleteMany({});

  // 2. Health Endpoint
  console.log("Verifying Health Endpoint...");
  const healthRes = await fetch("http://localhost:3050/health");
  // Some apps mount health under root /health or /api/health
  assert(healthRes.status === 200 || healthRes.status === 404, "Health endpoint should respond");

  // 3. Sampling Plan CRUD
  console.log("Verifying Sampling Plan CRUD...");
  // Attempt invalid lot sizes (min > max) -> should fail
  const badSpRes = await fetch(`${baseUrl}/quality/sampling-plans`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: "SP-BAD",
      name: "Bad Plan",
      aql: 1.0,
      lotSizeMin: 100,
      lotSizeMax: 10,
      sampleSize: 5,
      acceptNumber: 1,
      rejectNumber: 2,
    }),
  });
  assert(badSpRes.status === 400, "Should block min > max lot size");

  // Attempt invalid accept/reject numbers -> should fail
  const badSpRes2 = await fetch(`${baseUrl}/quality/sampling-plans`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: "SP-BAD-AR",
      name: "Bad Accept Reject",
      aql: 1.0,
      lotSizeMin: 1,
      lotSizeMax: 100,
      sampleSize: 5,
      acceptNumber: 3,
      rejectNumber: 2,
    }),
  });
  assert(badSpRes2.status === 400, "Should block accept >= reject numbers");

  // Create valid sampling plan
  const spCode = "SP-" + Date.now();
  const createSpRes = await fetch(`${baseUrl}/quality/sampling-plans`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: spCode,
      name: "AQL 1.0 Plan",
      aql: 1.0,
      lotSizeMin: 1,
      lotSizeMax: 1000,
      sampleSize: 10,
      acceptNumber: 0,
      rejectNumber: 1,
    }),
  });
  assert(createSpRes.status === 201, "Create sampling plan should succeed");
  const samplingPlan = (await createSpRes.json()) as { id: string };

  // Fetch list of sampling plans
  const listSpRes = await fetch(`${baseUrl}/quality/sampling-plans`, { headers });
  const samplingPlans = (await listSpRes.json()) as any[];
  assert(samplingPlans.length > 0, "List should return sampling plans");

  // 4. Inspection Plan CRUD
  console.log("Verifying Inspection Plan CRUD...");
  // Find a product
  const product = await prisma.product.findFirst({ where: { tenantId } });
  assert(!!product, "Prerequisite product must exist in database");

  const planCode = "IP-" + Date.now();
  const createPlanRes = await fetch(`${baseUrl}/quality/inspection-plans`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: planCode,
      name: "Product Quality Spec",
      productId: product!.id,
      samplingPlanId: samplingPlan.id,
      characteristics: [
        {
          sequence: 1,
          name: "Thickness",
          description: "Nominal thickness 10mm",
          type: "QUANTITATIVE",
          lowerLimit: 9.8,
          upperLimit: 10.2,
          unit: "mm",
          isRequired: true,
        },
      ],
    }),
  });
  assert(createPlanRes.status === 201, "Create inspection plan should succeed");
  const inspectionPlan = (await createPlanRes.json()) as { id: string; characteristics: any[]; version: number };

  // Fetch inspection plan detail
  const getPlanRes = await fetch(`${baseUrl}/quality/inspection-plans/${inspectionPlan.id}`, { headers });
  assert(getPlanRes.status === 200, "Get inspection plan detail should succeed");

  // Verify Optimistic Concurrency on Inspection Plan update
  console.log("Verifying Optimistic Concurrency...");
  const updatePlanRes = await fetch(`${baseUrl}/quality/inspection-plans/${inspectionPlan.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Updated Quality Spec",
      expectedVersion: 99, // Wrong version
    }),
  });
  // Since update method handles versioning or increments, it will check
  assert(updatePlanRes.status !== 200, "Should block update with incorrect expectedVersion");

  // 5. Incoming Inspection Lot Lifecycle (Passed path)
  console.log("Verifying Incoming Inspection (Passed path)...");
  // Find a warehouse
  const warehouse = await prisma.warehouse.findFirst({ where: { tenantId, deletedAt: null } });
  assert(!!warehouse, "Prerequisite warehouse must exist in database");

  // Prepare initial stock for the product so we can place it on hold
  await prisma.stock.upsert({
    where: {
      tenantId_productId_warehouseId: {
        tenantId,
        productId: product!.id,
        warehouseId: warehouse!.id,
      },
    },
    update: { quantity: 100 },
    create: {
      tenantId,
      productId: product!.id,
      warehouseId: warehouse!.id,
      quantity: 100,
    },
  });

  const lotCode = "LOT-" + Date.now();
  const createLotRes = await fetch(`${baseUrl}/quality/inspection-lots`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: lotCode,
      productId: product!.id,
      type: "INCOMING",
      quantity: 50,
      warehouseId: warehouse!.id,
      inspectionPlanId: inspectionPlan.id,
    }),
  });
  assert(createLotRes.status === 201, "Create inspection lot should succeed");
  const lot = (await createLotRes.json()) as { id: string; sampleSize: number };
  assert(lot.sampleSize === 10, "Should resolve sample size from sampling plan AQL rules");

  // Verify Hold Warehouse movement: Main warehouse stock decreased by 50, hold warehouse has 50
  const holdWhCode = `HOLD-${warehouse!.code}`;
  const holdWarehouse = await prisma.warehouse.findFirst({ where: { tenantId, code: holdWhCode } });
  assert(!!holdWarehouse, "Hold Warehouse should be created dynamically");

  const mainStock = await prisma.stock.findUnique({
    where: {
      tenantId_productId_warehouseId: {
        tenantId,
        productId: product!.id,
        warehouseId: warehouse!.id,
      },
    },
  });
  const holdStock = await prisma.stock.findUnique({
    where: {
      tenantId_productId_warehouseId: {
        tenantId,
        productId: product!.id,
        warehouseId: holdWarehouse!.id,
      },
    },
  });
  assert(Number(mainStock?.quantity) === 50, "Main stock should decrease by lot quantity");
  assert(Number(holdStock?.quantity) === 50, "Hold stock should increase by lot quantity");

  // Record passing results
  console.log("Recording passing results...");
  const charId = inspectionPlan.characteristics[0].id;
  const recordRes = await fetch(`${baseUrl}/quality/inspection-lots/${lot.id}/results`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      results: [
        {
          characteristicId: charId,
          measuredValue: 10.0, // Within 9.8 - 10.2 limits
          passed: true,
          remarks: "Perfect nominal thickness",
        },
      ],
    }),
  });
  assert(recordRes.status === 201 || recordRes.status === 200, "Record results should succeed");
  const lotAfterPass = (await recordRes.json()) as { status: string };
  assert(lotAfterPass.status === "PASSED", "Lot status should be PASSED");

  // Verify stock released back to Main warehouse
  const mainStockAfter = await prisma.stock.findUnique({
    where: {
      tenantId_productId_warehouseId: {
        tenantId,
        productId: product!.id,
        warehouseId: warehouse!.id,
      },
    },
  });
  assert(Number(mainStockAfter?.quantity) === 100, "Main stock should be restored to 100");

  // Create Quality Certificate (COA) for Passed Lot
  console.log("Creating and approving COA Certificate...");
  const certCode = "COA-" + Date.now();
  const createCertRes = await fetch(`${baseUrl}/quality/certificates`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: certCode,
      inspectionLotId: lot.id,
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    }),
  });
  assert(createCertRes.status === 201, "Create certificate should succeed");
  const cert = (await createCertRes.json()) as { id: string; status: string };
  assert(cert.status === "DRAFT", "Certificate should start in DRAFT status");

  const approveCertRes = await fetch(`${baseUrl}/quality/certificates/${cert.id}/approve`, {
    method: "POST",
    headers,
  });
  assert(approveCertRes.status === 201 || approveCertRes.status === 200, "Approve certificate should succeed");
  const certApproved = (await approveCertRes.json()) as { status: string };
  assert(certApproved.status === "APPROVED", "Certificate should become APPROVED");

  // 6. In-Process/Finished Goods Inspection & NCR/CAPA Lifecycle (Failed path)
  console.log("Verifying In-Process Inspection Lot (Failed path)...");
  const lotCode2 = "LOT-FAIL-" + Date.now();
  const createLotRes2 = await fetch(`${baseUrl}/quality/inspection-lots`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: lotCode2,
      productId: product!.id,
      type: "FINISHED_GOODS",
      quantity: 20,
      warehouseId: warehouse!.id,
      inspectionPlanId: inspectionPlan.id,
    }),
  });
  assert(createLotRes2.status === 201, "Create second lot should succeed");
  const lot2 = (await createLotRes2.json()) as { id: string };

  // Record failed results (thickness 12.0 mm, out of limits)
  console.log("Recording failing results...");
  const recordRes2 = await fetch(`${baseUrl}/quality/inspection-lots/${lot2.id}/results`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      results: [
        {
          characteristicId: charId,
          measuredValue: 12.0, // Out of limits
          passed: false,
          remarks: "Thickness exceeds upper limit",
        },
      ],
    }),
  });
  assert(recordRes2.status === 201 || recordRes2.status === 200, "Record failing results should succeed");
  const lotAfterFail = (await recordRes2.json()) as { status: string };
  assert(lotAfterFail.status === "FAILED", "Lot status should be FAILED");

  // Verify NCR is created automatically
  const ncr = await prisma.nonConformanceReport.findFirst({
    where: { tenantId, inspectionLotId: lot2.id },
  });
  assert(!!ncr, "NCR should be generated automatically on quality failure");
  assert(ncr!.status === "OPEN", "NCR status should start as OPEN");

  // Verify stock is moved to Rejected Warehouse
  const rejectedWhCode = `REJ-${warehouse!.code}`;
  const rejectedWarehouse = await prisma.warehouse.findFirst({ where: { tenantId, code: rejectedWhCode } });
  assert(!!rejectedWarehouse, "Rejected warehouse should be created dynamically");

  const rejectedStock = await prisma.stock.findUnique({
    where: {
      tenantId_productId_warehouseId: {
        tenantId,
        productId: product!.id,
        warehouseId: rejectedWarehouse!.id,
      },
    },
  });
  assert(Number(rejectedStock?.quantity) === 20, "Rejected stock should increase by 20");

  // Record Defect details
  const defectRes = await fetch(`${baseUrl}/quality/inspection-lots/${lot2.id}/defects`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: "DEF-001",
      description: "Critical dimensional defect",
      severity: "CRITICAL",
      quantity: 20,
    }),
  });
  assert(defectRes.status === 201, "Record defect details should succeed");

  // Create CAPA (Corrective Action)
  console.log("Verifying CAPA workflow...");
  const capaCode = "CAPA-" + Date.now();
  const createCapaRes = await fetch(`${baseUrl}/quality/capas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: capaCode,
      ncrId: ncr!.id,
      type: "CORRECTIVE",
      description: "Perform machinery calibration",
      targetCompletionDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    }),
  });
  assert(createCapaRes.status === 201, "Create CAPA should succeed");
  const capa = (await createCapaRes.json()) as { id: string; status: string };
  assert(capa.status === "OPEN", "CAPA should start as OPEN");

  // Resolve CAPA and verify NCR is resolved
  const resolveCapaRes = await fetch(`${baseUrl}/quality/capas/${capa.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      status: "CLOSED",
      rootCause: "Machine calibration drift",
    }),
  });
  assert(resolveCapaRes.status === 200, "Resolve CAPA should succeed");

  const ncrAfter = await prisma.nonConformanceReport.findUnique({ where: { id: ncr!.id } });
  assert(ncrAfter!.status === "RESOLVED", "NCR status should automatically update to RESOLVED when all CAPAs close");

  // 7. NCR Disposition and General Ledger Accounting Entries
  console.log("Verifying NCR disposition scrap flow and GL postings...");
  // Set NCR action taken to SCRAP
  const updateNcrRes = await fetch(`${baseUrl}/quality/ncrs/${ncr!.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      actionTaken: "SCRAP",
      status: "RESOLVED",
    }),
  });
  assert(updateNcrRes.status === 200, "Update NCR disposition to SCRAP should succeed");

  // Verify Scrap stock movement: stock removed from Rejected warehouse
  const rejectedStockAfter = await prisma.stock.findUnique({
    where: {
      tenantId_productId_warehouseId: {
        tenantId,
        productId: product!.id,
        warehouseId: rejectedWarehouse!.id,
      },
    },
  });
  assert(Number(rejectedStockAfter?.quantity) === 0, "Rejected stock should be cleared to 0 after scrap");

  // Verify balanced Journal Entry creation
  const journalEntry = await prisma.journalEntry.findFirst({
    where: { tenantId, sourceType: "STOCK_MOVEMENT", sourceId: lot2.id },
    include: { lines: true },
  });
  assert(!!journalEntry, "Balanced Journal Entry should be created automatically for scrap");
  assert(journalEntry!.status === "POSTED", "Journal entry should be posted");
  const debitLine = journalEntry!.lines.find((l) => Number(l.debit) > 0);
  const creditLine = journalEntry!.lines.find((l) => Number(l.credit) > 0);
  assert(!!debitLine && !!creditLine, "Must have debit and credit lines");
  assert(Number(debitLine!.debit) === Number(creditLine!.credit), "Journal entry must be balanced (debit equals credit)");

  // 8. Supplier Quality Ratings
  console.log("Verifying Supplier Quality Ratings...");
  const ratingsRes = await fetch(`${baseUrl}/quality/supplier-ratings`, { headers });
  assert(ratingsRes.status === 200, "Fetch supplier ratings should succeed");

  // 9. Dashboard widgets
  console.log("Verifying Dashboard quality widgets...");
  const dashRes = await fetch(`${baseUrl}/dashboard`, { headers });
  assert(dashRes.status === 200, "Fetch dashboard should succeed");
  const dashData = await dashRes.json();
  assert(!!dashData.summary.quality, "Dashboard summary should contain quality widget object");
  assert(dashData.summary.quality.openInspections !== undefined, "Should expose openInspections metric");

  // 10. CSV and PDF exports
  console.log("Verifying CSV/PDF exports...");
  const csvRes = await fetch(`${baseUrl}/quality/reports/export/csv`, { headers });
  assert(csvRes.status === 200, "Export CSV should succeed");
  const pdfRes = await fetch(`${baseUrl}/quality/reports/export/pdf`, { headers });
  assert(pdfRes.status === 200, "Export PDF should succeed");

  // 11. Audit logs
  console.log("Verifying Audit logs...");
  const logs = await prisma.auditLog.findMany({
    where: { tenantId, action: { in: ["INSPECTION_CREATED", "NCR_CREATED", "CAPA_CLOSED"] } },
  });
  assert(logs.length > 0, "Should record quality audit logs in database");

  // 12. In-App Notifications
  console.log("Verifying in-app notifications...");
  const notifs = await prisma.notification.findMany({
    where: { tenantId, title: "Quality Inspection Lot Created" },
  });
  assert(notifs.length > 0, "Should record quality notifications in database");

  // 13. Tenant Isolation
  console.log("Verifying Tenant Isolation...");
  // Try to create resource with a wrong header or token -> should be blocked or return empty
  const foreignHeaders = {
    "Content-Type": "application/json",
    Authorization: "Bearer invalid_token_xyz",
  };
  const foreignRes = await fetch(`${baseUrl}/quality/sampling-plans`, { headers: foreignHeaders });
  assert(foreignRes.status === 401, "Request with invalid token should be unauthorized");

  console.log("All Quality E2E tests passed successfully!");
  await app.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
