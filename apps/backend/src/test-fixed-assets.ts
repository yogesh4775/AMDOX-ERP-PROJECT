/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, DepreciationMethod, AssetStatus, JournalSourceType } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as argon2 from "argon2";
import { AccountingService } from "./modules/accounting/accounting.service";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Fixed Asset Management integration tests...");
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
  await app.listen(3009);

  const baseUrl = "http://localhost:3009/api";
  let adminToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables in order of dependency
  console.log("Cleaning up database tables...");
  await prisma.taxTransaction.deleteMany({});
  await prisma.paymentAllocation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.salesDeliveryItem.deleteMany({});
  await prisma.salesDelivery.deleteMany({});
  await prisma.salesOrderItem.deleteMany({});
  await prisma.salesOrder.deleteMany({});
  await prisma.purchaseReceiptItem.deleteMany({});
  await prisma.purchaseReceipt.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.stock.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.taxExemption.deleteMany({});
  await prisma.taxRule.deleteMany({});
  await prisma.taxCategory.deleteMany({});
  await prisma.customer.deleteMany({});

  // Fixed asset tables cleanup
  await prisma.assetMaintenance.deleteMany({});
  await prisma.assetTransfer.deleteMany({});
  await prisma.assetDepreciation.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.assetCategory.deleteMany({});

  // 1. Authenticate Admin User (Tenant A)
  console.log("Authenticating Admin (Tenant A)...");
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
  const tenantIdA = adminUser!.tenantId!;
  console.log(`Tenant A ID: ${tenantIdA}`);

  // Seed chart of accounts for Tenant A to ensure Fixed Asset GL codes are present
  const accountingService = app.get(AccountingService);
  await accountingService.seedChartOfAccounts(prisma as any, tenantIdA);

  // 2. Seeding Check: Verify chart of accounts includes Fixed Asset codes
  console.log("Verifying GL accounts presence...");
  const assetGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "1500" } });
  const accumGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "1501" } });
  const expGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "5200" } });
  const gainGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "4100" } });
  const lossGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "5300" } });
  const maintGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "5400" } });
  const cashGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "1020" } }); // Bank account

  assert(!!assetGL && !!accumGL && !!expGL && !!gainGL && !!lossGL && !!maintGL && !!cashGL, "Default GL accounts should be seeded");

  const assetGLId = assetGL!.id;
  const accumGLId = accumGL!.id;
  const expGLId = expGL!.id;
  const gainGLId = gainGL!.id;
  const lossGLId = lossGL!.id;
  const maintGLId = maintGL!.id;
  const cashGLId = cashGL!.id;

  // 3. Asset Category CRUD & Validations
  console.log("Verifying Asset Category CRUD...");
  // Create Category (Machinery - Straight Line)
  const catSLRes = await fetch(`${baseUrl}/fixed-assets/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Machinery & Equipment",
      code: "MACH",
      description: "Industrial machinery and production equipment",
      depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
      usefulLife: 12,
      assetAccountId: assetGLId,
      accumulatedDepreciationAccountId: accumGLId,
      depreciationExpenseAccountId: expGLId,
    }),
  });
  assert(catSLRes.status === 201 || catSLRes.status === 200, "Should create Category successfully");
  const catSL = await catSLRes.json();
  assert(catSL.code === "MACH", "Code check");

  // Verify unique code check
  const dupCodeRes = await fetch(`${baseUrl}/fixed-assets/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Machinery Duplicate",
      code: "MACH",
      depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
      usefulLife: 24,
      assetAccountId: assetGLId,
      accumulatedDepreciationAccountId: accumGLId,
      depreciationExpenseAccountId: expGLId,
    }),
  });
  assert(dupCodeRes.status === 400, "Should fail with 400 on duplicate category code");

  // Verify optimistic concurrency on category update
  const updateCatBadVersion = await fetch(`${baseUrl}/fixed-assets/categories/${catSL.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      description: "Updated description",
      expectedVersion: 99,
    }),
  });
  assert(updateCatBadVersion.status === 409, "Should fail with Conflict on invalid expectedVersion");

  const updateCatRes = await fetch(`${baseUrl}/fixed-assets/categories/${catSL.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      description: "Updated description",
      expectedVersion: catSL.version,
    }),
  });
  assert(updateCatRes.status === 200, "Should update category successfully");
  const updatedCat = await updateCatRes.json();
  assert(updatedCat.version === catSL.version + 1, "Version check");

  // Create Category (Vehicles - Declining Balance)
  const catDBRes = await fetch(`${baseUrl}/fixed-assets/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Motor Vehicles",
      code: "VEHI",
      description: "Delivery vans and corporate cars",
      depreciationMethod: DepreciationMethod.DECLINING_BALANCE,
      usefulLife: 36,
      assetAccountId: assetGLId,
      accumulatedDepreciationAccountId: accumGLId,
      depreciationExpenseAccountId: expGLId,
    }),
  });
  const catDB = await catDBRes.json();

  // 4. Asset Acquisition & Validations
  console.log("Verifying Asset Acquisition...");
  const badAssetRes = await fetch(`${baseUrl}/fixed-assets/assets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      assetCategoryId: catSL.id,
      name: "Bad Asset",
      sku: "BAD-001",
      purchaseDate: new Date().toISOString(),
      purchaseCost: 1000.00,
      salvageValue: 1200.00,
      usefulLife: 10,
      depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
      creditAccountId: cashGLId,
    }),
  });
  assert(badAssetRes.status === 400, "Should block acquisition if salvageValue >= purchaseCost");

  // Acquisition of Asset A (Straight Line)
  const purchaseDate = new Date();
  purchaseDate.setMonth(purchaseDate.getMonth() - 2);

  const acquireARes = await fetch(`${baseUrl}/fixed-assets/assets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      assetCategoryId: catSL.id,
      name: "CNC Milling Machine",
      sku: "CNC-001",
      purchaseDate: purchaseDate.toISOString(),
      purchaseCost: 12000.00,
      salvageValue: 0.00,
      usefulLife: 12,
      depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
      creditAccountId: cashGLId,
      location: "Warehouse A",
      department: "Production",
    }),
  });
  assert(acquireARes.status === 201 || acquireARes.status === 200, "Asset A acquisition should succeed");
  const assetA = await acquireARes.json();
  assert(Number(assetA.bookValue) === 12000.00, "Book value initialized correctly");
  assert(assetA.status === AssetStatus.ACTIVE, "Status is ACTIVE");

  const journalAcq = await prisma.journalEntry.findFirst({
    where: { tenantId: tenantIdA, sourceType: JournalSourceType.ASSET, sourceId: assetA.id },
    include: { lines: { include: { account: true } } },
  });
  assert(!!journalAcq, "Journal entry must be posted for acquisition");
  assert(journalAcq!.lines.length === 2, "2 journal lines check");
  const assetLine = journalAcq!.lines.find((l) => l.account.code === "1500");
  const cashLine = journalAcq!.lines.find((l) => l.account.code === "1020");
  assert(Number(assetLine!.debit) === 12000.00 && Number(cashLine!.credit) === 12000.00, "Acquisition amounts check");

  // Acquisition of Asset B (Declining Balance)
  const acquireBRes = await fetch(`${baseUrl}/fixed-assets/assets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      assetCategoryId: catDB.id,
      name: "Delivery Truck",
      sku: "TRUCK-001",
      purchaseDate: purchaseDate.toISOString(),
      purchaseCost: 10000.00,
      salvageValue: 6000.00,
      usefulLife: 24,
      depreciationMethod: DepreciationMethod.DECLINING_BALANCE,
      depreciationRate: 20.00,
      creditAccountId: cashGLId,
    }),
  });
  const assetB = await acquireBRes.json();

  // 5. Straight Line Depreciation & Capping
  console.log("Verifying Depreciation Run (Straight Line)...");
  const runRes = await fetch(`${baseUrl}/fixed-assets/depreciation/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      depreciationDate: new Date().toISOString(),
    }),
  });
  assert(runRes.status === 201 || runRes.status === 200, "Depreciation run trigger should succeed");
  const runSummary = await runRes.json();

  const dbAssetA = await prisma.asset.findUnique({ where: { id: assetA.id } });
  assert(Number(dbAssetA!.bookValue) === 10000.00, `Expected A bookValue 10000, got ${dbAssetA!.bookValue}`);
  assert(Number(dbAssetA!.accumulatedDepreciation) === 2000.00, "A accumulated depreciation check");

  const deprecLogA = await prisma.assetDepreciation.findFirst({
    where: { tenantId: tenantIdA, assetId: assetA.id },
  });
  assert(!!deprecLogA, "Depreciation log entry created");
  assert(Number(deprecLogA!.amount) === 2000.00, "Log amount check");

  const journalDeprec = await prisma.journalEntry.findFirst({
    where: { tenantId: tenantIdA, sourceType: JournalSourceType.ASSET, sourceId: deprecLogA!.id },
    include: { lines: { include: { account: true } } },
  });
  assert(!!journalDeprec, "Journal entry posted for depreciation");
  const expLine = journalDeprec!.lines.find((l) => l.account.code === "5200");
  const accumLine = journalDeprec!.lines.find((l) => l.account.code === "1501");
  assert(Number(expLine!.debit) === 2000.00 && Number(accumLine!.credit) === 2000.00, "Depreciation journal lines check");

  // Verify duplicate run prevention
  const runAgainRes = await fetch(`${baseUrl}/fixed-assets/depreciation/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      depreciationDate: new Date().toISOString(),
    }),
  });
  const runAgainSummary = await runAgainRes.json();
  assert(runAgainSummary.processedAssets.length === 0, "Duplicate depreciation run should not update anything");

  // Verify Salvage Value protection
  const acquireCRes = await fetch(`${baseUrl}/fixed-assets/assets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      assetCategoryId: catSL.id,
      name: "Low Life Device",
      sku: "DEV-001",
      purchaseDate: purchaseDate.toISOString(),
      purchaseCost: 10000.00,
      salvageValue: 9500.00,
      usefulLife: 12,
      depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
      creditAccountId: cashGLId,
    }),
  });
  const assetC = await acquireCRes.json();

  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 1);

  await fetch(`${baseUrl}/fixed-assets/depreciation/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      depreciationDate: futureDate.toISOString(),
    }),
  });

  const dbAssetC = await prisma.asset.findUnique({ where: { id: assetC.id } });
  assert(Number(dbAssetC!.bookValue) >= 9500.00, "Book value must not go below salvage value");

  // 6. Declining Balance Depreciation
  console.log("Verifying Declining Balance Depreciation...");
  const dbAssetB = await prisma.asset.findUnique({ where: { id: assetB.id } });
  assert(Number(dbAssetB!.bookValue) < 10000.00, "Asset B declining balance depreciation applied");

  // 7. Asset Transfer & History
  console.log("Verifying Asset Transfer...");
  const freshAssetA = await prisma.asset.findUnique({ where: { id: assetA.id } });

  const transferBadRes = await fetch(`${baseUrl}/fixed-assets/assets/${assetA.id}/transfer`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      transferDate: new Date().toISOString(),
      toLocation: "Warehouse B",
      toDepartment: "Logistics",
      expectedVersion: 99,
    }),
  });
  assert(transferBadRes.status === 409, "Should block transfer on incorrect version");

  const transferRes = await fetch(`${baseUrl}/fixed-assets/assets/${assetA.id}/transfer`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      transferDate: new Date().toISOString(),
      toLocation: "Warehouse B",
      toDepartment: "Logistics",
      reason: "Asset redeployment",
      expectedVersion: freshAssetA!.version,
    }),
  });
  assert(transferRes.status === 200, "Transfer should succeed");
  const transferredAsset = await transferRes.json();
  assert(transferredAsset.location === "Warehouse B" && transferredAsset.department === "Logistics", "Location and department updated");

  const transHistory = await prisma.assetTransfer.findMany({ where: { assetId: assetA.id } });
  assert(transHistory.length === 1, "Transfer log created");
  assert(transHistory[0].fromLocation === "Warehouse A" && transHistory[0].toLocation === "Warehouse B", "Transfer locations match");

  // 8. Asset Maintenance (Expense & Capitalized)
  console.log("Verifying Asset Maintenance...");
  const assetAfterTransfer = await prisma.asset.findUnique({ where: { id: assetA.id } });

  // Expensed maintenance
  const maintExpRes = await fetch(`${baseUrl}/fixed-assets/assets/${assetA.id}/maintenance`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      maintenanceDate: new Date().toISOString(),
      description: "Routine calibration",
      cost: 500.00,
      provider: "Tech Services Inc",
      isCapitalized: false,
      creditAccountId: cashGLId,
      expenseAccountId: maintGLId,
      expectedVersion: assetAfterTransfer!.version,
    }),
  });
  assert(maintExpRes.status === 201 || maintExpRes.status === 200, "Expensed maintenance recording should succeed");
  const expMaintAsset = await maintExpRes.json();
  assert(Number(expMaintAsset.bookValue) === Number(assetAfterTransfer!.bookValue), "Expensed maintenance does not change bookValue");

  const expMaintLog = await prisma.assetMaintenance.findFirst({
    where: { assetId: assetA.id, isCapitalized: false },
  });
  const journalMaintExp = await prisma.journalEntry.findFirst({
    where: { tenantId: tenantIdA, sourceType: JournalSourceType.ASSET, sourceId: expMaintLog!.id },
    include: { lines: { include: { account: true } } },
  });
  assert(!!journalMaintExp, "Journal entry posted for expensed maintenance");
  const expLine2 = journalMaintExp!.lines.find((l) => l.account.code === "5400");
  assert(Number(expLine2!.debit) === 500.00, "Maintenance expense debit amount check");

  // Capitalized maintenance
  const maintCapRes = await fetch(`${baseUrl}/fixed-assets/assets/${assetA.id}/maintenance`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      maintenanceDate: new Date().toISOString(),
      description: "Major system upgrade",
      cost: 1500.00,
      provider: "Tech Services Inc",
      isCapitalized: true,
      creditAccountId: cashGLId,
      expectedVersion: expMaintAsset.version,
    }),
  });
  assert(maintCapRes.status === 201 || maintCapRes.status === 200, "Capitalized maintenance recording should succeed");
  const capMaintAsset = await maintCapRes.json();
  assert(Number(capMaintAsset.bookValue) === Number(expMaintAsset.bookValue) + 1500.00, "Capitalized maintenance increases bookValue");

  // 9. Asset Disposal & Gain/Loss
  console.log("Verifying Asset Disposal...");
  const assetBeforeDisposal = await prisma.asset.findUnique({ where: { id: assetA.id } });

  const disposeRes = await fetch(`${baseUrl}/fixed-assets/assets/${assetA.id}/dispose`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      disposalDate: new Date().toISOString(),
      saleValue: 13000.00,
      cashAccountId: cashGLId,
      gainAccountId: gainGLId,
      lossAccountId: lossGLId,
      expectedVersion: assetBeforeDisposal!.version,
    }),
  });
  assert(disposeRes.status === 201 || disposeRes.status === 200, "Disposal recording should succeed");
  const disposedAsset = await disposeRes.json();
  assert(disposedAsset.status === AssetStatus.DISPOSED, "Status set to DISPOSED");
  assert(Number(disposedAsset.bookValue) === 0, "Book value set to 0");

  const journalDisposal = await prisma.journalEntry.findFirst({
    where: { tenantId: tenantIdA, sourceType: JournalSourceType.ASSET, sourceId: assetA.id, description: { contains: "Disposal" } },
    include: { lines: { include: { account: true } } },
  });
  assert(!!journalDisposal, "Journal entry posted for disposal");

  // Check disposed asset operations blocked
  const badTransfer = await fetch(`${baseUrl}/fixed-assets/assets/${assetA.id}/transfer`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      transferDate: new Date().toISOString(),
      toLocation: "Warehouse C",
      toDepartment: "IT",
      expectedVersion: disposedAsset.version,
    }),
  });
  assert(badTransfer.status === 400, "Should block transfers on a disposed asset");

  // 10. Dashboard summary & reports export
  console.log("Verifying Reporting and Export compatibility...");
  const dashRes = await fetch(`${baseUrl}/fixed-assets/dashboard/summary`, { headers });
  assert(dashRes.status === 200, "Dashboard fetch succeeds");
  const dash = await dashRes.json();
  assert(Number(dash.totalAssetsCount) > 0, "Assets count > 0");

  const exportCsvRes = await fetch(`${baseUrl}/fixed-assets/assets?export=csv`, { headers });
  assert(exportCsvRes.status === 200, "CSV export succeeds");
  const csvText = await exportCsvRes.text();
  assert(csvText.includes("ID,SKU,Name,Category,Status"), "CSV headers check");

  const exportPdfRes = await fetch(`${baseUrl}/fixed-assets/assets?export=pdf`, { headers });
  assert(exportPdfRes.status === 200, "PDF export succeeds");
  const pdfData = await exportPdfRes.json();
  assert(pdfData.title === "ENTERPRISE ASSET REGISTER REPORT", "PDF title check");

  // 11. Verify Tenant Isolation
  console.log("Verifying Tenant Isolation...");
  const tenantIdB = "11111111-1111-1111-1111-111111111111";
  await prisma.tenant.upsert({
    where: { id: tenantIdB },
    update: {},
    create: { id: tenantIdB, name: "Tenant B Corp", slug: "tenant-b" },
  });

  // Seed chart of accounts for Tenant B
  await accountingService.seedChartOfAccounts(prisma as any, tenantIdB);

  const passwordHash = await argon2.hash("Password_1234_Special!");
  const userB = await prisma.user.upsert({
    where: { email: "userb@amdox.com" },
    update: { tenantId: tenantIdB, passwordHash },
    create: { email: "userb@amdox.com", username: "userb_admin", passwordHash, tenantId: tenantIdB },
  });

  const roleB = await prisma.role.upsert({
    where: { name_tenantId: { name: "Admin", tenantId: tenantIdB } },
    update: {},
    create: { name: "Admin", tenantId: tenantIdB },
  });

  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roleB.id, permissionId: perm.id } },
      update: {},
      create: { roleId: roleB.id, permissionId: perm.id },
    });
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: userB.id, roleId: roleB.id } },
    update: {},
    create: { userId: userB.id, roleId: roleB.id, tenantId: tenantIdB },
  });

  const loginBRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "userb@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  const loginBData = await loginBRes.json();
  const headersB = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginBData.accessToken}`,
  };

  const assetsBRes = await fetch(`${baseUrl}/fixed-assets/assets`, { headers: headersB });
  const assetsB = await assetsBRes.json();
  assert(assetsB.length === 0, "Tenant B should not see Tenant A's assets");

  const badUpdateCat = await fetch(`${baseUrl}/fixed-assets/categories/${catSL.id}`, {
    method: "PATCH",
    headers: headersB,
    body: JSON.stringify({
      description: "Hacked",
      expectedVersion: 1,
    }),
  });
  assert(badUpdateCat.status === 404, "Tenant B should get 404 on Tenant A category");

  // 12. Verify Health check
  console.log("Verifying health check...");
  const healthRes = await fetch("http://localhost:3009/health");
  assert(healthRes.status === 200, "Health check must be up");

  console.log("==============================================");
  console.log("ALL FIXED ASSET MANAGEMENT E2E TESTS PASSED!");
  console.log("==============================================");

  await app.close();
  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test execution failed with error:", e);
  process.exit(1);
});
