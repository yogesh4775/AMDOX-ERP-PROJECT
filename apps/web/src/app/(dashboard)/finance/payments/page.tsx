"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import {
  DataTable,
  ColumnConfig,
} from "../../../../components/ui/data-table";
import {
  FormDialog,
  FormField,
} from "../../../../components/ui/form-dialog";
import { Button } from "../../../../components/ui/button";

interface Payment {
  id: string;
  referenceNumber?: string;
  paymentNumber?: string;
  type?: string;
  status?: string;
  method?: string;
  amount?: number | string;
  paymentDate?: string;
  currency?: string;
  notes?: string;
  version?: number;

  customerId?: string;

  customer?: {
    id?: string;
    name?: string;
  };

  invoice?: {
    id?: string;
    invoiceNumber?: string;
  };

  allocations?: Array<{
    invoiceId?: string;
    allocatedAmount?: number | string;
    invoice?: {
      id?: string;
      invoiceNumber?: string;
    };
  }>;
}

interface SelectOption {
  label: string;
  value: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);

  const [invoices, setInvoices] = useState<SelectOption[]>([]);
  const [customers, setCustomers] = useState<SelectOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPayment, setEditingPayment] =
    useState<Payment | null>(null);

  /*
   * =========================================================
   * SALES INVOICE CHECK
   * =========================================================
   *
   * Receipt payments can only be allocated to SALES invoices.
   * We use multiple checks because different API responses
   * may expose the invoice type using different fields.
   */

  const isSalesInvoice = (invoice: any): boolean => {
    if (!invoice?.id) {
      return false;
    }

    const type = String(
      invoice.type ||
        invoice.invoiceType ||
        invoice.documentType ||
        ""
    ).toUpperCase();

    const sourceType = String(
      invoice.sourceType || ""
    ).toUpperCase();

    const invoiceNumber = String(
      invoice.invoiceNumber || ""
    ).toUpperCase();

    /*
     * Explicit purchase invoice indicators
     * always take priority.
     */
    if (
      type === "PURCHASE" ||
      type === "PURCHASE_INVOICE" ||
      type === "PURCHASE_ORDER" ||
      sourceType === "PURCHASE_ORDER" ||
      sourceType === "PURCHASE"
    ) {
      return false;
    }

    if (
      invoice.purchaseOrder ||
      invoice.purchaseOrderId
    ) {
      return false;
    }

    if (
      invoiceNumber.includes("PUR")
    ) {
      return false;
    }

    /*
     * Explicit sales indicators.
     */
    if (
      type === "SALES" ||
      type === "SALES_INVOICE" ||
      sourceType === "SALES_ORDER" ||
      sourceType === "SALES"
    ) {
      return true;
    }

    if (
      invoice.salesOrder ||
      invoice.salesOrderId
    ) {
      return true;
    }

    if (
      invoiceNumber.includes("SLS")
    ) {
      return true;
    }

    /*
     * If backend already filtered the endpoint using
     * ?type=SALES and there is no conflicting purchase
     * information, allow the invoice.
     */
    return true;
  };

  /*
   * =========================================================
   * LOAD LOOKUP DATA
   * =========================================================
   */

  const fetchLookupData = async () => {
    try {
      const [
        invoiceResponse,
        customerResponse,
      ] = await Promise.all([
        /*
         * IMPORTANT:
         * Request only SALES invoices from backend.
         */
        apiClient(
          "/invoices?type=SALES&limit=100"
        ),

        apiClient(
          "/sales/customers?limit=100"
        ),
      ]);

      const invoiceNormalized =
        normalizeResponse(invoiceResponse);

      const customerNormalized =
        normalizeResponse(customerResponse);

      const rawInvoiceItems =
        Array.isArray(invoiceNormalized.items)
          ? invoiceNormalized.items
          : [];

      const customerItems =
        Array.isArray(customerNormalized.items)
          ? customerNormalized.items
          : [];

      /*
       * Final frontend safety filter.
       *
       * Even if the backend accidentally returns a
       * purchase invoice, it will not appear here.
       */
      const salesInvoiceItems =
        rawInvoiceItems.filter(
          (invoice: any) =>
            isSalesInvoice(invoice)
        );

      setInvoices(
        salesInvoiceItems.map(
          (invoice: any) => ({
            label: `Inv #${
              invoice.invoiceNumber || "—"
            } ($${Number(
              invoice.grandTotal || 0
            ).toLocaleString()})`,

            value: invoice.id,
          })
        )
      );

      setCustomers(
        customerItems
          .filter(
            (customer: any) =>
              customer?.id
          )
          .map(
            (customer: any) => ({
              label:
                customer.name ||
                customer.companyName ||
                customer.customerName ||
                "Customer",

              value: customer.id,
            })
          )
      );
    } catch (error) {
      console.error(
        "Failed to load payment lookup data:",
        error
      );

      setInvoices([]);
      setCustomers([]);
    }
  };

  /*
   * =========================================================
   * LOAD PAYMENTS
   * =========================================================
   */

  const fetchPayments = async () => {
    setLoading(true);

    try {
      const response =
        await apiClient("/payments");

      const normalized =
        normalizeResponse(response);

      const items =
        Array.isArray(normalized.items)
          ? normalized.items
          : [];

      setAllPayments(items);
    } catch (error) {
      console.error(
        "Failed to load payments:",
        error
      );

      setAllPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLookupData();
    void fetchPayments();
  }, []);

  /*
   * =========================================================
   * SEARCH + PAGINATION
   * =========================================================
   */

  useEffect(() => {
    const query =
      searchQuery
        .trim()
        .toLowerCase();

    let filtered = [
      ...allPayments,
    ];

    if (query) {
      filtered =
        filtered.filter(
          (payment) => {
            const referenceNumber =
              (
                payment.referenceNumber ||
                payment.paymentNumber ||
                ""
              ).toLowerCase();

            const invoiceNumber =
              (
                payment.invoice
                  ?.invoiceNumber ||
                payment.allocations?.[0]
                  ?.invoice
                  ?.invoiceNumber ||
                ""
              ).toLowerCase();

            const customerName =
              (
                payment.customer
                  ?.name ||
                ""
              ).toLowerCase();

            const status =
              (
                payment.status ||
                ""
              ).toLowerCase();

            const method =
              (
                payment.method ||
                ""
              ).toLowerCase();

            return (
              referenceNumber.includes(
                query
              ) ||
              invoiceNumber.includes(
                query
              ) ||
              customerName.includes(
                query
              ) ||
              status.includes(
                query
              ) ||
              method.includes(
                query
              )
            );
          }
        );
    }

    const pageSize = 10;

    const total =
      filtered.length;

    const pages =
      Math.max(
        1,
        Math.ceil(
          total / pageSize
        )
      );

    setTotalPages(pages);
    setTotalCount(total);

    const safePage =
      Math.min(
        page,
        pages
      );

    if (
      safePage !== page
    ) {
      setPage(safePage);
      return;
    }

    const startIndex =
      (safePage - 1) *
      pageSize;

    setPayments(
      filtered.slice(
        startIndex,
        startIndex +
          pageSize
      )
    );
  }, [
    allPayments,
    searchQuery,
    page,
  ]);

  /*
   * =========================================================
   * CREATE / UPDATE PAYMENT
   * =========================================================
   */

  const handleCreateOrUpdate =
    async (
      values: Record<
        string,
        any
      >
    ) => {
      setFormLoading(true);

      try {
        const amount =
          Number(
            values.amount || 0
          );

        if (
          !Number.isFinite(
            amount
          ) ||
          amount <= 0
        ) {
          throw new Error(
            "Payment amount must be greater than 0."
          );
        }

        if (
          !values.invoiceId
        ) {
          throw new Error(
            "Please select a sales invoice."
          );
        }

        if (
          !values.customerId
        ) {
          throw new Error(
            "Please select a customer."
          );
        }

        if (
          !values.paymentNumber?.trim()
        ) {
          throw new Error(
            "Payment Voucher Number is required."
          );
        }

        if (
          !values.paymentMethod
        ) {
          throw new Error(
            "Please select a payment method."
          );
        }

        /*
         * Verify selected invoice is actually
         * a sales invoice when possible.
         *
         * The dropdown itself is already filtered,
         * but this prevents accidental invalid
         * invoice IDs from being submitted.
         */
        const selectedInvoice =
          invoices.find(
            (invoice) =>
              invoice.value ===
              values.invoiceId
          );

        if (
          !selectedInvoice
        ) {
          throw new Error(
            "The selected invoice is not a valid sales invoice."
          );
        }

        /*
         * Backend Receipt payment payload.
         */
        const payload = {
          type: "RECEIPT",

          method:
            values.paymentMethod,

          referenceNumber:
            String(
              values.paymentNumber
            ).trim(),

          paymentDate:
            new Date().toISOString(),

          amount,

          currency: "USD",

          customerId:
            values.customerId,

          allocations: [
            {
              invoiceId:
                values.invoiceId,

              allocatedAmount:
                amount,
            },
          ],
        };

        if (
          editingPayment
        ) {
          await apiClient(
            `/payments/${editingPayment.id}`,
            {
              method: "PATCH",

              body:
                JSON.stringify({
                  ...payload,

                  expectedVersion:
                    Number(
                      editingPayment.version ||
                        1
                    ),
                }),
            }
          );
        } else {
          await apiClient(
            "/payments",
            {
              method: "POST",

              body:
                JSON.stringify(
                  payload
                ),
            }
          );
        }

        setFormOpen(false);
        setEditingPayment(
          null
        );

        await fetchPayments();
      } catch (
        error: any
      ) {
        console.error(
          "Failed to save payment:",
          error
        );

        alert(
          error?.message ||
            "Failed to save payment"
        );
      } finally {
        setFormLoading(false);
      }
    };

  /*
   * =========================================================
   * POST PAYMENT
   * =========================================================
   */

  const handlePost =
    async (
      payment: Payment
    ) => {
      const reference =
        payment.referenceNumber ||
        payment.paymentNumber ||
        "—";

      const confirmed =
        confirm(
          `Post payment ${reference}?\n\nAmount: $${Number(
            payment.amount ||
              0
          ).toLocaleString()}`
        );

      if (!confirmed) {
        return;
      }

      try {
        await apiClient(
          `/payments/${payment.id}/post`,
          {
            method: "PATCH",

            body:
              JSON.stringify({
                expectedVersion:
                  Number(
                    payment.version ||
                      1
                  ),
              }),
          }
        );

        await fetchPayments();
      } catch (
        error: any
      ) {
        alert(
          error?.message ||
            "Failed to post payment"
        );
      }
    };

  /*
   * =========================================================
   * REVERSE PAYMENT
   * =========================================================
   */

  const handleReverse =
    async (
      payment: Payment
    ) => {
      const reference =
        payment.referenceNumber ||
        payment.paymentNumber ||
        "—";

      const confirmed =
        confirm(
          `Reverse payment ${reference}?\n\nThis will revert the payment effect on the invoice.`
        );

      if (!confirmed) {
        return;
      }

      try {
        await apiClient(
          `/payments/${payment.id}/reverse`,
          {
            method: "PATCH",

            body:
              JSON.stringify({
                expectedVersion:
                  Number(
                    payment.version ||
                      1
                  ),
              }),
          }
        );

        await fetchPayments();
      } catch (
        error: any
      ) {
        alert(
          error?.message ||
            "Failed to reverse payment"
        );
      }
    };

  /*
   * =========================================================
   * FORM FIELDS
   * =========================================================
   */

  const formFields:
    FormField[] = useMemo(
      () => [
        {
          name:
            "paymentNumber",

          label:
            "Payment Voucher Number",

          type:
            "text",

          required:
            true,
        },

        {
          name:
            "customerId",

          label:
            "Customer",

          type:
            "select",

          options:
            customers,

          required:
            true,
        },

        {
          name:
            "invoiceId",

          label:
            "Sales Invoice Reference",

          type:
            "select",

          options:
            invoices,

          required:
            true,
        },

        {
          name:
            "amount",

          label:
            "Amount Paid",

          type:
            "number",

          required:
            true,
        },

        {
          name:
            "paymentMethod",

          label:
            "Payment Method",

          type:
            "select",

          options: [
            {
              label:
                "Cash",

              value:
                "CASH",
            },

            {
              label:
                "Bank Transfer",

              value:
                "BANK_TRANSFER",
            },

            {
              label:
                "Check",

              value:
                "CHECK",
            },

            {
              label:
                "Credit Card",

              value:
                "CREDIT_CARD",
            },

            {
              label:
                "Other",

              value:
                "OTHER",
            },
          ],

          required:
            true,
        },
      ],
      [
        customers,
        invoices,
      ]
    );

  /*
   * =========================================================
   * FORMAT PAYMENTS
   * =========================================================
   */

  const formattedPayments =
    payments.map(
      (payment) => ({
        ...payment,

        paymentNumber:
          payment.referenceNumber ||
          payment.paymentNumber ||
          "—",

        invoiceNumber:
          payment.invoice
            ?.invoiceNumber ||
          payment.allocations?.[0]
            ?.invoice
            ?.invoiceNumber ||
          "—",

        customerName:
          payment.customer
            ?.name ||
          "—",

        formattedDate:
          payment.paymentDate
            ? new Date(
                payment.paymentDate
              ).toLocaleDateString()
            : "—",

        amount:
          Number(
            payment.amount ||
              0
          ),

        methodDisplay:
          payment.method ===
          "BANK_TRANSFER"
            ? "Bank Transfer"
            : payment.method ===
              "CREDIT_CARD"
            ? "Credit Card"
            : payment.method ===
              "CHECK"
            ? "Check"
            : payment.method ===
              "CASH"
            ? "Cash"
            : payment.method ||
              "—",
      })
    );

  /*
   * =========================================================
   * TABLE COLUMNS
   * =========================================================
   */

  const columns:
    ColumnConfig[] = [
      {
        key:
          "paymentNumber",

        header:
          "Payment #",
      },

      {
        key:
          "invoiceNumber",

        header:
          "Invoice Number",
      },

      {
        key:
          "customerName",

        header:
          "Customer",
      },

      {
        key:
          "amount",

        header:
          "Amount Paid",

        type:
          "currency",
      },

      {
        key:
          "methodDisplay",

        header:
          "Method",
      },

      {
        key:
          "formattedDate",

        header:
          "Payment Date",
      },

      {
        key:
          "status",

        header:
          "Status",

        type:
          "badge",

        badgeColors: {
          DRAFT:
            "bg-zinc-500/10 text-zinc-500",

          POSTED:
            "bg-emerald-500/10 text-emerald-500",

          REVERSED:
            "bg-rose-500/10 text-rose-500",
        },
      },
    ];

  /*
   * =========================================================
   * STATS
   * =========================================================
   */

  const postedAmount =
    allPayments
      .filter(
        (payment) =>
          payment.status ===
          "POSTED"
      )
      .reduce(
        (
          sum,
          payment
        ) =>
          sum +
          Number(
            payment.amount ||
              0
          ),
        0
      );

  const draftCount =
    allPayments.filter(
      (payment) =>
        payment.status ===
        "DRAFT"
    ).length;

  const reversedCount =
    allPayments.filter(
      (payment) =>
        payment.status ===
        "REVERSED"
    ).length;

  /*
   * =========================================================
   * VIEW / ACTIONS
   * =========================================================
   */

  const handleView =
    async (
      payment: any
    ) => {
      const amount =
        Number(
          payment.amount ||
            0
        );

      const reference =
        payment.paymentNumber ||
        payment.referenceNumber ||
        "—";

      const details =
        `Payment Voucher Details\n\n` +
        `Payment Number: ${reference}\n` +
        `Customer: ${
          payment.customerName ||
          "—"
        }\n` +
        `Invoice: ${
          payment.invoiceNumber ||
          "—"
        }\n` +
        `Amount: $${amount.toLocaleString(
          undefined,
          {
            minimumFractionDigits:
              2,

            maximumFractionDigits:
              2,
          }
        )}\n` +
        `Method: ${
          payment.methodDisplay ||
          payment.method ||
          "—"
        }\n` +
        `Status: ${
          payment.status ||
          "—"
        }\n` +
        `Payment Date: ${
          payment.formattedDate ||
          "—"
        }`;

      if (
        payment.status ===
        "DRAFT"
      ) {
        const shouldPost =
          confirm(
            `${details}\n\nWould you like to POST this payment?`
          );

        if (
          shouldPost
        ) {
          await handlePost(
            payment
          );
        }

        return;
      }

      if (
        payment.status ===
        "POSTED"
      ) {
        const shouldReverse =
          confirm(
            `${details}\n\nWould you like to REVERSE this posted payment?`
          );

        if (
          shouldReverse
        ) {
          await handleReverse(
            payment
          );
        }

        return;
      }

      alert(details);
    };

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <ModuleLayout
      title="Payments Ledger"
      description="Record and post cash and bank customer invoice payments."
      breadcrumbs={[
        {
          label:
            "Finance",

          href:
            "/finance",
        },

        {
          label:
            "Payments",
        },
      ]}
      stats={[
        {
          label:
            "Total Payments",

          value:
            totalCount,
        },

        {
          label:
            "Total Posted Amount",

          value:
            `$${postedAmount.toLocaleString(
              undefined,
              {
                minimumFractionDigits:
                  2,

                maximumFractionDigits:
                  2,
              }
            )}`,
        },

        {
          label:
            "Draft Payments",

          value:
            draftCount,
        },

        {
          label:
            "Reversed",

          value:
            reversedCount,
        },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingPayment(
              null
            );

            setFormOpen(
              true
            );
          }}
        >
          Record Payment
        </Button>
      }
    >
      <DataTable
        columns={
          columns
        }

        data={
          formattedPayments
        }

        loading={
          loading
        }

        onView={
          handleView
        }

        onEdit={(
          payment
        ) => {
          setEditingPayment(
            payment as Payment
          );

          setFormOpen(
            true
          );
        }}

        page={
          page
        }

        totalPages={
          totalPages
        }

        onPageChange={
          setPage
        }

        searchQuery={
          searchQuery
        }

        onSearchChange={(
          value
        ) => {
          setSearchQuery(
            value
          );

          if (
            page !== 1
          ) {
            setPage(1);
          }
        }}

        searchPlaceholder="Search payments..."
      />

      <FormDialog
        isOpen={
          formOpen
        }

        onClose={() => {
          if (
            !formLoading
          ) {
            setFormOpen(
              false
            );

            setEditingPayment(
              null
            );
          }
        }}

        title={
          editingPayment
            ? "Edit Payment"
            : "Record Payment"
        }

        fields={
          formFields
        }

        initialValues={
          editingPayment
            ? {
                paymentNumber:
                  editingPayment.referenceNumber ||
                  editingPayment.paymentNumber ||
                  "",

                customerId:
                  editingPayment.customerId ||
                  editingPayment.customer?.id ||
                  "",

                invoiceId:
                  editingPayment
                    .allocations?.[0]
                    ?.invoiceId ||
                  editingPayment.invoice?.id ||
                  "",

                amount:
                  Number(
                    editingPayment.amount ||
                      0
                  ),

                paymentMethod:
                  editingPayment.method ||
                  "CASH",
              }
            : {
                paymentNumber:
                  "",

                customerId:
                  "",

                invoiceId:
                  "",

                amount:
                  0,

                paymentMethod:
                  "CASH",
              }
        }

        onSubmit={
          handleCreateOrUpdate
        }

        loading={
          formLoading
        }
      />
    </ModuleLayout>
  );
}