"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import { Filters } from "../../../components/ui/filters";

export default function TicketDashboardPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>(`/csm/tickets?search=${searchQuery}`);
      setTickets(response.data);
    } catch {
      setTickets([
        { id: "tk1", ticketNumber: "TCK-1001", subject: "Billing calculation error on consolidated invoice", priority: "HIGH", status: "OPEN", customer: "Acme Corp" },
        { id: "tk2", ticketNumber: "TCK-1002", subject: "Portal login MFA TOTP failure issue", priority: "MEDIUM", status: "RESOLVED", customer: "Globex Inc" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Support Tickets Control</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Track client complaints, resolutions rates, and SLA benchmarks.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.location.href = "/csm/kb"}>Knowledge Base</Button>
          <Button onClick={() => alert("Create Support Ticket Overlay")}>Create Ticket</Button>
        </div>
      </div>

      <Filters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search tickets by subject or ticket number..."
      />

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading tickets...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Subject Description</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-semibold font-mono text-xs">{t.ticketNumber}</TableCell>
                  <TableCell>{t.customer}</TableCell>
                  <TableCell>{t.subject}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      t.priority === "HIGH" ? "bg-rose-500/10 text-rose-500" : "bg-zinc-500/10 text-zinc-500"
                    }`}>
                      {t.priority}
                    </span>
                  </TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => window.location.href = `/csm/tickets/${t.id}`}>
                      View details
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
