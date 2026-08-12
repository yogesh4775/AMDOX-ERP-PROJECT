/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, LeaveRequestStatus, LeaveApprovalStatus, EmployeeStatus, AttendanceStatus } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Leave integration E2E tests...");
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
  await app.listen(3016);

  const baseUrl = "http://localhost:3016/api";
  let adminToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables
  console.log("Cleaning up database tables...");
  await prisma.leaveApproval.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.leaveBalance.deleteMany({});
  await prisma.leavePolicy.deleteMany({});
  await prisma.leaveAccrualHistory.deleteMany({});
  await prisma.leaveCarryForwardHistory.deleteMany({});
  await prisma.leaveType.deleteMany({});
  await prisma.attendanceCorrection.deleteMany({});
  await prisma.attendanceRecord.deleteMany({});
  await prisma.employeeDocument.deleteMany({});
  await prisma.employee.deleteMany({});

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

  // Create active employees for testing
  const empA = await prisma.employee.create({
    data: {
      tenantId: tenantIdA,
      employeeCode: "EMP101",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe.leave@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date("2026-01-01T00:00:00Z"),
    },
  });

  const empB = await prisma.employee.create({
    data: {
      tenantId: tenantIdA,
      employeeCode: "EMP102",
      firstName: "Bob",
      lastName: "Builder",
      email: "bob.leave@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date("2026-01-01T00:00:00Z"),
    },
  });

  // 2. Leave Type CRUD & Allocation
  console.log("Verifying Leave Type & Allocations...");
  const createTypeARes = await fetch(`${baseUrl}/leave/types`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Annual Leave",
      code: "AL",
      isPaid: true,
      maxDaysPerYear: 15,
      accrualRateMonthly: 1.25,
      maxCarryForward: 5,
      isSandwichRuleEnabled: true,
    }),
  });
  assert(createTypeARes.status === 200 || createTypeARes.status === 201, "AL leave type creation succeeds");
  const typeA = (await createTypeARes.json()).leaveType;

  const createTypeBRes = await fetch(`${baseUrl}/leave/types`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sick Leave",
      code: "SL",
      isPaid: true,
      maxDaysPerYear: 10,
      accrualRateMonthly: 0.0,
      maxCarryForward: 0,
      isSandwichRuleEnabled: false,
    }),
  });
  const typeB = (await createTypeBRes.json()).leaveType;

  // Allocate balance to empA
  const allocRes = await fetch(`${baseUrl}/leave/balances/allocate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      leaveTypeId: typeA.id,
      allocatedDays: 10,
    }),
  });
  assert(allocRes.status === 200 || allocRes.status === 201, "Allocating 10 days of AL succeeds");

  const allocBRes = await fetch(`${baseUrl}/leave/balances/allocate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      leaveTypeId: typeB.id,
      allocatedDays: 5,
    }),
  });

  // 3. Leave Requests overlaps and balance check
  console.log("Verifying Leave Request validation...");
  // Request 12 days (exceeds balance of 10)
  const reqBadRes = await fetch(`${baseUrl}/leave/requests`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      leaveTypeId: typeA.id,
      startDate: "2026-07-01T00:00:00Z",
      endDate: "2026-07-12T00:00:00Z",
      reason: "Holiday trip",
    }),
  });
  assert(reqBadRes.status === 400, "Insufficient balance leave request must fail");

  // Request 3 days (within balance of 10)
  const reqGoodRes = await fetch(`${baseUrl}/leave/requests`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      leaveTypeId: typeA.id,
      startDate: "2026-07-06T00:00:00Z", // Monday
      endDate: "2026-07-08T00:00:00Z",   // Wednesday
      reason: "Rest",
    }),
  });
  assert(reqGoodRes.status === 200 || reqGoodRes.status === 201, "Valid leave request should succeed");
  const leaveReq = await reqGoodRes.json();
  assert(leaveReq.status === LeaveRequestStatus.PENDING, "Leave request is PENDING");

  // Overlapping request check
  const reqOverlapRes = await fetch(`${baseUrl}/leave/requests`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      leaveTypeId: typeA.id,
      startDate: "2026-07-07T00:00:00Z",
      endDate: "2026-07-09T00:00:00Z",
      reason: "Overlap",
    }),
  });
  assert(reqOverlapRes.status === 400, "Overlapping leave request must be blocked");

  // 4. Multi Level Approval & Attendance Integration
  console.log("Verifying Multi Level Approval...");
  const approveRes = await fetch(`${baseUrl}/leave/requests/${leaveReq.id}/approve`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      status: LeaveApprovalStatus.APPROVED,
      comment: "Approved by manager",
    }),
  });
  assert(approveRes.status === 200 || approveRes.status === 201, "Stage 2 approval should succeed");
  const approvedReq = await approveRes.json();
  assert(approvedReq.status === LeaveRequestStatus.APPROVED, "Request marked APPROVED");

  // Verify leave balance used updated
  const balanceCheck = await prisma.leaveBalance.findUnique({
    where: {
      tenantId_employeeId_leaveTypeId: {
        tenantId: tenantIdA,
        employeeId: empA.id,
        leaveTypeId: typeA.id,
      },
    },
  });
  assert(Number(balanceCheck!.used) === 3.00, "AL used balance is 3.0");

  // Verify attendance records automatically created for July 6, July 7, and July 8
  const attCheck = await prisma.attendanceRecord.findMany({
    where: {
      tenantId: tenantIdA,
      employeeId: empA.id,
      date: {
        in: [new Date("2026-07-06T00:00:00Z"), new Date("2026-07-07T00:00:00Z"), new Date("2026-07-08T00:00:00Z")],
      },
    },
  });
  assert(attCheck.length === 3, "3 Attendance records created");
  assert(attCheck.every((r) => r.status === AttendanceStatus.LEAVE), "All records marked as LEAVE");

  // 5. Sandwich Rule vs Business Days Rules
  console.log("Verifying Sandwich Rule...");
  // Request AL (Sandwich true) from July 17 (Friday) to July 20 (Monday) -> Deduct 4 days (includes Sat/Sun)
  const reqSandwichRes = await fetch(`${baseUrl}/leave/requests`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      leaveTypeId: typeA.id,
      startDate: "2026-07-17T00:00:00Z",
      endDate: "2026-07-20T00:00:00Z",
      reason: "Weekend Sandwich check",
    }),
  });
  const reqSandwich = await reqSandwichRes.json();
  const approveSandwich = await fetch(`${baseUrl}/leave/requests/${reqSandwich.id}/approve`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: LeaveApprovalStatus.APPROVED }),
  });
  const approvedSandwich = await approveSandwich.json();

  const balanceCheckSandwich = await prisma.leaveBalance.findUnique({
    where: {
      tenantId_employeeId_leaveTypeId: {
        tenantId: tenantIdA,
        employeeId: empA.id,
        leaveTypeId: typeA.id,
      },
    },
  });
  assert(Number(balanceCheckSandwich!.used) === 7.00, "AL used balance is 7.0 (3 original + 4 sandwich)");

  // Request SL (Sandwich false) from July 10 (Friday) to July 13 (Monday) -> Deduct 2 business days
  const reqSLRes = await fetch(`${baseUrl}/leave/requests`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      leaveTypeId: typeB.id,
      startDate: "2026-07-10T00:00:00Z",
      endDate: "2026-07-13T00:00:00Z",
      reason: "Sick rest",
    }),
  });
  const reqSL = await reqSLRes.json();
  const approveSL = await fetch(`${baseUrl}/leave/requests/${reqSL.id}/approve`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: LeaveApprovalStatus.APPROVED }),
  });

  const balanceCheckSL = await prisma.leaveBalance.findUnique({
    where: {
      tenantId_employeeId_leaveTypeId: {
        tenantId: tenantIdA,
        employeeId: empA.id,
        leaveTypeId: typeB.id,
      },
    },
  });
  assert(Number(balanceCheckSL!.used) === 2.00, "SL used balance is 2.0 (Saturday and Sunday excluded)");

  // 7. Comp-Off automatic generation
  console.log("Verifying Comp-Off generation...");
  // Create attendance record with 16 overtime hours for empA
  await prisma.attendanceRecord.create({
    data: {
      tenantId: tenantIdA,
      employeeId: empA.id,
      date: new Date("2026-07-15T00:00:00Z"),
      overtimeHours: 16.0,
      status: AttendanceStatus.PRESENT,
    },
  });

  const compOffRes = await fetch(`${baseUrl}/leave/compoff`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
    }),
  });
  assert(compOffRes.status === 200 || compOffRes.status === 201, "Comp-off allocation succeeds");
  const compOff = await compOffRes.json();
  assert(compOff.earnedDays === 2, "Bob earned 2 days of Comp-Off (16 / 8)");

  // 8. Rejection & Leave Cancellation
  console.log("Verifying Rejection & Cancellation...");
  // Cancel approved leaveReq (AL leave request of 3 days)
  const cancelRes = await fetch(`${baseUrl}/leave/requests/${leaveReq.id}/cancel`, {
    method: "POST",
    headers,
  });
  assert(cancelRes.status === 200 || cancelRes.status === 201, "Leave cancellation succeeds");

  // Check balance reverted
  const balanceReverted = await prisma.leaveBalance.findUnique({
    where: {
      tenantId_employeeId_leaveTypeId: {
        tenantId: tenantIdA,
        employeeId: empA.id,
        leaveTypeId: typeA.id,
      },
    },
  });
  // Used balance was 7.0, should now be 7.0 - 3.0 = 4.0
  assert(Number(balanceReverted!.used) === 4.00, "AL used balance is reverted back to 4.0");

  // Check attendance records deleted
  const attReverted = await prisma.attendanceRecord.findMany({
    where: {
      tenantId: tenantIdA,
      employeeId: empA.id,
      date: {
        in: [new Date("2026-07-06T00:00:00Z"), new Date("2026-07-07T00:00:00Z"), new Date("2026-07-08T00:00:00Z")],
      },
    },
  });
  assert(attReverted.length === 0, "Leaves attendance records deleted successfully");

  // 6. Leave Accrual & Carry Forward
  console.log("Verifying Leave Accrual & Carry Forwards...");
  // Monthly accrual
  const accrualRes = await fetch(`${baseUrl}/leave/accruals`, { method: "POST", headers });
  assert(accrualRes.status === 200 || accrualRes.status === 201, "Monthly accrual run succeeds");
  const accruals = await accrualRes.json();
  assert(accruals.length > 0, "Accruals generated");

  // Carry forward
  const cfRes = await fetch(`${baseUrl}/leave/carry-forward`, { method: "POST", headers });
  assert(cfRes.status === 200 || cfRes.status === 201, "Carry forward run succeeds");
  const carryForwards = await cfRes.json();
  assert(carryForwards.length > 0, "Carry forwards run successfully");

  // 9. Dashboard Widgets
  console.log("Verifying Dashboard Widgets...");
  const widgetRes = await fetch(`${baseUrl}/leave/dashboard`, { headers });
  assert(widgetRes.status === 200, "Dashboard fetch succeeds");
  const widgets = await widgetRes.json();
  assert(widgets.companyLeaveLiabilityDays >= 0, "Dashboard returns leave liability");

  // 10. CSV Export
  console.log("Verifying CSV export...");
  const csvRes = await fetch(`${baseUrl}/leave/requests?export=csv`, { headers });
  assert(csvRes.status === 200, "CSV export succeeds");
  const csvText = await csvRes.text();
  assert(csvText.includes("Leave ID,Employee Code,Employee Name,Leave Type,Start Date,End Date,Half Day,Reason,Status"), "CSV columns match");

  // 11. Tenant Isolation
  console.log("Verifying Tenant Isolation...");
  const tenantIdB = "66666666-6666-6666-6666-666666666666";
  await prisma.tenant.upsert({
    where: { id: tenantIdB },
    update: {},
    create: { id: tenantIdB, name: "Tenant B Leave Corp", slug: "tenant-b-leave" },
  });

  const passwordHash = await argon2.hash("Password_1234_Special!");
  const userB = await prisma.user.upsert({
    where: { email: "userb_leave@amdox.com" },
    update: { tenantId: tenantIdB, passwordHash },
    create: { email: "userb_leave@amdox.com", username: "userb_leave_admin", passwordHash, tenantId: tenantIdB },
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
      username: "userb_leave@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  const loginBData = await loginBRes.json();
  const headersB = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginBData.accessToken}`,
  };

  const leavesBRes = await fetch(`${baseUrl}/leave/requests`, { headers: headersB });
  const leavesB = await leavesBRes.json();
  assert(leavesB.length === 0, "Tenant B should see zero leave requests from Tenant A");

  // 12. Health endpoint check
  console.log("Verifying health endpoint...");
  const healthRes = await fetch("http://localhost:3016/health");
  assert(healthRes.status === 200, "Health check must be online");

  console.log("==============================================");
  console.log("ALL LEAVE MANAGEMENT TESTS PASSED!");
  console.log("==============================================");

  await app.close();
  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test execution failed with error:", e);
  process.exit(1);
});
