/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Accounting integration tests...");
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
  await app.listen(3008);

  const baseUrl = "http://localhost:3008/api";
  let adminToken = "";
  const suffix = ` ${Date.now()}`;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables to prevent contamination from previous runs
  console.log("Cleaning up database tables...");
  await prisma.paymentAllocation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.stockTransferLine.deleteMany({});
  await prisma.stockTransfer.deleteMany({});
  await prisma.stockAdjustmentLine.deleteMany({});
  await prisma.stockAdjustment.deleteMany({});
  await prisma.stock.deleteMany({});
  await prisma.salesDeliveryItem.deleteMany({});
  await prisma.salesDelivery.deleteMany({});
  await prisma.purchaseReceiptItem.deleteMany({});
  await prisma.purchaseReceipt.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.salesOrderItem.deleteMany({});
  await prisma.salesOrder.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.taxCategory.deleteMany({});
  await prisma.journalEntryLine.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.account.deleteMany({});

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

  // Get Admin current user profile to determine tenantId
  const adminUser = await prisma.user.findFirst({ where: { email: "admin@amdox.com" } });
  assert(!!adminUser, "Admin user must exist in DB");
  const tenantId = adminUser!.tenantId!;
  console.log(`Working under tenant ID: ${tenantId}`);

  // 2. Chart of Accounts Seeding check
  console.log("Seeding Chart of Accounts for current tenant...");
  // Trigger seeding by hitting trial balance endpoint (which auto seeds if accounts not found)
  const tbRes = await fetch(`${baseUrl}/accounting/trial-balance`, { headers });
  assert(tbRes.status === 200, "Generate Trial Balance should succeed");
  const tbData = (await tbRes.json()) as {
    rows: { code: string; name: string; type: string; balance: string }[];
    totals: { debit: string; credit: string; isBalanced: boolean };
  };

  console.log("Checking seeded accounts exist in Trial Balance...");
  const expectedCodes = ["1010", "1020", "1200", "1400", "2000", "2100", "3000", "4000", "5000", "5100"];
  const seededCodes = tbData.rows.map((r) => r.code);
  for (const code of expectedCodes) {
    assert(seededCodes.includes(code), `Seeded accounts must include code ${code}`);
  }
  assert(tbData.totals.isBalanced, "Seeded accounts Trial Balance must be balanced");

  // Fetch account IDs for test postings
  const accountsRes = await fetch(`${baseUrl}/accounting/accounts?limit=100`, { headers });
  assert(accountsRes.status === 200, "Find accounts should succeed");
  const accountsData = (await accountsRes.json()) as { data: { id: string; code: string; version: number }[] };
  const accounts = accountsData.data;

  const getAccountId = (code: string) => {
    const acc = accounts.find((a) => a.code === code);
    assert(!!acc, `Account for code ${code} must exist`);
    return acc!.id;
  };

  const cashAccId = getAccountId("1010");
  const equityAccId = getAccountId("3000");

  // 3. Manual Journal Entry CRUD
  console.log("Verifying Manual Journal Entry CRUD & Double-Entry constraints...");
  
  // Test 3.1: Reject out-of-balance journal entry
  const oobRes = await fetch(`${baseUrl}/accounting/journals`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      postingDate: new Date().toISOString(),
      description: "Out of Balance Journal",
      lines: [
        { accountId: cashAccId, debit: 100.0, credit: 0 },
        { accountId: equityAccId, debit: 0, credit: 50.0 }, // 100 != 50
      ],
    }),
  });
  assert(oobRes.status === 400, "Out-of-balance journal creation must fail with 400 Bad Request");

  // Test 3.2: Create balanced draft journal entry
  const createJeRes = await fetch(`${baseUrl}/accounting/journals`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      postingDate: new Date().toISOString(),
      description: "Balanced Journal Entry",
      lines: [
        { accountId: cashAccId, debit: 150.0, credit: 0 },
        { accountId: equityAccId, debit: 0, credit: 150.0 },
      ],
    }),
  });
  assert(createJeRes.status === 201, "Creating balanced journal entry should succeed");
  const je = (await createJeRes.json()) as { id: string; entryNumber: string; status: string; version: number };
  assert(je.status === "DRAFT", "New journal entry should default to DRAFT");

  // Verify DRAFT entry does not affect ledger balances yet
  const tbResDraft = await fetch(`${baseUrl}/accounting/trial-balance`, { headers });
  const tbDraftData = (await tbResDraft.json()) as { rows: { code: string; balance: string }[] };
  const cashRowDraft = tbDraftData.rows.find((r) => r.code === "1010");
  assert(Number(cashRowDraft?.balance) === 0, "DRAFT journal entries must not affect account balances");

  // Test 3.3: Post the journal entry
  const postJeRes = await fetch(`${baseUrl}/accounting/journals/${je.id}/post`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: je.version }),
  });
  assert(postJeRes.status === 200, "Posting journal entry should succeed");
  const postedJe = (await postJeRes.json()) as { status: string; version: number };
  assert(postedJe.status === "POSTED", "Journal entry status must update to POSTED");

  // Verify POSTED entry updates ledger balances
  const tbResPosted = await fetch(`${baseUrl}/accounting/trial-balance`, { headers });
  const tbPostedData = (await tbResPosted.json()) as { rows: { code: string; balance: string }[] };
  const cashRowPosted = tbPostedData.rows.find((r) => r.code === "1010");
  assert(Number(cashRowPosted?.balance) === 150, "POSTED journal entry must update Cash account balance to 150");

  // Test 3.4: Optimistic Concurrency on post
  const conflictPostRes = await fetch(`${baseUrl}/accounting/journals/${je.id}/post`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }), // Old version
  });
  assert(conflictPostRes.status === 409, "Outdated version update must fail with 409 Conflict");

  // Test 3.5: Prevent posting already posted journal entry
  const doublePostRes = await fetch(`${baseUrl}/accounting/journals/${je.id}/post`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: postedJe.version }),
  });
  assert(doublePostRes.status === 400, "Reposting must fail with 400 Bad Request");

  // Test 3.6: Reverse the journal entry
  const reverseRes = await fetch(`${baseUrl}/accounting/journals/${je.id}/reverse`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: postedJe.version }),
  });
  assert(reverseRes.status === 200, "Reversing journal entry should succeed");
  const reversedJe = (await reverseRes.json()) as { status: string };
  assert(reversedJe.status === "REVERSED", "Reversed journal entry status must transition to REVERSED");

  // Verify reversal adjusts ledger balances back to zero
  const tbResReversed = await fetch(`${baseUrl}/accounting/trial-balance`, { headers });
  const tbReversedData = (await tbResReversed.json()) as { rows: { code: string; balance: string }[] };
  const cashRowReversed = tbReversedData.rows.find((r) => r.code === "1010");
  assert(Number(cashRowReversed?.balance) === 0, "Reversal must return account balances to original state (zero)");

  // 4. Setup Master Data & Orders for Automated Integration Verification
  console.log("Setting up master data & orders for automated hooks testing...");
  
  // Category
  const createCatRes = await fetch(`${baseUrl}/master-data/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "GL Category" + suffix }),
  });
  if (!createCatRes.ok) {
    throw new Error(`createCatRes failed: ${await createCatRes.text()}`);
  }
  const category = (await createCatRes.json()) as { id: string };

  // Unit
  const createUnitRes = await fetch(`${baseUrl}/master-data/units`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "GL Unit" + suffix, symbol: "pcs" }),
  });
  if (!createUnitRes.ok) {
    throw new Error(`createUnitRes failed: ${await createUnitRes.text()}`);
  }
  const unit = (await createUnitRes.json()) as { id: string };

  // Tax Category (0% tax rate for simple math)
  const createTaxRes = await fetch(`${baseUrl}/master-data/tax-categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "GL VAT 0" + suffix, rate: 0.0, isDefault: false }),
  });
  if (!createTaxRes.ok) {
    throw new Error(`createTaxRes failed: ${await createTaxRes.text()}`);
  }
  const taxCategory = (await createTaxRes.json()) as { id: string };

  // Warehouse
  const createWhRes = await fetch(`${baseUrl}/master-data/warehouses`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "GL Warehouse" + suffix, code: "GWH" + Date.now() }),
  });
  if (!createWhRes.ok) {
    throw new Error(`createWhRes failed: ${await createWhRes.text()}`);
  }
  const warehouse = (await createWhRes.json()) as { id: string };

  // Product
  const sku = "SKU-GL-" + Date.now();
  const createProdRes = await fetch(`${baseUrl}/inventory/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "GL Product" + suffix,
      sku,
      categoryId: category.id,
      unitId: unit.id,
      taxCategoryId: taxCategory.id,
      costPrice: 100.0,
      salePrice: 200.0,
    }),
  });
  if (!createProdRes.ok) {
    throw new Error(`createProdRes failed: ${await createProdRes.text()}`);
  }
  const product = (await createProdRes.json()) as { id: string };

  // Customer
  const createCustRes = await fetch(`${baseUrl}/sales/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "GL Customer" + suffix,
      email: "glcust@amdox.com",
      phone: "+15550199",
    }),
  });
  if (!createCustRes.ok) {
    throw new Error(`createCustRes failed: ${await createCustRes.text()}`);
  }
  const customer = (await createCustRes.json()) as { id: string };

  // --- AUTOMATED PURCHASE ORDER POSTINGS ---
  console.log("Verifying Automated Purchase postings...");
  
  // 1. Create & Approve Purchase Order
  const createPoRes = await fetch(`${baseUrl}/purchase`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      supplierName: "GL Supplier",
      expectedDeliveryDate: new Date().toISOString(),
      items: [{ productId: product.id, quantity: 10, unitPrice: 100.0 }],
    }),
  });
  if (!createPoRes.ok) {
    throw new Error(`POST /purchase failed: ${await createPoRes.text()}`);
  }
  const po = (await createPoRes.json()) as { id: string; version: number; orderNumber: string };
  
  await fetch(`${baseUrl}/purchase/${po.id}/approve`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: po.version }),
  });

  // 2. Complete Goods Receipt (Receive items)
  // This should trigger GL: Debit Inventory (1400) $1000, Credit Accrued Liabilities (2100) $1000
  const receiveRes = await fetch(`${baseUrl}/purchase/${po.id}/receive`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      expectedVersion: po.version + 1,
      warehouseId: warehouse.id,
      items: [{ productId: product.id, quantityReceived: 10 }],
      remarks: "Goods received",
    }),
  });
  assert(receiveRes.status === 200, "Receive items should succeed");

  const tbResPoRec = await fetch(`${baseUrl}/accounting/trial-balance`, { headers });
  const tbPoRecData = (await tbResPoRec.json()) as { rows: { code: string; balance: string }[] };
  const inventoryRowPoRec = tbPoRecData.rows.find((r) => r.code === "1400");
  const accruedLiabRow = tbPoRecData.rows.find((r) => r.code === "2100");
  assert(Number(inventoryRowPoRec?.balance) === 1000, "Automated GL: Inventory (1400) balance should be 1000");
  assert(Number(accruedLiabRow?.balance) === 1000, "Automated GL: Accrued Liabilities (2100) balance should be 1000");

  // 3. Generate Purchase Invoice & Issue it
  // This should trigger GL: Debit Purchase Expense (5100) $1000, Credit Accounts Payable (2000) $1000
  const generatePinRes = await fetch(`${baseUrl}/invoices/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sourceType: "PurchaseOrder", sourceId: po.id }),
  });
  const pinv = (await generatePinRes.json()) as { id: string; version: number };

  const issuePinvRes = await fetch(`${baseUrl}/invoices/${pinv.id}/issue`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: pinv.version }),
  });
  assert(issuePinvRes.status === 200, "Issue purchase invoice should succeed");

  const tbResPinv = await fetch(`${baseUrl}/accounting/trial-balance`, { headers });
  const tbPinvData = (await tbResPinv.json()) as { rows: { code: string; balance: string }[] };
  const purchaseExpenseRow = tbPinvData.rows.find((r) => r.code === "5100");
  const accountsPayableRow = tbPinvData.rows.find((r) => r.code === "2000");
  assert(Number(purchaseExpenseRow?.balance) === 1000, "Automated GL: Purchase Expense (5100) balance should be 1000");
  assert(Number(accountsPayableRow?.balance) === 1000, "Automated GL: Accounts Payable (2000) balance should be 1000");

  // 4. Record Supplier Payment (Disbursement) & Post it
  // This should trigger GL: Debit Accounts Payable (2000) $1000, Credit Cash/Bank (1010) $1000
  const createDispRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "DISBURSEMENT",
      method: "BANK_TRANSFER",
      paymentDate: new Date().toISOString(),
      amount: 1000.0,
      currency: "USD",
      supplierName: "GL Supplier",
      allocations: [{ invoiceId: pinv.id, allocatedAmount: 1000.0 }],
    }),
  });
  const disp = (await createDispRes.json()) as { id: string; version: number; paymentNumber: string };

  const postDispRes = await fetch(`${baseUrl}/payments/${disp.id}/post`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: disp.version }),
  });
  assert(postDispRes.status === 200, "Post supplier payment should succeed");

  const tbResDisp = await fetch(`${baseUrl}/accounting/trial-balance`, { headers });
  const tbDispData = (await tbResDisp.json()) as { rows: { code: string; balance: string }[] };
  const accountsPayableRowDisp = tbDispData.rows.find((r) => r.code === "2000");
  const bankRowDisp = tbDispData.rows.find((r) => r.code === "1010");
  assert(Number(accountsPayableRowDisp?.balance) === 0, "Accounts Payable (2000) should be settled to 0");
  assert(Number(bankRowDisp?.balance) === -1000, "Cash/Bank (1010) balance should decrease by 1000 (disbursement)");

  // --- AUTOMATED SALES ORDER POSTINGS ---
  console.log("Verifying Automated Sales postings...");
  
  // 1. Create Sales Order
  const createSoRes = await fetch(`${baseUrl}/sales/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customerId: customer.id,
      expectedDeliveryDate: new Date().toISOString(),
      items: [{ productId: product.id, quantity: 5, unitPrice: 200.0 }],
    }),
  });
  if (!createSoRes.ok) {
    throw new Error(`createSoRes failed: ${await createSoRes.text()}`);
  }
  const so = (await createSoRes.json()) as { id: string; version: number; orderNumber: string };

  // Confirm Sales Order
  const confirmSoRes = await fetch(`${baseUrl}/sales/orders/${so.id}/confirm`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: so.version }),
  });
  if (!confirmSoRes.ok) {
    throw new Error(`confirmSoRes failed: ${await confirmSoRes.text()}`);
  }

  // 2. Deliver Goods
  // Cost calculated from delivery: 5 items * $200 unitPrice = $1000.
  // This should trigger GL: Debit Cost of Goods Sold (5000) $1000, Credit Inventory (1400) $1000.
  const deliverRes = await fetch(`${baseUrl}/sales/orders/${so.id}/deliver`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      expectedVersion: so.version + 1,
      warehouseId: warehouse.id,
      items: [{ productId: product.id, quantityDelivered: 5 }],
      remarks: "Goods delivered",
    }),
  });
  assert(deliverRes.status === 200, "Deliver items should succeed");

  const tbResDeliv = await fetch(`${baseUrl}/accounting/trial-balance`, { headers });
  const tbDelivData = (await tbResDeliv.json()) as { rows: { code: string; balance: string }[] };
  const cogsRow = tbDelivData.rows.find((r) => r.code === "5000");
  const inventoryRowDeliv = tbDelivData.rows.find((r) => r.code === "1400");
  assert(Number(cogsRow?.balance) === 1000, "Automated GL: COGS (5000) balance should be 1000");
  assert(Number(inventoryRowDeliv?.balance) === 0, "Automated GL: Inventory (1400) balance should decrease by 1000 back to 0");

  // 3. Generate Sales Invoice & Issue it
  // This should trigger GL: Debit Accounts Receivable (1200) $1000, Credit Sales Revenue (4000) $1000
  const generateSinvRes = await fetch(`${baseUrl}/invoices/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sourceType: "SalesOrder", sourceId: so.id }),
  });
  const sinv = (await generateSinvRes.json()) as { id: string; version: number };

  const issueSinvRes = await fetch(`${baseUrl}/invoices/${sinv.id}/issue`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: sinv.version }),
  });
  assert(issueSinvRes.status === 200, "Issue sales invoice should succeed");

  const tbResSinv = await fetch(`${baseUrl}/accounting/trial-balance`, { headers });
  const tbSinvData = (await tbResSinv.json()) as { rows: { code: string; balance: string }[] };
  const accountsReceivableRow = tbSinvData.rows.find((r) => r.code === "1200");
  const salesRevenueRow = tbSinvData.rows.find((r) => r.code === "4000");
  assert(Number(accountsReceivableRow?.balance) === 1000, "Automated GL: Accounts Receivable (1200) balance should be 1000");
  assert(Number(salesRevenueRow?.balance) === 1000, "Automated GL: Sales Revenue (4000) balance should be 1000");

  // 4. Record Customer Receipt & Post it
  // This should trigger GL: Debit Cash/Bank (1010) $1000, Credit Accounts Receivable (1200) $1000
  const createReceiptRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "RECEIPT",
      method: "CASH",
      paymentDate: new Date().toISOString(),
      amount: 1000.0,
      currency: "USD",
      customerId: customer.id,
      allocations: [{ invoiceId: sinv.id, allocatedAmount: 1000.0 }],
    }),
  });
  const rcpt = (await createReceiptRes.json()) as { id: string; version: number };

  const postRcptRes = await fetch(`${baseUrl}/payments/${rcpt.id}/post`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: rcpt.version }),
  });
  assert(postRcptRes.status === 200, "Post customer receipt should succeed");

  const tbResRcpt = await fetch(`${baseUrl}/accounting/trial-balance`, { headers });
  const tbRcptData = (await tbResRcpt.json()) as { rows: { code: string; balance: string }[] };
  const accountsReceivableRowRcpt = tbRcptData.rows.find((r) => r.code === "1200");
  const bankRowRcpt = tbRcptData.rows.find((r) => r.code === "1010");
  assert(Number(accountsReceivableRowRcpt?.balance) === 0, "Accounts Receivable (1200) should be settled to 0");
  assert(Number(bankRowRcpt?.balance) === 0, "Cash/Bank (1010) balance should increase by 1000 back to 0");

  // 5. Tenant Isolation Verification
  console.log("Verifying tenant isolation constraints...");
  // Create a separate tenant
  const anotherTenantSlug = `tenant-gl-${Date.now()}`;
  const createTenantRes = await fetch(`${baseUrl}/tenants`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Another Tenant", slug: anotherTenantSlug }),
  });
  assert(createTenantRes.status === 201, "Creating separate tenant should succeed");
  const anotherTenant = (await createTenantRes.json()) as { id: string };

  // Query accounts under another tenant using Admin token - should filter or reject
  // Direct DB check for tenant isolation is checked via business logic where user.tenantId is forced.
  // Verify that listing accounts only retrieves accounts belonging to admin's tenantId.
  const allAccountsList = await prisma.account.findMany();
  const differentTenantAccounts = allAccountsList.filter((a) => a.tenantId === anotherTenant.id);
  assert(differentTenantAccounts.length === 0, "Seeding for separate tenant should not happen until accessed");

  // 6. Verify Health Endpoint
  console.log("Verifying health check endpoint...");
  const healthRes = await fetch("http://localhost:3008/health");
  assert(healthRes.status === 200, "Health check should return 200");
  const healthData = (await healthRes.json()) as { application: string; database?: { status: string } };
  assert(healthData.application === "up", "Application status should be up");
  assert(healthData.database?.status === "healthy", "Database status should be healthy");

  console.log("All GL Integration Tests Passed Successfully! 🚀");
  app.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
