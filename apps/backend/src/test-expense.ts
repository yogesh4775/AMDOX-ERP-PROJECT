/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import * as argon2 from "argon2";
import {
  PrismaClient,
  EmployeeStatus,
  AccountType,
  AccountStatus,
  ExpenseClaimStatus,
  ExpenseApprovalStatus,
  MediaFileType,
} from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Expense claims integration E2E tests...");
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
  await app.listen(3019);

  const baseUrl = "http://localhost:3019/api";
  let adminToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables
  console.log("Cleaning up database tables...");
  await prisma.expenseClaimApproval.deleteMany({});
  await prisma.expenseClaimItem.deleteMany({});
  await prisma.expenseClaim.deleteMany({});
  
  // Reconciliations & other dependencies
  await prisma.bankReconciliationLine.deleteMany({});
  await prisma.bankReconciliation.deleteMany({});
  await prisma.bankTransaction.deleteMany({});
  await prisma.bankAccount.deleteMany({});
  await prisma.journalEntryLine.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.account.deleteMany({});

  await prisma.employeeDocument.deleteMany({});
  await prisma.employee.deleteMany({});

  // Clean test roles/users to avoid duplicates
  await prisma.userRole.deleteMany({
    where: {
      user: {
        email: { in: ["manager.bob@amdox.com", "finance.frank@amdox.com", "userb.expense@amdox.com"] }
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      email: { in: ["manager.bob@amdox.com", "finance.frank@amdox.com", "userb.expense@amdox.com"] }
    }
  });
  await prisma.rolePermission.deleteMany({
    where: {
      role: {
        name: { in: ["Manager Role", "Finance Role", "Tenant B Role"] }
      }
    }
  });
  await prisma.role.deleteMany({
    where: {
      name: { in: ["Manager Role", "Finance Role", "Tenant B Role"] }
    }
  });
  await prisma.mediaFile.deleteMany({});

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
  assert(loginRes.status === 200, "Admin login successful");
  const loginData = await loginRes.json();
  adminToken = loginData.accessToken;
  const adminUser = await prisma.user.findFirst({ where: { email: "admin@amdox.com" } });
  assert(!!adminUser, "Admin user must exist in DB");
  const tenantIdA = adminUser!.tenantId!;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  // Seed GL Accounts under Tenant A
  console.log("Seeding GL Accounts for Tenant A...");
  const travelAcc = await prisma.account.create({
    data: {
      tenantId: tenantIdA,
      code: "EXP-TRAVEL",
      name: "Travel Expense",
      type: AccountType.EXPENSE,
      status: AccountStatus.ACTIVE,
    },
  });

  const suppliesAcc = await prisma.account.create({
    data: {
      tenantId: tenantIdA,
      code: "EXP-SUPPLIES",
      name: "Office Supplies Expense",
      type: AccountType.EXPENSE,
      status: AccountStatus.ACTIVE,
    },
  });

  const bankAcc = await prisma.account.create({
    data: {
      tenantId: tenantIdA,
      code: "AST-BANK",
      name: "Main Operational Bank Account",
      type: AccountType.ASSET,
      status: AccountStatus.ACTIVE,
    },
  });

  // Seed employees and user records under Tenant A
  console.log("Seeding employees and managers...");
  const passwordHash = await argon2.hash("Password_1234_Special!");
  
  // Manager Bob
  const managerUser = await prisma.user.create({
    data: {
      tenantId: tenantIdA,
      email: "manager.bob@amdox.com",
      username: "manager_bob",
      passwordHash,
    },
  });

  const managerEmp = await prisma.employee.create({
    data: {
      tenantId: tenantIdA,
      employeeCode: "EMP-MGR-01",
      firstName: "Bob",
      lastName: "Manager",
      email: "manager.bob@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date(),
    },
  });

  // Assign Manager Bob Role
  const managerRole = await prisma.role.create({
    data: {
      tenantId: tenantIdA,
      name: "Manager Role",
    },
  });

  const permissionsList = await prisma.permission.findMany({
    where: {
      name: { in: ["expense:claim:read", "expense:approval:approve"] }
    }
  });

  for (const perm of permissionsList) {
    await prisma.rolePermission.create({
      data: {
        roleId: managerRole.id,
        permissionId: perm.id,
      },
    });
  }

  await prisma.userRole.create({
    data: {
      userId: managerUser.id,
      roleId: managerRole.id,
      tenantId: tenantIdA,
    },
  });

  // Finance Frank
  const financeUser = await prisma.user.create({
    data: {
      tenantId: tenantIdA,
      email: "finance.frank@amdox.com",
      username: "finance_frank",
      passwordHash,
    },
  });

  const financeRole = await prisma.role.create({
    data: {
      tenantId: tenantIdA,
      name: "Finance Role",
    },
  });

  const financePermissions = await prisma.permission.findMany({
    where: {
      name: { in: ["expense:claim:read", "expense:approval:approve", "expense:reimburse:write"] }
    }
  });

  for (const perm of financePermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: financeRole.id,
        permissionId: perm.id,
      },
    });
  }

  await prisma.userRole.create({
    data: {
      userId: financeUser.id,
      roleId: financeRole.id,
      tenantId: tenantIdA,
    },
  });

  // Claimant Employee: John Doe
  const employeeJohn = await prisma.employee.create({
    data: {
      tenantId: tenantIdA,
      employeeCode: "EMP-CL-01",
      firstName: "John",
      lastName: "Doe",
      email: "admin@amdox.com", // Matches Admin User
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date(),
      reportingManagerId: managerEmp.id,
    },
  });

  // Seed MediaFile
  console.log("Seeding test media files...");
  const receiptMedia = await prisma.mediaFile.create({
    data: {
      tenantId: tenantIdA,
      uploadedBy: adminUser!.id,
      originalName: "receipt.png",
      storedName: "receipt.png",
      mimeType: "image/png",
      extension: "png",
      size: 1024,
      type: MediaFileType.IMAGE,
      storageProvider: "local",
      storagePath: "/uploads/receipt.png",
      checksum: "dummychecksum",
    },
  });

  // --- E2E SCENARIOS ---

  // 1. Create Expense Claim (Draft)
  console.log("Verifying Expense Claim Creation (Draft)...");
  const createRes = await fetch(`${baseUrl}/expense/claims`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Q2 Business Travel",
      claimDate: new Date().toISOString(),
      employeeId: employeeJohn.id,
      items: [
        {
          accountId: travelAcc.id,
          amount: 250.50,
          description: "Flight to New York",
          receiptUrl: receiptMedia.id,
        },
        {
          accountId: suppliesAcc.id,
          amount: 50.00,
          description: "Client dinner notebooks",
          receiptUrl: "/uploads/receipt.png",
        }
      ]
    }),
  });
  assert(createRes.status === 201, "Claim creation successful");
  const claim = await createRes.json();
  assert(claim.status === ExpenseClaimStatus.DRAFT, "Initial status is DRAFT");
  assert(Number(claim.totalAmount) === 300.50, "Total amount matches sum of items");

  // Validate Claim date in the future fails
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);
  const invalidDateRes = await fetch(`${baseUrl}/expense/claims`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Future Trip",
      claimDate: futureDate.toISOString(),
      employeeId: employeeJohn.id,
      items: [
        {
          accountId: travelAcc.id,
          amount: 100.00,
          description: "Hotel booking",
        }
      ]
    }),
  });
  assert(invalidDateRes.status === 400, "Future date claim creation blocked");

  // 2. Submit Claim
  console.log("Verifying Claim Submission...");
  const submitRes = await fetch(`${baseUrl}/expense/claims/${claim.id}/submit`, {
    method: "POST",
    headers,
  });
  assert(submitRes.status === 201, "Submission response is 201");
  const submittedClaim = await submitRes.json();
  assert(submittedClaim.status === ExpenseClaimStatus.SUBMITTED, "Status updated to SUBMITTED");

  // 3. Manager Approval Flow
  console.log("Verifying Manager Approval...");
  
  // Authenticate Manager Bob
  const loginManagerRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "manager.bob@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginManagerRes.status === 200, "Manager login successful");
  const managerToken = (await loginManagerRes.json()).accessToken;
  const managerHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${managerToken}`,
  };

  // Authenticate Finance Frank
  const loginFinanceRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "finance.frank@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginFinanceRes.status === 200, "Finance login successful");
  const financeToken = (await loginFinanceRes.json()).accessToken;
  const financeHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${financeToken}`,
  };

  // Try to approve Level 1 as Finance (should fail)
  const failApproveL1Res = await fetch(`${baseUrl}/expense/claims/${claim.id}/approve`, {
    method: "PATCH",
    headers: financeHeaders,
    body: JSON.stringify({ comment: "Looks okay to me" }),
  });
  assert(failApproveL1Res.status === 403, "Finance user cannot perform Manager Level 1 approval");

  // Approve Level 1 as Manager Bob
  const approveL1Res = await fetch(`${baseUrl}/expense/claims/${claim.id}/approve`, {
    method: "PATCH",
    headers: managerHeaders,
    body: JSON.stringify({ comment: "Approved travel costs" }),
  });
  assert(approveL1Res.status === 200, "Manager approves Level 1 successfully");
  const managerApproved = await approveL1Res.json();
  assert(managerApproved.approvalStage === 2, "Stage advanced to 2");

  // 4. Finance Approval Flow
  console.log("Verifying Finance Approval...");
  
  // Try to approve Level 2 as Manager Bob (should fail)
  const failApproveL2Res = await fetch(`${baseUrl}/expense/claims/${claim.id}/approve`, {
    method: "PATCH",
    headers: managerHeaders,
    body: JSON.stringify({ comment: "Approve again" }),
  });
  assert(failApproveL2Res.status === 403, "Manager cannot approve Level 2");

  // Approve Level 2 as Finance Frank
  const approveL2Res = await fetch(`${baseUrl}/expense/claims/${claim.id}/approve`, {
    method: "PATCH",
    headers: financeHeaders,
    body: JSON.stringify({ comment: "Expense budget checks out" }),
  });
  assert(approveL2Res.status === 200, "Finance approves Level 2 successfully");
  const financeApproved = await approveL2Res.json();
  assert(financeApproved.status === ExpenseClaimStatus.APPROVED, "Status updated to APPROVED");

  // 5. Reimbursement & General Ledger Integration
  console.log("Verifying Reimbursement and GL Postings...");
  
  // Try to reimburse with invalid version
  const failReimburseVersionRes = await fetch(`${baseUrl}/expense/claims/${claim.id}/reimburse`, {
    method: "POST",
    headers: financeHeaders,
    body: JSON.stringify({
      bankAccountId: bankAcc.id,
      expectedVersion: 1, // Stale version
    }),
  });
  assert(failReimburseVersionRes.status === 409, "Reimbursement fails on stale version (concurrency)");

  // Reimburse with correct version
  const reimburseRes = await fetch(`${baseUrl}/expense/claims/${claim.id}/reimburse`, {
    method: "POST",
    headers: financeHeaders,
    body: JSON.stringify({
      bankAccountId: bankAcc.id,
      expectedVersion: financeApproved.version,
    }),
  });
  assert(reimburseRes.status === 201, "Reimbursement successful");
  const reimbursedClaim = await reimburseRes.json();
  assert(reimbursedClaim.status === ExpenseClaimStatus.REIMBURSED, "Status updated to REIMBURSED");

  // Verify balanced Journal Entry in GL
  console.log("Verifying Journal Entry generation...");
  const entries = await prisma.journalEntry.findMany({
    include: { lines: true },
  });
  assert(entries.length === 1, "Exactly one Journal Entry generated");
  const je = entries[0];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of je.lines) {
    totalDebit += Number(line.debit);
    totalCredit += Number(line.credit);
  }
  assert(totalDebit === totalCredit, "Journal Entry is balanced");
  assert(totalDebit === 300.50, "Balanced amount matches claim total");

  // Verify Account balances updated
  const travelUpdated = await prisma.account.findUnique({ where: { id: travelAcc.id } });
  const suppliesUpdated = await prisma.account.findUnique({ where: { id: suppliesAcc.id } });
  const bankUpdated = await prisma.account.findUnique({ where: { id: bankAcc.id } });

  assert(Number(travelUpdated?.balance) === 250.50, "Travel Expense account debited");
  assert(Number(suppliesUpdated?.balance) === 50.00, "Supplies Expense account debited");
  assert(Number(bankUpdated?.balance) === -300.50, "Bank account credited");

  // Try to reimburse again (duplicate prevention)
  const duplicateReimburseRes = await fetch(`${baseUrl}/expense/claims/${claim.id}/reimburse`, {
    method: "POST",
    headers: financeHeaders,
    body: JSON.stringify({
      bankAccountId: bankAcc.id,
      expectedVersion: reimbursedClaim.version,
    }),
  });
  assert(duplicateReimburseRes.status === 400, "Duplicate reimbursement blocked");

  // 6. Rejection Flow
  console.log("Verifying Rejection Flow...");
  const draft2Res = await fetch(`${baseUrl}/expense/claims`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Client Lunch Reject Test",
      claimDate: new Date().toISOString(),
      employeeId: employeeJohn.id,
      items: [
        {
          accountId: suppliesAcc.id,
          amount: 80.00,
          description: "Sushi lunch",
        }
      ]
    }),
  });
  const claim2 = await draft2Res.json();
  
  await fetch(`${baseUrl}/expense/claims/${claim2.id}/submit`, { method: "POST", headers });

  const rejectRes = await fetch(`${baseUrl}/expense/claims/${claim2.id}/reject`, {
    method: "PATCH",
    headers: managerHeaders,
    body: JSON.stringify({ comment: "Policy limit exceeded" }),
  });
  assert(rejectRes.status === 200, "Rejection successful");
  const rejectedClaim = await rejectRes.json();
  assert(rejectedClaim.status === ExpenseClaimStatus.REJECTED, "Status updated to REJECTED");

  // Verify rejected claim cannot be reimbursed
  const failReimburseRejectedRes = await fetch(`${baseUrl}/expense/claims/${claim2.id}/reimburse`, {
    method: "POST",
    headers: financeHeaders,
    body: JSON.stringify({
      bankAccountId: bankAcc.id,
      expectedVersion: rejectedClaim.version,
    }),
  });
  assert(failReimburseRejectedRes.status === 400, "Rejected claims cannot be reimbursed");

  // 7. Tenant Isolation
  console.log("Verifying Tenant Isolation...");
  
  // Register Tenant B
  let tenantB = await prisma.tenant.findUnique({ where: { slug: "tenant-b-expense" } });
  if (!tenantB) {
    tenantB = await prisma.tenant.create({
      data: {
        name: "Tenant B Expense",
        slug: "tenant-b-expense",
      },
    });
  }

  let userB = await prisma.user.findFirst({ where: { email: "userb.expense@amdox.com" } });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: "userb.expense@amdox.com",
        username: "userb.expense",
        passwordHash,
      },
    });

    const roleB = await prisma.role.create({
      data: {
        tenantId: tenantB.id,
        name: "Tenant B Role",
      },
    });

    const perm = await prisma.permission.findFirst({ where: { name: "expense:claim:read" } });
    if (perm) {
      await prisma.rolePermission.create({
        data: {
          roleId: roleB.id,
          permissionId: perm.id,
        },
      });
    }

    await prisma.userRole.create({
      data: {
        tenantId: tenantB.id,
        userId: userB.id,
        roleId: roleB.id,
      },
    });
  }

  const loginBRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "userb.expense@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginBRes.status === 200, "Tenant B login successful");
  const tokenB = (await loginBRes.json()).accessToken;

  // Try to read Tenant A claim as Tenant B
  const readClaimsBRes = await fetch(`${baseUrl}/expense/claims/${claim.id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(readClaimsBRes.status === 404, "Tenant B cannot find Tenant A's claims (404 Isolation)");

  // 8. CSV Export
  console.log("Verifying CSV Export...");
  const csvRes = await fetch(`${baseUrl}/expense/claims?export=csv`, { headers });
  assert(csvRes.status === 200, "CSV export succeeds");
  const csvContent = await csvRes.text();
  assert(csvContent.startsWith("Claim ID,Employee Code,Employee Name,Title,Claim Date,Total Amount,Status"), "CSV headers match");

  // 9. Dashboard Widgets
  console.log("Verifying Dashboard widgets...");
  const dashRes = await fetch(`${baseUrl}/expense/dashboard`, { headers });
  assert(dashRes.status === 200, "Dashboard fetch succeeds");
  const dash = await dashRes.json();
  assert(Number(dash.totalReimbursedAmount) === 300.50, "Total reimbursed amount aggregates correctly");
  assert(dash.reimbursedCount === 1, "Reimbursed count is 1");
  assert(dash.rejectedCount === 1, "Rejected count is 1");

  // 10. Audit Logging
  console.log("Verifying Audit logs...");
  const audits = await prisma.auditLog.findMany({
    where: { tenantId: tenantIdA },
  });
  const actions = audits.map((a) => a.action);
  assert(actions.includes("EXPENSE_CREATED"), "Audit logs contain EXPENSE_CREATED");
  assert(actions.includes("EXPENSE_SUBMITTED"), "Audit logs contain EXPENSE_SUBMITTED");
  assert(actions.includes("EXPENSE_MANAGER_APPROVED"), "Audit logs contain EXPENSE_MANAGER_APPROVED");
  assert(actions.includes("EXPENSE_FINANCE_APPROVED"), "Audit logs contain EXPENSE_FINANCE_APPROVED");
  assert(actions.includes("EXPENSE_REJECTED"), "Audit logs contain EXPENSE_REJECTED");
  assert(actions.includes("EXPENSE_REIMBURSED"), "Audit logs contain EXPENSE_REIMBURSED");

  // 11. Health Endpoint
  console.log("Verifying health check endpoint...");
  const healthRes = await fetch("http://localhost:3019/health");
  assert(healthRes.status === 200, "Health endpoint works");

  console.log("==================================================");
  console.log("ALL ENTERPRISE EXPENSE CLAIMS E2E TESTS PASSED!");
  console.log("==================================================");
  app.close();
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
