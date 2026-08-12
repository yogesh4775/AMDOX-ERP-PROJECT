"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>("/accounting/budgets");
      setBudgets(response.data);
    } catch {
      setBudgets([
        { id: "b1", departmentName: "Engineering", accountName: "Software Tools & SaaS", allocated: 50000, consumed: 34500 },
        { id: "b2", departmentName: "Marketing", accountName: "Advertisements & Marketing Campaigns", allocated: 25000, consumed: 28000 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Department Budgets</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage budget limits allocations and track active consumption.</p>
        </div>
        <Button onClick={() => alert("New Budget Configuration Overlay")}>Create Budget</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading budgets...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Target Account</TableHead>
                <TableHead>Allocated Limit</TableHead>
                <TableHead>Consumed Budget</TableHead>
                <TableHead>Utilization Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((budget) => {
                const percent = Math.round((budget.consumed / budget.allocated) * 100);
                const overBudget = budget.consumed > budget.allocated;
                return (
                  <TableRow key={budget.id}>
                    <TableCell className="font-semibold">{budget.departmentName}</TableCell>
                    <TableCell>{budget.accountName}</TableCell>
                    <TableCell>${budget.allocated.toLocaleString()}</TableCell>
                    <TableCell className={overBudget ? "text-rose-500 font-bold" : "text-zinc-900 dark:text-zinc-100"}>
                      ${budget.consumed.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          overBudget ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                        }`}>
                          {percent}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
