"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { ShieldCheck, AlertCircle, Sparkles } from "lucide-react";

export default function QualityPage() {
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLots = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/quality/lots");
      setLots(data || []);
    } catch {
      setLots([
        { id: "lot1", lotNumber: "QLOT-2026-0001", sku: "SKU-WDG-01", sampleSize: 50, defects: 0, status: "PASSED" },
        { id: "lot2", lotNumber: "QLOT-2026-0002", sku: "SKU-WDG-03", sampleSize: 10, defects: 2, status: "FAILED" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLots();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Quality Management (QA/QC)</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Review inspection logs, CAPA tickets, and QA scores.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between p-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Lots inspected</span>
              <span className="text-2xl font-bold">142</span>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between p-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active NCRs</span>
              <span className="text-2xl font-bold">3</span>
            </div>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
              <AlertCircle className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between p-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">QA Acceptance Rate</span>
              <span className="text-2xl font-bold text-emerald-500">98.2%</span>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
              <Sparkles className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        <h2 className="text-lg font-bold mb-4">Inspection Lots Log</h2>
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading QA lots...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot Number</TableHead>
                <TableHead>SKU Item</TableHead>
                <TableHead>Sample Count</TableHead>
                <TableHead>Defects Count</TableHead>
                <TableHead>QA Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((lot) => (
                <TableRow key={lot.id}>
                  <TableCell className="font-semibold">{lot.lotNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{lot.sku}</TableCell>
                  <TableCell>{lot.sampleSize} units</TableCell>
                  <TableCell className={lot.defects > 0 ? "text-rose-500 font-bold" : "text-zinc-500"}>
                    {lot.defects}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      lot.status === "PASSED" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                    }`}>
                      {lot.status}
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
