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
} from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for PMS E2E integration tests...");
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
  await app.listen(3021);

  const baseUrl = "http://localhost:3021/api";
  let adminToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables
  console.log("Cleaning up database tables...");
  await prisma.performanceReview.deleteMany({});
  await prisma.performanceGoal.deleteMany({});
  await prisma.appraisalCycle.deleteMany({});
  await prisma.employeeDocument.deleteMany({});
  await prisma.employee.deleteMany({});

  // Clean test roles/users to avoid duplicates
  await prisma.userRole.deleteMany({
    where: {
      user: {
        email: { in: ["mgr.pms@amdox.com", "hr.pms@amdox.com", "userb.pms@amdox.com"] }
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      email: { in: ["mgr.pms@amdox.com", "hr.pms@amdox.com", "userb.pms@amdox.com"] }
    }
  });
  await prisma.rolePermission.deleteMany({
    where: {
      role: {
        name: { in: ["PMS Manager Role", "PMS HR Role", "PMS Tenant B Role"] }
      }
    }
  });
  await prisma.role.deleteMany({
    where: {
      name: { in: ["PMS Manager Role", "PMS HR Role", "PMS Tenant B Role"] }
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
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  // Seed employees and user records under Tenant A
  console.log("Seeding employees and managers...");
  const passwordHash = await argon2.hash("Password_1234_Special!");
  
  // PMS Manager Bob
  const managerUser = await prisma.user.create({
    data: {
      tenantId: tenantIdA,
      email: "mgr.pms@amdox.com",
      username: "mgr_pms",
      passwordHash,
    },
  });

  const managerEmp = await prisma.employee.create({
    data: {
      tenantId: tenantIdA,
      employeeCode: "EMP-PMS-MGR",
      firstName: "Bob",
      lastName: "Manager",
      email: "mgr.pms@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date(),
    },
  });

  // Assign Manager Role
  const managerRole = await prisma.role.create({
    data: {
      tenantId: tenantIdA,
      name: "PMS Manager Role",
    },
  });

  const mgrPermissions = await prisma.permission.findMany({
    where: {
      name: { in: ["pms:goal:write", "pms:goal:read", "pms:review:submit"] }
    }
  });

  for (const perm of mgrPermissions) {
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

  // PMS HR Admin
  const hrUser = await prisma.user.create({
    data: {
      tenantId: tenantIdA,
      email: "hr.pms@amdox.com",
      username: "hr_pms",
      passwordHash,
    },
  });

  const hrRole = await prisma.role.create({
    data: {
      tenantId: tenantIdA,
      name: "PMS HR Role",
    },
  });

  const hrPermissions = await prisma.permission.findMany({
    where: {
      name: { in: ["pms:cycle:write", "pms:cycle:read", "pms:goal:read", "pms:review:finalize"] }
    }
  });

  for (const perm of hrPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: hrRole.id,
        permissionId: perm.id,
      },
    });
  }

  await prisma.userRole.create({
    data: {
      userId: hrUser.id,
      roleId: hrRole.id,
      tenantId: tenantIdA,
    },
  });

  // Claimant Employee: John Doe (mapped to admin email for submission)
  const employeeJohn = await prisma.employee.create({
    data: {
      tenantId: tenantIdA,
      employeeCode: "EMP-PMS-CL",
      firstName: "John",
      lastName: "Doe",
      email: "admin@amdox.com", // Matches Admin User
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date(),
      reportingManagerId: managerEmp.id,
    },
  });

  // --- E2E SCENARIOS ---

  // 1. Appraisal Cycle CRUD
  console.log("Verifying Appraisal Cycle CRUD & overlap validation...");
  const createCycleRes = await fetch(`${baseUrl}/pms/cycles`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Annual Appraisal 2026",
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-12-31T23:59:59Z",
    }),
  });
  assert(createCycleRes.status === 201, "Cycle creation successful");
  const cycle = await createCycleRes.json();
  assert(cycle.status === AppraisalCycleStatus.DRAFT, "Initial status is DRAFT");

  // Verify startDate >= endDate fails
  const invalidCycleRes = await fetch(`${baseUrl}/pms/cycles`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Invalid Cycle",
      startDate: "2026-12-31T23:59:59Z",
      endDate: "2026-01-01T00:00:00Z",
    }),
  });
  assert(invalidCycleRes.status === 400, "Validation blocks start date >= end date");

  // Activate Cycle
  const activateRes = await fetch(`${baseUrl}/pms/cycles/${cycle.id}/activate`, {
    method: "POST",
    headers,
  });
  assert(activateRes.status === 201, "Cycle activation successful");
  const activeCycle = await activateRes.json();
  assert(activeCycle.status === AppraisalCycleStatus.ACTIVE, "Cycle is now ACTIVE");

  // Verify only one active cycle may exist
  const cycle2Res = await fetch(`${baseUrl}/pms/cycles`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Another Appraisal Cycle",
      startDate: "2027-01-01T00:00:00Z",
      endDate: "2027-12-31T23:59:59Z",
    }),
  });
  const cycle2 = await cycle2Res.json();
  const activate2Res = await fetch(`${baseUrl}/pms/cycles/${cycle2.id}/activate`, {
    method: "POST",
    headers,
  });
  assert(activate2Res.status === 400, "Activating second active cycle blocked");

  // 2. Goal CRUD
  console.log("Verifying Goal CRUD & weight sum validation...");
  
  // Authenticate Manager Bob
  const loginMgrRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "mgr.pms@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  const mgrToken = (await loginMgrRes.json()).accessToken;
  const mgrHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${mgrToken}`,
  };

  // Create goal 1
  const createGoalRes = await fetch(`${baseUrl}/pms/goals`, {
    method: "POST",
    headers: mgrHeaders,
    body: JSON.stringify({
      employeeId: employeeJohn.id,
      title: "Deliver Phase 36",
      description: "Write complete E2E PMS module",
      weight: 60,
    }),
  });
  assert(createGoalRes.status === 201, "Goal 1 created successfully");
  const goal1 = await createGoalRes.json();
  assert(goal1.status === GoalStatus.PENDING, "Initial goal status is PENDING");

  // Create duplicate goal title fails
  const dupGoalRes = await fetch(`${baseUrl}/pms/goals`, {
    method: "POST",
    headers: mgrHeaders,
    body: JSON.stringify({
      employeeId: employeeJohn.id,
      title: "Deliver Phase 36",
      weight: 10,
    }),
  });
  assert(dupGoalRes.status === 400, "Duplicate goal title blocked");

  // Verify weight sum check (> 100 fails)
  const overWeightRes = await fetch(`${baseUrl}/pms/goals`, {
    method: "POST",
    headers: mgrHeaders,
    body: JSON.stringify({
      employeeId: employeeJohn.id,
      title: "Some other goal",
      weight: 50, // 60 + 50 = 110 > 100
    }),
  });
  assert(overWeightRes.status === 400, "Weight sum check blocks weights > 100%");

  // Update goal status
  const updateGoalRes = await fetch(`${baseUrl}/pms/goals/${goal1.id}`, {
    method: "PATCH",
    headers: mgrHeaders,
    body: JSON.stringify({
      status: GoalStatus.ACHIEVED,
      expectedVersion: goal1.version,
    }),
  });
  assert(updateGoalRes.status === 200, "Goal updated to ACHIEVED");
  const updatedGoal = await updateGoalRes.json();
  assert(updatedGoal.status === GoalStatus.ACHIEVED, "Goal status is ACHIEVED");

  // Concurrency check on goals update
  const staleGoalUpdateRes = await fetch(`${baseUrl}/pms/goals/${goal1.id}`, {
    method: "PATCH",
    headers: mgrHeaders,
    body: JSON.stringify({
      status: GoalStatus.MISSED,
      expectedVersion: 1, // Stale version
    }),
  });
  assert(staleGoalUpdateRes.status === 409, "Optimistic locking blocks stale version updates");

  // 3. Self-Review
  console.log("Verifying Employee Self-Review submission...");
  const selfReviewRes = await fetch(`${baseUrl}/pms/reviews/self-submit`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      appraisalCycleId: activeCycle.id,
      selfScore: 4.5,
      selfFeedback: "Completed all phases with high quality code.",
    }),
  });
  assert(selfReviewRes.status === 201, "Self review submitted successfully");
  const review = await selfReviewRes.json();
  assert(review.status === PerformanceReviewStatus.SUBMITTED, "Initial review status is SUBMITTED");

  // Duplicate self-review check
  const dupSelfReviewRes = await fetch(`${baseUrl}/pms/reviews/self-submit`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      appraisalCycleId: activeCycle.id,
      selfScore: 3.0,
      selfFeedback: "Again",
    }),
  });
  assert(dupSelfReviewRes.status === 400, "Duplicate self review submission blocked");

  // Score bounds checks
  const boundsSelfReviewRes = await fetch(`${baseUrl}/pms/reviews/self-submit`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      appraisalCycleId: activeCycle.id,
      selfScore: 6.0,
      selfFeedback: "Out of bounds",
    }),
  });
  assert(boundsSelfReviewRes.status === 400, "Out of bounds score blocked");

  // 4. Manager Review
  console.log("Verifying Manager Review...");
  
  // Try manager review as non-manager admin (should fail)
  const failManagerReviewRes = await fetch(`${baseUrl}/pms/reviews/${review.id}/manager-submit`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      managerScore: 4.8,
      managerFeedback: "Excellent coding",
      expectedVersion: review.version,
    }),
  });
  assert(failManagerReviewRes.status === 403, "Non-reporting manager is blocked from reviewing");

  // Approve manager review as reporting Manager Bob
  const managerReviewRes = await fetch(`${baseUrl}/pms/reviews/${review.id}/manager-submit`, {
    method: "PATCH",
    headers: mgrHeaders,
    body: JSON.stringify({
      managerScore: 4.8,
      managerFeedback: "Excellent deliverables, exceeded expectations.",
      expectedVersion: review.version,
    }),
  });
  assert(managerReviewRes.status === 200, "Manager review successfully submitted");
  const mgrReviewed = await managerReviewRes.json();
  assert(mgrReviewed.status === PerformanceReviewStatus.MANAGER_REVIEWED, "Status is MANAGER_REVIEWED");

  // Concurrency check on manager review
  const staleManagerReviewRes = await fetch(`${baseUrl}/pms/reviews/${review.id}/manager-submit`, {
    method: "PATCH",
    headers: mgrHeaders,
    body: JSON.stringify({
      managerScore: 4.0,
      managerFeedback: "Again",
      expectedVersion: 1, // Stale version
    }),
  });
  assert(staleManagerReviewRes.status === 409, "Optimistic locking blocks stale manager review updates");

  // 5. HR Finalization
  console.log("Verifying HR Finalization...");
  
  // Authenticate HR user
  const loginHrRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "hr.pms@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  const hrToken = (await loginHrRes.json()).accessToken;
  const hrHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${hrToken}`,
  };

  // Finalize appraisal
  const finalizeRes = await fetch(`${baseUrl}/pms/reviews/${review.id}/finalize`, {
    method: "PATCH",
    headers: hrHeaders,
    body: JSON.stringify({
      finalScore: 4.75,
      expectedVersion: mgrReviewed.version,
    }),
  });
  assert(finalizeRes.status === 200, "HR finalization successful");
  const completedReview = await finalizeRes.json();
  assert(completedReview.status === PerformanceReviewStatus.COMPLETED, "Status is COMPLETED");

  // Verify double finalization blocks
  const dupFinalizeRes = await fetch(`${baseUrl}/pms/reviews/${review.id}/finalize`, {
    method: "PATCH",
    headers: hrHeaders,
    body: JSON.stringify({
      finalScore: 4.5,
      expectedVersion: completedReview.version,
    }),
  });
  assert(dupFinalizeRes.status === 400, "Double finalization blocked");

  // 6. Tenant Isolation
  console.log("Verifying Tenant Isolation...");
  
  // Register Tenant B
  let tenantB = await prisma.tenant.findUnique({ where: { slug: "tenant-b-pms" } });
  if (!tenantB) {
    tenantB = await prisma.tenant.create({
      data: {
        name: "Tenant B PMS",
        slug: "tenant-b-pms",
      },
    });
  }

  let userB = await prisma.user.findFirst({ where: { email: "userb.pms@amdox.com" } });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: "userb.pms@amdox.com",
        username: "userb.pms",
        passwordHash,
      },
    });

    const roleB = await prisma.role.create({
      data: {
        tenantId: tenantB.id,
        name: "PMS Tenant B Role",
      },
    });

    const perm = await prisma.permission.findFirst({ where: { name: "pms:goal:read" } });
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
      username: "userb.pms@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginBRes.status === 200, "Tenant B login successful");
  const tokenB = (await loginBRes.json()).accessToken;

  // Try to read Tenant A review as Tenant B
  const readReviewBRes = await fetch(`${baseUrl}/pms/reviews/${review.id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(readReviewBRes.status === 404, "Tenant B cannot find Tenant A's reviews (404 Isolation)");

  // 7. CSV Export
  console.log("Verifying CSV Export...");
  const csvRes = await fetch(`${baseUrl}/pms/reviews?export=csv`, { headers: hrHeaders });
  assert(csvRes.status === 200, "CSV export succeeds");
  const csvContent = await csvRes.text();
  assert(csvContent.startsWith("Review ID,Employee Code,Employee Name,Cycle Name,Self Score,Manager Score,Final Score,Status"), "CSV headers match");

  // 8. PDF Export
  console.log("Verifying PDF Export...");
  const pdfRes = await fetch(`${baseUrl}/pms/reports/performance/pdf`, { headers: hrHeaders });
  assert(pdfRes.status === 200, "PDF export succeeds");
  const pdfBuffer = await pdfRes.arrayBuffer();
  const pdfHeader = String.fromCharCode(...new Uint8Array(pdfBuffer.slice(0, 4)));
  assert(pdfHeader === "%PDF", "PDF signature matches %PDF");

  // 9. Dashboard Widgets
  console.log("Verifying Dashboard widgets...");
  const dashRes = await fetch(`${baseUrl}/pms/dashboard`, { headers: mgrHeaders });
  assert(dashRes.status === 200, "Dashboard fetch succeeds");
  const dash = await dashRes.json();
  assert(dash.activeAppraisalCycles === 1, "Active cycles is 1");
  assert(dash.completedReviews === 1, "Completed reviews is 1");
  assert(Number(dash.averagePerformanceScore) === 4.75, "Average score matches finalized rating");
  assert(dash.goalCompletionPercentage === 100, "Goal completion matches ACHIEVED goal");

  // 10. Audit Logging
  console.log("Verifying Audit logs...");
  const audits = await prisma.auditLog.findMany({
    where: { tenantId: tenantIdA },
  });
  const actions = audits.map((a) => a.action);
  assert(actions.includes("APPRAISAL_CYCLE_CREATED"), "Audit logs contain APPRAISAL_CYCLE_CREATED");
  assert(actions.includes("APPRAISAL_CYCLE_ACTIVATED"), "Audit logs contain APPRAISAL_CYCLE_ACTIVATED");
  assert(actions.includes("GOAL_CREATED"), "Audit logs contain GOAL_CREATED");
  assert(actions.includes("GOAL_UPDATED"), "Audit logs contain GOAL_UPDATED");
  assert(actions.includes("SELF_REVIEW_SUBMITTED"), "Audit logs contain SELF_REVIEW_SUBMITTED");
  assert(actions.includes("MANAGER_REVIEW_SUBMITTED"), "Audit logs contain MANAGER_REVIEW_SUBMITTED");
  assert(actions.includes("PERFORMANCE_FINALIZED"), "Audit logs contain PERFORMANCE_FINALIZED");

  // 11. Notifications
  console.log("Verifying notifications...");
  const notifications = await prisma.notification.findMany({
    where: { tenantId: tenantIdA },
  });
  assert(notifications.length > 0, "Notifications are logged in database");

  // 12. Health Endpoint
  console.log("Verifying health check endpoint...");
  const healthTestRes = await fetch("http://localhost:3021/health");
  assert(healthTestRes.status === 200, "Health endpoint works");

  console.log("==================================================");
  console.log("ALL ENTERPRISE PMS E2E TESTS PASSED!");
  console.log("==================================================");
  app.close();
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
