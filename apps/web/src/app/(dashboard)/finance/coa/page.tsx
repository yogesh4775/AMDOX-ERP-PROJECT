"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";

export default function ChartOfAccountsPage() {
  const [coa, setCoa] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCoa = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>("/accounting/coa");
      setCoa(response.data);
    } catch {
      setCoa([
        {
          code: "1000",
          name: "Assets",
          children: [
            { code: "1100", name: "Cash & Bank Accounts", children: [{ code: "1110", name: "Main Operating Account" }] },
            { code: "1200", name: "Accounts Receivable" },
          ],
        },
        {
          code: "2000",
          name: "Liabilities",
          children: [
            { code: "2100", name: "Accounts Payable" },
          ],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoa();
  }, []);

  const renderNode = (node: any) => {
    return (
      <div key={node.code} className="pl-4 border-l border-zinc-200 dark:border-zinc-800 my-1">
        <div className="flex items-center gap-2 text-sm py-1 font-medium">
          <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded px-1">{node.code}</span>
          <span className="text-zinc-800 dark:text-zinc-200">{node.name}</span>
        </div>
        {node.children && node.children.map((child: any) => renderNode(child))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Chart of Accounts</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Map and verify ledger account codes hierarchies.</p>
        </div>
        <Button onClick={() => alert("Add Account Code Overlay")}>Add Account</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center text-zinc-500 py-10">Loading chart structure...</div>
          ) : (
            <div className="flex flex-col gap-2">
              {coa.map((rootNode) => renderNode(rootNode))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
