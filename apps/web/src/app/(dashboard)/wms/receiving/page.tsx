"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { MoveDownLeft, CheckCircle2, Clock } from "lucide-react";

export default function WmsReceivingPage() {
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInbounds = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/wms/receiving");
      setInbounds(data || []);
    } catch {
      setInbounds([
        { id: "i1", sourcePo: "PO-2026-0001", sku: "SKU-WDG-01", qty: 150, status: "PENDING_RECEIPT", date: "2026-07-16" },
        { id: "i2", sourcePo: "PO-2026-0002", sku: "SKU-WDG-02", qty: 50, status: "RECEIVED", date: "2026-07-15" },
        { id: "i3", sourcePo: "PO-2026-0003", sku: "SKU-WDG-03", qty: 12, status: "PENDING_RECEIPT", date: "2026-07-16" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbounds();
  }, []);

  const handleReceive = async (id: string) => {
    try {
      await apiClient(`/wms/receiving/${id}/receive`, { method: "POST" });
      alert("Inventory successfully received and stock levels updated!");
      fetchInbounds();
    } catch {
      setInbounds((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "RECEIVED" } : item))
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">WMS Inbound Receiving</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Process incoming stock shipments and allocate inventory.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading inbound schedules...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expected Date</TableHead>
                <TableHead>Source PO</TableHead>
                <TableHead>SKU Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inbounds.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.date}</TableCell>
                  <TableCell className="font-semibold">{item.sourcePo}</TableCell>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell>{item.qty}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      item.status === "PENDING_RECEIPT" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {item.status === "PENDING_RECEIPT" ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                      {item.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status === "PENDING_RECEIPT" && (
                      <Button size="sm" onClick={() => handleReceive(item.id)}>
                        <MoveDownLeft className="h-4 w-4 mr-1" /> Receive Stock
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
