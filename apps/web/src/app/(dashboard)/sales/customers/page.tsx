"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Button } from "../../../../components/ui/button";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingCust, setEditingCust] = useState<any>(null);

  // Delete Confirm State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCust, setDeletingCust] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/sales/customers?page=${page}&limit=10${searchQuery ? `&name=${encodeURIComponent(searchQuery)}` : ""}`);
      const normalized = normalizeResponse(res);
      setCustomers(normalized.items);
      setTotalPages(normalized.totalPages);
      setTotalCount(normalized.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, searchQuery]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      if (editingCust) {
        await apiClient(`/sales/customers/${editingCust.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiClient("/sales/customers", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setFormOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || "Failed to save customer");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCust) return;
    setDeleteLoading(true);
    try {
      await apiClient(`/sales/customers/${deletingCust.id}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: deletingCust.version }),
      });
      setDeleteOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || "Failed to delete customer");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    { key: "code", header: "Code" },
    { key: "name", header: "Customer Name" },
    { key: "email", header: "Email Address" },
    { key: "phone", header: "Phone Number" },
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
    { name: "code", label: "Customer Code", type: "text", required: true },
    { name: "name", label: "Customer Name", type: "text", required: true },
    { name: "email", label: "Email Address", type: "text" },
    { name: "phone", label: "Phone Number", type: "text" },
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
      title="Customers"
      description="Manage corporate sales customer directory."
      breadcrumbs={[{ label: "Sales & CRM", href: "/sales" }, { label: "Customers" }]}
      stats={[
        { label: "Total Customers", value: totalCount },
        { label: "Active Accounts", value: customers.filter((c) => c.status === "ACTIVE").length },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingCust(null);
            setFormOpen(true);
          }}
        >
          Add Customer
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={customers}
        loading={loading}
        onEdit={(c) => {
          setEditingCust(c);
          setFormOpen(true);
        }}
        onDelete={(c) => {
          setDeletingCust(c);
          setDeleteOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search customers..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCust ? "Edit Customer" : "Add Customer"}
        fields={formFields}
        initialValues={editingCust || { status: "ACTIVE" }}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete customer "${deletingCust?.name}"?`}
        confirmText="Delete"
        loading={deleteLoading}
      />
    </ModuleLayout>
  );
}
