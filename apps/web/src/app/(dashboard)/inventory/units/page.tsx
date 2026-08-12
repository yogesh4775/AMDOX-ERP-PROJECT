"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Button } from "../../../../components/ui/button";

export default function UnitsPage() {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);

  // Delete Confirm State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUnit, setDeletingUnit] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/master-data/units?page=${page}&limit=10${searchQuery ? `&name=${encodeURIComponent(searchQuery)}` : ""}`);
      const normalized = normalizeResponse(res);
      setUnits(normalized.items);
      setTotalPages(normalized.totalPages);
      setTotalCount(normalized.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, [page, searchQuery]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      if (editingUnit) {
        await apiClient(`/master-data/units/${editingUnit.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiClient("/master-data/units", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setFormOpen(false);
      fetchUnits();
    } catch (err: any) {
      alert(err.message || "Failed to save unit of measure");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUnit) return;
    setDeleteLoading(true);
    try {
      await apiClient(`/master-data/units/${deletingUnit.id}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: deletingUnit.version }),
      });
      setDeleteOpen(false);
      fetchUnits();
    } catch (err: any) {
      alert(err.message || "Failed to delete unit");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    { key: "code", header: "Code" },
    { key: "name", header: "Unit Name" },
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
    { name: "code", label: "Unit Code", type: "text", required: true },
    { name: "name", label: "Unit Name", type: "text", required: true },
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
      title="Units of Measure"
      description="Manage catalog standard metric units of measurement."
      breadcrumbs={[{ label: "Inventory & WMS", href: "/inventory" }, { label: "Units" }]}
      stats={[
        { label: "Total Units", value: totalCount },
        { label: "Active Units", value: units.filter((u) => u.status === "ACTIVE").length },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingUnit(null);
            setFormOpen(true);
          }}
        >
          Add Unit
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={units}
        loading={loading}
        onEdit={(u) => {
          setEditingUnit(u);
          setFormOpen(true);
        }}
        onDelete={(u) => {
          setDeletingUnit(u);
          setDeleteOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search units..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingUnit ? "Edit Unit" : "Add Unit"}
        fields={formFields}
        initialValues={editingUnit || { status: "ACTIVE" }}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Unit"
        message={`Are you sure you want to delete the unit "${deletingUnit?.name}"?`}
        confirmText="Delete"
        loading={deleteLoading}
      />
    </ModuleLayout>
  );
}
