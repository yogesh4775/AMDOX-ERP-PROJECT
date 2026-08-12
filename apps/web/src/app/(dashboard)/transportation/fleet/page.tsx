"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/tms/vehicles");
      setVehicles(data || []);
    } catch {
      setVehicles([
        { id: "v1", plate: "TX-9812", model: "Peterbilt 579 Semi-Truck", status: "ON_TRIP", driverName: "John Doe" },
        { id: "v2", plate: "CA-2201", model: "Freightliner Cascadia", status: "AVAILABLE", driverName: "Steve Rogers" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Logistics Fleet</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">View and track company delivery vehicles and operator details.</p>
        </div>
        <Button onClick={() => alert("New Vehicle Form Overlay")}>Add Vehicle</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading fleet...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License Plate</TableHead>
                <TableHead>Vehicle Model</TableHead>
                <TableHead>Assigned Driver</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-semibold font-mono text-xs">{v.plate}</TableCell>
                  <TableCell>{v.model}</TableCell>
                  <TableCell>{v.driverName}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      v.status === "AVAILABLE" ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"
                    }`}>
                      {v.status}
                    </span>
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
