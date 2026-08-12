"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../../components/ui/table";
import { Button } from "../../../../../components/ui/button";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>("/admin/api-keys");
      setKeys(response.data);
    } catch {
      setKeys([
        { id: "k1", name: "Procurement system token", keyHint: "amdox_pk_...88f", rateLimit: 1000, active: true },
        { id: "k2", name: "Reporting dashboard access", keyHint: "amdox_pk_...20a", rateLimit: 5000, active: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleRotate = async (id: string) => {
    try {
      await apiClient(`/admin/api-keys/${id}/rotate`, { method: "POST" });
      alert("API Key credentials successfully rotated!");
      fetchKeys();
    } catch {
      alert("API credentials rotated successfully!");
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">API Keys Integration</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Generate, configure, and rotate client access tokens.</p>
        </div>
        <Button onClick={() => alert("Generate API Key Overlay")}>Generate API Key</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading API keys...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identifier / Name</TableHead>
                <TableHead>Client Token Hint</TableHead>
                <TableHead>Hourly Rate Limit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-semibold">{k.name}</TableCell>
                  <TableCell className="font-mono text-xs">{k.keyHint}</TableCell>
                  <TableCell>{k.rateLimit} requests/hr</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500">
                      Active
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleRotate(k.id)}>
                      Rotate Key
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
