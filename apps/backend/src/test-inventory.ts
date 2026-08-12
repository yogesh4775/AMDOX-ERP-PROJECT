/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Inventory integration tests...");
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
  await app.listen(3003);

  const baseUrl = "http://localhost:3003/api";
  let adminToken = "";
  const suffix = ` ${Date.now()}`;

  // Helper assertion
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

  // 2. Setup Master Data Prerequisites
  console.log("Creating test master data prerequisites...");
  
  // Category
  const createCatRes = await fetch(`${baseUrl}/master-data/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Inv Category" + suffix }),
  });
  assert(createCatRes.status === 201, "Create category should succeed");
  const category = (await createCatRes.json()) as { id: string };

  // Unit
  const createUnitRes = await fetch(`${baseUrl}/master-data/units`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Inv Unit" + suffix, symbol: "pcs" }),
  });
  assert(createUnitRes.status === 201, "Create unit should succeed");
  const unit = (await createUnitRes.json()) as { id: string };

  // Tax Category
  const createTaxRes = await fetch(`${baseUrl}/master-data/tax-categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Inv Tax" + suffix, rate: 10, isDefault: false }),
  });
  assert(createTaxRes.status === 201, "Create tax category should succeed");
  const taxCategory = (await createTaxRes.json()) as { id: string };

  // Warehouse A
  const createWhARes = await fetch(`${baseUrl}/master-data/warehouses`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Warehouse A" + suffix, code: "WHA" + Date.now() }),
  });
  assert(createWhARes.status === 201, "Create Warehouse A should succeed");
  const warehouseA = (await createWhARes.json()) as { id: string };

  // Warehouse B
  const createWhBRes = await fetch(`${baseUrl}/master-data/warehouses`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Warehouse B" + suffix, code: "WHB" + Date.now() }),
  });
  assert(createWhBRes.status === 201, "Create Warehouse B should succeed");
  const warehouseB = (await createWhBRes.json()) as { id: string };

  // ---------------------------------------------------------------------------
  // TEST: PRODUCT CRUD & UNIQUENESS
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Product CRUD & Uniqueness ---");

  const sku = "SKU-" + Date.now();
  const barcode = "BAR-" + Date.now();

  // Create Product
  const createProdRes = await fetch(`${baseUrl}/inventory/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Product 1" + suffix,
      sku,
      barcode,
      description: "Test Product Description",
      categoryId: category.id,
      unitId: unit.id,
      taxCategoryId: taxCategory.id,
      costPrice: 50.0,
      salePrice: 90.0,
      reorderLevel: 5,
      reorderQuantity: 20,
    }),
  });
  assert(createProdRes.status === 201, "Create product should succeed");
  const product = (await createProdRes.json()) as { id: string; version: number };
  assert(product.id !== undefined, "Product ID is defined");
  assert(product.version === 1, "Initial product version is 1");

  // SKU Uniqueness
  const createDupSkuRes = await fetch(`${baseUrl}/inventory/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Product Duplicate SKU" + suffix,
      sku,
      categoryId: category.id,
      unitId: unit.id,
    }),
  });
  assert(createDupSkuRes.status === 400, "Duplicate SKU should be rejected");

  // Barcode Uniqueness
  const createDupBarRes = await fetch(`${baseUrl}/inventory/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Product Duplicate Barcode" + suffix,
      sku: "SKU-DIFFERENT",
      barcode,
      categoryId: category.id,
      unitId: unit.id,
    }),
  });
  assert(createDupBarRes.status === 400, "Duplicate Barcode should be rejected");

  // Read Single Product
  const getProdRes = await fetch(`${baseUrl}/inventory/products/${product.id}`, { headers });
  assert(getProdRes.status === 200, "Get product details should succeed");

  // Update Product (Success)
  const updateProdRes = await fetch(`${baseUrl}/inventory/products/${product.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Product 1 Updated" + suffix,
      expectedVersion: 1,
    }),
  });
  assert(updateProdRes.status === 200, "Update product details should succeed");
  const updatedProd = (await updateProdRes.json()) as { version: number };
  assert(updatedProd.version === 2, "Product version incremented to 2");

  // Update Product (Optimistic Concurrency Conflict)
  const conflictUpdateProdRes = await fetch(`${baseUrl}/inventory/products/${product.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Product 1 Stale Update",
      expectedVersion: 1, // Stale version
    }),
  });
  assert(conflictUpdateProdRes.status === 409, "Stale version update must return 409 Conflict");

  // Soft Delete Product
  const deleteProdRes = await fetch(`${baseUrl}/inventory/products/${product.id}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ expectedVersion: 2 }),
  });
  assert(deleteProdRes.status === 200, "Delete product should succeed");

  // Verify deleted product is not in default active list
  const listActiveProdRes = await fetch(`${baseUrl}/inventory/products`, { headers });
  const activeProds = (await listActiveProdRes.json()) as { data: any[] };
  assert(activeProds.data.every((p) => p.id !== product.id), "Deleted product should not appear in active listing");

  // Restore Product
  const restoreProdRes = await fetch(`${baseUrl}/inventory/products/${product.id}/restore`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedVersion: 3 }),
  });
  assert(restoreProdRes.status === 200, "Restore product should succeed");

  // ---------------------------------------------------------------------------
  // TEST: STOCK ADJUSTMENTS & INTEGRITY
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Stock Adjustments & Integrity ---");

  // Check initial stock
  const initStockRes = await fetch(
    `${baseUrl}/inventory/stock?productId=${product.id}&warehouseId=${warehouseA.id}`,
    { headers }
  );
  assert(initStockRes.status === 200, "Stock query should succeed");
  const initStockData = (await initStockRes.json()) as { data: any[] };
  const initialQty = initStockData.data.length > 0 ? Number(initStockData.data[0].quantity) : 0;
  assert(initialQty === 0, "Initial stock should be 0");

  // Create Stock Adjustment draft
  const createAdjRes = await fetch(`${baseUrl}/inventory/adjustments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      warehouseId: warehouseA.id,
      note: "Initial stock adjustment",
      lines: [
        {
          productId: product.id,
          type: "INCREMENT",
          quantity: 10.0,
          reason: "Received shipment",
        },
      ],
    }),
  });
  assert(createAdjRes.status === 201, "Create adjustment draft should succeed");
  const adjustment = (await createAdjRes.json()) as { id: string; version: number };
  assert(adjustment.version === 1, "Initial adjustment version is 1");

  // Update Adjustment draft
  const updateAdjRes = await fetch(`${baseUrl}/inventory/adjustments/${adjustment.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      note: "Updated initial stock adjustment",
      expectedVersion: 1,
    }),
  });
  assert(updateAdjRes.status === 200, "Update adjustment draft should succeed");
  const updatedAdj = (await updateAdjRes.json()) as { version: number };
  assert(updatedAdj.version === 2, "Adjustment version incremented to 2");

  // Approve Stock Adjustment
  const approveAdjRes = await fetch(`${baseUrl}/inventory/adjustments/${adjustment.id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedVersion: 2 }),
  });
  assert(approveAdjRes.status === 200, "Approve adjustment should succeed");

  // Verify stock balance has changed
  const postAdjStockRes = await fetch(
    `${baseUrl}/inventory/stock?productId=${product.id}&warehouseId=${warehouseA.id}`,
    { headers }
  );
  const postAdjStockData = (await postAdjStockRes.json()) as { data: any[] };
  assert(postAdjStockData.data.length > 0, "Stock row must now exist");
  assert(Number(postAdjStockData.data[0].quantity) === 10.0, "Stock should be incremented to 10.0");

  // Double Approval Prevention
  const doubleApproveAdjRes = await fetch(`${baseUrl}/inventory/adjustments/${adjustment.id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedVersion: 3 }),
  });
  assert(doubleApproveAdjRes.status === 400, "Double approval of adjustment must be rejected");

  // Modify Approved Adjustment Prevention
  const modifyApprovedAdjRes = await fetch(`${baseUrl}/inventory/adjustments/${adjustment.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      note: "Hack note",
      expectedVersion: 3,
    }),
  });
  assert(modifyApprovedAdjRes.status === 400, "Modifying approved adjustment must be rejected");

  // ---------------------------------------------------------------------------
  // TEST: NEGATIVE STOCK REJECTION & STOCK TRANSFERS
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Stock Transfers & Negative Balance Prevention ---");

  // Try Stock Transfer that exceeds current balance (15 units from A to B) -> should create draft successfully
  const createFailedTrfRes = await fetch(`${baseUrl}/inventory/transfers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fromWarehouseId: warehouseA.id,
      toWarehouseId: warehouseB.id,
      note: "Transfer draft exceeding balance",
      lines: [
        {
          productId: product.id,
          quantity: 15.0,
        },
      ],
    }),
  });
  assert(createFailedTrfRes.status === 201, "Create transfer draft exceeding balance should succeed");
  const failedTransfer = (await createFailedTrfRes.json()) as { id: string; version: number };

  // Processing it should fail (Negative stock protection rejection)
  const processFailedTrfRes = await fetch(`${baseUrl}/inventory/transfers/${failedTransfer.id}/process`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(processFailedTrfRes.status === 400, "Processing transfer exceeding balance must be rejected (Negative stock prevention)");

  // Create valid Stock Transfer (6 units from A to B)
  const createValidTrfRes = await fetch(`${baseUrl}/inventory/transfers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fromWarehouseId: warehouseA.id,
      toWarehouseId: warehouseB.id,
      note: "Valid transfer",
      lines: [
        {
          productId: product.id,
          quantity: 6.0,
        },
      ],
    }),
  });
  assert(createValidTrfRes.status === 201, "Create valid transfer draft should succeed");
  const validTransfer = (await createValidTrfRes.json()) as { id: string; version: number };

  // Process valid Stock Transfer
  const processValidTrfRes = await fetch(`${baseUrl}/inventory/transfers/${validTransfer.id}/process`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(processValidTrfRes.status === 200, "Processing valid transfer should succeed");

  // Verify stock balance has changed
  // Warehouse A should have 10 - 6 = 4 units
  const stockARes = await fetch(
    `${baseUrl}/inventory/stock?productId=${product.id}&warehouseId=${warehouseA.id}`,
    { headers }
  );
  const stockAData = (await stockARes.json()) as { data: any[] };
  assert(Number(stockAData.data[0].quantity) === 4.0, "Warehouse A should have 4.0 units left");

  // Warehouse B should have 0 + 6 = 6 units
  const stockBRes = await fetch(
    `${baseUrl}/inventory/stock?productId=${product.id}&warehouseId=${warehouseB.id}`,
    { headers }
  );
  const stockBData = (await stockBRes.json()) as { data: any[] };
  assert(Number(stockBData.data[0].quantity) === 6.0, "Warehouse B should have 6.0 units");

  // Double Processing Prevention
  const doubleProcessTrfRes = await fetch(`${baseUrl}/inventory/transfers/${validTransfer.id}/process`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedVersion: 2 }),
  });
  assert(doubleProcessTrfRes.status === 400, "Double processing of transfer must be rejected");

  // ---------------------------------------------------------------------------
  // TEST: STOCK MOVEMENT HISTORY & AUDITING
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Stock Movement History & Auditing ---");

  // Query movements
  const movementsRes = await fetch(`${baseUrl}/inventory/stock/movements?productId=${product.id}`, { headers });
  assert(movementsRes.status === 200, "Query stock movements should succeed");
  const movementsData = (await movementsRes.json()) as { data: any[] };
  
  // Verify append-only movement history has the records
  assert(movementsData.data.length >= 3, "There should be at least 3 stock movements logged");
  
  const hasAdj = movementsData.data.some((m) => m.type === "ADJUSTMENT" && Number(m.quantity) === 10);
  const hasTrfOut = movementsData.data.some((m) => m.type === "TRANSFER_OUT" && Number(m.quantity) === -6);
  const hasTrfIn = movementsData.data.some((m) => m.type === "TRANSFER_IN" && Number(m.quantity) === 6);

  assert(hasAdj, "Adjustment movement logged correctly");
  assert(hasTrfOut, "Transfer Out movement logged correctly");
  assert(hasTrfIn, "Transfer In movement logged correctly");

  // Audit Logs Verification
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "PRODUCT_CREATED",
          "PRODUCT_UPDATED",
          "PRODUCT_DELETED",
          "PRODUCT_RESTORED",
          "STOCK_TRANSFER_CREATED",
          "STOCK_TRANSFER_COMPLETED",
          "STOCK_ADJUSTMENT_CREATED",
          "STOCK_ADJUSTMENT_APPROVED",
        ],
      },
    },
  });

  assert(auditLogs.some((l) => l.action === "PRODUCT_CREATED"), "PRODUCT_CREATED audit exists");
  assert(auditLogs.some((l) => l.action === "PRODUCT_UPDATED"), "PRODUCT_UPDATED audit exists");
  assert(auditLogs.some((l) => l.action === "PRODUCT_DELETED"), "PRODUCT_DELETED audit exists");
  assert(auditLogs.some((l) => l.action === "PRODUCT_RESTORED"), "PRODUCT_RESTORED audit exists");
  assert(auditLogs.some((l) => l.action === "STOCK_TRANSFER_CREATED"), "STOCK_TRANSFER_CREATED audit exists");
  assert(auditLogs.some((l) => l.action === "STOCK_TRANSFER_COMPLETED"), "STOCK_TRANSFER_COMPLETED audit exists");
  assert(auditLogs.some((l) => l.action === "STOCK_ADJUSTMENT_CREATED"), "STOCK_ADJUSTMENT_CREATED audit exists");
  assert(auditLogs.some((l) => l.action === "STOCK_ADJUSTMENT_APPROVED"), "STOCK_ADJUSTMENT_APPROVED audit exists");

  // ---------------------------------------------------------------------------
  // TEST: TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Tenant Isolation ---");

  // Authenticate Tenant B User
  const loginBRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "user.b@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginBRes.status === 200 || loginBRes.status === 201, "Tenant B login should succeed");
  const loginBData = (await loginBRes.json()) as { accessToken: string };
  const tenantBHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginBData.accessToken}`,
  };

  // Tenant B tries to read Tenant A's product -> expect 403 Forbidden or 404 Not Found
  const tenantBReadProdRes = await fetch(`${baseUrl}/inventory/products/${product.id}`, { headers: tenantBHeaders });
  assert(tenantBReadProdRes.status === 403 || tenantBReadProdRes.status === 404, "Tenant B reading Tenant A product must be rejected");

  // ---------------------------------------------------------------------------
  // TEST: HEALTH ENDPOINT FUNCTIONALITY
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Health Endpoint ---");
  const healthRes = await fetch(`http://localhost:3003/health`);
  assert(healthRes.status === 200, "Health check endpoint must return 200 OK");

  console.log("\nAll Inventory Integration Tests Passed Successfully! 🚀");

  await app.close();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error("Inventory Integration tests failed:", err);
  process.exit(1);
});
