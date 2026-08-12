"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Button } from "../../../../components/ui/button";

export default function DesignationsPage() {
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingDesg, setEditingDesg] = useState<any>(null);

  // Delete Confirm State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingDesg, setDeletingDesg] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchDesignations = async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/master-data/designations?page=${page}&limit=10${searchQuery ? `&name=${encodeURIComponent(searchQuery)}` : ""}`);
      const normalized = normalizeResponse(res);
      setDesignations(normalized.items);
      setTotalPages(normalized.totalPages);
      setTotalCount(normalized.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesignations();
  }, [page, searchQuery]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      if (editingDesg) {
        await apiClient(`/master-data/designations/${editingDesg.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiClient("/master-data/designations", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setFormOpen(false);
      fetchDesignations();
    } catch (err: any) {
      alert(err.message || "Failed to save designation");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDesg) return;
    setDeleteLoading(true);
    try {
      await apiClient(`/master-data/designations/${deletingDesg.id}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: deletingDesg.version }),
      });
      setDeleteOpen(false);
      fetchDesignations();
    } catch (err: any) {
      alert(err.message || "Failed to delete designation");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    { key: "code", header: "Code" },
    { key: "name", header: "Designation Name" },
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
    { name: "code", label: "Designation Code", type: "text", required: true },
    { name: "name", label: "Designation Name", type: "text", required: true },
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
      title="Designations"
      description="Manage corporate designations and job roles."
      breadcrumbs={[{ label: "HRM & Payroll", href: "/hrm" }, { label: "Designations" }]}
      stats={[
        { label: "Total Designations", value: totalCount },
        { label: "Active Roles", value: designations.filter((d) => d.status === "ACTIVE").length },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingDesg(null);
            setFormOpen(true);
          }}
        >
          Add Designation
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={designations}
        loading={loading}
        onEdit={(desg) => {
          setEditingDesg(desg);
          setFormOpen(true);
        }}
        onDelete={(desg) => {
          setDeletingDesg(desg);
          setDeleteOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search designations..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingDesg ? "Edit Designation" : "Add Designation"}
        fields={formFields}
        initialValues={editingDesg || { status: "ACTIVE" }}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Designation"
        message={`Are you sure you want to delete the designation "${deletingDesg?.name}"?`}
        confirmText="Delete"
        loading={deleteLoading}
      />
    </ModuleLayout>
  );
}
