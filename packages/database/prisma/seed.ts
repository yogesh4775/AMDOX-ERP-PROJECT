import { PrismaClient } from '../generated';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding system permissions...');

  const permissions = [
    { name: 'tenant:create', description: 'Create tenant' },
    { name: 'tenant:read', description: 'Read tenant' },
    { name: 'tenant:update', description: 'Update tenant' },
    { name: 'tenant:delete', description: 'Delete tenant' },
    { name: 'tenant:write', description: 'Write tenant' },
    { name: 'user:create', description: 'Create user' },
    { name: 'user:read', description: 'Read user' },
    { name: 'user:update', description: 'Update user' },
    { name: 'user:delete', description: 'Delete user' },
    { name: 'user:restore', description: 'Restore user' },
    { name: 'user:change-password', description: 'Change user password' },
    { name: 'user:assign-role', description: 'Assign user roles' },
    { name: 'user:write', description: 'Write user' },
    { name: 'role:create', description: 'Create role' },
    { name: 'role:read', description: 'Read role' },
    { name: 'role:update', description: 'Update role' },
    { name: 'role:delete', description: 'Delete role' },
    { name: 'role:restore', description: 'Restore role' },
    { name: 'role:assign-permission', description: 'Assign role permissions' },
    { name: 'role:clone', description: 'Clone role' },
    { name: 'role:write', description: 'Write role' },
    { name: 'permission:create', description: 'Create permission' },
    { name: 'permission:read', description: 'Read permission' },
    { name: 'permission:update', description: 'Update permission' },
    { name: 'permission:delete', description: 'Delete permission' },
    { name: 'permission:restore', description: 'Restore permission' },
    { name: 'organization:read', description: 'Read organization settings' },
    { name: 'organization:update', description: 'Update organization settings' },
    { name: 'session:read', description: 'Read active/revoked sessions' },
    { name: 'session:revoke', description: 'Revoke single session' },
    { name: 'session:revoke-all', description: 'Revoke all sessions' },
    { name: 'dashboard:read', description: 'Read dashboard foundation metrics' },
    { name: 'notification:read', description: 'Read notifications' },
    { name: 'notification:update', description: 'Update notification status' },
    { name: 'notification:delete', description: 'Delete notifications' },
    { name: 'media:create', description: 'Create media upload' },
    { name: 'media:read', description: 'Read media files' },
    { name: 'media:update', description: 'Update media metadata' },
    { name: 'media:delete', description: 'Delete media file' },
    { name: 'media:restore', description: 'Restore deleted media file' },
    { name: 'report:create', description: 'Request report export' },
    { name: 'report:read', description: 'Read report jobs' },
    { name: 'report:delete', description: 'Delete report job' },

    // Department
    { name: 'department:create', description: 'Create department' },
    { name: 'department:read', description: 'Read departments' },
    { name: 'department:update', description: 'Update department' },
    { name: 'department:delete', description: 'Delete department' },
    { name: 'department:restore', description: 'Restore deleted department' },

    // Designation
    { name: 'designation:create', description: 'Create designation' },
    { name: 'designation:read', description: 'Read designations' },
    { name: 'designation:update', description: 'Update designation' },
    { name: 'designation:delete', description: 'Delete designation' },
    { name: 'designation:restore', description: 'Restore deleted designation' },

    // Unit
    { name: 'unit:create', description: 'Create unit' },
    { name: 'unit:read', description: 'Read units' },
    { name: 'unit:update', description: 'Update unit' },
    { name: 'unit:delete', description: 'Delete unit' },
    { name: 'unit:restore', description: 'Restore deleted unit' },

    // Category
    { name: 'category:create', description: 'Create category' },
    { name: 'category:read', description: 'Read categories' },
    { name: 'category:update', description: 'Update category' },
    { name: 'category:delete', description: 'Delete category' },
    { name: 'category:restore', description: 'Restore deleted category' },

    // Tax Category
    { name: 'tax-category:create', description: 'Create tax category' },
    { name: 'tax-category:read', description: 'Read tax categories' },
    { name: 'tax-category:update', description: 'Update tax category' },
    { name: 'tax-category:delete', description: 'Delete tax category' },
    { name: 'tax-category:restore', description: 'Restore deleted tax category' },

    // Warehouse
    { name: 'warehouse:create', description: 'Create warehouse' },
    { name: 'warehouse:read', description: 'Read warehouses' },
    { name: 'warehouse:update', description: 'Update warehouse' },
    { name: 'warehouse:delete', description: 'Delete warehouse' },
    { name: 'warehouse:restore', description: 'Restore deleted warehouse' },

    // Product Catalog
    { name: 'product:create', description: 'Create product' },
    { name: 'product:read', description: 'Read products' },
    { name: 'product:update', description: 'Update product' },
    { name: 'product:delete', description: 'Delete product' },
    { name: 'product:restore', description: 'Restore deleted product' },

    // Stock tracking & movements
    { name: 'stock:read', description: 'Read stock balances' },
    { name: 'stock-movement:read', description: 'Read stock movement history' },

    // Stock transfers
    { name: 'stock-transfer:create', description: 'Create stock transfer' },
    { name: 'stock-transfer:read', description: 'Read stock transfers' },
    { name: 'stock-transfer:update', description: 'Update stock transfer' },
    { name: 'stock-transfer:delete', description: 'Delete stock transfer' },
    { name: 'stock-transfer:process', description: 'Process stock transfer' },

    // Stock adjustments
    { name: 'stock-adjustment:create', description: 'Create stock adjustment' },
    { name: 'stock-adjustment:read', description: 'Read stock adjustments' },
    { name: 'stock-adjustment:update', description: 'Update stock adjustment' },
    { name: 'stock-adjustment:delete', description: 'Delete stock adjustment' },
    { name: 'stock-adjustment:approve', description: 'Approve stock adjustment' },

    // Purchase Management
    { name: 'purchase:create', description: 'Create purchase order' },
    { name: 'purchase:read', description: 'Read purchase orders' },
    { name: 'purchase:update', description: 'Update purchase order' },
    { name: 'purchase:approve', description: 'Approve purchase order' },
    { name: 'purchase:receive', description: 'Receive purchase order items' },
    { name: 'purchase:cancel', description: 'Cancel purchase order' },

    // Customer Management
    { name: 'customer:create', description: 'Create customer' },
    { name: 'customer:read', description: 'Read customers' },
    { name: 'customer:update', description: 'Update customer' },
    { name: 'customer:delete', description: 'Delete customer' },
    { name: 'customer:restore', description: 'Restore customer' },

    // Sales Management
    { name: 'sales:create', description: 'Create sales order' },
    { name: 'sales:read', description: 'Read sales orders' },
    { name: 'sales:update', description: 'Update sales order' },
    { name: 'sales:confirm', description: 'Confirm sales order' },
    { name: 'sales:deliver', description: 'Deliver sales order items' },
    { name: 'sales:cancel', description: 'Cancel sales order' },

    // Invoice & Billing Management
    { name: 'invoice:create', description: 'Create invoice' },
    { name: 'invoice:read', description: 'Read invoices' },
    { name: 'invoice:update', description: 'Update invoice' },
    { name: 'invoice:issue', description: 'Issue invoice' },
    { name: 'invoice:pay', description: 'Record invoice payment' },
    { name: 'invoice:cancel', description: 'Cancel invoice' },

    // Payment Management
    { name: 'payment:create', description: 'Create payment' },
    { name: 'payment:read', description: 'Read payments' },
    { name: 'payment:update', description: 'Update payment' },
    { name: 'payment:post', description: 'Post payment' },
    { name: 'payment:reverse', description: 'Reverse payment' },

    // Accounting Management
    { name: 'accounting:read', description: 'Read Chart of Accounts and journals' },
    { name: 'accounting:write', description: 'Create and update accounts and journals' },
    { name: 'accounting:post', description: 'Post draft journal entries' },
    { name: 'accounting:reverse', description: 'Reverse posted journal entries' },

    // Financial Reporting
    { name: 'financial-report:read', description: 'Read dynamic financial reports' },

    // Tax Management
    { name: 'tax:rule:write', description: 'Create and update tax rules' },
    { name: 'tax:rule:read', description: 'Read tax rules' },
    { name: 'tax:exemption:write', description: 'Create and update tax exemptions' },
    { name: 'tax:exemption:read', description: 'Read tax exemptions' },
    { name: 'tax:report:read', description: 'Read tax transactions and reports' },

    // Fixed Asset Management
    { name: 'fixed-asset:category:write', description: 'Create and update asset categories' },
    { name: 'fixed-asset:category:read', description: 'Read asset categories' },
    { name: 'fixed-asset:asset:write', description: 'Acquire, transfer, maintain, and dispose assets' },
    { name: 'fixed-asset:asset:read', description: 'Read assets' },
    { name: 'fixed-asset:depreciation:write', description: 'Run asset depreciation calculations' },
    { name: 'fixed-asset:report:read', description: 'Read fixed asset reports and exports' },

    // Bank Reconciliation & Treasury
    { name: 'bank:account:write', description: 'Create and update bank accounts' },
    { name: 'bank:account:read', description: 'Read bank accounts' },
    { name: 'bank:transaction:write', description: 'Post bank deposits, withdrawals, and transfers' },
    { name: 'bank:transaction:read', description: 'Read bank transaction history' },
    { name: 'bank:reconcile:write', description: 'Perform matching and complete reconciliation' },
    { name: 'bank:reconcile:read', description: 'Read bank statements and match records' },
    { name: 'bank:dashboard:read', description: 'Read treasury dashboard and cash forecasting' },

    // Budgeting & Forecasting
    { name: 'budget:write', description: 'Create and update budgets' },
    { name: 'budget:read', description: 'Read budgets' },
    { name: 'budget:approve', description: 'Approve or reject budgets' },
    { name: 'budget:revision:write', description: 'Create budget revisions' },
    { name: 'budget:report:read', description: 'Read budget summary, variance, and forecast reports' },

    // CRM
    { name: 'crm:lead:write', description: 'Create and update leads' },
    { name: 'crm:lead:read', description: 'Read leads' },
    { name: 'crm:opportunity:write', description: 'Create and update opportunities' },
    { name: 'crm:opportunity:read', description: 'Read opportunities' },
    { name: 'crm:activity:write', description: 'Create and update activities logs' },
    { name: 'crm:activity:read', description: 'Read activity history timeline' },
    { name: 'crm:dashboard:read', description: 'Read CRM forecasting and pipelines summary' },

    // HRM
    { name: 'hrm:employee:write', description: 'Create and update employees' },
    { name: 'hrm:employee:read', description: 'Read employee directory and details' },
    { name: 'hrm:document:write', description: 'Manage employee documents' },
    { name: 'hrm:document:read', description: 'Read employee documents' },
    { name: 'hrm:dashboard:read', description: 'Read HRM dashboard metrics' },

    // Attendance
    { name: 'attendance:policy:write', description: 'Create and update attendance policies' },
    { name: 'attendance:policy:read', description: 'Read attendance policies' },
    { name: 'attendance:record:write', description: 'Perform employee check-in and check-out' },
    { name: 'attendance:record:read', description: 'Read attendance records' },
    { name: 'attendance:correction:approve', description: 'Approve or reject attendance corrections' },
    { name: 'attendance:dashboard:read', description: 'Read attendance dashboard metrics' },

    // Leave Management
    { name: 'leave:policy:write', description: 'Create and update leave policies' },
    { name: 'leave:policy:read', description: 'Read leave policies' },
    { name: 'leave:request:write', description: 'Submit and manage leave requests' },
    { name: 'leave:request:read', description: 'Read leave requests' },
    { name: 'leave:approval:approve', description: 'Approve or reject leave requests' },
    { name: 'leave:dashboard:read', description: 'Read leave dashboard metrics' },

    // Payroll Management
    { name: 'payroll:config:write', description: 'Create and update salary structures and components' },
    { name: 'payroll:config:read', description: 'Read salary configurations' },
    { name: 'payroll:process:write', description: 'Process payroll period payslips' },
    { name: 'payroll:process:read', description: 'Read payroll registers and payslips' },
    { name: 'payroll:period:lock', description: 'Lock payroll period and post General Ledger journal entries' },
    { name: 'payroll:dashboard:read', description: 'Read payroll dashboard metrics' },

    // Expense Claims Management
    { name: 'expense:claim:write', description: 'Create and update expense claims' },
    { name: 'expense:claim:read', description: 'Read expense claims register and details' },
    { name: 'expense:approval:approve', description: 'Approve or reject expense claims' },
    { name: 'expense:reimburse:write', description: 'Reimburse approved expense claims and post General Ledger entries' },

    // Performance Management System (PMS)
    { name: 'pms:cycle:write', description: 'Create and update appraisal cycles' },
    { name: 'pms:cycle:read', description: 'Read appraisal cycles' },
    { name: 'pms:goal:write', description: 'Create and update performance goals' },
    { name: 'pms:goal:read', description: 'Read performance goals' },
    { name: 'pms:review:submit', description: 'Submit self and manager performance reviews' },
    { name: 'pms:review:finalize', description: 'Finalize performance review ratings and complete appraisals' },
    
    // Employee Self Service (ESS) Portal
    { name: 'ess:portal:read', description: 'Read own ESS portal data' },
    { name: 'ess:portal:write', description: 'Update profile and submit requests via ESS portal' },
    { name: 'ess:announcement:write', description: 'Create and update company announcements' },
    { name: 'workflow:definition:write', description: 'Create and update workflow definitions' },
    { name: 'workflow:definition:read', description: 'Read workflow definitions' },
    { name: 'workflow:instance:write', description: 'Submit and manage workflow instances' },
    { name: 'workflow:instance:read', description: 'Read workflow instances history' },
    { name: 'workflow:approval:action', description: 'Approve or reject workflow tasks' },
    { name: 'workflow:delegation:write', description: 'Create and manage delegations' },
    { name: 'workflow:delegation:read', description: 'Read delegations' },
    { name: 'workflow:reassign:write', description: 'Manually reassign pending tasks' },
    // Manufacturing permissions
    { name: 'manufacturing:work-center:write', description: 'Create and manage work centers' },
    { name: 'manufacturing:work-center:read', description: 'Read work centers' },
    { name: 'manufacturing:bom:write', description: 'Create and manage bills of materials' },
    { name: 'manufacturing:bom:read', description: 'Read bills of materials' },
    { name: 'manufacturing:routing:write', description: 'Create and manage routings and operations' },
    { name: 'manufacturing:routing:read', description: 'Read routings and operations' },
    { name: 'manufacturing:work-order:write', description: 'Create and manage work orders' },
    { name: 'manufacturing:work-order:read', description: 'Read work orders' },
    { name: 'manufacturing:work-order:process', description: 'Start, log operations, and complete work orders' },
    { name: 'manufacturing:mrp:process', description: 'Trigger material requirements planning runs' },
    // Quality Management permissions
    { name: 'quality:plan:write', description: 'Create and manage inspection plans' },
    { name: 'quality:plan:read', description: 'Read inspection plans' },
    { name: 'quality:lot:write', description: 'Create and manage inspection lots' },
    { name: 'quality:lot:read', description: 'Read inspection lots' },
    { name: 'quality:lot:process', description: 'Record inspection results and defects' },
    { name: 'quality:ncr:write', description: 'Manage Non-Conformance Reports (NCR)' },
    { name: 'quality:ncr:read', description: 'Read Non-Conformance Reports' },
    { name: 'quality:capa:write', description: 'Manage CAPAs' },
    { name: 'quality:capa:read', description: 'Read CAPAs' },
    { name: 'quality:rating:read', description: 'Read supplier quality ratings' },
    { name: 'quality:certificate:write', description: 'Create and approve certificates' },
    { name: 'quality:certificate:read', description: 'Read certificates' },
    // WMS permissions
    { name: 'wms:zone:write', description: 'Create and manage warehouse zones' },
    { name: 'wms:zone:read', description: 'Read warehouse zones' },
    { name: 'wms:bin:write', description: 'Create and manage warehouse bins' },
    { name: 'wms:bin:read', description: 'Read warehouse bins' },
    { name: 'wms:movement:write', description: 'Initiate and manage bin-to-bin movements' },
    { name: 'wms:movement:read', description: 'Read bin movement history' },
    { name: 'wms:rule:write', description: 'Manage putaway rules' },
    { name: 'wms:rule:read', description: 'Read putaway rules' },
    { name: 'wms:cycle-count:write', description: 'Create, counted, and manage cycle counts' },
    { name: 'wms:cycle-count:read', description: 'Read cycle count audits' },
    { name: 'wms:cycle-count:approve', description: 'Approve cycle counts and variance GL entries' },
    // TMS permissions
    { name: 'tms:fleet:write', description: 'Create and update vehicle/driver/carrier fleet data' },
    { name: 'tms:fleet:read', description: 'Read vehicle/driver/carrier fleet data' },
    { name: 'tms:shipment:write', description: 'Create, consolidate, and update shipments' },
    { name: 'tms:shipment:read', description: 'Read shipments' },
    { name: 'tms:trip:write', description: 'Create, route, dispatch, complete, and update trips' },
    { name: 'tms:trip:read', description: 'Read trips' },
    // CSM permissions
    { name: 'csm:ticket:write', description: 'Create and update support tickets' },
    { name: 'csm:ticket:read', description: 'Read support tickets' },
    { name: 'csm:contract:write', description: 'Create and update service contracts' },
    { name: 'csm:contract:read', description: 'Read service contracts' },
    { name: 'csm:rma:write', description: 'Create and process RMAs' },
    { name: 'csm:rma:read', description: 'Read RMA requests' },
    { name: 'csm:visit:write', description: 'Create and update service visits' },
    { name: 'csm:visit:read', description: 'Read service visits' },
    { name: 'csm:kb:write', description: 'Create and update knowledge base articles' },
    { name: 'csm:kb:read', description: 'Read knowledge base articles' },
    // BI permissions
    { name: 'bi:dashboard:read', description: 'Read BI dashboard widgets and executive metrics' },
    { name: 'bi:kpi:write', description: 'Create, update and evaluate KPIs' },
    { name: 'bi:kpi:read', description: 'Read KPIs and history' },
    { name: 'bi:report:write', description: 'Create and update custom reports and schedules' },
    { name: 'bi:report:read', description: 'Read and run custom reports, export data' },
    // AI permissions
    { name: 'ai:model:write', description: 'Train and manage registered models' },
    { name: 'ai:model:read', description: 'Read registered models and jobs status' },
    { name: 'ai:prediction:read', description: 'Read prediction history and run evaluations' },
    { name: 'ai:insight:read', description: 'Read recommendations and anomalies' },
    { name: 'ai:insight:write', description: 'Apply recommendations and resolve anomalies' },
    // Integration permissions
    { name: 'integration:key:write', description: 'Create, rotate and revoke API keys' },
    { name: 'integration:key:read', description: 'Read developer API keys' },
    { name: 'integration:webhook:write', description: 'Register and trigger webhook retries' },
    { name: 'integration:webhook:read', description: 'Read webhook configurations and deliveries' },
    { name: 'integration:provider:write', description: 'Connect and disconnect SaaS providers' },
    { name: 'integration:provider:read', description: 'Read SaaS provider configurations' },
    { name: 'integration:analytics:read', description: 'Read API gateway request usage analytics' },
    { name: 'consolidation:company:write', description: 'Create and update companies' },
    { name: 'consolidation:company:read', description: 'Read companies and hierarchies' },
    { name: 'consolidation:exchange:write', description: 'Update currency exchange rates' },
    { name: 'consolidation:exchange:read', description: 'Read exchange rates' },
    { name: 'consolidation:intercompany:write', description: 'Create and process intercompany transactions' },
    { name: 'consolidation:intercompany:read', description: 'Read intercompany transactions' },
    { name: 'consolidation:run:write', description: 'Run financial consolidation and eliminations' },
    { name: 'consolidation:run:read', description: 'Read consolidation runs and reports' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {
        description: perm.description,
        isSystem: true,
      },
      create: {
        name: perm.name,
        description: perm.description,
        isSystem: true,
      },
    });
  }

  console.log('Seeding default system tenant...');
  const defaultTenantId = '00000000-0000-0000-0000-000000000000';
  await prisma.tenant.upsert({
    where: { id: defaultTenantId },
    update: {},
    create: {
      id: defaultTenantId,
      name: 'Default System Tenant',
      slug: 'default-system-tenant',
    },
  });

  console.log('Seeding default users and roles...');
  const passwordHash = await argon2.hash("Password_1234_Special!", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const defaultUsers = [
    { email: 'admin@amdox.com', username: 'admin', role: 'Admin' },
    { email: 'sales@amdox.com', username: 'sales', role: 'SALES_MANAGER' },
    { email: 'warehouse@amdox.com', username: 'warehouse', role: 'WAREHOUSE_USER' },
    { email: 'employee@amdox.com', username: 'employee', role: 'EMPLOYEE' },
  ];

  const allPermissions = await prisma.permission.findMany();

  for (const u of defaultUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        emailVerified: true,
      },
      create: {
        email: u.email,
        username: u.username,
        passwordHash,
        tenantId: defaultTenantId,
        failedLoginAttempts: 0,
        lockedUntil: null,
        emailVerified: true,
      },
    });

    const role = await prisma.role.upsert({
      where: {
        name_tenantId: {
          name: u.role,
          tenantId: defaultTenantId,
        },
      },
      update: {},
      create: {
        name: u.role,
        tenantId: defaultTenantId,
      },
    });

    // If it's the Admin role, assign all system permissions to it
    if (u.role === 'Admin') {
      for (const perm of allPermissions) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
    }

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
        tenantId: defaultTenantId,
      },
    });
  }

  // Also seed SUPER_ADMIN role for the admin user
  const adminUserRecord = await prisma.user.findFirst({ where: { email: 'admin@amdox.com' } });
  if (adminUserRecord) {
    const superAdminRole = await prisma.role.upsert({
      where: {
        name_tenantId: {
          name: "SUPER_ADMIN",
          tenantId: defaultTenantId,
        },
      },
      update: {},
      create: {
        name: "SUPER_ADMIN",
        tenantId: defaultTenantId,
      },
    });

    for (const perm of allPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: perm.id,
        },
      });
    }

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUserRecord.id,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUserRecord.id,
        roleId: superAdminRole.id,
        tenantId: defaultTenantId,
      },
    });
  }

  console.log('Database seeding completed successfully.');

  if (process.env.SEED_DEMO === 'true' || process.env.NODE_ENV !== 'production') {
    const { runDemoSeeder } = require('./demo-seeder');
    await runDemoSeeder(prisma);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
