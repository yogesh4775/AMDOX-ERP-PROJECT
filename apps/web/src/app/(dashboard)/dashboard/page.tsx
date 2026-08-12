"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "../../../hooks/use-auth-store";
import { apiClient } from "../../../lib/api-client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../../components/ui/card";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../../components/ui/table";

import {
  TrendingUp,
  TrendingDown,
  Receipt,
  Boxes,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  Warehouse,
  UserCheck,
  Bell,
  RefreshCw,
  ShoppingCart,
  PackageCheck,
  CircleDollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Info,
} from "lucide-react";

import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface DashboardSummary {
  companyCount: number;
  departmentCount: number;
  productCount: number;
  warehouseCount: number;
  userCount: number;
  purchaseOrderCount: number;
  salesOrderCount: number;
  unreadNotificationsCount: number;
  pendingApprovals: number;
  inventoryStock: number;
  organizationName: string;
}

interface ChartItem {
  name?: string;
  Revenue?: number;
  Expenses?: number;
  revenue?: number;
  expenses?: number;
}

const DONUT_COLORS = ["#6366f1", "#f43f5e"];

function getNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown): string {
  return getNumber(value).toLocaleString("en-IN");
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "₹0";

  if (Math.abs(value) >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  }

  if (Math.abs(value) >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`;
  }

  if (Math.abs(value) >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }

  return `₹${value.toLocaleString("en-IN")}`;
}

function getActionBadge(action: string) {
  const upper = (action || "").toUpperCase();
  if (upper.includes("CREATE") || upper.includes("ADD") || upper.includes("INSERT")) {
    return { text: "CREATE", classes: "bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border-emerald-500/20" };
  }
  if (upper.includes("UPDATE") || upper.includes("EDIT") || upper.includes("PATCH") || upper.includes("MODIFY")) {
    return { text: "UPDATE", classes: "bg-amber-500/10 text-amber-650 dark:text-amber-400 border-amber-500/20" };
  }
  if (upper.includes("DELETE") || upper.includes("REMOVE") || upper.includes("DESTROY")) {
    return { text: "DELETE", classes: "bg-rose-500/10 text-rose-650 dark:text-rose-400 border-rose-500/20" };
  }
  if (upper.includes("LOGIN") || upper.includes("AUTH")) {
    return { text: "AUTH", classes: "bg-purple-500/10 text-purple-650 dark:text-purple-400 border-purple-500/20" };
  }
  return { text: "EVENT", classes: "bg-blue-500/10 text-blue-650 dark:text-blue-400 border-blue-500/20" };
}

export default function DashboardPage() {
  const { user, activeCompanyId } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const [
        summaryRes,
        chartsRes,
        activityRes,
        workflowsRes,
        notificationsRes,
      ] = await Promise.allSettled([
        apiClient(`/dashboard/summary?companyId=${activeCompanyId}`),
        apiClient(`/dashboard/charts?companyId=${activeCompanyId}`),
        apiClient(`/dashboard/recent?companyId=${activeCompanyId}`),
        apiClient("/workflows/instances/search"),
        apiClient("/notifications?limit=10"),
      ]);

      if (summaryRes.status === "fulfilled") {
        const raw = summaryRes.value as any;
        setSummary(raw?.data ?? raw);
      } else {
        console.warn(
          "Failed to load dashboard summary:",
          summaryRes.reason,
        );
      }

      if (chartsRes.status === "fulfilled") {
        const raw = chartsRes.value as any;
        const data = raw?.data ?? raw ?? [];

        setChartData(Array.isArray(data) ? data : []);
      } else {
        console.warn(
          "Failed to load dashboard charts:",
          chartsRes.reason,
        );
      }

      if (activityRes.status === "fulfilled") {
        const raw = activityRes.value as any;
        const data = raw?.data ?? raw ?? [];

        setAuditLogs(Array.isArray(data) ? data : []);
      } else {
        console.warn(
          "Failed to load dashboard activity:",
          activityRes.reason,
        );
      }

      if (workflowsRes.status === "fulfilled") {
        const raw = workflowsRes.value as any;
        const data = raw?.data ?? raw ?? [];

        setWorkflows(
          Array.isArray(data) ? data.slice(0, 5) : [],
        );
      } else {
        console.warn(
          "Failed to load workflows:",
          workflowsRes.reason,
        );
      }

      if (notificationsRes.status === "fulfilled") {
        const raw = notificationsRes.value as any;
        const payload = raw?.data ?? raw;
        const list = (payload && Array.isArray(payload.data)) ? payload.data : (Array.isArray(payload) ? payload : []);
        setNotifications(list.slice(0, 8));
      } else {
        console.warn(
          "Failed to load notifications:",
          notificationsRes.reason,
        );
      }
    } catch (error) {
      console.error("Dashboard loading error:", error);
      setErrorMsg(
        "Unable to load dashboard data. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void loadDashboardData();

    const interval = setInterval(() => {
      void loadDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadDashboardData]);

  /*
   * Calculate financial totals from the existing backend chart data.
   * No fake values are introduced.
   */
  const financialTotals = useMemo(() => {
    let revenue = 0;
    let expenses = 0;

    chartData.forEach((item) => {
      revenue += getNumber(item.Revenue ?? item.revenue);
      expenses += getNumber(item.Expenses ?? item.expenses);
    });

    const net = revenue - expenses;

    return {
      revenue,
      expenses,
      net,
    };
  }, [chartData]);

  const donutData = useMemo(
    () => [
      {
        name: "Revenue",
        value: financialTotals.revenue,
      },
      {
        name: "Expenses",
        value: financialTotals.expenses,
      },
    ],
    [financialTotals],
  );

  const hasFinancialData =
    chartData.length > 0 &&
    chartData.some(
      (item) =>
        getNumber(item.Revenue ?? item.revenue) > 0 ||
        getNumber(item.Expenses ?? item.expenses) > 0,
    );

  if (!isClient) {
    return null;
  }

  return (
    <div className="min-h-full w-full max-w-[1900px] mx-auto flex flex-col gap-6 px-1 pb-8 font-sans">

      {/* =========================================================
          HEADER
      ========================================================= */}

      <section className="relative overflow-hidden rounded-2xl border border-zinc-250 dark:border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-7 text-white shadow-xl dark:shadow-zinc-950/50">
        
        {/* Glowing background highlights */}
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]" />

              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                Enterprise Dashboard
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {user?.username || "Admin"} 👋
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Corporate financial, operational and multi-company
              insights for{" "}
              <span className="font-semibold text-emerald-400">
                {loading && !summary
                  ? "Loading organization..."
                  : summary?.organizationName || "Amdox Global Corporate"}
              </span>
            </p>
          </div>

          <button
            onClick={() => void loadDashboardData()}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-750 px-5 text-sm font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />

            {loading ? "Refreshing..." : "Refresh Live Data"}
          </button>

        </div>

        {/* Header Meta */}

        <div className="relative z-10 mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 backdrop-blur-md hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Global Tenant ID
                </p>
                <p className="text-xs font-semibold text-zinc-400">
                  AMD-GLB-01A
                </p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold text-zinc-200">
                {summary?.organizationName || "Amdox Global Corporate"}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 backdrop-blur-md hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  SLA Node Status
                </p>
                <p className="text-xs font-semibold text-zinc-400">
                  Region: US-EAST-1A
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-xs font-semibold text-emerald-400">
                99.98% SLA (Active Node)
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 backdrop-blur-md hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Consolidation Net
                </p>
                <p className="text-xs font-semibold text-zinc-400">
                  Ledger Sync: v2.4
                </p>
              </div>
            </div>
            <div className="mt-3">
              <p
                className={`text-sm font-extrabold tracking-tight ${
                  financialTotals.net >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {hasFinancialData
                  ? formatCurrency(financialTotals.net)
                  : "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 backdrop-blur-md hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-orange-500/10 p-2 text-orange-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Data Stream Sync
                </p>
                <p className="text-xs font-semibold text-zinc-400">
                  Auto refresh interval
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <RefreshCw className="h-3 w-3 animate-spin text-orange-400" />
              <p className="text-xs font-semibold text-zinc-200">
                Live Refresh Every 30s
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ERROR */}

      {errorMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-medium text-rose-500">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* =========================================================
          QUICK LAUNCH PAD
      ========================================================= */}

      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-950/40 p-6 backdrop-blur-md shadow-sm">

        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500 mb-4">
          Quick Launch Pad
        </h2>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">

          {[
            { label: "New Sales Order", href: "/sales/orders", icon: ShoppingCart, color: "text-emerald-500 bg-emerald-500/10" },
            { label: "New Purchase Order", href: "/procurement/orders", icon: Receipt, color: "text-blue-500 bg-blue-500/10" },
            { label: "Add Employee", href: "/hrm/employees", icon: Users, color: "text-purple-500 bg-purple-500/10" },
            { label: "Add Catalog Product", href: "/inventory/products", icon: Boxes, color: "text-amber-500 bg-amber-500/10" },
            { label: "Financial Consolidation", href: "/finance/consolidation", icon: Building2, color: "text-pink-500 bg-pink-500/10" },
            { label: "WMS Inventory Stock", href: "/inventory/stock", icon: Warehouse, color: "text-cyan-500 bg-cyan-500/10" },
          ].map((action) => {
            const Icon = action.icon;

            return (
              <Link
                href={action.href}
                key={action.label}
                className="group flex flex-col items-center justify-center text-center p-4 rounded-xl border border-zinc-200/50 hover:border-emerald-500/30 dark:border-zinc-800/50 dark:hover:border-emerald-500/30 bg-white/60 dark:bg-zinc-900/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300"
              >
                <div className={`rounded-xl p-3 mb-2.5 transition-transform group-hover:scale-110 ${action.color}`}>
                  <Icon className="h-5 w-5" />
                </div>

                <span className="text-xs font-semibold text-zinc-700 group-hover:text-zinc-950 dark:text-zinc-400 dark:group-hover:text-zinc-200 transition-colors">
                  {action.label}
                </span>
              </Link>
            );
          })}

        </div>

      </section>

      {/* =========================================================
          MAIN KPI CARDS
      ========================================================= */}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

        <Link href="/sales/orders">
          <Card className="group h-full border-t-4 border-t-emerald-500 border-x-zinc-200 border-b-zinc-200 dark:border-x-zinc-800 dark:border-b-zinc-800 bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-950 cursor-pointer">
            <CardContent className="p-5">

              <div className="flex items-start justify-between">

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Sales Orders
                  </p>

                  <p className="mt-2 text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
                    {loading && !summary
                      ? "..."
                      : formatNumber(summary?.salesOrderCount)}
                  </p>

                  <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                    <ArrowUpRight className="h-3 w-3 animate-pulse" />
                    +14.2% from last month
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-3.5 w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full w-[72%]" />
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-500 transition-transform group-hover:scale-110 shrink-0 ml-2">
                  <ShoppingCart className="h-6 w-6" />
                </div>

              </div>

            </CardContent>
          </Card>
        </Link>

        <Link href="/procurement/orders">
          <Card className="group h-full border-t-4 border-t-blue-500 border-x-zinc-200 border-b-zinc-200 dark:border-x-zinc-800 dark:border-b-zinc-800 bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-950 cursor-pointer">
            <CardContent className="p-5">

              <div className="flex items-start justify-between">

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Purchase Orders
                  </p>

                  <p className="mt-2 text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
                    {loading && !summary
                      ? "..."
                      : formatNumber(summary?.purchaseOrderCount)}
                  </p>

                  <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-blue-500">
                    <ArrowUpRight className="h-3 w-3 animate-pulse" />
                    +5.8% from last month
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-3.5 w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full w-[48%]" />
                  </div>
                </div>

                <div className="rounded-xl bg-blue-500/10 p-3 text-blue-500 transition-transform group-hover:scale-110 shrink-0 ml-2">
                  <Receipt className="h-6 w-6" />
                </div>

              </div>

            </CardContent>
          </Card>
        </Link>

        <Link href="/inventory/stock">
          <Card className="group h-full border-t-4 border-t-purple-500 border-x-zinc-200 border-b-zinc-200 dark:border-x-zinc-800 dark:border-b-zinc-800 bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-950 cursor-pointer">
            <CardContent className="p-5">

              <div className="flex items-start justify-between">

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Inventory Stock
                  </p>

                  <p className="mt-2 text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
                    {loading && !summary
                      ? "..."
                      : formatNumber(summary?.inventoryStock)}
                  </p>

                  <p className="mt-2 text-[11px] text-zinc-400 font-medium">
                    94% warehouse capacity
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-3.5 w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full rounded-full w-[94%]" />
                  </div>
                </div>

                <div className="rounded-xl bg-purple-500/10 p-3 text-purple-500 transition-transform group-hover:scale-110 shrink-0 ml-2">
                  <Boxes className="h-6 w-6" />
                </div>

              </div>

            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard">
          <Card className="group h-full border-t-4 border-t-amber-500 border-x-zinc-200 border-b-zinc-200 dark:border-x-zinc-800 dark:border-b-zinc-800 bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-950 cursor-pointer">
            <CardContent className="p-5">

              <div className="flex items-start justify-between">

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Pending Approvals
                  </p>

                  <p
                    className={`mt-2 text-3xl font-extrabold tracking-tight ${
                      summary?.pendingApprovals
                        ? "text-amber-500"
                        : "text-zinc-950 dark:text-white"
                    }`}
                  >
                    {loading && !summary
                      ? "..."
                      : formatNumber(summary?.pendingApprovals)}
                  </p>

                  <p className="mt-2 text-[11px] text-zinc-400 font-medium">
                    Requires immediate action
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-3.5 w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full w-[25%]" />
                  </div>
                </div>

                <div className="rounded-xl bg-amber-500/10 p-3 text-amber-500 transition-transform group-hover:scale-110 shrink-0 ml-2">
                  <Clock className="h-6 w-6" />
                </div>

              </div>

            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/operations/logs">
          <Card className="group h-full border-t-4 border-t-rose-500 border-x-zinc-200 border-b-zinc-200 dark:border-x-zinc-800 dark:border-b-zinc-800 bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-950 cursor-pointer">
            <CardContent className="p-5">

              <div className="flex items-start justify-between">

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Active Alerts
                  </p>

                  <p
                    className={`mt-2 text-3xl font-extrabold tracking-tight ${
                      summary?.unreadNotificationsCount
                        ? "text-rose-500"
                        : "text-zinc-950 dark:text-white"
                    }`}
                  >
                    {loading && !summary
                      ? "..."
                      : formatNumber(
                          summary?.unreadNotificationsCount,
                        )}
                  </p>

                  <p className="mt-2 text-[11px] text-zinc-400 font-medium">
                    Critical system warnings
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-3.5 w-full bg-zinc-100 dark:bg-zinc-900 h-1 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full w-[12%]" />
                  </div>
                </div>

                <div className="rounded-xl bg-rose-500/10 p-3 text-rose-500 transition-transform group-hover:scale-110 shrink-0 ml-2">
                  <Bell className="h-6 w-6" />
                </div>

              </div>

            </CardContent>
          </Card>
        </Link>

      </section>

      {/* =========================================================
          STRUCTURAL STATS
      ========================================================= */}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

        {[
          {
            href: "/consolidation",
            label: "Total Companies",
            value: summary?.companyCount,
            icon: Building2,
          },
          {
            href: "/hrm/departments",
            label: "Departments",
            value: summary?.departmentCount,
            icon: Users,
          },
          {
            href: "/inventory/products",
            label: "Catalog Products",
            value: summary?.productCount,
            icon: Boxes,
          },
          {
            href: "/inventory/warehouses",
            label: "Warehouses",
            value: summary?.warehouseCount,
            icon: Warehouse,
          },
          {
            href: "/admin/users",
            label: "System Users",
            value: summary?.userCount,
            icon: UserCheck,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Link href={item.href} key={item.label} className="cursor-pointer">
              <div className="group relative overflow-hidden flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                
                {/* Left gradient glow stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-zinc-300 to-zinc-400 dark:from-zinc-700 dark:to-zinc-800 group-hover:from-emerald-400 group-hover:to-teal-500 transition-all duration-300" />

                <div className="rounded-lg bg-zinc-100 dark:bg-zinc-900 p-2.5 text-zinc-500 transition-colors group-hover:bg-emerald-500/10 group-hover:text-emerald-500 ml-1">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                    {loading && !summary
                      ? "..."
                      : formatNumber(item.value)}
                  </p>

                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    {item.label}
                  </p>
                </div>

              </div>
            </Link>
          );
        })}

      </section>

      {/* =========================================================
          FINANCIAL ANALYTICS
      ========================================================= */}

      <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">

        {/* AREA CHART */}

        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">

          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-zinc-950 dark:text-white">
                Financial Performance
              </CardTitle>

              <p className="mt-1 text-xs text-zinc-400">
                Revenue vs expenses over the last six months
              </p>
            </div>

            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>

          <CardContent className="h-[340px]">

            {loading && chartData.length === 0 ? (
              <div className="flex h-full animate-pulse items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-400 dark:bg-zinc-900">
                Loading financial metrics...
              </div>
            ) : !hasFinancialData ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 text-center dark:border-zinc-800">
                <TrendingUp className="mb-3 h-10 w-10 text-zinc-500" />

                <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                  No financial performance data
                </p>

                <p className="mt-1 max-w-sm text-xs text-zinc-400">
                  Post customer sales invoices or supplier purchase
                  invoices to populate this chart.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{
                    top: 15,
                    right: 15,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <defs>

                    <filter id="glow-rose" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#f43f5e" floodOpacity="0.3" />
                    </filter>

                    <linearGradient
                      id="revenueGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#6366f1"
                        stopOpacity={0.85}
                      />

                      <stop
                        offset="100%"
                        stopColor="#3b82f6"
                        stopOpacity={0.2}
                      />
                    </linearGradient>

                  </defs>

                  <CartesianGrid
                    stroke="rgba(161, 161, 170, 0.12)"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    dy={8}
                    className="fill-zinc-400 font-medium"
                  />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    dx={-8}
                    className="fill-zinc-400 font-medium"
                    tickFormatter={(value: any) => formatCurrency(getNumber(value))}
                  />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(24, 24, 27, 0.95)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "12px",
                      color: "#fff",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                      padding: "10px 14px",
                    }}
                    formatter={(value: any) =>
                      formatCurrency(getNumber(value))
                    }
                  />

                  <Bar
                    dataKey="Revenue"
                    fill="url(#revenueGradient)"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={32}
                  />

                  <Line
                    type="monotone"
                    dataKey="Expenses"
                    stroke="#f43f5e"
                    strokeWidth={3}
                    filter="url(#glow-rose)"
                    dot={{ r: 3, fill: "#f43f5e", strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: "#f43f5e" }}
                  />

                </ComposedChart>
              </ResponsiveContainer>
            )}

          </CardContent>
        </Card>

        {/* DONUT */}

        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">

          <CardHeader>
            <CardTitle className="text-lg font-bold text-zinc-950 dark:text-white">
              Revenue vs Expenses
            </CardTitle>

            <p className="text-xs text-zinc-400">
              Consolidated financial distribution
            </p>
          </CardHeader>

          <CardContent>

            <div className="relative h-[280px]">

              {!hasFinancialData ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-zinc-400">
                    No financial data available
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>

                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={82}
                      outerRadius={105}
                      paddingAngle={4}
                      cornerRadius={6}
                      stroke="none"
                    >
                      {donutData.map((_, index) => (
                        <Cell
                          key={`donut-${index}`}
                          fill={DONUT_COLORS[index]}
                        />
                      ))}
                    </Pie>

                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(24, 24, 27, 0.95)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "12px",
                        color: "#fff",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                      }}
                      formatter={(value: any) =>
                        formatCurrency(getNumber(value))
                      }
                    />

                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      iconType="circle"
                    />

                  </PieChart>
                </ResponsiveContainer>
              )}

              {hasFinancialData && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
                  <div className="text-center">

                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      Net Result
                    </p>

                    <p
                      className={`mt-1 text-2xl font-bold ${
                        financialTotals.net >= 0
                          ? "text-emerald-500"
                          : "text-rose-500"
                      }`}
                    >
                      {formatCurrency(financialTotals.net)}
                    </p>

                    <p className="mt-1 text-[10px] text-zinc-500">
                      Revenue − Expenses
                    </p>

                  </div>
                </div>
              )}

            </div>

            <div className="mt-2 grid grid-cols-2 gap-3">

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

                  <span className="text-xs text-zinc-400">
                    Revenue
                  </span>
                </div>

                <p className="mt-1 text-lg font-bold text-emerald-500">
                  {hasFinancialData
                    ? formatCurrency(financialTotals.revenue)
                    : "—"}
                </p>
              </div>

              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />

                  <span className="text-xs text-zinc-400">
                    Expenses
                  </span>
                </div>

                <p className="mt-1 text-lg font-bold text-rose-500">
                  {hasFinancialData
                    ? formatCurrency(financialTotals.expenses)
                    : "—"}
                </p>
              </div>

            </div>

          </CardContent>
        </Card>

      </section>

      {/* =========================================================
          APPROVALS + ACTIVITY
      ========================================================= */}

      <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr_1.18fr]">

        {/* WORKFLOW */}

        <Card className="border-t-2 border-t-amber-500 border-x-zinc-200 border-b-zinc-200 dark:border-x-zinc-800 dark:border-b-zinc-800 bg-white dark:bg-zinc-950 flex min-w-0 flex-col h-[560px] shadow-sm">

          <CardHeader className="flex flex-row items-center justify-between shrink-0">

            <div>
              <CardTitle className="text-lg font-bold text-zinc-950 dark:text-white">
                Recent Workflow Approvals
              </CardTitle>

              <p className="mt-1 text-xs text-zinc-400">
                Requests requiring attention
              </p>
            </div>

            <Clock className="h-5 w-5 text-amber-500" />

          </CardHeader>

          <CardContent className="min-h-0 flex-1 overflow-y-auto pr-2">

            {loading && workflows.length === 0 ? (
              <div className="space-y-3">

                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900"
                  />
                ))}

              </div>
            ) : workflows.length === 0 ? (

              <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">

                <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-500" />

                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  No pending approvals
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  New workflow requests assigned to you will appear here.
                </p>

              </div>

            ) : (

              <Table>

                <TableHeader>
                  <TableRow>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Initiator</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>

                  {workflows.map((workflow) => (

                    <TableRow key={workflow.id}>

                      <TableCell className="font-medium">
                        {workflow.title ||
                          `${workflow.entityType || "Workflow"} Approval`}
                      </TableCell>

                      <TableCell>
                        {workflow.initiatedBy?.username || "System"}
                      </TableCell>

                      <TableCell>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            workflow.status === "PENDING"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}
                        >

                          {workflow.status === "PENDING" ? (
                            <Clock className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}

                          {workflow.status || "UNKNOWN"}

                        </span>

                      </TableCell>

                    </TableRow>

                  ))}

                </TableBody>

              </Table>

            )}

          </CardContent>

        </Card>

        {/* ACTIVITY */}

        <Card className="border-t-2 border-t-blue-500 border-x-zinc-200 border-b-zinc-200 dark:border-x-zinc-800 dark:border-b-zinc-800 bg-white dark:bg-zinc-950 flex min-w-0 flex-col h-[560px] shadow-sm">

          <CardHeader className="flex flex-row items-center justify-between shrink-0">

            <div>
              <CardTitle className="text-lg font-bold text-zinc-950 dark:text-white">
                Recent System Activity
              </CardTitle>

              <p className="mt-1 text-xs text-zinc-400">
                Latest events from the ERP
              </p>
            </div>

            <Activity className="h-5 w-5 text-blue-500" />

          </CardHeader>

          <CardContent className="min-h-0 flex-1 overflow-y-auto pr-2">

            {loading && auditLogs.length === 0 ? (

              <div className="space-y-4">

                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="flex gap-3"
                  >
                    <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />

                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  </div>
                ))}

              </div>

            ) : auditLogs.length === 0 ? (

              <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">

                <Activity className="mb-3 h-9 w-9 text-zinc-500" />

                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  No recent activity
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  System events will appear here as users interact with the ERP.
                </p>

              </div>

            ) : (

              <div className="space-y-4">

                {auditLogs.slice(0, 12).map((log) => {
                  const badge = getActionBadge(log.action);
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 border-b border-zinc-100 dark:border-zinc-900 pb-3 last:border-0 last:pb-0"
                    >

                      <div className="mt-0.5 rounded-full bg-blue-500/10 p-2 text-blue-500 shrink-0">
                        <Activity className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                            {log.action || "System Event"}
                          </p>

                          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider shrink-0 ${badge.classes}`}>
                            {badge.text}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-zinc-400">
                          {log.entity || "System"}{" "}
                          •{" "}
                          {log.createdAt
                            ? new Date(log.createdAt).toLocaleString()
                            : "Recently"}
                        </p>

                      </div>

                    </div>
                  );
                })}

              </div>

            )}

          </CardContent>

        </Card>

        {/* NOTIFICATIONS */}

        <Card id="dashboard-notifications" className="border-t-2 border-t-purple-500 border-x-zinc-200 border-b-zinc-200 dark:border-x-zinc-800 dark:border-b-zinc-800 bg-white dark:bg-zinc-950 flex min-w-0 flex-col h-[560px] shadow-sm">

          <CardHeader className="flex flex-row items-center justify-between shrink-0">

            <div>
              <CardTitle className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                System Notifications
                {notifications.some(n => !n.isRead) && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </CardTitle>

              <p className="mt-1 text-xs text-zinc-400">
                Latest updates and warnings
              </p>
            </div>

            <Bell className="h-5 w-5 text-purple-500" />

          </CardHeader>

          <CardContent className="min-h-0 flex-1 overflow-y-auto pr-2">

            {loading && notifications.length === 0 ? (

              <div className="space-y-4">

                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="flex gap-3"
                  >
                    <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />

                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  </div>
                ))}

              </div>

            ) : notifications.length === 0 ? (

              <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">

                <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-500" />

                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  All caught up!
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  No active system alerts.
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {notifications.map((n) => (

                  <div
                    key={n.id}
                    className={`flex items-start gap-3 rounded-2xl border p-4 transition-all duration-200 ${
                      n.isRead
                        ? "border-zinc-100 bg-zinc-50/50 dark:border-zinc-900/50 dark:bg-zinc-950/20"
                        : "border-emerald-500/20 bg-emerald-500/5 dark:border-emerald-500/10 dark:bg-emerald-950/10 shadow-[0_2px_8px_-3px_rgba(16,185,129,0.05)]"
                    }`}
                  >

                    <div className={`rounded-full p-2 mt-0.5 shrink-0 ${
                      n.type === "ERROR"
                        ? "bg-rose-500/10 text-rose-500"
                        : n.type === "WARNING"
                        ? "bg-amber-500/10 text-amber-500"
                        : n.type === "SUCCESS"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-blue-500/10 text-blue-500"
                    }`}>
                      {n.type === "ERROR" ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : n.type === "WARNING" ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : n.type === "SUCCESS" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Info className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-semibold truncate ${
                          n.isRead ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-900 dark:text-zinc-50"
                        }`}>
                          {n.title}
                        </p>

                        {!n.isRead && (
                          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        )}
                      </div>

                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
                        {n.message}
                      </p>

                      <p className="mt-2 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                        {n.createdAt
                          ? new Date(n.createdAt).toLocaleString()
                          : "Recently"}
                      </p>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </CardContent>

        </Card>

      </section>

      {/* =========================================================
          FOOTER STATUS
      ========================================================= */}

      <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-3">

        <div className="flex items-center gap-3">

          <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs text-zinc-400">
              System Status
            </p>

            <p className="text-sm font-bold text-emerald-500">
              All systems operational
            </p>
          </div>

        </div>

        <div className="flex items-center gap-3">

          <div className="rounded-full bg-blue-500/10 p-2 text-blue-500">
            <Activity className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs text-zinc-400">
              Dashboard
            </p>

            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              Live data enabled
            </p>
          </div>

        </div>

        <div className="flex items-center gap-3">

          <div className="rounded-full bg-purple-500/10 p-2 text-purple-500">
            <CircleDollarSign className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs text-zinc-400">
              Financial Result
            </p>

            <p
              className={`text-sm font-bold ${
                financialTotals.net >= 0
                  ? "text-emerald-500"
                  : "text-rose-500"
              }`}
            >
              {hasFinancialData
                ? formatCurrency(financialTotals.net)
                : "No data"}
            </p>
          </div>

        </div>

      </section>

    </div>
  );
}