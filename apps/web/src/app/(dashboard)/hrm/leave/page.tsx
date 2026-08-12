"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Button } from "../../../../components/ui/button";

export default function LeavePage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Dropdowns
  const [employees, setEmployees] = useState<{ label: string; value: string }[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<{ label: string; value: string }[]>([]);

  // Actions
  const [requestOpen, setRequestOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Approve/Reject Confirm State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [targetRequest, setTargetRequest] = useState<any>(null);

  const [allRequests, setAllRequests] = useState<any[]>([]);

  const fetchLookupData = async () => {
    try {
      const empRes = await apiClient("/hrm/employees");
      const emps = normalizeResponse(empRes).items;
      setEmployees(emps.map((e: any) => ({
        label: `${e.employeeCode} - ${e.firstName} ${e.lastName}`,
        value: e.id,
      })));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/leave/requests");
      const normalized = normalizeResponse(res);
      setAllRequests(normalized.items);

      // Populate leaveTypes from loaded requests dynamically
      const typeMap = new Map<string, string>();
      normalized.items.forEach((r: any) => {
        if (r.leaveType) {
          typeMap.set(r.leaveTypeId, r.leaveType.name);
        }
      });
      if (typeMap.size > 0) {
        setLeaveTypes(Array.from(typeMap.entries()).map(([k, v]) => ({ label: v, value: k })));
      } else {
        // Fallback standard options
        setLeaveTypes([
          { label: "Annual Leave", value: "ANNUAL" },
          { label: "Sick Leave", value: "SICK" },
          { label: "Unpaid Leave", value: "UNPAID" },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLookupData();
    fetchLeaveRequests();
  }, []);

  useEffect(() => {
    let filtered = allRequests;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r: any) => {
        const empName = `${r.employee?.firstName || ""} ${r.employee?.lastName || ""}`.toLowerCase();
        const empCode = (r.employee?.employeeCode || "").toLowerCase();
        const typeName = (r.leaveType?.name || "").toLowerCase();
        const status = (r.status || "").toLowerCase();
        return empName.includes(q) || empCode.includes(q) || typeName.includes(q) || status.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setRequests(filtered.slice(startIndex, startIndex + pageSize));
  }, [allRequests, searchQuery, page]);

  const handleRequestLeave = async (values: Record<string, any>) => {
    setActionLoading(true);
    try {
      await apiClient("/leave/requests", {
        method: "POST",
        body: JSON.stringify({
          employeeId: values.employeeId,
          leaveTypeId: values.leaveTypeId,
          startDate: values.startDate,
          endDate: values.endDate,
          isHalfDay: values.isHalfDay === "true",
          reason: values.reason,
        }),
      });
      setRequestOpen(false);
      fetchLeaveRequests();
    } catch (err: any) {
      alert(err.message || "Failed to submit leave request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveOrReject = async () => {
    if (!targetRequest || !confirmAction) return;
    setActionLoading(true);
    try {
      const subpath = confirmAction === "APPROVE" ? "approve" : "reject";
      await apiClient(`/leave/requests/${targetRequest.id}/${subpath}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: "Processed by admin" }),
      });
      setConfirmOpen(false);
      fetchLeaveRequests();
    } catch (err: any) {
      alert(err.message || "Failed to process leave request");
    } finally {
      setActionLoading(false);
    }
  };

  const formattedRequests = requests.map((r) => ({
    ...r,
    employeeCode: r.employee?.employeeCode || "—",
    employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : "—",
    leaveTypeName: r.leaveType?.name || "—",
    formattedStart: r.startDate ? new Date(r.startDate).toLocaleDateString() : "—",
    formattedEnd: r.endDate ? new Date(r.endDate).toLocaleDateString() : "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "employeeCode", header: "Employee Code" },
    { key: "employeeName", header: "Employee Name" },
    { key: "leaveTypeName", header: "Leave Type" },
    { key: "formattedStart", header: "Start Date" },
    { key: "formattedEnd", header: "End Date" },
    { key: "reason", header: "Reason" },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeColors: {
        APPROVED: "bg-emerald-500/10 text-emerald-500",
        REJECTED: "bg-rose-500/10 text-rose-500",
        PENDING: "bg-amber-500/10 text-amber-500",
        CANCELLED: "bg-zinc-500/10 text-zinc-500",
      },
    },
  ];

  const formFields: FormField[] = [
    { name: "employeeId", label: "Select Employee", type: "select", options: employees, required: true },
    { name: "leaveTypeId", label: "Leave Type", type: "select", options: leaveTypes, required: true },
    { name: "startDate", label: "Start Date", type: "date", required: true },
    { name: "endDate", label: "End Date", type: "date", required: true },
    {
      name: "isHalfDay",
      label: "Half Day?",
      type: "select",
      options: [
        { label: "No", value: "false" },
        { label: "Yes", value: "true" },
      ],
    },
    { name: "reason", label: "Reason/Notes", type: "textarea", required: true },
  ];

  return (
    <ModuleLayout
      title="Leave Requests"
      description="Manage employee paid time off and vacation requests."
      breadcrumbs={[{ label: "HRM & Payroll", href: "/hrm" }, { label: "Leave" }]}
      stats={[
        { label: "Total Requests", value: totalCount },
        { label: "Pending Approvals", value: requests.filter((r) => r.status === "PENDING").length },
      ]}
      actions={
        <Button onClick={() => setRequestOpen(true)}>
          New Request
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={formattedRequests}
        loading={loading}
        actions={
          // Add quick action slot if a row is selected
          null
        }
        onView={(req) => {
          if (req.status === "PENDING") {
            setTargetRequest(req);
            setConfirmAction("APPROVE");
            setConfirmOpen(true);
          } else {
            alert(`Leave request status is already ${req.status}`);
          }
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search leave requests..."
      />

      <FormDialog
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Submit Leave Request"
        fields={formFields}
        onSubmit={handleRequestLeave}
        loading={actionLoading}
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleApproveOrReject}
        title={confirmAction === "APPROVE" ? "Approve Leave" : "Reject Leave"}
        message={`Are you sure you want to ${confirmAction?.toLowerCase()} the leave request for ${targetRequest?.employeeName}?`}
        confirmText={confirmAction === "APPROVE" ? "Approve" : "Reject"}
        loading={actionLoading}
      />
    </ModuleLayout>
  );
}
