"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";

export default function LeavePage() {
  const [balances, setBalances] = useState<any>({});
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeaveData = async () => {
    setLoading(true);
    try {
      const data = await apiClient<{ balances: Record<string, unknown>[]; requests: Record<string, unknown>[] }>("/hrm/leave");
      setBalances(data.balances || {});
      setRequests(data.requests || []);
    } catch {
      setBalances({ annual: 15, sick: 7, casual: 3 });
      setRequests([
        { id: "lr1", type: "ANNUAL", startDate: "2026-08-01", endDate: "2026-08-05", days: 5, status: "PENDING" },
        { id: "lr2", type: "SICK", startDate: "2026-07-10", endDate: "2026-07-11", days: 1, status: "APPROVED" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Leave Management</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Request leaves and monitor annual leave allocations.</p>
        </div>
        <Button onClick={() => alert("Submit Leave Request Form")}>Submit Leave Request</Button>
      </div>

      {/* Balances Display */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex flex-col gap-1 p-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Annual Balance</span>
            <span className="text-2xl font-bold text-emerald-500">{balances.annual ?? 15} days</span>
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-1 p-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sick Balance</span>
            <span className="text-2xl font-bold text-amber-500">{balances.sick ?? 7} days</span>
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-1 p-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Casual Balance</span>
            <span className="text-2xl font-bold text-blue-500">{balances.casual ?? 3} days</span>
          </div>
        </Card>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        <h2 className="text-lg font-bold mb-4">My Requests History</h2>
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading requests...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-semibold">{r.type}</TableCell>
                  <TableCell>{r.startDate}</TableCell>
                  <TableCell>{r.endDate}</TableCell>
                  <TableCell>{r.days} days</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === "PENDING" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {r.status}
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
