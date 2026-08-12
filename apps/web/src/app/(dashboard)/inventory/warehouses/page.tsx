"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Button } from "../../../../components/ui/button";

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingWh, setEditingWh] = useState<any>(null);

  // Delete Confirm State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingWh, setDeletingWh] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/master-data/warehouses?page=${page}&limit=10${searchQuery ? `&name=${encodeURIComponent(searchQuery)}` : ""}`);
      const normalized = normalizeResponse(res);
      setWarehouses(normalized.items);
      setTotalPages(normalized.totalPages);
      setTotalCount(normalized.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, [page, searchQuery]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      if (editingWh) {
        await apiClient(`/master-data/warehouses/${editingWh.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiClient("/master-data/warehouses", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setFormOpen(false);
      fetchWarehouses();
    } catch (err: any) {
      alert(err.message || "Failed to save warehouse");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingWh) return;
    setDeleteLoading(true);
    try {
      await apiClient(`/master-data/warehouses/${deletingWh.id}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: deletingWh.version }),
      });
      setDeleteOpen(false);
      fetchWarehouses();
    } catch (err: any) {
      alert(err.message || "Failed to delete warehouse");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    { key: "code", header: "Code" },
    { key: "name", header: "Warehouse Name" },
    { key: "address", header: "Address" },
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
    { name: "code", label: "Warehouse Code", type: "text", required: true },
    { name: "name", label: "Warehouse Name", type: "text", required: true },
    { name: "address", label: "Address/Location", type: "text" },
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
      title="Warehouses"
      description="Configure logistics warehouses and inventory storage zones."
      breadcrumbs={[{ label: "Inventory & WMS", href: "/inventory" }, { label: "Warehouses" }]}
      stats={[
        { label: "Total Warehouses", value: totalCount },
        { label: "Active Warehouses", value: warehouses.filter((w) => w.status === "ACTIVE").length },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingWh(null);
            setFormOpen(true);
          }}
        >
          Add Warehouse
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={warehouses}
        loading={loading}
        onEdit={(w) => {
          setEditingWh(w);
          setFormOpen(true);
        }}
        onDelete={(w) => {
          setDeletingWh(w);
          setDeleteOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search warehouses..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingWh ? "Edit Warehouse" : "Add Warehouse"}
        fields={formFields}
        initialValues={editingWh || { status: "ACTIVE" }}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Warehouse"
        message={`Are you sure you want to delete the warehouse "${deletingWh?.name}"?`}
        confirmText="Delete"
        loading={deleteLoading}
      />
    </ModuleLayout>
  );
}
