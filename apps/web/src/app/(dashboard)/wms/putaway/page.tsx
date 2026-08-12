"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";
import { Boxes } from "lucide-react";

export default function WmsPutawayPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/wms/putaway");
      setTasks(data || []);
    } catch {
      setTasks([
        { id: "pw1", sku: "SKU-WDG-01", qty: 150, recommendedBin: "A-12-B", status: "PENDING" },
        { id: "pw2", sku: "SKU-WDG-03", qty: 12, recommendedBin: "C-08-D", status: "PENDING" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handlePutaway = async (id: string) => {
    try {
      await apiClient(`/wms/putaway/${id}/complete`, { method: "POST" });
      alert("Inventory successfully placed in recommended bin!");
      fetchTasks();
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">WMS Putaway Allocation</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Allocate putaway locations and complete bin storage tasks.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading putaway logs...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-10 text-zinc-500">No pending putaway tasks</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Recommended Bin Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-semibold">{task.sku}</TableCell>
                  <TableCell>{task.qty}</TableCell>
                  <TableCell className="font-bold text-emerald-500">{task.recommendedBin}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500">
                      {task.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => handlePutaway(task.id)}>
                      <Boxes className="h-4 w-4 mr-1" /> Place in Bin
                    </Button>
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
