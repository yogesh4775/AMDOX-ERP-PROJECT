"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";

export default function NcrCapaPage() {
  const [ncrs, setNcrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNcrs = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/quality/ncr");
      setNcrs(data || []);
    } catch {
      setNcrs([
        { id: "ncr1", code: "NCR-2026-0001", description: "Dimension discrepancy on Widget lot B2", severity: "MAJOR", status: "AWAITING_CAPA" },
        { id: "ncr2", code: "NCR-2026-0002", description: "Surface oxidation on raw steel tubes", severity: "CRITICAL", status: "CAPA_IN_PROGRESS" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNcrs();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">NCR & CAPA Control</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage non-conformance records and corrective-preventative action workflows.</p>
        </div>
        <Button onClick={() => alert("New NCR Form Overlay")}>Create NCR Ticket</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading NCR tickets...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NCR Code</TableHead>
                <TableHead>Problem Description</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ncrs.map((ncr) => (
                <TableRow key={ncr.id}>
                  <TableCell className="font-semibold">{ncr.code}</TableCell>
                  <TableCell>{ncr.description}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      ncr.severity === "CRITICAL" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {ncr.severity}
                    </span>
                  </TableCell>
                  <TableCell>{ncr.status}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => alert(`Open CAPA workflow context for ${ncr.code}`)}>
                      Trigger CAPA
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
