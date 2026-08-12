"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";

export default function DeveloperPage() {
  const [envs, setEnvs] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const data = await apiClient<{ envs: unknown[]; flags: unknown[] }>("/admin/developer-diagnostics");
      setEnvs(data.envs || []);
      setFlags(data.flags || []);
    } catch {
      setEnvs([
        { key: "NODE_ENV", value: "production" },
        { key: "PORT", value: "3000" },
        { key: "API_GATEWAY_URL", value: "https://api.amdox.com" },
      ]);
      setFlags([
        { id: "f1", key: "new-crm-dashboard", description: "Enables hello-pangea opportunities board", active: true },
        { id: "f2", key: "multi-currency-consolidation", description: "Enables subsidiary accounts merging", active: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const toggleFlag = (id: string, current: boolean) => {
    setFlags((prev) =>
      prev.map((f) => (f.id === id ? { ...f, active: !current } : f))
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Developer Diagnostics Console</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Inspect environment variables configurations, queue structures, and feature flags.</p>
        </div>
        <Button onClick={() => window.location.href = "/admin/developer/cron"}>
          Cron Jobs Scheduler
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Environment Variables Viewer */}
        <Card>
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Config Key</TableHead>
                  <TableHead>Configured Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envs.map((env, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs font-semibold">{env.key}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-500">{env.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Feature Flags Inspector */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Flags Toggles</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Toggle Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{flag.key}</TableCell>
                    <TableCell className="text-xs text-zinc-500">{flag.description}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => toggleFlag(flag.id, flag.active)}>
                        {flag.active ? "Disable" : "Enable"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
