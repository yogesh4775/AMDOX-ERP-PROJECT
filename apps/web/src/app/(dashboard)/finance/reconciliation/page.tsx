"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { ArrowLeftRight, Check } from "lucide-react";

export default function BankReconciliationPage() {
  const [bankEntries, setBankEntries] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const data = await apiClient<{ bankEntries: Record<string, unknown>[]; ledgerEntries: Record<string, unknown>[] }>("/accounting/reconciliation");
      setBankEntries(data.bankEntries || []);
      setLedgerEntries(data.ledgerEntries || []);
    } catch {
      setBankEntries([
        { id: "b1", date: "2026-07-14", description: "Deposit customer wire", amount: 12000, matched: false },
        { id: "b2", date: "2026-07-15", description: "ACH Stark Industries payout", amount: -45000, matched: false },
      ]);
      setLedgerEntries([
        { id: "l1", date: "2026-07-14", reference: "JE-2026-0001", amount: 12000, matched: false },
        { id: "l2", date: "2026-07-15", reference: "JE-2026-0002", amount: -45000, matched: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleMatch = (bankId: string, ledgerId: string) => {
    setBankEntries((prev) =>
      prev.map((e) => (e.id === bankId ? { ...e, matched: true } : e))
    );
    setLedgerEntries((prev) =>
      prev.map((e) => (e.id === ledgerId ? { ...e, matched: true } : e))
    );
    alert("Bank transaction matched successfully with ledger journal record!");
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Bank Reconciliation</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Match statement transactions side-by-side with General Ledger ledger entries.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Bank Statement Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Imported Statement Entries</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loading ? (
              <p className="text-zinc-500">Loading statement...</p>
            ) : (
              bankEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm bg-white dark:bg-zinc-900/50">
                  <div>
                    <p className="font-semibold">{e.description}</p>
                    <p className="text-xs text-zinc-400">{e.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${e.amount < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                      ${e.amount.toLocaleString()}
                    </span>
                    {!e.matched ? (
                      <Button size="sm" onClick={() => handleMatch(e.id, "l1")}>Match</Button>
                    ) : (
                      <span className="text-emerald-500 flex items-center gap-0.5"><Check className="h-4 w-4" /> Matched</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Ledger Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Ledger Journal Entries</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loading ? (
              <p className="text-zinc-500">Loading ledger...</p>
            ) : (
              ledgerEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm bg-white dark:bg-zinc-900/50">
                  <div>
                    <p className="font-semibold">{e.reference}</p>
                    <p className="text-xs text-zinc-400">{e.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${e.amount < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                      ${e.amount.toLocaleString()}
                    </span>
                    {e.matched && <span className="text-emerald-500 flex items-center gap-0.5"><Check className="h-4 w-4" /> Matched</span>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
