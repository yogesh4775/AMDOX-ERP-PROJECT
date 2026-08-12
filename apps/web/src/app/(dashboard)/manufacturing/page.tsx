"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";

export default function ManufacturingPage() {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/manufacturing/work-orders");
      setWorkOrders(data || []);
    } catch {
      setWorkOrders([
        { id: "wo1", woNumber: "WO-2026-0001", productSku: "SKU-WDG-01", qtyToProduce: 500, status: "IN_PROGRESS", startDate: "2026-07-16", endDate: "2026-07-20" },
        { id: "wo2", woNumber: "WO-2026-0002", productSku: "SKU-WDG-03", qtyToProduce: 50, status: "AWAITING_MATERIALS", startDate: "2026-07-18", endDate: "2026-07-22" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Manufacturing Control (MRP)</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Monitor active production work orders and routing lines scheduling.</p>
        </div>
        <Button onClick={() => alert("Configure New Work Order Overlay")}>New Work Order</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Work Centers Capacity</CardTitle>
          </CardHeader>
          <CardContent className="text-sm flex flex-col gap-2">
            <div className="flex justify-between items-center py-1">
              <span>Assembly Line Alpha</span>
              <span className="font-bold text-emerald-500">85% load</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span>Packaging Station Beta</span>
              <span className="font-bold text-amber-500">40% load</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production Calendar Actions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm flex flex-col gap-2">
            <Button variant="secondary" onClick={() => window.location.href = "/manufacturing/bom"}>
              Manage Bills of Materials (BOM)
            </Button>
            <Button variant="secondary" onClick={() => window.location.href = "/manufacturing/work-centers"}>
              Manage Work Centers
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        <h2 className="text-lg font-bold mb-4">Production Work Orders Log</h2>
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading work orders...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO #</TableHead>
                <TableHead>Target Product SKU</TableHead>
                <TableHead>Target Quantity</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workOrders.map((wo) => (
                <TableRow key={wo.id}>
                  <TableCell className="font-semibold">{wo.woNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{wo.productSku}</TableCell>
                  <TableCell>{wo.qtyToProduce} units</TableCell>
                  <TableCell>{wo.startDate}</TableCell>
                  <TableCell>{wo.endDate}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      wo.status === "IN_PROGRESS" ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {wo.status}
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
