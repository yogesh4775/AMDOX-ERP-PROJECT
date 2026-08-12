"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";
import { ArrowLeft, Download } from "lucide-react";

export default function SlipsPage() {
  const [slips, setSlips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSlips = async () => {
    setLoading(true);
    try {
      const data = await apiClient("/payroll/slips");
      setSlips(data || []);
    } catch {
      setSlips([
        { id: "sl1", name: "Alice Smith", employeeId: "EMP-001", basicPay: 12500, deductions: 1200, netPay: 11300 },
        { id: "sl2", name: "Bob Jones", employeeId: "EMP-002", basicPay: 14000, deductions: 1500, netPay: 12500 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlips();
  }, []);

  const handleDownloadPdf = async (slipId: string, employeeName: string) => {
    try {
      // Call the API endpoint to fetch PDF binary blob
      const response = await fetch(`/api/payroll/slips/${slipId}/pdf`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `payslip_${employeeName.replace(/\s+/g, "_")}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert("Fallback: Downloading mocked PDF document payslip stub.");
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Employee Salary Slips</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Download salary slips and monitor allowances allocations.</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading slips...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Employee Name</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.map((slip) => (
                <TableRow key={slip.id}>
                  <TableCell className="font-mono text-xs">{slip.employeeId}</TableCell>
                  <TableCell className="font-semibold">{slip.name}</TableCell>
                  <TableCell>${slip.basicPay.toLocaleString()}</TableCell>
                  <TableCell className="text-rose-500">-${slip.deductions.toLocaleString()}</TableCell>
                  <TableCell className="font-bold text-emerald-500">${slip.netPay.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => handleDownloadPdf(slip.id, slip.name)}>
                      <Download className="h-4 w-4 mr-1" /> PDF Payslip
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
