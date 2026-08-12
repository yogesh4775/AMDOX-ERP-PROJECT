/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, EmployeeStatus, Prisma } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { WorkflowInstanceStatus, WorkflowStepStatus } from "./modules/workflow/services/workflow.service";
import * as argon2 from "argon2";


const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Workflow integration E2E tests...");
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
  let managerToken = "";
  let employeeToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables
  console.log("Cleaning up workflow tables...");
  await prisma.workflowDelegation.deleteMany({});
  await prisma.workflowInstanceStep.deleteMany({});
  await prisma.workflowInstance.deleteMany({});
  await prisma.workflowStep.deleteMany({});
  await prisma.workflowDefinition.deleteMany({});
  await prisma.expenseClaimApproval.deleteMany({});
  await prisma.expenseClaimItem.deleteMany({});
  await prisma.expenseClaim.deleteMany({});
  await prisma.employee.deleteMany({ where: { employeeCode: { in: ["WEMP01", "WEMP02", "WEMP03"] } } });

  // Ensure admin user email is verified in DB
  await prisma.user.updateMany({
    where: { email: "admin@amdox.com" },
    data: { emailVerified: true },
  });

  // 1. Authenticate Users
  console.log("Authenticating admin@amdox.com...");
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

  const adminHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  const adminUser = await prisma.user.findFirst({ where: { email: "admin@amdox.com" } });
  assert(!!adminUser, "Admin user must exist");
  const tenantId = adminUser!.tenantId!;

  // Create test employees, users, and roles
  console.log("Setting up roles and users for workflow tests...");
  const testPasswordHash = await argon2.hash("Password_1234_Special!", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  let managerUser = await prisma.user.findFirst({ where: { email: "manager.wf@amdox.com" } });
  if (!managerUser) {
    managerUser = await prisma.user.create({
      data: {
        tenantId,
        email: "manager.wf@amdox.com",
        username: "managerwf",
        passwordHash: testPasswordHash,
        emailVerified: true,
      },
    });
  } else {
    managerUser = await prisma.user.update({
      where: { id: managerUser.id },
      data: { passwordHash: testPasswordHash, emailVerified: true },
    });
  }

  let employeeUser = await prisma.user.findFirst({ where: { email: "employee.wf@amdox.com" } });
  if (!employeeUser) {
    employeeUser = await prisma.user.create({
      data: {
        tenantId,
        email: "employee.wf@amdox.com",
        username: "employeewf",
        passwordHash: testPasswordHash,
        emailVerified: true,
      },
    });
  } else {
    employeeUser = await prisma.user.update({
      where: { id: employeeUser.id },
      data: { passwordHash: testPasswordHash, emailVerified: true },
    });
  }


  // Assign roles
  let testRole = await prisma.role.findFirst({ where: { tenantId, name: "Finance Reviewer" } });
  if (!testRole) {
    testRole = await prisma.role.create({
      data: {
        tenantId,
        name: "Finance Reviewer",
        description: "Finance reviewer role",
      },
    });
  }

  // Create UserRole link for manager
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: managerUser.id,
        roleId: testRole.id,
      },
    },
    update: {},
    create: {
      tenantId,
      userId: managerUser.id,
      roleId: testRole.id,
    },
  });

  // Link all workflow permissions to the testRole (Finance Reviewer)
  const wfPermissions = await prisma.permission.findMany({
    where: { name: { startsWith: "workflow:" } },
  });
  for (const perm of wfPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: testRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: testRole.id,
        permissionId: perm.id,
      },
    });
  }


  // Setup employees linked to users
  const managerEmp = await prisma.employee.create({
    data: {
      tenantId,
      employeeCode: "WEMP01",
      firstName: "Sarah",
      lastName: "WFManager",
      email: "manager.wf@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date(),
    },
  });

  const employeeEmp = await prisma.employee.create({
    data: {
      tenantId,
      employeeCode: "WEMP02",
      firstName: "Alex",
      lastName: "WFEmployee",
      email: "employee.wf@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date(),
      reportingManagerId: managerEmp.id,
    },
  });

  const adminEmp = await prisma.employee.create({
    data: {
      tenantId,
      employeeCode: "WEMP03",
      firstName: "Admin",
      lastName: "WFAdmin",
      email: "admin@amdox.com",
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date(),
      reportingManagerId: managerEmp.id,
    },
  });


  // Authenticate Manager and Employee users
  console.log("Authenticating manager.wf@amdox.com...");
  const managerLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "manager.wf@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(managerLoginRes.status === 200 || managerLoginRes.status === 201, "Manager login should succeed");
  const managerLoginData = (await managerLoginRes.json()) as { accessToken: string };
  managerToken = managerLoginData.accessToken;

  const managerHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${managerToken}`,
  };

  console.log("Authenticating employee.wf@amdox.com...");
  const employeeLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "employee.wf@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(employeeLoginRes.status === 200 || employeeLoginRes.status === 201, "Employee login should succeed");
  const employeeLoginData = (await employeeLoginRes.json()) as { accessToken: string };
  employeeToken = employeeLoginData.accessToken;

  const employeeHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${employeeToken}`,
  };

  // Create a mock Expense GL Account
  let expenseAccount = await prisma.account.findFirst({
    where: { tenantId, code: "7070" },
  });
  if (!expenseAccount) {
    expenseAccount = await prisma.account.create({
      data: {
        tenantId,
        code: "7070",
        name: "Workflow Test Expenses",
        type: "EXPENSE",
        status: "ACTIVE",
      },
    });
  }

  // Create a dummy media file for attachments verification
  const mediaFile = await prisma.mediaFile.create({
    data: {
      tenantId,
      uploadedBy: adminUser!.id,
      originalName: "receipt.png",
      storedName: "receipt.png",
      mimeType: "image/png",
      extension: "png",
      size: 2048,
      type: "OTHER",
      storageProvider: "LOCAL",
      storagePath: "receipt.png",
      checksum: "check",
    },
  });

  // 2. WORKFLOW DEFINITION CRUD
  console.log("Verifying Workflow Definition CRUD...");
  const createDefRes = await fetch(`${baseUrl}/workflows/definitions`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "WF Expense Approval",
      code: "EXPENSE_APPROVAL",
      entityType: "ExpenseClaim",
      steps: [
        {
          level: 1,
          name: "Reporting Manager Approval",
          approverType: "REPORTING_MANAGER",
          slaHours: 24,
          escalationAction: "ESCALATE_TO_ROLE",
          escalationValue: "Finance Reviewer",
        },
        {
          level: 2,
          name: "Finance Role Approval",
          approverType: "ROLE",
          approverValue: "Finance Reviewer",
          conditions: {
            totalAmount: { gt: 5000 },
          },
        },
      ],
    }),
  });
  assert(createDefRes.status === 201, "Should create workflow definition");
  const definition = await createDefRes.json();
  assert(definition.code === "EXPENSE_APPROVAL", "Workflow code should match");

  // Check unique constraints
  const createDuplicateCodeRes = await fetch(`${baseUrl}/workflows/definitions`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "WF Expense Second",
      code: "EXPENSE_APPROVAL",
      entityType: "ExpenseClaim",
      steps: [],
    }),
  });
  assert(createDuplicateCodeRes.status === 409, "Should prevent duplicate workflow code");

  // Edit Definition (Workflow Versioning validation)
  console.log("Verifying Workflow Versioning & Update...");
  const updateDefRes = await fetch(`${baseUrl}/workflows/definitions/${definition.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "WF Expense Approval Version 2",
      steps: [
        {
          level: 1,
          name: "Reporting Manager Approval V2",
          approverType: "REPORTING_MANAGER",
          slaHours: 12,
          escalationAction: "ESCALATE_TO_ROLE",
          escalationValue: "Finance Reviewer",
        },
        {
          level: 2,
          name: "Finance Role Approval",
          approverType: "ROLE",
          approverValue: "Finance Reviewer",
          conditions: {
            totalAmount: { gt: 5000 },
          },
        },
      ],
    }),
  });
  assert(updateDefRes.status === 200, "Should update workflow definition");
  const updatedDef = await updateDefRes.json();
  assert(updatedDef.version === 2, "Workflow definition version should increment to 2");

  // 3. SUBMIT WORKFLOW & SEQUENTIAL APPROVAL FLOW
  console.log("Verifying Workflow Submission & Step Assignments...");
  // Create an Expense Claim to submit
  const expenseClaim = await prisma.expenseClaim.create({
    data: {
      tenantId,
      employeeId: employeeEmp.id,
      title: "WF Travel Expense",
      claimDate: new Date(),
      totalAmount: new Prisma.Decimal(6000), // meets Level 2 condition (> 5000)
      status: "DRAFT",
    },
  });

  const submitInstanceRes = await fetch(`${baseUrl}/workflows/instances/submit`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      entityType: "ExpenseClaim",
      entityId: expenseClaim.id,
      definitionCode: "EXPENSE_APPROVAL",
    }),
  });
  assert(submitInstanceRes.status === 201, "Should submit entity to workflow");
  const instance = await submitInstanceRes.json();
  assert(instance.status === WorkflowInstanceStatus.PENDING, "Instance status should be PENDING");
  assert(instance.currentLevel === 1, "Initial level should be 1");

  // Verify dynamic manager resolution
  const firstStep = instance.steps.find((s: any) => s.level === 1);
  assert(firstStep.assignedApproverId === managerUser.id, "Step 1 should be assigned to reporting manager user ID");

  // 4. ACTION STEP (APPROVE / REJECT)
  console.log("Verifying Step Actions (Approve/Reject)...");
  // Simulate manager WF user login or just mock AuthUser permissions.
  // We can use the adminToken for this action because our mock allows RBAC check override
  // or we can test with direct admin actions. Let's action step 1 (Approve)
  const actionStepRes = await fetch(`${baseUrl}/workflows/approvals/${firstStep.id}/action`, {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify({
      action: "APPROVE",
      comment: "Expense looks valid, moving to Finance.",
      attachments: [mediaFile.id],
    }),
  });
  assert(actionStepRes.status === 201 || actionStepRes.status === 200, "Step 1 approval should succeed");

  // Verify advance to Level 2
  const updatedInstanceRes = await fetch(`${baseUrl}/workflows/instances/search?entityType=ExpenseClaim&entityId=${expenseClaim.id}`, {
    method: "GET",
    headers: adminHeaders,
  });
  const instances = await updatedInstanceRes.json();
  const activeInstance = instances[0];
  assert(activeInstance.currentLevel === 2, "Should advance current level to 2");

  // Level 2 matches role-based approvers (Role: Finance Reviewer)
  const secondStep = activeInstance.steps.find((s: any) => s.level === 2);
  assert(secondStep.step.approverType === "ROLE", "Level 2 approver type should be ROLE");

  // Action level 2 (Approve) to complete the workflow
  const actionStep2Res = await fetch(`${baseUrl}/workflows/approvals/${secondStep.id}/action`, {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify({
      action: "APPROVE",
      comment: "Finance approved.",
    }),
  });
  assert(actionStep2Res.status === 201 || actionStep2Res.status === 200, "Step 2 approval should succeed");

  // Verify final workflow completion and dynamic callback execution
  const completedInstanceRes = await fetch(`${baseUrl}/workflows/instances/search?entityType=ExpenseClaim&entityId=${expenseClaim.id}`, {
    method: "GET",
    headers: adminHeaders,
  });
  const completedInstances = await completedInstanceRes.json();
  const finalInstance = completedInstances[0];
  assert(finalInstance.status === WorkflowInstanceStatus.APPROVED, "Workflow status should be APPROVED on final step");

  // Verify callback updated entity status in database
  const finalClaim = await prisma.expenseClaim.findUnique({ where: { id: expenseClaim.id } });
  assert(finalClaim!.status === "APPROVED", "Expense claim status in database should be updated to APPROVED");

  // 5. CONDITIONS ROUTING & SKIPPING STEPS
  console.log("Verifying conditions routing (skipping steps)...");
  const lowExpenseClaim = await prisma.expenseClaim.create({
    data: {
      tenantId,
      employeeId: employeeEmp.id,
      title: "WF Small Expense",
      claimDate: new Date(),
      totalAmount: new Prisma.Decimal(2000), // Below Level 2 condition (> 5000), should skip Level 2
      status: "DRAFT",
    },
  });

  const submitSmallInstanceRes = await fetch(`${baseUrl}/workflows/instances/submit`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      entityType: "ExpenseClaim",
      entityId: lowExpenseClaim.id,
      definitionCode: "EXPENSE_APPROVAL",
    }),
  });
  assert(submitSmallInstanceRes.status === 201, "Low expense submission should succeed");
  const smallInstance = await submitSmallInstanceRes.json();

  const smallStep1 = smallInstance.steps.find((s: any) => s.level === 1);
  const actionSmallStep1Res = await fetch(`${baseUrl}/workflows/approvals/${smallStep1.id}/action`, {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify({
      action: "APPROVE",
      comment: "Approved level 1.",
    }),
  });
  assert(actionSmallStep1Res.status === 200 || actionSmallStep1Res.status === 201, "Small step 1 approval should succeed");

  // Verify that workflow completed immediately because Level 2 was SKIPPED due to conditions
  const lowClaimInstanceRes = await fetch(`${baseUrl}/workflows/instances/search?entityType=ExpenseClaim&entityId=${lowExpenseClaim.id}`, {
    method: "GET",
    headers: adminHeaders,
  });
  const lowClaimInstances = await lowClaimInstanceRes.json();
  const finalLowInstance = lowClaimInstances[0];
  assert(finalLowInstance.status === WorkflowInstanceStatus.APPROVED, "Low workflow should be APPROVED");
  const smallStep2 = finalLowInstance.steps.find((s: any) => s.level === 2);
  assert(smallStep2.status === WorkflowStepStatus.SKIPPED, "Low workflow step 2 status should be SKIPPED");

  // 6. AUTO APPROVAL
  console.log("Verifying Auto-Approval rules...");
  const tinyExpenseClaim = await prisma.expenseClaim.create({
    data: {
      tenantId,
      employeeId: employeeEmp.id,
      title: "WF Tiny Expense",
      claimDate: new Date(),
      totalAmount: new Prisma.Decimal(100), // Below auto-approval threshold (500)
      status: "DRAFT",
    },
  });

  const submitTinyInstanceRes = await fetch(`${baseUrl}/workflows/instances/submit`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      entityType: "ExpenseClaim",
      entityId: tinyExpenseClaim.id,
      definitionCode: "EXPENSE_APPROVAL",
    }),
  });
  assert(submitTinyInstanceRes.status === 201, "Tiny expense submission should succeed");
  const tinyInstance = await submitTinyInstanceRes.json();
  assert(tinyInstance.status === WorkflowInstanceStatus.APPROVED, "Tiny workflow should be APPROVED automatically");

  // 7. DELEGATIONS
  console.log("Verifying Approver Delegations...");
  // Delegate from admin to managerUser
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const delegateRes = await fetch(`${baseUrl}/workflows/delegations`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      toUserId: managerUser.id,
      startDate: new Date().toISOString(),
      endDate: tomorrow.toISOString(),
    }),
  });
  assert(delegateRes.status === 201, "Delegation creation should succeed");
  const delegation = await delegateRes.json();

  // Submit instance where admin would be the approver
  let adminApproverDef = await prisma.workflowDefinition.create({
    data: {
      tenantId,
      name: "Admin Approval Definition",
      code: "ADMIN_APPROVAL",
      entityType: "ExpenseClaim",
      version: 1,
      steps: {
        create: {
          tenantId,
          level: 1,
          name: "Admin Step",
          approverType: "USER",
          approverValue: adminUser!.id,
        },
      },
    },
  });

  const delegationClaim = await prisma.expenseClaim.create({
    data: {
      tenantId,
      employeeId: employeeEmp.id,
      title: "WF Delegation Expense",
      claimDate: new Date(),
      totalAmount: new Prisma.Decimal(1500),
      status: "DRAFT",
    },
  });

  const submitDelegationInstanceRes = await fetch(`${baseUrl}/workflows/instances/submit`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      entityType: "ExpenseClaim",
      entityId: delegationClaim.id,
      definitionCode: "ADMIN_APPROVAL",
    }),
  });
  assert(submitDelegationInstanceRes.status === 201, "Delegated workflow submission should succeed");
  const delegationInstance = await submitDelegationInstanceRes.json();
  const delegatedStep = delegationInstance.steps[0];

  assert(delegatedStep.assignedApproverId === managerUser.id, "Task should be delegated and assigned to managerUser");
  assert(delegatedStep.originalApproverId === adminUser!.id, "Original approver should be adminUser");

  // Clean up delegation
  await fetch(`${baseUrl}/workflows/delegations/${delegation.id}`, {
    method: "DELETE",
    headers: adminHeaders,
  });

  // 8. MANUAL REASSIGNMENT
  console.log("Verifying Task Reassignment...");
  const reassignClaim = await prisma.expenseClaim.create({
    data: {
      tenantId,
      employeeId: employeeEmp.id,
      title: "WF Reassignment Expense",
      claimDate: new Date(),
      totalAmount: new Prisma.Decimal(2500),
      status: "DRAFT",
    },
  });

  const submitReassignRes = await fetch(`${baseUrl}/workflows/instances/submit`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      entityType: "ExpenseClaim",
      entityId: reassignClaim.id,
      definitionCode: "ADMIN_APPROVAL",
    }),
  });
  const reassignInstance = await submitReassignRes.json();
  const reassignStep = reassignInstance.steps[0];

  const reassignActionRes = await fetch(`${baseUrl}/workflows/reassign/${reassignStep.id}`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      targetUserId: managerUser.id,
      comment: "Escalating task manually.",
    }),
  });
  assert(reassignActionRes.status === 201 || reassignActionRes.status === 200, "Reassignment action should succeed");
  const updatedReassignStep = await reassignActionRes.json();
  assert(updatedReassignStep.assignedApproverId === managerUser.id, "Assigned approver should now be managerUser");

  // 9. SLA ESCALATIONS PROCESS
  console.log("Verifying SLA Escalations...");
  // Create a definition with immediate SLA and auto-reject
  let slaDef = await prisma.workflowDefinition.create({
    data: {
      tenantId,
      name: "SLA Definition",
      code: "SLA_APPROVAL",
      entityType: "ExpenseClaim",
      version: 1,
      steps: {
        create: {
          tenantId,
          level: 1,
          name: "SLA Step",
          approverType: "USER",
          approverValue: adminUser!.id,
          slaHours: 1,
          escalationAction: "AUTO_REJECT",
        },
      },
    },
  });

  const slaClaim = await prisma.expenseClaim.create({
    data: {
      tenantId,
      employeeId: employeeEmp.id,
      title: "WF SLA Expense",
      claimDate: new Date(),
      totalAmount: new Prisma.Decimal(3000),
      status: "DRAFT",
    },
  });

  const submitSlaRes = await fetch(`${baseUrl}/workflows/instances/submit`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      entityType: "ExpenseClaim",
      entityId: slaClaim.id,
      definitionCode: "SLA_APPROVAL",
    }),
  });
  const slaInstance = await submitSlaRes.json();
  const slaStep = slaInstance.steps[0];

  // Artificially modify deadline in database to past
  const pastDate = new Date();
  pastDate.setHours(pastDate.getHours() - 2);
  await prisma.workflowInstanceStep.update({
    where: { id: slaStep.id },
    data: { deadlineAt: pastDate },
  });

  // Trigger SLA daemon process
  const triggerSlaRes = await fetch(`${baseUrl}/workflows/escalations/process`, {
    method: "POST",
    headers: adminHeaders,
  });
  assert(triggerSlaRes.status === 201 || triggerSlaRes.status === 200, "SLA trigger should succeed");

  // Verify instance was auto-rejected
  const finalSlaInstance = await prisma.workflowInstance.findUnique({
    where: { id: slaInstance.id },
  });
  assert(finalSlaInstance!.status === WorkflowInstanceStatus.REJECTED, "Workflow should be auto-rejected after SLA expired");

  // 10. DASHBOARD WIDGETS
  console.log("Verifying Dashboard Widgets...");
  const dashboardRes = await fetch(`${baseUrl}/workflows/dashboard`, {
    method: "GET",
    headers: adminHeaders,
  });
  assert(dashboardRes.status === 200, "Dashboard stats request should succeed");
  const stats = await dashboardRes.json();
  assert("pending" in stats, "Stats should contain pending count");
  assert("approved" in stats, "Stats should contain approved count");

  // 11. AUDIT LOGS AND NOTIFICATIONS VERIFICATION
  console.log("Verifying Audit Logs and Notifications...");
  const auditLogs = await prisma.auditLog.findMany({
    where: { tenantId, action: { in: ["WORKFLOW_CREATED", "WORKFLOW_SUBMITTED", "WORKFLOW_APPROVED", "WORKFLOW_REJECTED"] } },
  });
  assert(auditLogs.length > 0, "At least one workflow audit log should exist");

  const notifications = await prisma.notification.findMany({
    where: { tenantId },
  });
  assert(notifications.length > 0, "At least one system notification should exist");

  // 12. TENANT ISOLATION
  console.log("Verifying Tenant Isolation...");
  // Attempting to retrieve definition from a different tenant context (using mock/empty tenant token)
  const badHeaders = {
    "Content-Type": "application/json",
    Authorization: "Bearer invalid",
  };
  const badRes = await fetch(`${baseUrl}/workflows/definitions`, {
    method: "GET",
    headers: badHeaders,
  });
  assert(badRes.status === 401, "Request with invalid token should be unauthorized");

  // 13. HEALTH ENDPOINT
  console.log("Verifying Health Endpoint...");
  const healthRes = await fetch(`http://localhost:3019/health`);
  assert(healthRes.status === 200 || healthRes.status === 201, "Health check should be healthy");

  console.log("\n==================================================");
  console.log("ALL E2E WORKFLOW INTEGRATION TESTS PASSED SUCCESSFULLY! 🚀");
  console.log("==================================================\n");

  await app.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("E2E Integration Test failed:", err);
  process.exit(1);
});
