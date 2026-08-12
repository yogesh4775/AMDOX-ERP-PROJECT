/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, PurchaseOrderStatus } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Purchase integration tests...");
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
  await app.listen(3004);

  const baseUrl = "http://localhost:3004/api";
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

  // 2. Setup Prerequisites (Prerequisite Master Data & Inventory)
  console.log("Creating prerequisites (Category, Unit, TaxCategory, Warehouse, Product)...");

  // Category
  const createCatRes = await fetch(`${baseUrl}/master-data/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Purch Category" + suffix }),
  });
  assert(createCatRes.status === 201, "Create category should succeed");
  const category = (await createCatRes.json()) as { id: string };

  // Unit
  const createUnitRes = await fetch(`${baseUrl}/master-data/units`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Purch Unit" + suffix, symbol: "box" }),
  });
  assert(createUnitRes.status === 201, "Create unit should succeed");
  const unit = (await createUnitRes.json()) as { id: string };

  // Tax Category
  const createTaxRes = await fetch(`${baseUrl}/master-data/tax-categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Purch Tax" + suffix, rate: 5, isDefault: false }),
  });
  assert(createTaxRes.status === 201, "Create tax category should succeed");
  const taxCategory = (await createTaxRes.json()) as { id: string };

  // Warehouse
  const createWhRes = await fetch(`${baseUrl}/master-data/warehouses`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Purch Warehouse" + suffix, code: "PWH" + Date.now() }),
  });
  assert(createWhRes.status === 201, "Create Warehouse should succeed");
  const warehouse = (await createWhRes.json()) as { id: string };

  // Product
  const sku = "SKU-PO-" + Date.now();
  const createProdRes = await fetch(`${baseUrl}/inventory/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Purchase Product" + suffix,
      sku,
      categoryId: category.id,
      unitId: unit.id,
      taxCategoryId: taxCategory.id,
      costPrice: 100.0,
      salePrice: 150.0,
    }),
  });
  assert(createProdRes.status === 201, "Create product should succeed");
  const product = (await createProdRes.json()) as { id: string };

  // ---------------------------------------------------------------------------
  // TEST: PURCHASE ORDER CRUD (DRAFT STATUS)
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Purchase Order CRUD ---");

  const expectedDeliveryDate = new Date();
  expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 7); // 7 days in future

  // Create
  const createPoRes = await fetch(`${baseUrl}/purchase`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      supplierName: "  Global   Suppliers Inc  ", // Test normalization spacing
      expectedDeliveryDate: expectedDeliveryDate.toISOString(),
      notes: "Initial purchase order notes.",
      items: [
        {
          productId: product.id,
          quantity: 50.0,
          unitPrice: 90.0,
        },
      ],
    }),
  });
  assert(createPoRes.status === 201, "Create purchase order should succeed");
  const po = (await createPoRes.json()) as { id: string; orderNumber: string; supplierName: string; status: string; totalAmount: string; version: number };
  assert(po.id !== undefined, "Purchase Order ID is defined");
  assert(po.supplierName === "Global Suppliers Inc", "Supplier name space collapsed correctly");
  assert(po.orderNumber.startsWith("PO-"), "PO number format matches prefix PO-");
  assert(Number(po.totalAmount) === 4500.0, "Total amount computed correctly (50 * 90)");
  assert(po.status === PurchaseOrderStatus.DRAFT, "Initial status is DRAFT");
  assert(po.version === 1, "Initial version is 1");

  // Read Single
  const getPoRes = await fetch(`${baseUrl}/purchase/${po.id}`, { headers });
  assert(getPoRes.status === 200, "Get purchase order should succeed");
  const getPoData = (await getPoRes.json()) as { supplierName: string };
  assert(getPoData.supplierName === "Global Suppliers Inc", "Fetched supplier matches Normalized one");

  // Update
  const updatePoRes = await fetch(`${baseUrl}/purchase/${po.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      supplierName: "Global Suppliers Inc Updated",
      expectedVersion: 1,
    }),
  });
  assert(updatePoRes.status === 200, "Update PO should succeed");
  const updatedPo = (await updatePoRes.json()) as { version: number; supplierName: string };
  assert(updatedPo.version === 2, "PO version incremented to 2");
  assert(updatedPo.supplierName === "Global Suppliers Inc Updated", "Supplier name updated");

  // ---------------------------------------------------------------------------
  // TEST: OPTIMISTIC CONCURRENCY LOCK CHECK
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Optimistic Concurrency ---");
  const conflictUpdateRes = await fetch(`${baseUrl}/purchase/${po.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      notes: "Stale update note",
      expectedVersion: 1, // Stale version (should be 2)
    }),
  });
  assert(conflictUpdateRes.status === 409, "Stale version update must return 409 Conflict");

  // ---------------------------------------------------------------------------
  // TEST: PURCHASE ORDER APPROVAL
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Purchase Order Approval ---");
  const approveRes = await fetch(`${baseUrl}/purchase/${po.id}/approve`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 2 }),
  });
  assert(approveRes.status === 200, "Approve PO should succeed");
  const approvedPo = (await approveRes.json()) as { status: string; version: number };
  assert(approvedPo.status === PurchaseOrderStatus.APPROVED, "Status shifted to APPROVED");
  assert(approvedPo.version === 3, "Version incremented to 3");

  // Verify approval notification
  const notifyRes = await fetch(`${baseUrl}/notifications?unreadOnly=true`, { headers });
  const notifyData = (await notifyRes.json()) as { data: any[] };
  const hasApproveNotify = notifyData.data.some((n) => n.title === "Purchase Order Approved" && n.message.includes(po.orderNumber));
  assert(hasApproveNotify, "PO Approval notification registered cleanly");

  // Duplicate Approval block (Idempotency)
  const dupApproveRes = await fetch(`${baseUrl}/purchase/${po.id}/approve`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 3 }),
  });
  assert(dupApproveRes.status === 400, "Duplicate PO approval must be blocked");

  // Immutable Approved Order check
  const updateApprovedRes = await fetch(`${baseUrl}/purchase/${po.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      supplierName: "Stale Supplier Change",
      expectedVersion: 3,
    }),
  });
  assert(updateApprovedRes.status === 400, "Updating approved PO must be rejected");

  // ---------------------------------------------------------------------------
  // TEST: PARTIAL & COMPLETE RECEIPT WITH INVENTORY INTEGRATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Purchase Order Receiving & Stock Ingestion ---");

  // Check initial stock balance (Should be 0)
  const initStockRes = await fetch(
    `${baseUrl}/inventory/stock?productId=${product.id}&warehouseId=${warehouse.id}`,
    { headers }
  );
  const initStockData = (await initStockRes.json()) as { data: any[] };
  const initQty = initStockData.data.length > 0 ? Number(initStockData.data[0].quantity) : 0;
  assert(initQty === 0, "Initial product stock is 0");

  // Receive Partial (20 units of 50 ordered)
  const partialRecRes = await fetch(`${baseUrl}/purchase/${po.id}/receive`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      remarks: "Received partial shipment",
      expectedVersion: 3,
      items: [
        {
          productId: product.id,
          quantityReceived: 20.0,
        },
      ],
    }),
  });
  assert(partialRecRes.status === 200, "Partial receive should succeed");
  const partialPo = (await partialRecRes.json()) as { status: string; version: number };
  assert(partialPo.status === PurchaseOrderStatus.PARTIALLY_RECEIVED, "Status changed to PARTIALLY_RECEIVED");
  assert(partialPo.version === 4, "Version incremented to 4");

  // Assert Stock increased in inventory module
  const partialStockRes = await fetch(
    `${baseUrl}/inventory/stock?productId=${product.id}&warehouseId=${warehouse.id}`,
    { headers }
  );
  const partialStockData = (await partialStockRes.json()) as { data: any[] };
  assert(Number(partialStockData.data[0].quantity) === 20.0, "Inventory stock increased to 20.0");

  // Assert StockMovement log added
  const movementsRes = await fetch(`${baseUrl}/inventory/stock/movements?productId=${product.id}`, { headers });
  const movementsData = (await movementsRes.json()) as { data: any[] };
  const hasPartialMove = movementsData.data.some((m) => m.type === "STOCK_IN" && Number(m.quantity) === 20.0);
  assert(hasPartialMove, "Partial stock ingestion movement logged");

  // Try to receive exceeding remaining quantity (40 units when only 30 are left) -> expect 400
  const exceedRecRes = await fetch(`${baseUrl}/purchase/${po.id}/receive`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      remarks: "Try exceeding remaining",
      expectedVersion: 4,
      items: [
        {
          productId: product.id,
          quantityReceived: 40.0,
        },
      ],
    }),
  });
  assert(exceedRecRes.status === 400, "Receiving exceeding quantities must be rejected");

  // Receive Remaining (30 units)
  const completeRecRes = await fetch(`${baseUrl}/purchase/${po.id}/receive`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      remarks: "Received complete remaining shipment",
      expectedVersion: 4,
      items: [
        {
          productId: product.id,
          quantityReceived: 30.0,
        },
      ],
    }),
  });
  assert(completeRecRes.status === 200, "Complete receive should succeed");
  const completePo = (await completeRecRes.json()) as { status: string; version: number };
  assert(completePo.status === PurchaseOrderStatus.COMPLETED, "Status changed to COMPLETED");
  assert(completePo.version === 5, "Version incremented to 5");

  // Assert Stock increased to 50
  const completeStockRes = await fetch(
    `${baseUrl}/inventory/stock?productId=${product.id}&warehouseId=${warehouse.id}`,
    { headers }
  );
  const completeStockData = (await completeStockRes.json()) as { data: any[] };
  assert(Number(completeStockData.data[0].quantity) === 50.0, "Inventory stock increased to 50.0 total");

  // Double receiving on completed PO block (Idempotency)
  const dupRecRes = await fetch(`${baseUrl}/purchase/${po.id}/receive`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      remarks: "Try duplicate receive",
      expectedVersion: 5,
      items: [
        {
          productId: product.id,
          quantityReceived: 10.0,
        },
      ],
    }),
  });
  assert(dupRecRes.status === 400, "Receiving on COMPLETED PO must be blocked");

  // ---------------------------------------------------------------------------
  // TEST: PURCHASE ORDER CANCELLATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Purchase Order Cancellation ---");

  // Create another draft PO to test cancellation from DRAFT
  const cancelDraftRes = await fetch(`${baseUrl}/purchase`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      supplierName: "Cancel Supplier A",
      expectedDeliveryDate: expectedDeliveryDate.toISOString(),
      items: [{ productId: product.id, quantity: 10, unitPrice: 80 }],
    }),
  });
  const cancelPoDraft = (await cancelDraftRes.json()) as { id: string };

  const executeCancelDraftRes = await fetch(`${baseUrl}/purchase/${cancelPoDraft.id}/cancel`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(executeCancelDraftRes.status === 200, "Cancel draft PO should succeed");
  const cancelledDraftPo = (await executeCancelDraftRes.json()) as { status: string };
  assert(cancelledDraftPo.status === PurchaseOrderStatus.CANCELLED, "Draft PO status shifted to CANCELLED");

  // Create another draft, approve it, then cancel from APPROVED
  const cancelApproveRes = await fetch(`${baseUrl}/purchase`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      supplierName: "Cancel Supplier B",
      expectedDeliveryDate: expectedDeliveryDate.toISOString(),
      items: [{ productId: product.id, quantity: 10, unitPrice: 80 }],
    }),
  });
  const cancelPoApproved = (await cancelApproveRes.json()) as { id: string };

  await fetch(`${baseUrl}/purchase/${cancelPoApproved.id}/approve`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });

  const executeCancelApproveRes = await fetch(`${baseUrl}/purchase/${cancelPoApproved.id}/cancel`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 2 }),
  });
  assert(executeCancelApproveRes.status === 200, "Cancel approved PO should succeed");
  const cancelledAppPo = (await executeCancelApproveRes.json()) as { status: string };
  assert(cancelledAppPo.status === PurchaseOrderStatus.CANCELLED, "Approved PO status shifted to CANCELLED");

  // Cancel completed PO block
  const cancelCompletedRes = await fetch(`${baseUrl}/purchase/${po.id}/cancel`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 5 }),
  });
  assert(cancelCompletedRes.status === 400, "Cancelling completed PO must be blocked");

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

  // Tenant B tries to read Tenant A's PO -> expect 403 Forbidden or 404 Not Found
  const tenantBReadPoRes = await fetch(`${baseUrl}/purchase/${po.id}`, { headers: tenantBHeaders });
  assert(tenantBReadPoRes.status === 403 || tenantBReadPoRes.status === 404, "Tenant B reading Tenant A PO must be rejected");

  // ---------------------------------------------------------------------------
  // TEST: AUDIT LOGS VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Audit Logs ---");
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "PURCHASE_CREATED",
          "PURCHASE_UPDATED",
          "PURCHASE_APPROVED",
          "PURCHASE_RECEIVED",
          "PURCHASE_CANCELLED",
        ],
      },
    },
  });

  assert(auditLogs.some((l) => l.action === "PURCHASE_CREATED"), "PURCHASE_CREATED audit exists");
  assert(auditLogs.some((l) => l.action === "PURCHASE_UPDATED"), "PURCHASE_UPDATED audit exists");
  assert(auditLogs.some((l) => l.action === "PURCHASE_APPROVED"), "PURCHASE_APPROVED audit exists");
  assert(auditLogs.some((l) => l.action === "PURCHASE_RECEIVED"), "PURCHASE_RECEIVED audit exists");
  assert(auditLogs.some((l) => l.action === "PURCHASE_CANCELLED"), "PURCHASE_CANCELLED audit exists");

  // ---------------------------------------------------------------------------
  // TEST: HEALTH ENDPOINT FUNCTIONALITY
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Health Endpoint ---");
  const healthRes = await fetch(`http://localhost:3004/health`);
  assert(healthRes.status === 200, "Health check endpoint must return 200 OK");

  console.log("\nAll Purchase Integration Tests Passed Successfully! 🚀");

  await app.close();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error("Purchase Integration tests failed:", err);
  process.exit(1);
});
