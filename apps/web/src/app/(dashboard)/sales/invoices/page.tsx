"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import {
  FormDialog,
  FormField,
} from "../../../../components/ui/form-dialog";
import { Button } from "../../../../components/ui/button";

interface SalesInvoice {
  id: string;
  invoiceNumber?: string;
  status?: string;
  grandTotal?: number | string;
  amountPaid?: number | string;
  issueDate?: string;
  dueDate?: string;
  version?: number;
  salesOrder?: {
    orderNumber?: string;
    customer?: {
      name?: string;
    };
  };
}

interface SelectOption {
  label: string;
  value: string;
}

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<SalesInvoice[]>([]);

  const [orders, setOrders] = useState<SelectOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);

  /*
   * ---------------------------------------------------------
   * LOOKUP DATA
   * ---------------------------------------------------------
   */

  const fetchLookupData = async () => {
    try {
      const response = await apiClient(
        "/sales/orders?limit=100"
      );

      const normalized = normalizeResponse(response);

      setOrders(
        (normalized.items || []).map((order: any) => ({
          label: `SO #${order.orderNumber || "—"} - ${
            order.customer?.name || "Customer"
          }`,
          value: order.id,
        }))
      );
    } catch (error) {
      console.error(
        "Failed to load sales orders:",
        error
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * FETCH INVOICES
   * ---------------------------------------------------------
   */

  const fetchInvoices = async () => {
    setLoading(true);

    try {
      const response = await apiClient(
        "/invoices?type=SALES"
      );

      const normalized = normalizeResponse(response);

      setAllInvoices(normalized.items || []);
    } catch (error) {
      console.error(
        "Failed to load sales invoices:",
        error
      );

      setAllInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLookupData();
    void fetchInvoices();
  }, []);

  /*
   * ---------------------------------------------------------
   * SEARCH + PAGINATION
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const query = searchQuery
      .trim()
      .toLowerCase();

    let filtered = [...allInvoices];

    if (query) {
      filtered = filtered.filter((invoice) => {
        const invoiceNumber =
          (invoice.invoiceNumber || "").toLowerCase();

        const status =
          (invoice.status || "").toLowerCase();

        const orderNumber =
          (
            invoice.salesOrder?.orderNumber || ""
          ).toLowerCase();

        const customerName =
          (
            invoice.salesOrder?.customer?.name || ""
          ).toLowerCase();

        return (
          invoiceNumber.includes(query) ||
          status.includes(query) ||
          orderNumber.includes(query) ||
          customerName.includes(query)
        );
      });
    }

    const pageSize = 10;
    const total = filtered.length;

    const pages = Math.max(
      1,
      Math.ceil(total / pageSize)
    );

    setTotalPages(pages);
    setTotalCount(total);

    const safePage = Math.min(page, pages);

    if (safePage !== page) {
      setPage(safePage);
      return;
    }

    const startIndex =
      (safePage - 1) * pageSize;

    setInvoices(
      filtered.slice(
        startIndex,
        startIndex + pageSize
      )
    );
  }, [allInvoices, searchQuery, page]);

  /*
   * ---------------------------------------------------------
   * GENERATE INVOICE
   * ---------------------------------------------------------
   */

  const handleCreate = async (
    values: Record<string, any>
  ) => {
    setFormLoading(true);

    try {
      await apiClient("/invoices/generate", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "SalesOrder",
          sourceId: values.salesOrderId,
        }),
      });

      setFormOpen(false);

      await fetchInvoices();
    } catch (error: any) {
      alert(
        error?.message ||
          "Failed to generate invoice"
      );
    } finally {
      setFormLoading(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * ISSUE INVOICE
   * ---------------------------------------------------------
   */

  const handleIssue = async (
    invoice: SalesInvoice
  ) => {
    try {
      await apiClient(
        `/invoices/${invoice.id}/issue`,
        {
          method: "PATCH",
          body: JSON.stringify({
            expectedVersion: Number(
              invoice.version || 1
            ),
          }),
        }
      );

      await fetchInvoices();
    } catch (error: any) {
      alert(
        error?.message ||
          "Failed to issue invoice"
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * PAY INVOICE
   * ---------------------------------------------------------
   */

  const handlePay = async (
    invoice: SalesInvoice
  ) => {
    const grandTotal = Number(
      invoice.grandTotal || 0
    );

    const amountPaid = Number(
      invoice.amountPaid || 0
    );

    const outstandingAmount =
      Math.max(
        0,
        grandTotal - amountPaid
      );

    if (outstandingAmount <= 0) {
      alert(
        "This invoice has already been fully paid."
      );
      return;
    }

    const enteredAmount = prompt(
      `Invoice: ${
        invoice.invoiceNumber || "—"
      }\n\nOutstanding Amount: $${outstandingAmount.toFixed(
        2
      )}\n\nEnter payment amount:`
    );

    if (enteredAmount === null) {
      return;
    }

    const amount = Number(
      enteredAmount
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert(
        "Please enter a valid payment amount greater than 0."
      );
      return;
    }

    if (amount > outstandingAmount) {
      alert(
        `Payment cannot exceed the outstanding amount of $${outstandingAmount.toFixed(
          2
        )}.`
      );
      return;
    }

    try {
      await apiClient(
        `/invoices/${invoice.id}/pay`,
        {
          method: "PATCH",
          body: JSON.stringify({
            amount,
            expectedVersion: Number(
              invoice.version || 1
            ),
          }),
        }
      );

      await fetchInvoices();
    } catch (error: any) {
      alert(
        error?.message ||
          "Failed to record invoice payment"
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * CANCEL INVOICE
   * ---------------------------------------------------------
   */

  const handleCancel = async (
    invoice: SalesInvoice
  ) => {
    const confirmed = confirm(
      `Are you sure you want to cancel invoice ${
        invoice.invoiceNumber || "—"
      }?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await apiClient(
        `/invoices/${invoice.id}/cancel`,
        {
          method: "PATCH",
          body: JSON.stringify({
            expectedVersion: Number(
              invoice.version || 1
            ),
          }),
        }
      );

      await fetchInvoices();
    } catch (error: any) {
      alert(
        error?.message ||
          "Failed to cancel invoice"
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * FORM FIELDS
   * ---------------------------------------------------------
   */

  const formFields: FormField[] = useMemo(
    () => [
      {
        name: "salesOrderId",
        label: "Select Sales Order",
        type: "select",
        options: orders,
        required: true,
      },
    ],
    [orders]
  );

  /*
   * ---------------------------------------------------------
   * FORMATTED DATA
   * ---------------------------------------------------------
   */

  const formattedInvoices = invoices.map(
    (invoice) => {
      const grandTotal = Number(
        invoice.grandTotal || 0
      );

      const amountPaid = Number(
        invoice.amountPaid || 0
      );

      return {
        ...invoice,

        customerName:
          invoice.salesOrder?.customer
            ?.name || "—",

        formattedIssueDate:
          invoice.issueDate
            ? new Date(
                invoice.issueDate
              ).toLocaleDateString()
            : "—",

        formattedDueDate:
          invoice.dueDate
            ? new Date(
                invoice.dueDate
              ).toLocaleDateString()
            : "—",

        outstandingAmount: Math.max(
          0,
          grandTotal - amountPaid
        ),
      };
    }
  );

  /*
   * ---------------------------------------------------------
   * TABLE COLUMNS
   * ---------------------------------------------------------
   */

  const columns: ColumnConfig[] = [
    {
      key: "invoiceNumber",
      header: "Invoice #",
    },
    {
      key: "customerName",
      header: "Customer",
    },
    {
      key: "grandTotal",
      header: "Grand Total",
      type: "currency",
    },
    {
      key: "outstandingAmount",
      header: "Outstanding",
      type: "currency",
    },
    {
      key: "formattedIssueDate",
      header: "Issue Date",
    },
    {
      key: "formattedDueDate",
      header: "Due Date",
    },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeColors: {
        DRAFT:
          "bg-zinc-500/10 text-zinc-500",

        ISSUED:
          "bg-blue-500/10 text-blue-500",

        PARTIALLY_PAID:
          "bg-amber-500/10 text-amber-500",

        PAID:
          "bg-emerald-500/10 text-emerald-500",

        CANCELLED:
          "bg-rose-500/10 text-rose-500",
      },
    },
  ];

  /*
   * ---------------------------------------------------------
   * OUTSTANDING TOTAL
   * ---------------------------------------------------------
   */

  const outstandingBalance =
    allInvoices
      .filter(
        (invoice) =>
          invoice.status === "ISSUED" ||
          invoice.status ===
            "PARTIALLY_PAID"
      )
      .reduce(
        (sum, invoice) => {
          const total = Number(
            invoice.grandTotal || 0
          );

          const paid = Number(
            invoice.amountPaid || 0
          );

          return (
            sum +
            Math.max(
              0,
              total - paid
            )
          );
        },
        0
      );

  /*
   * ---------------------------------------------------------
   * VIEW / ACTIONS
   * ---------------------------------------------------------
   */

  const handleView = async (
    invoice: any
  ) => {
    const total = Number(
      invoice.grandTotal || 0
    );

    const paid = Number(
      invoice.amountPaid || 0
    );

    const outstanding = Math.max(
      0,
      total - paid
    );

    const details =
      `Invoice Details\n\n` +
      `Invoice Number: ${
        invoice.invoiceNumber || "—"
      }\n` +
      `Customer: ${
        invoice.customerName || "—"
      }\n` +
      `Grand Total: $${total.toLocaleString(
        undefined,
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )}\n` +
      `Paid: $${paid.toLocaleString(
        undefined,
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )}\n` +
      `Outstanding: $${outstanding.toLocaleString(
        undefined,
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )}\n` +
      `Status: ${
        invoice.status || "—"
      }`;

    if (invoice.status === "DRAFT") {
      const shouldIssue = confirm(
        `${details}\n\nWould you like to ISSUE this invoice?`
      );

      if (shouldIssue) {
        await handleIssue(invoice);
      }

      return;
    }

    if (
      invoice.status === "ISSUED" ||
      invoice.status ===
        "PARTIALLY_PAID"
    ) {
      const action = prompt(
        `${details}\n\nEnter:\nPAY - Record payment\nCANCEL - Cancel invoice`
      );

      if (
        action?.trim().toUpperCase() ===
        "PAY"
      ) {
        await handlePay(invoice);
      } else if (
        action?.trim().toUpperCase() ===
        "CANCEL"
      ) {
        await handleCancel(invoice);
      }

      return;
    }

    alert(details);
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <ModuleLayout
      title="Sales Invoices"
      description="Issue and track customer sales invoices."
      breadcrumbs={[
        {
          label: "Sales & CRM",
          href: "/sales",
        },
        {
          label: "Invoices",
        },
      ]}
      stats={[
        {
          label: "Total Invoices",
          value: totalCount,
        },
        {
          label: "Outstanding Balance",
          value: `$${outstandingBalance.toLocaleString(
            undefined,
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}`,
        },
        {
          label: "Issued",
          value: allInvoices.filter(
            (invoice) =>
              invoice.status === "ISSUED"
          ).length,
        },
        {
          label: "Paid",
          value: allInvoices.filter(
            (invoice) =>
              invoice.status === "PAID"
          ).length,
        },
      ]}
      actions={
        <Button
          onClick={() =>
            setFormOpen(true)
          }
        >
          Generate Invoice
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={formattedInvoices}
        loading={loading}
        onView={handleView}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);

          if (page !== 1) {
            setPage(1);
          }
        }}
        searchPlaceholder="Search sales invoices..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => {
          if (!formLoading) {
            setFormOpen(false);
          }
        }}
        title="Generate Invoice from Sales Order"
        fields={formFields}
        onSubmit={handleCreate}
        loading={formLoading}
      />
    </ModuleLayout>
  );
}