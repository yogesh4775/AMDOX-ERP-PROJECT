/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, BinStatus, WmsMovementStatus, CycleCountStatus, AccountType, WarehouseZone, WarehouseBin, CycleCount } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for WMS E2E tests...");
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
  await app.listen(3060);

  const baseUrl = "http://localhost:3060/api";
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

  console.log("Cleaning up WMS tables...");
  await prisma.stock.deleteMany({});
  await prisma.cycleCountLine.deleteMany({});
  await prisma.cycleCount.deleteMany({});
  await prisma.warehouseMovement.deleteMany({});
  await prisma.binStock.deleteMany({});
  await prisma.putawayRule.deleteMany({});
  await prisma.qualityCertificate.deleteMany({});
  await prisma.correctiveAction.deleteMany({});
  await prisma.nonConformanceReport.deleteMany({});
  await prisma.inspectionResult.deleteMany({});
  await prisma.inspectionLot.deleteMany({});
  await prisma.warehouseBin.deleteMany({});
  await prisma.warehouseZone.deleteMany({});

  // Setup a test Warehouse and Product if missing
  let warehouse = await prisma.warehouse.findFirst({ where: { tenantId } });
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        tenantId,
        name: "WMS Main Warehouse",
        code: "WMS-MAIN",
        status: "ACTIVE",
      },
    });
  }

  let product = await prisma.product.findFirst({ where: { tenantId } });
  if (!product) {
    let category = await prisma.category.findFirst({ where: { tenantId } });
    if (!category) {
      category = await prisma.category.create({
        data: {
          tenantId,
          name: "WMS Category",
          status: "ACTIVE",
        },
      });
    }
    let unit = await prisma.unit.findFirst({ where: { tenantId } });
    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          tenantId,
          name: "Piece",
          symbol: "PCS",
          status: "ACTIVE",
        },
      });
    }
    product = await prisma.product.create({
      data: {
        tenantId,
        name: "WMS Product",
        sku: `SKU-WMS-${Date.now()}`,
        categoryId: category.id,
        unitId: unit.id,
        costPrice: 25.0,
        salePrice: 50.0,
        status: "ACTIVE",
      },
    });
  }

  // 2. Health Endpoint
  console.log("Verifying Health Endpoint...");
  const healthRes = await fetch("http://localhost:3060/health");
  assert(healthRes.status === 200, "Health endpoint should respond with 200");

  // 3. Zone CRUD
  console.log("Verifying Zone CRUD...");
  const createZoneRes = await fetch(`${baseUrl}/wms/zones`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      code: "ZONE-A",
      name: "Ambient Storage Zone A",
      description: "Standard storage area",
      isHazardous: false,
      temperatureClass: "AMBIENT",
    }),
  });
  assert(createZoneRes.status === 200 || createZoneRes.status === 201, "Should create zone");
  const zone = (await createZoneRes.json()) as WarehouseZone;
  assert(zone.code === "ZONE-A", "Zone code should match");

  const updateZoneRes = await fetch(`${baseUrl}/wms/zones/${zone.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Updated Zone A",
      expectedVersion: 1,
    }),
  });
  assert(updateZoneRes.status === 200, "Should update zone");
  const updatedZone = (await updateZoneRes.json()) as WarehouseZone;
  assert(updatedZone.name === "Updated Zone A", "Zone name should update");

  const getZonesRes = await fetch(`${baseUrl}/wms/zones`, { headers });
  const zones = (await getZonesRes.json()) as any[];
  assert(zones.length > 0, "Zones list should not be empty");

  // 4. Bin CRUD
  console.log("Verifying Bin CRUD...");
  const createBinRes = await fetch(`${baseUrl}/wms/bins`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      zoneId: zone.id,
      code: "BIN-A1",
      aisle: "1",
      rack: "A",
      shelf: "1",
      position: "1",
      maxVolume: 1000,
      maxWeight: 2000,
    }),
  });
  assert(createBinRes.status === 200 || createBinRes.status === 201, "Should create bin");
  const bin = (await createBinRes.json()) as WarehouseBin;
  assert(bin.code === "BIN-A1", "Bin code should match");

  const updateBinRes = await fetch(`${baseUrl}/wms/bins/${bin.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      status: BinStatus.ACTIVE,
      expectedVersion: 1,
    }),
  });
  assert(updateBinRes.status === 200, "Should update bin");

  const getBinsRes = await fetch(`${baseUrl}/wms/bins`, { headers });
  const bins = (await getBinsRes.json()) as any[];
  assert(bins.length > 0, "Bins list should not be empty");

  // 5. Putaway Rules & Suggestions
  console.log("Verifying Putaway Suggestions...");
  const createRuleRes = await fetch(`${baseUrl}/wms/putaway-rules`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      productId: product.id,
      preferredZoneId: zone.id,
      priority: 1,
    }),
  });
  assert(createRuleRes.status === 200 || createRuleRes.status === 201, "Should create putaway rule");

  const suggestRes = await fetch(`${baseUrl}/wms/putaway-suggestions?warehouseId=${warehouse.id}&productId=${product.id}&quantity=100`, { headers });
  assert(suggestRes.status === 200, "Should resolve putaway suggestion");
  const suggestedBin = (await suggestRes.json()) as WarehouseBin;
  assert(suggestedBin.id === bin.id, "Putaway suggestion should yield BIN-A1");

  // 6. Internal Stock Bin-to-bin movements
  console.log("Verifying Bin Movements...");
  // Seed initial stock in Bin-A1
  await prisma.binStock.create({
    data: {
      tenantId,
      binId: bin.id,
      productId: product.id,
      quantity: 500.0,
      batchNumber: "B123",
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });
  await prisma.stock.create({
    data: {
      tenantId,
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 500.0,
    },
  });

  // Create another destination bin in Zone-A
  const destBin = await prisma.warehouseBin.create({
    data: {
      tenantId,
      zoneId: zone.id,
      code: "BIN-A2",
      status: BinStatus.ACTIVE,
      version: 1,
    },
  });

  const moveRes = await fetch(`${baseUrl}/wms/movements`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      productId: product.id,
      fromBinId: bin.id,
      toBinId: destBin.id,
      quantity: 200.0,
      batchNumber: "B123",
      reason: "Reorganizing stock",
    }),
  });
  assert(moveRes.status === 200 || moveRes.status === 201, "Bin-to-bin movement should succeed");

  const srcBinStock = await prisma.binStock.findFirst({ where: { binId: bin.id, productId: product.id } });
  const destBinStock = await prisma.binStock.findFirst({ where: { binId: destBin.id, productId: product.id } });
  assert(srcBinStock?.quantity.toString() === "300", "Source bin should have 300 left");
  assert(destBinStock?.quantity.toString() === "200", "Destination bin should have 200");

  // 7. FEFO / FIFO Picking suggestions
  console.log("Verifying Picking Suggestions (FEFO)...");
  // Seed an expiring stock in BIN-A1 with sooner expiry
  const soonerExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days
  await prisma.binStock.create({
    data: {
      tenantId,
      binId: bin.id,
      productId: product.id,
      quantity: 50.0,
      batchNumber: "B_EXP_SOON",
      expiryDate: soonerExpiry,
    },
  });
  await prisma.stock.update({
    where: {
      tenantId_productId_warehouseId: {
        tenantId,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    },
    data: {
      quantity: { increment: 50.0 },
    },
  });

  const pickRes = await fetch(`${baseUrl}/wms/pick-suggestions?warehouseId=${warehouse.id}&productId=${product.id}&quantity=100&strategy=FEFO`, { headers });
  assert(pickRes.status === 200, "Pick suggestions should succeed");
  const picks = (await pickRes.json()) as any[];
  assert(picks.length > 0, "Picks should be returned");
  // The first suggestion should be the soonest expiring lot: B_EXP_SOON
  assert(picks[0].batchNumber === "B_EXP_SOON", "FEFO picking strategy must select soonest expiry batch first");

  // 8. Cycle Counting audits and Variance booking
  console.log("Verifying Cycle Count Variance & Accounting adjustments...");
  const cycleCode = `CC-AUDIT-${Date.now()}`;
  const startCCRes = await fetch(`${baseUrl}/wms/cycle-counts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      code: cycleCode,
      lines: [
        {
          binId: bin.id,
          productId: product.id,
          countedQty: 320.0, // System has 350 total (300 from B123 + 50 from soon)
        },
      ],
    }),
  });
  assert(startCCRes.status === 200 || startCCRes.status === 201, "Should initiate cycle count");
  const countObj = (await startCCRes.json()) as CycleCount;

  // Record results (system has 350, counted has 320 -> negative variance of 30)
  const resultsCCRes = await fetch(`${baseUrl}/wms/cycle-counts/${countObj.id}/results`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      lines: [
        {
          binId: bin.id,
          productId: product.id,
          countedQty: 320.0,
        },
      ],
    }),
  });
  assert(resultsCCRes.status === 200 || resultsCCRes.status === 201, "Should record cycle count results");

  // Approve cycle count (triggers GL journal postings & updates stock levels)
  const approveCCRes = await fetch(`${baseUrl}/wms/cycle-counts/${countObj.id}/approve`, {
    method: "POST",
    headers,
  });
  if (approveCCRes.status !== 200 && approveCCRes.status !== 201) {
    console.error("Approve CC failed status:", approveCCRes.status, await approveCCRes.json());
  }
  assert(approveCCRes.status === 200 || approveCCRes.status === 201, "Should approve cycle count");

  // Verify stock levels adjusted
  const totalBinQty = await prisma.binStock.aggregate({
    where: { binId: bin.id, productId: product.id },
    _sum: { quantity: true },
  });
  assert(totalBinQty._sum.quantity?.toString() === "320", "Total quantity in bin should be adjusted to 320");

  // Verify journal entries posted
  const journals = await prisma.journalEntry.findMany({
    where: { tenantId, sourceType: "STOCK_MOVEMENT", status: "POSTED" },
    include: { lines: true },
  });
  assert(journals.length > 0, "A journal entry must be posted for cycle count adjustment");
  const adjustJournal = journals[0];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of adjustJournal.lines) {
    totalDebit += Number(line.debit);
    totalCredit += Number(line.credit);
  }
  assert(totalDebit === totalCredit && totalDebit > 0, "GL journal entry must be perfectly balanced");

  // 9. Dashboard Widgets verification
  console.log("Verifying Dashboard WMS widgets...");
  const dbRes = await fetch(`${baseUrl}/dashboard`, { headers });
  assert(dbRes.status === 200, "Dashboard endpoint should succeed");
  const dashboard = (await dbRes.json()) as any;
  assert(dashboard.summary.wms !== undefined, "Dashboard summary response must include a wms block");
  assert(dashboard.summary.wms.emptyBins !== undefined, "Dashboard wms widget should report emptyBins count");

  // 10. Reports export CSV/PDF verification
  console.log("Verifying Report CSV/PDF exports...");
  const csvRes = await fetch(`${baseUrl}/wms/reports/export/csv`, { headers });
  assert(csvRes.status === 200, "CSV export should succeed");
  const csvData = (await csvRes.json()) as { csv: string };
  assert(csvData.csv.includes("BIN-A1"), "CSV export content should contain mapped bins");

  const pdfRes = await fetch(`${baseUrl}/wms/reports/export/pdf`, { headers });
  assert(pdfRes.status === 200, "PDF export should succeed");

  // 11. Security Guard Verification
  console.log("Verifying Security Guards...");
  const badTokenRes = await fetch(`${baseUrl}/wms/zones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ warehouseId: warehouse.id, code: "Z-BAD", name: "Bad" }),
  });
  assert(badTokenRes.status === 401, "Should block unauthenticated requests with 401");

  console.log("All WMS integration tests passed successfully!");
  await app.close();
}

runTests().catch((e) => {
  console.error("Test execution failed with error:", e);
  process.exit(1);
});
