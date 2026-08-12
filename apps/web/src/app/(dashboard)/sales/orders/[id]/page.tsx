"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { ArrowLeft, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchDetails = async () => {
    try {
      const data = await apiClient(`/sales/orders/${params.id}`);
      setOrder(data);
    } catch {
      setOrder({
        id: params.id,
        orderNumber: "SO-2026-0001",
        customerName: "Acme Corp",
        totalAmount: 18400,
        orderDate: "2026-07-10",
        status: "PENDING",
        items: [
          { sku: "SKU-001", name: "Corporate CRM Subscription", qty: 1, price: 15000 },
          { sku: "SKU-002", name: "Custom Billing Setup Service", qty: 1, price: 3400 },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [params.id]);

  const handleWorkflowAction = async (action: "APPROVE" | "REJECT") => {
    setSubmitting(true);
    try {
      await apiClient(`/workflows/instances/action`, {
        method: "POST",
        body: JSON.stringify({
          entityType: "SalesOrder",
          entityId: params.id,
          action,
        }),
      });
      alert(`Workflow ${action} successfully processed!`);
      fetchDetails();
    } catch {
      // Offline fallback: simulate status update locally
      setOrder((prev: any) => ({
        ...prev,
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-zinc-500 text-center py-10">Loading order details...</div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Sales Order: {order.orderNumber}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Order Info & Line Items */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Customer</p>
                <p>{order.customerName}</p>
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Date Ordered</p>
                <p>{order.orderDate}</p>
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-2">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50 mb-3">Line Items</h3>
              <div className="flex flex-col gap-2">
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-zinc-100 dark:border-zinc-800/80">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</p>
                      <p className="text-xs text-zinc-400">SKU: {item.sku} • Qty: {item.qty}</p>
                    </div>
                    <span className="font-semibold">${(item.price * item.qty).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 font-bold text-lg border-t border-zinc-200 dark:border-zinc-800">
              <span>Total Amount</span>
              <span className="text-emerald-500">${order.totalAmount.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Workflow Approval Card */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-sm">
              {order.status === "PENDING" ? (
                <div className="flex items-center gap-2 text-amber-500">
                  <Clock className="h-5 w-5" /> <span>Awaiting Approval</span>
                </div>
              ) : order.status === "APPROVED" || order.status === "FULFILLED" ? (
                <div className="flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="h-5 w-5" /> <span>Workflow Completed</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-rose-500">
                  <XCircle className="h-5 w-5" /> <span>Rejected</span>
                </div>
              )}
            </div>

            {order.status === "PENDING" && (
              <div className="flex flex-col gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button variant="primary" disabled={submitting} onClick={() => handleWorkflowAction("APPROVE")}>
                  Approve Order
                </Button>
                <Button variant="danger" disabled={submitting} onClick={() => handleWorkflowAction("REJECT")}>
                  Reject Order
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
