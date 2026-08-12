"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";

export default function FinanceInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [allInvoices, setAllInvoices] = useState<any[]>([]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/invoices");
      const normalized = normalizeResponse(res);
      setAllInvoices(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    let filtered = allInvoices;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((inv: any) => {
        const invNo = (inv.invoiceNumber || "").toLowerCase();
        const status = (inv.status || "").toLowerCase();
        const type = (inv.type || "").toLowerCase();
        const orderNo = (inv.salesOrder?.orderNumber || inv.purchaseOrder?.orderNumber || "").toLowerCase();
        return invNo.includes(q) || status.includes(q) || type.includes(q) || orderNo.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setInvoices(filtered.slice(startIndex, startIndex + pageSize));
  }, [allInvoices, searchQuery, page]);

  const formattedInvoices = invoices.map((inv) => ({
    ...inv,
    sourceRef: inv.salesOrder?.orderNumber || inv.purchaseOrder?.orderNumber || "—",
    formattedIssueDate: inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : "—",
    formattedDueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "invoiceNumber", header: "Invoice #" },
    {
      key: "type",
      header: "Type",
      type: "badge",
      badgeColors: {
        SALES: "bg-blue-500/10 text-blue-500",
        PURCHASE: "bg-purple-500/10 text-purple-500",
      },
    },
    { key: "sourceRef", header: "Order Reference" },
    { key: "grandTotal", header: "Grand Total", type: "currency" },
    { key: "formattedIssueDate", header: "Issue Date" },
    { key: "formattedDueDate", header: "Due Date" },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeColors: {
        DRAFT: "bg-zinc-500/10 text-zinc-500",
        ISSUED: "bg-blue-500/10 text-blue-500",
        PAID: "bg-emerald-500/10 text-emerald-500",
        CANCELLED: "bg-rose-500/10 text-rose-500",
      },
    },
  ];

  return (
    <ModuleLayout
      title="All Invoices Ledger"
      description="Consolidated list of sales and purchase invoices."
      breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Invoices" }]}
      stats={[
        { label: "Total Invoices", value: totalCount },
        {
          label: "Total Sales Invoiced",
          value: `$${invoices
            .filter((i) => i.type === "SALES")
            .reduce((sum, i) => sum + Number(i.grandTotal || 0), 0)
            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
        {
          label: "Total Purchase Invoiced",
          value: `$${invoices
            .filter((i) => i.type === "PURCHASE")
            .reduce((sum, i) => sum + Number(i.grandTotal || 0), 0)
            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
      ]}
    >
      <DataTable
        columns={columns}
        data={formattedInvoices}
        loading={loading}
        onView={(inv) => {
          alert(`Invoice Details:\nNumber: ${inv.invoiceNumber}\nType: ${inv.type}\nReference: ${inv.sourceRef}\nGrand Total: $${inv.grandTotal}\nStatus: ${inv.status}`);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search invoices..."
      />
    </ModuleLayout>
  );
}
