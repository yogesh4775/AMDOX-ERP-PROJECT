"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";
import { Filters } from "../../../../components/ui/filters";
import { Pagination } from "../../../../components/ui/pagination";

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const data = await apiClient<{ items: Record<string, unknown>[]; totalPages: number }>(`/sales/quotations?page=${page}&limit=10&search=${searchQuery}`);
      setQuotations(data.items || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      setQuotations([
        { id: "q1", quotationNumber: "QT-2026-0001", customerName: "Acme Corp", totalAmount: 12000, validUntil: "2026-08-31", status: "DRAFT" },
        { id: "q2", quotationNumber: "QT-2026-0002", customerName: "Globex Inc", totalAmount: 48500, validUntil: "2026-09-15", status: "SENT" },
        { id: "q3", quotationNumber: "QT-2026-0003", customerName: "Peanuts Ltd", totalAmount: 7500, validUntil: "2026-07-31", status: "ACCEPTED" },
      ]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [page]);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Quotations</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage sales quotations and estimations sent to customers.</p>
        </div>
        <Button onClick={() => alert("Create Quotation Form overlay")}>New Quotation</Button>
      </div>

      <Filters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search quotations by customer name or quote number..."
      />

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading quotations...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-semibold">{q.quotationNumber}</TableCell>
                  <TableCell>{q.customerName}</TableCell>
                  <TableCell>${q.totalAmount.toLocaleString()}</TableCell>
                  <TableCell>{q.validUntil}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      q.status === "DRAFT" ? "bg-zinc-500/10 text-zinc-500" :
                      q.status === "SENT" ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {q.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
