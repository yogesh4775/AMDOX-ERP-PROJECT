"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Button } from "../../../../components/ui/button";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);

  // Delete Confirm State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCat, setDeletingCat] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/master-data/categories?page=${page}&limit=10${searchQuery ? `&name=${encodeURIComponent(searchQuery)}` : ""}`);
      const normalized = normalizeResponse(res);
      setCategories(normalized.items);
      setTotalPages(normalized.totalPages);
      setTotalCount(normalized.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [page, searchQuery]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      if (editingCat) {
        await apiClient(`/master-data/categories/${editingCat.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiClient("/master-data/categories", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setFormOpen(false);
      fetchCategories();
    } catch (err: any) {
      alert(err.message || "Failed to save category");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCat) return;
    setDeleteLoading(true);
    try {
      await apiClient(`/master-data/categories/${deletingCat.id}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: deletingCat.version }),
      });
      setDeleteOpen(false);
      fetchCategories();
    } catch (err: any) {
      alert(err.message || "Failed to delete category");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    { key: "code", header: "Code" },
    { key: "name", header: "Category Name" },
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
    { name: "code", label: "Category Code", type: "text", required: true },
    { name: "name", label: "Category Name", type: "text", required: true },
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
      title="Product Categories"
      description="Manage catalog item category mappings."
      breadcrumbs={[{ label: "Inventory & WMS", href: "/inventory" }, { label: "Categories" }]}
      stats={[
        { label: "Total Categories", value: totalCount },
        { label: "Active Categories", value: categories.filter((c) => c.status === "ACTIVE").length },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingCat(null);
            setFormOpen(true);
          }}
        >
          Add Category
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={categories}
        loading={loading}
        onEdit={(cat) => {
          setEditingCat(cat);
          setFormOpen(true);
        }}
        onDelete={(cat) => {
          setDeletingCat(cat);
          setDeleteOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search categories..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCat ? "Edit Category" : "Add Category"}
        fields={formFields}
        initialValues={editingCat || { status: "ACTIVE" }}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Are you sure you want to delete the category "${deletingCat?.name}"?`}
        confirmText="Delete"
        loading={deleteLoading}
      />
    </ModuleLayout>
  );
}
