"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Button } from "../../../../components/ui/button";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);

  // Delete Confirm State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingDept, setDeletingDept] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/master-data/departments?page=${page}&limit=10${searchQuery ? `&name=${encodeURIComponent(searchQuery)}` : ""}`);
      const normalized = normalizeResponse(res);
      setDepartments(normalized.items);
      setTotalPages(normalized.totalPages);
      setTotalCount(normalized.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [page, searchQuery]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      if (editingDept) {
        await apiClient(`/master-data/departments/${editingDept.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiClient("/master-data/departments", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setFormOpen(false);
      fetchDepartments();
    } catch (err: any) {
      alert(err.message || "Failed to save department");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDept) return;
    setDeleteLoading(true);
    try {
      await apiClient(`/master-data/departments/${deletingDept.id}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: deletingDept.version }),
      });
      setDeleteOpen(false);
      fetchDepartments();
    } catch (err: any) {
      alert(err.message || "Failed to delete department");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    { key: "code", header: "Code" },
    { key: "name", header: "Department Name" },
    { key: "description", header: "Description" },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeColors: {
        ACTIVE: "bg-emerald-500/10 text-emerald-500",
        INACTIVE: "bg-zinc-500/10 text-zinc-500",
      },
    },
  ];

  const formFields: FormField[] = [
    { name: "code", label: "Department Code", type: "text", required: true },
    { name: "name", label: "Department Name", type: "text", required: true },
    { name: "description", label: "Description", type: "textarea" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Inactive", value: "INACTIVE" },
      ],
      required: true,
    },
  ];

  return (
    <ModuleLayout
      title="Departments"
      description="Map corporate departments and unit supervisors."
      breadcrumbs={[{ label: "HRM & Payroll", href: "/hrm" }, { label: "Departments" }]}
      stats={[
        { label: "Total Departments", value: totalCount },
        { label: "Active Units", value: departments.filter((d) => d.status === "ACTIVE").length },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingDept(null);
            setFormOpen(true);
          }}
        >
          Add Department
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={departments}
        loading={loading}
        onEdit={(dept) => {
          setEditingDept(dept);
          setFormOpen(true);
        }}
        onDelete={(dept) => {
          setDeletingDept(dept);
          setDeleteOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search departments..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingDept ? "Edit Department" : "Add Department"}
        fields={formFields}
        initialValues={editingDept || { status: "ACTIVE" }}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Department"
        message={`Are you sure you want to delete the department "${deletingDept?.name}"?`}
        confirmText="Delete"
        loading={deleteLoading}
      />
    </ModuleLayout>
  );
}
