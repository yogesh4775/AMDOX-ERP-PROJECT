/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, InvoiceStatus, InvoiceType } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Invoice integration tests...");
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
  await app.listen(3006);

  const baseUrl = "http://localhost:3006/api";
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

  // 2. Setup Prerequisites (Prerequisite Master Data & Inventory & Orders)
  console.log("Creating prerequisites (Category, Unit, TaxCategory, Warehouse, Product, Customer)...");

  // Category
  const createCatRes = await fetch(`${baseUrl}/master-data/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Invoice Category" + suffix }),
  });
  assert(createCatRes.status === 201, "Create category should succeed");
  const category = (await createCatRes.json()) as { id: string };

  // Unit
  const createUnitRes = await fetch(`${baseUrl}/master-data/units`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Invoice Unit" + suffix, symbol: "pcs" }),
  });
  assert(createUnitRes.status === 201, "Create unit should succeed");
  const unit = (await createUnitRes.json()) as { id: string };

  // Tax Category (18% tax rate)
  const createTaxRes = await fetch(`${baseUrl}/master-data/tax-categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Invoice VAT 18" + suffix, rate: 18.0, isDefault: false }),
  });
  assert(createTaxRes.status === 201, "Create tax category should succeed");
  const taxCategory = (await createTaxRes.json()) as { id: string };

  // Warehouse
  const createWhRes = await fetch(`${baseUrl}/master-data/warehouses`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Invoice Warehouse" + suffix, code: "IWH" + Date.now() }),
  });
  assert(createWhRes.status === 201, "Create Warehouse should succeed");
  const warehouse = (await createWhRes.json()) as { id: string };

  // Product
  const sku = "SKU-INV-" + Date.now();
  const createProdRes = await fetch(`${baseUrl}/inventory/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Invoice Product" + suffix,
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

  // Customer
  const createCustRes = await fetch(`${baseUrl}/sales/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Customer Invoice Inc" + suffix,
      email: "billing@customerinc.com",
    }),
  });
  assert(createCustRes.status === 201, "Create customer should succeed");
  const customer = (await createCustRes.json()) as { id: string };

  // ---------------------------------------------------------------------------
  // TEST: INVOICE CRUD (DRAFT STATUS) & DECIMAL MONETARY CALCULATIONS
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Invoice CRUD & Calculations ---");

  const invoiceDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  // Create Draft Sales Invoice
  // calculations:
  // quantity = 10, unitPrice = 150.00 => lineSubtotal = 1500.00
  // taxRate = 18.00% => taxAmount = 1500.00 * 18% = 270.00
  // discountAmount = 50.00
  // totalPrice = 1500.00 + 270.00 - 50.00 = 1720.00
  const createInvRes = await fetch(`${baseUrl}/invoices`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: InvoiceType.SALES,
      customerId: customer.id,
      invoiceDate: invoiceDate.toISOString(),
      dueDate: dueDate.toISOString(),
      currency: "USD",
      items: [
        {
          productId: product.id,
          quantity: 10.0,
          unitPrice: 150.0,
          discountAmount: 50.0,
        },
      ],
    }),
  });
  assert(createInvRes.status === 201, "Create draft invoice should succeed");
  const inv = (await createInvRes.json()) as {
    id: string;
    invoiceNumber: string;
    subtotal: string;
    taxTotal: string;
    discountTotal: string;
    grandTotal: string;
    status: string;
    version: number;
  };
  assert(inv.id !== undefined, "Invoice ID is defined");
  assert(inv.invoiceNumber.startsWith("INV-S-"), "Invoice number format matches INV-S-");
  assert(Number(inv.subtotal) === 1500.0, "Subtotal is 1500.0");
  assert(Number(inv.taxTotal) === 270.0, "Tax total is 270.0");
  assert(Number(inv.discountTotal) === 50.0, "Discount total is 50.0");
  assert(Number(inv.grandTotal) === 1720.0, "Grand total is 1720.0 (1500 + 270 - 50)");
  assert(inv.status === InvoiceStatus.DRAFT, "Initial status is DRAFT");
  assert(inv.version === 1, "Initial version is 1");

  // Read
  const getInvRes = await fetch(`${baseUrl}/invoices/${inv.id}`, { headers });
  assert(getInvRes.status === 200, "Get invoice detail should succeed");

  // Update Draft Invoice (Recalculate totals)
  // quantity = 5, unitPrice = 150.00 => lineSubtotal = 750.00
  // taxRate = 18.00% => taxAmount = 750 * 18% = 135.00
  // discountAmount = 25.00
  // totalPrice = 750.00 + 135.00 - 25.00 = 860.00
  const updateInvRes = await fetch(`${baseUrl}/invoices/${inv.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      items: [
        {
          productId: product.id,
          quantity: 5.0,
          unitPrice: 150.0,
          discountAmount: 25.0,
        },
      ],
      expectedVersion: 1,
    }),
  });
  assert(updateInvRes.status === 200, "Update invoice should succeed");
  const updatedInv = (await updateInvRes.json()) as {
    subtotal: string;
    taxTotal: string;
    discountTotal: string;
    grandTotal: string;
    version: number;
  };
  assert(Number(updatedInv.subtotal) === 750.0, "Updated Subtotal is 750.0");
  assert(Number(updatedInv.taxTotal) === 135.0, "Updated Tax total is 135.0");
  assert(Number(updatedInv.discountTotal) === 25.0, "Updated Discount total is 25.0");
  assert(Number(updatedInv.grandTotal) === 860.0, "Updated Grand total is 860.0 (750 + 135 - 25)");
  assert(updatedInv.version === 2, "Invoice version incremented to 2");

  // Concurrency check (Stale expectedVersion check)
  const staleUpdateRes = await fetch(`${baseUrl}/invoices/${inv.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      currency: "EUR",
      expectedVersion: 1, // Stale version (should be 2)
    }),
  });
  assert(staleUpdateRes.status === 409, "Stale version update on invoice must return 409 Conflict");

  // ---------------------------------------------------------------------------
  // TEST: AUTO GENERATION FROM SALES ORDER & DUPLICATE PREVENTION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Invoice Generation from Sales Order ---");

  // Create Sales Order
  const createSoRes = await fetch(`${baseUrl}/sales/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customerId: customer.id,
      expectedDeliveryDate: dueDate.toISOString(),
      items: [
        {
          productId: product.id,
          quantity: 20.0,
          unitPrice: 150.0,
        },
      ],
    }),
  });
  assert(createSoRes.status === 201, "Create SO should succeed");
  const so = (await createSoRes.json()) as { id: string; version: number };

  // Confirm SO
  const confirmSoRes = await fetch(`${baseUrl}/sales/orders/${so.id}/confirm`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(confirmSoRes.status === 200, "Confirm SO should succeed");

  // Generate Invoice from SO
  // calculations:
  // quantity = 20, unitPrice = 150.00 => lineSubtotal = 3000.00
  // taxRate = 18.00% => taxAmount = 3000 * 18% = 540.00
  // discount = 0
  // grandTotal = 3540.00
  const genSoRes = await fetch(`${baseUrl}/invoices/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sourceType: "SalesOrder",
      sourceId: so.id,
    }),
  });
  assert(genSoRes.status === 201, "Auto billing invoice generation from SO should succeed");
  const genSoInv = (await genSoRes.json()) as { id: string; referenceId: string; grandTotal: string; status: string };
  assert(genSoInv.referenceId === so.id, "Generated invoice maps referenceId correctly");
  assert(Number(genSoInv.grandTotal) === 3540.00, "Generated grand total is 3540.00");
  assert(genSoInv.status === InvoiceStatus.DRAFT, "Status is DRAFT");

  // Block Duplicate Generation from same SO
  const dupGenSoRes = await fetch(`${baseUrl}/invoices/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sourceType: "SalesOrder",
      sourceId: so.id,
    }),
  });
  assert(dupGenSoRes.status === 400, "Duplicate invoice generation from same SO must be blocked");

  // ---------------------------------------------------------------------------
  // TEST: AUTO GENERATION FROM PURCHASE ORDER
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Invoice Generation from Purchase Order ---");

  // Create Purchase Order
  const createPoRes = await fetch(`${baseUrl}/purchase`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      supplierName: "Supplier Inc",
      expectedDeliveryDate: dueDate.toISOString(),
      items: [
        {
          productId: product.id,
          quantity: 30.0,
          unitPrice: 100.0,
        },
      ],
    }),
  });
  assert(createPoRes.status === 201, "Create PO should succeed");
  const po = (await createPoRes.json()) as { id: string; version: number };

  // Approve PO
  const approvePoRes = await fetch(`${baseUrl}/purchase/${po.id}/approve`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(approvePoRes.status === 200, "Approve PO should succeed");

  // Generate Invoice from PO
  // calculations:
  // quantity = 30, unitPrice = 100.00 => lineSubtotal = 3000.00
  // taxRate = 18.00% => taxAmount = 3000 * 18% = 540.00
  // grandTotal = 3540.00
  const genPoRes = await fetch(`${baseUrl}/invoices/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sourceType: "PurchaseOrder",
      sourceId: po.id,
    }),
  });
  assert(genPoRes.status === 201, "Auto billing invoice generation from PO should succeed");
  const genPoInv = (await genPoRes.json()) as { id: string; referenceId: string; grandTotal: string; status: string };
  assert(genPoInv.referenceId === po.id, "Generated PO invoice maps referenceId correctly");
  assert(Number(genPoInv.grandTotal) === 3540.00, "Generated PO grand total is 3540.00");

  // ---------------------------------------------------------------------------
  // TEST: INVOICE ISSUANCE
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Invoice Issuance ---");

  const issueRes = await fetch(`${baseUrl}/invoices/${inv.id}/issue`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 2 }),
  });
  assert(issueRes.status === 200, "Issue draft invoice should succeed");
  const issuedInv = (await issueRes.json()) as { status: string; version: number };
  assert(issuedInv.status === InvoiceStatus.ISSUED, "Status shifted to ISSUED");
  assert(issuedInv.version === 3, "Version incremented to 3");

  // Duplicate Issuing block (Idempotency)
  const dupIssueRes = await fetch(`${baseUrl}/invoices/${inv.id}/issue`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 3 }),
  });
  assert(dupIssueRes.status === 400, "Duplicate invoice issuance must be blocked");

  // Immutable Issued Invoice except payments
  const updateIssuedRes = await fetch(`${baseUrl}/invoices/${inv.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      currency: "EUR",
      expectedVersion: 3,
    }),
  });
  assert(updateIssuedRes.status === 400, "Modifying issued invoice must be rejected");

  // ---------------------------------------------------------------------------
  // TEST: PAYMENT PROCESSING (PARTIAL & FULL)
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Payment Processing ---");

  // 1. Record Partial Payment (300.00 of 860.00 grand total)
  const partPayRes = await fetch(`${baseUrl}/invoices/${inv.id}/pay`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      amount: 300.0,
      expectedVersion: 3,
    }),
  });
  assert(partPayRes.status === 200, "Recording partial payment should succeed");
  const partPaidInv = (await partPayRes.json()) as { status: string; amountPaid: string; version: number };
  assert(partPaidInv.status === InvoiceStatus.PARTIALLY_PAID, "Status changed to PARTIALLY_PAID");
  assert(Number(partPaidInv.amountPaid) === 300.0, "amountPaid logged as 300.0");
  assert(partPaidInv.version === 4, "Version incremented to 4");

  // Verify partial payment notification
  const notifyRes = await fetch(`${baseUrl}/notifications?unreadOnly=true&page=1&limit=20&order=desc`, { headers });
  const notifyData = (await notifyRes.json()) as { data: any[] };
  const hasPayNotify = notifyData.data.some((n) => n.title === "Invoice Payment Recorded" && n.message.includes(inv.invoiceNumber));
  if (!hasPayNotify) {
    console.log("DEBUG notifications:", JSON.stringify(notifyData, null, 2));
    console.log("DEBUG search criteria:", "Invoice number:", inv.invoiceNumber);
  }
  assert(hasPayNotify, "Invoice payment notification registered cleanly");

  // 2. Reject Overpayment (exceeding remaining 560.00)
  const overPayRes = await fetch(`${baseUrl}/invoices/${inv.id}/pay`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      amount: 600.0, // Exceeds remaining 560.00
      expectedVersion: 4,
    }),
  });
  assert(overPayRes.status === 400, "Overpayments must be rejected");

  // 3. Reject negative/zero payments
  const negPayRes = await fetch(`${baseUrl}/invoices/${inv.id}/pay`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      amount: -100.0,
      expectedVersion: 4,
    }),
  });
  assert(negPayRes.status === 400, "Negative payments must be blocked");

  // 4. Record Complete Payment (remaining 560.00)
  const fullPayRes = await fetch(`${baseUrl}/invoices/${inv.id}/pay`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      amount: 560.0,
      expectedVersion: 4,
    }),
  });
  assert(fullPayRes.status === 200, "Recording full payment should succeed");
  const fullPaidInv = (await fullPayRes.json()) as { status: string; amountPaid: string; version: number };
  assert(fullPaidInv.status === InvoiceStatus.PAID, "Status changed to PAID");
  assert(Number(fullPaidInv.amountPaid) === 860.0, "amountPaid logged as 860.0");
  assert(fullPaidInv.version === 5, "Version incremented to 5");

  // 5. Double payment on paid invoice block (Idempotency)
  const dupPayRes = await fetch(`${baseUrl}/invoices/${inv.id}/pay`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      amount: 10.0,
      expectedVersion: 5,
    }),
  });
  assert(dupPayRes.status === 400, "Recording payment on PAID invoice must be blocked");

  // ---------------------------------------------------------------------------
  // TEST: INVOICE CANCELLATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Invoice Cancellation ---");

  // Create another draft invoice to test cancellation from DRAFT
  const cancelDraftRes = await fetch(`${baseUrl}/invoices`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: InvoiceType.SALES,
      customerId: customer.id,
      invoiceDate: invoiceDate.toISOString(),
      dueDate: dueDate.toISOString(),
      items: [{ productId: product.id, quantity: 2.0, unitPrice: 100.0 }],
    }),
  });
  const cancelInvDraft = (await cancelDraftRes.json()) as { id: string };

  const executeCancelDraftRes = await fetch(`${baseUrl}/invoices/${cancelInvDraft.id}/cancel`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(executeCancelDraftRes.status === 200, "Cancel draft invoice should succeed");
  const cancelledDraftInv = (await executeCancelDraftRes.json()) as { status: string };
  assert(cancelledDraftInv.status === InvoiceStatus.CANCELLED, "Draft invoice status shifted to CANCELLED");

  // Cancel PAID invoice block
  const cancelPaidRes = await fetch(`${baseUrl}/invoices/${inv.id}/cancel`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 5 }),
  });
  assert(cancelPaidRes.status === 400, "Cancelling PAID invoice must be blocked");

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

  // Tenant B tries to read Tenant A's invoice -> expect 403 or 404
  const tenantBReadInvRes = await fetch(`${baseUrl}/invoices/${inv.id}`, { headers: tenantBHeaders });
  assert(tenantBReadInvRes.status === 403 || tenantBReadInvRes.status === 404, "Tenant B reading Tenant A invoice must be rejected");

  // ---------------------------------------------------------------------------
  // TEST: AUDIT LOGS VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Audit Logs ---");
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "INVOICE_CREATED",
          "INVOICE_UPDATED",
          "INVOICE_ISSUED",
          "INVOICE_PAYMENT_RECORDED",
          "INVOICE_CANCELLED",
        ],
      },
    },
  });

  assert(auditLogs.some((l) => l.action === "INVOICE_CREATED"), "INVOICE_CREATED audit exists");
  assert(auditLogs.some((l) => l.action === "INVOICE_UPDATED"), "INVOICE_UPDATED audit exists");
  assert(auditLogs.some((l) => l.action === "INVOICE_ISSUED"), "INVOICE_ISSUED audit exists");
  assert(auditLogs.some((l) => l.action === "INVOICE_PAYMENT_RECORDED"), "INVOICE_PAYMENT_RECORDED audit exists");
  assert(auditLogs.some((l) => l.action === "INVOICE_CANCELLED"), "INVOICE_CANCELLED audit exists");

  // ---------------------------------------------------------------------------
  // TEST: HEALTH ENDPOINT FUNCTIONALITY
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Health Endpoint ---");
  const healthRes = await fetch(`http://localhost:3006/health`);
  assert(healthRes.status === 200, "Health check endpoint must return 200 OK");

  console.log("\nAll Invoice Integration Tests Passed Successfully! 🚀");

  await app.close();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error("Invoice Integration tests failed:", err);
  process.exit(1);
});
