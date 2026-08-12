/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, ExemptionEntityType } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Tax Management integration tests...");
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
  await prisma.category.deleteMany({});
  await prisma.unit.deleteMany({});

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

  // Create Product & TaxCategory
  console.log("Seeding Product & TaxCategory...");
  const taxCat = await prisma.taxCategory.create({
    data: {
      tenantId: tenantIdA,
      name: "Standard Goods",
      rate: 10.00,
      isDefault: true,
    },
  });

  // Create Category and Unit
  const category = await prisma.category.create({
    data: {
      tenantId: tenantIdA,
      name: "Electronics",
    },
  });

  const unit = await prisma.unit.create({
    data: {
      tenantId: tenantIdA,
      name: "PCS",
      symbol: "PCS",
    },
  });

  const product = await prisma.product.create({
    data: {
      tenantId: tenantIdA,
      name: "Corporate Laptop",
      sku: "LAPTOP-001",
      costPrice: 500.00,
      salePrice: 1000.00,
      categoryId: category.id,
      unitId: unit.id,
      taxCategoryId: taxCat.id,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      tenantId: tenantIdA,
      name: "Enterprise Client",
      email: "client@enterprise.com",
      address: "123 Silicon Way, San Jose, CA 95112",
    },
  });

  // 2. Verify Tax Rule CRUD
  console.log("Verifying Tax Rule CRUD...");
  // Create Rule (Jurisdiction CA)
  const ruleCARes = await fetch(`${baseUrl}/tax/rules`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "CA Standard Tax",
      taxCategoryId: taxCat.id,
      rate: 8.25,
      jurisdiction: "CA",
    }),
  });
  assert(ruleCARes.status === 201 || ruleCARes.status === 200, "CA Tax Rule creation should succeed");
  const ruleCA = await ruleCARes.json();
  assert(Number(ruleCA.rate) === 8.25, "Rate should be 8.25");

  // Create Default Rule (Jurisdiction: null)
  const defaultRuleRes = await fetch(`${baseUrl}/tax/rules`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "US Default Tax",
      taxCategoryId: taxCat.id,
      rate: 5.00,
      jurisdiction: "",
    }),
  });
  assert(defaultRuleRes.status === 201 || defaultRuleRes.status === 200, "Default Tax Rule creation should succeed");
  const defaultRule = await defaultRuleRes.json();
  assert(Number(defaultRule.rate) === 5.00, "Default rate should be 5.00");

  // Try creating duplicate default rule - should fail
  const duplicateDefaultRes = await fetch(`${baseUrl}/tax/rules`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Another US Default Tax",
      taxCategoryId: taxCat.id,
      rate: 6.00,
      jurisdiction: "",
    }),
  });
  assert(duplicateDefaultRes.status === 400, "Should block multiple active default rules");

  // Verify unique name check
  const duplicateNameRes = await fetch(`${baseUrl}/tax/rules`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "CA Standard Tax",
      taxCategoryId: taxCat.id,
      rate: 9.00,
      jurisdiction: "CA-Alt",
    }),
  });
  assert(duplicateNameRes.status === 400, "Should block duplicate rule name");

  // Verify rate validation (0 - 100)
  const invalidRateRes = await fetch(`${baseUrl}/tax/rules`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "High Tax Rule",
      taxCategoryId: taxCat.id,
      rate: 105.00,
    }),
  });
  assert(invalidRateRes.status === 400, "Should block invalid rate above 100%");

  // Verify Optimistic Concurrency on updates
  const updateRuleBadVersion = await fetch(`${baseUrl}/tax/rules/${ruleCA.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      rate: 8.50,
      expectedVersion: 99,
    }),
  });
  assert(updateRuleBadVersion.status === 409, "Should fail with Conflict status on wrong version");

  const updateRuleRes = await fetch(`${baseUrl}/tax/rules/${ruleCA.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      rate: 8.50,
      expectedVersion: ruleCA.version,
    }),
  });
  assert(updateRuleRes.status === 200, "Update rule with correct version should succeed");
  const updatedRule = await updateRuleRes.json();
  assert(Number(updatedRule.rate) === 8.50, "Updated rate should be 8.50");

  // 3. Verify Tax Exemption CRUD
  console.log("Verifying Tax Exemption CRUD...");
  const createExemptionRes = await fetch(`${baseUrl}/tax/exemptions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Product Laptop Exemption",
      entityType: ExemptionEntityType.PRODUCT,
      entityId: product.id,
      taxRuleId: ruleCA.id,
      reason: "Tax exempt corporate equipment",
    }),
  });
  assert(createExemptionRes.status === 201 || createExemptionRes.status === 200, "Exemption creation should succeed");
  const exemption = await createExemptionRes.json();

  // Optimistic Concurrency check on exemption update
  const updateExemptionBadVersion = await fetch(`${baseUrl}/tax/exemptions/${exemption.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      isActive: false,
      expectedVersion: 99,
    }),
  });
  assert(updateExemptionBadVersion.status === 409, "Should return Conflict status on wrong version");

  // Disable exemption temporarily for testing other rules
  const disableExemptionRes = await fetch(`${baseUrl}/tax/exemptions/${exemption.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      isActive: false,
      expectedVersion: exemption.version,
    }),
  });
  assert(disableExemptionRes.status === 200, "Should disable exemption successfully");

  // 4. Verify Tax Calculation Accuracy (Centralized Engine)
  console.log("Verifying Tax Calculation Accuracy...");
  // Test jurisdiction CA matching (should apply CA rule: 8.50%)
  const calcCARes = await fetch(`${baseUrl}/tax/calculate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customerId: customer.id,
      jurisdiction: "CA",
      items: [{ productId: product.id, taxCategoryId: taxCat.id, baseAmount: 1000.00 }],
    }),
  });
  assert(calcCARes.status === 200 || calcCARes.status === 201, "Tax calculation should succeed");
  const calcCA = await calcCARes.json();
  assert(Number(calcCA.totalTaxAmount) === 85.00, `Expected tax amount 85, got ${calcCA.totalTaxAmount}`);

  // Test fallback to default rule (NY jurisdiction is not registered, should match US Default rule: 5.00%)
  const calcNYRes = await fetch(`${baseUrl}/tax/calculate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customerId: customer.id,
      jurisdiction: "NY",
      items: [{ productId: product.id, taxCategoryId: taxCat.id, baseAmount: 1000.00 }],
    }),
  });
  assert(calcNYRes.status === 200 || calcNYRes.status === 201, "Tax calculation NY should succeed");
  const calcNY = await calcNYRes.json();
  assert(Number(calcNY.totalTaxAmount) === 50.00, `Expected fallback to default rule 50, got ${calcNY.totalTaxAmount}`);

  // Re-enable exemption and test exemption logic (0% rate)
  await prisma.taxExemption.update({
    where: { id: exemption.id },
    data: { isActive: true },
  });

  const calcExemptRes = await fetch(`${baseUrl}/tax/calculate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customerId: customer.id,
      jurisdiction: "CA",
      items: [{ productId: product.id, taxCategoryId: taxCat.id, baseAmount: 1000.00 }],
    }),
  });
  assert(calcExemptRes.status === 200 || calcExemptRes.status === 201, "Tax calculation exempt should succeed");
  const calcExempt = await calcExemptRes.json();
  assert(Number(calcExempt.totalTaxAmount) === 0, `Expected exempt tax amount 0, got ${calcExempt.totalTaxAmount}`);
  assert(calcExempt.items[0].exemptionId === exemption.id, "Should link to exemptionId");

  // Clean exemption again to test normal flows
  await prisma.taxExemption.update({
    where: { id: exemption.id },
    data: { isActive: false },
  });

  // 5. Verify Invoice Integration (Calculation + TaxTransaction Recording)
  console.log("Verifying Invoice Integration...");
  const createInvRes = await fetch(`${baseUrl}/invoices`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "SALES",
      customerId: customer.id,
      invoiceDate: new Date().toISOString(),
      dueDate: new Date().toISOString(),
      items: [{ productId: product.id, quantity: 2, unitPrice: 500.00 }],
    }),
  });
  assert(createInvRes.status === 201 || createInvRes.status === 200, "Invoice creation should succeed");
  const invoice = await createInvRes.json();
  // Since customer address has CA, rate is 8.50%. Subtotal = 1000. Tax = 85.
  assert(Number(invoice.taxTotal) === 85.00, `Expected invoice tax total 85.00, got ${invoice.taxTotal}`);

  // Issue Invoice to trigger TaxTransaction recording and GL postings
  const issueInvRes = await fetch(`${baseUrl}/invoices/${invoice.id}/issue`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: invoice.version }),
  });
  assert(issueInvRes.status === 200 || issueInvRes.status === 201, "Invoice issue should succeed");

  // Verify TaxTransaction was recorded
  const taxTx = await prisma.taxTransaction.findFirst({
    where: { tenantId: tenantIdA, sourceType: "INVOICE", sourceId: invoice.id },
  });
  assert(!!taxTx, "TaxTransaction must be created on invoice issue");
  assert(Number(taxTx!.taxAmount) === 85.00, "TaxTransaction amount should match calculation");

  // 6. Verify Sales Order Integration (TaxTransaction Recording)
  console.log("Verifying Sales Order Integration...");
  const createSORes = await fetch(`${baseUrl}/sales/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customerId: customer.id,
      expectedDeliveryDate: new Date().toISOString(),
      items: [{ productId: product.id, quantity: 1, unitPrice: 1000.00 }],
    }),
  });
  assert(createSORes.status === 201 || createSORes.status === 200, "Sales Order creation should succeed");
  const so = await createSORes.json();

  // Confirm Sales Order to trigger TaxTransaction recording
  const confirmSORes = await fetch(`${baseUrl}/sales/orders/${so.id}/confirm`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: so.version }),
  });
  assert(confirmSORes.status === 200 || confirmSORes.status === 201, "Sales Order confirmation should succeed");

  // Verify TaxTransaction was recorded for Sales
  const salesTaxTx = await prisma.taxTransaction.findFirst({
    where: { tenantId: tenantIdA, sourceType: "SALES", sourceId: so.id },
  });
  assert(!!salesTaxTx, "TaxTransaction must be created on sales order confirmation");
  assert(Number(salesTaxTx!.taxAmount) === 85.00, "Sales TaxTransaction amount check");

  // 7. Verify Purchase Order Integration (TaxTransaction Recording)
  console.log("Verifying Purchase Order Integration...");
  const createPORes = await fetch(`${baseUrl}/purchase`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      supplierName: "Global Chips Inc",
      expectedDeliveryDate: new Date().toISOString(),
      items: [{ productId: product.id, quantity: 1, unitPrice: 1000.00 }],
    }),
  });
  assert(createPORes.status === 201 || createPORes.status === 200, "Purchase Order creation should succeed");
  const po = await createPORes.json();

  // Approve Purchase Order to trigger TaxTransaction recording
  const approvePORes = await fetch(`${baseUrl}/purchase/${po.id}/approve`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: po.version }),
  });
  assert(approvePORes.status === 200 || approvePORes.status === 201, "Purchase Order approval should succeed");

  // Verify TaxTransaction was recorded for Purchase (should fallback to default rule 5.00% as jurisdiction is undefined)
  const purchaseTaxTx = await prisma.taxTransaction.findFirst({
    where: { tenantId: tenantIdA, sourceType: "PURCHASE", sourceId: po.id },
  });
  assert(!!purchaseTaxTx, "TaxTransaction must be created on purchase order approval");
  assert(Number(purchaseTaxTx!.taxAmount) === 50.00, "Purchase TaxTransaction amount check (fallback to default rule)");

  // 8. Verify CSV/PDF Reporting Export Compatibility
  console.log("Verifying CSV/PDF export endpoints...");
  const reportCsvRes = await fetch(`${baseUrl}/tax/reports?export=csv`, { headers });
  assert(reportCsvRes.status === 200, "CSV export call should succeed");
  assert(reportCsvRes.headers.get("content-type")?.includes("text/csv") === true, "Should return CSV mime type");
  const reportCsvText = await reportCsvRes.text();
  assert(reportCsvText.includes("ID,Source Type,Source ID,Base Amount"), "CSV check headers");

  const reportPdfRes = await fetch(`${baseUrl}/tax/reports?export=pdf`, { headers });
  assert(reportPdfRes.status === 200, "PDF export call should succeed");
  const reportPdfData = await reportPdfRes.json();
  assert(reportPdfData.title === "ENTERPRISE TAX REPORT", "PDF layout validation");

  // 9. Verify Tenant Isolation
  console.log("Verifying Tenant Isolation...");
  const tenantIdB = "11111111-1111-1111-1111-111111111111";
  await prisma.tenant.upsert({
    where: { id: tenantIdB },
    update: {},
    create: { id: tenantIdB, name: "Tenant B Corp", slug: "tenant-b" },
  });

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

  // Tenant B list rules (should see 0, completely isolated from Tenant A rules)
  const rulesBRes = await fetch(`${baseUrl}/tax/rules`, { headers: headersB });
  const rulesB = await rulesBRes.json();
  assert(rulesB.length === 0, "Tenant B should see 0 tax rules");

  // Tenant B tries to update Tenant A's rule - should return 404/403
  const hackRuleRes = await fetch(`${baseUrl}/tax/rules/${ruleCA.id}`, {
    method: "PATCH",
    headers: headersB,
    body: JSON.stringify({ rate: 1.00, expectedVersion: 1 }),
  });
  assert(hackRuleRes.status === 404, "Tenant B should not find Tenant A's tax rule");

  // 10. Verify Health Endpoint
  console.log("Verifying health endpoint...");
  const healthRes = await fetch("http://localhost:3009/health");
  assert(healthRes.status === 200, "Health check should succeed");
  const healthData = await healthRes.json();
  assert(healthData.application === "up", "Health application status check");
  assert(healthData.database.status === "healthy", "Health database status check");

  console.log("==============================================");
  console.log("ALL TAX MANAGEMENT E2E INTEGRATION TESTS PASSED!");
  console.log("==============================================");

  await app.close();
  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test execution failed with error:", e);
  process.exit(1);
});
