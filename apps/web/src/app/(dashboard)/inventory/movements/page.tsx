"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<any[]>([]);
  const [allMovements, setAllMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/inventory/stock/movements");
      const normalized = normalizeResponse(res);
      setAllMovements(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  useEffect(() => {
    let filtered = allMovements;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((m: any) => {
        const sku = (m.product?.sku || "").toLowerCase();
        const prodName = (m.product?.name || "").toLowerCase();
        const whName = (m.warehouse?.name || "").toLowerCase();
        const ref = (m.reference || "").toLowerCase();
        const type = (m.type || "").toLowerCase();
        return sku.includes(q) || prodName.includes(q) || whName.includes(q) || ref.includes(q) || type.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setMovements(filtered.slice(startIndex, startIndex + pageSize));
  }, [allMovements, searchQuery, page]);

  const formattedMovements = movements.map((m) => ({
    ...m,
    sku: m.product?.sku || "—",
    productName: m.product?.name || "—",
    warehouseName: m.warehouse?.name || "—",
    formattedDate: m.createdAt ? new Date(m.createdAt).toLocaleString() : "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "sku", header: "SKU" },
    { key: "productName", header: "Product Name" },
    { key: "warehouseName", header: "Warehouse" },
    { key: "quantity", header: "Quantity Moved", type: "number" },
    {
      key: "type",
      header: "Movement Type",
      type: "badge",
      badgeColors: {
        RECEIPT: "bg-emerald-500/10 text-emerald-500",
        DELIVERY: "bg-rose-500/10 text-rose-500",
        ADJUSTMENT: "bg-amber-500/10 text-amber-500",
        TRANSFER: "bg-blue-500/10 text-blue-500",
      },
    },
    { key: "reference", header: "Reference/Source Document" },
    { key: "formattedDate", header: "Movement Date" },
  ];

  return (
    <ModuleLayout
      title="Stock Movements"
      description="View full audit trail log of inventory movements, transfers, receipts, and shipments."
      breadcrumbs={[{ label: "Inventory & WMS", href: "/inventory" }, { label: "Stock Movements" }]}
      stats={[
        { label: "Total Transactions", value: totalCount },
        { label: "Recent Receipts", value: movements.filter((m) => m.type === "RECEIPT").length },
      ]}
    >
      <DataTable
        columns={columns}
        data={formattedMovements}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search stock movements..."
      />
    </ModuleLayout>
  );
}
