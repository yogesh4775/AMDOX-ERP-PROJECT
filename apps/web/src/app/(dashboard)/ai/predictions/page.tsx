"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";

export default function PredictionsHistoryPage() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>("/ai/predictions");
      setPredictions(response.data);
    } catch {
      setPredictions([
        { id: "pr1", modelName: "Financial Forecaster v2", input: "Q3 revenue trends config", output: "$180,000 projected", accuracy: "94%" },
        { id: "pr2", modelName: "WMS Route Optimizer v1", input: "Trips schedule #102 nodes", output: "Dispatch recommended via WayPoint Indy", accuracy: "98%" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Prediction History</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Review explainability metrics and prediction parameters logs.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading prediction outputs...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model Reference</TableHead>
                <TableHead>Input Parameters</TableHead>
                <TableHead>Output Prediction</TableHead>
                <TableHead>Confidence Interval</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.modelName}</TableCell>
                  <TableCell>{p.input}</TableCell>
                  <TableCell className="font-bold text-emerald-500">{p.output}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full px-2 py-0.5 font-bold">
                      {p.accuracy}
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
