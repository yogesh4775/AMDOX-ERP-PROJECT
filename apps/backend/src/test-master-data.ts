/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log(
    "Starting NestJS application for Master Data integration tests...",
  );
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
  await app.listen(3002);

  const baseUrl = "http://localhost:3002/api";
  let adminToken = "";
  const suffix = ` ${Date.now()}`;

  // 1. Authenticate Admin User
  console.log("Authenticating Admin...");
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginRes.status === 201, "Admin login should succeed");
  const loginData = (await loginRes.json()) as { accessToken: string };
  adminToken = loginData.accessToken;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  // Helper assertion
  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // TEST: DEPARTMENT CRUD (Tenant Isolation, Concurrency & Soft Delete)
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Department CRUD ---");

  // Create
  const createDeptRes = await fetch(`${baseUrl}/master-data/departments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Engineering Dept" + suffix,
      code: "ENG01",
      description: "Engineering Department",
    }),
  });
  assert(createDeptRes.status === 201, "Create department should succeed");
  const dept = (await createDeptRes.json()) as { id: string; version: number };
  assert(dept.id !== undefined, "Department ID is defined");
  assert(dept.version === 1, "Initial version is 1");

  // Read Single
  const getDeptRes = await fetch(
    `${baseUrl}/master-data/departments/${dept.id}`,
    { headers },
  );
  assert(getDeptRes.status === 200, "Get department should succeed");

  // Update (Success)
  const updateDeptRes = await fetch(
    `${baseUrl}/master-data/departments/${dept.id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Engineering and R&D" + suffix,
        expectedVersion: 1,
      }),
    },
  );
  assert(updateDeptRes.status === 200, "Update department should succeed");
  const updatedDept = (await updateDeptRes.json()) as { version: number };
  assert(updatedDept.version === 2, "Version incremented to 2");

  // Update (Concurrency Conflict)
  const conflictUpdateDeptRes = await fetch(
    `${baseUrl}/master-data/departments/${dept.id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Conflict Name",
        expectedVersion: 1, // Stale version
      }),
    },
  );
  assert(
    conflictUpdateDeptRes.status === 409,
    "Update with mismatched expectedVersion must return conflict error",
  );

  // List / Pagination / Sorting / Filtering
  const listDeptRes = await fetch(
    `${baseUrl}/master-data/departments?name=Engineering&sort=name&order=asc`,
    { headers },
  );
  assert(listDeptRes.status === 200, "List departments should succeed");
  const listDeptData = (await listDeptRes.json()) as { data: any[]; meta: any };
  assert(
    listDeptData.data.length >= 1,
    "Listing should return the created department",
  );

  // Soft Delete
  const deleteDeptRes = await fetch(
    `${baseUrl}/master-data/departments/${dept.id}`,
    {
      method: "DELETE",
      headers,
      body: JSON.stringify({ expectedVersion: 2 }),
    },
  );
  assert(deleteDeptRes.status === 200, "Delete department should succeed");

  // Verify Soft Deleted from listing
  const listActiveDeptRes = await fetch(`${baseUrl}/master-data/departments`, {
    headers,
  });
  const activeDepts = (await listActiveDeptRes.json()) as { data: any[] };
  assert(
    activeDepts.data.every((d) => d.id !== dept.id),
    "Deleted department should not appear in active list",
  );

  // Verify can be restored
  const restoreDeptRes = await fetch(
    `${baseUrl}/master-data/departments/${dept.id}/restore`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ expectedVersion: 3 }),
    },
  );
  assert(restoreDeptRes.status === 200, "Restore department should succeed");

  // Delete again for audit verification later
  await fetch(`${baseUrl}/master-data/departments/${dept.id}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ expectedVersion: 4 }),
  });

  // ---------------------------------------------------------------------------
  // TEST: DESIGNATION CRUD
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Designation CRUD ---");

  const createDesigRes = await fetch(`${baseUrl}/master-data/designations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Software Engineer" + suffix,
      code: "SWE",
    }),
  });
  assert(createDesigRes.status === 201, "Create designation should succeed");
  const desig = (await createDesigRes.json()) as {
    id: string;
    version: number;
  };

  const deleteDesigRes = await fetch(
    `${baseUrl}/master-data/designations/${desig.id}`,
    {
      method: "DELETE",
      headers,
      body: JSON.stringify({ expectedVersion: 1 }),
    },
  );
  assert(deleteDesigRes.status === 200, "Delete designation should succeed");

  // ---------------------------------------------------------------------------
  // TEST: UNIT CRUD
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Unit CRUD ---");

  const createUnitRes = await fetch(`${baseUrl}/master-data/units`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Kilogram" + suffix,
      symbol: "kg",
    }),
  });
  assert(createUnitRes.status === 201, "Create unit should succeed");
  const unit = (await createUnitRes.json()) as { id: string; symbol: string };
  assert(unit.symbol === "kg", "Symbol mapped correctly");

  const deleteUnitRes = await fetch(`${baseUrl}/master-data/units/${unit.id}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert(deleteUnitRes.status === 200, "Delete unit should succeed");

  // ---------------------------------------------------------------------------
  // TEST: CATEGORY CRUD (Hierarchy and Deletion Rejection)
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Category CRUD ---");

  const createCatRes = await fetch(`${baseUrl}/master-data/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Electronics" + suffix,
    }),
  });
  assert(createCatRes.status === 201, "Create category should succeed");
  const cat = (await createCatRes.json()) as { id: string };

  // Subcategory
  const createSubcatRes = await fetch(`${baseUrl}/master-data/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Laptops" + suffix,
      parentCategoryId: cat.id,
    }),
  });
  assert(createSubcatRes.status === 201, "Create subcategory should succeed");
  const subcat = (await createSubcatRes.json()) as {
    id: string;
    parentCategoryId: string;
  };
  assert(subcat.parentCategoryId === cat.id, "Subcategory linked to parent");

  // Try to delete parent category (should be rejected since active subcategory exists)
  const deleteParentCatRes = await fetch(
    `${baseUrl}/master-data/categories/${cat.id}`,
    {
      method: "DELETE",
      headers,
      body: JSON.stringify({ expectedVersion: 1 }),
    },
  );
  assert(
    deleteParentCatRes.status === 400,
    "Deleting category with active subcategories must be rejected",
  );

  // Delete subcategory first
  const deleteSubcatRes = await fetch(
    `${baseUrl}/master-data/categories/${subcat.id}`,
    {
      method: "DELETE",
      headers,
      body: JSON.stringify({ expectedVersion: 1 }),
    },
  );
  assert(deleteSubcatRes.status === 200, "Delete subcategory should succeed");

  // Now delete parent category
  const deleteParentCatSuccessRes = await fetch(
    `${baseUrl}/master-data/categories/${cat.id}`,
    {
      method: "DELETE",
      headers,
      body: JSON.stringify({ expectedVersion: 1 }),
    },
  );
  assert(
    deleteParentCatSuccessRes.status === 200,
    "Delete category should succeed now",
  );

  // ---------------------------------------------------------------------------
  // TEST: TAX CATEGORY CRUD (Default Toggle swaps)
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Tax Category CRUD ---");

  const createTax1Res = await fetch(`${baseUrl}/master-data/tax-categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Standard VAT" + suffix,
      rate: 18.5,
      isDefault: true,
    }),
  });
  assert(createTax1Res.status === 201, "Create tax category 1 should succeed");
  const tax1 = (await createTax1Res.json()) as {
    id: string;
    rate: string;
    isDefault: boolean;
  };
  assert(tax1.isDefault === true, "Tax category 1 is default");

  const createTax2Res = await fetch(`${baseUrl}/master-data/tax-categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Zero VAT" + suffix,
      rate: 0,
      isDefault: true, // Should swap default
    }),
  });
  assert(createTax2Res.status === 201, "Create tax category 2 should succeed");
  const tax2 = (await createTax2Res.json()) as {
    id: string;
    isDefault: boolean;
  };
  assert(tax2.isDefault === true, "Tax category 2 is now default");

  // Verify tax1.isDefault is now false
  const getTax1Res = await fetch(
    `${baseUrl}/master-data/tax-categories/${tax1.id}`,
    { headers },
  );
  const fetchedTax1 = (await getTax1Res.json()) as { isDefault: boolean };
  assert(fetchedTax1.isDefault === false, "Default flag was swapped off tax1");

  // Clean up
  await fetch(`${baseUrl}/master-data/tax-categories/${tax1.id}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  await fetch(`${baseUrl}/master-data/tax-categories/${tax2.id}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ expectedVersion: 1 }),
  });

  // ---------------------------------------------------------------------------
  // TEST: WAREHOUSE CRUD
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Warehouse CRUD ---");

  const createWhRes = await fetch(`${baseUrl}/master-data/warehouses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Central Warehouse" + suffix,
      code: "CWH01",
      address: "123 ERP Boulevard",
      contactPerson: "John Doe",
      phone: "+15550199",
      email: "warehouse1@amdox.com",
    }),
  });
  assert(createWhRes.status === 201, "Create warehouse should succeed");
  const wh = (await createWhRes.json()) as { id: string };

  const deleteWhRes = await fetch(
    `${baseUrl}/master-data/warehouses/${wh.id}`,
    {
      method: "DELETE",
      headers,
      body: JSON.stringify({ expectedVersion: 1 }),
    },
  );
  assert(deleteWhRes.status === 200, "Delete warehouse should succeed");

  // ---------------------------------------------------------------------------
  // TEST: TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Tenant Isolation ---");
  // Create another tenant in the database, and try to query/mutate across boundaries.
  const secondaryTenantId = "11111111-1111-1111-1111-111111111111";
  await prisma.tenant.upsert({
    where: { id: secondaryTenantId },
    update: { deletedAt: null },
    create: {
      id: secondaryTenantId,
      name: "Tenant B",
      slug: "tenant-b",
    },
  });

  // Create a user in Tenant B
  const secondaryUserEmail = "user.b@amdox.com";
  const hashedPw = await prisma.user
    .findFirst({ where: { email: "admin@amdox.com" } })
    .then((u) => u!.passwordHash);
  const secondaryUser = await prisma.user.upsert({
    where: { email: secondaryUserEmail },
    update: { deletedAt: null },
    create: {
      id: "22222222-2222-2222-2222-222222222222",
      email: secondaryUserEmail,
      username: "user_b",
      passwordHash: hashedPw,
      tenantId: secondaryTenantId,
    },
  });

  // Link Admin role for Tenant B to perform commands
  const secondaryRole = await prisma.role.upsert({
    where: { name_tenantId: { name: "Admin", tenantId: secondaryTenantId } },
    update: {},
    create: { name: "Admin", tenantId: secondaryTenantId },
  });

  // Link permissions
  const permissions = await prisma.permission.findMany();
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: secondaryRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: { roleId: secondaryRole.id, permissionId: perm.id },
    });
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: secondaryUser.id, roleId: secondaryRole.id },
    },
    update: {},
    create: {
      userId: secondaryUser.id,
      roleId: secondaryRole.id,
      tenantId: secondaryTenantId,
    },
  });

  // Login Tenant B user
  const loginBRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: secondaryUserEmail,
      password: "Password_1234_Special!",
    }),
  });
  const loginBData = (await loginBRes.json()) as { accessToken: string };
  const tenantBHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginBData.accessToken}`,
  };

  // Try to create a department on Tenant B with the same name "Engineering Dept"
  // (Should succeed because name uniqueness constraint is tenant-scoped!)
  const createDeptBRes = await fetch(`${baseUrl}/master-data/departments`, {
    method: "POST",
    headers: tenantBHeaders,
    body: JSON.stringify({
      name: "Engineering Dept" + suffix,
    }),
  });
  assert(
    createDeptBRes.status === 201,
    'Tenant B should be able to create a department with name "Engineering Dept"',
  );

  // Try to update Tenant B's department using Admin token (Tenant A) -> expect 403 Forbidden or 404 Not Found
  const deptB = (await createDeptBRes.json()) as { id: string };
  const crossTenantUpdateRes = await fetch(
    `${baseUrl}/master-data/departments/${deptB.id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Hack Name",
        expectedVersion: 1,
      }),
    },
  );
  assert(
    crossTenantUpdateRes.status === 403 || crossTenantUpdateRes.status === 404,
    "Cross-tenant update must be rejected",
  );

  // ---------------------------------------------------------------------------
  // TEST: AUDIT LOGS VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Audit Logs ---");
  // Check if DEPARTMENT_CREATED, DEPARTMENT_UPDATED, DEPARTMENT_DELETED, etc are recorded
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "DEPARTMENT_CREATED",
          "DEPARTMENT_UPDATED",
          "DEPARTMENT_DELETED",
          "DEPARTMENT_RESTORED",
          "DESIGNATION_CREATED",
          "UNIT_CREATED",
          "CATEGORY_CREATED",
          "TAX_CATEGORY_CREATED",
          "WAREHOUSE_CREATED",
        ],
      },
    },
  });

  assert(
    auditLogs.some((log) => log.action === "DEPARTMENT_CREATED"),
    "DEPARTMENT_CREATED log exists",
  );
  assert(
    auditLogs.some((log) => log.action === "DEPARTMENT_UPDATED"),
    "DEPARTMENT_UPDATED log exists",
  );
  assert(
    auditLogs.some((log) => log.action === "DEPARTMENT_DELETED"),
    "DEPARTMENT_DELETED log exists",
  );
  assert(
    auditLogs.some((log) => log.action === "DEPARTMENT_RESTORED"),
    "DEPARTMENT_RESTORED log exists",
  );
  assert(
    auditLogs.some((log) => log.action === "DESIGNATION_CREATED"),
    "DESIGNATION_CREATED log exists",
  );
  assert(
    auditLogs.some((log) => log.action === "UNIT_CREATED"),
    "UNIT_CREATED log exists",
  );
  assert(
    auditLogs.some((log) => log.action === "CATEGORY_CREATED"),
    "CATEGORY_CREATED log exists",
  );
  assert(
    auditLogs.some((log) => log.action === "TAX_CATEGORY_CREATED"),
    "TAX_CATEGORY_CREATED log exists",
  );
  assert(
    auditLogs.some((log) => log.action === "WAREHOUSE_CREATED"),
    "WAREHOUSE_CREATED log exists",
  );

  // ---------------------------------------------------------------------------
  // TEST: HEALTH ENDPOINT UNCHANGED
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Health Endpoint ---");
  const healthRes = await fetch(`http://localhost:3002/health`);
  if (healthRes.status !== 200) {
    console.error(
      "Health check failed with status:",
      healthRes.status,
      await healthRes.text(),
    );
  }
  assert(healthRes.status === 200, "Health endpoint must remain functional");

  console.log("\nAll integration tests passed successfully! 🚀");

  await app.close();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error("Integration tests failed:", err);
  process.exit(1);
});
