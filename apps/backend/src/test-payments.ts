/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, InvoiceStatus, InvoiceType } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Payment integration tests...");
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
  await app.listen(3007);

  const baseUrl = "http://localhost:3007/api";
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

  // 2. Setup Prerequisites (Category, Unit, TaxCategory, Warehouse, Product, Customer)
  console.log("Creating prerequisites (Category, Unit, TaxCategory, Warehouse, Product, Customer)...");

  // Category
  const createCatRes = await fetch(`${baseUrl}/master-data/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Payment Category" + suffix }),
  });
  assert(createCatRes.status === 201, "Create category should succeed");
  const category = (await createCatRes.json()) as { id: string };

  // Unit
  const createUnitRes = await fetch(`${baseUrl}/master-data/units`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Payment Unit" + suffix, symbol: "pcs" }),
  });
  assert(createUnitRes.status === 201, "Create unit should succeed");
  const unit = (await createUnitRes.json()) as { id: string };

  // Tax Category (18% tax rate)
  const createTaxRes = await fetch(`${baseUrl}/master-data/tax-categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Payment VAT 18" + suffix, rate: 18.0, isDefault: false }),
  });
  assert(createTaxRes.status === 201, "Create tax category should succeed");
  const taxCategory = (await createTaxRes.json()) as { id: string };

  // Warehouse
  const createWhRes = await fetch(`${baseUrl}/master-data/warehouses`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Payment Warehouse" + suffix, code: "PWH" + Date.now() }),
  });
  assert(createWhRes.status === 201, "Create Warehouse should succeed");
  const warehouse = (await createWhRes.json()) as { id: string };

  // Product
  const sku = "SKU-PAY-" + Date.now();
  const createProdRes = await fetch(`${baseUrl}/inventory/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Payment Product" + suffix,
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
      name: "Customer Payment Inc" + suffix,
      email: "billing@paymentinc.com",
    }),
  });
  assert(createCustRes.status === 201, "Create customer should succeed");
  const customer = (await createCustRes.json()) as { id: string };

  // 3. Create & Issue Invoices to set up targets for allocations
  console.log("Creating and Issuing Invoices...");

  // Invoice 1 (Sales Invoice, grandTotal = 1720.00)
  const invoiceDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const createInv1Res = await fetch(`${baseUrl}/invoices`, {
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
  assert(createInv1Res.status === 201, "Create invoice 1 should succeed");
  const inv1 = (await createInv1Res.json()) as { id: string; version: number; grandTotal: string };

  // Issue Invoice 1
  const issueInv1Res = await fetch(`${baseUrl}/invoices/${inv1.id}/issue`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(issueInv1Res.status === 200, "Issue invoice 1 should succeed");

  // Invoice 2 (Sales Invoice, grandTotal = 860.00)
  const createInv2Res = await fetch(`${baseUrl}/invoices`, {
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
          quantity: 5.0,
          unitPrice: 150.0,
          discountAmount: 25.0,
        },
      ],
    }),
  });
  assert(createInv2Res.status === 201, "Create invoice 2 should succeed");
  const inv2 = (await createInv2Res.json()) as { id: string; version: number; grandTotal: string };

  // Issue Invoice 2
  const issueInv2Res = await fetch(`${baseUrl}/invoices/${inv2.id}/issue`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(issueInv2Res.status === 200, "Issue invoice 2 should succeed");

  // Invoice 3 (Purchase Invoice, grandTotal = 1180.00)
  const createInv3Res = await fetch(`${baseUrl}/invoices`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: InvoiceType.PURCHASE,
      supplierName: "Supplier Payment Ltd" + suffix,
      invoiceDate: invoiceDate.toISOString(),
      dueDate: dueDate.toISOString(),
      currency: "USD",
      items: [
        {
          productId: product.id,
          quantity: 10.0,
          unitPrice: 100.0,
          discountAmount: 0.0,
        },
      ],
    }),
  });
  assert(createInv3Res.status === 201, "Create invoice 3 should succeed");
  const inv3 = (await createInv3Res.json()) as { id: string; version: number; grandTotal: string };

  // Issue Invoice 3
  const issueInv3Res = await fetch(`${baseUrl}/invoices/${inv3.id}/issue`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(issueInv3Res.status === 200, "Issue invoice 3 should succeed");

  // 4. Test Payment CRUD in DRAFT status
  console.log("\n--- Testing Payment CRUD (DRAFT Status) ---");

  // Create Draft Payment
  const createPayRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "RECEIPT",
      method: "BANK_TRANSFER",
      paymentDate: invoiceDate.toISOString(),
      amount: 1500.0,
      currency: "USD",
      customerId: customer.id,
      allocations: [
        {
          invoiceId: inv1.id,
          allocatedAmount: 1000.0,
        },
        {
          invoiceId: inv2.id,
          allocatedAmount: 500.0,
        },
      ],
    }),
  });
  assert(createPayRes.status === 201, "Create draft payment should succeed");
  const pay = (await createPayRes.json()) as {
    id: string;
    paymentNumber: string;
    amount: string;
    status: string;
    version: number;
    allocations: any[];
  };
  assert(pay.id !== undefined, "Payment ID is generated");
  assert(pay.status === "DRAFT", "Initial status is DRAFT");
  assert(pay.version === 1, "Initial version is 1");
  assert(pay.paymentNumber.startsWith("PAY-R-"), "Payment number prefix matches PAY-R-");
  assert(pay.allocations.length === 2, "Allocations count is 2");

  // Get Detail
  const getPayRes = await fetch(`${baseUrl}/payments/${pay.id}`, { headers });
  assert(getPayRes.status === 200, "Get payment detail should succeed");

  // Update Draft Payment
  const updatePayRes = await fetch(`${baseUrl}/payments/${pay.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      amount: 1200.0,
      allocations: [
        {
          invoiceId: inv1.id,
          allocatedAmount: 900.0,
        },
        {
          invoiceId: inv2.id,
          allocatedAmount: 300.0,
        },
      ],
      expectedVersion: 1,
    }),
  });
  assert(updatePayRes.status === 200, "Update payment should succeed");
  const updatedPay = (await updatePayRes.json()) as { amount: string; version: number; allocations: any[] };
  assert(Number(updatedPay.amount) === 1200.0, "Updated payment amount is 1200.0");
  assert(updatedPay.version === 2, "Version incremented to 2");

  // Concurrency Check on update
  const staleUpdateRes = await fetch(`${baseUrl}/payments/${pay.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      notes: "Stale test",
      expectedVersion: 1, // should be 2
    }),
  });
  assert(staleUpdateRes.status === 409, "Stale version update on payment must return 409 Conflict");

  // 5. Test Allocation Constraints
  console.log("\n--- Testing Allocation Constraint Checks ---");

  // Constraint: Allocation cannot target Purchase invoice for RECEIPT type payment
  const badTypeRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "RECEIPT",
      method: "CASH",
      paymentDate: invoiceDate.toISOString(),
      amount: 100.0,
      customerId: customer.id,
      allocations: [
        {
          invoiceId: inv3.id, // Purchase Invoice
          allocatedAmount: 100.0,
        },
      ],
    }),
  });
  assert(badTypeRes.status === 400, "Receipt payments allocating to Purchase invoices must fail");

  // Constraint: Total allocations cannot exceed payment amount
  const badSumRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "RECEIPT",
      method: "CASH",
      paymentDate: invoiceDate.toISOString(),
      amount: 100.0,
      customerId: customer.id,
      allocations: [
        {
          invoiceId: inv1.id,
          allocatedAmount: 150.0, // exceeds payment amount of 100.0
        },
      ],
    }),
  });
  assert(badSumRes.status === 400, "Allocation sum exceeding payment amount must fail");

  // Constraint: Allocation cannot exceed outstanding balance
  const badBalRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "RECEIPT",
      method: "CASH",
      paymentDate: invoiceDate.toISOString(),
      amount: 2000.0,
      customerId: customer.id,
      allocations: [
        {
          invoiceId: inv2.id,
          allocatedAmount: 1000.0, // Invoice 2 total is 860.00
        },
      ],
    }),
  });
  assert(badBalRes.status === 400, "Allocation amount exceeding invoice outstanding balance must fail");

  // 6. Test Posting Payment (Debit/Credit Settlement)
  console.log("\n--- Testing Payment Posting (Atomic Settlement) ---");

  const postPayRes = await fetch(`${baseUrl}/payments/${pay.id}/post`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 2 }),
  });
  assert(postPayRes.status === 200, "Posting payment should succeed");
  const postedPay = (await postPayRes.json()) as { status: string; version: number };
  assert(postedPay.status === "POSTED", "Status transitioned to POSTED");

  // Verify Invoice status and amountPaid are updated
  const getInv1Res = await fetch(`${baseUrl}/invoices/${inv1.id}`, { headers });
  const freshInv1 = (await getInv1Res.json()) as { amountPaid: string; status: string };
  assert(Number(freshInv1.amountPaid) === 900.0, "Invoice 1 amountPaid incremented by 900.0");
  assert(freshInv1.status === InvoiceStatus.PARTIALLY_PAID, "Invoice 1 status is PARTIALLY_PAID");

  const getInv2Res = await fetch(`${baseUrl}/invoices/${inv2.id}`, { headers });
  const freshInv2 = (await getInv2Res.json()) as { amountPaid: string; status: string };
  assert(Number(freshInv2.amountPaid) === 300.0, "Invoice 2 amountPaid incremented by 300.0");
  assert(freshInv2.status === InvoiceStatus.PARTIALLY_PAID, "Invoice 2 status is PARTIALLY_PAID");

  // Duplicate posting check
  const dupPostRes = await fetch(`${baseUrl}/payments/${pay.id}/post`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 3 }),
  });
  assert(dupPostRes.status === 400, "Duplicate payment posting must fail");

  // Immutable check for posted payment updates
  const postUpdateRes = await fetch(`${baseUrl}/payments/${pay.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      amount: 1000.0,
      expectedVersion: 3,
    }),
  });
  assert(postUpdateRes.status === 400, "Updates on POSTED payments must be rejected");

  // 7. Test Partial and Full Invoice Settlement
  console.log("\n--- Testing Full Settlement Calculations ---");

  // Create another receipt to fully pay off Invoice 1 (remaining outstanding: 1720.00 - 900.00 = 820.00)
  const fullPayRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "RECEIPT",
      method: "CHECK",
      paymentDate: invoiceDate.toISOString(),
      amount: 820.0,
      customerId: customer.id,
      allocations: [
        {
          invoiceId: inv1.id,
          allocatedAmount: 820.0,
        },
      ],
    }),
  });
  assert(fullPayRes.status === 201, "Create full payment draft should succeed");
  const fullPay = (await fullPayRes.json()) as { id: string; version: number };

  // Post Full Payment
  const postFullRes = await fetch(`${baseUrl}/payments/${fullPay.id}/post`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(postFullRes.status === 200, "Posting full payment should succeed");

  // Verify Invoice 1 is fully paid
  const getInv1PaidRes = await fetch(`${baseUrl}/invoices/${inv1.id}`, { headers });
  const paidInv1 = (await getInv1PaidRes.json()) as { amountPaid: string; status: string };
  assert(Number(paidInv1.amountPaid) === 1720.0, "Invoice 1 is paid 1720.0");
  assert(paidInv1.status === InvoiceStatus.PAID, "Invoice 1 status transitioned to PAID");

  // 8. Test Payment Reversals
  console.log("\n--- Testing Payment Reversal ---");

  // Reverse fullPay (reverts Invoice 1 back to PARTIALLY_PAID, outstanding changes back to 820.00)
  const revFullRes = await fetch(`${baseUrl}/payments/${fullPay.id}/reverse`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 2 }),
  });
  assert(revFullRes.status === 200, "Reversing full payment should succeed");
  const reversedPay = (await revFullRes.json()) as { status: string; version: number };
  assert(reversedPay.status === "REVERSED", "Payment status is REVERSED");

  // Verify Invoice 1 reverts to PARTIALLY_PAID and amountPaid resets to 900.00
  const getInv1RevRes = await fetch(`${baseUrl}/invoices/${inv1.id}`, { headers });
  const revInv1 = (await getInv1RevRes.json()) as { amountPaid: string; status: string };
  assert(Number(revInv1.amountPaid) === 900.0, "Invoice 1 amountPaid reverted to 900.0");
  assert(revInv1.status === InvoiceStatus.PARTIALLY_PAID, "Invoice 1 status reverted to PARTIALLY_PAID");

  // Duplicate Reversal Check
  const dupRevRes = await fetch(`${baseUrl}/payments/${fullPay.id}/reverse`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 3 }),
  });
  assert(dupRevRes.status === 400, "Duplicate payment reversal must fail");

  // Reversed payments cannot be modified
  const modRevRes = await fetch(`${baseUrl}/payments/${fullPay.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      amount: 1000.0,
      expectedVersion: 3,
    }),
  });
  assert(modRevRes.status === 400, "Updates on REVERSED payments must be rejected");

  // 9. Test Advance Payments (Allocations sum < payment amount)
  console.log("\n--- Testing Advance Payment (Partial/No Allocation) ---");

  const advPayRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "RECEIPT",
      method: "CREDIT_CARD",
      paymentDate: invoiceDate.toISOString(),
      amount: 500.0,
      customerId: customer.id,
      notes: "Advance customer deposits",
      allocations: [], // No allocations assigned
    }),
  });
  assert(advPayRes.status === 201, "Create advance payment draft should succeed");
  const advPay = (await advPayRes.json()) as { id: string; allocations: any[] };
  assert(advPay.allocations.length === 0, "No allocations present for advance payment");

  // 10. Test Tenant Isolation
  console.log("\n--- Testing Tenant Isolation Boundary borders ---");

  const secondaryTenantId = "11111111-1111-1111-1111-111111111111";
  await prisma.tenant.upsert({
    where: { id: secondaryTenantId },
    update: { deletedAt: null },
    create: {
      id: secondaryTenantId,
      name: "Tenant B Payments",
      slug: "tenant-b-payments",
    },
  });

  const adminUser = await prisma.user.findFirst({ where: { email: "admin@amdox.com" } });
  const hashedPw = adminUser!.passwordHash;

  const secondaryUserEmail = "user.b@amdox.com";
  const userB = await prisma.user.upsert({
    where: { email: secondaryUserEmail },
    update: { deletedAt: null },
    create: {
      id: "22222222-2222-2222-2222-222222222222",
      email: secondaryUserEmail,
      username: "user_b_payments",
      passwordHash: hashedPw,
      tenantId: secondaryTenantId,
    },
  });

  const secondaryRole = await prisma.role.upsert({
    where: { name_tenantId: { name: "Admin", tenantId: secondaryTenantId } },
    update: {},
    create: { name: "Admin", tenantId: secondaryTenantId },
  });

  const permissions = await prisma.permission.findMany();
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: secondaryRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: secondaryRole.id,
        permissionId: perm.id,
      },
    });
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: userB.id,
        roleId: secondaryRole.id,
      },
    },
    update: {},
    create: {
      userId: userB.id,
      roleId: secondaryRole.id,
      tenantId: secondaryTenantId,
    },
  });

  // Login as User B
  const loginBRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "user.b@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginBRes.status === 200 || loginBRes.status === 201, "User B login should succeed");
  const loginBData = (await loginBRes.json()) as { accessToken: string };

  const headersB = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginBData.accessToken}`,
  };

  // User B tries to read Tenant A's payment (should return 404 or 403)
  const readBRes = await fetch(`${baseUrl}/payments/${pay.id}`, { headers: headersB });
  assert(readBRes.status === 404, "Tenant B must fail to view Tenant A's payment details");

  // 11. Test Audit Logs
  console.log("\n--- Testing Audit Logs ---");
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "PAYMENT_CREATED",
          "PAYMENT_UPDATED",
          "PAYMENT_POSTED",
          "PAYMENT_REVERSED",
        ],
      },
    },
  });
  assert(auditLogs.some((l) => l.action === "PAYMENT_CREATED"), "PAYMENT_CREATED audit log exists");
  assert(auditLogs.some((l) => l.action === "PAYMENT_UPDATED"), "PAYMENT_UPDATED audit log exists");
  assert(auditLogs.some((l) => l.action === "PAYMENT_POSTED"), "PAYMENT_POSTED audit log exists");
  assert(auditLogs.some((l) => l.action === "PAYMENT_REVERSED"), "PAYMENT_REVERSED audit log exists");

  // 12. Test Notifications
  console.log("\n--- Testing Notifications ---");
  const notifyRes = await fetch(`${baseUrl}/notifications?unreadOnly=true&page=1&limit=20&order=desc`, { headers });
  const notifyData = (await notifyRes.json()) as { data: any[] };
  const hasPaymentNotify = notifyData.data.some((n) => n.title === "Payment Posted" || n.title === "Invoice Payment Recorded");
  assert(hasPaymentNotify, "Payment posted notifications registered cleanly");

  // 13. Health Check
  console.log("\n--- Testing Health Endpoint ---");
  const healthRes = await fetch(`http://localhost:3007/health`);
  assert(healthRes.status === 200, "Health check should be responsive");

  console.log("\nAll Payment Integration Tests Passed Successfully! 🚀");
  await app.close();
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
