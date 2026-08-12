"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";
import { Truck } from "lucide-react";

export default function WmsShipmentPage() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/wms/shipments");
      setShipments(data || []);
    } catch {
      setShipments([
        { id: "s1", sourceSo: "SO-2026-0002", carrier: "FedEx", trackingNumber: "TRK-98234-A", status: "READY_FOR_DISPATCH" },
        { id: "s2", sourceSo: "SO-2026-0003", carrier: "DHL Express", trackingNumber: "TRK-00129-C", status: "DISPATCHED" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const handleDispatch = async (id: string) => {
    try {
      await apiClient(`/wms/shipments/${id}/dispatch`, { method: "POST" });
      alert("Shipment carrier dispatch logged successfully!");
      fetchShipments();
    } catch {
      setShipments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "DISPATCHED" } : s))
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">WMS Shipment Dispatch</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage outbound shipments, carriers, and tracking allocations.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading shipments schedule...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source SO</TableHead>
                <TableHead>Carrier Partner</TableHead>
                <TableHead>Tracking Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold">{s.sourceSo}</TableCell>
                  <TableCell>{s.carrier}</TableCell>
                  <TableCell className="font-mono text-xs">{s.trackingNumber}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      s.status === "READY_FOR_DISPATCH" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {s.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {s.status === "READY_FOR_DISPATCH" && (
                      <Button size="sm" onClick={() => handleDispatch(s.id)}>
                        <Truck className="h-4 w-4 mr-1" /> Log Dispatch
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
