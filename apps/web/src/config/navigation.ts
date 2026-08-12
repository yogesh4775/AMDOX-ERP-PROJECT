import {
  LayoutDashboard,
  Users,
  Boxes,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Factory,
  Settings,
  FolderTree,
  UserCheck,
  Calendar,
  FileSpreadsheet,
  Package,
  Layers,
  Ruler,
  Warehouse,
  Container,
  BarChart2,
  History,
  UserPlus,
  FileText,
  UserSquare,
  Shield,
  Activity,
} from "lucide-react";

export interface NavSubItem {
  name: string;
  path: string;
  permission?: string;
  icon?: any;
}

export interface NavGroup {
  name: string;
  icon: any;
  permission?: string;
  subItems?: NavSubItem[];
  path?: string;
}

export const navigationConfig: NavGroup[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    name: "HR & Payroll",
    icon: Users,
    permission: "hrm:employee:read",
    subItems: [
      { name: "Departments", path: "/hrm/departments", permission: "master-data:department:read", icon: FolderTree },
      { name: "Employees", path: "/hrm/employees", permission: "hrm:employee:read", icon: UserPlus },
      { name: "Designations", path: "/hrm/designations", permission: "master-data:designation:read", icon: UserCheck },
      { name: "Attendance", path: "/hrm/attendance", permission: "attendance:record:read", icon: Calendar },
      { name: "Leave", path: "/hrm/leave", permission: "leave:request:read", icon: FileSpreadsheet },
      { name: "Payroll", path: "/hrm/payroll", permission: "payroll:run:read", icon: FileText },
    ],
  },
  {
    name: "Inventory & WMS",
    icon: Boxes,
    permission: "stock:read",
    subItems: [
      { name: "Products", path: "/inventory/products", permission: "stock:read", icon: Package },
      { name: "Categories", path: "/inventory/categories", permission: "master-data:category:read", icon: Layers },
      { name: "Units", path: "/inventory/units", permission: "master-data:unit:read", icon: Ruler },
      { name: "Warehouses", path: "/inventory/warehouses", permission: "stock:read", icon: Warehouse },
      { name: "Bins", path: "/inventory/bins", permission: "wms:bin:read", icon: Container },
      { name: "Stock", path: "/inventory/stock", permission: "stock:read", icon: BarChart2 },
      { name: "Stock Movements", path: "/inventory/movements", permission: "stock:read", icon: History },
    ],
  },
  {
    name: "Sales",
    icon: TrendingUp,
    permission: "sales:read",
    subItems: [
      { name: "Customers", path: "/sales/customers", permission: "sales:read", icon: UserSquare },
      { name: "Orders", path: "/sales/orders", permission: "sales:read", icon: FileText },
      { name: "Invoices", path: "/sales/invoices", permission: "sales:read", icon: Receipt },
    ],
  },
  {
    name: "Procurement",
    icon: ShoppingCart,
    permission: "purchase:read",
    subItems: [
      { name: "Suppliers", path: "/procurement/suppliers", permission: "purchase:read", icon: UserSquare },
      { name: "Purchase Orders", path: "/procurement/orders", permission: "purchase:read", icon: FileText },
      { name: "Receipts", path: "/procurement/receipts", permission: "purchase:read", icon: Receipt },
    ],
  },
  {
    name: "Finance",
    icon: Receipt,
    permission: "accounting:read",
    subItems: [
      { name: "Payments", path: "/finance/payments", permission: "accounting:read", icon: Receipt },
      { name: "Expense Claims", path: "/finance/expense-claims", permission: "expense:claim:read", icon: FileText },
      { name: "Invoices", path: "/finance/invoices", permission: "accounting:read", icon: Receipt },
    ],
  },
  {
    name: "Manufacturing",
    icon: Factory,
    permission: "manufacturing:bom:read",
    subItems: [
      { name: "BOM", path: "/manufacturing/bom", permission: "manufacturing:bom:read", icon: Layers },
      { name: "Work Orders", path: "/manufacturing/work-orders", permission: "manufacturing:bom:read", icon: FileText },
      { name: "Work Centers", path: "/manufacturing/work-centers", permission: "manufacturing:bom:read", icon: Settings },
    ],
  },
  {
    name: "CRM",
    icon: UserSquare,
    permission: "sales:read",
    subItems: [
      { name: "Customers", path: "/crm/customers", permission: "sales:read", icon: UserSquare },
      { name: "Contacts", path: "/crm/contacts", permission: "sales:read", icon: Users },
      { name: "Activities", path: "/crm/activities", permission: "sales:read", icon: Activity },
    ],
  },
  {
    name: "Administration",
    icon: Settings,
    permission: "user:read",
    subItems: [
      { name: "Users", path: "/admin/users", permission: "user:read", icon: Users },
      { name: "Roles", path: "/admin/roles", permission: "role:read", icon: Shield },
    ],
  },
];
