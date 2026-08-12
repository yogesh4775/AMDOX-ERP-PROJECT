"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function AiDashboardPage() {
  const [anomalyHistory, setAnomalyHistory] = useState<any[]>([]);

  useEffect(() => {
    setAnomalyHistory([
      { time: "09:00", score: 0.12, confidence: 99 },
      { time: "10:00", score: 0.15, confidence: 98 },
      { time: "11:00", score: 0.88, confidence: 92 }, // Peak anomaly
      { time: "12:00", score: 0.22, confidence: 97 },
      { time: "13:00", score: 0.18, confidence: 99 },
    ]);
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">AI Model Registry & Analytics</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Review model training jobs, explainability records, and anomaly scoring.</p>
        </div>
        <Button onClick={() => window.location.href = "/ai/predictions"}>Predictions History</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Anomaly Score Area Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>AI Anomaly Scoring & Prediction Confidence Intervals</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={anomalyHistory}>
                <defs>
                  <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="confColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-100 dark:stroke-zinc-800" />
                <XAxis dataKey="time" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area type="monotone" dataKey="score" stroke="#ef4444" fillOpacity={1} fill="url(#scoreColor)" name="Anomaly Score" />
                <Area type="monotone" dataKey="confidence" stroke="#3b82f6" fillOpacity={1} fill="url(#confColor)" name="Model Confidence (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Model status summary cards */}
        <Card>
          <CardHeader>
            <CardTitle>Registered Models</CardTitle>
          </CardHeader>
          <CardContent className="text-sm flex flex-col gap-2">
            <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-800/80">
              <span>Financial Forecaster v2</span>
              <span className="font-semibold text-emerald-500">Active</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-800/80">
              <span>WMS Route Optimizer v1</span>
              <span className="font-semibold text-emerald-500">Active</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
