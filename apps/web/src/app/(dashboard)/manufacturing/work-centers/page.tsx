"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Button } from "../../../../components/ui/button";

export default function WorkCentersPage() {
  const [centers, setCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingCenter, setEditingCenter] = useState<any>(null);

  // Delete State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCenter, setDeletingCenter] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [allCenters, setAllCenters] = useState<any[]>([]);

  const fetchWorkCenters = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/manufacturing/work-centers");
      const normalized = normalizeResponse(res);
      setAllCenters(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkCenters();
  }, []);

  useEffect(() => {
    let filtered = allCenters;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c: any) => {
        const code = (c.code || "").toLowerCase();
        const name = (c.name || "").toLowerCase();
        const status = (c.status || "").toLowerCase();
        return code.includes(q) || name.includes(q) || status.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setCenters(filtered.slice(startIndex, startIndex + pageSize));
  }, [allCenters, searchQuery, page]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      if (editingCenter) {
        await apiClient(`/manufacturing/work-centers/${editingCenter.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiClient("/manufacturing/work-centers", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setFormOpen(false);
      fetchWorkCenters();
    } catch (err: any) {
      alert(err.message || "Failed to save work center");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCenter) return;
    setDeleteLoading(true);
    try {
      await apiClient(`/manufacturing/work-centers/${deletingCenter.id}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: deletingCenter.version }),
      });
      setDeleteOpen(false);
      fetchWorkCenters();
    } catch (err: any) {
      alert(err.message || "Failed to delete work center");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    { key: "code", header: "Code" },
    { key: "name", header: "Work Center Name" },
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
    { name: "code", label: "Work Center Code", type: "text", required: true },
    { name: "name", label: "Work Center Name", type: "text", required: true },
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
      title="Work Centers"
      description="Manage production shop floor work centers and machinery lines."
      breadcrumbs={[{ label: "Manufacturing", href: "/manufacturing" }, { label: "Work Centers" }]}
      stats={[
        { label: "Total Work Centers", value: totalCount },
        { label: "Active Centers", value: centers.filter((c) => c.status === "ACTIVE").length },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingCenter(null);
            setFormOpen(true);
          }}
        >
          Add Work Center
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={centers}
        loading={loading}
        onEdit={(c) => {
          setEditingCenter(c);
          setFormOpen(true);
        }}
        onDelete={(c) => {
          setDeletingCenter(c);
          setDeleteOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search work centers..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCenter ? "Edit Work Center" : "Add Work Center"}
        fields={formFields}
        initialValues={editingCenter || { status: "ACTIVE" }}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Work Center"
        message={`Are you sure you want to delete the work center "${deletingCenter?.name}"?`}
        confirmText="Delete"
        loading={deleteLoading}
      />
    </ModuleLayout>
  );
}
