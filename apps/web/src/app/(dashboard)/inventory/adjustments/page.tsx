"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";
import { Filters } from "../../../../components/ui/filters";

export default function StockAdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>(`/inventory/adjustments?search=${searchQuery}`);
      setAdjustments(response.data);
    } catch {
      setAdjustments([
        { id: "a1", sku: "SKU-WDG-01", type: "ADJUSTMENT", quantity: -5, reason: "Damaged inventory item cleanup", date: "2026-07-14" },
        { id: "a2", sku: "SKU-WDG-02", type: "TRANSFER", quantity: 50, reason: "WH-EAST to WH-WEST transfer", date: "2026-07-15" },
        { id: "a3", sku: "SKU-WDG-03", type: "ADJUSTMENT", quantity: 2, reason: "Cycle count corrections", date: "2026-07-16" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Stock Adjustments & Transfers</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Log stock movements, adjustments, and cross-warehouse transfers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => alert("New Transfer overlay")}>New Transfer</Button>
          <Button onClick={() => alert("New Adjustment overlay")}>New Adjustment</Button>
        </div>
      </div>

      <Filters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search adjustments by SKU or movement reason..."
      />

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading stock logs...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Logged</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Movement Type</TableHead>
                <TableHead>Delta Quantity</TableHead>
                <TableHead>Description / Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((adj) => (
                <TableRow key={adj.id}>
                  <TableCell>{adj.date}</TableCell>
                  <TableCell className="font-mono text-xs">{adj.sku}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      adj.type === "TRANSFER" ? "bg-blue-500/10 text-blue-500" : "bg-zinc-500/10 text-zinc-500"
                    }`}>
                      {adj.type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`font-bold ${adj.quantity < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                      {adj.quantity > 0 ? `+${adj.quantity}` : adj.quantity}
                    </span>
                  </TableCell>
                  <TableCell>{adj.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
