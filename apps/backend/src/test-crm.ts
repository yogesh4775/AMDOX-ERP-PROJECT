/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, LeadStatus, LeadSource, OpportunityStage, CRMActivityType, MasterStatus } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for CRM integration E2E tests...");
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
  await app.listen(3013);

  const baseUrl = "http://localhost:3013/api";
  let adminToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Clean up database tables in order of dependencies
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
  await prisma.cRMActivity.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.cRMContact.deleteMany({});
  await prisma.cRMAccount.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.customer.deleteMany({});

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

  // 2. Lead CRUD
  console.log("Verifying Lead CRUD...");
  const createLeadRes = await fetch(`${baseUrl}/crm/leads`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      firstName: "John",
      lastName: "Doe",
      companyName: "Acme Corp",
      email: "john.doe@acme.com",
      phone: "+15550100",
      source: LeadSource.WEBSITE,
    }),
  });
  assert(createLeadRes.status === 200 || createLeadRes.status === 201, "Lead creation should succeed");
  const leadA = await createLeadRes.json();
  assert(leadA.status === LeadStatus.NEW, "Status defaults to NEW");

  // Email duplicate check
  const createDupRes = await fetch(`${baseUrl}/crm/leads`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: "john.doe@acme.com",
    }),
  });
  assert(createDupRes.status === 400, "Duplicate lead email must fail");

  // Read list
  const listLeadRes = await fetch(`${baseUrl}/crm/leads`, { headers });
  const listLeads = await listLeadRes.json();
  assert(listLeads.length > 0, "Lead list has entries");

  // Read by ID
  const getLeadRes = await fetch(`${baseUrl}/crm/leads/${leadA.id}`, { headers });
  const fetchedLead = await getLeadRes.json();
  assert(fetchedLead.companyName === "Acme Corp", "Retrieve by ID matches");

  // Update lead
  const updateLeadRes = await fetch(`${baseUrl}/crm/leads/${leadA.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      companyName: "Acme Industries",
      expectedVersion: leadA.version,
    }),
  });
  assert(updateLeadRes.status === 200 || updateLeadRes.status === 201, "Update lead should succeed");
  const updatedLead = await updateLeadRes.json();
  assert(updatedLead.companyName === "Acme Industries", "Lead fields updated");

  // Concurrency check
  const badUpdateLeadRes = await fetch(`${baseUrl}/crm/leads/${leadA.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      companyName: "Broken",
      expectedVersion: leadA.version, // stale version
    }),
  });
  assert(badUpdateLeadRes.status === 409, "Version mismatch should return Conflict");

  // 3. Contact & Account CRUD
  console.log("Verifying Contact & Account CRUD...");
  const createContactRes = await fetch(`${baseUrl}/crm/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@acme.com",
      phone: "+15550200",
      jobTitle: "Purchasing Manager",
    }),
  });
  assert(createContactRes.status === 200 || createContactRes.status === 201, "Contact creation should succeed");
  const contact = await createContactRes.json();

  const createAccountRes = await fetch(`${baseUrl}/crm/accounts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Acme Account",
      industry: "Manufacturing",
      website: "acme.com",
    }),
  });
  assert(createAccountRes.status === 200 || createAccountRes.status === 201, "Account creation should succeed");
  const account = await createAccountRes.json();

  // 4. Opportunity Management
  console.log("Verifying Opportunity Management...");
  const createOppRes = await fetch(`${baseUrl}/crm/opportunities`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Acme 1000 Widget Deal",
      leadId: leadA.id,
      contactId: contact.id,
      accountId: account.id,
      stage: OpportunityStage.QUALIFICATION,
      amount: 12000.00,
      probability: 25.0,
      expectedCloseDate: "2026-12-31T23:59:59Z",
    }),
  });
  assert(createOppRes.status === 200 || createOppRes.status === 201, "Opportunity creation should succeed");
  const opp = await createOppRes.json();

  // Validate probability range (0 to 100)
  const badOppRes = await fetch(`${baseUrl}/crm/opportunities`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Broken Deal",
      amount: 100.0,
      probability: 150.0, // Invalid probability
    }),
  });
  assert(badOppRes.status === 400, "Opportunity creation with invalid probability must fail");

  // Update Opportunity stage to WON
  const updateOppRes = await fetch(`${baseUrl}/crm/opportunities/${opp.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      stage: OpportunityStage.WON,
      expectedVersion: opp.version,
    }),
  });
  assert(updateOppRes.status === 200 || updateOppRes.status === 201, "Opportunity update to WON should succeed");
  const wonOpp = await updateOppRes.json();
  assert(wonOpp.stage === OpportunityStage.WON, "Opportunity status transitioned to WON");

  // WON/LOST opportunity is read-only
  const badWonUpdateRes = await fetch(`${baseUrl}/crm/opportunities/${opp.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      amount: 15000.00,
      expectedVersion: wonOpp.version,
    }),
  });
  assert(badWonUpdateRes.status === 400, "Direct edits to closed opportunities must be blocked");

  // 5. Activity Timeline
  console.log("Verifying CRM activity logs & timelines...");
  const createActRes = await fetch(`${baseUrl}/crm/activities`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      leadId: leadA.id,
      type: CRMActivityType.CALL,
      subject: "Initial Discovery Call",
      description: "Discussed requirements, customer requested pricing details.",
      activityDate: "2026-07-02T10:00:00Z",
    }),
  });
  assert(createActRes.status === 200 || createActRes.status === 201, "Activity log should succeed");

  const timelineRes = await fetch(`${baseUrl}/crm/leads/${leadA.id}/timeline`, { headers });
  const timeline = await timelineRes.json();
  assert(timeline.length > 0, "Consolidated timeline holds activities");

  // 6. Lead Conversion
  console.log("Verifying Lead Conversion...");
  const leadBRes = await fetch(`${baseUrl}/crm/leads`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      firstName: "Bob",
      lastName: "Builder",
      companyName: "Bob Construct",
      email: "bob@builder.com",
      phone: "+15550300",
    }),
  });
  const leadB = await leadBRes.json();

  const convertRes = await fetch(`${baseUrl}/crm/leads/${leadB.id}/convert`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      address: "123 Construction St",
    }),
  });
  assert(convertRes.status === 200 || convertRes.status === 201, "Lead conversion should succeed");
  const conversionResult = await convertRes.json();
  assert(conversionResult.lead.status === LeadStatus.CONVERTED, "Lead B marked CONVERTED");
  assert(!!conversionResult.lead.convertedCustomerId, "Lead B linked to a customer");

  // Verify customer was created in the DB
  const customer = await prisma.customer.findFirst({ where: { id: conversionResult.lead.convertedCustomerId } });
  assert(!!customer, "Customer must exist in database");
  assert(customer!.email === "bob@builder.com", "Customer mapping contains lead details");

  // Converted lead is read-only
  const convertEditRes = await fetch(`${baseUrl}/crm/leads/${leadB.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      companyName: "New Name",
      expectedVersion: conversionResult.lead.version,
    }),
  });
  assert(convertEditRes.status === 400, "Further modifications to converted leads must be blocked");

  // Double conversion blocked
  const doubleConvertRes = await fetch(`${baseUrl}/crm/leads/${leadB.id}/convert`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  assert(doubleConvertRes.status === 400, "Double lead conversion must be blocked");

  // 7. Dashboard Widgets
  console.log("Verifying Dashboard Widgets...");
  const widgetRes = await fetch(`${baseUrl}/crm/dashboard`, { headers });
  assert(widgetRes.status === 200, "Dashboard fetch succeeds");
  const widgets = await widgetRes.json();
  assert(widgets.totalLeads === 2, "Dashboard calculated total leads correctly");
  assert(widgets.conversionRate === 50.0, "Dashboard calculated conversion rate correctly");

  // 8. CSV export
  console.log("Verifying CSV export...");
  const csvRes = await fetch(`${baseUrl}/crm/opportunities?export=csv`, { headers });
  assert(csvRes.status === 200, "CSV export succeeds");
  const csvText = await csvRes.text();
  assert(csvText.includes("ID,Name,Stage,Amount,Probability %,Forecast Value,Close Date"), "CSV columns match");

  // 9. Tenant Isolation
  console.log("Verifying Tenant Isolation...");
  const tenantIdB = "33333333-3333-3333-3333-333333333333";
  await prisma.tenant.upsert({
    where: { id: tenantIdB },
    update: {},
    create: { id: tenantIdB, name: "Tenant B Corp", slug: "tenant-b-crm" },
  });

  const passwordHash = await argon2.hash("Password_1234_Special!");
  const userB = await prisma.user.upsert({
    where: { email: "userb_crm@amdox.com" },
    update: { tenantId: tenantIdB, passwordHash },
    create: { email: "userb_crm@amdox.com", username: "userb_crm_admin", passwordHash, tenantId: tenantIdB },
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
      username: "userb_crm@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  const loginBData = await loginBRes.json();
  const headersB = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginBData.accessToken}`,
  };

  const leadsBRes = await fetch(`${baseUrl}/crm/leads`, { headers: headersB });
  const leadsB = await leadsBRes.json();
  assert(leadsB.length === 0, "Tenant B should see zero leads from Tenant A");

  const badGetLead = await fetch(`${baseUrl}/crm/leads/${leadA.id}`, { headers: headersB });
  assert(badGetLead.status === 404 || badGetLead.status === 403, "Tenant B cannot fetch Tenant A's lead");

  // 10. Health endpoint check
  console.log("Verifying health endpoint...");
  const healthRes = await fetch("http://localhost:3013/health");
  assert(healthRes.status === 200, "Health check must be online");

  console.log("==============================================");
  console.log("ALL CRM TESTS PASSED!");
  console.log("==============================================");

  await app.close();
  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test execution failed with error:", e);
  process.exit(1);
});
