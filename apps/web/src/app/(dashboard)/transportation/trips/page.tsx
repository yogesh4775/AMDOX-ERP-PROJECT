"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";

export default function TripsPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/tms/trips");
      setTrips(data || []);
    } catch {
      setTrips([
        { id: "t1", tripNumber: "TRP-101", origin: "Boston Depot", destination: "Philly Depot", distance: 310, status: "DISPATCHED" },
        { id: "t2", tripNumber: "TRP-102", origin: "Chicago Depot", destination: "Detroit Hub", status: "PENDING" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Delivery Trips</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Review dispatch origins, destinations, and trip mileage logs.</p>
        </div>
        <Button onClick={() => alert("Configure New Delivery Trip Overlay")}>New Trip</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading delivery trips...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trip ID</TableHead>
                <TableHead>Origin Depot</TableHead>
                <TableHead>Destination Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-semibold">{t.tripNumber}</TableCell>
                  <TableCell>{t.origin}</TableCell>
                  <TableCell>{t.destination}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      t.status === "DISBURSED" || t.status === "DISPATCHED" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {t.status}
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
