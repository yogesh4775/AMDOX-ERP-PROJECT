"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../../../../components/ui/button";

export default function LogsPage() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    setLogs([
      "[2026-07-16 09:40:01] INFO  - DB connection established successfully.",
      "[2026-07-16 09:40:05] WARN  - High memory utilization threshold detected.",
      "[2026-07-16 09:41:10] INFO  - Job cycle executed. Cleaned up 4 stale session instances.",
    ]);
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">System Logs Terminal</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Stream logs events outputs from active server services.</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-300 h-[400px] overflow-y-auto flex flex-col gap-1.5 shadow-inner">
        {logs.map((log, idx) => (
          <div key={idx} className="flex gap-2">
            <span className="text-zinc-600">{(idx + 1).toString().padStart(3, "0")}</span>
            <span className={log.includes("WARN") ? "text-amber-400" : "text-zinc-300"}>{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
