export const PermissionsList = {
  TENANT_CREATE: "tenant:create",
  TENANT_READ: "tenant:read",
  TENANT_UPDATE: "tenant:update",
  TENANT_DELETE: "tenant:delete",
  USER_CREATE: "user:create",
  USER_READ: "user:read",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  USER_RESTORE: "user:restore",
  USER_CHANGE_PASSWORD: "user:change-password",
  USER_ASSIGN_ROLE: "user:assign-role",
  ROLE_CREATE: "role:create",
  ROLE_READ: "role:read",
  ROLE_UPDATE: "role:update",
  ROLE_DELETE: "role:delete",
  ROLE_RESTORE: "role:restore",
  ROLE_ASSIGN_PERMISSION: "role:assign-permission",
  ROLE_CLONE: "role:clone",
  PERMISSION_CREATE: "permission:create",
  PERMISSION_READ: "permission:read",
  PERMISSION_UPDATE: "permission:update",
  PERMISSION_DELETE: "permission:delete",
  PERMISSION_RESTORE: "permission:restore",
  ORGANIZATION_READ: "organization:read",
  ORGANIZATION_UPDATE: "organization:update",
  SESSION_READ: "session:read",
  SESSION_REVOKE: "session:revoke",
  SESSION_REVOKE_ALL: "session:revoke-all",
  DASHBOARD_READ: "dashboard:read",
  NOTIFICATION_READ: "notification:read",
  NOTIFICATION_UPDATE: "notification:update",
  NOTIFICATION_DELETE: "notification:delete",
  MEDIA_CREATE: "media:create",
  MEDIA_READ: "media:read",
  MEDIA_UPDATE: "media:update",
  MEDIA_DELETE: "media:delete",
  MEDIA_RESTORE: "media:restore",
  REPORT_CREATE: "report:create",
  REPORT_READ: "report:read",
  REPORT_DELETE: "report:delete",

  // Department
  DEPARTMENT_CREATE: "department:create",
  DEPARTMENT_READ: "department:read",
  DEPARTMENT_UPDATE: "department:update",
  DEPARTMENT_DELETE: "department:delete",
  DEPARTMENT_RESTORE: "department:restore",

  // Designation
  DESIGNATION_CREATE: "designation:create",
  DESIGNATION_READ: "designation:read",
  DESIGNATION_UPDATE: "designation:update",
  DESIGNATION_DELETE: "designation:delete",
  DESIGNATION_RESTORE: "designation:restore",

  // Unit
  UNIT_CREATE: "unit:create",
  UNIT_READ: "unit:read",
  UNIT_UPDATE: "unit:update",
  UNIT_DELETE: "unit:delete",
  UNIT_RESTORE: "unit:restore",

  // Category
  CATEGORY_CREATE: "category:create",
  CATEGORY_READ: "category:read",
  CATEGORY_UPDATE: "category:update",
  CATEGORY_DELETE: "category:delete",
  CATEGORY_RESTORE: "category:restore",

  // Tax Category
  TAX_CATEGORY_CREATE: "tax-category:create",
  TAX_CATEGORY_READ: "tax-category:read",
  TAX_CATEGORY_UPDATE: "tax-category:update",
  TAX_CATEGORY_DELETE: "tax-category:delete",
  TAX_CATEGORY_RESTORE: "tax-category:restore",

  // Warehouse
  WAREHOUSE_CREATE: "warehouse:create",
  WAREHOUSE_READ: "warehouse:read",
  WAREHOUSE_UPDATE: "warehouse:update",
  WAREHOUSE_DELETE: "warehouse:delete",
  WAREHOUSE_RESTORE: "warehouse:restore",

  // Product Catalog
  PRODUCT_CREATE: "product:create",
  PRODUCT_READ: "product:read",
  PRODUCT_UPDATE: "product:update",
  PRODUCT_DELETE: "product:delete",
  PRODUCT_RESTORE: "product:restore",

  // Stock tracking & movements
  STOCK_READ: "stock:read",
  STOCK_MOVE_READ: "stock-movement:read",

  // Stock transfers
  STOCK_TRANSFER_CREATE: "stock-transfer:create",
  STOCK_TRANSFER_READ: "stock-transfer:read",
  STOCK_TRANSFER_UPDATE: "stock-transfer:update",
  STOCK_TRANSFER_DELETE: "stock-transfer:delete",
  STOCK_TRANSFER_PROCESS: "stock-transfer:process",

  // Stock adjustments
  STOCK_ADJUST_CREATE: "stock-adjustment:create",
  STOCK_ADJUST_READ: "stock-adjustment:read",
  STOCK_ADJUST_UPDATE: "stock-adjustment:update",
  STOCK_ADJUST_DELETE: "stock-adjustment:delete",
  STOCK_ADJUST_APPROVE: "stock-adjustment:approve",

  // Purchase Management
  PURCHASE_CREATE: "purchase:create",
  PURCHASE_READ: "purchase:read",
  PURCHASE_UPDATE: "purchase:update",
  PURCHASE_APPROVE: "purchase:approve",
  PURCHASE_RECEIVE: "purchase:receive",
  PURCHASE_CANCEL: "purchase:cancel",

  // Customer Management
  CUSTOMER_CREATE: "customer:create",
  CUSTOMER_READ: "customer:read",
  CUSTOMER_UPDATE: "customer:update",
  CUSTOMER_DELETE: "customer:delete",
  CUSTOMER_RESTORE: "customer:restore",

  // Sales Management
  SALES_CREATE: "sales:create",
  SALES_READ: "sales:read",
  SALES_UPDATE: "sales:update",
  SALES_CONFIRM: "sales:confirm",
  SALES_DELIVER: "sales:deliver",
  SALES_CANCEL: "sales:cancel",

  // Invoice & Billing Management
  INVOICE_CREATE: "invoice:create",
  INVOICE_READ: "invoice:read",
  INVOICE_UPDATE: "invoice:update",
  INVOICE_ISSUE: "invoice:issue",
  INVOICE_PAY: "invoice:pay",
  INVOICE_CANCEL: "invoice:cancel",

  // Payment Management
  PAYMENT_CREATE: "payment:create",
  PAYMENT_READ: "payment:read",
  PAYMENT_UPDATE: "payment:update",
  PAYMENT_POST: "payment:post",
  PAYMENT_REVERSE: "payment:reverse",

  // Accounting Management
  ACCOUNTING_READ: "accounting:read",
  ACCOUNTING_WRITE: "accounting:write",
  ACCOUNTING_POST: "accounting:post",
  ACCOUNTING_REVERSE: "accounting:reverse",

  // Financial Reporting
  FINANCIAL_REPORT_READ: "financial-report:read",

  // Tax Management
  TAX_RULE_WRITE: "tax:rule:write",
  TAX_RULE_READ: "tax:rule:read",
  TAX_EXEMPTION_WRITE: "tax:exemption:write",
  TAX_EXEMPTION_READ: "tax:exemption:read",
  TAX_REPORT_READ: "tax:report:read",

  // Fixed Asset Management
  FIXED_ASSET_CATEGORY_WRITE: "fixed-asset:category:write",
  FIXED_ASSET_CATEGORY_READ: "fixed-asset:category:read",
  FIXED_ASSET_ASSET_WRITE: "fixed-asset:asset:write",
  FIXED_ASSET_ASSET_READ: "fixed-asset:asset:read",
  FIXED_ASSET_DEPRECIATION_WRITE: "fixed-asset:depreciation:write",
  FIXED_ASSET_REPORT_READ: "fixed-asset:report:read",

  // Bank Reconciliation & Treasury
  BANK_ACCOUNT_WRITE: "bank:account:write",
  BANK_ACCOUNT_READ: "bank:account:read",
  BANK_TRANSACTION_WRITE: "bank:transaction:write",
  BANK_TRANSACTION_READ: "bank:transaction:read",
  BANK_RECONCILE_WRITE: "bank:reconcile:write",
  BANK_RECONCILE_READ: "bank:reconcile:read",
  BANK_DASHBOARD_READ: "bank:dashboard:read",

  // Budgeting & Forecasting
  BUDGET_WRITE: "budget:write",
  BUDGET_READ: "budget:read",
  BUDGET_APPROVE: "budget:approve",
  BUDGET_REVISION_WRITE: "budget:revision:write",
  BUDGET_REPORT_READ: "budget:report:read",

  // CRM
  CRM_LEAD_WRITE: "crm:lead:write",
  CRM_LEAD_READ: "crm:lead:read",
  CRM_OPPORTUNITY_WRITE: "crm:opportunity:write",
  CRM_OPPORTUNITY_READ: "crm:opportunity:read",
  CRM_ACTIVITY_WRITE: "crm:activity:write",
  CRM_ACTIVITY_READ: "crm:activity:read",
  CRM_DASHBOARD_READ: "crm:dashboard:read",

  // HRM
  HRM_EMPLOYEE_WRITE: "hrm:employee:write",
  HRM_EMPLOYEE_READ: "hrm:employee:read",
  HRM_DOCUMENT_WRITE: "hrm:document:write",
  HRM_DOCUMENT_READ: "hrm:document:read",
  HRM_DASHBOARD_READ: "hrm:dashboard:read",

  // Attendance
  ATTENDANCE_POLICY_WRITE: "attendance:policy:write",
  ATTENDANCE_POLICY_READ: "attendance:policy:read",
  ATTENDANCE_RECORD_WRITE: "attendance:record:write",
  ATTENDANCE_RECORD_READ: "attendance:record:read",
  ATTENDANCE_CORRECTION_APPROVE: "attendance:correction:approve",
  ATTENDANCE_DASHBOARD_READ: "attendance:dashboard:read",

  // Leave Management
  LEAVE_POLICY_WRITE: "leave:policy:write",
  LEAVE_POLICY_READ: "leave:policy:read",
  LEAVE_REQUEST_WRITE: "leave:request:write",
  LEAVE_REQUEST_READ: "leave:request:read",
  LEAVE_APPROVAL_APPROVE: "leave:approval:approve",
  LEAVE_DASHBOARD_READ: "leave:dashboard:read",

  // Payroll Management
  PAYROLL_CONFIG_WRITE: "payroll:config:write",
  PAYROLL_CONFIG_READ: "payroll:config:read",
  PAYROLL_PROCESS_WRITE: "payroll:process:write",
  PAYROLL_PROCESS_READ: "payroll:process:read",
  PAYROLL_PERIOD_LOCK: "payroll:period:lock",
  PAYROLL_DASHBOARD_READ: "payroll:dashboard:read",

  // Expense Claims Management
  EXPENSE_CLAIM_WRITE: "expense:claim:write",
  EXPENSE_CLAIM_READ: "expense:claim:read",
  EXPENSE_APPROVAL_APPROVE: "expense:approval:approve",
  EXPENSE_REIMBURSE_WRITE: "expense:reimburse:write",

  // Performance Management System (PMS)
  PMS_CYCLE_WRITE: "pms:cycle:write",
  PMS_CYCLE_READ: "pms:cycle:read",
  PMS_GOAL_WRITE: "pms:goal:write",
  PMS_GOAL_READ: "pms:goal:read",
  PMS_REVIEW_SUBMIT: "pms:review:submit",
  PMS_REVIEW_FINALIZE: "pms:review:finalize",

  // Employee Self Service (ESS) Portal
  ESS_PORTAL_READ: "ess:portal:read",
  ESS_PORTAL_WRITE: "ess:portal:write",
  ESS_ANNOUNCEMENT_WRITE: "ess:announcement:write",

  // Workflow Module
  WORKFLOW_DEFINITION_WRITE: "workflow:definition:write",
  WORKFLOW_DEFINITION_READ: "workflow:definition:read",
  WORKFLOW_INSTANCE_WRITE: "workflow:instance:write",
  WORKFLOW_INSTANCE_READ: "workflow:instance:read",
  WORKFLOW_APPROVAL_ACTION: "workflow:approval:action",
  WORKFLOW_DELEGATION_WRITE: "workflow:delegation:write",
  WORKFLOW_DELEGATION_READ: "workflow:delegation:read",
  WORKFLOW_REASSIGN_WRITE: "workflow:reassign:write",

  // Manufacturing
  MANUFACTURING_WORK_CENTER_WRITE: "manufacturing:work-center:write",
  MANUFACTURING_WORK_CENTER_READ: "manufacturing:work-center:read",
  MANUFACTURING_BOM_WRITE: "manufacturing:bom:write",
  MANUFACTURING_BOM_READ: "manufacturing:bom:read",
  MANUFACTURING_ROUTING_WRITE: "manufacturing:routing:write",
  MANUFACTURING_ROUTING_READ: "manufacturing:routing:read",
  MANUFACTURING_WORK_ORDER_WRITE: "manufacturing:work-order:write",
  MANUFACTURING_WORK_ORDER_READ: "manufacturing:work-order:read",
  MANUFACTURING_WORK_ORDER_PROCESS: "manufacturing:work-order:process",
  MANUFACTURING_MRP_PROCESS: "manufacturing:mrp:process",

  // Financial Consolidation & Multi-Company
  CONSOLIDATION_COMPANY_WRITE: "consolidation:company:write",
  CONSOLIDATION_COMPANY_READ: "consolidation:company:read",
  CONSOLIDATION_EXCHANGE_WRITE: "consolidation:exchange:write",
  CONSOLIDATION_EXCHANGE_READ: "consolidation:exchange:read",
  CONSOLIDATION_INTERCOMPANY_WRITE: "consolidation:intercompany:write",
  CONSOLIDATION_INTERCOMPANY_READ: "consolidation:intercompany:read",
  CONSOLIDATION_RUN_WRITE: "consolidation:run:write",
  CONSOLIDATION_RUN_READ: "consolidation:run:read",
} as const;
