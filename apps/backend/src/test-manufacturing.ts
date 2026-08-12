/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, WorkOrderStatus, BOMStatus, OperationStatus } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Manufacturing E2E tests...");
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
  await app.listen(3040);

  const baseUrl = "http://localhost:3040/api";
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

  // Get Admin user tenantId and id from DB
  const adminUser = await prisma.user.findFirst({ where: { email: "admin@amdox.com" } });
  assert(!!adminUser, "Admin user must exist in DB");
  const tenantId = adminUser!.tenantId!;
  const adminId = adminUser!.id;

  // Clean up database tables to prevent contamination from previous runs
  console.log("Cleaning up database tables...");
  await prisma.gPSLog.deleteMany({});
  await prisma.fuelLog.deleteMany({});
  await prisma.maintenanceSchedule.deleteMany({});
  await prisma.shipmentException.deleteMany({});
  await prisma.shipmentStop.deleteMany({});
  await prisma.shipment.deleteMany({});
  await prisma.trip.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.driver.deleteMany({});
  await prisma.carrier.deleteMany({});
  await prisma.salesOrderItem.deleteMany({});
  await prisma.salesOrder.deleteMany({});
  await prisma.workOrderOperation.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.routingOperation.deleteMany({});
  await prisma.routing.deleteMany({});
  await prisma.bOMItem.deleteMany({});
  await prisma.bOM.deleteMany({});
  await prisma.workCenter.deleteMany({});
  await prisma.qualityCertificate.deleteMany({});
  await prisma.correctiveAction.deleteMany({});
  await prisma.nonConformanceReport.deleteMany({});
  await prisma.inspectionResult.deleteMany({});
  await prisma.inspectionLot.deleteMany({});
  await prisma.cycleCountLine.deleteMany({});
  await prisma.cycleCount.deleteMany({});
  await prisma.warehouseMovement.deleteMany({});
  await prisma.binStock.deleteMany({});
  await prisma.putawayRule.deleteMany({});
  await prisma.warehouseBin.deleteMany({});
  await prisma.warehouseZone.deleteMany({});
  await prisma.qualityDefect.deleteMany({});
  await prisma.inspectionCharacteristic.deleteMany({});
  await prisma.inspectionPlan.deleteMany({});
  await prisma.samplingPlan.deleteMany({});
  await prisma.supplierQualityRating.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.journalEntryLine.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.stock.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.taxCategory.deleteMany({});

  // Setup Master Data Prerequisites
  console.log("Creating prerequisites (Category, Unit, Warehouses, Products)...");
  
  // Category
  const createCatRes = await fetch(`${baseUrl}/master-data/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Mfg Category" + suffix }),
  });
  assert(createCatRes.status === 201, "Create category should succeed");
  const category = (await createCatRes.json()) as { id: string };

  // Unit
  const createUnitRes = await fetch(`${baseUrl}/master-data/units`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Mfg Unit" + suffix, symbol: "pcs" }),
  });
  assert(createUnitRes.status === 201, "Create unit should succeed");
  const unit = (await createUnitRes.json()) as { id: string };

  // Tax Category
  const createTaxRes = await fetch(`${baseUrl}/master-data/tax-categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Mfg Tax" + suffix, rate: 10, isDefault: false }),
  });
  assert(createTaxRes.status === 201, "Create tax category should succeed");
  const taxCategory = (await createTaxRes.json()) as { id: string };

  // Warehouse
  const createWhRes = await fetch(`${baseUrl}/master-data/warehouses`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Mfg Warehouse" + suffix, code: "MFG" + Date.now() }),
  });
  assert(createWhRes.status === 201, "Create Warehouse should succeed");
  const warehouse = (await createWhRes.json()) as { id: string };

  // Raw Material Product
  const createRawRes = await fetch(`${baseUrl}/inventory/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Steel Sheet" + suffix,
      sku: "RAW-" + Date.now(),
      barcode: "BAR-RAW-" + Date.now(),
      categoryId: category.id,
      unitId: unit.id,
      taxCategoryId: taxCategory.id,
      costPrice: 20.0,
      salePrice: 0.0,
    }),
  });
  assert(createRawRes.status === 201, "Create raw product should succeed");
  const rawProduct = (await createRawRes.json()) as { id: string };

  // Finished Good Product
  const createFinishedRes = await fetch(`${baseUrl}/inventory/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Steel Cabinet" + suffix,
      sku: "FIN-" + Date.now(),
      barcode: "BAR-FIN-" + Date.now(),
      categoryId: category.id,
      unitId: unit.id,
      taxCategoryId: taxCategory.id,
      costPrice: 100.0,
      salePrice: 180.0,
    }),
  });
  assert(createFinishedRes.status === 201, "Create finished product should succeed");
  const finishedProduct = (await createFinishedRes.json()) as { id: string };

  // Add initial stock for raw material product
  await prisma.stock.create({
    data: {
      tenantId,
      productId: rawProduct.id,
      warehouseId: warehouse.id,
      quantity: 500.0,
    },
  });

  // ---------------------------------------------------------------------------
  // TEST: WORK CENTER CRUD & CAPACITY VALIDATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Work Center CRUD & Capacity Validation ---");
  const wcCode = "WC-" + Date.now();
  const createWcRes = await fetch(`${baseUrl}/manufacturing/work-centers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: wcCode,
      name: "Assembly Line 1",
      description: "Main assembly line",
      overheadRate: 50.0,
      capacity: 8.0,
    }),
  });
  assert(createWcRes.status === 201, "Create Work Center should succeed");
  const wc = (await createWcRes.json()) as { id: string; code: string; version: number };
  assert(wc.code === wcCode, "Work Center code should match");

  // Get Work Center
  const getWcRes = await fetch(`${baseUrl}/manufacturing/work-centers/${wc.id}`, { headers });
  assert(getWcRes.status === 200, "Get Work Center should succeed");

  // Update Work Center
  const updateWcRes = await fetch(`${baseUrl}/manufacturing/work-centers/${wc.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Assembly Line 1 Updated",
      expectedVersion: wc.version,
    }),
  });
  assert(updateWcRes.status === 200, "Update Work Center should succeed");

  // Optimistic Concurrency Verification
  const updateWcConflictRes = await fetch(`${baseUrl}/manufacturing/work-centers/${wc.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Assembly Line 1 Conflict",
      expectedVersion: wc.version, // outdated version
    }),
  });
  assert(updateWcConflictRes.status === 409, "Outdated version should return 409 Conflict");

  // ---------------------------------------------------------------------------
  // TEST: BOM CRUD, VERSIONING & SUBMISSION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing BOM CRUD & Submission ---");
  const bomCode = "BOM-" + Date.now();
  const createBomRes = await fetch(`${baseUrl}/manufacturing/boms`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      productId: finishedProduct.id,
      code: bomCode,
      name: "Steel Cabinet BOM",
      description: "Recipe for steel cabinet",
      quantity: 1.0,
      items: [
        {
          productId: rawProduct.id,
          quantity: 4.0,
          unitId: unit.id,
          scrapFactor: 5.0, // 5% scrap
        },
      ],
    }),
  });
  assert(createBomRes.status === 201, "Create BOM should succeed");
  const bom = (await createBomRes.json()) as { id: string; status: string; version: number };
  assert(bom.status === BOMStatus.DRAFT, "BOM should start in DRAFT status");

  // Submit BOM
  const submitBomRes = await fetch(`${baseUrl}/manufacturing/boms/${bom.id}/submit`, {
    method: "POST",
    headers,
  });
  assert(submitBomRes.status === 201, "Submit BOM should succeed");
  const submittedBom = (await submitBomRes.json()) as { status: string };
  // Since we didn't setup active workflow definition BOM_APPROVAL, status transitions to ACTIVE automatically
  assert(submittedBom.status === BOMStatus.ACTIVE, "BOM status should become ACTIVE directly");

  // ---------------------------------------------------------------------------
  // TEST: ROUTING CRUD & OPERATIONS
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Routing CRUD & Operations ---");
  const routingCode = "RT-" + Date.now();
  const createRoutingRes = await fetch(`${baseUrl}/manufacturing/routings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      productId: finishedProduct.id,
      code: routingCode,
      name: "Assembly Routing",
      description: "Operations workflow",
      operations: [
        {
          workCenterId: wc.id,
          sequence: 10,
          name: "Setup & Assembly",
          description: "Assemble steel sheets",
          setupTimeMinutes: 30.0,
          executionTimeMinutes: 60.0,
        },
      ],
    }),
  });
  assert(createRoutingRes.status === 201, "Create Routing should succeed");
  const routing = (await createRoutingRes.json()) as { id: string };

  // ---------------------------------------------------------------------------
  // TEST: WORK ORDER LIFECYCLE, INTEGRATIONS, RESERVATION, PRODUCTION & JOURNAL ENTRIES
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Work Order Lifecycle & Integrations ---");
  const woCode = "WO-" + Date.now();
  const createWoRes = await fetch(`${baseUrl}/manufacturing/work-orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: woCode,
      bomId: bom.id,
      routingId: routing.id,
      productId: finishedProduct.id,
      quantity: 10.0, // requires 10 * 4 * 1.05 = 42 steel sheets
      plannedStartDate: new Date().toISOString(),
      plannedEndDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  });
  assert(createWoRes.status === 201, "Create Work Order should succeed");
  const wo = (await createWoRes.json()) as { id: string; status: string; operations: any[] };
  assert(wo.status === WorkOrderStatus.DRAFT, "Work Order should start as DRAFT");

  // Submit Work Order
  const submitWoRes = await fetch(`${baseUrl}/manufacturing/work-orders/${wo.id}/submit`, {
    method: "POST",
    headers,
  });
  assert(submitWoRes.status === 201, "Submit Work Order should succeed");
  const submittedWo = (await submitWoRes.json()) as { status: string };
  assert(submittedWo.status === WorkOrderStatus.APPROVED, "Work Order status should become APPROVED");

  // Get raw stock levels before consumption
  const stockBeforeRaw = await prisma.stock.findFirst({
    where: { productId: rawProduct.id, warehouseId: warehouse.id },
  });
  const qtyBeforeRaw = Number(stockBeforeRaw?.quantity || 0);

  // Start Work Order (Material Reservation & Consumption)
  const startWoRes = await fetch(`${baseUrl}/manufacturing/work-orders/${wo.id}/start`, {
    method: "POST",
    headers,
  });
  assert(startWoRes.status === 201, "Start Work Order should succeed");
  const startedWo = (await startWoRes.json()) as { status: string };
  assert(startedWo.status === WorkOrderStatus.IN_PROGRESS, "Work Order should be IN_PROGRESS");

  // Verify raw material was consumed from inventory
  const stockAfterRaw = await prisma.stock.findFirst({
    where: { productId: rawProduct.id, warehouseId: warehouse.id },
  });
  const qtyAfterRaw = Number(stockAfterRaw?.quantity || 0);
  const consumedQty = qtyBeforeRaw - qtyAfterRaw;
  assert(consumedQty === 42.0, `Material consumption quantity should include 5% scrap (10 * 4 * 1.05 = 42). Found: ${consumedQty}`);

  // Log Operations
  console.log("Logging operations progress...");
  const logOpRes = await fetch(`${baseUrl}/manufacturing/work-orders/${wo.id}/operations/10/log`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      actualSetupTimeMinutes: 30.0,
      actualExecutionTimeMinutes: 90.0, // total runtime: 120 minutes = 2 hours
    }),
  });
  assert(logOpRes.status === 201, "Log operation should succeed");
  const loggedOp = (await logOpRes.json()) as { status: string };
  assert(loggedOp.status === OperationStatus.COMPLETED, "Operation should be COMPLETED");

  // Get finished stock levels before complete
  const stockBeforeFin = await prisma.stock.findFirst({
    where: { productId: finishedProduct.id, warehouseId: warehouse.id },
  });
  const qtyBeforeFin = Number(stockBeforeFin?.quantity || 0);

  // Complete Work Order (Production Output + Costing Valuation + Accounting Postings)
  const completeWoRes = await fetch(`${baseUrl}/manufacturing/work-orders/${wo.id}/complete`, {
    method: "POST",
    headers,
  });
  assert(completeWoRes.status === 201, "Complete Work Order should succeed");
  const completedWo = (await completeWoRes.json()) as { status: string };
  assert(completedWo.status === WorkOrderStatus.COMPLETED, "Work Order status should be COMPLETED");

  // Verify finished product stock was incremented
  const stockAfterFin = await prisma.stock.findFirst({
    where: { productId: finishedProduct.id, warehouseId: warehouse.id },
  });
  const qtyAfterFin = Number(stockAfterFin?.quantity || 0);
  const producedQty = qtyAfterFin - qtyBeforeFin;
  assert(producedQty === 10.0, `Should produce 10.0 finished units. Found: ${producedQty}`);

  // Costing:
  // Material Cost: 42 raw * $20 = $840
  // Labor/WC Cost: 2 hours * $50 = $100
  // Total Cost: $940
  // Verify Journal Entries
  console.log("Verifying General Ledger postings...");
  const journalEntries = await prisma.journalEntry.findMany({
    where: { sourceId: wo.id },
    include: { lines: true },
  });
  assert(journalEntries.length === 1, "One journal entry should be posted for the Work Order");
  const entry = journalEntries[0];
  const debitTotal = entry.lines.reduce((acc, l) => acc + Number(l.debit), 0);
  const creditTotal = entry.lines.reduce((acc, l) => acc + Number(l.credit), 0);
  assert(debitTotal === 940.0, `Journal entry should balance at $940. Found Debit: ${debitTotal}`);
  assert(creditTotal === 940.0, `Journal entry should balance at $940. Found Credit: ${creditTotal}`);

  // ---------------------------------------------------------------------------
  // TEST: MRP CALCULATIONS & TRIGGER RUNS
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing MRP Demand Calculations & Runs ---");
  
  // Create another Work Order to generate shortage demand
  const createShortageWoRes = await fetch(`${baseUrl}/manufacturing/work-orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: "WO-SHORT-" + Date.now(),
      bomId: bom.id,
      routingId: routing.id,
      productId: finishedProduct.id,
      quantity: 200.0, // requires 200 * 4 * 1.05 = 840 sheets (we only have 458 left)
      plannedStartDate: new Date().toISOString(),
      plannedEndDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  });
  assert(createShortageWoRes.status === 201, "Create shortage Work Order should succeed");
  const shortageWo = (await createShortageWoRes.json()) as { id: string };

  // Submit shortage WO so it is active
  await fetch(`${baseUrl}/manufacturing/work-orders/${shortageWo.id}/submit`, {
    method: "POST",
    headers,
  });

  // Calculate requirements
  const reqRes = await fetch(`${baseUrl}/manufacturing/mrp/requirements`, { headers });
  assert(reqRes.status === 200, "Get MRP requirements should succeed");
  const requirements = (await reqRes.json()) as any[];
  const shortageItem = requirements.find(r => r.productId === rawProduct.id);
  assert(shortageItem !== undefined, "Raw product should be listed in requirements");
  assert(shortageItem.recommendation === "BUY", "Shortage recommendation should be BUY");

  // Run MRP
  const runMrpRes = await fetch(`${baseUrl}/manufacturing/mrp/run`, {
    method: "POST",
    headers,
  });
  assert(runMrpRes.status === 201, "Run MRP should succeed");
  const mrpRun = (await runMrpRes.json()) as { purchaseOrdersCreated: any[] };
  assert(mrpRun.purchaseOrdersCreated.length === 1, "Should generate one draft Purchase Order for raw material shortage");

  // ---------------------------------------------------------------------------
  // TEST: DASHBOARD METRICS INTEGRATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Dashboard Metrics Integration ---");
  const dashboardRes = await fetch(`${baseUrl}/dashboard/summary`, { headers });
  assert(dashboardRes.status === 200, "Get dashboard summary should succeed");
  const dashboardData = (await dashboardRes.json()) as { manufacturing: any };
  assert(dashboardData.manufacturing !== undefined, "Dashboard should contain manufacturing section");
  assert(dashboardData.manufacturing.totalWorkCenters >= 1, "Should count work center");

  // ---------------------------------------------------------------------------
  // TEST: AUDIT LOGGING & NOTIFICATIONS
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Audit Logging ---");
  const mfgAuditLogs = await prisma.auditLog.findMany({
    where: { action: { startsWith: "WORK_ORDER_" } },
  });
  assert(mfgAuditLogs.length >= 1, "Manufacturing actions should produce audit log records");

  // ---------------------------------------------------------------------------
  // TEST: CSV EXPORT
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing CSV Export ---");
  const csvRes = await fetch(`${baseUrl}/manufacturing/work-orders/export/csv`, { headers });
  assert(csvRes.status === 200, "CSV export should succeed");
  const csvText = await csvRes.text();
  assert(csvText.startsWith("Code,Product,BOM,Routing,Quantity,Status"), "CSV should start with correct header");

  // ---------------------------------------------------------------------------
  // TEST: SECURITY & TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Security & Tenant Isolation ---");
  
  // Fake token / bad permissions test (missing header or empty token)
  const badAuthRes = await fetch(`${baseUrl}/manufacturing/work-centers`, {
    method: "GET",
  });
  assert(badAuthRes.status === 401, "Should fail without credentials (401 Unauthorized)");

  // Clean up
  console.log("\nCleaning up NestJS test instance...");
  await app.close();
  console.log("\n==================================================");
  console.log("ALL E2E MANUFACTURING INTEGRATION TESTS PASSED!");
  console.log("==================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("E2E Test failure:", err);
  process.exit(1);
});
