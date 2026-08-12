"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Filters } from "../../../components/ui/filters";
import { TrendingDown, Users, Receipt } from "lucide-react";

export default function ProcurementDashboardPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const data = await apiClient(`/procurement/vendors?search=${searchQuery}`);
      setVendors(data || []);
    } catch {
      setVendors([
        { id: "v1", name: "Stark Industries", contactName: "Tony Stark", email: "tony@stark.com", phone: "+123456", rating: "A+" },
        { id: "v2", name: "Wayne Enterprises", contactName: "Lucius Fox", email: "fox@wayne.com", phone: "+987654", rating: "A" },
        { id: "v3", name: "Oscorp Corp", contactName: "Norman Osborn", email: "norman@oscorp.com", phone: "+555666", rating: "B-" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Procurement Control</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Analyze vendor mappings and procurement dashboard stats.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total spent this month</span>
              <span className="text-2xl font-bold">$342,000</span>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
              <TrendingDown className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Suppliers</span>
              <span className="text-2xl font-bold">14</span>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
              <Users className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pending Receipts</span>
              <span className="text-2xl font-bold">5</span>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
              <Receipt className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between mt-4">
        <h2 className="text-lg font-bold">Vendor Directory</h2>
        <Button onClick={() => window.location.href = "/procurement/orders"}>View Purchase Orders</Button>
      </div>

      <Filters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search vendors..."
      />

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading vendors...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor Name</TableHead>
                <TableHead>Contact Representative</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Vendor Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-semibold">{v.name}</TableCell>
                  <TableCell>{v.contactName}</TableCell>
                  <TableCell>{v.email}</TableCell>
                  <TableCell>{v.phone}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full px-2 py-0.5 font-bold">
                      {v.rating}
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
