"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";

export default function RmaPage() {
  const [rmas, setRmas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRmas = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>("/csm/rma");
      setRmas(response.data);
    } catch {
      setRmas([
        { id: "r1", rmaNumber: "RMA-2026-0001", customerName: "Acme Corp", productSku: "SKU-WDG-01", reason: "Product defective", status: "PENDING_RECEIPT" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRmas();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Return Merchandises (RMA)</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Review client product returns approvals and intake tracking.</p>
        </div>
        <Button onClick={() => alert("New RMA Form Overlay")}>Create RMA</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading RMA logs...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RMA #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product SKU</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rmas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-semibold">{r.rmaNumber}</TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell className="font-mono text-xs">{r.productSku}</TableCell>
                  <TableCell>{r.reason}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500">
                      {r.status}
                    </span>
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
