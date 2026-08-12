"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Cpu, Database, HardDrive, CheckCircle2 } from "lucide-react";

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => {
    setMetrics([
      { time: "09:00", cpu: 22, memory: 45 },
      { time: "09:10", cpu: 35, memory: 48 },
      { time: "09:20", cpu: 55, memory: 52 },
      { time: "09:30", cpu: 28, memory: 50 },
      { time: "09:40", cpu: 42, memory: 51 },
    ]);
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">System Health Monitoring</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Monitor active server resources loads and database statuses.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Server Status</span>
            <p className="text-lg font-bold text-emerald-500 flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-4 w-4" /> Healthy
            </p>
          </div>
          <HardDrive className="h-8 w-8 text-zinc-300" />
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">CPU Average</span>
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-1">32.4%</p>
          </div>
          <Cpu className="h-8 w-8 text-zinc-300" />
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Database State</span>
            <p className="text-lg font-bold text-emerald-500 flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-4 w-4" /> Connected
            </p>
          </div>
          <Database className="h-8 w-8 text-zinc-300" />
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active Threads</span>
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-1">1,240 active</p>
          </div>
          <HardDrive className="h-8 w-8 text-zinc-300" />
        </Card>
      </div>

      {/* Metrics Area Chart */}
      <div className="grid gap-6 md:grid-cols-3 mt-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Resource Utilization (CPU & Memory)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics}>
                <defs>
                  <linearGradient id="cpuColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="memColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-100 dark:stroke-zinc-800" />
                <XAxis dataKey="time" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area type="monotone" dataKey="cpu" stroke="#10b981" fillOpacity={1} fill="url(#cpuColor)" name="CPU Load (%)" />
                <Area type="monotone" dataKey="memory" stroke="#3b82f6" fillOpacity={1} fill="url(#memColor)" name="Memory Load (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Maintenance Toggles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="secondary" onClick={() => alert("Enable Maintenance Mode overlay confirmation")}>
              Trigger Maintenance Mode
            </Button>
            <Button variant="secondary" onClick={() => window.location.href = "/admin/developer"}>
              Developer Console
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
