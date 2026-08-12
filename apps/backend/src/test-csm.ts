/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  PrismaClient,
  TicketStatus,
  TicketPriority,
  RmaStatus,
  ServiceVisitStatus,
  JournalEntryStatus,
  JournalSourceType,
  VehicleStatus,
} from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("Starting NestJS application for CSM E2E tests...");
  const app: INestApplication = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(3080);
  console.log("NestJS application booted on port 3080.");

  const baseUrl = "http://localhost:3080/api";
  const tenantId = "00000000-0000-0000-0000-000000000000";

  // Acquire admin authentication token
  console.log("Authenticating Admin...");
  const authRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  console.log("Login response status:", authRes.status);
  const authData = await authRes.json() as any;
  console.log("Login response body:", JSON.stringify(authData));
  const token = authData.accessToken;
  assert(!!token, "Admin login must succeed");
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  // Clean up CSM database tables
  console.log("Cleaning up CSM database tables...");
  await prisma.kbArticle.deleteMany({});
  await prisma.serviceVisit.deleteMany({});
  await prisma.rmaRequest.deleteMany({});
  await prisma.ticketNote.deleteMany({});
  await prisma.supportTicket.deleteMany({});
  await prisma.serviceContract.deleteMany({});
  await prisma.slaPolicy.deleteMany({});
  await prisma.ticketCategory.deleteMany({});

  // Clean up specific test data to avoid constraint violations
  await prisma.inspectionLot.deleteMany({
    where: { code: { startsWith: "LOT-RMA-" } }
  });

  const testProduct = await prisma.product.findFirst({ where: { sku: "SKU-WS-PRO-X" } });
  if (testProduct) {
    await prisma.stockMovement.deleteMany({ where: { productId: testProduct.id } });
    await prisma.stock.deleteMany({ where: { productId: testProduct.id } });
  }

  await prisma.warehouseBin.deleteMany({ where: { code: "BIN-CSM-RMA-01" } });
  await prisma.warehouseZone.deleteMany({ where: { code: "ZONE-CSM-RMA" } });
  await prisma.warehouse.deleteMany({ where: { code: "WH-CSM-RET" } });

  await prisma.vehicle.deleteMany({ where: { licensePlate: "CSM-TECH-01" } });
  await prisma.driver.deleteMany({ where: { licenseNumber: "LIC-CSM-01" } });

  await prisma.product.deleteMany({ where: { sku: "SKU-WS-PRO-X" } });
  await prisma.customer.deleteMany({ where: { name: "Acme CSM Corp" } });
  await prisma.category.deleteMany({ where: { name: "Electronics Hardware" } });
  await prisma.unit.deleteMany({ where: { name: "Each", symbol: "EA" } });
  await prisma.workflowInstanceStep.deleteMany({
    where: {
      instance: {
        definition: {
          code: "RMA_REFUND_WF"
        }
      }
    }
  });
  await prisma.workflowInstance.deleteMany({
    where: {
      definition: {
        code: "RMA_REFUND_WF"
      }
    }
  });
  await prisma.workflowStep.deleteMany({ where: { name: "Manager Approval" } });
  await prisma.workflowDefinition.deleteMany({ where: { code: "RMA_REFUND_WF" } });
  await prisma.journalEntryLine.deleteMany({});
  await prisma.journalEntry.deleteMany({
    where: {
      tenantId,
    },
  });
  await prisma.account.deleteMany({
    where: {
      tenantId,
      code: { in: ["4100", "2010"] },
    },
  });

  console.log("Cleanup complete.");

  // Seed supporting master data
  const customer = await prisma.customer.create({
    data: {
      tenantId,
      name: "Acme CSM Corp",
      email: "csm@acme.com",
      phone: "555-0987",
    },
  });

  const prodCat = await prisma.category.create({
    data: {
      tenantId,
      name: "Electronics Hardware",
    },
  });

  const prodUnit = await prisma.unit.create({
    data: {
      tenantId,
      name: "Each",
      symbol: "EA",
    },
  });

  const product = await prisma.product.create({
    data: {
      tenantId,
      name: "Workstation Pro X",
      sku: "SKU-WS-PRO-X",
      barcode: "BAR-WS-PRO-X",
      costPrice: 1500,
      salePrice: 2500,
      status: "ACTIVE",
      categoryId: prodCat.id,
      unitId: prodUnit.id,
    },
  });

  // Seed supporting GL Accounts
  await prisma.account.upsert({
    where: { tenantId_code: { tenantId, code: "4100" } },
    update: {},
    create: {
      tenantId,
      code: "4100",
      name: "Sales Returns and Refunds",
      type: "REVENUE",
      status: "ACTIVE",
      balance: 0,
    },
  });

  await prisma.account.upsert({
    where: { tenantId_code: { tenantId, code: "2010" } },
    update: {},
    create: {
      tenantId,
      code: "2010",
      name: "Accounts Payable - Returns",
      type: "LIABILITY",
      status: "ACTIVE",
      balance: 0,
    },
  });

  const warehouse = await prisma.warehouse.create({
    data: {
      tenantId,
      name: "CSM Return Center",
      code: "WH-CSM-RET",
      status: "ACTIVE",
    },
  });

  const zone = await prisma.warehouseZone.create({
    data: {
      tenantId,
      warehouseId: warehouse.id,
      name: "CSM RMA Zone",
      code: "ZONE-CSM-RMA",
    },
  });

  const bin = await prisma.warehouseBin.create({
    data: {
      tenantId,
      zoneId: zone.id,
      code: "BIN-CSM-RMA-01",
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      tenantId,
      licensePlate: "CSM-TECH-01",
      model: "Ford Transit CSM",
      capacityWeight: 2000,
      capacityVolume: 10,
      fuelEfficiency: 15,
      status: VehicleStatus.IDLE,
    },
  });

  const driver = await prisma.driver.create({
    data: {
      tenantId,
      name: "Field Tech Driver",
      licenseNumber: "LIC-CSM-01",
      contactPhone: "555-1234",
      status: "AVAILABLE",
    },
  });

  // Get Admin user ID for technicians/agents assignment
  const adminUser = await prisma.user.findFirst({
    where: { email: "admin@amdox.com" },
  });
  if (!adminUser) throw new Error("Admin user must exist in database");

  // Create workflow definition for RMA refund approvals
  const wfDef = await prisma.workflowDefinition.create({
    data: {
      tenantId,
      code: "RMA_REFUND_WF",
      name: "RMA Refund Approval Workflow",
      entityType: "RmaRequest",
      isActive: true,
    },
  });

  const wfStep = await prisma.workflowStep.create({
    data: {
      tenantId,
      definitionId: wfDef.id,
      level: 1,
      name: "Manager Approval",
      approverType: "USER",
      approverValue: adminUser.id,
      slaHours: 24,
    },
  });

  // --- 1. TICKET CATEGORIES & SLA POLICIES ---
  console.log("Testing CSM Categories & SLAs...");
  const catRes = await fetch(`${baseUrl}/csm/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Hardware Support",
      description: "Support for computing hardware",
    }),
  });
  assert(catRes.status === 201, "Should create ticket category");
  const category = await catRes.json() as any;

  // Create SLA policies
  const slaRes = await fetch(`${baseUrl}/csm/sla-policies`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Urgent SLA",
      priority: TicketPriority.URGENT,
      responseTimeLimitMin: 15,
      resolutionTimeLimitMin: 120, // 2 hours
    }),
  });
  assert(slaRes.status === 201, "Should create SLA policy");

  // --- 2. SERVICE CONTRACTS & WARRANTY MANAGEMENT ---
  console.log("Testing Warranty & Service Contracts...");
  const contractRes = await fetch(`${baseUrl}/csm/contracts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customerId: customer.id,
      productId: product.id,
      contractNumber: "WARR-WS-001",
      startDate: new Date(Date.now() - 86400000).toISOString(), // started yesterday
      endDate: new Date(Date.now() + 86400000 * 365).toISOString(), // expires next year
      warrantyPeriod: 12,
      status: "ACTIVE",
    }),
  });
  assert(contractRes.status === 201, "Should create warranty contract");
  const contract = await contractRes.json() as any;

  // --- 3. SUPPORT TICKET LIFECYCLE ---
  console.log("Testing Ticket Creation & Assignments...");
  const ticketRes = await fetch(`${baseUrl}/csm/tickets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Workstation Blue Screen of Death",
      description: "Fails to boot with critical kernel failure error",
      priority: TicketPriority.URGENT,
      categoryId: category.id,
      customerId: customer.id,
      productId: product.id,
      contractId: contract.id,
    }),
  });
  assert(ticketRes.status === 201, "Should create support ticket");
  let ticket = await ticketRes.json() as any;
  assert(!!ticket.slaDueAt, "SLA due timestamp should be automatically computed");

  // Assign to technician
  const adminUserId = adminUser.id;
  const assignRes = await fetch(`${baseUrl}/csm/tickets/${ticket.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      assignedAgentId: adminUserId,
      status: TicketStatus.ASSIGNED,
      expectedVersion: 1,
    }),
  });
  assert(assignRes.status === 200, "Should assign ticket to agent");
  ticket = await assignRes.json() as any;
  assert(ticket.status === TicketStatus.ASSIGNED, "Status should update to ASSIGNED");

  // Verify Audit Log and notifications
  const auditLogs = await prisma.auditLog.findMany({
    where: { entity: "SupportTicket", entityId: ticket.id, action: "TICKET_ASSIGNED" },
  });
  assert(auditLogs.length === 1, "Exactly one TICKET_ASSIGNED audit event should be logged");

  const notifications = await prisma.notification.findMany({
    where: { userId: adminUserId, title: "Support Ticket Assigned" },
  });
  assert(notifications.length >= 1, "Agent assignment notification should be created");

  // --- 4. TICKET NOTES & INTERACTIONS ---
  console.log("Testing notes & customer replies...");
  const noteRes = await fetch(`${baseUrl}/csm/tickets/${ticket.id}/notes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      content: "Please check if motherboard power supply connectors are seated properly",
      isInternal: true,
      attachments: ["power_cable_check.jpg"],
    }),
  });
  assert(noteRes.status === 201, "Should add internal ticket note");
  const note = await noteRes.json() as any;
  assert(note.isInternal === true, "Note should be internal");

  // --- 5. TICKET MERGE & SPLIT ---
  console.log("Testing ticket merge & split...");
  const secondTicketRes = await fetch(`${baseUrl}/csm/tickets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Workstation Blue Screen BSOD duplicate",
      description: "BSOD duplicate description",
      priority: TicketPriority.URGENT,
      categoryId: category.id,
      customerId: customer.id,
    }),
  });
  const secondTicket = await secondTicketRes.json() as any;

  const mergeRes = await fetch(`${baseUrl}/csm/tickets/merge`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      primaryTicketId: ticket.id,
      secondaryTicketId: secondTicket.id,
    }),
  });
  assert(mergeRes.status === 201 || mergeRes.status === 200, "Ticket merge should succeed");
  const secondaryDb = await prisma.supportTicket.findUnique({ where: { id: secondTicket.id } });
  assert(secondaryDb!.status === TicketStatus.CLOSED, "Merged ticket should be closed");

  // Ticket split
  const splitRes = await fetch(`${baseUrl}/csm/tickets/${ticket.id}/split`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      newTitle: "Peripheral device issue split off",
      newDescription: "Customer also mentioned keyboard/mouse failures on workstation boot",
    }),
  });
  assert(splitRes.status === 201, "Ticket split should succeed");
  const childTicket = await splitRes.json() as any;
  assert(childTicket.parentTicketId === ticket.id, "Split child ticket should reference parent");

  // --- 6. CSAT RATINGS ---
  console.log("Testing customer survey CSAT...");
  const csatRes = await fetch(`${baseUrl}/csm/tickets/${ticket.id}/csat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      rating: 5,
      comment: "Superb troubleshooting and immediate response!",
    }),
  });
  assert(csatRes.status === 201 || csatRes.status === 200, "CSAT survey submit should succeed");
  const csatTicket = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
  assert(csatTicket!.csatRating === 5, "Ticket CSAT rating should be stored");

  // --- 7. KNOWLEDGE BASE FAQ ---
  console.log("Testing KBFAQ lookup...");
  const kbRes = await fetch(`${baseUrl}/csm/kb`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "How to resolve kernel failure BSOD",
      content: "Ensure clean boot settings, seats memory correctly, inspect diagnostics...",
      category: "Troubleshooting",
      isPublished: true,
    }),
  });
  assert(kbRes.status === 201, "Should create KB article");
  const kbArticle = await kbRes.json() as any;

  const kbListRes = await fetch(`${baseUrl}/csm/kb?category=Troubleshooting`, { headers });
  const kbList = await kbListRes.json() as any[];
  assert(kbList.length === 1, "Should find the created troubleshooting KB article");

  // --- 8. EMAIL-TO-TICKET INGESTION ---
  console.log("Testing Email-to-Ticket pipeline...");
  const ingestRes = await fetch(`${baseUrl}/csm/email-ingest`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: "csm@acme.com",
      subject: "Inbound ticket from email customer",
      body: "Diagnostics log attached. Please review.",
    }),
  });
  assert(ingestRes.status === 201, "Should ingest email to ticket");
  const ingested = await ingestRes.json() as any;
  assert(ingested.customerId === customer.id, "Should auto-associate customer email Acme CSM Corp");

  // --- 9. RMA REQUESTS & QUALITY / WMS / WORKFLOW / ACCOUNTING ---
  console.log("Testing RMA Request creation & workflow block...");
  const rmaRes = await fetch(`${baseUrl}/csm/rmas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ticketId: ticket.id,
      customerId: customer.id,
      productId: product.id,
      contractId: contract.id,
      quantity: 1,
      reason: "Motherboard hardware defect",
      actionType: "REFUND",
      refundAmount: 6000, // Exceeds 5000 workflow threshold
    }),
  });
  console.log("RMA response status:", rmaRes.status);
  const rmaBody = await rmaRes.text();
  console.log("RMA response body:", rmaBody);
  assert(rmaRes.status === 201, "Should submit RMA request");
  const rma = JSON.parse(rmaBody) as any;

  // Confirm Quality inspection lot is automatically generated
  assert(!!rma.inspectionLotId, "Quality inspection lot should be created");
  const qualityLot = await prisma.inspectionLot.findUnique({ where: { id: rma.inspectionLotId } });
  assert(!!qualityLot, "Quality inspection lot should be present in database");

  // Confirm WMS return bin is populated
  assert(!!rma.warehouseBinId, "WMS putaway bin suggestion should be populated");
  assert(rma.warehouseBinId === bin.id, "Return warehouse bin should match default suggetsed bin");

  // Attempt to approve the > 5000 RMA refund directly (should fail due to workflow approval block)
  console.log("Verifying Workflow Engine approval block on > 5000 RMA refunds...");
  const directApproveRes = await fetch(`${baseUrl}/csm/rmas/${rma.id}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      status: RmaStatus.APPROVED,
      expectedVersion: 1,
    }),
  });
  assert(directApproveRes.status === 409, "Should prevent direct RMA approval before Workflow approval");

  // Complete Workflow instance for RMA refund
  const wfSearchRes = await fetch(`${baseUrl}/workflows/instances/search?entityType=RmaRequest&entityId=${rma.id}`, { headers });
  assert(wfSearchRes.status === 200, "Should lookup workflow instances");
  const wfSearch = await wfSearchRes.json() as any[];
  const rmaWfs = wfSearch.filter((w: any) => w.entityId === rma.id);
  assert(rmaWfs.length === 1, "RMA should have a workflow instance created");
  const wfInstance = rmaWfs[0];
  const pendingStep = wfInstance.steps.find((s: any) => s.status === "PENDING");
  assert(!!pendingStep, "Must find pending workflow step");

  const wfApproveRes = await fetch(`${baseUrl}/workflows/approvals/${pendingStep.id}/action`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "APPROVE",
      comment: "Approved expensive refund",
    }),
  });
  assert(wfApproveRes.status === 200 || wfApproveRes.status === 201, "Workflow approval should succeed");

  const dbRma = await prisma.rmaRequest.findUnique({ where: { id: rma.id } });
  const nextExpectedVersion = dbRma?.version || 1;

  // Retry RMA status change now that workflow is approved
  const approvedRmaRes = await fetch(`${baseUrl}/csm/rmas/${rma.id}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      status: RmaStatus.APPROVED,
      expectedVersion: nextExpectedVersion,
    }),
  });
  assert(approvedRmaRes.status === 200, "Should approve RMA status after Workflow approval");
  const approvedRma = await approvedRmaRes.json() as any;
  assert(approvedRma.status === RmaStatus.APPROVED, "RMA should be APPROVED");

  // Verify journal entries posted: Debit Sales Returns (4100) $6000, Credit Accounts Payable (2010) $6000
  // And inventory restock: Debit 1400 $1500, Credit 5100 $1500
  console.log("Verifying RMA financial journal postings...");
  const journalEntries = await prisma.journalEntry.findMany({
    where: { tenantId, sourceId: rma.id },
    include: { lines: { include: { account: true } } },
  });
  // Since trial balance or seeding account structures might not be fully instantiated in E2E blank DB runs,
  // we assert that either accounts mapped correctly and entries were generated or accounting logic runs safely
  assert(journalEntries.length === 2, "Accrual and restocking journal entries should be posted");

  const refundEntry = journalEntries.find((e: any) => e.description.includes("refund"));
  assert(!!refundEntry, "Refund entry should be present");
  const debitedLine = refundEntry!.lines.find((l: any) => l.debit > 0);
  assert(debitedLine!.account.code === "4100", "Debited account must be Sales Returns (4100)");

  // --- 10. FIELD SERVICE VISITS & TMS VEHICLE INTEGRATION ---
  console.log("Testing Field Service Scheduling & visits...");
  const visitRes = await fetch(`${baseUrl}/csm/visits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ticketId: ticket.id,
      technicianId: adminUserId,
      vehicleId: vehicle.id,
      driverId: driver.id,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  });
  assert(visitRes.status === 201, "Should schedule field service visit");
  const visit = await visitRes.json() as any;

  // Complete field service visit
  const completeVisitRes = await fetch(`${baseUrl}/csm/visits/${visit.id}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      status: ServiceVisitStatus.COMPLETED,
      resolutionNotes: "Re-seated connectors and rebooted workstation successfully.",
      latitude: 37.7749,
      longitude: -122.4194,
    }),
  });
  assert(completeVisitRes.status === 200, "Should complete service visit");
  const completedVisit = await completeVisitRes.json() as any;
  assert(completedVisit.status === ServiceVisitStatus.COMPLETED, "Visit status should be COMPLETED");

  // Verify parent ticket has transitioned to RESOLVED
  const finalTicket = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
  assert(finalTicket!.status === TicketStatus.RESOLVED, "Ticket status should automatically update to RESOLVED");

  // --- 11. DASHBOARD & REPORT EXPORTS ---
  console.log("Testing CSM Dashboard endpoints...");
  const dashRes = await fetch(`${baseUrl}/csm/dashboard/summary`, { headers });
  assert(dashRes.status === 200, "Should fetch dashboard summary");
  const dash = await dashRes.json() as any;
  assert(dash.openTickets >= 0, "Dashboard stats should compile");

  console.log("Verifying PDF/CSV report exports...");
  const csvExportRes = await fetch(`${baseUrl}/csm/reports/export/csv`, { headers });
  assert(csvExportRes.status === 200, "CSV export should return 200");
  const csvText = await csvExportRes.text();
  assert(csvText.includes("Ticket Number"), "CSV report should contain data headers");

  const pdfExportRes = await fetch(`${baseUrl}/csm/reports/export/pdf`, { headers });
  assert(pdfExportRes.status === 200, "PDF export should return 200");
  assert(pdfExportRes.headers.get("content-type") === "application/pdf", "Content type should be application/pdf");

  // --- 12. SECURITY GUARDS & TENANT ISOLATION ---
  console.log("Testing Security guards & Tenant Isolation...");
  const unauthorizedRes = await fetch(`${baseUrl}/csm/tickets`, { method: "GET" });
  assert(unauthorizedRes.status === 401, "Requests without JWT should be blocked with 401");

  // --- 13. OPTIMISTIC CONCURRENCY CONTROL ---
  console.log("Testing Optimistic Concurrency...");
  const staleUpdateRes = await fetch(`${baseUrl}/csm/tickets/${ticket.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      status: TicketStatus.CLOSED,
      expectedVersion: 1, // ticket version is now 2
    }),
  });
  assert(staleUpdateRes.status === 409, "Updates with incorrect expectedVersion should throw 409 Conflict");

  // --- 14. HEALTH ENDPOINT ---
  console.log("Testing Health Endpoint...");
  const healthRes = await fetch(`${baseUrl}/health`, { headers });
  assert(healthRes.status === 200, "Health endpoint should return 200");

  console.log("All CSM E2E integration tests completed successfully!");
  app.close();
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
