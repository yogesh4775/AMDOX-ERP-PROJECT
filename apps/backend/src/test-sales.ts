/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, SalesOrderStatus, MasterStatus } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Sales integration tests...");
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
  await app.listen(3005);

  const baseUrl = "http://localhost:3005/api";
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
    body: JSON.stringify({ name: "Sales Category" + suffix }),
  });
  assert(createCatRes.status === 201, "Create category should succeed");
  const category = (await createCatRes.json()) as { id: string };

  // Unit
  const createUnitRes = await fetch(`${baseUrl}/master-data/units`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Sales Unit" + suffix, symbol: "pcs" }),
  });
  assert(createUnitRes.status === 201, "Create unit should succeed");
  const unit = (await createUnitRes.json()) as { id: string };

  // Tax Category
  const createTaxRes = await fetch(`${baseUrl}/master-data/tax-categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Sales Tax" + suffix, rate: 10, isDefault: false }),
  });
  assert(createTaxRes.status === 201, "Create tax category should succeed");
  const taxCategory = (await createTaxRes.json()) as { id: string };

  // Warehouse
  const createWhRes = await fetch(`${baseUrl}/master-data/warehouses`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Sales Warehouse" + suffix, code: "SWH" + Date.now() }),
  });
  assert(createWhRes.status === 201, "Create Warehouse should succeed");
  const warehouse = (await createWhRes.json()) as { id: string };

  // Product
  const sku = "SKU-SO-" + Date.now();
  const createProdRes = await fetch(`${baseUrl}/inventory/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sales Product" + suffix,
      sku,
      categoryId: category.id,
      unitId: unit.id,
      taxCategoryId: taxCategory.id,
      costPrice: 80.0,
      salePrice: 120.0,
    }),
  });
  assert(createProdRes.status === 201, "Create product should succeed");
  const product = (await createProdRes.json()) as { id: string };

  // ---------------------------------------------------------------------------
  // TEST: CUSTOMER CRUD & RESTORE & NORMALIZATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Customer CRUD & Normalization ---");

  // Create
  const createCustRes = await fetch(`${baseUrl}/sales/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "   Acme    Corporation   " + suffix, // Normalizes spacing
      email: "info@acme.com",
      phone: "+1-555-0199",
      address: "123 Acme Way",
    }),
  });
  if (createCustRes.status !== 201) {
    console.log("Customer create failed with status:", createCustRes.status, await createCustRes.text());
  }
  assert(createCustRes.status === 201, "Create customer should succeed");
  const customer = (await createCustRes.json()) as { id: string; name: string; version: number };
  assert(customer.id !== undefined, "Customer ID is defined");
  assert(customer.name === "Acme Corporation" + suffix, "Customer name spaces collapsed correctly");
  assert(customer.version === 1, "Initial version is 1");

  // Collision block (Active customer duplicate name check)
  const dupCustRes = await fetch(`${baseUrl}/sales/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Acme Corporation" + suffix,
      email: "other@acme.com",
    }),
  });
  assert(dupCustRes.status === 400, "Active duplicate customer name must be blocked");

  // Update
  const updateCustRes = await fetch(`${baseUrl}/sales/customers/${customer.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Acme Corporation Updated" + suffix,
      expectedVersion: 1,
    }),
  });
  if (updateCustRes.status !== 200) {
    console.log("Customer update failed with status:", updateCustRes.status, await updateCustRes.text());
  }
  assert(updateCustRes.status === 200, "Update customer should succeed");
  const updatedCust = (await updateCustRes.json()) as { name: string; version: number };
  assert(updatedCust.name === "Acme Corporation Updated" + suffix, "Customer name updated");
  assert(updatedCust.version === 2, "Customer version incremented to 2");

  // Soft Delete
  const delCustRes = await fetch(`${baseUrl}/sales/customers/${customer.id}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ expectedVersion: 2 }),
  });
  assert(delCustRes.status === 200, "Delete customer should succeed");
  const deletedCust = (await delCustRes.json()) as { status: string; version: number };
  assert(deletedCust.status === MasterStatus.INACTIVE, "Soft-deleted customer marked INACTIVE");
  assert(deletedCust.version === 3, "Customer version incremented to 3");

  // Restore
  const restoreCustRes = await fetch(`${baseUrl}/sales/customers/${customer.id}/restore`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedVersion: 3 }),
  });
  assert(restoreCustRes.status === 200, "Restore customer should succeed");
  const restoredCust = (await restoreCustRes.json()) as { status: string; version: number };
  assert(restoredCust.status === MasterStatus.ACTIVE, "Restored customer marked ACTIVE");
  assert(restoredCust.version === 4, "Customer version incremented to 4");

  // ---------------------------------------------------------------------------
  // TEST: SALES ORDER CRUD (DRAFT STATUS)
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Sales Order CRUD ---");

  const expectedDeliveryDate = new Date();
  expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 7);

  // Create
  const createSoRes = await fetch(`${baseUrl}/sales/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customerId: customer.id,
      expectedDeliveryDate: expectedDeliveryDate.toISOString(),
      notes: "Deliver to front desk.",
      items: [
        {
          productId: product.id,
          quantity: 10.0,
          unitPrice: 110.0,
        },
      ],
    }),
  });
  assert(createSoRes.status === 201, "Create sales order should succeed");
  const so = (await createSoRes.json()) as { id: string; orderNumber: string; totalAmount: string; status: string; version: number };
  assert(so.id !== undefined, "Sales Order ID is defined");
  assert(so.orderNumber.startsWith("SO-"), "SO number format matches prefix SO-");
  assert(Number(so.totalAmount) === 1100.0, "Total amount computed correctly (10 * 110)");
  assert(so.status === SalesOrderStatus.DRAFT, "Initial status is DRAFT");
  assert(so.version === 1, "Initial version is 1");

  // Read
  const getSoRes = await fetch(`${baseUrl}/sales/orders/${so.id}`, { headers });
  assert(getSoRes.status === 200, "Get sales order should succeed");

  // Update
  const updateSoRes = await fetch(`${baseUrl}/sales/orders/${so.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      notes: "Deliver to front desk - updated notes.",
      expectedVersion: 1,
    }),
  });
  assert(updateSoRes.status === 200, "Update SO should succeed");
  const updatedSo = (await updateSoRes.json()) as { notes: string; version: number };
  assert(updatedSo.notes === "Deliver to front desk - updated notes.", "Notes updated");
  assert(updatedSo.version === 2, "SO version incremented to 2");

  // Concurrency Check
  const conflictSoRes = await fetch(`${baseUrl}/sales/orders/${so.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      notes: "Stale update SO notes",
      expectedVersion: 1, // Stale version (should be 2)
    }),
  });
  assert(conflictSoRes.status === 409, "Stale version update on SO must return 409 Conflict");

  // ---------------------------------------------------------------------------
  // TEST: SALES ORDER CONFIRMATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Sales Order Confirmation ---");

  const confirmRes = await fetch(`${baseUrl}/sales/orders/${so.id}/confirm`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 2 }),
  });
  assert(confirmRes.status === 200, "Confirm SO should succeed");
  const confirmedSo = (await confirmRes.json()) as { status: string; version: number };
  assert(confirmedSo.status === SalesOrderStatus.CONFIRMED, "Status shifted to CONFIRMED");
  assert(confirmedSo.version === 3, "Version incremented to 3");

  // Verify confirmation notification
  const notifyRes = await fetch(`${baseUrl}/notifications?unreadOnly=true`, { headers });
  const notifyData = (await notifyRes.json()) as { data: any[] };
  const hasConfirmNotify = notifyData.data.some((n) => n.title === "Sales Order Confirmed" && n.message.includes(so.orderNumber));
  assert(hasConfirmNotify, "SO Confirmation notification registered cleanly");

  // Duplicate Confirmation block (Idempotency)
  const dupConfirmRes = await fetch(`${baseUrl}/sales/orders/${so.id}/confirm`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 3 }),
  });
  assert(dupConfirmRes.status === 400, "Duplicate SO confirmation must be blocked");

  // Immutable Confirmed Order check
  const updateConfirmedRes = await fetch(`${baseUrl}/sales/orders/${so.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      notes: "Front desk delivery update.",
      expectedVersion: 3,
    }),
  });
  assert(updateConfirmedRes.status === 400, "Updating confirmed SO must be rejected");

  // ---------------------------------------------------------------------------
  // TEST: DISPATCH & STOCK DEDUCTION (INTEGRATION WITH STOCKSERVICE)
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Delivery Dispatch & Stock Deduction ---");

  // 1. Verify that dispatching without stock fails (Negative Inventory Prevention)
  const failDeliverRes = await fetch(`${baseUrl}/sales/orders/${so.id}/deliver`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      remarks: "Try dispatching with zero stock",
      expectedVersion: 3,
      items: [
        {
          productId: product.id,
          quantityDelivered: 5.0,
        },
      ],
    }),
  });
  assert(failDeliverRes.status === 400, "Dispatching exceeding available warehouse inventory must be blocked");

  // 2. Pre-stock the warehouse via StockAdjustment API to have 100 units
  console.log("Pre-stocking warehouse with 100 units of product...");
  const createAdjRes = await fetch(`${baseUrl}/inventory/adjustments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      note: "Pre-stock for sales testing",
      lines: [
        {
          productId: product.id,
          type: "INCREMENT",
          quantity: 100.0,
          reason: "Sales test pre-stocking",
        },
      ],
    }),
  });
  assert(createAdjRes.status === 201, "Create adjustment should succeed");
  const adj = (await createAdjRes.json()) as { id: string };

  const approveAdjRes = await fetch(`${baseUrl}/inventory/adjustments/${adj.id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(approveAdjRes.status === 200, "Approve adjustment should succeed");

  // Verify stock balance is now 100
  const stockRes = await fetch(
    `${baseUrl}/inventory/stock?productId=${product.id}&warehouseId=${warehouse.id}`,
    { headers }
  );
  const stockData = (await stockRes.json()) as { data: any[] };
  assert(Number(stockData.data[0].quantity) === 100.0, "Pre-stock balance is 100.0");

  // 3. Dispatch Partial Delivery (4 units of 10 ordered)
  const partialDelRes = await fetch(`${baseUrl}/sales/orders/${so.id}/deliver`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      remarks: "Partial dispatch delivery",
      expectedVersion: 3,
      items: [
        {
          productId: product.id,
          quantityDelivered: 4.0,
        },
      ],
    }),
  });
  assert(partialDelRes.status === 200, "Partial delivery dispatch should succeed");
  const partialSo = (await partialDelRes.json()) as { status: string; version: number };
  assert(partialSo.status === SalesOrderStatus.PARTIALLY_DELIVERED, "Status changed to PARTIALLY_DELIVERED");
  assert(partialSo.version === 4, "SO version incremented to 4");

  // Verify stock balance decreased to 96 (100 - 4)
  const postPartialStockRes = await fetch(
    `${baseUrl}/inventory/stock?productId=${product.id}&warehouseId=${warehouse.id}`,
    { headers }
  );
  const postPartialStockData = (await postPartialStockRes.json()) as { data: any[] };
  assert(Number(postPartialStockData.data[0].quantity) === 96.0, "Stock balance decreased correctly to 96.0");

  // Verify StockMovement log added
  const movementsRes = await fetch(`${baseUrl}/inventory/stock/movements?productId=${product.id}`, { headers });
  const movementsData = (await movementsRes.json()) as { data: any[] };
  const hasDelMove = movementsData.data.some((m) => m.type === "STOCK_OUT" && Number(m.quantity) === -4.0);
  assert(hasDelMove, "Partial delivery stock deduction movement logged");

  // 4. Try dispatching exceeding remaining (exceeds remaining 6) -> expect 400
  const exceedDelRes = await fetch(`${baseUrl}/sales/orders/${so.id}/deliver`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      remarks: "Try exceeding remaining ordered",
      expectedVersion: 4,
      items: [
        {
          productId: product.id,
          quantityDelivered: 10.0,
        },
      ],
    }),
  });
  assert(exceedDelRes.status === 400, "Delivering exceeding quantity must be blocked");

  // 5. Complete Delivery (Remaining 6 units)
  const completeDelRes = await fetch(`${baseUrl}/sales/orders/${so.id}/deliver`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      remarks: "Complete dispatch delivery",
      expectedVersion: 4,
      items: [
        {
          productId: product.id,
          quantityDelivered: 6.0,
        },
      ],
    }),
  });
  assert(completeDelRes.status === 200, "Complete delivery dispatch should succeed");
  const completeSo = (await completeDelRes.json()) as { status: string; version: number };
  assert(completeSo.status === SalesOrderStatus.DELIVERED, "Status changed to DELIVERED");
  assert(completeSo.version === 5, "SO version incremented to 5");

  // Verify stock balance decreased to 90 (96 - 6)
  const postCompleteStockRes = await fetch(
    `${baseUrl}/inventory/stock?productId=${product.id}&warehouseId=${warehouse.id}`,
    { headers }
  );
  const postCompleteStockData = (await postCompleteStockRes.json()) as { data: any[] };
  assert(Number(postCompleteStockData.data[0].quantity) === 90.0, "Stock balance decreased correctly to 90.0");

  // 6. Double delivery on completed order block (Idempotency)
  const dupDelRes = await fetch(`${baseUrl}/sales/orders/${so.id}/deliver`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      warehouseId: warehouse.id,
      remarks: "Try duplicate delivery",
      expectedVersion: 5,
      items: [
        {
          productId: product.id,
          quantityDelivered: 2.0,
        },
      ],
    }),
  });
  assert(dupDelRes.status === 400, "Delivering on DELIVERED order must be blocked");

  // ---------------------------------------------------------------------------
  // TEST: SALES ORDER CANCELLATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Sales Order Cancellation ---");

  // Create draft SO to test cancellation from DRAFT
  const cancelDraftRes = await fetch(`${baseUrl}/sales/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customerId: customer.id,
      expectedDeliveryDate: expectedDeliveryDate.toISOString(),
      items: [{ productId: product.id, quantity: 5.0, unitPrice: 100.0 }],
    }),
  });
  const cancelSoDraft = (await cancelDraftRes.json()) as { id: string };

  const executeCancelDraftRes = await fetch(`${baseUrl}/sales/orders/${cancelSoDraft.id}/cancel`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(executeCancelDraftRes.status === 200, "Cancel draft SO should succeed");
  const cancelledDraftSo = (await executeCancelDraftRes.json()) as { status: string };
  assert(cancelledDraftSo.status === SalesOrderStatus.CANCELLED, "Draft SO status shifted to CANCELLED");

  // Cancel completed SO block
  const cancelCompletedRes = await fetch(`${baseUrl}/sales/orders/${so.id}/cancel`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 5 }),
  });
  assert(cancelCompletedRes.status === 400, "Cancelling completed SO must be blocked");

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

  // Tenant B tries to read Tenant A's customer -> expect 403 or 404
  const tenantBReadCustRes = await fetch(`${baseUrl}/sales/customers/${customer.id}`, { headers: tenantBHeaders });
  assert(tenantBReadCustRes.status === 403 || tenantBReadCustRes.status === 404, "Tenant B reading Tenant A customer must be rejected");

  // Tenant B tries to read Tenant A's Sales Order -> expect 403 or 404
  const tenantBReadSoRes = await fetch(`${baseUrl}/sales/orders/${so.id}`, { headers: tenantBHeaders });
  assert(tenantBReadSoRes.status === 403 || tenantBReadSoRes.status === 404, "Tenant B reading Tenant A SO must be rejected");

  // ---------------------------------------------------------------------------
  // TEST: AUDIT LOGS VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Audit Logs ---");
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "CUSTOMER_CREATED",
          "CUSTOMER_UPDATED",
          "CUSTOMER_DELETED",
          "CUSTOMER_RESTORED",
          "SALES_CREATED",
          "SALES_UPDATED",
          "SALES_CONFIRMED",
          "SALES_DELIVERED",
          "SALES_CANCELLED",
        ],
      },
    },
  });

  assert(auditLogs.some((l) => l.action === "CUSTOMER_CREATED"), "CUSTOMER_CREATED audit exists");
  assert(auditLogs.some((l) => l.action === "CUSTOMER_UPDATED"), "CUSTOMER_UPDATED audit exists");
  assert(auditLogs.some((l) => l.action === "CUSTOMER_DELETED"), "CUSTOMER_DELETED audit exists");
  assert(auditLogs.some((l) => l.action === "CUSTOMER_RESTORED"), "CUSTOMER_RESTORED audit exists");
  assert(auditLogs.some((l) => l.action === "SALES_CREATED"), "SALES_CREATED audit exists");
  assert(auditLogs.some((l) => l.action === "SALES_UPDATED"), "SALES_UPDATED audit exists");
  assert(auditLogs.some((l) => l.action === "SALES_CONFIRMED"), "SALES_CONFIRMED audit exists");
  assert(auditLogs.some((l) => l.action === "SALES_DELIVERED"), "SALES_DELIVERED audit exists");
  assert(auditLogs.some((l) => l.action === "SALES_CANCELLED"), "SALES_CANCELLED audit exists");

  // ---------------------------------------------------------------------------
  // TEST: HEALTH ENDPOINT FUNCTIONALITY
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Health Endpoint ---");
  const healthRes = await fetch(`http://localhost:3005/health`);
  assert(healthRes.status === 200, "Health check endpoint must return 200 OK");

  console.log("\nAll Sales Integration Tests Passed Successfully! 🚀");

  await app.close();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error("Sales Integration tests failed:", err);
  process.exit(1);
});
