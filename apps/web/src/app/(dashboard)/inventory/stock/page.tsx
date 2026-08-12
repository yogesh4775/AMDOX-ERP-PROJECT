"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";

export default function StockPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [allStocks, setAllStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/inventory/stock");
      const normalized = normalizeResponse(res);
      setAllStocks(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, []);

  useEffect(() => {
    let filtered = allStocks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s: any) => {
        const sku = (s.product?.sku || "").toLowerCase();
        const prodName = (s.product?.name || "").toLowerCase();
        const whName = (s.warehouse?.name || "").toLowerCase();
        return sku.includes(q) || prodName.includes(q) || whName.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setStocks(filtered.slice(startIndex, startIndex + pageSize));
  }, [allStocks, searchQuery, page]);

  const formattedStocks = stocks.map((s) => ({
    ...s,
    sku: s.product?.sku || "—",
    productName: s.product?.name || "—",
    warehouseName: s.warehouse?.name || "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "sku", header: "SKU" },
    { key: "productName", header: "Product Name" },
    { key: "warehouseName", header: "Warehouse" },
    { key: "quantity", header: "Physical Stock Qty", type: "number" },
  ];

  return (
    <ModuleLayout
      title="Stock Levels"
      description="View real-time physical inventory levels across all logistics warehouses."
      breadcrumbs={[{ label: "Inventory & WMS", href: "/inventory" }, { label: "Stock Levels" }]}
      stats={[
        { label: "Total Stock Records", value: totalCount },
        {
          label: "Total Units in Stock",
          value: stocks.reduce((sum, s) => sum + Number(s.quantity || 0), 0),
        },
      ]}
    >
      <DataTable
        columns={columns}
        data={formattedStocks}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search stock levels..."
      />
    </ModuleLayout>
  );
}
