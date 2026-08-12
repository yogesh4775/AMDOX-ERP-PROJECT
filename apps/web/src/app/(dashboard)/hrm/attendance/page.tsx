"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { Button } from "../../../../components/ui/button";

export default function AttendancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Dropdown list of employees
  const [employees, setEmployees] = useState<{ label: string; value: string }[]>([]);
  const [allRecords, setAllRecords] = useState<any[]>([]);

  // Actions states
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchEmployees = async () => {
    try {
      const res = await apiClient("/hrm/employees");
      const normalized = normalizeResponse(res);
      setEmployees(normalized.items.map((e: any) => ({
        label: `${e.employeeCode} - ${e.firstName} ${e.lastName}`,
        value: e.id,
      })));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/attendance/records");
      const normalized = normalizeResponse(res);
      setAllRecords(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, []);

  useEffect(() => {
    let filtered = allRecords;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r: any) => {
        const empName = `${r.employee?.firstName || ""} ${r.employee?.lastName || ""}`.toLowerCase();
        const empCode = (r.employee?.employeeCode || "").toLowerCase();
        const status = (r.status || "").toLowerCase();
        return empName.includes(q) || empCode.includes(q) || status.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setRecords(filtered.slice(startIndex, startIndex + pageSize));
  }, [allRecords, searchQuery, page]);

  const handleCheckIn = async (values: Record<string, any>) => {
    setActionLoading(true);
    try {
      await apiClient("/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({
          employeeId: values.employeeId,
          timestamp: new Date().toISOString(),
        }),
      });
      setCheckInOpen(false);
      fetchAttendance();
    } catch (err: any) {
      alert(err.message || "Failed to check in");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async (values: Record<string, any>) => {
    setActionLoading(true);
    try {
      await apiClient("/attendance/check-out", {
        method: "POST",
        body: JSON.stringify({
          employeeId: values.employeeId,
          timestamp: new Date().toISOString(),
        }),
      });
      setCheckOutOpen(false);
      fetchAttendance();
    } catch (err: any) {
      alert(err.message || "Failed to check out");
    } finally {
      setActionLoading(false);
    }
  };

  const formattedRecords = records.map((r) => ({
    ...r,
    employeeCode: r.employee?.employeeCode || "—",
    employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : "—",
    formattedCheckIn: r.checkIn ? new Date(r.checkIn).toLocaleString() : "—",
    formattedCheckOut: r.checkOut ? new Date(r.checkOut).toLocaleString() : "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "employeeCode", header: "Employee Code" },
    { key: "employeeName", header: "Employee Name" },
    { key: "formattedCheckIn", header: "Check In Time" },
    { key: "formattedCheckOut", header: "Check Out Time" },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeColors: {
        PRESENT: "bg-emerald-500/10 text-emerald-500",
        ABSENT: "bg-rose-500/10 text-rose-500",
        LATE: "bg-amber-500/10 text-amber-500",
        HALF_DAY: "bg-blue-500/10 text-blue-500",
      },
    },
  ];

  const formFields: FormField[] = [
    { name: "employeeId", label: "Select Employee", type: "select", options: employees, required: true },
  ];

  return (
    <ModuleLayout
      title="Attendance Records"
      description="Track daily check-in and check-out logs for employees."
      breadcrumbs={[{ label: "HRM & Payroll", href: "/hrm" }, { label: "Attendance" }]}
      stats={[
        { label: "Total Logs", value: totalCount },
        { label: "Present today", value: records.filter((r) => r.status === "PRESENT").length },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCheckOutOpen(true)}>
            Check Out
          </Button>
          <Button onClick={() => setCheckInOpen(true)}>
            Check In
          </Button>
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={formattedRecords}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search attendance logs..."
      />

      <FormDialog
        isOpen={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        title="Employee Check In"
        fields={formFields}
        onSubmit={handleCheckIn}
        loading={actionLoading}
      />

      <FormDialog
        isOpen={checkOutOpen}
        onClose={() => setCheckOutOpen(false)}
        title="Employee Check Out"
        fields={formFields}
        onSubmit={handleCheckOut}
        loading={actionLoading}
      />
    </ModuleLayout>
  );
}
