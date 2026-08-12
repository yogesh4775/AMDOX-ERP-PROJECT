"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";
import { Filters } from "../../../../components/ui/filters";

export default function LedgerPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>(`/accounting/ledger?search=${searchQuery}`);
      setEntries(response.data);
    } catch {
      setEntries([
        { id: "e1", date: "2026-07-15", reference: "JE-2026-0001", accountCode: "1110", accountName: "Main Operating Account", debit: 12000, credit: 0 },
        { id: "e2", date: "2026-07-15", reference: "JE-2026-0001", accountCode: "1200", accountName: "Accounts Receivable", debit: 0, credit: 12000 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">General Ledger</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Review journal double-entries postings history.</p>
        </div>
        <Button onClick={() => alert("New Journal Entry Form Overlay")}>New Journal Entry</Button>
      </div>

      <Filters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search journal records..."
      />

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading ledger...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Posting Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell className="font-semibold">{entry.reference}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.accountCode}</TableCell>
                  <TableCell>{entry.accountName}</TableCell>
                  <TableCell className="text-right text-emerald-500">
                    {entry.debit > 0 ? `$${entry.debit.toLocaleString()}` : "-"}
                  </TableCell>
                  <TableCell className="text-right text-zinc-500">
                    {entry.credit > 0 ? `$${entry.credit.toLocaleString()}` : "-"}
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
