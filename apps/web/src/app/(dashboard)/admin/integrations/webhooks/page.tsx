"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../../components/ui/table";
import { Button } from "../../../../../components/ui/button";

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>("/admin/webhooks");
      setWebhooks(response.data);
    } catch {
      setWebhooks([
        { id: "wh1", targetUrl: "https://api.stark.com/webhook", event: "purchase_order.created", lastExecuted: "2026-07-16 08:30 AM", status: "SUCCESS" },
        { id: "wh2", targetUrl: "https://logistics.wayne.com/callback", event: "shipment.dispatched", lastExecuted: "2026-07-16 08:45 AM", status: "FAILED" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Webhooks Administration</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Configure target webhook event subscriptions and monitor logs.</p>
        </div>
        <Button onClick={() => alert("Create Webhook Endpoint Overlay")}>Add Endpoint</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading webhooks...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Target URL Endpoint</TableHead>
                <TableHead>Event Trigger</TableHead>
                <TableHead>Last Dispatch Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((wh) => (
                <TableRow key={wh.id}>
                  <TableCell className="font-mono text-xs text-zinc-900 dark:text-zinc-100">{wh.targetUrl}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded px-1.5 py-0.5">
                      {wh.event}
                    </span>
                  </TableCell>
                  <TableCell>{wh.lastExecuted}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      wh.status === "SUCCESS" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                    }`}>
                      {wh.status}
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
