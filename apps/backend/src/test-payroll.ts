/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import * as argon2 from "argon2";
import {
  PrismaClient,
  EmployeeStatus,
  SalaryComponentType,
  CalculationType,
  PayrollPeriodStatus,
  PayslipStatus,
  LeaveRequestStatus,
  AttendanceStatus,
} from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Payroll integration E2E tests...");
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
  await app.listen(3017);

  const baseUrl = "http://localhost:3017/api";
  let adminToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables
  console.log("Cleaning up database tables...");
  await prisma.payslip.deleteMany({});
  await prisma.payrollPeriod.deleteMany({});
  await prisma.employeeSalaryAssignment.deleteMany({});
  await prisma.salaryStructureComponent.deleteMany({});
  await prisma.salaryStructure.deleteMany({});
  await prisma.salaryComponent.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.leaveBalance.deleteMany({});
  await prisma.leaveType.deleteMany({});
  await prisma.attendanceRecord.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.budgetRevisionItem.deleteMany({});
  await prisma.budgetRevision.deleteMany({});
  await prisma.budgetItem.deleteMany({});
  await prisma.budget.deleteMany({});
  await prisma.assetDepreciation.deleteMany({});
  await prisma.assetMaintenance.deleteMany({});
  await prisma.bankReconciliationLine.deleteMany({});
  await prisma.bankReconciliation.deleteMany({});
  await prisma.bankTransaction.deleteMany({});
  await prisma.bankAccount.deleteMany({});
  await prisma.assetCategory.deleteMany({});
  await prisma.userRole.deleteMany({ where: { user: { email: "userb.payroll@amdox.com" } } });
  await prisma.user.deleteMany({ where: { email: "userb.payroll@amdox.com" } });
  await prisma.rolePermission.deleteMany({ where: { role: { name: "Payroll Viewer Tenant B" } } });
  await prisma.role.deleteMany({ where: { name: "Payroll Viewer Tenant B" } });
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

  // Create active employee for testing
  const empA = await prisma.employee.create({
    data: {
      tenantId: tenantIdA,
      employeeCode: "EMP201",
      firstName: "Alice",
      lastName: "Smith",
      email: "alice.payroll@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date("2026-01-01T00:00:00Z"),
    },
  });

  // 2. Salary Component CRUD
  console.log("Verifying Salary Component CRUD...");
  // Create earning component (Flat)
  const compEarningRes = await fetch(`${baseUrl}/payroll/components`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "House Rent Allowance",
      code: "HRA",
      type: SalaryComponentType.EARNING,
      calculationType: CalculationType.FLAT,
      value: 1000.0,
    }),
  });
  assert(compEarningRes.status === 201, "Earning component HRA created");
  const compHra = await compEarningRes.json();

  // Create earning component (Percentage)
  const compBonusRes = await fetch(`${baseUrl}/payroll/components`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Performance Bonus",
      code: "BONUS",
      type: SalaryComponentType.EARNING,
      calculationType: CalculationType.PERCENTAGE,
      value: 10.0, // 10% of base
    }),
  });
  assert(compBonusRes.status === 201, "Percentage component BONUS created");
  const compBonus = await compBonusRes.json();

  // Create deduction component (Flat)
  const compPfRes = await fetch(`${baseUrl}/payroll/components`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Provident Fund",
      code: "PF",
      type: SalaryComponentType.DEDUCTION,
      calculationType: CalculationType.FLAT,
      value: 500.0,
    }),
  });
  assert(compPfRes.status === 201, "Deduction component PF created");
  const compPf = await compPfRes.json();

  // Validate negative flat value throws 400
  const compInvalidFlatRes = await fetch(`${baseUrl}/payroll/components`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Invalid Flat",
      code: "INV_FLAT",
      type: SalaryComponentType.DEDUCTION,
      calculationType: CalculationType.FLAT,
      value: -100.0,
    }),
  });
  assert(compInvalidFlatRes.status === 400, "Negative flat component blocked");

  // Validate percentage bounds > 100 throws 400
  const compInvalidPctRes = await fetch(`${baseUrl}/payroll/components`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Invalid Percentage",
      code: "INV_PCT",
      type: SalaryComponentType.DEDUCTION,
      calculationType: CalculationType.PERCENTAGE,
      value: 120.0,
    }),
  });
  assert(compInvalidPctRes.status === 400, "Out-of-bounds percentage component blocked");

  // 3. Salary Structure CRUD
  console.log("Verifying Salary Structure CRUD...");
  const structRes = await fetch(`${baseUrl}/payroll/structures`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Senior Software Engineer Grade A",
      code: "SSE_A",
      baseSalary: 5000.0,
      componentIds: [compHra.id, compBonus.id, compPf.id],
    }),
  });
  assert(structRes.status === 201, "Salary Structure created");
  const structure = await structRes.json();

  // Prevent duplicate structures with same code
  const structDupRes = await fetch(`${baseUrl}/payroll/structures`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Senior Software Engineer Grade A Duplicate",
      code: "SSE_A",
      baseSalary: 4500.0,
    }),
  });
  assert(structDupRes.status === 400, "Duplicate structure code blocked");

  // 4. Salary Assignment
  console.log("Verifying Salary Assignment...");
  const assignRes = await fetch(`${baseUrl}/payroll/assign`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      salaryStructureId: structure.id,
      startDate: "2026-07-01T00:00:00Z",
      endDate: "2026-07-31T00:00:00Z",
    }),
  });
  assert(assignRes.status === 201, "Salary assigned successfully");

  // Prevent overlapping assignments
  const assignOverlapRes = await fetch(`${baseUrl}/payroll/assign`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      salaryStructureId: structure.id,
      startDate: "2026-07-15T00:00:00Z",
      endDate: "2026-08-15T00:00:00Z",
    }),
  });
  assert(assignOverlapRes.status === 400, "Overlapping assignment dates blocked");

  // 5. Payroll Period Creation
  console.log("Verifying Payroll Period Creation...");
  const periodRes = await fetch(`${baseUrl}/payroll/periods`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "July 2026",
      startDate: "2026-07-01T00:00:00Z",
      endDate: "2026-07-31T00:00:00Z",
    }),
  });
  assert(periodRes.status === 201, "Payroll Period created successfully");
  const period = await periodRes.json();

  // Prevent multiple periods for same month
  const periodDupRes = await fetch(`${baseUrl}/payroll/periods`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "July 2026 Alternate",
      startDate: "2026-07-01T00:00:00Z",
      endDate: "2026-07-31T00:00:00Z",
    }),
  });
  assert(periodDupRes.status === 400, "Multiple periods in same month blocked");

  // 6. Set up Overtime & Leave Unpaid Days
  console.log("Setting up Overtime Attendance and Unpaid Leaves...");
  // 10 hours overtime for Alice
  await prisma.attendanceRecord.create({
    data: {
      tenantId: tenantIdA,
      employeeId: empA.id,
      date: new Date("2026-07-10T00:00:00Z"),
      overtimeHours: 10.0,
      status: AttendanceStatus.PRESENT,
    },
  });

  // Create unpaid leave type
  const unpaidType = await prisma.leaveType.create({
    data: {
      tenantId: tenantIdA,
      name: "Unpaid Sick Leave",
      code: "USL",
      isPaid: false,
      maxDaysPerYear: 30,
    },
  });

  // Create leave balance for Alice
  await prisma.leaveBalance.create({
    data: {
      tenantId: tenantIdA,
      employeeId: empA.id,
      leaveTypeId: unpaidType.id,
      allocated: 0,
      accrued: 0,
      used: 0,
    },
  });

  // Request 3 days unpaid leave (July 13 to July 15)
  await prisma.leaveRequest.create({
    data: {
      tenantId: tenantIdA,
      employeeId: empA.id,
      leaveTypeId: unpaidType.id,
      startDate: new Date("2026-07-13T00:00:00Z"),
      endDate: new Date("2026-07-15T00:00:00Z"),
      status: LeaveRequestStatus.APPROVED,
      reason: "Sick",
    },
  });

  // 7. Process Payroll Period
  console.log("Verifying Payroll Processing...");
  const processRes = await fetch(`${baseUrl}/payroll/periods/${period.id}/process`, {
    method: "POST",
    headers,
  });
  assert(processRes.status === 201, "Payroll process ran successfully");
  const payslips = await processRes.json();
  assert(payslips.length === 1, "One payslip generated for Alice");

  const alicePayslip = payslips[0];
  // SSE_A Structure:
  // baseSalary = 5000
  // HRA (Flat Earning) = 1000
  // BONUS (Pct Earning, 10%) = 500
  // Total Earnings = 1500
  // PF (Flat Deduction) = 500
  // Overtime Pay: (5000 / 240) * 1.5 * 10 = 20.8333 * 15 = 312.50
  // LWP Deduction: (5000 / 30) * 3 days = 166.6666 * 3 = 500.00
  // Net Pay: 5000 (Base) + 1500 (Earnings) + 312.50 (OT) - 500 (PF) - 500 (LWP) = 5812.50
  assert(Number(alicePayslip.baseSalary) === 5000.00, "Base salary correct");
  assert(Number(alicePayslip.earnings) === 1500.00, "Total earnings correct");
  assert(Number(alicePayslip.deductions) === 500.00, "Total deductions correct");
  assert(Number(alicePayslip.overtimePay) === 312.50, "Overtime pay correct");
  assert(Number(alicePayslip.lwpDeduction) === 500.00, "LWP deduction correct");
  assert(Number(alicePayslip.netPay) === 5812.50, "Net pay matches manual calculation");

  // 8. Payslips Export & PDF Generation
  console.log("Verifying Payslip Exports (CSV & PDF)...");
  // CSV Export
  const csvRes = await fetch(`${baseUrl}/payroll/payslips?export=csv`, { headers });
  assert(csvRes.status === 200, "Payslips CSV export succeeds");
  const csvText = await csvRes.text();
  assert(csvText.includes("Alice"), "CSV contains Alice's name");

  // PDF Export
  const pdfRes = await fetch(`${baseUrl}/payroll/payslips/${alicePayslip.id}/pdf`, { headers });
  assert(pdfRes.status === 200, "Payslip PDF export succeeds");
  assert(pdfRes.headers.get("Content-Type") === "application/pdf", "Content-Type is application/pdf");

  // 9. Lock Payroll & Accounting Postings
  console.log("Verifying Payroll Locking and General Ledger Posting...");
  const lockRes = await fetch(`${baseUrl}/payroll/periods/${period.id}/lock`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: period.version }),
  });
  assert(lockRes.status === 200 || lockRes.status === 201, "Lock payroll succeeds");
  const lockedPeriod = await lockRes.json();
  assert(lockedPeriod.status === PayrollPeriodStatus.LOCKED, "Period status updated to LOCKED");
  assert(!!lockedPeriod.journalEntryId, "Journal Entry ID is attached");

  // Verify posted Journal Entry in GL
  const je = await prisma.journalEntry.findUnique({
    where: { id: lockedPeriod.journalEntryId },
    include: { lines: true },
  });
  assert(!!je, "Journal entry created in database");
  assert(je!.status === "POSTED", "Journal entry status is POSTED");
  assert(je!.lines.length === 3, "Journal entry has three lines");

  // Verify debit equals credit
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of je!.lines) {
    totalDebit += Number(line.debit);
    totalCredit += Number(line.credit);
  }
  assert(totalDebit === totalCredit, "GL entry is fully balanced");
  // Total Gross Debit: Base (5000) + Earnings (1500) + OT (312.50) = 6812.50
  assert(totalDebit === 6812.50, "Gross debit amount correct");

  // Verify GL Account balances updated
  const expenseAcc = await prisma.account.findFirst({ where: { tenantId: tenantIdA, code: "500100" } });
  assert(Number(expenseAcc!.balance) === 6812.50, "Expense account balance increased by Debit amount");

  // 10. Dashboard Widgets
  console.log("Verifying Dashboard widgets...");
  const dashRes = await fetch(`${baseUrl}/payroll/dashboard`, { headers });
  assert(dashRes.status === 200 || dashRes.status === 201, "Dashboard summary request succeeds");
  const dashData = await dashRes.json();
  assert(dashData.totalPayrollCost === 6812.50, "Total cost matches latest locked period");
  assert(dashData.totalNetDisbursed === 5812.50, "Total net disbursed matches Alice's net pay");

  // 11. Optimistic Concurrency
  console.log("Verifying Optimistic Concurrency...");
  // Attempt lock with outdated expectedVersion
  const lockStaleRes = await fetch(`${baseUrl}/payroll/periods/${period.id}/lock`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }), // Stale version
  });
  assert(lockStaleRes.status === 409 || lockStaleRes.status === 400, "Stale concurrency request blocked");

  // 12. Tenant Isolation
  console.log("Verifying Tenant Isolation...");
  let tenantB = await prisma.tenant.findUnique({ where: { slug: "tenant-b-payroll" } });
  if (!tenantB) {
    tenantB = await prisma.tenant.create({
      data: {
        name: "Tenant B Payroll",
        slug: "tenant-b-payroll",
      },
    });
  }

  let userB = await prisma.user.findFirst({ where: { email: "userb.payroll@amdox.com" } });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: "userb.payroll@amdox.com",
        username: "userb.payroll",
        passwordHash: await argon2.hash("Password_1234_Special!"),
      },
    });

    const roleB = await prisma.role.create({
      data: {
        tenantId: tenantB.id,
        name: "Payroll Viewer Tenant B",
      },
    });

    const perm = await prisma.permission.findFirst({ where: { name: "payroll:process:read" } });
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

  // Login Tenant B
  const loginBRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "userb.payroll",
      password: "Password_1234_Special!",
    }),
  });
  const loginBData = (await loginBRes.json()) as { accessToken: string };
  const headersB = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginBData.accessToken}`,
  };

  // Tenant B attempts to read Tenant A's payslips
  const payslipsBRes = await fetch(`${baseUrl}/payroll/payslips?employeeId=${empA.id}`, { headers: headersB });
  assert(payslipsBRes.status === 200, "Request succeeds");
  const payslipsB = await payslipsBRes.json();
  assert(payslipsB.length === 0, "Tenant B receives empty results due to isolation");

  // 13. Health Endpoint
  console.log("Verifying Health Endpoint...");
  const healthRes = await fetch(`http://localhost:3017/health`);
  assert(healthRes.status === 200, "Health check responds with 200 OK");

  // Clean up
  await app.close();
  console.log("==============================================");
  console.log("ALL ENTERPRISE PAYROLL MANAGEMENT TESTS PASSED!");
  console.log("==============================================");
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
