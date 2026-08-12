/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-console */
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module";
import { PrismaService } from "@amdox/database";

const prisma = new PrismaService();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("Starting NestJS application for BI E2E tests...");
  const app: INestApplication = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(3090);
  console.log("NestJS application booted on port 3090.");

  const baseUrl = "http://localhost:3090/api";
  const tenantId = "00000000-0000-0000-0000-000000000000";

  // Acquire admin authentication token
  console.log("Authenticating Admin...");
  const authRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(authRes.status === 200, "Admin login must succeed");
  const authData = (await authRes.json()) as any;
  const token = authData.accessToken;
  assert(!!token, "Admin token should be defined");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 1. Clean up BI database tables
  console.log("Cleaning up BI DWH database tables...");
  await prisma.biReportSchedule.deleteMany({});
  await prisma.biReportDefinition.deleteMany({});
  await prisma.biKpiValue.deleteMany({});
  await prisma.biKpiDefinition.deleteMany({});
  await prisma.biHistoricalSnapshot.deleteMany({});
  await prisma.biEtlWatermark.deleteMany({});
  await prisma.biFactFinance.deleteMany({});
  await prisma.biFactSales.deleteMany({});
  await prisma.biFactProcurement.deleteMany({});
  await prisma.biFactInventory.deleteMany({});
  await prisma.biFactManufacturing.deleteMany({});
  await prisma.biFactQuality.deleteMany({});
  await prisma.biFactCustomerService.deleteMany({});
  await prisma.biFactTransportation.deleteMany({});
  await prisma.biFactHR.deleteMany({});
  await prisma.biFactWorkflow.deleteMany({});
  await prisma.biFactSecurity.deleteMany({});
  await prisma.biDimensionProduct.deleteMany({});
  await prisma.biDimensionCustomer.deleteMany({});
  await prisma.biDimensionEmployee.deleteMany({});
  await prisma.biDimensionAccount.deleteMany({});
  await prisma.biDimensionWarehouse.deleteMany({});

  // 2. Seed Master Data in OLTP for ETL
  console.log("Seeding OLTP master data for DWH ETL tests...");
  let category = await prisma.category.findFirst({
    where: { tenantId, name: "BI Test Category" },
  });
  if (!category) {
    category = await prisma.category.create({
      data: { tenantId, name: "BI Test Category" },
    });
  }

  let unit = await prisma.unit.findFirst({
    where: { tenantId, symbol: "PC" },
  });
  if (!unit) {
    unit = await prisma.unit.create({
      data: { tenantId, name: "Piece", symbol: "PC" },
    });
  }

  let product = await prisma.product.findFirst({
    where: { tenantId, sku: "SKU-BI-TEST" },
  });
  if (!product) {
    product = await prisma.product.create({
      data: {
        tenantId,
        sku: "SKU-BI-TEST",
        name: "BI Analyzed Product",
        categoryId: category.id,
        unitId: unit.id,
        costPrice: 50.0,
        salePrice: 100.0,
        status: "ACTIVE",
      },
    });
  }

  let customer = await prisma.customer.findFirst({
    where: { tenantId, name: "BI Corporate Customer" },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        tenantId,
        name: "BI Corporate Customer",
        email: "corp@bi-test.com",
      },
    });
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@amdox.com" },
  });
  assert(!!adminUser, "Admin user must exist");

  // Create mock OLTP transactional data: Sales Order, Journal Entries, Work Orders, Tickets
  let salesOrder = await prisma.salesOrder.findFirst({
    where: { tenantId, orderNumber: "SO-BI-101" },
  });
  if (salesOrder) {
    await prisma.salesOrderItem.deleteMany({
      where: { salesOrderId: salesOrder.id },
    });
    await prisma.salesOrder.delete({ where: { id: salesOrder.id } });
  }
  salesOrder = await prisma.salesOrder.create({
    data: {
      tenantId,
      orderNumber: "SO-BI-101",
      customerId: customer.id,
      status: "DELIVERED" as any,
      totalAmount: 1000.0,
      createdBy: adminUser!.id,
      expectedDeliveryDate: new Date(),
    },
  });

  await prisma.salesOrderItem.create({
    data: {
      tenantId,
      salesOrderId: salesOrder.id,
      productId: product.id,
      quantity: 10,
      unitPrice: 100.0,
      totalPrice: 1000.0,
    },
  });

  let account = await prisma.account.findFirst({
    where: { tenantId, code: "4000" },
  });
  if (!account) {
    account = await prisma.account.create({
      data: {
        tenantId,
        code: "4000",
        name: "Sales Revenue",
        type: "REVENUE",
        status: "ACTIVE",
        balance: 0,
      },
    });
  }

  let budget = await prisma.budget.findFirst({
    where: { tenantId, name: "BI Test Budget" },
  });
  if (budget) {
    await prisma.budgetItem.deleteMany({ where: { budgetId: budget.id } });
    await prisma.budget.delete({ where: { id: budget.id } });
  }
  budget = await prisma.budget.create({
    data: {
      tenantId,
      name: "BI Test Budget",
      fiscalYear: 2026,
      status: "APPROVED" as any,
      periodType: "MONTHLY" as any,
    },
  });

  await prisma.budgetItem.create({
    data: {
      tenantId,
      budgetId: budget.id,
      glAccountId: account.id,
      category: "Sales Expense",
      amount: 1500.0,
      periodStart: new Date("2026-07-01"),
      periodEnd: new Date("2026-07-31"),
    },
  });

  let journalEntry = await prisma.journalEntry.findFirst({
    where: { tenantId, entryNumber: "JE-BI-101" },
  });
  if (journalEntry) {
    await prisma.journalEntryLine.deleteMany({
      where: { journalEntryId: journalEntry.id },
    });
    await prisma.journalEntry.delete({ where: { id: journalEntry.id } });
  }
  journalEntry = await prisma.journalEntry.create({
    data: {
      tenantId,
      entryNumber: "JE-BI-101",
      postingDate: new Date(),
      description: "BI Test Journal Entry",
      status: "POSTED" as any,
    },
  });

  await prisma.journalEntryLine.create({
    data: {
      tenantId,
      journalEntryId: journalEntry.id,
      accountId: account.id,
      debit: 1200.0,
      credit: 0,
    },
  });

  // Seed KPI definition
  const kpiDef = await prisma.biKpiDefinition.create({
    data: {
      tenantId,
      code: "NET_MARGIN",
      name: "Net Margin Ratio",
      description: "Ratio of net profit to total revenue",
      target: 0.2,
      thresholdAlert: 0.1,
      module: "FINANCE",
    },
  });

  // 3. Trigger manual DWH ETL synchronization
  console.log("Triggering manual DWH ETL Sync pipeline...");
  const etlRes = await fetch(`${baseUrl}/bi/etl/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fullRebuild: true, batchSize: 100 }),
  });
  assert(etlRes.status === 201, "ETL manual sync should trigger successfully");
  const etlResult = (await etlRes.json()) as any;
  assert(
    etlResult.status === "SUCCESS",
    "ETL synchronization should return SUCCESS status",
  );

  // Verify DWH dimension populated
  const dimProduct = await prisma.biDimensionProduct.findFirst({
    where: { tenantId, sku: "SKU-BI-TEST" },
  });
  assert(!!dimProduct, "Product DWH Dimension should be synchronized");
  assert(
    dimProduct!.sku === "SKU-BI-TEST",
    "Synchronized DWH dimension SKU should match OLTP source",
  );

  // Verify DWH sales fact populated
  const factSales = await prisma.biFactSales.findFirst({ where: { tenantId } });
  assert(!!factSales, "Sales DWH Fact should be synchronized");
  assert(
    factSales!.orderValue === 1000.0,
    "DWH Sales Fact orderValue should aggregate sales order items",
  );

  // 4. Trigger KPI Evaluation Engine
  console.log("Executing KPI evaluation engine...");
  const kpiEvalRes = await fetch(`${baseUrl}/bi/kpis/evaluate`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  assert(kpiEvalRes.status === 201, "KPI evaluation should return status 201");
  const kpisValued = (await kpiEvalRes.json()) as any[];
  assert(kpisValued.length >= 1, "Should compute at least one KPI value");

  // Check alert breach notification
  const notifications = await prisma.notification.findMany({
    where: { tenantId },
  });
  // Since net profit margin of 50% is above 10% threshold, trigger a test evaluation to breach threshold
  console.log("Adding and evaluating breaching KPI...");
  const csKpiDef = await prisma.biKpiDefinition.create({
    data: {
      tenantId,
      code: "CSAT",
      name: "Customer Satisfaction",
      target: 4.5,
      thresholdAlert: 4.0,
      module: "CSM",
    },
  });
  const kpiBreachRes = await fetch(`${baseUrl}/bi/kpis/evaluate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ pipeline: csKpiDef.id }),
  });
  assert(
    kpiBreachRes.status === 201,
    "Breaching KPI evaluation should succeed",
  );
  const breachNotifs = await prisma.notification.findMany({
    where: { tenantId, title: { contains: "Breached" } },
  });
  assert(
    breachNotifs.length > 0,
    "A threshold breach should trigger a warning notification",
  );

  // 5. Variance and Forecasting Analysis
  console.log("Verifying variance and forecasting query metrics...");
  const varianceRes = await fetch(`${baseUrl}/bi/variance`, { headers });
  assert(varianceRes.status === 200, "Variance analysis should succeed");
  const varianceData = (await varianceRes.json()) as any[];
  assert(varianceData.length > 0, "Should retrieve budgeting variance records");

  const forecastRes = await fetch(
    `${baseUrl}/bi/forecasts?type=sales&periods=4&method=linear_regression`,
    { headers },
  );
  assert(
    forecastRes.status === 200,
    "Sales forecasting endpoint should succeed",
  );
  const forecastData = (await forecastRes.json()) as any;
  assert(
    forecastData.predictions.length === 4,
    "Should forecast exactly 4 future periods",
  );

  // 6. Executive Dashboard
  console.log("Fetching executive dashboard widget summary...");
  const dashRes = await fetch(`${baseUrl}/bi/dashboards/executive`, {
    headers,
  });
  assert(
    dashRes.status === 200,
    "Executive dashboard should load successfully",
  );
  const dashData = (await dashRes.json()) as any;
  assert(
    dashData.kpis.totalRevenue === 1000.0,
    "Revenue indicator should match sales facts",
  );

  // 7. Custom Report Builder & Scheduled Reports
  console.log("Testing Custom Report Builder & Schedules...");
  const createReportRes = await fetch(`${baseUrl}/bi/reports`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Executive Monthly Revenue Report",
      description: "Aggregated monthly revenue metrics for management",
      module: "Sales",
      config: { dimensions: ["orderDate"], metrics: ["sum(orderValue)"] },
    }),
  });
  assert(createReportRes.status === 201, "Should create report definition");
  const report = (await createReportRes.json()) as any;

  const runReportRes = await fetch(`${baseUrl}/bi/reports/${report.id}/run`, {
    method: "POST",
    headers,
  });
  assert(
    runReportRes.status === 201,
    "Should execute dynamic report runner query",
  );
  const reportRows = (await runReportRes.json()) as any;
  assert(
    reportRows.rows.length >= 1,
    "Report runner should retrieve data rows",
  );

  // Create cron schedule
  const scheduleRes = await fetch(
    `${baseUrl}/bi/reports/${report.id}/schedules`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        recipientEmail: "ceo@amdox.com",
        cronExpression: "0 0 1 * *",
        format: "PDF",
      }),
    },
  );
  assert(scheduleRes.status === 201, "Should create report schedule");
  const schedule = (await scheduleRes.json()) as any;

  // Clean up schedule
  const deleteScheduleRes = await fetch(
    `${baseUrl}/bi/reports/schedules/${schedule.id}`,
    {
      method: "DELETE",
      headers,
    },
  );
  assert(
    deleteScheduleRes.status === 200,
    "Should delete report schedule successfully",
  );

  // 8. Optimistic Concurrency Checks on Reports
  console.log("Testing optimistic concurrency check on updates...");
  const badUpdateRes = await fetch(`${baseUrl}/bi/reports/${report.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Stale Revenue Title",
      expectedVersion: 10, // Stale version
    }),
  });
  assert(
    badUpdateRes.status === 409,
    "Updates with incorrect expectedVersion should throw 409 Conflict",
  );

  const goodUpdateRes = await fetch(`${baseUrl}/bi/reports/${report.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Updated Executive Monthly Revenue Report",
      expectedVersion: 1, // Correct version
    }),
  });
  assert(
    goodUpdateRes.status === 200,
    "Updates with correct expectedVersion should succeed",
  );

  // 9. Report Export File Formats (CSV, Excel, PDF)
  console.log("Testing report file exports (CSV, Excel, PDF)...");
  const csvExportRes = await fetch(
    `${baseUrl}/bi/reports/${report.id}/export?format=csv`,
    { headers },
  );
  assert(csvExportRes.status === 200, "CSV export should return 200");
  assert(
    csvExportRes.headers.get("Content-Type") === "text/csv",
    "CSV export should return text/csv mime type",
  );

  const excelExportRes = await fetch(
    `${baseUrl}/bi/reports/${report.id}/export?format=excel`,
    { headers },
  );
  assert(excelExportRes.status === 200, "Excel export should return 200");
  assert(
    excelExportRes.headers.get("Content-Type") === "application/vnd.ms-excel",
    "Excel export should return application/vnd.ms-excel mime type",
  );

  const pdfExportRes = await fetch(
    `${baseUrl}/bi/reports/${report.id}/export?format=pdf`,
    { headers },
  );
  assert(pdfExportRes.status === 200, "PDF export should return 200");
  assert(
    pdfExportRes.headers.get("Content-Type") === "application/pdf",
    "PDF export should return application/pdf mime type",
  );

  // 10. Security Checks & Health Endpoint
  console.log("Testing unauthorized endpoint requests...");
  const unauthorizedRes = await fetch(`${baseUrl}/bi/dashboards/executive`);
  assert(
    unauthorizedRes.status === 401,
    "Accessing BI endpoints without token should throw 401 Unauthorized",
  );

  console.log("Testing Health Endpoint...");
  const healthRes = await fetch(`${baseUrl}/health`, { headers });
  assert(healthRes.status === 200, "Health check should succeed");

  // Cleanup seeded mock master data
  console.log("Cleaning up seeded mock master data...");
  await prisma.budgetItem.deleteMany({ where: { tenantId } });
  await prisma.budget.deleteMany({ where: { tenantId } });
  await prisma.journalEntryLine.deleteMany({ where: { tenantId } });
  await prisma.journalEntry.deleteMany({
    where: { tenantId, entryNumber: "JE-BI-101" },
  });
  await prisma.salesOrderItem.deleteMany({ where: { tenantId } });
  await prisma.salesOrder.deleteMany({
    where: { tenantId, orderNumber: "SO-BI-101" },
  });
  await prisma.product.deleteMany({ where: { tenantId, sku: "SKU-BI-TEST" } });
  await prisma.unit.deleteMany({ where: { tenantId, symbol: "PC" } });
  await prisma.category.deleteMany({
    where: { tenantId, name: "BI Test Category" },
  });
  await prisma.customer.deleteMany({
    where: { tenantId, name: "BI Corporate Customer" },
  });
  await prisma.account.deleteMany({ where: { tenantId, code: "4000" } });
  await prisma.notification.deleteMany({
    where: { tenantId, title: { contains: "Breached" } },
  });

  console.log(
    "All Phase 45 Business Intelligence E2E integration tests completed successfully!",
  );
  app.close();
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
