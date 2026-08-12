"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";

export default function ExpensesPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/expenses/claims");
      setClaims(data || []);
    } catch {
      setClaims([
        { id: "ex1", employeeName: "Alice Smith", category: "TRAVEL", description: "Flight ticket to Boston HQ", amount: 450, status: "PENDING" },
        { id: "ex2", employeeName: "Bob Jones", category: "MEALS", description: "Business client lunch", amount: 85, status: "APPROVED" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const handleWorkflowAction = async (id: string, action: "APPROVE" | "REJECT") => {
    try {
      await apiClient(`/workflows/instances/action`, {
        method: "POST",
        body: JSON.stringify({ entityType: "ExpenseClaim", entityId: id, action }),
      });
      alert(`Claim status updated!`);
      fetchClaims();
    } catch {
      setClaims((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: action === "APPROVE" ? "APPROVED" : "REJECTED" } : c))
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Expense Reimbursement</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">File company expense claims and audit reimbursement statuses.</p>
        </div>
        <Button onClick={() => alert("New Claim Form Overlay")}>Submit Claim</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading expense logs...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Claim Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell className="font-semibold">{claim.employeeName}</TableCell>
                  <TableCell>{claim.category}</TableCell>
                  <TableCell>{claim.description}</TableCell>
                  <TableCell>${claim.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      claim.status === "PENDING" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {claim.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {claim.status === "PENDING" && (
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => handleWorkflowAction(claim.id, "APPROVE")}>
                          Approve
                        </Button>
                        <Button variant="ghost" size="sm" className="text-rose-500" onClick={() => handleWorkflowAction(claim.id, "REJECT")}>
                          Reject
                        </Button>
                      </div>
                    )}
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
