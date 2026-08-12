"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { Button } from "../../../../components/ui/button";

interface PurchaseOrder {
  id: string;
  orderNumber?: string;
  supplierName?: string;
  expectedDeliveryDate?: string;
  totalAmount?: number | string;
  status?: string;
  notes?: string;
  version?: number;
  items?: any[];
}

interface SelectOption {
  label: string;
  value: string;
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [allOrders, setAllOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<SelectOption[]>([]);
  const [warehouses, setWarehouses] = useState<SelectOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] =
    useState<PurchaseOrder | null>(null);

  /*
   * ---------------------------------------------------------
   * LOOKUP DATA
   * ---------------------------------------------------------
   */

  const fetchLookupData = async () => {
    try {
      const [productsResponse, warehousesResponse] = await Promise.all([
        apiClient("/inventory/products?limit=100"),
        apiClient("/master-data/warehouses?limit=100"),
      ]);

      const productsData = normalizeResponse(productsResponse);
      const warehousesData = normalizeResponse(warehousesResponse);

      setProducts(
        (productsData.items || []).map((product: any) => ({
          label: `${product.sku || "—"} - ${product.name || "Unnamed Product"}`,
          value: product.id,
        }))
      );

      setWarehouses(
        (warehousesData.items || []).map((warehouse: any) => ({
          label: `${warehouse.code || ""}${
            warehouse.code ? " - " : ""
          }${warehouse.name || "Unnamed Warehouse"}`,
          value: warehouse.id,
        }))
      );
    } catch (error) {
      console.error("Failed to load purchase lookup data:", error);
    }
  };

  /*
   * ---------------------------------------------------------
   * FETCH PURCHASE ORDERS
   * ---------------------------------------------------------
   */

  const fetchOrders = async () => {
    setLoading(true);

    try {
      const response = await apiClient("/purchase");
      const normalized = normalizeResponse(response);

      setAllOrders(normalized.items || []);
    } catch (error) {
      console.error("Failed to load purchase orders:", error);
      setAllOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLookupData();
    void fetchOrders();
  }, []);

  /*
   * ---------------------------------------------------------
   * SEARCH + PAGINATION
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();

    let filtered = [...allOrders];

    if (query) {
      filtered = filtered.filter((order) => {
        const orderNumber = (order.orderNumber || "").toLowerCase();
        const supplier = (order.supplierName || "").toLowerCase();
        const status = (order.status || "").toLowerCase();

        return (
          orderNumber.includes(query) ||
          supplier.includes(query) ||
          status.includes(query)
        );
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));

    setTotalPages(pages);
    setTotalCount(total);

    const safePage = Math.min(page, pages);

    if (safePage !== page) {
      setPage(safePage);
      return;
    }

    const startIndex = (safePage - 1) * pageSize;

    setOrders(filtered.slice(startIndex, startIndex + pageSize));
  }, [allOrders, searchQuery, page]);

  /*
   * ---------------------------------------------------------
   * CREATE / UPDATE
   * ---------------------------------------------------------
   */

  const handleCreateOrUpdate = async (
    values: Record<string, any>
  ) => {
    setFormLoading(true);

    try {
      if (editingOrder) {
        const payload = {
          supplierName: String(values.supplierName || "").trim(),
          expectedDeliveryDate: new Date(
            values.expectedDeliveryDate
          ).toISOString(),
          notes: String(values.notes || ""),
          expectedVersion: Number(editingOrder.version || 1),
        };

        await apiClient(`/purchase/${editingOrder.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        const payload = {
          supplierName: String(values.supplierName || "").trim(),
          expectedDeliveryDate: new Date(
            values.expectedDeliveryDate
          ).toISOString(),
          notes: String(values.notes || ""),
          items: [
            {
              productId: values.productId,
              quantity: Number(values.quantity || 0),
              unitPrice: Number(values.unitPrice || 0),
            },
          ],
        };

        await apiClient("/purchase", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setFormOpen(false);
      setEditingOrder(null);

      await fetchOrders();
    } catch (error: any) {
      alert(
        error?.message || "Failed to save purchase order"
      );
    } finally {
      setFormLoading(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * APPROVE PURCHASE ORDER
   * ---------------------------------------------------------
   */

  const handleApprove = async (purchaseOrder: PurchaseOrder) => {
    try {
      await apiClient(
        `/purchase/${purchaseOrder.id}/approve`,
        {
          method: "PATCH",
          body: JSON.stringify({
            expectedVersion: Number(
              purchaseOrder.version || 1
            ),
          }),
        }
      );

      await fetchOrders();
    } catch (error: any) {
      alert(
        error?.message ||
          "Failed to approve purchase order"
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * RECEIVE PURCHASE ORDER
   * ---------------------------------------------------------
   */

  const handleReceiveAll = async (
    purchaseOrder: PurchaseOrder,
    warehouseId: string
  ) => {
    try {
      const detailResponse = await apiClient(
        `/purchase/${purchaseOrder.id}`
      );

      const detailData = normalizeResponse(detailResponse);

      const detail = detailData || purchaseOrder;

      const items = Array.isArray(detail.items)
        ? detail.items
        : [];

      if (items.length === 0) {
        alert(
          "No purchase order items were found to receive."
        );
        return;
      }

      const receiveItems = items
        .map((item: any) => ({
          productId: item.productId,
          quantityReceived: Number(
            item.quantity ??
              item.quantityOrdered ??
              item.orderedQuantity ??
              0
          ),
        }))
        .filter(
          (item: any) =>
            item.productId &&
            item.quantityReceived > 0
        );

      if (receiveItems.length === 0) {
        alert(
          "No valid purchase order items are available for receiving."
        );
        return;
      }

      await apiClient(
        `/purchase/${purchaseOrder.id}/receive`,
        {
          method: "PATCH",
          body: JSON.stringify({
            warehouseId,
            expectedVersion: Number(
              purchaseOrder.version || 1
            ),
            items: receiveItems,
          }),
        }
      );

      await fetchOrders();
    } catch (error: any) {
      alert(
        error?.message ||
          "Failed to receive purchase order"
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * CANCEL PURCHASE ORDER
   * ---------------------------------------------------------
   */

  const handleCancel = async (
    purchaseOrder: PurchaseOrder
  ) => {
    try {
      await apiClient(
        `/purchase/${purchaseOrder.id}/cancel`,
        {
          method: "PATCH",
          body: JSON.stringify({
            expectedVersion: Number(
              purchaseOrder.version || 1
            ),
          }),
        }
      );

      await fetchOrders();
    } catch (error: any) {
      alert(
        error?.message ||
          "Failed to cancel purchase order"
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * FORM FIELDS
   * ---------------------------------------------------------
   */

  const formFields: FormField[] = useMemo(() => {
    const fields: FormField[] = [
      {
        name: "supplierName",
        label: "Supplier Name",
        type: "text",
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
  }, [editingOrder, products]);

  /*
   * ---------------------------------------------------------
   * TABLE DATA
   * ---------------------------------------------------------
   */

  const formattedOrders = orders.map((order) => ({
    ...order,

    formattedDate: order.expectedDeliveryDate
      ? new Date(
          order.expectedDeliveryDate
        ).toLocaleDateString()
      : "—",

    totalAmount:
      typeof order.totalAmount === "string"
        ? Number(order.totalAmount)
        : order.totalAmount ?? 0,
  }));

  const columns: ColumnConfig[] = [
    {
      key: "orderNumber",
      header: "PO #",
    },
    {
      key: "supplierName",
      header: "Supplier / Vendor",
    },
    {
      key: "totalAmount",
      header: "Total Amount",
      type: "currency",
    },
    {
      key: "formattedDate",
      header: "Expected Delivery",
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
        RECEIVED:
          "bg-emerald-500/10 text-emerald-500",
        PARTIALLY_RECEIVED:
          "bg-purple-500/10 text-purple-500",
        CANCELLED:
          "bg-rose-500/10 text-rose-500",
      },
    },
  ];

  /*
   * ---------------------------------------------------------
   * VIEW DETAILS
   * ---------------------------------------------------------
   */

  const handleView = async (purchaseOrder: any) => {
    const details =
      `Purchase Order Details\n\n` +
      `PO Number: ${
        purchaseOrder.orderNumber || "—"
      }\n` +
      `Supplier: ${
        purchaseOrder.supplierName || "—"
      }\n` +
      `Total Amount: $${Number(
        purchaseOrder.totalAmount || 0
      ).toLocaleString()}\n` +
      `Status: ${
        purchaseOrder.status || "—"
      }\n` +
      `Expected Delivery: ${
        purchaseOrder.formattedDate || "—"
      }`;

    if (
      purchaseOrder.status === "PENDING"
    ) {
      const approve = confirm(
        `${details}\n\nApprove this purchase order?`
      );

      if (approve) {
        await handleApprove(purchaseOrder);
      }

      return;
    }

    if (
      purchaseOrder.status === "APPROVED" ||
      purchaseOrder.status ===
        "PARTIALLY_RECEIVED"
    ) {
      if (warehouses.length === 0) {
        alert(
          `${details}\n\nNo warehouses are available for receiving.`
        );
        return;
      }

      const warehouseText = warehouses
        .map(
          (warehouse, index) =>
            `${index + 1}. ${warehouse.label}`
        )
        .join("\n");

      const selected = prompt(
        `${details}\n\nSelect warehouse number for receiving:\n\n${warehouseText}`
      );

      if (!selected) {
        return;
      }

      const index =
        Number(selected) - 1;

      if (
        Number.isNaN(index) ||
        index < 0 ||
        index >= warehouses.length
      ) {
        alert("Invalid warehouse selection.");
        return;
      }

      const warehouse =
        warehouses[index];

      const action = confirm(
        `Receive all available items into:\n\n${warehouse.label}\n\nContinue?`
      );

      if (action) {
        await handleReceiveAll(
          purchaseOrder,
          warehouse.value
        );
      }

      return;
    }

    if (
      purchaseOrder.status === "DRAFT"
    ) {
      const cancel = confirm(
        `${details}\n\nDo you want to cancel this purchase order?`
      );

      if (cancel) {
        await handleCancel(purchaseOrder);
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
      title="Purchase Orders"
      description="Track raw materials and inventory purchases from suppliers."
      breadcrumbs={[
        {
          label: "Procurement",
          href: "/procurement",
        },
        {
          label: "Purchase Orders",
        },
      ]}
      stats={[
        {
          label: "Total Purchase Orders",
          value: totalCount,
        },
        {
          label: "Active Approvals",
          value: allOrders.filter(
            (order) =>
              order.status === "PENDING"
          ).length,
        },
        {
          label: "Approved Orders",
          value: allOrders.filter(
            (order) =>
              order.status === "APPROVED"
          ).length,
        },
        {
          label: "Received Orders",
          value: allOrders.filter(
            (order) =>
              order.status === "RECEIVED"
          ).length,
        },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingOrder(null);
            setFormOpen(true);
          }}
        >
          New Purchase Order
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={formattedOrders}
        loading={loading}
        onView={handleView}
        onEdit={(purchaseOrder) => {
          setEditingOrder(
            purchaseOrder as PurchaseOrder
          );
          setFormOpen(true);
        }}
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
        searchPlaceholder="Search purchase orders..."
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
            ? "Edit Purchase Order"
            : "Add Purchase Order"
        }
        fields={formFields}
        initialValues={
          editingOrder
            ? {
                supplierName:
                  editingOrder.supplierName || "",
                expectedDeliveryDate:
                  editingOrder.expectedDeliveryDate
                    ? editingOrder.expectedDeliveryDate.split(
                        "T"
                      )[0]
                    : "",
                notes:
                  editingOrder.notes || "",
              }
            : {
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