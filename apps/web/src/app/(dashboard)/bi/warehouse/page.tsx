"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";

export default function WarehouseExplorerPage() {
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPipelines = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>("/bi/pipelines");
      setPipelines(response.data);
    } catch {
      setPipelines([
        { id: "p1", name: "GL Accounting ETL Pipeline", frequency: "HOURLY", lastSync: "2026-07-16 08:00 AM", status: "SUCCESS" },
        { id: "p2", name: "CRM Customer Leads Sync", frequency: "DAILY", lastSync: "2026-07-16 01:00 AM", status: "SUCCESS" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipelines();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Data Warehouse Explorer</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Monitor ETL data pipeline flows and warehouse syncing frequencies.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading ETL pipeline status...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ETL Pipeline Name</TableHead>
                <TableHead>Execution Frequency</TableHead>
                <TableHead>Last Executed Sync</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pipelines.map((pipe) => (
                <TableRow key={pipe.id}>
                  <TableCell className="font-semibold text-zinc-900 dark:text-zinc-50">{pipe.name}</TableCell>
                  <TableCell>{pipe.frequency}</TableCell>
                  <TableCell>{pipe.lastSync}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500">
                      {pipe.status}
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
