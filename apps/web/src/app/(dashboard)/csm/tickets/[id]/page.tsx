"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { ArrowLeft, Clock, ShieldAlert } from "lucide-react";

export default function TicketDetailsPage({ params }: { params: { id: string } }) {
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchTicket = async () => {
    try {
      const data = await apiClient(`/csm/tickets/${params.id}`);
      setTicket(data);
    } catch {
      setTicket({
        id: params.id,
        ticketNumber: "TCK-1001",
        subject: "Billing calculation error on consolidated invoice",
        customer: "Acme Corp",
        description: "Customer reports parent-subsidiary billing ratios are mismatching during currency conversions.",
        slaDeadline: "2026-07-16T18:00:00Z",
        priority: "HIGH",
        status: "OPEN",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [params.id]);

  if (loading) {
    return <div className="text-zinc-500 text-center py-10">Loading ticket details...</div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Ticket: {ticket.ticketNumber}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Ticket Description */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Ticket Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">Subject</p>
              <p>{ticket.subject}</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">Customer account</p>
              <p>{ticket.customer}</p>
            </div>
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Description</p>
              <p className="leading-relaxed">{ticket.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* SLA Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>SLA Target Benchmarks</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex items-center gap-2 text-rose-500 font-bold">
              <ShieldAlert className="h-5 w-5" /> <span>Urgent Priority</span>
            </div>
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-400 mb-1">Resolution Deadline</p>
              <p className="font-mono text-zinc-800 dark:text-zinc-200">
                {new Date(ticket.slaDeadline).toLocaleString()}
              </p>
            </div>
            <Button className="w-full mt-4" onClick={() => alert("Mark ticket as resolved")}>
              Mark as Resolved
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
