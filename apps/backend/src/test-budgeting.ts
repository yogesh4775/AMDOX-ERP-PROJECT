/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, BudgetStatus, BudgetPeriodType, AccountType } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as argon2 from "argon2";
import { AccountingService } from "./modules/accounting/accounting.service";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Budgeting & Forecasting integration E2E tests...");
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
  await app.listen(3012);

  const baseUrl = "http://localhost:3012/api";
  let adminToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables
  console.log("Cleaning up database tables...");
  await prisma.budgetRevisionItem.deleteMany({});
  await prisma.budgetRevision.deleteMany({});
  await prisma.budgetItem.deleteMany({});
  await prisma.budget.deleteMany({});
  await prisma.journalEntryLine.deleteMany({});
  await prisma.journalEntry.deleteMany({});

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

  // Seed chart of accounts for Tenant A
  const accountingService = app.get(AccountingService);
  await accountingService.seedChartOfAccounts(prisma as any, tenantIdA);

  // Fetch active GL accounts
  console.log("Locating GL accounts...");
  const revAcc = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "4000" } });
  const expAcc = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "5000" } });
  const assetAcc = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "1020" } });

  assert(!!revAcc && !!expAcc && !!assetAcc, "Required GL accounts must exist in DB");

  // 2. Verify Budget CRUD
  console.log("Verifying Budget CRUD...");
  const createRes = await fetch(`${baseUrl}/budget/budgets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "FY 2026 Operations",
      fiscalYear: 2026,
      periodType: BudgetPeriodType.MONTHLY,
      versionNumber: 1,
      items: [
        {
          glAccountId: revAcc!.id,
          category: "Revenue",
          amount: 50000.00,
          periodStart: "2026-01-01T00:00:00Z",
          periodEnd: "2026-01-31T23:59:59Z",
        },
        {
          glAccountId: expAcc!.id,
          category: "Expense",
          amount: 30000.00,
          periodStart: "2026-01-01T00:00:00Z",
          periodEnd: "2026-01-31T23:59:59Z",
        },
      ],
    }),
  });

  assert(createRes.status === 200 || createRes.status === 201, "Budget creation should succeed");
  const budget = await createRes.json();
  assert(budget.status === BudgetStatus.DRAFT, "Status defaults to DRAFT");
  assert(budget.items.length === 2, "Items count matches");

  // Verify duplicate budget block
  const createDupRes = await fetch(`${baseUrl}/budget/budgets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "FY 2026 Operations",
      fiscalYear: 2026,
      periodType: BudgetPeriodType.MONTHLY,
      versionNumber: 1,
      items: [
        {
          glAccountId: revAcc!.id,
          category: "Revenue",
          amount: 10000.00,
          periodStart: "2026-01-01T00:00:00Z",
          periodEnd: "2026-01-31T23:59:59Z",
        },
      ],
    }),
  });
  assert(createDupRes.status === 400, "Duplicate budget name + year + version must fail");

  // Read list
  const listRes = await fetch(`${baseUrl}/budget/budgets`, { headers });
  const list = await listRes.json();
  assert(list.length > 0, "Budget list has entries");

  // Read by ID
  const getRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}`, { headers });
  const fetched = await getRes.json();
  assert(fetched.name === "FY 2026 Operations", "Retrieve by ID matches");

  // Update Budget name (validating version lock)
  const updateRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "FY 2026 Main Operations",
      expectedVersion: budget.version,
    }),
  });
  assert(updateRes.status === 200 || updateRes.status === 201, "Update should succeed");
  const updatedBudget = await updateRes.json();

  // Optimistic concurrency mismatch check
  const badUpdateRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "FY 2026 Broken",
      expectedVersion: budget.version, // stale version
    }),
  });
  assert(badUpdateRes.status === 409, "Outdated version update triggers CONFLICT status");

  // 3. Approval Workflow
  console.log("Verifying Approval Workflow...");
  const submitRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}/submit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedVersion: updatedBudget.version }),
  });
  assert(submitRes.status === 200 || submitRes.status === 201, "Submit should succeed");
  const submitted = await submitRes.json();
  assert(submitted.status === BudgetStatus.PENDING_APPROVAL, "Transitions to PENDING_APPROVAL");

  const approveRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ status: BudgetStatus.APPROVED }),
  });
  assert(approveRes.status === 200 || approveRes.status === 201, "Approve should succeed");
  const approved = await approveRes.json();
  assert(approved.status === BudgetStatus.APPROVED, "Status changes to APPROVED");

  const lockRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}/lock`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedVersion: approved.version }),
  });
  assert(lockRes.status === 200 || lockRes.status === 201, "Lock should succeed");
  const locked = await lockRes.json();
  assert(locked.status === BudgetStatus.LOCKED, "Status locks to LOCKED");

  // Locked budgets cannot be modified directly
  const badLockUpdateRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Locked Modification",
      expectedVersion: locked.version,
    }),
  });
  assert(badLockUpdateRes.status === 400, "Direct edits to locked budgets must be blocked");

  // 4. Budget Revisions
  console.log("Verifying Budget Revisions...");
  const revisionRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}/revision`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      reason: "Revision for increased operating expense forecast",
      revisionItems: [
        {
          glAccountId: expAcc!.id,
          amount: 35000.00,
        },
      ],
    }),
  });
  assert(revisionRes.status === 200 || revisionRes.status === 201, "Revisions posting should succeed");
  const revision = await revisionRes.json();
  assert(revision.revisionNumber === 1, "Revision increments to 1");

  // Verify main budget item matches revised amount
  const checkRevisedRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}`, { headers });
  const checkRevised = await checkRevisedRes.json();
  const expItem = checkRevised.items.find((i: any) => i.glAccountId === expAcc!.id);
  assert(Number(expItem.amount) === 35000.00, "Budget amount updated from revision");

  // 5. Actual vs Budget Variance
  console.log("Verifying Actual vs Budget variance computations...");
  // Post actual Journal Entry
  const tenantId = budget.tenantId;
  const je = await prisma.journalEntry.create({
    data: {
      tenantId,
      entryNumber: "JE-TEST-001",
      postingDate: new Date("2026-01-15T12:00:00Z"),
      sourceType: "MANUAL",
      status: "POSTED",
      lines: {
        create: [
          {
            tenantId,
            accountId: expAcc!.id,
            debit: 25000.00,
            credit: 0,
            description: "Office rent expense",
          },
          {
            tenantId,
            accountId: assetAcc!.id,
            debit: 0,
            credit: 25000.00,
            description: "Office rent expense",
          },
        ],
      },
    },
  });

  const varianceRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}/variance`, { headers });
  assert(varianceRes.status === 200, "Variance endpoint should succeed");
  const varianceReport = await varianceRes.json();

  const expVariance = varianceReport.find((v: any) => v.glAccountId === expAcc!.id);
  assert(Number(expVariance.budget) === 35000.00, "Revised budget reported correctly");
  assert(Number(expVariance.actual) === 25000.00, "Actual ledger amounts aggregated correctly");
  assert(Number(expVariance.variance) === -10000.00, "Variance calculated correctly");

  // 6. Scenario Forecasting
  console.log("Verifying Scenario Planning...");
  const optRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}/forecast?scenario=OPTIMISTIC`, { headers });
  assert(optRes.status === 200, "Optimistic scenario forecast succeeds");
  const optForecast = await optRes.json();
  const expOpt = optForecast.find((f: any) => f.glAccountId === expAcc!.id);
  // Expenses in optimistic multiplier should be -10% -> 35000 * 0.9 = 31500
  assert(Number(expOpt.forecastedAmount) === 31500.00, "Optimistic expense forecast calculations correct");

  const pesRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}/forecast?scenario=PESSIMISTIC`, { headers });
  assert(pesRes.status === 200, "Pessimistic scenario forecast succeeds");
  const pesForecast = await pesRes.json();
  const expPes = pesForecast.find((f: any) => f.glAccountId === expAcc!.id);
  // Expenses in pessimistic multiplier should be +15% -> 35000 * 1.15 = 40250
  assert(Number(expPes.forecastedAmount) === 40250.00, "Pessimistic expense forecast calculations correct");

  // 7. Dashboard Widgets
  console.log("Verifying Dashboard widgets...");
  const widgetRes = await fetch(`${baseUrl}/budget/dashboard`, { headers });
  assert(widgetRes.status === 200, "Dashboard fetch succeeds");
  const widgets = await widgetRes.json();
  assert(Number(widgets.totalBudgetedExpense) === 35000.00, "Dashboard aggregated budgeted expenses correctly");
  assert(Number(widgets.totalActualExpense) === 25000.00, "Dashboard aggregated actual expenses correctly");
  assert(widgets.consumptionPercentage === 71.43, "Dashboard calculated consumption correctly");

  // 8. CSV export format
  console.log("Verifying CSV export...");
  const csvRes = await fetch(`${baseUrl}/budget/budgets/${budget.id}/variance?export=csv`, { headers });
  assert(csvRes.status === 200, "CSV export succeeds");
  const csvText = await csvRes.text();
  assert(csvText.includes("GL Code,GL Name,Category,Budgeted,Actual,Variance,Variance %"), "CSV columns match");

  // 9. Tenant Isolation check
  console.log("Verifying Tenant Isolation...");
  const tenantIdB = "22222222-2222-2222-2222-222222222222";
  await prisma.tenant.upsert({
    where: { id: tenantIdB },
    update: {},
    create: { id: tenantIdB, name: "Tenant B Corp", slug: "tenant-b-budget" },
  });

  const passwordHash = await argon2.hash("Password_1234_Special!");
  const userB = await prisma.user.upsert({
    where: { email: "userb_budget@amdox.com" },
    update: { tenantId: tenantIdB, passwordHash },
    create: { email: "userb_budget@amdox.com", username: "userb_budget_admin", passwordHash, tenantId: tenantIdB },
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
      username: "userb_budget@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  const loginBData = await loginBRes.json();
  const headersB = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginBData.accessToken}`,
  };

  const budgetsBRes = await fetch(`${baseUrl}/budget/budgets`, { headers: headersB });
  const budgetsB = await budgetsBRes.json();
  assert(budgetsB.length === 0, "Tenant B should see zero budgets from Tenant A");

  const badGetBudget = await fetch(`${baseUrl}/budget/budgets/${budget.id}`, { headers: headersB });
  assert(badGetBudget.status === 404 || badGetBudget.status === 403, "Tenant B cannot fetch Tenant A's budget");

  // 10. Health endpoint check
  console.log("Verifying health endpoint...");
  const healthRes = await fetch("http://localhost:3012/health");
  assert(healthRes.status === 200, "Health check must be online");

  console.log("==============================================");
  console.log("ALL BUDGETING & FORECASTING TESTS PASSED!");
  console.log("==============================================");

  await app.close();
  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test execution failed with error:", e);
  process.exit(1);
});
