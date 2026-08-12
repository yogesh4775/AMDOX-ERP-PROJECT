"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function BiPage() {
  const [salesForecast, setSalesForecast] = useState<any[]>([]);

  useEffect(() => {
    setSalesForecast([
      { month: "Jan", actual: 120000, forecast: 115000 },
      { month: "Feb", actual: 145000, forecast: 130000 },
      { month: "Mar", actual: 160000, forecast: 155000 },
      { month: "Apr", actual: 150000, forecast: 165000 },
      { month: "May", actual: 180000, forecast: 175000 },
      { month: "Jun", actual: 210000, forecast: 195000 },
    ]);
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Business Intelligence & Forecasting</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Review analytics reports, actuals vs forecast variance summaries.</p>
        </div>
        <Button onClick={() => window.location.href = "/bi/warehouse"}>Data Warehouse Explorer</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Sales Forecast vs Actual Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesForecast}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-100 dark:stroke-zinc-800" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="actual" fill="#10b981" radius={[4, 4, 0, 0]} name="Actual Revenue" />
                <Bar dataKey="forecast" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Forecast Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variance Metrics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between items-center py-1">
              <span>Forecast Accuracy</span>
              <span className="font-bold text-emerald-500">94.8%</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span>Consolidated Assets Variance</span>
              <span className="font-bold text-emerald-500">+2.4%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
