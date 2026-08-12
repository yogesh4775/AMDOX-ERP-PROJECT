"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";

const RESOURCES = ["Leads", "SalesOrders", "PurchaseOrders", "GL_Ledger", "Backups"];

export default function RolesMatrixPage() {
  const [matrix, setMatrix] = useState<any>({
    SUPER_ADMIN: { Leads: true, SalesOrders: true, PurchaseOrders: true, GL_Ledger: true, Backups: true },
    MANAGER: { Leads: true, SalesOrders: true, PurchaseOrders: true, GL_Ledger: false, Backups: false },
    STAFF: { Leads: true, SalesOrders: false, PurchaseOrders: false, GL_Ledger: false, Backups: false },
  });

  const handleToggle = (role: string, resource: string) => {
    setMatrix((prev: any) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [resource]: !prev[role][resource],
      },
    }));
  };

  const handleSave = () => {
    alert("Permissions matrix updated successfully!");
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Roles & Permissions Matrix</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Map and verify role-based permissions metrics across system resources.</p>
        </div>
        <Button onClick={handleSave}>Save Permissions</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Title</TableHead>
              {RESOURCES.map((res) => (
                <TableHead key={res} className="text-center">{res}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.keys(matrix).map((role) => (
              <TableRow key={role}>
                <TableCell className="font-semibold">{role}</TableCell>
                {RESOURCES.map((res) => {
                  const allowed = matrix[role]?.[res] ?? false;
                  return (
                    <TableCell key={res} className="text-center">
                      <input
                        type="checkbox"
                        checked={allowed}
                        onChange={() => handleToggle(role, res)}
                        className="rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
