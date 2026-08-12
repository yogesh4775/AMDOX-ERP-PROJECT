/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, BankAccountCategory, BankAccountStatus, BankTransactionType, BankTransactionStatus, ReconciliationStatus, MatchingStatus, JournalSourceType } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as argon2 from "argon2";
import { AccountingService } from "./modules/accounting/accounting.service";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Bank Reconciliation & Treasury integration tests...");
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
  await app.listen(3011);

  const baseUrl = "http://localhost:3011/api";
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

  // Fixed Asset tables
  await prisma.assetMaintenance.deleteMany({});
  await prisma.assetTransfer.deleteMany({});
  await prisma.assetDepreciation.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.assetCategory.deleteMany({});

  // Bank Reconciliation tables
  await prisma.bankReconciliationLine.deleteMany({});
  await prisma.bankReconciliation.deleteMany({});
  await prisma.bankTransaction.deleteMany({});
  await prisma.bankAccount.deleteMany({});

  // Journal Entry tables
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

  // 2. Seeding Check: Verify chart of accounts includes Bank, Interest, Charges GL codes
  console.log("Verifying GL accounts presence...");
  const bankGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "1020" } });
  const cashGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "1010" } });
  const interestIncGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "4200" } });
  const interestExpGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "5500" } });
  const chargesGL = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "5600" } });

  assert(!!bankGL && !!cashGL && !!interestIncGL && !!interestExpGL && !!chargesGL, "GL accounts must be seeded");

  const bankGLId = bankGL!.id;
  const cashGLId = cashGL!.id;
  const interestIncGLId = interestIncGL!.id;
  const interestExpGLId = interestExpGL!.id;
  const chargesGLId = chargesGL!.id;

  // 3. Bank Account CRUD & Validations
  console.log("Verifying Bank Account CRUD...");
  // Create Bank Account A (Chase Operating - Current)
  const createAccARes = await fetch(`${baseUrl}/bank/accounts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Chase Operating A",
      accountNumber: "111-222-333",
      iban: "US1234567890111222333",
      swiftCode: "CHASEUS33",
      currency: "USD",
      category: BankAccountCategory.CURRENT,
      openingBalance: 10000.00,
      glAccountId: bankGLId,
    }),
  });
  assert(createAccARes.status === 201 || createAccARes.status === 200, "Should create Bank Account A successfully");
  const bankAccountA = await createAccARes.json();
  assert(bankAccountA.accountNumber === "111-222-333", "Account number check");

  // Validate: Unique account number per tenant
  const dupAccRes = await fetch(`${baseUrl}/bank/accounts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Chase Operating Duplicate",
      accountNumber: "111-222-333",
      currency: "USD",
      category: BankAccountCategory.CURRENT,
      openingBalance: 5000.00,
      glAccountId: bankGLId,
    }),
  });
  assert(dupAccRes.status === 400, "Should fail with duplicate account number");

  // Validate: Opening balance cannot be negative
  const negBalanceRes = await fetch(`${baseUrl}/bank/accounts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Chase Negative",
      accountNumber: "999-999-999",
      currency: "USD",
      category: BankAccountCategory.CURRENT,
      openingBalance: -100.00,
      glAccountId: bankGLId,
    }),
  });
  assert(negBalanceRes.status === 400, "Should fail with negative opening balance");

  // Create Bank Account B (Chase Savings - Savings)
  const createAccBRes = await fetch(`${baseUrl}/bank/accounts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Chase Savings B",
      accountNumber: "444-555-666",
      currency: "USD",
      category: BankAccountCategory.SAVINGS,
      openingBalance: 5000.00,
      glAccountId: cashGLId,
    }),
  });
  const bankAccountB = await createAccBRes.json();

  // Optimistic concurrency update check
  const badUpdateRes = await fetch(`${baseUrl}/bank/accounts/${bankAccountA.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Chase Operating A Updated",
      expectedVersion: 99,
    }),
  });
  assert(badUpdateRes.status === 409, "Should fail on expectedVersion mismatch");

  const updateRes = await fetch(`${baseUrl}/bank/accounts/${bankAccountA.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Chase Operating A Updated",
      expectedVersion: bankAccountA.version,
    }),
  });
  assert(updateRes.status === 200, "Should update bank account successfully");
  const updatedBankAccountA = await updateRes.json();
  assert(updatedBankAccountA.version === bankAccountA.version + 1, "Version increment check");

  // 4. Deposits, Withdrawals, Transfers, Charges & Interest execution
  console.log("Verifying Bank Transactions execution...");
  
  // Deposit 2000 into Bank Account A offset with Cash account
  const depositRes = await fetch(`${baseUrl}/bank/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccountA.id,
      type: BankTransactionType.DEPOSIT,
      amount: 2000.00,
      transactionDate: new Date().toISOString(),
      reference: "DEP-001",
      description: "Cash Deposit",
      contraAccountId: cashGLId,
    }),
  });
  assert(depositRes.status === 201 || depositRes.status === 200, "Deposit should succeed");
  const depositTx = await depositRes.json();
  
  // Verify balance updated: 10000 + 2000 = 12000
  const dbBankA_afterDep = await prisma.bankAccount.findUnique({ where: { id: bankAccountA.id } });
  assert(Number(dbBankA_afterDep!.currentBalance) === 12000.00, `Expected 12000, got ${dbBankA_afterDep!.currentBalance}`);

  // Verify journal entry for deposit was posted: Debit Bank GL (1020) 2000, Credit Cash GL (1010) 2000
  const journalDep = await prisma.journalEntry.findFirst({
    where: { tenantId: tenantIdA, sourceType: JournalSourceType.BANK, sourceId: depositTx.id },
    include: { lines: { include: { account: true } } },
  });
  assert(!!journalDep, "Journal entry posted for deposit");
  const depLineBank = journalDep!.lines.find((l) => l.account.code === "1020");
  const depLineCash = journalDep!.lines.find((l) => l.account.code === "1010");
  assert(Number(depLineBank!.debit) === 2000.00 && Number(depLineCash!.credit) === 2000.00, "GL amounts match");

  // Withdrawal 1000 from Bank Account A offset with Cash account
  const withdrawalRes = await fetch(`${baseUrl}/bank/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccountA.id,
      type: BankTransactionType.WITHDRAWAL,
      amount: 1000.00,
      transactionDate: new Date().toISOString(),
      reference: "WIT-001",
      description: "Cash Withdrawal",
      contraAccountId: cashGLId,
    }),
  });
  assert(withdrawalRes.status === 201 || withdrawalRes.status === 200, "Withdrawal should succeed");
  
  // Verify balance updated: 12000 - 1000 = 11000
  const dbBankA_afterWit = await prisma.bankAccount.findUnique({ where: { id: bankAccountA.id } });
  assert(Number(dbBankA_afterWit!.currentBalance) === 11000.00, "Current balance subtraction check");

  // Verify insufficient funds block
  const badWitRes = await fetch(`${baseUrl}/bank/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccountA.id,
      type: BankTransactionType.WITHDRAWAL,
      amount: 50000.00, // Insufficient
      transactionDate: new Date().toISOString(),
      reference: "WIT-BAD",
      contraAccountId: cashGLId,
    }),
  });
  assert(badWitRes.status === 400, "Should block withdrawal on insufficient funds");

  // Inter-bank transfer: Transfer 3000 from Bank Account A to Bank Account B
  const transferRes = await fetch(`${baseUrl}/bank/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccountA.id,
      type: BankTransactionType.TRANSFER,
      amount: 3000.00,
      transactionDate: new Date().toISOString(),
      reference: "TRF-001",
      description: "Internal Transfer to B",
      transferToBankAccountId: bankAccountB.id,
    }),
  });
  assert(transferRes.status === 201 || transferRes.status === 200, "Transfer should succeed");
  const transferTx = await transferRes.json();

  // Verify both bank accounts balances updated atomically
  // A: 11000 - 3000 = 8000
  // B: 5000 + 3000 = 8000
  const dbBankA_afterTrf = await prisma.bankAccount.findUnique({ where: { id: bankAccountA.id } });
  const dbBankB_afterTrf = await prisma.bankAccount.findUnique({ where: { id: bankAccountB.id } });
  assert(Number(dbBankA_afterTrf!.currentBalance) === 8000.00, "Source balance subtracted");
  assert(Number(dbBankB_afterTrf!.currentBalance) === 8000.00, "Destination balance added");

  // Verify journal entry for transfer was posted: Debit Cash/GL of B (1010) 3000, Credit Bank/GL of A (1020) 3000
  const journalTrf = await prisma.journalEntry.findFirst({
    where: { tenantId: tenantIdA, sourceType: JournalSourceType.BANK, sourceId: transferTx.id },
    include: { lines: { include: { account: true } } },
  });
  assert(!!journalTrf, "Journal entry posted for transfer");
  const trfLineB = journalTrf!.lines.find((l) => l.account.code === "1010");
  const trfLineA = journalTrf!.lines.find((l) => l.account.code === "1020");
  assert(Number(trfLineB!.debit) === 3000.00 && Number(trfLineA!.credit) === 3000.00, "Transfer journal entries check");

  // Bank Charges: 50 fee on Bank Account A
  const chargeRes = await fetch(`${baseUrl}/bank/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccountA.id,
      type: BankTransactionType.BANK_CHARGES,
      amount: 50.00,
      transactionDate: new Date().toISOString(),
      reference: "CHG-001",
      description: "Monthly Service Fee",
      contraAccountId: chargesGLId,
    }),
  });
  assert(chargeRes.status === 201 || chargeRes.status === 200, "Charges recording should succeed");

  // Interest Income: 100 on Bank Account A
  const intIncRes = await fetch(`${baseUrl}/bank/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccountA.id,
      type: BankTransactionType.INTEREST_INCOME,
      amount: 100.00,
      transactionDate: new Date().toISOString(),
      reference: "INT-INC-001",
      description: "Savings Interest Earned",
      contraAccountId: interestIncGLId,
    }),
  });
  assert(intIncRes.status === 201 || intIncRes.status === 200, "Interest income recording should succeed");

  // Interest Expense: 30 on Bank Account A
  const intExpRes = await fetch(`${baseUrl}/bank/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccountA.id,
      type: BankTransactionType.INTEREST_EXPENSE,
      amount: 30.00,
      transactionDate: new Date().toISOString(),
      reference: "INT-EXP-001",
      description: "Overdraft Interest Charged",
      contraAccountId: interestExpGLId,
    }),
  });
  assert(intExpRes.status === 201 || intExpRes.status === 200, "Interest expense recording should succeed");

  // 5. Reconciliation statements and matching engine execution
  console.log("Verifying Bank Reconciliation Matching...");
  
  // Set up a statement for Bank Account A
  const stmtDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 10);
  const endDate = new Date();

  // Create statement
  // Opening: 10000. Deposited: 2000. Withdrew: 1000. Transferred: 3000. Charges: 50. Int Inc: 100. Int Exp: 30.
  // Net statement lines: 2000 (deposit) - 1000 (wit) - 3000 (trf) - 50 (fee) + 100 (int inc) - 30 (int exp) = -1980.
  // Expected closing: 10000 - 1980 = 8020.
  const createStmtRes = await fetch(`${baseUrl}/bank/reconciliation`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccountA.id,
      statementNumber: "STMT-2026-07",
      statementDate: stmtDate.toISOString(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      openingBalance: 10000.00,
      closingBalance: 8020.00,
      statementLines: [
        { statementLineDate: new Date().toISOString(), statementLineRef: "DEP-001", statementLineAmount: 2000.00 },
        { statementLineDate: new Date().toISOString(), statementLineRef: "WIT-001", statementLineAmount: -1000.00 },
        { statementLineDate: new Date().toISOString(), statementLineRef: "TRF-001", statementLineAmount: -3000.00 },
        { statementLineDate: new Date().toISOString(), statementLineRef: "CHG-001", statementLineAmount: -50.00 },
        { statementLineDate: new Date().toISOString(), statementLineRef: "INT-INC-001", statementLineAmount: 100.00 },
        { statementLineDate: new Date().toISOString(), statementLineRef: "INT-EXP-001", statementLineAmount: -30.00 },
      ],
    }),
  });
  assert(createStmtRes.status === 201 || createStmtRes.status === 200, "Should create Reconciliation statement");
  const statement = await createStmtRes.json();

  // Overlapping period check: should return 400
  const overlapStmtRes = await fetch(`${baseUrl}/bank/reconciliation`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccountA.id,
      statementNumber: "STMT-OVERLAP",
      statementDate: stmtDate.toISOString(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      openingBalance: 8020.00,
      closingBalance: 9000.00,
    }),
  });
  assert(overlapStmtRes.status === 400, "Should prevent overlapping statements");

  // Run Auto matching
  const autoMatchRes = await fetch(`${baseUrl}/bank/reconciliation/${statement.id}/auto-match`, {
    method: "POST",
    headers,
  });
  assert(autoMatchRes.status === 200 || autoMatchRes.status === 201, "Auto-match should run successfully");

  // Verify that all statement lines were auto-matched
  const dbLines_afterAuto = await prisma.bankReconciliationLine.findMany({
    where: { reconciliationId: statement.id },
  });
  const allReconciled = dbLines_afterAuto.every((l) => l.matchingStatus === MatchingStatus.AUTO_MATCHED);
  assert(allReconciled, "All lines must be auto-matched successfully");

  // Verify that transactions status transitioned to CLEARED
  const clearedTxs = await prisma.bankTransaction.findMany({
    where: { bankAccountId: bankAccountA.id, status: BankTransactionStatus.CLEARED },
  });
  assert(clearedTxs.length === 6, "All 6 transactions must be marked as CLEARED");

  // Finalize statement
  const freshStmt = await prisma.bankReconciliation.findUnique({ where: { id: statement.id } });
  const finalizeRes = await fetch(`${baseUrl}/bank/reconciliation/${statement.id}/finalize`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      expectedVersion: freshStmt!.version,
    }),
  });
  if (finalizeRes.status !== 200 && finalizeRes.status !== 201) {
    const errText = await finalizeRes.text();
    console.error(`Finalize statement failed. Status: ${finalizeRes.status}. Response: ${errText}`);
  }
  assert(finalizeRes.status === 200 || finalizeRes.status === 201, "Finalize statement should succeed");
  const finalizedStmt = await finalizeRes.json();
  assert(finalizedStmt.status === ReconciliationStatus.COMPLETED, "Status locks to COMPLETED");

  // Manual matching & partial matching tests (on a new draft statement)
  // Let's create Bank Transaction C = 500.00 deposit
  const depositCRes = await fetch(`${baseUrl}/bank/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccountB.id,
      type: BankTransactionType.DEPOSIT,
      amount: 500.00,
      transactionDate: new Date().toISOString(),
      reference: "DEP-C",
      contraAccountId: bankGLId,
    }),
  });
  const txC = await depositCRes.json();

  const startDateB = new Date();
  startDateB.setDate(startDateB.getDate() - 1);
  const createStmtBRes = await fetch(`${baseUrl}/bank/reconciliation`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccountB.id,
      statementNumber: "STMT-B-001",
      statementDate: new Date().toISOString(),
      startDate: startDateB.toISOString(),
      endDate: new Date().toISOString(),
      openingBalance: 8000.00,
      closingBalance: 8500.00,
      statementLines: [
        { statementLineDate: new Date().toISOString(), statementLineRef: "MANUAL-LINE", statementLineAmount: 500.00 },
      ],
    }),
  });
  const statementB = await createStmtBRes.json();
  const statementBLine = await prisma.bankReconciliationLine.findFirst({ where: { reconciliationId: statementB.id } });

  // Manual matching
  const manualMatchRes = await fetch(`${baseUrl}/bank/reconciliation/match`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      reconciliationLineId: statementBLine!.id,
      bankTransactionId: txC.id,
      matchingStatus: MatchingStatus.MANUALLY_MATCHED,
      expectedVersion: statementBLine!.version,
    }),
  });
  assert(manualMatchRes.status === 200 || manualMatchRes.status === 201, "Manual match should succeed");

  // 6. Treasury dashboard cash posisi & currency summary
  console.log("Verifying Dashboard Metrics...");
  const dashRes = await fetch(`${baseUrl}/bank/dashboard`, { headers });
  assert(dashRes.status === 200, "Dashboard fetch succeeds");
  const dash = await dashRes.json();
  assert(Number(dash.cashPosition) > 0, "Cash position check");
  assert(!!dash.cashByCurrency["USD"], "USD currency cash position exists");
  assert(!!dash.cashByBank["Chase Operating A Updated"], "Bank cash position check");

  // 7. Verify exports
  console.log("Verifying CSV reports export...");
  const csvRes = await fetch(`${baseUrl}/bank/reconciliation?export=csv`, { headers });
  assert(csvRes.status === 200, "History CSV export succeeds");
  const csvText = await csvRes.text();
  assert(csvText.includes("ID,Bank Account,Statement Number"), "CSV columns validation");

  // 8. Tenant Isolation check
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

  const accountsBRes = await fetch(`${baseUrl}/bank/accounts`, { headers: headersB });
  const accountsB = await accountsBRes.json();
  assert(accountsB.length === 0, "Tenant B should see zero accounts");

  const badGetAccount = await fetch(`${baseUrl}/bank/accounts/${bankAccountA.id}`, { headers: headersB });
  assert(badGetAccount.status === 404 || badGetAccount.status === 403, "Tenant B cannot fetch Tenant A's bank account");

  // 9. Health endpoint check
  console.log("Verifying health endpoint...");
  const healthRes = await fetch("http://localhost:3011/health");
  assert(healthRes.status === 200, "Health check must be online");

  console.log("==============================================");
  console.log("ALL BANK RECONCILIATION & TREASURY TESTS PASSED!");
  console.log("==============================================");

  await app.close();
  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test execution failed with error:", e);
  process.exit(1);
});
