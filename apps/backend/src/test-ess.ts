/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import * as argon2 from "argon2";
import {
  PrismaClient,
  EmployeeStatus,
  GoalStatus,
  AppraisalCycleStatus,
  PerformanceReviewStatus,
  AttendanceStatus,
  LeaveRequestStatus,
  ExpenseClaimStatus,
} from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as path from "path";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for ESS E2E integration tests...");
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
  await app.listen(3022);

  const baseUrl = "http://localhost:3022/api";
  let adminToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean database tables
  console.log("Cleaning database tables...");
  await prisma.companyAnnouncement.deleteMany({});
  await prisma.performanceReview.deleteMany({});
  await prisma.performanceGoal.deleteMany({});
  await prisma.appraisalCycle.deleteMany({});
  await prisma.payslip.deleteMany({});
  await prisma.payrollPeriod.deleteMany({});
  await prisma.expenseClaimApproval.deleteMany({});
  await prisma.expenseClaimItem.deleteMany({});
  await prisma.expenseClaim.deleteMany({});
  await prisma.leaveApproval.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.leaveBalance.deleteMany({});
  await prisma.leaveType.deleteMany({});
  await prisma.attendanceRecord.deleteMany({});
  await prisma.shiftAssignment.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.holiday.deleteMany({});
  await prisma.employeeDocument.deleteMany({});
  await prisma.employee.deleteMany({});

  // Clean test roles/users
  await prisma.userRole.deleteMany({
    where: {
      user: {
        email: { in: ["emp.ess@amdox.com", "usera.ess@amdox.com", "userb.ess@amdox.com"] }
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      email: { in: ["emp.ess@amdox.com", "usera.ess@amdox.com", "userb.ess@amdox.com"] }
    }
  });
  await prisma.rolePermission.deleteMany({
    where: {
      role: {
        name: { in: ["ESS Employee Role", "ESS Tenant B Role"] }
      }
    }
  });
  await prisma.role.deleteMany({
    where: {
      name: { in: ["ESS Employee Role", "ESS Tenant B Role"] }
    }
  });

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
  const adminHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  // Seed employee and matching user
  console.log("Seeding ESS employee user...");
  const passwordHash = await argon2.hash("Password_1234_Special!");
  
  const empUser = await prisma.user.create({
    data: {
      tenantId: tenantIdA,
      email: "emp.ess@amdox.com",
      username: "emp_ess",
      passwordHash,
    },
  });

  const empRole = await prisma.role.create({
    data: {
      tenantId: tenantIdA,
      name: "ESS Employee Role",
    },
  });

  // Assign ESS portal and standard employee permissions
  const essPermissions = await prisma.permission.findMany({
    where: {
      name: {
        in: [
          "ess:portal:read",
          "ess:portal:write",
          "media:create",
          "media:read",
          "attendance:record:write",
          "leave:request:write",
          "expense:claim:write",
          "pms:review:submit"
        ]
      }
    }
  });

  for (const perm of essPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: empRole.id,
        permissionId: perm.id,
      },
    });
  }

  await prisma.userRole.create({
    data: {
      userId: empUser.id,
      roleId: empRole.id,
      tenantId: tenantIdA,
    },
  });

  // Match employee record under Tenant A
  const employee = await prisma.employee.create({
    data: {
      tenantId: tenantIdA,
      employeeCode: "EMP-ESS-001",
      firstName: "John",
      lastName: "Doe",
      email: "emp.ess@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date("2025-01-01"),
    },
  });

  // Authenticate ESS Employee
  console.log("Authenticating ESS Employee...");
  const loginEmpRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "emp.ess@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginEmpRes.status === 200, "Employee login successful");
  const empToken = (await loginEmpRes.json()).accessToken;
  const empHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${empToken}`,
  };

  // --- E2E SCENARIOS ---

  // 1. Employee Profile Update
  console.log("Verifying Employee Profile update & validations...");
  const profileRes = await fetch(`${baseUrl}/ess/profile`, { headers: empHeaders });
  assert(profileRes.status === 200, "Profile retrieval succeeds");
  const profile = await profileRes.json();
  assert(profile.email === "emp.ess@amdox.com", "Profile email matches");

  // Update phone with invalid format (fails 400)
  const failPhoneRes = await fetch(`${baseUrl}/ess/profile`, {
    method: "PATCH",
    headers: empHeaders,
    body: JSON.stringify({
      phone: "invalid-phone-format",
      expectedVersion: profile.version,
    }),
  });
  assert(failPhoneRes.status === 400, "Invalid phone format blocked");

  // Update phone & emergency contacts with correct E.164 format (succeeds 200)
  const successProfileRes = await fetch(`${baseUrl}/ess/profile`, {
    method: "PATCH",
    headers: empHeaders,
    body: JSON.stringify({
      phone: "+1234567890",
      emergencyContactName: "Jane Doe",
      emergencyContactPhone: "+9876543210",
      expectedVersion: profile.version,
    }),
  });
  assert(successProfileRes.status === 200, "Profile updated successfully");
  const updatedProfile = await successProfileRes.json();
  assert(updatedProfile.phone === "+1234567890", "Phone successfully updated");
  assert(updatedProfile.emergencyContactName === "Jane Doe", "Emergency contact name updated");

  // Concurrency check (stale expectedVersion fails 409)
  const staleProfileRes = await fetch(`${baseUrl}/ess/profile`, {
    method: "PATCH",
    headers: empHeaders,
    body: JSON.stringify({
      phone: "+1111111111",
      expectedVersion: 1, // Stale version
    }),
  });
  assert(staleProfileRes.status === 409, "Optimistic locking blocks stale updates");

  // 2. Profile Photo Upload
  console.log("Verifying Profile Photo upload...");
  // Create mock file upload
  const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  const bodyContent = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="photo.jpg"',
    "Content-Type: image/jpeg",
    "",
    "fake-image-binary-data",
    `--${boundary}--`,
    ""
  ].join("\r\n");

  const uploadPhotoRes = await fetch(`${baseUrl}/ess/profile/photo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${empToken}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: bodyContent,
  });
  assert(uploadPhotoRes.status === 201, "Photo upload succeeds");
  const photoResData = await uploadPhotoRes.json();
  assert(photoResData.profilePhoto.startsWith("/api/media/"), "Profile photo URL constructed correctly");

  // 3. Attendance Proxy
  console.log("Verifying Attendance check-in/out proxy...");
  // Seed Shift and Assignment
  const shift = await prisma.shift.create({
    data: {
      tenantId: tenantIdA,
      name: "Day Shift",
      code: "DAY_SHIFT",
      startTime: "09:00",
      endTime: "17:00",
    },
  });

  await prisma.shiftAssignment.create({
    data: {
      tenantId: tenantIdA,
      employeeId: employee.id,
      shiftId: shift.id,
      startDate: new Date("2026-01-01T00:00:00Z"),
    },
  });

  const checkInRes = await fetch(`${baseUrl}/ess/attendance/check-in`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      timestamp: "2026-07-03T09:05:00Z",
    }),
  });
  assert(checkInRes.status === 201, "Attendance Check-In succeeds");
  const checkInRecord = await checkInRes.json();
  assert(checkInRecord.status === AttendanceStatus.PRESENT, "Status is PRESENT");

  const checkOutRes = await fetch(`${baseUrl}/ess/attendance/check-out`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      timestamp: "2026-07-03T17:05:00Z",
    }),
  });
  assert(checkOutRes.status === 201, "Attendance Check-Out succeeds");

  const attHistoryRes = await fetch(`${baseUrl}/ess/attendance`, { headers: empHeaders });
  assert(attHistoryRes.status === 200, "Attendance history fetched");
  const attHistory = await attHistoryRes.json();
  assert(attHistory.length === 1, "One attendance record returned");

  // 4. Leave Proxy
  console.log("Verifying Leave proxy & balances...");
  // Seed leave type and balance
  const leaveType = await prisma.leaveType.create({
    data: {
      tenantId: tenantIdA,
      name: "Annual Leave",
      code: "AL",
      maxDaysPerYear: 15,
    },
  });

  await prisma.leaveBalance.create({
    data: {
      tenantId: tenantIdA,
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      allocated: 15,
    },
  });

  const balancesRes = await fetch(`${baseUrl}/ess/leave/balances`, { headers: empHeaders });
  assert(balancesRes.status === 200, "Balances fetched successfully");
  const balances = await balancesRes.json();
  assert(balances[0].allocated === "15", "Allocated days matches 15");

  // Apply Leave
  const applyLeaveRes = await fetch(`${baseUrl}/ess/leave/requests`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      leaveTypeId: leaveType.id,
      startDate: "2026-08-01T00:00:00Z",
      endDate: "2026-08-03T23:59:59Z",
      reason: "Vacation",
    }),
  });
  assert(applyLeaveRes.status === 201, "Leave application succeeds");
  const leaveReq = await applyLeaveRes.json();
  assert(leaveReq.status === LeaveRequestStatus.PENDING, "Leave request is PENDING");

  // Cancel Leave Request
  const cancelLeaveRes = await fetch(`${baseUrl}/ess/leave/requests/${leaveReq.id}/cancel`, {
    method: "POST",
    headers: empHeaders,
  });
  assert(cancelLeaveRes.status === 201, "Leave request cancellation succeeds");

  // Leave CSV export
  const leaveCsvRes = await fetch(`${baseUrl}/ess/leave/requests?export=csv`, { headers: empHeaders });
  assert(leaveCsvRes.status === 200, "Leave CSV export succeeds");
  const leaveCsv = await leaveCsvRes.text();
  assert(leaveCsv.startsWith("Leave ID,Leave Type,Start Date,End Date,Half Day,Reason,Status"), "CSV headers match");

  // 5. Payroll history and PDF Download
  console.log("Verifying Payslip list and PDF download...");
  const period = await prisma.payrollPeriod.create({
    data: {
      tenantId: tenantIdA,
      name: "July 2026",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    },
  });

  const payslip = await prisma.payslip.create({
    data: {
      tenantId: tenantIdA,
      employeeId: employee.id,
      payrollPeriodId: period.id,
      baseSalary: 5000,
      earnings: 5000,
      deductions: 0,
      netPay: 5000,
    },
  });

  const payslipsRes = await fetch(`${baseUrl}/ess/payroll/payslips`, { headers: empHeaders });
  assert(payslipsRes.status === 200, "Payslips list fetched");
  const payslipsList = await payslipsRes.json();
  assert(payslipsList.length === 1, "One payslip returned");

  // PDF download
  const pdfRes = await fetch(`${baseUrl}/ess/payroll/payslips/${payslip.id}/pdf`, { headers: empHeaders });
  assert(pdfRes.status === 200, "Payslip PDF download succeeds");
  const pdfBuffer = await pdfRes.arrayBuffer();
  const pdfHeader = String.fromCharCode(...new Uint8Array(pdfBuffer.slice(0, 4)));
  assert(pdfHeader === "%PDF", "PDF signature matches %PDF");

  // 6. Expense Claims Submission
  console.log("Verifying Expense Claims submission...");
  // Find accounts
  const expenseAccount = await prisma.account.findFirst({
    where: { tenantId: tenantIdA, type: "EXPENSE" },
  });
  assert(!!expenseAccount, "Expense account must exist");

  const expenseClaimRes = await fetch(`${baseUrl}/ess/expense/claims`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      title: "Travel Fuel",
      claimDate: "2026-07-03T00:00:00Z",
      items: [
        {
          accountId: expenseAccount!.id,
          amount: 80,
          description: "Fuel refill",
        },
      ],
    }),
  });
  assert(expenseClaimRes.status === 201, "Expense claim creation succeeds");
  let claim = await expenseClaimRes.json();
  assert(claim.status === ExpenseClaimStatus.DRAFT, "Initial claim status is DRAFT");

  const submitClaimRes = await fetch(`${baseUrl}/ess/expense/claims/${claim.id}/submit`, {
    method: "POST",
    headers: empHeaders,
  });
  assert(submitClaimRes.status === 201, "Expense claim submission succeeds");
  claim = await submitClaimRes.json();
  assert(claim.status === ExpenseClaimStatus.SUBMITTED, "Claim status is now SUBMITTED");

  // Expense Claims CSV export
  const expenseCsvRes = await fetch(`${baseUrl}/ess/expense/claims?export=csv`, { headers: empHeaders });
  assert(expenseCsvRes.status === 200, "Expense CSV export succeeds");
  const expenseCsv = await expenseCsvRes.text();
  assert(expenseCsv.startsWith("Claim ID,Title,Claim Date,Total Amount,Status"), "CSV headers match");

  // 7. PMS Self Review
  console.log("Verifying PMS Self-Review submission...");
  const cycle = await prisma.appraisalCycle.create({
    data: {
      tenantId: tenantIdA,
      name: "Mid Year 2026",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
      status: AppraisalCycleStatus.ACTIVE,
    },
  });

  const pmsReviewsRes = await fetch(`${baseUrl}/ess/pms/reviews`, { headers: empHeaders });
  assert(pmsReviewsRes.status === 200, "Appraisal list fetched");

  const selfReviewRes = await fetch(`${baseUrl}/ess/pms/reviews/self-submit`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      appraisalCycleId: cycle.id,
      selfScore: 4.2,
      selfFeedback: "All good",
    }),
  });
  assert(selfReviewRes.status === 201, "Self review submitted");
  const reviewResult = await selfReviewRes.json();
  assert(reviewResult.status === PerformanceReviewStatus.SUBMITTED, "Status updated to SUBMITTED");

  // 8. Company Announcements
  console.log("Verifying Company Announcements publish and permissions...");
  // Post announcement as Admin (succeeds 201)
  const createAnnounceRes = await fetch(`${baseUrl}/ess/announcements`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      title: "July Townhall meeting",
      content: "Scheduled for July 15th.",
      publishDate: "2026-07-01T00:00:00Z",
      expiryDate: "2026-07-30T00:00:00Z",
    }),
  });
  assert(createAnnounceRes.status === 201, "Announcement created successfully");

  // Try to create announcement as employee (fails 403)
  const failAnnounceRes = await fetch(`${baseUrl}/ess/announcements`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      title: "Unauthorized Announcement",
      content: "Not permitted",
      publishDate: "2026-07-01T00:00:00Z",
    }),
  });
  assert(failAnnounceRes.status === 403, "Employee announcement creation blocked");

  // Get active announcements as employee (returns July Townhall)
  const announceRes = await fetch(`${baseUrl}/ess/announcements`, { headers: empHeaders });
  assert(announceRes.status === 200, "Active announcements fetched");
  const activeAnnouncements = await announceRes.json();
  assert(activeAnnouncements.length === 1, "One active announcement returned");
  assert(activeAnnouncements[0].title === "July Townhall meeting", "Announcement title matches");

  // 9. Dashboard Widgets
  console.log("Verifying ESS Dashboard widgets...");
  const dashRes = await fetch(`${baseUrl}/ess/dashboard`, { headers: empHeaders });
  assert(dashRes.status === 200, "Dashboard summary fetched");
  const dash = await dashRes.json();
  assert(dash.remainingLeaves === 15, "Remaining leaves matches 15");
  assert(dash.pendingClaimsCount === 1, "Pending claims count matches 1");
  assert(dash.pendingClaimsAmount === 80, "Pending claims amount matches 80");
  assert(dash.latestPayslipNetPay === 5000, "Latest payslip net pay matches 5000");

  // 10. Tenant Isolation
  console.log("Verifying Tenant Isolation...");
  // Register Tenant B
  let tenantB = await prisma.tenant.findUnique({ where: { slug: "tenant-b-ess" } });
  if (!tenantB) {
    tenantB = await prisma.tenant.create({
      data: {
        name: "Tenant B ESS",
        slug: "tenant-b-ess",
      },
    });
  }

  let userB = await prisma.user.findFirst({ where: { email: "userb.ess@amdox.com" } });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: "userb.ess@amdox.com",
        username: "userb.ess",
        passwordHash,
      },
    });

    const roleB = await prisma.role.create({
      data: {
        tenantId: tenantB.id,
        name: "ESS Tenant B Role",
      },
    });

    const perm = await prisma.permission.findFirst({ where: { name: "ess:portal:read" } });
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
      username: "userb.ess@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginBRes.status === 200, "Tenant B login successful");
  const tokenB = (await loginBRes.json()).accessToken;

  // Try to retrieve Tenant A's profile as Tenant B (fails 404)
  const profileBRes = await fetch(`${baseUrl}/ess/profile`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(profileBRes.status === 404, "Tenant B profile fetch returns 404");

  // 11. Audit Logging
  console.log("Verifying Audit logs...");
  const audits = await prisma.auditLog.findMany({
    where: { tenantId: tenantIdA },
  });
  const actions = audits.map((a) => a.action);
  assert(actions.includes("PROFILE_UPDATED"), "Audit logs contain PROFILE_UPDATED");
  assert(actions.includes("ANNOUNCEMENT_CREATED"), "Audit logs contain ANNOUNCEMENT_CREATED");
  assert(actions.includes("PAYSLIP_DOWNLOADED"), "Audit logs contain PAYSLIP_DOWNLOADED");
  assert(actions.includes("SELF_REVIEW_SUBMITTED"), "Audit logs contain SELF_REVIEW_SUBMITTED");

  // 12. Notifications
  console.log("Verifying notifications...");
  const notifications = await prisma.notification.findMany({
    where: { tenantId: tenantIdA },
  });
  assert(notifications.length > 0, "Notifications are logged");

  // 13. Health Check
  console.log("Verifying health check...");
  const healthRes = await fetch("http://localhost:3022/health");
  assert(healthRes.status === 200, "Health check succeeds");

  console.log("==================================================");
  console.log("ALL ENTERPRISE ESS PORTAL E2E TESTS PASSED!");
  console.log("==================================================");
  app.close();
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
