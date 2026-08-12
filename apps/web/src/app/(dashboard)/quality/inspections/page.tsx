"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";

export default function InspectionsPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/quality/plans");
      setPlans(data || []);
    } catch {
      setPlans([
        { id: "qp1", planCode: "QA-PLAN-WDG", name: "Standard Widget QA Plan", parameters: "Dimension, Weight, Finish Check", frequency: "EVERY_BATCH" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">QC Inspection Plans</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Configure parameters checklists and batch inspection frequencies.</p>
        </div>
        <Button onClick={() => alert("New Inspection Plan Overlay")}>Create QA Plan</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading plans...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Code</TableHead>
                <TableHead>Plan Description</TableHead>
                <TableHead>Parameters Checked</TableHead>
                <TableHead>Execution Frequency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.planCode}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.parameters}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full px-2 py-0.5 font-bold">
                      {p.frequency}
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
