import { PrismaClient, EmploymentType, EmployeeStatus, AttendanceStatus, LeaveRequestStatus, PayslipStatus, ExpenseClaimStatus, AppraisalCycleStatus, PerformanceReviewStatus, BOMStatus, WorkOrderStatus, OperationStatus, BinStatus, WmsMovementStatus, VehicleStatus, PurchaseOrderStatus, SalesOrderStatus, InvoiceType, InvoiceStatus, PaymentMethod, PaymentStatus, StockTransactionType, NotificationType, PaymentType } from '../generated';
import * as argon2 from 'argon2';

export async function runDemoSeeder(prisma: PrismaClient) {
  console.log('Seeding Demo Environment data...');

  const demoTenantId = '11111111-1111-1111-1111-111111111111';
  const demoCompanyId = '22222222-2222-2222-2222-222222222222';

  // 1. Resolve Seeded Users to avoid deleting them
  const seededUsers = await prisma.user.findMany({
    where: {
      email: { in: ['admin@amdox.com', 'sales@amdox.com', 'warehouse@amdox.com', 'employee@amdox.com'] }
    }
  });
  const seededUserIds = seededUsers.map(u => u.id);
  const adminUser = seededUsers.find(u => u.email === 'admin@amdox.com');
  const adminUserId = adminUser ? adminUser.id : seededUserIds[0];

  // 2. Comprehensive Cleanup Stage in correct dependency order
  console.log('Cleaning up existing demo tenant data...');
  const modelsToDelete = [
    'aiRecommendation', 'aiPredictionHistory', 'aiTrainingJob', 'integrationApiLog',
    'integrationWebhookDelivery', 'integrationWebhookEndpoint', 'integrationApiKey', 'integrationConfig',
    'serviceVisit', 'supportTicket', 'serviceContract', 'ticketNote', 'rmaRequest', 'kbArticle',
    'fuelLog', 'maintenanceSchedule', 'gPSLog', 'trip', 'shipmentException', 'shipmentStop', 'shipment',
    'driver', 'vehicle', 'putawayRule', 'warehouseMovement', 'cycleCountLine', 'cycleCount',
    'binStock', 'warehouseBin', 'warehouseZone', 'nonConformanceReport', 'correctiveAction',
    'supplierQualityRating', 'qualityCertificate', 'inspectionResult', 'inspectionLot',
    'workOrderOperation', 'workOrder', 'bOMItem', 'bOM', 'routingOperation', 'routing', 'workCenter',
    'companyAnnouncement', 'performanceGoal', 'performanceReview', 'appraisalCycle',
    'expenseClaimItem', 'expenseClaimApproval', 'expenseClaim', 'payslip', 'payrollPeriod',
    'employeeSalaryAssignment', 'salaryStructureComponent', 'salaryStructure', 'leaveApproval',
    'leaveRequest', 'leaveBalance', 'leavePolicy', 'leaveAccrualHistory', 'leaveCarryForwardHistory',
    'leaveType', 'holiday', 'shiftAssignment', 'shift', 'attendanceCorrection', 'attendanceRecord',
    'attendancePolicy', 'employeeDocument', 'employee', 'opportunity', 'cRMActivity', 'cRMContact',
    'cRMAccount', 'lead', 'budgetRevisionItem', 'budgetRevision', 'budgetItem', 'budget',
    'bankReconciliationLine', 'bankReconciliation', 'bankTransaction', 'bankAccount',
    'assetMaintenance', 'assetTransfer', 'assetDepreciation', 'asset', 'assetCategory',
    'taxTransaction', 'taxExemption', 'taxRule', 'financialPeriod', 'journalEntryLine', 'journalEntry',
    'paymentAllocation', 'payment', 'invoiceItem', 'invoice', 'salesDeliveryItem', 'salesDelivery',
    'salesOrderItem', 'salesOrder', 'purchaseReceiptItem', 'purchaseReceipt', 'purchaseOrderItem',
    'purchaseOrder', 'stockAdjustmentLine', 'stockAdjustment', 'stockTransferLine', 'stockTransfer',
    'stockMovement', 'stock', 'product', 'category', 'unit', 'department', 'designation',
    'customer', 'warehouse', 'notification', 'auditLog', 'exchangeRate', 'interCompanyTransaction',
    'consolidationRun', 'companyPermission'
  ];

  for (const model of modelsToDelete) {
    const delegate = (prisma as any)[model];
    if (delegate) {
      try {
        await delegate.deleteMany({ where: { tenantId: demoTenantId } });
      } catch (err) {
        // Safe to skip child tables or tables without tenantId (rely on cascade delete)
      }
    }
  }

  // Delete non-seeded users and their roles
  await prisma.userRole.deleteMany({
    where: {
      tenantId: demoTenantId,
      userId: { notIn: seededUserIds }
    }
  });
  await prisma.user.deleteMany({
    where: {
      tenantId: demoTenantId,
      id: { notIn: seededUserIds }
    }
  });

  // 3. Ensure Tenant & Company exist
  await prisma.tenant.upsert({
    where: { id: demoTenantId },
    update: {},
    create: {
      id: demoTenantId,
      name: 'Amdox Enterprise Demo Tenant',
      slug: 'amdox-demo',
    },
  });

  await prisma.company.upsert({
    where: { id: demoCompanyId },
    update: {},
    create: {
      id: demoCompanyId,
      tenantId: demoTenantId,
      name: 'Amdox Global Corporate',
      code: 'AGC',
      legalName: 'Amdox Global Corporate Ltd',
      baseCurrency: 'USD',
      country: 'USA',
      isConsolidationEntity: false,
    },
  });

  // 4. Seed Departments
  console.log('Seeding departments...');
  const departmentsData = [
    { name: 'HR', code: 'HRD' },
    { name: 'Finance', code: 'FIN' },
    { name: 'Sales', code: 'SLS' },
    { name: 'Procurement', code: 'PRC' },
    { name: 'Warehouse', code: 'WHS' },
    { name: 'Manufacturing', code: 'MFG' },
    { name: 'Quality', code: 'QLY' },
    { name: 'IT', code: 'ITD' },
    { name: 'Operations & Engineering', code: 'OPS-ENG' }
  ];

  const departments: any[] = [];
  for (const dept of departmentsData) {
    const d = await prisma.department.create({
      data: {
        tenantId: demoTenantId,
        name: dept.name,
        code: dept.code,
      }
    });
    departments.push(d);
  }

  // 5. Seed Designations
  console.log('Seeding designations...');
  const designationsData = [
    { name: 'Director', code: 'DIR' },
    { name: 'Manager', code: 'MGR' },
    { name: 'Supervisor', code: 'SUP' },
    { name: 'Senior Specialist', code: 'SSP' },
    { name: 'Associate', code: 'ASC' },
    { name: 'Technician', code: 'TEC' }
  ];

  const designations: any[] = [];
  for (const desg of designationsData) {
    const d = await prisma.designation.create({
      data: {
        tenantId: demoTenantId,
        name: desg.name,
        code: desg.code,
      }
    });
    designations.push(d);
  }

  // 6. Seed Units & Categories
  console.log('Seeding units and categories...');
  const unitsData = [
    { name: 'Piece', symbol: 'PCS' },
    { name: 'Box', symbol: 'BOX' },
    { name: 'Kilogram', symbol: 'KG' },
    { name: 'Meter', symbol: 'M' },
    { name: 'Litre', symbol: 'L' }
  ];
  const units: any[] = [];
  for (const u of unitsData) {
    const res = await prisma.unit.create({
      data: {
        tenantId: demoTenantId,
        name: u.name,
        symbol: u.symbol,
      }
    });
    units.push(res);
  }

  const categoriesData = [
    { name: 'Raw Materials', desc: 'Raw inputs for production' },
    { name: 'Semi-Finished Goods', desc: 'Sub-assemblies' },
    { name: 'Finished Products', desc: 'Retail and enterprise goods' },
    { name: 'Packaging', desc: 'Shipping boxes and bubble wraps' },
    { name: 'Electronics Assemblies', desc: 'Electronic processor components' }
  ];
  const categories: any[] = [];
  for (const c of categoriesData) {
    const res = await prisma.category.create({
      data: {
        tenantId: demoTenantId,
        name: c.name,
        description: c.desc,
      }
    });
    categories.push(res);
  }

  // 7. Seed Products (90 products)
  console.log('Seeding 90 products...');
  const products: any[] = [];
  const rawCat = categories.find(c => c.name === 'Raw Materials');
  const semiCat = categories.find(c => c.name === 'Semi-Finished Goods');
  const finCat = categories.find(c => c.name === 'Finished Products');
  const packCat = categories.find(c => c.name === 'Packaging');

  const pcsUnit = units.find(u => u.symbol === 'PCS');
  const boxUnit = units.find(u => u.symbol === 'BOX');

  // Seed Raw Materials (40 products)
  for (let i = 1; i <= 40; i++) {
    const p = await prisma.product.create({
      data: {
        tenantId: demoTenantId,
        categoryId: rawCat.id,
        unitId: pcsUnit.id,
        name: `Raw Material component type-${i}`,
        sku: `RAW-CMP-${String(i).padStart(3, '0')}`,
        barcode: `79012345${String(i).padStart(4, '0')}`,
        description: `High-quality industrial component parameter-${i}`,
        costPrice: 2.50 + i * 0.75,
        salePrice: 5.00 + i * 1.50,
        status: 'ACTIVE'
      }
    });
    products.push(p);
  }

  // Seed Semi-Finished Goods (20 products)
  for (let i = 1; i <= 20; i++) {
    const p = await prisma.product.create({
      data: {
        tenantId: demoTenantId,
        categoryId: semiCat.id,
        unitId: pcsUnit.id,
        name: `Sub-Assembly Module block-${i}`,
        sku: `SUB-ASM-${String(i).padStart(3, '0')}`,
        barcode: `79022345${String(i).padStart(4, '0')}`,
        description: `Pre-configured electronic sub-assembly block-${i}`,
        costPrice: 20.00 + i * 4.50,
        salePrice: 40.00 + i * 8.00,
        status: 'ACTIVE'
      }
    });
    products.push(p);
  }

  // Seed Finished Products (25 products)
  const finishedProductNames = [
    'Amdox Smart Processor Unit', 'Amdox IoT Gateway Edge', 'Amdox Control Terminal Pro',
    'Amdox Sensor Node Hub', 'Amdox Edge Server Rack', 'Amdox Smart Display Panel',
    'Amdox Power Inverter controller', 'Amdox Wireless Bridge module', 'Amdox Thermal Sensor Array',
    'Amdox Actuator Hub controller', 'Amdox Relay Box 8-Port', 'Amdox Optocoupler Board v2',
    'Amdox Industrial Terminal Suite', 'Amdox Logic Analyzer Mod', 'Amdox DAC Converter block',
    'Amdox RS-485 transceiver', 'Amdox Protocol Converter Unit', 'Amdox Fiber Optic Hub',
    'Amdox Ethernet Switch DIN-Rail', 'Amdox Modbus Controller block', 'Amdox CAN Bus Terminal',
    'Amdox GPS Tracker Module', 'Amdox GSM Modem block', 'Amdox Power Supply 24V',
    'Amdox Backup Battery Pack'
  ];
  for (let i = 0; i < finishedProductNames.length; i++) {
    const p = await prisma.product.create({
      data: {
        tenantId: demoTenantId,
        categoryId: finCat.id,
        unitId: pcsUnit.id,
        name: finishedProductNames[i],
        sku: `AMD-PROD-${String(i+1).padStart(3, '0')}`,
        barcode: `79032345${String(i+1).padStart(4, '0')}`,
        description: `State of the art ERP demo finished item - ${finishedProductNames[i]}`,
        costPrice: 150.00 + i * 25.00,
        salePrice: 249.99 + i * 49.00,
        status: 'ACTIVE'
      }
    });
    products.push(p);
  }

  // Seed Packaging (5 products)
  for (let i = 1; i <= 5; i++) {
    const p = await prisma.product.create({
      data: {
        tenantId: demoTenantId,
        categoryId: packCat.id,
        unitId: boxUnit.id,
        name: `Carton Shipping Box Size-${i}`,
        sku: `BOX-SHP-${String(i).padStart(3, '0')}`,
        barcode: `79042345${String(i).padStart(4, '0')}`,
        description: `Durable corrugated cardboard packing box size-${i}`,
        costPrice: 1.20 + i * 0.40,
        salePrice: 2.50 + i * 0.80,
        status: 'ACTIVE'
      }
    });
    products.push(p);
  }

  // 8. Seed Warehouses, Zones & Bins
  console.log('Seeding 3 warehouses...');
  const whs = [
    { name: 'Boston Main Distribution Hub', code: 'BOS-MAIN' },
    { name: 'Finished Goods Warehouse', code: 'FG-WHS' },
    { name: 'Raw Material Warehouse', code: 'RM-WHS' }
  ];
  const warehouses: any[] = [];
  for (const w of whs) {
    const res = await prisma.warehouse.create({
      data: {
        tenantId: demoTenantId,
        companyId: demoCompanyId,
        name: w.name,
        code: w.code,
        address: `100 Industrial Parkway, Zone ${w.code}, Boston MA`,
        status: 'ACTIVE'
      }
    });
    warehouses.push(res);
  }

  const warehouseZones: any[] = [];
  const warehouseBins: any[] = [];

  for (const w of warehouses) {
    // Create 2 Zones per Warehouse
    const zones = [
      { name: 'Pallet Racking Zone A', code: 'ZONE-A' },
      { name: 'Shelving Bin Zone B', code: 'ZONE-B' }
    ];
    for (const z of zones) {
      const zone = await prisma.warehouseZone.create({
        data: {
          tenantId: demoTenantId,
          warehouseId: w.id,
          name: z.name,
          code: `${w.code}-${z.code}`,
          temperatureClass: 'AMBIENT'
        }
      });
      warehouseZones.push(zone);

      // Create 5 bins per zone
      for (let i = 1; i <= 5; i++) {
        const bin = await prisma.warehouseBin.create({
          data: {
            tenantId: demoTenantId,
            zoneId: zone.id,
            code: `${zone.code}-BIN-${String(i).padStart(2, '0')}`,
            aisle: `Aisle-${i}`,
            rack: `Rack-${i}`,
            shelf: `Shelf-${i}`,
            position: `Pos-${i}`,
            status: 'ACTIVE'
          }
        });
        warehouseBins.push(bin);
      }
    }
  }

  // 9. Seed Employees (45 employees)
  console.log('Seeding 45 employees...');
  const firstNames = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Elizabeth',
    'William', 'Linda', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
    'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
    'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
    'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian'
  ];
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
    'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
    'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall'
  ];

  const employees: any[] = [];
  for (let i = 0; i < 45; i++) {
    const dept = departments[i % departments.length];
    const desg = designations[i % designations.length];
    const emp = await prisma.employee.create({
      data: {
        tenantId: demoTenantId,
        employeeCode: `EMP-${String(i+1).padStart(3, '0')}`,
        firstName: firstNames[i],
        lastName: lastNames[i],
        email: `emp${i+1}@amdox.com`,
        phone: `+1-555-01${String(i+1).padStart(2, '0')}`,
        departmentId: dept.id,
        designationId: desg.id,
        employmentType: EmploymentType.FULL_TIME,
        status: EmployeeStatus.ACTIVE,
        joiningDate: new Date('2026-01-15')
      }
    });
    employees.push(emp);
  }

  // 10. Seed Stock, BinStock and Movements
  console.log('Seeding inventory stock levels and movements...');
  for (let idx = 0; idx < products.length; idx++) {
    const prod = products[idx];
    const wh = warehouses[idx % warehouses.length];
    
    // Seed Warehouse Stock summary record
    await prisma.stock.create({
      data: {
        tenantId: demoTenantId,
        productId: prod.id,
        warehouseId: wh.id,
        quantity: 500.0
      }
    });

    // Seed BinStock records
    const binsForWh = warehouseBins.filter(b => b.code.startsWith(wh.code));
    const bin1 = binsForWh[0];
    const bin2 = binsForWh[1];

    await prisma.binStock.create({
      data: {
        tenantId: demoTenantId,
        binId: bin1.id,
        productId: prod.id,
        quantity: 300.0,
        batchNumber: `BATCH-${wh.code}-01`
      }
    });

    await prisma.binStock.create({
      data: {
        tenantId: demoTenantId,
        binId: bin2.id,
        productId: prod.id,
        quantity: 200.0,
        batchNumber: `BATCH-${wh.code}-02`
      }
    });

    // Seed opening stock movement
    await prisma.stockMovement.create({
      data: {
        tenantId: demoTenantId,
        productId: prod.id,
        warehouseId: wh.id,
        type: StockTransactionType.STOCK_IN,
        quantity: 500.0,
        referenceType: 'OpeningStockSeeder',
        referenceId: '11111111-1111-1111-1111-111111111111',
        note: 'Seeded opening stock level',
        performedBy: adminUserId || '0ff0734f-13b8-4c6f-88e2-231a13df95c1'
      }
    });
  }

  // 11. Seed Customers (25 customers)
  console.log('Seeding 25 customers...');
  const customersData = [
    'Alpha Tech Corp', 'Apex Global Industries', 'Blue Horizon Logistics', 'Summit Enterprise',
    'Frontier Manufacturing', 'Titanium Dynamics', 'Pinnacle Electronic Solutions', 'Vanguard Systems',
    'Quantum Engineering', 'Omega Power Controls', 'Delta Automations', 'Beacon Software Labs',
    'Crestwood Assemblies', 'Silverline Connectors', 'Matrix Device Group', 'Pioneer Wireless',
    'Prime Sensors Corp', 'Integra Actuators', 'Velocity Transceivers', 'Nova Switchboards',
    'Infinity protocol Systems', 'Core Interface Ltd', 'Echo Fiber Networks', 'Nexus Grid Solutions',
    'Stellar Energy Systems'
  ];
  const customers: any[] = [];
  for (let i = 0; i < customersData.length; i++) {
    const cust = await prisma.customer.create({
      data: {
        tenantId: demoTenantId,
        name: customersData[i],
        email: `contact@${customersData[i].toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        phone: `+1-800-555-${String(i+1).padStart(4, '0')}`,
        address: `${100 + i * 5} Business Blvd, Suite ${i+1}, Chicago IL`,
        status: 'ACTIVE'
      }
    });
    customers.push(cust);
  }

  // 12. Seed Work Centers
  console.log('Seeding work centers...');
  const workCentersData = [
    { name: 'Primary Assembly Line Alpha', code: 'LINE-A' },
    { name: 'Robotic Pick & Place Line B', code: 'LINE-B' },
    { name: 'Testing & Reflow Assembly C', code: 'LINE-C' },
    { name: 'Final Quality Inspection D', code: 'LINE-D' }
  ];
  const workCenters: any[] = [];
  for (const wc of workCentersData) {
    const w = await prisma.workCenter.create({
      data: {
        tenantId: demoTenantId,
        name: wc.name,
        code: wc.code,
        capacity: 100.0,
        overheadRate: 25.0,
        status: 'ACTIVE'
      }
    });
    workCenters.push(w);
  }

  // 13. Seed Vehicles
  console.log('Seeding vehicles...');
  const vehiclesData = [
    { plate: 'AMD-TRK-01', model: 'Volvo VNL 860', capVol: 1500.0, capWt: 12000.0 },
    { plate: 'AMD-TRK-02', model: 'Freightliner Cascadia', capVol: 1800.0, capWt: 15000.0 },
    { plate: 'AMD-TRK-03', model: 'Kenworth T680', capVol: 1400.0, capWt: 11000.0 }
  ];
  const vehicles: any[] = [];
  for (const v of vehiclesData) {
    const veh = await prisma.vehicle.create({
      data: {
        tenantId: demoTenantId,
        licensePlate: v.plate,
        model: v.model,
        status: VehicleStatus.IDLE,
        capacityVolume: v.capVol,
        capacityWeight: v.capWt,
        fuelEfficiency: 7.5
      }
    });
    vehicles.push(veh);
  }

  // 14. Seed Purchases Module (12 POs, receipts, invoices)
  console.log('Seeding Purchase Orders...');
  const suppliers = [
    'Global Semiconductor Corp', 'Precision Wire & Screw', 'Apex Enclosure Blocks',
    'National Solder Supplies', 'Omega Electronics Inc'
  ];
  const poStatuses = [
    PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.COMPLETED,
    PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.DRAFT
  ];

  for (let i = 1; i <= 12; i++) {
    const status = poStatuses[i % poStatuses.length];
    const supplierName = suppliers[i % suppliers.length];
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId: demoTenantId,
        companyId: demoCompanyId,
        orderNumber: `PO-2026-${String(i).padStart(4, '0')}`,
        supplierName,
        status,
        expectedDeliveryDate: new Date(2026, 2, 20 + i),
        totalAmount: 1500.00 * i,
        createdBy: adminUserId
      }
    });

    // PO Items (2 items per PO)
    const p1 = products[i % products.length];
    const p2 = products[(i + 5) % products.length];

    await prisma.purchaseOrderItem.create({
      data: {
        tenantId: demoTenantId,
        purchaseOrderId: po.id,
        productId: p1.id,
        quantity: 100.0,
        unitPrice: p1.costPrice,
        totalPrice: 100.0 * p1.costPrice.toNumber()
      }
    });

    await prisma.purchaseOrderItem.create({
      data: {
        tenantId: demoTenantId,
        purchaseOrderId: po.id,
        productId: p2.id,
        quantity: 50.0,
        unitPrice: p2.costPrice,
        totalPrice: 50.0 * p2.costPrice.toNumber()
      }
    });

    // If completed or received, generate Receipt and Purchase Invoice
    if (status === PurchaseOrderStatus.COMPLETED || status === PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      const receipt = await prisma.purchaseReceipt.create({
        data: {
          tenantId: demoTenantId,
          purchaseOrderId: po.id,
          warehouseId: warehouses[0].id,
          receivedBy: seededUserIds[2] || adminUserId,
          receivedAt: new Date(po.expectedDeliveryDate),
          remarks: 'Standard incoming logistics inspection passed'
        }
      });

      await prisma.purchaseReceiptItem.create({
        data: {
          tenantId: demoTenantId,
          purchaseReceiptId: receipt.id,
          productId: p1.id,
          quantityReceived: 100.0
        }
      });

      // Generate invoice
      const invoice = await prisma.invoice.create({
        data: {
          tenantId: demoTenantId,
          companyId: demoCompanyId,
          type: InvoiceType.PURCHASE,
          invoiceNumber: `INV-PUR-${String(i).padStart(4, '0')}`,
          invoiceDate: new Date(po.expectedDeliveryDate),
          dueDate: new Date(po.expectedDeliveryDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          status: InvoiceStatus.PAID,
          subtotal: po.totalAmount,
          taxTotal: po.totalAmount.toNumber() * 0.1,
          discountTotal: 0.0,
          grandTotal: po.totalAmount.toNumber() * 1.1,
          createdAt: new Date(po.expectedDeliveryDate),
          createdBy: adminUserId
        }
      });

      await prisma.invoiceItem.create({
        data: {
          tenantId: demoTenantId,
          invoiceId: invoice.id,
          productId: p1.id,
          quantity: 100.0,
          unitPrice: p1.costPrice,
          taxAmount: 100.0 * p1.costPrice.toNumber() * 0.1,
          totalPrice: 100.0 * p1.costPrice.toNumber() * 1.1
        }
      });
    }
  }

  // 15. Seed Sales Module (18 Sales Orders, deliveries, Invoices)
  console.log('Seeding Sales Orders...');
  const soStatuses = [
    SalesOrderStatus.CONFIRMED, SalesOrderStatus.DELIVERED,
    SalesOrderStatus.PARTIALLY_DELIVERED, SalesOrderStatus.DRAFT
  ];

  for (let i = 1; i <= 18; i++) {
    const status = soStatuses[i % soStatuses.length];
    const customer = customers[i % customers.length];
    const so = await prisma.salesOrder.create({
      data: {
        tenantId: demoTenantId,
        companyId: demoCompanyId,
        customerId: customer.id,
        orderNumber: `SO-2026-${String(i).padStart(4, '0')}`,
        status,
        expectedDeliveryDate: new Date(2026, 3, 15 + i),
        totalAmount: 2500.00 * i,
        createdBy: adminUserId
      }
    });

    const p1 = products[(i + 10) % products.length];
    const p2 = products[(i + 15) % products.length];

    await prisma.salesOrderItem.create({
      data: {
        tenantId: demoTenantId,
        salesOrderId: so.id,
        productId: p1.id,
        quantity: 20.0,
        unitPrice: p1.salePrice,
        totalPrice: 20.0 * p1.salePrice.toNumber()
      }
    });

    await prisma.salesOrderItem.create({
      data: {
        tenantId: demoTenantId,
        salesOrderId: so.id,
        productId: p2.id,
        quantity: 10.0,
        unitPrice: p2.salePrice,
        totalPrice: 10.0 * p2.salePrice.toNumber()
      }
    });

    // If delivered or completed, generate Delivery and Sales Invoice
    if (status === SalesOrderStatus.DELIVERED || status === SalesOrderStatus.PARTIALLY_DELIVERED) {
      const delivery = await prisma.salesDelivery.create({
        data: {
          tenantId: demoTenantId,
          salesOrderId: so.id,
          warehouseId: warehouses[1].id,
          deliveredBy: adminUserId,
          deliveredAt: new Date(so.expectedDeliveryDate),
          remarks: 'Dispatched via carrier'
        }
      });

      await prisma.salesDeliveryItem.create({
        data: {
          tenantId: demoTenantId,
          salesDeliveryId: delivery.id,
          productId: p1.id,
          quantityDelivered: 20.0
        }
      });

      // Generate invoice
      const invoice = await prisma.invoice.create({
        data: {
          tenantId: demoTenantId,
          companyId: demoCompanyId,
          type: InvoiceType.SALES,
          invoiceNumber: `INV-SLS-${String(i).padStart(4, '0')}`,
          customerId: customer.id,
          invoiceDate: new Date(so.expectedDeliveryDate),
          dueDate: new Date(so.expectedDeliveryDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          status: InvoiceStatus.PAID,
          subtotal: so.totalAmount,
          taxTotal: so.totalAmount.toNumber() * 0.1,
          discountTotal: 0.0,
          grandTotal: so.totalAmount.toNumber() * 1.1,
          createdAt: new Date(so.expectedDeliveryDate),
          createdBy: adminUserId
        }
      });

      await prisma.invoiceItem.create({
        data: {
          tenantId: demoTenantId,
          invoiceId: invoice.id,
          productId: p1.id,
          quantity: 20.0,
          unitPrice: p1.salePrice,
          taxAmount: 20.0 * p1.salePrice.toNumber() * 0.1,
          totalPrice: 20.0 * p1.salePrice.toNumber() * 1.1
        }
      });

      // Create Payment for this sales invoice
      const payment = await prisma.payment.create({
        data: {
          tenantId: demoTenantId,
          companyId: demoCompanyId,
          customerId: customer.id,
          type: PaymentType.RECEIPT,
          method: PaymentMethod.BANK_TRANSFER,
          amount: invoice.grandTotal,
          paymentDate: new Date(so.expectedDeliveryDate.getTime() + 2 * 24 * 60 * 60 * 1000),
          status: PaymentStatus.POSTED,
          paymentNumber: `PAY-REC-${String(i).padStart(4, '0')}`,
          createdBy: adminUserId
        }
      });

      await prisma.paymentAllocation.create({
        data: {
          tenantId: demoTenantId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          allocatedAmount: invoice.grandTotal
        }
      });
    }
  }

  // 16. Seed Finance Historical Invoices & Inflow/Outflow for last 6 months
  console.log('Seeding 6-month historical monthly invoices...');
  const months = [
    { name: 'Mar', start: new Date(2026, 2, 1), end: new Date(2026, 2, 28) },
    { name: 'Apr', start: new Date(2026, 3, 1), end: new Date(2026, 3, 28) },
    { name: 'May', start: new Date(2026, 4, 1), end: new Date(2026, 4, 28) },
    { name: 'Jun', start: new Date(2026, 5, 1), end: new Date(2026, 5, 28) },
    { name: 'Jul', start: new Date(2026, 6, 1), end: new Date(2026, 6, 28) },
    { name: 'Aug', start: new Date(2026, 7, 1), end: new Date(2026, 7, 3) }
  ];

  let invoiceSeq = 100;
  for (const m of months) {
    // 2 Sales Invoices (Revenue)
    for (let s = 1; s <= 2; s++) {
      const amt = 50000.00 + s * 15000.00;
      await prisma.invoice.create({
        data: {
          tenantId: demoTenantId,
          companyId: demoCompanyId,
          type: InvoiceType.SALES,
          invoiceNumber: `HIST-SLS-${invoiceSeq++}`,
          invoiceDate: new Date(m.start.getTime() + s * 5 * 24 * 60 * 60 * 1000),
          dueDate: new Date(m.end),
          status: InvoiceStatus.PAID,
          subtotal: amt,
          taxTotal: amt * 0.1,
          discountTotal: 0.0,
          grandTotal: amt * 1.1,
          createdAt: new Date(m.start.getTime() + s * 5 * 24 * 60 * 60 * 1000),
          createdBy: adminUserId
        }
      });
    }

    // 2 Purchase Invoices (Expenses)
    for (let e = 1; e <= 2; e++) {
      const amt = 30000.00 + e * 8000.00;
      await prisma.invoice.create({
        data: {
          tenantId: demoTenantId,
          companyId: demoCompanyId,
          type: InvoiceType.PURCHASE,
          invoiceNumber: `HIST-PUR-${invoiceSeq++}`,
          invoiceDate: new Date(m.start.getTime() + e * 6 * 24 * 60 * 60 * 1000),
          dueDate: new Date(m.end),
          status: InvoiceStatus.PAID,
          subtotal: amt,
          taxTotal: amt * 0.1,
          discountTotal: 0.0,
          grandTotal: amt * 1.1,
          createdAt: new Date(m.start.getTime() + e * 6 * 24 * 60 * 60 * 1000),
          createdBy: adminUserId
        }
      });
    }
  }

  // 17. Seed Manufacturing Module (BOM, Routing, Work Order, Operations)
  console.log('Seeding manufacturing BOMs and routings...');
  const finProd1 = products.find(p => p.sku === 'AMD-PROD-001');
  const raw1 = products.find(p => p.sku === 'RAW-CMP-001');
  const raw2 = products.find(p => p.sku === 'RAW-CMP-002');

  const bom1 = await prisma.bOM.create({
    data: {
      tenantId: demoTenantId,
      productId: finProd1.id,
      code: 'BOM-SPU-001',
      name: 'BOM for Amdox Smart Processor Unit',
      description: 'Standard PCB layout and board assemblies configuration',
      quantity: 1.0,
      status: BOMStatus.ACTIVE
    }
  });

  await prisma.bOMItem.create({
    data: {
      tenantId: demoTenantId,
      bomId: bom1.id,
      productId: raw1.id,
      quantity: 4.0,
      unitId: pcsUnit.id
    }
  });

  await prisma.bOMItem.create({
    data: {
      tenantId: demoTenantId,
      bomId: bom1.id,
      productId: raw2.id,
      quantity: 2.0,
      unitId: pcsUnit.id
    }
  });

  const routing1 = await prisma.routing.create({
    data: {
      tenantId: demoTenantId,
      productId: finProd1.id,
      code: 'ROUT-SPU-001',
      name: 'Standard Manufacturing Routing assembly'
    }
  });

  await prisma.routingOperation.create({
    data: {
      tenantId: demoTenantId,
      routingId: routing1.id,
      workCenterId: workCenters[0].id,
      sequence: 10,
      name: 'PCB Solder & Placement operation',
      setupTimeMinutes: 15.0,
      executionTimeMinutes: 5.5
    }
  });

  await prisma.routingOperation.create({
    data: {
      tenantId: demoTenantId,
      routingId: routing1.id,
      workCenterId: workCenters[1].id,
      sequence: 20,
      name: 'Processor Mounting and Testing',
      setupTimeMinutes: 10.0,
      executionTimeMinutes: 8.0
    }
  });

  // Seed 8 Work Orders
  console.log('Seeding 8 Work Orders...');
  for (let i = 1; i <= 8; i++) {
    const wo = await prisma.workOrder.create({
      data: {
        tenantId: demoTenantId,
        code: `WO-2026-${String(i).padStart(4, '0')}`,
        bomId: bom1.id,
        routingId: routing1.id,
        productId: finProd1.id,
        quantity: 50.0 * i,
        plannedStartDate: new Date(`2026-05-${String(i+2).padStart(2, '0')}`),
        plannedEndDate: new Date(`2026-05-${String(i+5).padStart(2, '0')}`),
        status: i % 2 === 0 ? WorkOrderStatus.COMPLETED : WorkOrderStatus.IN_PROGRESS,
        initiatedById: adminUserId
      }
    });

    await prisma.workOrderOperation.create({
      data: {
        tenantId: demoTenantId,
        workOrderId: wo.id,
        sequence: 10,
        name: 'PCB Solder & Placement operation',
        workCenterId: workCenters[0].id,
        setupTimeMinutes: 15.0,
        executionTimeMinutes: 5.5,
        status: i % 2 === 0 ? OperationStatus.COMPLETED : OperationStatus.IN_PROGRESS
      }
    });
  }

  // 18. Seed HR Module (Attendance, Leaves, Expenses, Payroll)
  console.log('Seeding attendance and leave records...');
  // Seed Attendance for employees for last 5 days
  for (let d = 1; d <= 5; d++) {
    const dateStr = `2026-08-0${d}`;
    for (let e = 0; e < 15; e++) {
      const emp = employees[e];
      await prisma.attendanceRecord.create({
        data: {
          tenantId: demoTenantId,
          employeeId: emp.id,
          date: new Date(dateStr),
          checkIn: new Date(`${dateStr}T09:00:00Z`),
          checkOut: new Date(`${dateStr}T17:00:00Z`),
          workingHours: 8.0,
          status: AttendanceStatus.PRESENT
        }
      });
    }
  }

  // Seed Leave Request
  const leaveType = await prisma.leaveType.create({
    data: {
      tenantId: demoTenantId,
      name: 'Annual Paid Vacation Leave',
      code: 'ANN-VAC',
      maxDaysPerYear: 20.0
    }
  });

  for (let i = 0; i < 15; i++) {
    const emp = employees[i % employees.length];
    await prisma.leaveRequest.create({
      data: {
        tenantId: demoTenantId,
        employeeId: emp.id,
        leaveTypeId: leaveType.id,
        startDate: new Date('2026-08-10'),
        endDate: new Date('2026-08-15'),
        reason: 'Family summer vacation trip',
        status: i % 3 === 0 ? LeaveRequestStatus.PENDING : LeaveRequestStatus.APPROVED
      }
    });
  }

  // Seed Payroll Period and 10 Payslips
  const payrollPeriod = await prisma.payrollPeriod.create({
    data: {
      tenantId: demoTenantId,
      name: 'Payroll Period July 2026',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31')
    }
  });

  for (let i = 0; i < 10; i++) {
    const emp = employees[i];
    await prisma.payslip.create({
      data: {
        tenantId: demoTenantId,
        payrollPeriodId: payrollPeriod.id,
        employeeId: emp.id,
        baseSalary: 5500.0,
        earnings: 200.0,
        deductions: 100.0,
        netPay: 5600.0,
        status: PayslipStatus.APPROVED
      }
    });
  }

  // Seed 10 Expense Claims
  for (let i = 1; i <= 10; i++) {
    const emp = employees[i % employees.length];
    await prisma.expenseClaim.create({
      data: {
        tenantId: demoTenantId,
        employeeId: emp.id,
        title: `Travel Reimbursement flight tickets - ${i}`,
        claimDate: new Date('2026-07-15'),
        totalAmount: 120.50 * i,
        status: i % 2 === 0 ? ExpenseClaimStatus.APPROVED : ExpenseClaimStatus.SUBMITTED
      }
    });
  }

  // 19. Seed unread Notifications (15 notifications)
  console.log('Seeding 15 alerts/notifications...');
  const alerts = [
    { title: 'Inventory below minimum', msg: 'Raw material RAW-CMP-004 is critically below safety limits', type: NotificationType.WARNING },
    { title: 'Purchase waiting approval', msg: 'PO-2026-0004 for Global Semiconductor is pending your approval signature', type: NotificationType.INFO },
    { title: 'Invoice payment received', msg: 'Invoice INV-SLS-0001 for Alpha Tech Corp has been fully reconciled', type: NotificationType.SUCCESS },
    { title: 'Employee leave request', msg: 'Leave request for Mary Smith (HR) is pending review', type: NotificationType.INFO },
    { title: 'BOM configuration active', msg: 'BOM-SPU-001 has been set active for production routing lines', type: NotificationType.SUCCESS },
    { title: 'Production batch complete', msg: 'WO-2026-0002 has completed execution on LINE-A', type: NotificationType.SUCCESS },
    { title: 'Warehouse capacity limit reached', msg: 'Pallet Racking FG-WHS-ZONE-A-BIN-01 is currently full', type: NotificationType.WARNING },
    { title: 'Exchange rate updated', msg: 'EUR to USD currency conversion rate sync successfully completed', type: NotificationType.INFO },
    { title: 'Overdue customer invoice alert', msg: 'Sales Invoice INV-SLS-0004 is 5 days overdue', type: NotificationType.ERROR },
    { title: 'Workflow approval request', msg: 'Travel claim reimbursement request for John Johnson is awaiting review', type: NotificationType.INFO },
    { title: 'New device session detected', msg: 'Successful login verified via unknown terminal location', type: NotificationType.WARNING },
    { title: 'System database backup complete', msg: 'Daily backup archive successfully pushed to secure storage node', type: NotificationType.SUCCESS },
    { title: 'Supplier quality review due', msg: 'Supplier Precision Wire & Screw is pending monthly rating review', type: NotificationType.INFO },
    { title: 'Low fuel log warning', msg: 'Vehicle plate AMD-TRK-01 fuel level is critically low', type: NotificationType.WARNING },
    { title: 'New support ticket assigned', msg: 'Support ticket #1029 assigned for customer Alpha Tech Corp', type: NotificationType.INFO }
  ];

  for (let i = 0; i < alerts.length; i++) {
    const a = alerts[i];
    await prisma.notification.create({
      data: {
        tenantId: demoTenantId,
        userId: adminUserId,
        title: a.title,
        message: a.msg,
        type: a.type,
        isRead: false
      }
    });
  }

  // 20. Seed Audit Logs (55 logs)
  console.log('Seeding 55 audit logs...');
  const auditActions = [
    { action: 'USER_LOGIN', entity: 'User', id: adminUserId },
    { action: 'PURCHASE_ORDER_APPROVED', entity: 'PurchaseOrder', id: '33333333-3333-3333-3333-333333333333' },
    { action: 'SALES_ORDER_CREATED', entity: 'SalesOrder', id: '44444444-4444-4444-4444-444444444444' },
    { action: 'INVOICE_GENERATED', entity: 'Invoice', id: '55555555-5555-5555-5555-555555555555' },
    { action: 'STOCK_MOVEMENT', entity: 'StockMovement', id: '66666666-6666-6666-6666-666666666666' },
    { action: 'EMPLOYEE_ADDED', entity: 'Employee', id: '77777777-7777-7777-7777-777777777777' },
    { action: 'WORKFLOW_APPROVED', entity: 'WorkflowInstance', id: '88888888-8888-8888-8888-888888888888' }
  ];

  for (let i = 1; i <= 55; i++) {
    const act = auditActions[i % auditActions.length];
    await prisma.auditLog.create({
      data: {
        tenantId: demoTenantId,
        userId: adminUserId,
        action: act.action,
        entity: act.entity,
        entityId: act.id,
        createdAt: new Date(Date.now() - i * 4 * 60 * 60 * 1000)
      }
    });
  }

  console.log('Demo Environment seeding finished.');
}
