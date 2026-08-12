/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient, VehicleStatus, DriverStatus, ShipmentStatus, ShipmentSourceType, TripStatus, StopStatus, ExceptionType, AccountType, InspectionLotStatus, SalesOrderStatus, InspectionLotType, MaintenanceType } from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for TMS E2E integration tests...");
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
  await app.listen(3050);

  const baseUrl = "http://localhost:3050/api";
  let adminToken = "";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

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
  assert(loginRes.status === 200 || loginRes.status === 201, "Admin login should succeed");
  const loginData = (await loginRes.json()) as { accessToken: string };
  adminToken = loginData.accessToken;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  const adminUser = await prisma.user.findFirst({ where: { email: "admin@amdox.com" } });
  assert(!!adminUser, "Admin user must exist in DB");
  const tenantId = adminUser!.tenantId!;
  const adminId = adminUser!.id;

  // Clean up TMS tables to prevent contamination
  console.log("Cleaning up TMS database tables...");
  await prisma.gPSLog.deleteMany({});
  await prisma.fuelLog.deleteMany({});
  await prisma.maintenanceSchedule.deleteMany({});
  await prisma.shipmentException.deleteMany({});
  await prisma.shipmentStop.deleteMany({});
  await prisma.shipment.deleteMany({});
  await prisma.trip.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.driver.deleteMany({});
  await prisma.carrier.deleteMany({});
  
  await prisma.qualityCertificate.deleteMany({});
  await prisma.correctiveAction.deleteMany({});
  await prisma.nonConformanceReport.deleteMany({});
  await prisma.inspectionResult.deleteMany({});
  await prisma.inspectionLot.deleteMany({});
  
  await prisma.stockMovement.deleteMany({});
  await prisma.stock.deleteMany({});
  await prisma.binStock.deleteMany({});
  await prisma.warehouseBin.deleteMany({});
  await prisma.warehouseZone.deleteMany({});
  await prisma.warehouse.deleteMany({});

  console.log("Cleanup complete.");

  // --- 2. FLEET MANAGEMENT CRUD & CONCURRENCY ---
  console.log("Testing Fleet Management CRUD...");
  const suffix = ` ${Date.now()}`;

  // Create Vehicle
  const createVehicleRes = await fetch(`${baseUrl}/tms/vehicles`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      licensePlate: `TX-1234${suffix}`,
      model: "Volvo FH16",
      capacityWeight: 20000,
      capacityVolume: 80,
      fuelEfficiency: 3.5,
    }),
  });
  assert(createVehicleRes.status === 200 || createVehicleRes.status === 201, "Should create vehicle");
  const vehicle = await createVehicleRes.json() as any;
  assert(vehicle.licensePlate.startsWith("TX-1234"), "License plate should match");
  assert(vehicle.version === 1, "Initial version should be 1");

  // Verify Optimistic Concurrency on Vehicle Update
  console.log("Testing Optimistic Concurrency...");
  const updateVehicleFailedRes = await fetch(`${baseUrl}/tms/vehicles/${vehicle.id}?expectedVersion=99`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ model: "Volvo FH16 Grand Edition" }),
  });
  assert(updateVehicleFailedRes.status === 409, "Should fail update due to version conflict");

  const updateVehicleSuccessRes = await fetch(`${baseUrl}/tms/vehicles/${vehicle.id}?expectedVersion=1`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ model: "Volvo FH16 Premium" }),
  });
  assert(updateVehicleSuccessRes.status === 200, "Should succeed updating vehicle");
  const updatedVehicle = await updateVehicleSuccessRes.json() as any;
  assert(updatedVehicle.version === 2, "Version should increment to 2");

  // Create Driver
  const createDriverRes = await fetch(`${baseUrl}/tms/drivers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `John Doe${suffix}`,
      licenseNumber: `DL-98765${suffix}`,
      contactPhone: "+15550199",
    }),
  });
  assert(createDriverRes.status === 200 || createDriverRes.status === 201, "Should create driver");
  const driver = await createDriverRes.json() as any;

  // Create Carrier
  const createCarrierRes = await fetch(`${baseUrl}/tms/carriers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Apex Logistics${suffix}`,
      code: `APEX${Date.now().toString().substring(8)}`,
      contactPerson: "Jane Smith",
      email: "jane@apex.com",
      phone: "+15550188",
      slaRating: 4.8,
    }),
  });
  assert(createCarrierRes.status === 200 || createCarrierRes.status === 201, "Should create carrier");
  const carrier = await createCarrierRes.json() as any;

  // --- 3. QUALITY RELEASE & SHIPPABILITY INTEGRATION ---
  console.log("Testing Quality Release & Shipment block...");

  // Create a product
  const category = await prisma.category.findFirst({ where: { tenantId } });
  const unit = await prisma.unit.findFirst({ where: { tenantId } });
  assert(!!category, "Category must exist");
  assert(!!unit, "Unit must exist");

  const product = await prisma.product.create({
    data: {
      tenantId,
      name: "TMS Test Steel Beam",
      sku: `SKU-TMS-${Date.now()}`,
      categoryId: category!.id,
      unitId: unit!.id,
    },
  });

  // Create warehouse, zone & bin
  const warehouse = await prisma.warehouse.create({
    data: {
      tenantId,
      code: `WH-TMS-${Date.now()}`,
      name: "TMS Logistics Center",
    },
  });

  const zone = await prisma.warehouseZone.create({
    data: {
      tenantId,
      warehouseId: warehouse.id,
      code: `ZN-TMS-${Date.now()}`,
      name: "TMS General Zone",
    },
  });

  const bin = await prisma.warehouseBin.create({
    data: {
      tenantId,
      zoneId: zone.id,
      code: "BIN-TMS-01",
      status: "ACTIVE",
    },
  });

  // Add stock to bin
  await prisma.binStock.create({
    data: {
      tenantId,
      binId: bin.id,
      productId: product.id,
      quantity: 50,
    },
  });

  // Find or create customer
  let customer = await prisma.customer.findFirst({ where: { tenantId } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        tenantId,
        name: "TMS Test Customer",
        email: "cust@tms.com",
        phone: "123456",
      },
    });
  }

  // Mock a Sales Order
  const salesOrder = await prisma.salesOrder.create({
    data: {
      tenantId,
      orderNumber: `SO-TMS-${Date.now()}`,
      customerId: customer.id,
      status: SalesOrderStatus.CONFIRMED,
      expectedDeliveryDate: new Date(Date.now() + 86400000),
      createdBy: adminId,
      items: {
        create: [
          {
            tenantId,
            productId: product.id,
            quantity: 10,
            unitPrice: 150,
            totalPrice: 1500,
          },
        ],
      },
    },
  });

  // Create a Quality Hold Lot (using PENDING status as quality hold/blocked)
  const lot = await prisma.inspectionLot.create({
    data: {
      tenantId,
      code: `LOT-TMS-${Date.now()}`,
      productId: product.id,
      quantity: 10,
      sampleSize: 1,
      warehouseId: warehouse.id,
      type: InspectionLotType.INCOMING,
      status: InspectionLotStatus.PENDING,
    },
  });

  // Try creating shipment -> must fail since product is under Quality Hold
  const createShipmentFailRes = await fetch(`${baseUrl}/tms/shipments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: `SH-FAIL-${Date.now()}`,
      sourceType: ShipmentSourceType.SALES_ORDER,
      salesOrderId: salesOrder.id,
      totalWeight: 1500,
      totalVolume: 5.5,
      freightCost: 450,
      stops: [
        { sequence: 1, stopType: "PICKUP", address: "TMS Logistics Center", estimatedTime: new Date(Date.now() + 3600000) },
        { sequence: 2, stopType: "DELIVERY", address: "789 Client Blvd", estimatedTime: new Date(Date.now() + 7200000) },
      ],
    }),
  });
  assert(createShipmentFailRes.status === 400, "Should block shipment of product under Quality Hold");

  // Release the inspection lot
  await prisma.inspectionLot.update({
    where: { id: lot.id },
    data: { status: InspectionLotStatus.PASSED },
  });

  // Try creating shipment again -> must succeed
  console.log("Creating shipment after Quality Release...");
  const createShipmentSuccessRes = await fetch(`${baseUrl}/tms/shipments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: `SH-OK-${Date.now()}`,
      sourceType: ShipmentSourceType.SALES_ORDER,
      salesOrderId: salesOrder.id,
      totalWeight: 1500,
      totalVolume: 5.5,
      freightCost: 450,
      stops: [
        { sequence: 1, stopType: "PICKUP", address: "TMS Logistics Center", estimatedTime: new Date(Date.now() + 3600000) },
        { sequence: 2, stopType: "DELIVERY", address: "789 Client Blvd", estimatedTime: new Date(Date.now() + 7200000) },
      ],
    }),
  });
  assert(createShipmentSuccessRes.status === 200 || createShipmentSuccessRes.status === 201, "Shipment should be created successfully");
  const shipment = await createShipmentSuccessRes.json() as any;

  // Verify WMS Stock Reservation (reduced by 10)
  const remainingStock = await prisma.binStock.findFirst({ where: { binId: bin.id, productId: product.id } });
  assert(Number(remainingStock!.quantity) === 40, "Bin stock should have been reduced/reserved by 10 items");

  // --- 4. WORKFLOW APPROVALS ON FREIGHT COST > 1000 ---
  console.log("Testing Workflow Approval engine integration...");

  // Setup Workflow Definition
  console.log("Registering TMS_FREIGHT_APPROVAL workflow definition...");
  const wfDefRes = await fetch(`${baseUrl}/workflows/definitions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "TMS Freight Cost Approval",
      code: "TMS_FREIGHT_APPROVAL",
      entityType: "Trip",
      steps: [
        {
          level: 1,
          name: "Dispatcher approval",
          approverType: "USER",
          approverValue: adminId,
        },
      ],
    }),
  });
  // might already exist, so check 200/201 or 409 conflict
  assert(wfDefRes.status === 200 || wfDefRes.status === 201 || wfDefRes.status === 409, "Should successfully setup workflow definition");

  // Create expensive shipment (freight cost = 1200)
  const expensiveShipmentRes = await fetch(`${baseUrl}/tms/shipments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: `SH-EXP-${Date.now()}`,
      sourceType: ShipmentSourceType.SALES_ORDER,
      salesOrderId: salesOrder.id,
      totalWeight: 1500,
      totalVolume: 5.5,
      freightCost: 1200,
      stops: [
        { sequence: 1, stopType: "PICKUP", address: "TMS Logistics Center", estimatedTime: new Date(Date.now() + 3600000) },
        { sequence: 2, stopType: "DELIVERY", address: "789 Expensive St", estimatedTime: new Date(Date.now() + 7200000) },
      ],
    }),
  });
  assert(expensiveShipmentRes.status === 200 || expensiveShipmentRes.status === 201, "Expensive shipment creation should succeed");
  const expensiveShipment = await expensiveShipmentRes.json() as any;

  // Create Trip with expensive shipment
  const tripRes = await fetch(`${baseUrl}/tms/trips`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: `TRIP-EXP-${Date.now()}`,
      vehicleId: updatedVehicle.id,
      driverId: driver.id,
      carrierId: carrier.id,
      shipmentIds: [expensiveShipment.id],
      estimatedDistance: 150.5,
      estimatedDuration: 180,
      routePath: "Route path data description",
    }),
  });
  assert(tripRes.status === 200 || tripRes.status === 201, "Should create Trip");
  const trip = await tripRes.json() as any;

  // Dispatch Trip -> should transition to PENDING_APPROVAL since freightCost > 1000
  console.log("Dispatching trip...");
  const dispatchRes = await fetch(`${baseUrl}/tms/trips/${trip.id}/dispatch?expectedVersion=1`, {
    method: "POST",
    headers,
    body: JSON.stringify({ startOdometer: 10000 }),
  });
  assert(dispatchRes.status === 200 || dispatchRes.status === 201, "Dispatch trigger request should succeed");
  const dispatchedTrip = await dispatchRes.json() as any;
  assert(dispatchedTrip.status === TripStatus.PENDING_APPROVAL, "Trip status must be PENDING_APPROVAL");

  // Fetch pending workflow instance step
  console.log("Approving trip dispatch via Workflow Engine...");
  const wfInstancesRes = await fetch(`${baseUrl}/workflows/instances/search?entityType=Trip&entityId=${trip.id}`, { headers });
  assert(wfInstancesRes.status === 200, "Should get workflow instances");
  const wfInstances = await wfInstancesRes.json() as any[];
  assert(wfInstances.length > 0, "A workflow instance must be running");
  const instance = wfInstances[0];
  
  const pendingStep = instance.steps.find((s: any) => s.status === "PENDING");
  assert(!!pendingStep, "Must find pending workflow step");

  // Action (Approve) the step
  const actionRes = await fetch(`${baseUrl}/workflows/approvals/${pendingStep.id}/action`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "APPROVE",
      comment: "Approved carriage expense request",
    }),
  });
  assert(actionRes.status === 200 || actionRes.status === 201, "Should approve workflow step");

  // Check Trip is now DISPATCHED
  const activeTripsRes = await fetch(`${baseUrl}/tms/trips`, { headers });
  const activeTrips = await activeTripsRes.json() as any[];
  const finalTripStatus = activeTrips.find((t: any) => t.id === trip.id);
  assert(finalTripStatus.status === TripStatus.DISPATCHED, "Trip must transition to DISPATCHED upon workflow approval");

  // Verify GL Freight Accrual Posting: Debit Freight Expense (5300) $1200, Credit Freight Accruals (2200) $1200
  console.log("Verifying GL freight accrual journal entries...");
  const journalEntries = await prisma.journalEntry.findMany({
    where: { tenantId, sourceId: trip.id },
    include: { lines: { include: { account: true } } },
  });
  assert(journalEntries.length === 1, "Exactly one journal entry should be posted for the trip accrual");
  const entry = journalEntries[0];
  assert(entry.status === "POSTED", "Journal entry must be posted");
  
  const debitLine = entry.lines.find((l) => Number(l.debit) === 1200);
  const creditLine = entry.lines.find((l) => Number(l.credit) === 1200);
  assert(debitLine!.account.code === "5300", "Debit account code must be 5300");
  assert(creditLine!.account.code === "2200", "Credit account code must be 2200");

  // --- 5. GPS LOCATION LOGGING ---
  console.log("Logging GPS tracking coordinates...");
  const gpsRes = await fetch(`${baseUrl}/tms/trips/${trip.id}/gps`, {
    method: "POST",
    headers,
    body: JSON.stringify({ latitude: 37.774929, longitude: -122.419416 }),
  });
  assert(gpsRes.status === 200 || gpsRes.status === 201, "GPS logging should succeed");

  // --- 6. FUEL EXPENSE RECORDING & GL BOOKING ---
  console.log("Recording fuel usage log and posting expense...");
  const fuelRes = await fetch(`${baseUrl}/tms/vehicles/${updatedVehicle.id}/fuel`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      logDate: new Date(),
      fuelAmount: 50.0,
      costPerLiter: 1.8,
      totalCost: 90.0,
      odometer: 10150.0,
    }),
  });
  assert(fuelRes.status === 200 || fuelRes.status === 201, "Fuel logging should succeed");
  const fuelLog = await fuelRes.json() as any;

  // Verify Fuel GL Journal Posting: Debit Fuel Expense (5310) $90, Credit Cash/Bank (1010) $90
  const fuelJournal = await prisma.journalEntry.findFirst({
    where: { tenantId, sourceId: fuelLog.id },
    include: { lines: { include: { account: true } } },
  });
  assert(!!fuelJournal, "Journal entry for fuel must exist");
  assert(fuelJournal!.status === "POSTED", "Fuel journal entry must be posted");
  const fuelDebit = fuelJournal!.lines.find((l) => Number(l.debit) === 90);
  const fuelCredit = fuelJournal!.lines.find((l) => Number(l.credit) === 90);
  assert(fuelDebit!.account.code === "5310", "Debit account must be 5310");
  assert(fuelCredit!.account.code === "1010", "Credit account must be 1010");

  // --- 7. MAINTENANCE SCHEDULING ---
  console.log("Scheduling vehicle maintenance...");
  const maintRes = await fetch(`${baseUrl}/tms/vehicles/${updatedVehicle.id}/maintenance`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: MaintenanceType.ROUTINE,
      description: "Volvo standard 10k mile service",
      scheduledDate: new Date(Date.now() + 86400000 * 3), // 3 days later
    }),
  });
  assert(maintRes.status === 200 || maintRes.status === 201, "Maintenance scheduling should succeed");

  // --- 8. DELIVERY CONFIRMATION (POD) & REVERSE LOGISTICS ---
  console.log("Recording POD delivery confirmation...");
  const stopId = expensiveShipment.stops[0].id;
  const podRes = await fetch(`${baseUrl}/tms/shipments/${expensiveShipment.id}/stops/${stopId}/pod`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      signature: "SIGN_MOCK_DATA_IMAGE",
      signedByName: "John Buyer",
      notes: "Delivered in perfect condition.",
    }),
  });
  assert(podRes.status === 200 || podRes.status === 201, "POD recording should succeed");

  // --- 9. DASHBOARD WIDGET INTEGRATION ---
  console.log("Verifying dashboard metric aggregations...");
  const dashRes = await fetch(`${baseUrl}/dashboard/summary`, { headers });
  assert(dashRes.status === 200, "Dashboard fetch should succeed");
  const dash = await dashRes.json() as any;
  assert(dash.tms.activeShipments >= 0, "Dashboard activeShipments widget must be present");
  assert(dash.tms.vehicleAvailability >= 0, "Dashboard vehicleAvailability widget must be present");

  // --- 10. REPORT EXPORTS (CSV/PDF) ---
  console.log("Verifying PDF/CSV export downloads...");
  const csvRes = await fetch(`${baseUrl}/tms/reports/export/csv`, { headers });
  const pdfRes = await fetch(`${baseUrl}/tms/reports/export/pdf`, { headers });
  assert(csvRes.status === 200, "CSV export should succeed");
  assert(pdfRes.status === 200, "PDF export should succeed");

  console.log("All TMS E2E integration tests completed successfully!");
  app.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
