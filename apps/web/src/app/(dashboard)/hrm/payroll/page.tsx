"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";

export default function PayrollPage() {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [allPayslips, setAllPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/payroll/payslips");
      const normalized = normalizeResponse(res);
      setAllPayslips(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayslips();
  }, []);

  useEffect(() => {
    let filtered = allPayslips;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p: any) => {
        const empName = `${p.employee?.firstName || ""} ${p.employee?.lastName || ""}`.toLowerCase();
        const empCode = (p.employee?.employeeCode || "").toLowerCase();
        const periodName = (p.period?.name || "").toLowerCase();
        const status = (p.status || "").toLowerCase();
        return empName.includes(q) || empCode.includes(q) || periodName.includes(q) || status.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setPayslips(filtered.slice(startIndex, startIndex + pageSize));
  }, [allPayslips, searchQuery, page]);

  const formattedPayslips = payslips.map((p) => ({
    ...p,
    employeeCode: p.employee?.employeeCode || "—",
    employeeName: p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    periodName: p.period ? `${p.period.name}` : "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "employeeCode", header: "Employee Code" },
    { key: "employeeName", header: "Employee Name" },
    { key: "periodName", header: "Payroll Period" },
    { key: "basicSalary", header: "Basic Salary", type: "currency" },
    { key: "netSalary", header: "Net Pay", type: "currency" },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeColors: {
        PAID: "bg-emerald-500/10 text-emerald-500",
        DRAFT: "bg-zinc-500/10 text-zinc-500",
        PROCESSED: "bg-blue-500/10 text-blue-500",
      },
    },
  ];

  return (
    <ModuleLayout
      title="Employee Payslips"
      description="View processed employee monthly salary statements."
      breadcrumbs={[{ label: "HRM & Payroll", href: "/hrm" }, { label: "Payroll" }]}
      stats={[
        { label: "Total Payslips", value: totalCount },
        {
          label: "Total Net Payroll",
          value: `$${payslips
            .reduce((sum, p) => sum + Number(p.netSalary || 0), 0)
            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
      ]}
    >
      <DataTable
        columns={columns}
        data={formattedPayslips}
        loading={loading}
        onView={(p) => {
          window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/payroll/payslips/${p.id}/pdf`, "_blank");
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search payslips..."
      />
    </ModuleLayout>
  );
}
