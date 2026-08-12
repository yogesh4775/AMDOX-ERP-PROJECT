"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Button } from "../../../../components/ui/button";

export default function BomPage() {
  const [boms, setBoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Lookups
  const [products, setProducts] = useState<{ label: string; value: string }[]>([]);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingBom, setEditingBom] = useState<any>(null);

  // Delete State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingBom, setDeletingBom] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchLookupData = async () => {
    try {
      const res = await apiClient("/inventory/products?limit=100");
      const normalized = normalizeResponse(res);
      setProducts(normalized.items.map((p: any) => ({ label: `${p.sku} - ${p.name}`, value: p.id })));
    } catch (err) {
      console.error(err);
    }
  };

  const [allBoms, setAllBoms] = useState<any[]>([]);

  const fetchBoms = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/manufacturing/boms");
      const normalized = normalizeResponse(res);
      setAllBoms(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLookupData();
    fetchBoms();
  }, []);

  useEffect(() => {
    let filtered = allBoms;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((b: any) => {
        const code = (b.code || "").toLowerCase();
        const name = (b.name || "").toLowerCase();
        const prod = (b.product?.name || "").toLowerCase();
        return code.includes(q) || name.includes(q) || prod.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setBoms(filtered.slice(startIndex, startIndex + pageSize));
  }, [allBoms, searchQuery, page]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    const payload = {
      bomNumber: values.bomNumber,
      productId: values.productId,
      quantity: Number(values.quantity || 1),
      notes: values.notes || "",
      items: [], // For simple creation, let's start with an empty items array
    };
    try {
      if (editingBom) {
        await apiClient(`/manufacturing/boms/${editingBom.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            bomNumber: values.bomNumber,
            productId: values.productId,
            quantity: Number(values.quantity || 1),
            notes: values.notes || "",
            expectedVersion: editingBom.version,
          }),
        });
      } else {
        await apiClient("/manufacturing/boms", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setFormOpen(false);
      fetchBoms();
    } catch (err: any) {
      alert(err.message || "Failed to save Bill of Materials");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmit = async (bom: any) => {
    try {
      await apiClient(`/manufacturing/boms/${bom.id}/submit`, { method: "POST" });
      fetchBoms();
    } catch (err: any) {
      alert(err.message || "Failed to submit BOM");
    }
  };

  const handleDelete = async () => {
    if (!deletingBom) return;
    setDeleteLoading(true);
    try {
      await apiClient(`/manufacturing/boms/${deletingBom.id}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: deletingBom.version }),
      });
      setDeleteOpen(false);
      fetchBoms();
    } catch (err: any) {
      alert(err.message || "Failed to delete BOM");
    } finally {
      setDeleteLoading(false);
    }
  };

  const formattedBoms = boms.map((b) => ({
    ...b,
    sku: b.product?.sku || "—",
    productName: b.product?.name || "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "bomNumber", header: "BOM Number" },
    { key: "sku", header: "SKU" },
    { key: "productName", header: "Output Product" },
    { key: "quantity", header: "Batch Quantity", type: "number" },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeColors: {
        DRAFT: "bg-zinc-500/10 text-zinc-500",
        ACTIVE: "bg-emerald-500/10 text-emerald-500",
        INACTIVE: "bg-rose-500/10 text-rose-500",
      },
    },
  ];

  const formFields: FormField[] = [
    { name: "bomNumber", label: "BOM Code", type: "text", required: true },
    { name: "productId", label: "Output Product", type: "select", options: products, required: true },
    { name: "quantity", label: "Batch Quantity", type: "number", required: true },
    { name: "notes", label: "Notes/Instructions", type: "textarea" },
  ];

  return (
    <ModuleLayout
      title="Bill of Materials"
      description="Manage product recipe components and multi-level assembly BOMs."
      breadcrumbs={[{ label: "Manufacturing", href: "/manufacturing" }, { label: "BOM" }]}
      stats={[
        { label: "Total BOM Recipes", value: totalCount },
        { label: "Active BOMs", value: boms.filter((b) => b.status === "ACTIVE").length },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingBom(null);
            setFormOpen(true);
          }}
        >
          Create BOM
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={formattedBoms}
        loading={loading}
        onView={(bom) => {
          const details = `BOM Details:\nNumber: ${bom.bomNumber}\nProduct: ${bom.productName}\nBatch Quantity: ${bom.quantity}\nStatus: ${bom.status}`;
          if (bom.status === "DRAFT") {
            if (confirm(`${details}\n\nWould you like to SUBMIT & ACTIVATE this BOM?`)) {
              handleSubmit(bom);
            }
          } else {
            alert(details);
          }
        }}
        onEdit={(bom) => {
          setEditingBom(bom);
          setFormOpen(true);
        }}
        onDelete={(bom) => {
          setDeletingBom(bom);
          setDeleteOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search BOMs..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingBom ? "Edit BOM Recipe" : "Create BOM Recipe"}
        fields={formFields}
        initialValues={editingBom || { quantity: 1 }}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete BOM"
        message={`Are you sure you want to delete the Bill of Materials "${deletingBom?.bomNumber}"?`}
        confirmText="Delete"
        loading={deleteLoading}
      />
    </ModuleLayout>
  );
}
