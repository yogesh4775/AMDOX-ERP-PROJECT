"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Button } from "../../../../components/ui/button";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Dropdown list options
  const [categories, setCategories] = useState<{ label: string; value: string }[]>([]);
  const [units, setUnits] = useState<{ label: string; value: string }[]>([]);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingProd, setEditingProd] = useState<any>(null);

  // Delete Confirm State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingProd, setDeletingProd] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchLookupData = async () => {
    try {
      const [catRes, unitRes] = await Promise.all([
        apiClient("/master-data/categories?limit=100"),
        apiClient("/master-data/units?limit=100"),
      ]);
      const cats = normalizeResponse(catRes).items;
      const unts = normalizeResponse(unitRes).items;
      setCategories(cats.map((c: any) => ({ label: c.name, value: c.id })));
      setUnits(unts.map((u: any) => ({ label: u.name, value: u.id })));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/inventory/products?page=${page}&limit=10&search=${searchQuery}`);
      const normalized = normalizeResponse(res);
      setProducts(normalized.items);
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
    fetchProducts();
  }, [page, searchQuery]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    const payload = {
      ...values,
      costPrice: Number(values.costPrice || 0),
      salePrice: Number(values.salePrice || 0),
      reorderLevel: Number(values.reorderLevel || 0),
      reorderQuantity: Number(values.reorderQuantity || 0),
    };

    try {
      if (editingProd) {
        await apiClient(`/inventory/products/${editingProd.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiClient("/inventory/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setFormOpen(false);
      fetchProducts();
    } catch (err: any) {
      alert(err.message || "Failed to save product");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProd) return;
    setDeleteLoading(true);
    try {
      await apiClient(`/inventory/products/${deletingProd.id}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: deletingProd.version }),
      });
      setDeleteOpen(false);
      fetchProducts();
    } catch (err: any) {
      alert(err.message || "Failed to delete product");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    { key: "sku", header: "SKU" },
    { key: "name", header: "Product Name" },
    { key: "costPrice", header: "Cost Price", type: "currency" },
    { key: "salePrice", header: "Sale Price", type: "currency" },
    { key: "reorderLevel", header: "Reorder Level", type: "number" },
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
    { name: "sku", label: "SKU", type: "text", required: true },
    { name: "name", label: "Product Name", type: "text", required: true },
    { name: "barcode", label: "Barcode", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
    { name: "categoryId", label: "Category", type: "select", options: categories, required: true },
    { name: "unitId", label: "Unit of Measure", type: "select", options: units, required: true },
    { name: "costPrice", label: "Cost Price", type: "number", required: true },
    { name: "salePrice", label: "Sale Price", type: "number", required: true },
    { name: "reorderLevel", label: "Reorder Level", type: "number" },
    { name: "reorderQuantity", label: "Reorder Quantity", type: "number" },
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
      title="Product Catalog"
      description="View and manage corporate inventory products and pricing rules."
      breadcrumbs={[{ label: "Inventory & WMS", href: "/inventory" }, { label: "Products" }]}
      stats={[
        { label: "Total Catalog Items", value: totalCount },
        {
          label: "Active Catalog Items",
          value: products.filter((p) => p.status === "ACTIVE").length,
        },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingProd(null);
            setFormOpen(true);
          }}
        >
          Add Product
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        onEdit={(p) => {
          setEditingProd(p);
          setFormOpen(true);
        }}
        onDelete={(p) => {
          setDeletingProd(p);
          setDeleteOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search products by SKU or name..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingProd ? "Edit Product" : "Add Product"}
        fields={formFields}
        initialValues={editingProd || { status: "ACTIVE", costPrice: 0, salePrice: 0 }}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete the product "${deletingProd?.name}"?`}
        confirmText="Delete"
        loading={deleteLoading}
      />
    </ModuleLayout>
  );
}
