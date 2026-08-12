"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { Button } from "../../../../components/ui/button";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Dropdown options
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [designations, setDesignations] = useState<{ label: string; value: string }[]>([]);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any>(null);

  const fetchLookupData = async () => {
    try {
      const [deptRes, desRes] = await Promise.all([
        apiClient("/master-data/departments?limit=100"),
        apiClient("/master-data/designations?limit=100"),
      ]);
      const depts = normalizeResponse(deptRes).items;
      const desgs = normalizeResponse(desRes).items;
      setDepartments(depts.map((d: any) => ({ label: d.name, value: d.id })));
      setDesignations(desgs.map((d: any) => ({ label: d.name, value: d.id })));
    } catch (err) {
      console.error("Failed to load lookup data", err);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/hrm/employees${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ""}`);
      const normalized = normalizeResponse(res);
      setEmployees(normalized.items);
      setTotalPages(normalized.totalPages);
      setTotalCount(normalized.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLookupData();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [page, searchQuery]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      if (editingEmp) {
        await apiClient(`/hrm/employees/${editingEmp.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiClient("/hrm/employees", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setFormOpen(false);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message || "Failed to save employee");
    } finally {
      setFormLoading(false);
    }
  };

  const formattedEmployees = employees.map((emp) => ({
    ...emp,
    fullName: `${emp.firstName} ${emp.lastName}`,
    departmentName: emp.department?.name || "—",
    designationName: emp.designation?.name || "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "employeeCode", header: "Employee ID" },
    { key: "fullName", header: "Name" },
    { key: "departmentName", header: "Department" },
    { key: "designationName", header: "Designation" },
    { key: "email", header: "Email" },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeColors: {
        ACTIVE: "bg-emerald-500/10 text-emerald-500",
        TERMINATED: "bg-rose-500/10 text-rose-500",
        SUSPENDED: "bg-amber-500/10 text-amber-500",
      },
    },
  ];

  const formFields: FormField[] = [
    { name: "employeeCode", label: "Employee Code", type: "text", required: true },
    { name: "firstName", label: "First Name", type: "text", required: true },
    { name: "lastName", label: "Last Name", type: "text", required: true },
    { name: "email", label: "Email Address", type: "text", required: true },
    { name: "phone", label: "Phone Number", type: "text" },
    { name: "departmentId", label: "Department", type: "select", options: departments },
    { name: "designationId", label: "Designation", type: "select", options: designations },
    {
      name: "employmentType",
      label: "Employment Type",
      type: "select",
      options: [
        { label: "Full Time", value: "FULL_TIME" },
        { label: "Part Time", value: "PART_TIME" },
        { label: "Contract", value: "CONTRACT" },
        { label: "Intern", value: "INTERN" },
      ],
    },
    { name: "joiningDate", label: "Joining Date", type: "date", required: true },
  ];

  return (
    <ModuleLayout
      title="Employee Registry"
      description="View and manage corporate employment roster records."
      breadcrumbs={[{ label: "HRM & Payroll", href: "/hrm" }, { label: "Employees" }]}
      stats={[
        { label: "Total Employees", value: totalCount },
        { label: "Full-Time staff", value: employees.filter((e) => e.employmentType === "FULL_TIME").length },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingEmp(null);
            setFormOpen(true);
          }}
        >
          Add Employee
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={formattedEmployees}
        loading={loading}
        onView={(emp) => {
          window.location.href = `/hrm/employees/${emp.id}`;
        }}
        onEdit={(emp) => {
          setEditingEmp(emp);
          setFormOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search employees..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingEmp ? "Edit Employee" : "Add Employee"}
        fields={formFields}
        initialValues={
          editingEmp
            ? {
                ...editingEmp,
                joiningDate: editingEmp.joiningDate ? editingEmp.joiningDate.split("T")[0] : "",
              }
            : { employmentType: "FULL_TIME" }
        }
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />
    </ModuleLayout>
  );
}
