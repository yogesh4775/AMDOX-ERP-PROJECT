"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";

export default function PayrollPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/payroll/runs");
      setRuns(data || []);
    } catch {
      setRuns([
        { id: "pr1", cycleCode: "CYCLE-2026-06", startDate: "2026-06-01", endDate: "2026-06-30", totalDisbursed: 154000, status: "DISBURSED" },
        { id: "pr2", cycleCode: "CYCLE-2026-07", startDate: "2026-07-01", endDate: "2026-07-31", totalDisbursed: 158200, status: "AWAITING_APPROVAL" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Payroll Administration</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Review monthly payroll cycles and salary disbursements.</p>
        </div>
        <Button onClick={() => alert("Configure New Payroll Cycle")}>New Payroll Run</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        <h2 className="text-lg font-bold mb-4">Payroll Cycles Log</h2>
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading payroll data...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cycle Code</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Total Disbursed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-semibold">{run.cycleCode}</TableCell>
                  <TableCell>{run.startDate}</TableCell>
                  <TableCell>{run.endDate}</TableCell>
                  <TableCell>${run.totalDisbursed.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      run.status === "DISBURSED" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {run.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => window.location.href = `/payroll/slips?cycleId=${run.id}`}>
                      View slips
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
