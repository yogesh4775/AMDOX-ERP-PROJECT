"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Truck, Navigation, Fuel, Compass } from "lucide-react";

export default function TransportationPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>("R1");
  const [loading, setLoading] = useState(false);

  // Dynamic route drawing coordinate points
  const routesData: any = {
    R1: [
      { name: "Depot Boston", x: 50, y: 150 },
      { name: "WayPoint NY", x: 180, y: 100 },
      { name: "Deliver Philly", x: 280, y: 220 },
    ],
    R2: [
      { name: "Depot Chicago", x: 40, y: 220 },
      { name: "WayPoint Indy", x: 150, y: 170 },
      { name: "Deliver Detroit", x: 290, y: 80 },
    ],
  };

  const activePoints = routesData[selectedRoute] || [];

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Fleet Control & GPS Tracking</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Track delivery shipments and interactive GPS routing paths.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Active fleet stats cards */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-zinc-400" /> Active Fleet
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <span className="text-2xl font-bold">12 Vehicles</span>
            <span className="text-xs text-zinc-400">All transceivers active</span>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5 text-zinc-400" /> Fuel Consumed
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <span className="text-2xl font-bold">4,120 Gallons</span>
            <span className="text-xs text-zinc-400">Average 12.4 MPG</span>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-zinc-400" /> Active Trips
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 pt-2">
            <div className="flex gap-2">
              <Button size="sm" variant={selectedRoute === "R1" ? "primary" : "secondary"} onClick={() => setSelectedRoute("R1")}>
                Trip #101
              </Button>
              <Button size="sm" variant={selectedRoute === "R2" ? "primary" : "secondary"} onClick={() => setSelectedRoute("R2")}>
                Trip #102
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive SVG Routing Map */}
      <div className="grid gap-6 md:grid-cols-3 mt-4">
        <Card className="md:col-span-2 overflow-hidden bg-zinc-900 border-zinc-800 p-0 h-[360px] relative flex flex-col items-center justify-center">
          <div className="absolute top-4 left-4 text-xs font-bold text-emerald-500 bg-zinc-950/80 px-2 py-1 rounded border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1.5 z-10">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            Live GPS Map Viewer
          </div>

          <svg className="w-full h-full min-h-[300px]">
            {/* Draw route path line connections */}
            {activePoints.length > 1 && (
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeDasharray="6,4"
                points={activePoints.map((p: any) => `${p.x},${p.y}`).join(" ")}
              />
            )}

            {/* Draw nodes */}
            {activePoints.map((p: any, idx: number) => (
              <g key={idx}>
                <circle cx={p.x} cy={p.y} r="6" fill="#10b981" className="animate-pulse" />
                <circle cx={p.x} cy={p.y} r="12" fill="none" stroke="#10b981" strokeWidth="1.5" className="opacity-40" />
                <text x={p.x + 14} y={p.y + 4} fill="#e4e4e7" fontSize="11" fontWeight="bold">
                  {p.name}
                </text>
              </g>
            ))}
          </svg>
        </Card>

        {/* Route stop logs */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Route Logs</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {activePoints.map((pt: any, idx: number) => (
              <div key={idx} className="flex gap-3 border-l-2 border-emerald-500 pl-3 py-1">
                <div>
                  <p className="font-semibold">{pt.name}</p>
                  <p className="text-xs text-zinc-400">Stop Position #{idx + 1}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
