/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, EmployeeStatus, EmploymentType, MasterStatus, MediaFileType } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for HRM integration E2E tests...");
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
  await app.listen(3014);

  const baseUrl = "http://localhost:3014/api";
  let adminToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables
  console.log("Cleaning up database tables...");
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

  // Create an active department and designation for testing
  const dept = await prisma.department.upsert({
    where: { tenantId_name: { tenantId: tenantIdA, name: "Engineering" } },
    update: { status: MasterStatus.ACTIVE, deletedAt: null },
    create: { tenantId: tenantIdA, name: "Engineering", status: MasterStatus.ACTIVE },
  });

  const des = await prisma.designation.upsert({
    where: { tenantId_name: { tenantId: tenantIdA, name: "Software Engineer" } },
    update: { status: MasterStatus.ACTIVE, deletedAt: null },
    create: { tenantId: tenantIdA, name: "Software Engineer", status: MasterStatus.ACTIVE },
  });

  // 2. Employee CRUD
  console.log("Verifying Employee CRUD...");
  const createEmpRes = await fetch(`${baseUrl}/hrm/employees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeCode: "EMP001",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@amdox.com",
      phone: "+15550100",
      departmentId: dept.id,
      designationId: des.id,
      employmentType: EmploymentType.FULL_TIME,
      joiningDate: "2026-01-01T00:00:00Z",
    }),
  });
  assert(createEmpRes.status === 200 || createEmpRes.status === 201, "Employee creation should succeed");
  const empA = await createEmpRes.json();
  assert(empA.status === EmployeeStatus.ACTIVE, "Status defaults to ACTIVE");

  // Duplicate Employee Code check
  const dupCodeRes = await fetch(`${baseUrl}/hrm/employees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeCode: "EMP001",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane.doe@amdox.com",
      joiningDate: "2026-01-01T00:00:00Z",
    }),
  });
  assert(dupCodeRes.status === 400, "Duplicate employee code must fail");

  // Duplicate email check
  const dupEmailRes = await fetch(`${baseUrl}/hrm/employees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeCode: "EMP002",
      firstName: "Jane",
      lastName: "Doe",
      email: "john.doe@amdox.com",
      joiningDate: "2026-01-01T00:00:00Z",
    }),
  });
  assert(dupEmailRes.status === 400, "Duplicate employee email must fail");

  // Read Directory list
  const listRes = await fetch(`${baseUrl}/hrm/employees`, { headers });
  const list = await listRes.json();
  assert(list.length > 0, "Directory list has entries");

  // Read Employee by ID
  const getRes = await fetch(`${baseUrl}/hrm/employees/${empA.id}`, { headers });
  const fetched = await getRes.json();
  assert(fetched.firstName === "John", "Retrieve by ID matches");

  // Update Employee (Optimistic concurrency check)
  const updateRes = await fetch(`${baseUrl}/hrm/employees/${empA.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      firstName: "Johnny",
      expectedVersion: empA.version,
    }),
  });
  assert(updateRes.status === 200 || updateRes.status === 201, "Update employee should succeed");
  const updatedEmp = await updateRes.json();
  assert(updatedEmp.firstName === "Johnny", "First name updated");

  // stale version check
  const badUpdateRes = await fetch(`${baseUrl}/hrm/employees/${empA.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      firstName: "Broken",
      expectedVersion: empA.version,
    }),
  });
  assert(badUpdateRes.status === 409, "Stale version must return Conflict");

  // Confirmation date validation
  const badConfirmationRes = await fetch(`${baseUrl}/hrm/employees/${empA.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      confirmationDate: "2025-12-31T00:00:00Z", // before joining date 2026-01-01
      expectedVersion: updatedEmp.version,
    }),
  });
  assert(badConfirmationRes.status === 400, "Confirmation date cannot be before joining date");

  // 3. Employee Status transitions
  console.log("Verifying Employee Status transitions...");
  const createEmpBRes = await fetch(`${baseUrl}/hrm/employees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeCode: "EMP002",
      firstName: "Alice",
      lastName: "Smith",
      email: "alice.smith@amdox.com",
      joiningDate: "2026-02-01T00:00:00Z",
    }),
  });
  const empB = await createEmpBRes.json();

  // Test Terminated/Resigned requires separationDate and separationReason
  const badTermRes = await fetch(`${baseUrl}/hrm/employees/${empB.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      status: EmployeeStatus.TERMINATED,
      expectedVersion: empB.version,
    }),
  });
  assert(badTermRes.status === 400, "Termination status must fail without separation parameters");

  // Successful status change to RESIGNED
  const resignedRes = await fetch(`${baseUrl}/hrm/employees/${empB.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      status: EmployeeStatus.RESIGNED,
      separationDate: "2026-06-01T00:00:00Z",
      separationReason: "Found a new opportunity",
      expectedVersion: empB.version,
    }),
  });
  assert(resignedRes.status === 200 || resignedRes.status === 201, "Transition to RESIGNED should succeed");
  const resignedEmp = await resignedRes.json();
  assert(resignedEmp.status === EmployeeStatus.RESIGNED, "Status changed to RESIGNED");

  // 4. Reporting Hierarchy cycles prevention
  console.log("Verifying Reporting Hierarchy cycles prevention...");
  const createEmpCRes = await fetch(`${baseUrl}/hrm/employees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeCode: "EMP003",
      firstName: "Bob",
      lastName: "Builder",
      email: "bob.builder@amdox.com",
      joiningDate: "2026-01-01T00:00:00Z",
    }),
  });
  const empC = await createEmpCRes.json();

  // Self reporting prevention
  const selfReportRes = await fetch(`${baseUrl}/hrm/employees/${empC.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      reportingManagerId: empC.id,
      expectedVersion: empC.version,
    }),
  });
  assert(selfReportRes.status === 400, "Self reporting manager must be blocked");

  // Setup C reporting to A
  const cToARes = await fetch(`${baseUrl}/hrm/employees/${empC.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      reportingManagerId: updatedEmp.id,
      expectedVersion: empC.version,
    }),
  });
  assert(cToARes.status === 200 || cToARes.status === 201, "C reports to A succeeds");
  const empC2 = await cToARes.json();

  // Attempt A reporting to C (circular)
  const circularRes = await fetch(`${baseUrl}/hrm/employees/${updatedEmp.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      reportingManagerId: empC.id,
      expectedVersion: updatedEmp.version,
    }),
  });
  assert(circularRes.status === 400, "Circular reporting hierarchy must be blocked");

  // 5. Employee Document Management
  console.log("Verifying Employee Document Management...");
  // create dummy media file in DB
  const mediaFile = await prisma.mediaFile.create({
    data: {
      tenantId: tenantIdA,
      uploadedBy: adminUser!.id,
      originalName: "passport.pdf",
      storedName: "stored_passport.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      size: 1024,
      type: MediaFileType.DOCUMENT,
      storageProvider: "local",
      storagePath: "uploads/passport.pdf",
      checksum: "abcde",
    },
  });

  const addDocRes = await fetch(`${baseUrl}/hrm/employees/${updatedEmp.id}/documents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      documentName: "Passport Copy",
      documentType: "ID",
      mediaFileId: mediaFile.id,
    }),
  });
  assert(addDocRes.status === 200 || addDocRes.status === 201, "Document attachment should succeed");
  const doc = await addDocRes.json();

  // Block duplicate document links
  const dupDocRes = await fetch(`${baseUrl}/hrm/employees/${updatedEmp.id}/documents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      documentName: "Passport Duplicate",
      documentType: "ID",
      mediaFileId: mediaFile.id,
    }),
  });
  assert(dupDocRes.status === 400, "Duplicate document link must be blocked");

  // Remove document link
  const deleteDocRes = await fetch(`${baseUrl}/hrm/employees/${updatedEmp.id}/documents/${doc.id}`, {
    method: "DELETE",
    headers,
  });
  assert(deleteDocRes.status === 200 || deleteDocRes.status === 201, "Document removal should succeed");

  // 6. Dashboard Widgets
  console.log("Verifying Dashboard Widgets...");
  const widgetRes = await fetch(`${baseUrl}/hrm/dashboard`, { headers });
  assert(widgetRes.status === 200, "Dashboard fetch succeeds");
  const widgets = await widgetRes.json();
  assert(widgets.totalEmployees === 3, "Dashboard calculated total employees correctly");
  assert(widgets.activeEmployees === 2, "Dashboard calculated active employees correctly");

  // 7. CSV Export
  console.log("Verifying CSV export...");
  const csvRes = await fetch(`${baseUrl}/hrm/employees?export=csv`, { headers });
  assert(csvRes.status === 200, "CSV export succeeds");
  const csvText = await csvRes.text();
  assert(csvText.includes("Employee Code,First Name,Last Name,Email,Phone,Department,Designation,Manager,Employment Type,Status,Joining Date,Confirmation Date,Separation Date"), "CSV columns match");

  // 8. Tenant Isolation
  console.log("Verifying Tenant Isolation...");
  const tenantIdB = "44444444-4444-4444-4444-444444444444";
  await prisma.tenant.upsert({
    where: { id: tenantIdB },
    update: {},
    create: { id: tenantIdB, name: "Tenant B Corp", slug: "tenant-b-hrm" },
  });

  const passwordHash = await argon2.hash("Password_1234_Special!");
  const userB = await prisma.user.upsert({
    where: { email: "userb_hrm@amdox.com" },
    update: { tenantId: tenantIdB, passwordHash },
    create: { email: "userb_hrm@amdox.com", username: "userb_hrm_admin", passwordHash, tenantId: tenantIdB },
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
      username: "userb_hrm@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  const loginBData = await loginBRes.json();
  const headersB = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginBData.accessToken}`,
  };

  const empsBRes = await fetch(`${baseUrl}/hrm/employees`, { headers: headersB });
  const empsB = await empsBRes.json();
  assert(empsB.length === 0, "Tenant B should see zero employees from Tenant A");

  const badGetRes = await fetch(`${baseUrl}/hrm/employees/${empA.id}`, { headers: headersB });
  assert(badGetRes.status === 404 || badGetRes.status === 403, "Tenant B cannot fetch Tenant A's employee");

  // 9. Health endpoint check
  console.log("Verifying health endpoint...");
  const healthRes = await fetch("http://localhost:3014/health");
  assert(healthRes.status === 200, "Health check must be online");

  console.log("==============================================");
  console.log("ALL HRM TESTS PASSED!");
  console.log("==============================================");

  await app.close();
  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test execution failed with error:", e);
  process.exit(1);
});
