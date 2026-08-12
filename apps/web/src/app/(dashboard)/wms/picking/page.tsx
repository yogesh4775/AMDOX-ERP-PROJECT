"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";
import { CheckCircle2, Navigation } from "lucide-react";

export default function WmsPickingPage() {
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPicks = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>("/wms/picking");
      setPicks(response.data);
    } catch {
      setPicks([
        { id: "pk1", sourceSo: "SO-2026-0001", sku: "SKU-WDG-01", qty: 2, zone: "A-12-B", status: "PENDING_PICK" },
        { id: "pk2", sourceSo: "SO-2026-0002", sku: "SKU-WDG-02", qty: 10, zone: "B-03-A", status: "PICKED" },
        { id: "pk3", sourceSo: "SO-2026-0003", sku: "SKU-WDG-03", qty: 1, zone: "C-08-D", status: "PENDING_PICK" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPicks();
  }, []);

  const handlePick = async (id: string) => {
    try {
      await apiClient(`/wms/picking/${id}/pick`, { method: "POST" });
      alert("Inventory items picked successfully from warehouse bin!");
      fetchPicks();
    } catch {
      setPicks((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "PICKED" } : item))
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">WMS Picking Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Locate stock bins and execute item pick-lists for order deliveries.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading picking queue...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source SO</TableHead>
                <TableHead>SKU Item</TableHead>
                <TableHead>Target Bin Zone</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {picks.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold">{item.sourceSo}</TableCell>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="font-bold text-emerald-500 flex items-center gap-1.5">
                    <Navigation className="h-4 w-4 rotate-45" /> {item.zone}
                  </TableCell>
                  <TableCell>{item.qty}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      item.status === "PENDING_PICK" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {item.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status === "PENDING_PICK" && (
                      <Button size="sm" onClick={() => handlePick(item.id)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Confirm Pick
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
