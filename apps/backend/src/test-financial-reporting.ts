/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Financial Reporting integration tests...");
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
  const suffix = ` ${Date.now()}`;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables
  console.log("Cleaning up database tables...");
  await prisma.financialPeriod.deleteMany({});
  await prisma.journalEntryLine.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.account.deleteMany({});

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

  // Seed default Chart of Accounts for Tenant A using prisma
  console.log("Seeding accounts for Tenant A...");
  const cashAcc = await prisma.account.create({
    data: { tenantId: tenantIdA, code: "1010", name: "Cash", type: "ASSET", balance: 0 },
  });
  const bankAcc = await prisma.account.create({
    data: { tenantId: tenantIdA, code: "1020", name: "Bank", type: "ASSET", balance: 0 },
  });
  const arAcc = await prisma.account.create({
    data: { tenantId: tenantIdA, code: "1200", name: "Accounts Receivable", type: "ASSET", balance: 0 },
  });
  const invAcc = await prisma.account.create({
    data: { tenantId: tenantIdA, code: "1400", name: "Inventory", type: "ASSET", balance: 0 },
  });
  const apAcc = await prisma.account.create({
    data: { tenantId: tenantIdA, code: "2000", name: "Accounts Payable", type: "LIABILITY", balance: 0 },
  });
  const equityAcc = await prisma.account.create({
    data: { tenantId: tenantIdA, code: "3000", name: "Owner Equity", type: "EQUITY", balance: 0 },
  });
  const revAcc = await prisma.account.create({
    data: { tenantId: tenantIdA, code: "4000", name: "Sales Revenue", type: "REVENUE", balance: 0 },
  });
  const cogsAcc = await prisma.account.create({
    data: { tenantId: tenantIdA, code: "5000", name: "COGS", type: "EXPENSE", balance: 0 },
  });
  const expAcc = await prisma.account.create({
    data: { tenantId: tenantIdA, code: "5100", name: "Rent Expense", type: "EXPENSE", balance: 0 },
  });

  // Post initial balanced journal entry in Tenant A (Jan 15, 2026)
  // Debit Cash 1000, Credit Owner Equity 1000
  console.log("Posting balanced manual journal entry...");
  const jeRes = await fetch(`${baseUrl}/accounting/journals`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      postingDate: "2026-01-15T00:00:00.000Z",
      description: "Initial Capital Investment",
      lines: [
        { accountId: cashAcc.id, debit: 1000, credit: 0, description: "Capital investment debit" },
        { accountId: equityAcc.id, debit: 0, credit: 1000, description: "Capital investment credit" },
      ],
    }),
  });
  assert(jeRes.status === 201, "Should create draft journal entry");
  const jeData = (await jeRes.json()) as { id: string; version: number };

  const jePostRes = await fetch(`${baseUrl}/accounting/journals/${jeData.id}/post`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: jeData.version }),
  });
  assert(jePostRes.status === 200, "Should post journal entry");

  // Post second balanced journal entry for Sales/Revenue (Jan 20, 2026)
  // Debit Accounts Receivable 500, Credit Sales Revenue 500
  const je2Res = await fetch(`${baseUrl}/accounting/journals`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      postingDate: "2026-01-20T00:00:00.000Z",
      description: "Sales Invoice Journal",
      lines: [
        { accountId: arAcc.id, debit: 500, credit: 0, description: "AR debit" },
        { accountId: revAcc.id, debit: 0, credit: 500, description: "Revenue credit" },
      ],
    }),
  });
  assert(je2Res.status === 201, "Should create second draft journal entry");
  const je2Data = (await je2Res.json()) as { id: string; version: number };
  const je2PostRes = await fetch(`${baseUrl}/accounting/journals/${je2Data.id}/post`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: je2Data.version }),
  });
  assert(je2PostRes.status === 200, "Should post second journal entry");

  // Post third balanced journal entry for Expenses (Jan 25, 2026)
  // Debit Rent Expense 200, Credit Bank 200
  const je3Res = await fetch(`${baseUrl}/accounting/journals`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      postingDate: "2026-01-25T00:00:00.000Z",
      description: "Rent Expense",
      lines: [
        { accountId: expAcc.id, debit: 200, credit: 0, description: "Rent Expense debit" },
        { accountId: bankAcc.id, debit: 0, credit: 200, description: "Rent Expense credit" },
      ],
    }),
  });
  assert(je3Res.status === 201, "Should create expense journal entry");
  const je3Data = (await je3Res.json()) as { id: string; version: number };
  const je3PostRes = await fetch(`${baseUrl}/accounting/journals/${je3Data.id}/post`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: je3Data.version }),
  });
  assert(je3PostRes.status === 200, "Should post third journal entry");

  // 2. Financial Period CRUD
  console.log("Creating Q1 2026 financial period...");
  const createPeriodRes = await fetch(`${baseUrl}/financial/periods`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Q1-2026",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-03-31T23:59:59.999Z",
    }),
  });
  assert(createPeriodRes.status === 201, "Should create financial period");
  const period = (await createPeriodRes.json()) as { id: string; name: string; version: number; status: string };
  assert(period.name === "Q1-2026", "Name must match");
  assert(period.status === "OPEN", "Initial status must be OPEN");

  // Overlapping Period Prevention
  console.log("Verifying overlapping period block...");
  const overlapRes = await fetch(`${baseUrl}/financial/periods`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Jan-2026",
      startDate: "2026-01-15T00:00:00.000Z",
      endDate: "2026-02-15T00:00:00.000Z",
    }),
  });
  assert(overlapRes.status === 400, "Overlapping period creation should be blocked");

  // Query periods
  console.log("Retrieving periods list...");
  const getPeriodsRes = await fetch(`${baseUrl}/financial/periods`, { headers });
  assert(getPeriodsRes.status === 200, "Should query periods list");
  const periods = (await getPeriodsRes.json()) as any[];
  assert(periods.length >= 1, "Should contain at least one period");

  // 3. Trial Balance Verification
  console.log("Verifying Trial Balance endpoints...");
  const tbRes = await fetch(`${baseUrl}/financial/trial-balance?periodId=${period.id}`, { headers });
  assert(tbRes.status === 200, "Trial Balance call should succeed");
  const tbData = (await tbRes.json()) as any;
  assert(Number(tbData.totalDebits) === 1700, `Expected totalDebits 1700, got ${tbData.totalDebits}`);
  assert(Number(tbData.totalCredits) === 1700, `Expected totalCredits 1700, got ${tbData.totalCredits}`);

  // Test CSV export for Trial Balance
  const tbCsvRes = await fetch(`${baseUrl}/financial/trial-balance?periodId=${period.id}&export=csv`, { headers });
  assert(tbCsvRes.status === 200, "Trial Balance CSV export should succeed");
  assert(tbCsvRes.headers.get("content-type")?.includes("text/csv") === true, "Should return CSV mime type");
  const tbCsvText = await tbCsvRes.text();
  assert(tbCsvText.includes("Code,Name,Type,Debit,Credit,Balance"), "CSV must contain headers");

  // Test PDF layout export for Trial Balance
  const tbPdfRes = await fetch(`${baseUrl}/financial/trial-balance?periodId=${period.id}&export=pdf`, { headers });
  assert(tbPdfRes.status === 200, "Trial Balance PDF export should succeed");
  const tbPdfData = (await tbPdfRes.json()) as any;
  assert(tbPdfData.title === "TRIAL BALANCE REPORT", "Should return PDF layout object");

  // 4. Profit & Loss Verification
  console.log("Verifying Profit & Loss endpoints...");
  const plRes = await fetch(`${baseUrl}/financial/profit-loss?periodId=${period.id}`, { headers });
  assert(plRes.status === 200, "Profit & Loss call should succeed");
  const plData = (await plRes.json()) as any;
  assert(Number(plData.statement.revenue) === 500, `Expected total revenue 500, got ${plData.statement.revenue}`);
  assert(Number(plData.statement.expenses) === 200, `Expected expenses 200, got ${plData.statement.expenses}`);
  assert(Number(plData.statement.netProfit) === 300, `Expected netProfit 300, got ${plData.statement.netProfit}`);

  // Test CSV export for Profit & Loss
  const plCsvRes = await fetch(`${baseUrl}/financial/profit-loss?periodId=${period.id}&export=csv`, { headers });
  assert(plCsvRes.status === 200, "P&L CSV export should succeed");
  const plCsvText = await plCsvRes.text();
  assert(plCsvText.includes("Category,Account Code,Account Name,Balance"), "CSV headers check");

  // 5. Balance Sheet Verification
  console.log("Verifying Balance Sheet endpoints...");
  const bsRes = await fetch(`${baseUrl}/financial/balance-sheet?periodId=${period.id}`, { headers });
  assert(bsRes.status === 200, "Balance Sheet call should succeed");
  const bsData = (await bsRes.json()) as any;
  // Assets: Cash (+1000), AR (+500), Rent Bank (-200) = Total Assets 1300
  assert(Number(bsData.assets.total) === 1300, `Expected Assets 1300, got ${bsData.assets.total}`);
  // Liabilities: AP (0) = Total Liabilities 0
  // Equity: Owner Equity (1000) + Net Income (300) = Total Equity 1300
  assert(Number(bsData.equity.total) === 1300, `Expected Equity 1300, got ${bsData.equity.total}`);
  assert(Number(bsData.totalLiabilitiesAndEquity) === 1300, `Expected L&E 1300, got ${bsData.totalLiabilitiesAndEquity}`);

  // Test CSV export for Balance Sheet
  const bsCsvRes = await fetch(`${baseUrl}/financial/balance-sheet?periodId=${period.id}&export=csv`, { headers });
  assert(bsCsvRes.status === 200, "Balance Sheet CSV export should succeed");
  const bsCsvText = await bsCsvRes.text();
  assert(bsCsvText.includes("Section,Account Code,Account Name,Balance"), "CSV headers check");

  // 6. Financial Summary Verification
  console.log("Verifying Financial Summary KPIs...");
  const summaryRes = await fetch(`${baseUrl}/financial/summary?periodId=${period.id}`, { headers });
  assert(summaryRes.status === 200, "Summary call should succeed");
  const summaryData = (await summaryRes.json()) as any;
  assert(Number(summaryData.revenue) === 500, "Revenue KPI check");
  assert(Number(summaryData.netProfit) === 300, "Net Profit KPI check");
  assert(Number(summaryData.cash) === 800, "Cash account balance check (debit 1000 - credit 200)");
  assert(Number(summaryData.accountsReceivable) === 500, "AR account balance check (debit 500)");

  // 7. Period Closing Verification
  console.log("Closing period Q1 2026...");
  // Attempt with bad version first to test concurrency check
  const closeBadVersion = await fetch(`${baseUrl}/financial/periods/${period.id}/close`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 99 }),
  });
  assert(closeBadVersion.status === 409, "Should fail with Conflict status on wrong version");

  // Close with correct version
  const closeRes = await fetch(`${baseUrl}/financial/periods/${period.id}/close`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: period.version }),
  });
  assert(closeRes.status === 200, "Should close period successfully");
  const closedPeriod = (await closeRes.json()) as any;
  assert(closedPeriod.status === "CLOSED", "Status must change to CLOSED");

  // Closed Period Posting Block Check
  console.log("Verifying posting block in closed period...");
  const jeBlockedRes = await fetch(`${baseUrl}/accounting/journals`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      postingDate: "2026-02-15T00:00:00.000Z", // inside closed Q1-2026 period
      description: "Blocked entry",
      lines: [
        { accountId: cashAcc.id, debit: 100, credit: 0, description: "Cash debit" },
        { accountId: equityAcc.id, debit: 0, credit: 100, description: "Equity credit" },
      ],
    }),
  });
  assert(jeBlockedRes.status === 400, "Should fail to create journal entry inside closed financial period");

  // 8. Tenant Isolation Verification
  console.log("Verifying Tenant Isolation...");
  // Create a second tenant
  const tenantIdB = "11111111-1111-1111-1111-111111111111";
  await prisma.tenant.upsert({
    where: { id: tenantIdB },
    update: {},
    create: { id: tenantIdB, name: "Tenant B ERP", slug: "tenant-b" },
  });

  const passwordHash = await argon2.hash("Password_1234_Special!", {
    type: argon2.argon2id,
  });

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

  // Login as User B
  const loginBRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "userb@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginBRes.status === 200 || loginBRes.status === 201, "User B login should succeed");
  const loginBData = (await loginBRes.json()) as { accessToken: string };
  const tokenB = loginBData.accessToken;

  const headersB = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokenB}`,
  };

  // User B queries periods list (should not see Tenant A's periods)
  const getPeriodsBRes = await fetch(`${baseUrl}/financial/periods`, { headers: headersB });
  assert(getPeriodsBRes.status === 200, "Should succeed");
  const periodsB = (await getPeriodsBRes.json()) as any[];
  assert(periodsB.length === 0, "Tenant B should see 0 financial periods of Tenant A");

  // User B tries to close Tenant A's period
  const closeByB = await fetch(`${baseUrl}/financial/periods/${period.id}/close`, {
    method: "PATCH",
    headers: headersB,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(closeByB.status === 404, "Tenant B should get 404 not found for Tenant A's financial period");

  // 9. Permission Enforcement Verification
  console.log("Verifying Permission Enforcement...");
  // Create a user C with NO permissions
  const tenantIdC = "22222222-2222-2222-2222-222222222222";
  await prisma.tenant.upsert({
    where: { id: tenantIdC },
    update: {},
    create: { id: tenantIdC, name: "Tenant C ERP", slug: "tenant-c" },
  });

  const userC = await prisma.user.upsert({
    where: { email: "userc@amdox.com" },
    update: { tenantId: tenantIdC, passwordHash },
    create: { email: "userc@amdox.com", username: "userc_plain", passwordHash, tenantId: tenantIdC },
  });

  // Login as User C (who has no role/permissions mapped)
  const loginCRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "userc@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginCRes.status === 200 || loginCRes.status === 201, "User C login should succeed");
  const tokenC = ((await loginCRes.json()) as { accessToken: string }).accessToken;

  const headersC = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokenC}`,
  };

  const unauthorizedRes = await fetch(`${baseUrl}/financial/trial-balance`, { headers: headersC });
  assert(unauthorizedRes.status === 403, "User C should get 403 Forbidden for financial statement");

  // 10. Health Endpoint Verification
  console.log("Verifying health endpoint...");
  const healthRes = await fetch("http://localhost:3009/health");
  assert(healthRes.status === 200, "Health check should return status code 200");
  const healthData = await healthRes.json();
  assert(healthData.application === "up", "Should return application 'up'");
  assert(healthData.database.status === "healthy", "Should return database 'healthy'");

  console.log("==============================================");
  console.log("ALL E2E INTEGRATION TESTS COMPLETED SUCCESSFULLY!");
  console.log("==============================================");
  
  await app.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
