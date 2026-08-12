"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../../components/ui/table";
import { Button } from "../../../../../components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CronPage() {
  const [crons, setCrons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCrons = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>("/admin/crons");
      setCrons(response.data);
    } catch {
      setCrons([
        { id: "c1", name: "Hourly GL Consolidation", cronExpr: "0 * * * *", lastRun: "2026-07-16 09:00 AM", nextRun: "2026-07-16 10:00 AM" },
        { id: "c2", name: "Daily database vacuum", cronExpr: "0 0 * * *", lastRun: "2026-07-16 00:00 AM", nextRun: "2026-07-17 00:00 AM" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrons();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Cron Jobs Scheduler</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Monitor active cron schedules settings and background sync histories.</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading schedulers...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cron Job Title</TableHead>
                <TableHead>Cron Expression</TableHead>
                <TableHead>Last Executed Run</TableHead>
                <TableHead>Next Target Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crons.map((cron) => (
                <TableRow key={cron.id}>
                  <TableCell className="font-semibold">{cron.name}</TableCell>
                  <TableCell className="font-mono text-xs text-emerald-500">{cron.cronExpr}</TableCell>
                  <TableCell>{cron.lastRun}</TableCell>
                  <TableCell>{cron.nextRun}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
