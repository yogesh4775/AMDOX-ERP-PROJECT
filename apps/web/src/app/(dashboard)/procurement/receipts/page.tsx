"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";

export default function PurchaseReceiptsPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/purchase?limit=100");
      const normalized = normalizeResponse(res);
      
      // Get all POs that have receipt items
      const receivedPOs = normalized.items.filter(
        (po: any) => po.status === "RECEIVED" || po.status === "PARTIALLY_RECEIVED"
      );

      // Retrieve full details (including receipts) for each received PO
      const detailedPOs = await Promise.all(
        receivedPOs.map((po: any) => apiClient(`/purchase/${po.id}`))
      );

      // Extract receipts from PO details
      const allReceipts: any[] = [];
      detailedPOs.forEach((detail: any) => {
        const unwrapped = detail.success !== undefined ? detail.data : detail;
        if (unwrapped && Array.isArray(unwrapped.receipts)) {
          unwrapped.receipts.forEach((r: any) => {
            allReceipts.push({
              ...r,
              poNumber: unwrapped.orderNumber,
              supplierName: unwrapped.supplierName,
            });
          });
        }
      });

      // Filter by search query client-side
      const filtered = allReceipts.filter(
        (r) =>
          r.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
      );

      setReceipts(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [searchQuery]);

  const formattedReceipts = receipts.map((r) => ({
    ...r,
    formattedReceivedDate: r.createdAt ? new Date(r.createdAt).toLocaleString() : "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "poNumber", header: "PO Number" },
    { key: "supplierName", header: "Supplier/Vendor" },
    { key: "formattedReceivedDate", header: "Receipt Date" },
    { key: "receivedBy", header: "Received By User ID" },
  ];

  return (
    <ModuleLayout
      title="Purchase Receipts"
      description="View received inventory stock logs and supplier delivery notes."
      breadcrumbs={[{ label: "Procurement", href: "/procurement" }, { label: "Receipts" }]}
      stats={[
        { label: "Total Receipts Logged", value: receipts.length },
      ]}
    >
      <DataTable
        columns={columns}
        data={formattedReceipts}
        loading={loading}
        onView={(r) => {
          const itemsStr = r.items
            ?.map((it: any) => `Product ID: ${it.productId} - Qty: ${it.quantityReceived}`)
            .join("\n") || "No items listed";
          alert(`Receipt Details:\nPO: ${r.poNumber}\nSupplier: ${r.supplierName}\nDate: ${new Date(r.createdAt).toLocaleString()}\n\nItems Received:\n${itemsStr}`);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search receipts..."
      />
    </ModuleLayout>
  );
}
