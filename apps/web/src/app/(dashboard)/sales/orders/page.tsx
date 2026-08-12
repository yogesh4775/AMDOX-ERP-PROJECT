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

interface CustomerOption {
  label: string;
  value: string;
}

interface SalesOrder {
  id: string;
  orderNumber?: string;
  customerId?: string;
  customer?: {
    id?: string;
    name?: string;
  };
  totalAmount?: number | string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  status?: string;
  notes?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface NormalizedResult {
  items: any[];
  total?: number;
  totalCount?: number;
  meta?: {
    total?: number;
    totalCount?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [allOrders, setAllOrders] = useState<SalesOrder[]>([]);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<CustomerOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] =
    useState<SalesOrder | null>(null);

  /*
   * ------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------
   */

  const getItems = (response: unknown): any[] => {
    const normalized = normalizeResponse(response) as
      | NormalizedResult
      | any[]
      | null
      | undefined;

    if (Array.isArray(normalized)) {
      return normalized;
    }

    if (
      normalized &&
      typeof normalized === "object" &&
      Array.isArray(normalized.items)
    ) {
      return normalized.items;
    }

    return [];
  };

  const getTotal = (
    response: unknown,
    fallback: number
  ): number => {
    const normalized = normalizeResponse(response) as
      | NormalizedResult
      | any[]
      | null
      | undefined;

    if (!normalized || Array.isArray(normalized)) {
      return fallback;
    }

    if (
      typeof normalized.totalCount === "number"
    ) {
      return normalized.totalCount;
    }

    if (
      typeof normalized.total === "number"
    ) {
      return normalized.total;
    }

    if (
      normalized.meta &&
      typeof normalized.meta.totalCount === "number"
    ) {
      return normalized.meta.totalCount;
    }

    if (
      normalized.meta &&
      typeof normalized.meta.total === "number"
    ) {
      return normalized.meta.total;
    }

    return fallback;
  };

  /*
   * ------------------------------------------------------------
   * Fetch Customers
   * ------------------------------------------------------------
   */

  const fetchLookupData = async () => {
    setLookupLoading(true);

    try {
      const [custResponse, prodResponse] = await Promise.all([
        apiClient("/sales/customers?limit=100"),
        apiClient("/inventory/products?limit=100"),
      ]);

      const custItems = getItems(custResponse);
      const custOptions: CustomerOption[] = custItems
        .filter((customer: any) => customer?.id)
        .map((customer: any) => ({
          label:
            customer.name ||
            customer.customerName ||
            customer.code ||
            "Unnamed Customer",
          value: customer.id,
        }));
      setCustomers(custOptions);

      const prodItems = getItems(prodResponse);
      const prodOptions: CustomerOption[] = prodItems
        .filter((product: any) => product?.id)
        .map((product: any) => ({
          label: `${product.name || "Unnamed Product"} (${product.sku || "N/A"})`,
          value: product.id,
        }));
      setProducts(prodOptions);
    } catch (error) {
      console.error(
        "Failed to load lookup data:",
        error
      );
    } finally {
      setLookupLoading(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * Fetch Sales Orders
   * ------------------------------------------------------------
   */

  const fetchOrders = async () => {
    setLoading(true);

    try {
      const response = await apiClient(
        "/sales/orders"
      );

      const items = getItems(response) as SalesOrder[];

      setAllOrders(items);

      const total = getTotal(
        response,
        items.length
      );

      setTotalCount(total);
    } catch (error) {
      console.error(
        "Failed to load sales orders:",
        error
      );

      setAllOrders([]);
      setOrders([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * Initial Load
   * ------------------------------------------------------------
   */

  useEffect(() => {
    void fetchLookupData();
    void fetchOrders();
  }, []);

  /*
   * ------------------------------------------------------------
   * Search + Pagination
   * ------------------------------------------------------------
   */

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) {
      return allOrders;
    }

    const query = searchQuery
      .trim()
      .toLowerCase();

    return allOrders.filter((order) => {
      const orderNumber = (
        order.orderNumber || ""
      ).toLowerCase();

      const customerName = (
        order.customer?.name || ""
      ).toLowerCase();

      const status = (
        order.status || ""
      ).toLowerCase();

      const notes = (
        order.notes || ""
      ).toLowerCase();

      return (
        orderNumber.includes(query) ||
        customerName.includes(query) ||
        status.includes(query) ||
        notes.includes(query)
      );
    });
  }, [allOrders, searchQuery]);

  useEffect(() => {
    const total = filteredOrders.length;

    const pages = Math.max(
      1,
      Math.ceil(total / pageSize)
    );

    setTotalPages(pages);

    if (page > pages) {
      setPage(pages);
      return;
    }

    const startIndex =
      (page - 1) * pageSize;

    const paginated =
      filteredOrders.slice(
        startIndex,
        startIndex + pageSize
      );

    setOrders(paginated);
  }, [filteredOrders, page]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  /*
   * ------------------------------------------------------------
   * Create / Update Order
   * ------------------------------------------------------------
   */

  const handleCreateOrUpdate = async (
    values: Record<string, any>
  ) => {
    setFormLoading(true);

    try {
      if (editingOrder) {
        const payload = {
          customerId: values.customerId,
          expectedDeliveryDate: new Date(
            values.expectedDeliveryDate
          ).toISOString(),
          notes: values.notes?.trim() || undefined,
          expectedVersion: Number(
            editingOrder.version || 1
          ),
        };

        await apiClient(
          `/sales/orders/${editingOrder.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );
      } else {
        const payload = {
          customerId: values.customerId,
          expectedDeliveryDate: new Date(
            values.expectedDeliveryDate
          ).toISOString(),
          notes: values.notes?.trim() || undefined,
          items: [
            {
              productId: values.productId,
              quantity: Number(values.quantity || 0),
              unitPrice: Number(values.unitPrice || 0),
            },
          ],
        };

        await apiClient(
          "/sales/orders",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
      }

      setFormOpen(false);
      setEditingOrder(null);

      await fetchOrders();
    } catch (error: any) {
      console.error(
        "Failed to save sales order:",
        error
      );

      alert(
        error?.message ||
          "Failed to save sales order"
      );
    } finally {
      setFormLoading(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * Open New Order
   * ------------------------------------------------------------
   */

  const handleNewOrder = () => {
    setEditingOrder(null);
    setFormOpen(true);
  };

  /*
   * ------------------------------------------------------------
   * Edit Order
   * ------------------------------------------------------------
   */

  const handleEditOrder = (
    order: SalesOrder
  ) => {
    setEditingOrder(order);
    setFormOpen(true);
  };

  /*
   * ------------------------------------------------------------
   * View Order
   * ------------------------------------------------------------
   */

  const handleViewOrder = (
    order: SalesOrder
  ) => {
    const total = Number(
      order.totalAmount || 0
    );

    alert(
      [
        "Sales Order Details",
        "",
        `Order Number: ${
          order.orderNumber || "—"
        }`,
        `Customer: ${
          order.customer?.name || "—"
        }`,
        `Total Amount: $${total.toFixed(2)}`,
        `Status: ${
          order.status || "—"
        }`,
        `Order Date: ${
          order.orderDate
            ? new Date(
                order.orderDate
              ).toLocaleDateString()
            : "—"
        }`,
        `Notes: ${
          order.notes || "None"
        }`,
      ].join("\n")
    );
  };

  /*
   * ------------------------------------------------------------
   * Format DataTable Data
   * ------------------------------------------------------------
   */

  const formattedOrders = orders.map(
    (order) => ({
      ...order,

      customerName:
        order.customer?.name || "—",

      formattedDate: order.orderDate
        ? new Date(
            order.orderDate
          ).toLocaleDateString()
        : "—",

      totalAmount:
        Number(order.totalAmount || 0),
    })
  );

  /*
   * ------------------------------------------------------------
   * Statistics
   * ------------------------------------------------------------
   */

  const confirmedOrders =
    allOrders.filter(
      (order) =>
        order.status === "CONFIRMED" ||
        order.status === "DELIVERED"
    ).length;

  const pendingOrders =
    allOrders.filter(
      (order) =>
        order.status === "PENDING"
    ).length;

  const cancelledOrders =
    allOrders.filter(
      (order) =>
        order.status === "CANCELLED"
    ).length;

  /*
   * ------------------------------------------------------------
   * Table Columns
   * ------------------------------------------------------------
   */

  const columns: ColumnConfig[] = [
    {
      key: "orderNumber",
      header: "Order #",
    },

    {
      key: "customerName",
      header: "Customer",
    },

    {
      key: "totalAmount",
      header: "Total Amount",
      type: "currency",
    },

    {
      key: "formattedDate",
      header: "Order Date",
    },

    {
      key: "status",
      header: "Status",
      type: "badge",

      badgeColors: {
        DRAFT:
          "bg-zinc-500/10 text-zinc-500",

        PENDING:
          "bg-amber-500/10 text-amber-500",

        APPROVED:
          "bg-blue-500/10 text-blue-500",

        CONFIRMED:
          "bg-emerald-500/10 text-emerald-500",

        DELIVERED:
          "bg-purple-500/10 text-purple-500",

        CANCELLED:
          "bg-rose-500/10 text-rose-500",
      },
    },
  ];

  /*
   * ------------------------------------------------------------
   * Form Fields
   * ------------------------------------------------------------
   */

  const formFields: FormField[] = useMemo(() => {
    const fields: FormField[] = [
      {
        name: "customerId",
        label: "Select Customer",
        type: "select",
        options: customers,
        required: true,
      },
      {
        name: "expectedDeliveryDate",
        label: "Expected Delivery Date",
        type: "date",
        required: true,
      },
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
      },
    ];

    if (!editingOrder) {
      fields.push(
        {
          name: "productId",
          label: "Select Product",
          type: "select",
          options: products,
          required: true,
        },
        {
          name: "quantity",
          label: "Quantity",
          type: "number",
          required: true,
        },
        {
          name: "unitPrice",
          label: "Unit Price",
          type: "number",
          required: true,
        }
      );
    }

    return fields;
  }, [editingOrder, customers, products]);

  /*
   * ------------------------------------------------------------
   * Render
   * ------------------------------------------------------------
   */

  return (
    <ModuleLayout
      title="Sales Orders"
      description="Track and process customer sales orders and fulfillments."
      breadcrumbs={[
        {
          label: "Sales & CRM",
          href: "/sales",
        },
        {
          label: "Sales Orders",
        },
      ]}
      stats={[
        {
          label: "Total Orders",
          value: totalCount,
        },

        {
          label: "Confirmed Orders",
          value: confirmedOrders,
        },

        {
          label: "Pending Orders",
          value: pendingOrders,
        },

        {
          label: "Cancelled Orders",
          value: cancelledOrders,
        },
      ]}
      actions={
        <Button
          onClick={handleNewOrder}
          disabled={lookupLoading}
        >
          {lookupLoading
            ? "Loading..."
            : "New Sales Order"}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={formattedOrders}
        loading={loading}
        onView={handleViewOrder}
        onEdit={handleEditOrder}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search sales orders..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => {
          if (!formLoading) {
            setFormOpen(false);
            setEditingOrder(null);
          }
        }}
        title={
          editingOrder
            ? "Edit Sales Order"
            : "Add Sales Order"
        }
        fields={formFields}
        initialValues={
          editingOrder
            ? {
                customerId:
                  editingOrder.customerId ||
                  editingOrder.customer?.id ||
                  "",

                expectedDeliveryDate: editingOrder.expectedDeliveryDate
                  ? new Date(editingOrder.expectedDeliveryDate)
                      .toISOString()
                      .split("T")[0]
                  : "",

                notes:
                  editingOrder.notes || "",
              }
            : {
                customerId: "",
                expectedDeliveryDate: "",
                notes: "",
                productId: "",
                quantity: 1,
                unitPrice: 0,
              }
        }
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />
    </ModuleLayout>
  );
}