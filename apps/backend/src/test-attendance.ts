/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, AttendanceStatus, CorrectionStatus, EmployeeStatus } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Attendance integration E2E tests...");
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
  await app.listen(3015);

  const baseUrl = "http://localhost:3015/api";
  let adminToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables
  console.log("Cleaning up database tables...");
  await prisma.attendanceCorrection.deleteMany({});
  await prisma.attendanceRecord.deleteMany({});
  await prisma.holiday.deleteMany({});
  await prisma.shiftAssignment.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.attendancePolicy.deleteMany({});
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
  console.log(`Tenant A ID: ${tenantIdA}`);

  // Create Active Employees for testing
  const empA = await prisma.employee.create({
    data: {
      tenantId: tenantIdA,
      employeeCode: "EMP001",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date("2026-01-01T00:00:00Z"),
    },
  });

  const empB = await prisma.employee.create({
    data: {
      tenantId: tenantIdA,
      employeeCode: "EMP002",
      firstName: "Bob",
      lastName: "Builder",
      email: "bob@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date("2026-01-01T00:00:00Z"),
    },
  });

  // 2. Attendance Policy CRUD
  console.log("Verifying Attendance Policy CRUD...");
  const createPolicyRes = await fetch(`${baseUrl}/attendance/policies`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Standard Policy",
      gracePeriodMinutes: 10,
      halfDayHours: 4.00,
      fullDayHours: 8.00,
      isDefault: true,
    }),
  });
  assert(createPolicyRes.status === 200 || createPolicyRes.status === 201, "Standard policy creation should succeed");
  const policy = await createPolicyRes.json();

  // Validate policy validations
  const badPolicyRes = await fetch(`${baseUrl}/attendance/policies`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Broken Policy",
      halfDayHours: 5.0,
      fullDayHours: 4.0, // Invalid: fullDayHours <= halfDayHours
    }),
  });
  assert(badPolicyRes.status === 400, "Invalid policy hours config must be blocked");

  // 3. Shift & Shift Assignments
  console.log("Verifying Shift & Shift Assignments...");
  const shiftDayRes = await fetch(`${baseUrl}/attendance/shifts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Day Shift",
      code: "SHIFT_DAY",
      startTime: "09:00",
      endTime: "18:00",
    }),
  });
  assert(shiftDayRes.status === 200 || shiftDayRes.status === 201, "Day shift creation should succeed");
  const shiftDay = await shiftDayRes.json();

  const shiftNightRes = await fetch(`${baseUrl}/attendance/shifts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Night Shift",
      code: "SHIFT_NIGHT",
      startTime: "22:00",
      endTime: "06:00",
    }),
  });
  const shiftNight = await shiftNightRes.json();

  // Assign shift
  const assignRes = await fetch(`${baseUrl}/attendance/shifts/assign`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      shiftId: shiftDay.id,
      startDate: "2026-07-01T00:00:00Z",
    }),
  });
  assert(assignRes.status === 200 || assignRes.status === 201, "Shift assignment should succeed");

  // Overlap prevention check
  const dupAssignRes = await fetch(`${baseUrl}/attendance/shifts/assign`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      shiftId: shiftNight.id,
      startDate: "2026-07-02T00:00:00Z",
    }),
  });
  assert(dupAssignRes.status === 400, "Overlapping shift assignment must fail");

  // 4. Employee Check-In & Check-Out
  console.log("Verifying Employee Check-In & Check-Out...");
  // Check-in on standard day shift (July 3, 2026 at 09:05:00 - late logic check)
  const checkInRes = await fetch(`${baseUrl}/attendance/check-in`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      timestamp: "2026-07-03T09:05:00Z",
    }),
  });
  assert(checkInRes.status === 200 || checkInRes.status === 201, "Check-in should succeed");
  const recordA = await checkInRes.json();
  assert(recordA.isLate === false, "Late is false because grace period is 10 mins (09:05 <= 09:10)");

  // Duplicate Check-In check
  const dupCheckInRes = await fetch(`${baseUrl}/attendance/check-in`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      timestamp: "2026-07-03T09:08:00Z",
    }),
  });
  assert(dupCheckInRes.status === 400, "Duplicate check-in must fail");

  // Checkout (July 3, 2026 at 17:50:00 - early out logic check)
  const checkOutRes = await fetch(`${baseUrl}/attendance/check-out`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empA.id,
      timestamp: "2026-07-03T17:50:00Z",
    }),
  });
  assert(checkOutRes.status === 200 || checkOutRes.status === 201, "Check-out should succeed");
  const recordAOut = await checkOutRes.json();
  assert(recordAOut.isEarlyOut === true, "Early out is true (17:50 < 18:00)");
  assert(Number(recordAOut.workingHours) === 8.75, "Working hours correctly computed (17:50 - 09:05 = 8 hours 45 mins = 8.75)");
  assert(Number(recordAOut.overtimeHours) === 0, "No overtime since workingHours <= 9.0 (shiftDay duration)");

  // 5. Overnight Shift calculations
  console.log("Verifying Overnight Shift calculations...");
  const assignNightRes = await fetch(`${baseUrl}/attendance/shifts/assign`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empB.id,
      shiftId: shiftNight.id,
      startDate: "2026-07-01T00:00:00Z",
    }),
  });
  assert(assignNightRes.status === 200 || assignNightRes.status === 201, "Assign night shift to Bob");

  // Bob check-in at 22:15 on July 3 (grace is 10 mins -> late is true)
  const BobInRes = await fetch(`${baseUrl}/attendance/check-in`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empB.id,
      timestamp: "2026-07-03T22:15:00Z",
    }),
  });
  const BobRecordIn = await BobInRes.json();
  assert(BobRecordIn.isLate === true, "Bob is late (22:15 > 22:10)");

  // Bob checkout at 06:15 on July 4 (Overtime is true)
  const BobOutRes = await fetch(`${baseUrl}/attendance/check-out`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empB.id,
      timestamp: "2026-07-04T06:15:00Z",
    }),
  });
  const BobRecordOut = await BobOutRes.json();
  assert(BobRecordOut.isEarlyOut === false, "Bob did not checkout early");
  assert(Number(BobRecordOut.workingHours) === 8.0, "Working hours correctly computed (8.0)");
  assert(Number(BobRecordOut.overtimeHours) === 0.0, "No overtime since workingHours <= 8.0 (shiftNight duration)");

  // 6. Holiday Attendance
  console.log("Verifying Holiday Attendance...");
  // Create a holiday on July 3
  const hol = await prisma.holiday.create({
    data: {
      tenantId: tenantIdA,
      name: "Independence Day",
      date: new Date("2026-07-03T00:00:00Z"),
    },
  });

  // Create an employee who didn't work on July 3 and check status gets marked as HOLIDAY
  const empC = await prisma.employee.create({
    data: {
      tenantId: tenantIdA,
      employeeCode: "EMP003",
      firstName: "Charlie",
      lastName: "Brown",
      email: "charlie@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date("2026-01-01T00:00:00Z"),
    },
  });

  await prisma.shiftAssignment.create({
    data: {
      tenantId: tenantIdA,
      employeeId: empC.id,
      shiftId: shiftDay.id,
      startDate: new Date("2026-07-01T00:00:00Z"),
    },
  });

  // Since Charlie has no attendance record, checkout with dummy parameters to trigger absent processing or check records list.
  // Wait, if an employee didn't check in, we can perform a dummy checkin and checkout on the holiday date, or let's verify holiday is checked on checkout.
  // In checkOut: if Charlie checks out after some work on a holiday, status is HALF_DAY / PRESENT. If he checks out with 0 hours, status falls back to HOLIDAY.
  // Let's check checkOut status fallback:
  // policy full day is 8.0, half day is 4.0. If Charlie checks in and checks out in 1 hour:
  const charlieInRes = await fetch(`${baseUrl}/attendance/check-in`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empC.id,
      timestamp: "2026-07-03T09:00:00Z",
    }),
  });
  const charlieOutRes = await fetch(`${baseUrl}/attendance/check-out`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empC.id,
      timestamp: "2026-07-03T10:00:00Z", // 1 hour
    }),
  });
  const charlieRecord = await charlieOutRes.json();
  assert(charlieRecord.status === AttendanceStatus.HOLIDAY, "Charlie status falls back to HOLIDAY since workingHours < 4.0");

  // 7. Attendance Corrections
  console.log("Verifying Attendance Corrections...");
  const corrRes = await fetch(`${baseUrl}/attendance/records/${recordAOut.id}/corrections`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      requestedCheckIn: "2026-07-03T09:00:00Z",
      requestedCheckOut: "2026-07-03T18:00:00Z",
      reason: "Forgot to check-in on time",
    }),
  });
  assert(corrRes.status === 200 || corrRes.status === 201, "Correction request should succeed");
  const corr = await corrRes.json();
  assert(corr.status === CorrectionStatus.PENDING, "Status is PENDING");

  // Approve correction
  const approveRes = await fetch(`${baseUrl}/attendance/corrections/${corr.id}/approve`, {
    method: "PATCH",
    headers,
  });
  assert(approveRes.status === 200 || approveRes.status === 201, "Approve correction should succeed");
  const approvedData = await approveRes.json();
  assert(approvedData.correction.status === CorrectionStatus.APPROVED, "Correction marked APPROVED");
  assert(Number(approvedData.record.workingHours) === 9.00, "Working hours recalculated to 9.00");
  assert(approvedData.record.isLate === false, "Late arrival is false (09:00 <= 09:10)");
  assert(approvedData.record.isEarlyOut === false, "Early checkout is false (18:00 >= 18:00)");

  // 8. Dashboard Widgets
  console.log("Verifying Dashboard Widgets...");
  const widgetRes = await fetch(`${baseUrl}/attendance/dashboard`, { headers });
  assert(widgetRes.status === 200, "Dashboard fetch succeeds");
  const widgets = await widgetRes.json();
  assert(widgets.presentToday > 0, "Dashboard records present counts");

  // 9. CSV Export
  console.log("Verifying CSV export...");
  const csvRes = await fetch(`${baseUrl}/attendance/records?export=csv`, { headers });
  assert(csvRes.status === 200, "CSV export succeeds");
  const csvText = await csvRes.text();
  assert(csvText.includes("Record ID,Employee Code,Employee Name,Date,Check-In,Check-Out,Working Hours,Overtime Hours,Late Arrival,Early Departure,Status"), "CSV columns match");

  // 10. Tenant Isolation
  console.log("Verifying Tenant Isolation...");
  const tenantIdB = "55555555-5555-5555-5555-555555555555";
  await prisma.tenant.upsert({
    where: { id: tenantIdB },
    update: {},
    create: { id: tenantIdB, name: "Tenant B Corp", slug: "tenant-b-attendance" },
  });

  const passwordHash = await argon2.hash("Password_1234_Special!");
  const userB = await prisma.user.upsert({
    where: { email: "userb_att@amdox.com" },
    update: { tenantId: tenantIdB, passwordHash },
    create: { email: "userb_att@amdox.com", username: "userb_att_admin", passwordHash, tenantId: tenantIdB },
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
      username: "userb_att@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  const loginBData = await loginBRes.json();
  const headersB = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginBData.accessToken}`,
  };

  const recordsBRes = await fetch(`${baseUrl}/attendance/records`, { headers: headersB });
  const recordsB = await recordsBRes.json();
  assert(recordsB.length === 0, "Tenant B should see zero records from Tenant A");

  const badGetRecord = await fetch(`${baseUrl}/attendance/records?employeeId=${empA.id}`, { headers: headersB });
  const badRecords = await badGetRecord.json();
  assert(badRecords.length === 0, "Tenant B cannot fetch Tenant A's records");

  // 11. Health endpoint check
  console.log("Verifying health endpoint...");
  const healthRes = await fetch("http://localhost:3015/health");
  assert(healthRes.status === 200, "Health check must be online");

  console.log("==============================================");
  console.log("ALL ATTENDANCE TESTS PASSED!");
  console.log("==============================================");

  await app.close();
  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test execution failed with error:", e);
  process.exit(1);
});
