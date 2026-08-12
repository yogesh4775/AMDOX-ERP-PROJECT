"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { Button } from "../../../../components/ui/button";

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Lookups
  const [products, setProducts] = useState<{ label: string; value: string }[]>([]);
  const [boms, setBoms] = useState<{ label: string; value: string }[]>([]);
  const [routings, setRoutings] = useState<{ label: string; value: string }[]>([]);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [allOrders, setAllOrders] = useState<any[]>([]);

  const fetchLookupData = async () => {
    try {
      const [prodRes, bomRes, routeRes] = await Promise.all([
        apiClient("/inventory/products?limit=100"),
        apiClient("/manufacturing/boms"),
        apiClient("/manufacturing/routings"),
      ]);
      setProducts(normalizeResponse(prodRes).items.map((p: any) => ({ label: p.name, value: p.id })));
      setBoms(normalizeResponse(bomRes).items.map((b: any) => ({ label: b.name || b.bomNumber || "BOM", value: b.id })));
      setRoutings(normalizeResponse(routeRes).items.map((r: any) => ({ label: r.name, value: r.id })));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/manufacturing/work-orders");
      const normalized = normalizeResponse(res);
      setAllOrders(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLookupData();
    fetchOrders();
  }, []);

  useEffect(() => {
    let filtered = allOrders;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((o: any) => {
        const code = (o.code || "").toLowerCase();
        const prod = (o.product?.name || "").toLowerCase();
        const status = (o.status || "").toLowerCase();
        return code.includes(q) || prod.includes(q) || status.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setOrders(filtered.slice(startIndex, startIndex + pageSize));
  }, [allOrders, searchQuery, page]);

  const handleCreate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      await apiClient("/manufacturing/work-orders", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          quantity: Number(values.quantity || 1),
          plannedStartDate: new Date(values.plannedStartDate).toISOString(),
          plannedEndDate: new Date(values.plannedEndDate).toISOString(),
        }),
      });
      setFormOpen(false);
      fetchOrders();
    } catch (err: any) {
      alert(err.message || "Failed to create Work Order");
    } finally {
      setFormLoading(false);
    }
  };

  const handleWorkflow = async (wo: any, action: string) => {
    try {
      await apiClient(`/manufacturing/work-orders/${wo.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      fetchOrders();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} Work Order`);
    }
  };

  const formattedOrders = orders.map((o) => ({
    ...o,
    productName: o.product?.name || "—",
    bomCode: o.bom?.bomNumber || "—",
    formattedStart: o.plannedStartDate ? new Date(o.plannedStartDate).toLocaleDateString() : "—",
    formattedEnd: o.plannedEndDate ? new Date(o.plannedEndDate).toLocaleDateString() : "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "code", header: "WO Code" },
    { key: "productName", header: "Output Item" },
    { key: "bomCode", header: "BOM Recipe" },
    { key: "quantity", header: "Quantity", type: "number" },
    { key: "formattedStart", header: "Start Date" },
    { key: "formattedEnd", header: "End Date" },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeColors: {
        DRAFT: "bg-zinc-500/10 text-zinc-500",
        SUBMITTED: "bg-blue-500/10 text-blue-500",
        IN_PROGRESS: "bg-amber-500/10 text-amber-500",
        COMPLETED: "bg-emerald-500/10 text-emerald-500",
        CANCELLED: "bg-rose-500/10 text-rose-500",
      },
    },
  ];

  const formFields: FormField[] = [
    { name: "code", label: "Work Order Number", type: "text", required: true },
    { name: "productId", label: "Output Product", type: "select", options: products, required: true },
    { name: "bomId", label: "Bill of Materials", type: "select", options: boms, required: true },
    { name: "routingId", label: "Assembly Route", type: "select", options: routings, required: true },
    { name: "quantity", label: "Production Quantity", type: "number", required: true },
    { name: "plannedStartDate", label: "Planned Start Date", type: "date", required: true },
    { name: "plannedEndDate", label: "Planned End Date", type: "date", required: true },
  ];

  return (
    <ModuleLayout
      title="Work Orders"
      description="Issue, start, and complete workshop production assembly orders."
      breadcrumbs={[{ label: "Manufacturing", href: "/manufacturing" }, { label: "Work Orders" }]}
      stats={[
        { label: "Total Production Orders", value: totalCount },
        { label: "In Progress", value: orders.filter((o) => o.status === "IN_PROGRESS").length },
      ]}
      actions={
        <Button onClick={() => setFormOpen(true)}>
          Issue Work Order
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={formattedOrders}
        loading={loading}
        onView={(wo) => {
          const details = `Work Order Details:\nNumber: ${wo.code}\nProduct: ${wo.productName}\nQty: ${wo.quantity}\nStatus: ${wo.status}`;
          if (wo.status === "DRAFT") {
            if (confirm(`${details}\n\nWould you like to SUBMIT this Work Order?`)) {
              handleWorkflow(wo, "submit");
            }
          } else if (wo.status === "SUBMITTED") {
            if (confirm(`${details}\n\nWould you like to START production execution?`)) {
              handleWorkflow(wo, "start");
            }
          } else if (wo.status === "IN_PROGRESS") {
            const act = prompt(`${details}\n\nEnter "COMPLETE" to close production, or "CANCEL" to void:`);
            if (act?.toUpperCase() === "COMPLETE") {
              handleWorkflow(wo, "complete");
            } else if (act?.toUpperCase() === "CANCEL") {
              handleWorkflow(wo, "cancel");
            }
          } else {
            alert(details);
          }
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search work orders..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title="Issue Production Work Order"
        fields={formFields}
        onSubmit={handleCreate}
        loading={formLoading}
      />
    </ModuleLayout>
  );
}
