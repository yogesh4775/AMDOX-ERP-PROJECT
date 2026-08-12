"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { Button } from "../../../../components/ui/button";

export default function ExpenseClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingClaim, setEditingClaim] = useState<any>(null);

  const [allClaims, setAllClaims] = useState<any[]>([]);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/expense/claims");
      const normalized = normalizeResponse(res);
      setAllClaims(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  useEffect(() => {
    let filtered = allClaims;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c: any) => {
        const empName = `${c.employee?.firstName || ""} ${c.employee?.lastName || ""}`.toLowerCase();
        const category = (c.category || "").toLowerCase();
        const status = (c.status || "").toLowerCase();
        return empName.includes(q) || category.includes(q) || status.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setClaims(filtered.slice(startIndex, startIndex + pageSize));
  }, [allClaims, searchQuery, page]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    const payload = {
      ...values,
      totalAmount: Number(values.totalAmount || 0),
    };
    try {
      if (editingClaim) {
        await apiClient(`/expense/claims/${editingClaim.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiClient("/expense/claims", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setFormOpen(false);
      fetchClaims();
    } catch (err: any) {
      alert(err.message || "Failed to save expense claim");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmit = async (c: any) => {
    try {
      await apiClient(`/expense/claims/${c.id}/submit`, { method: "POST" });
      fetchClaims();
    } catch (err: any) {
      alert(err.message || "Failed to submit expense claim");
    }
  };

  const handleApprove = async (c: any) => {
    try {
      await apiClient(`/expense/claims/${c.id}/approve`, { method: "PATCH" });
      fetchClaims();
    } catch (err: any) {
      alert(err.message || "Failed to approve expense claim");
    }
  };

  const handleReject = async (c: any) => {
    try {
      await apiClient(`/expense/claims/${c.id}/reject`, { method: "PATCH" });
      fetchClaims();
    } catch (err: any) {
      alert(err.message || "Failed to reject expense claim");
    }
  };

  const handleReimburse = async (c: any) => {
    try {
      await apiClient(`/expense/claims/${c.id}/reimburse`, { method: "POST" });
      fetchClaims();
    } catch (err: any) {
      alert(err.message || "Failed to reimburse expense claim");
    }
  };

  const columns: ColumnConfig[] = [
    { key: "claimNumber", header: "Claim #" },
    { key: "description", header: "Description" },
    { key: "totalAmount", header: "Total Claimed", type: "currency" },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeColors: {
        DRAFT: "bg-zinc-500/10 text-zinc-500",
        SUBMITTED: "bg-blue-500/10 text-blue-500",
        APPROVED: "bg-emerald-500/10 text-emerald-500",
        REJECTED: "bg-rose-500/10 text-rose-500",
        REIMBURSED: "bg-purple-500/10 text-purple-500",
      },
    },
  ];

  const formFields: FormField[] = [
    { name: "claimNumber", label: "Expense Claim Number", type: "text", required: true },
    { name: "description", label: "Description / Purpose", type: "textarea", required: true },
    { name: "totalAmount", label: "Total Claimed Amount", type: "number", required: true },
  ];

  return (
    <ModuleLayout
      title="Expense Claims"
      description="View and manage corporate expense reimbursement claims."
      breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Expense Claims" }]}
      stats={[
        { label: "Total Claims", value: totalCount },
        {
          label: "Total Approved Spend",
          value: `$${claims
            .filter((c) => c.status === "APPROVED" || c.status === "REIMBURSED")
            .reduce((sum, c) => sum + Number(c.totalAmount || 0), 0)
            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingClaim(null);
            setFormOpen(true);
          }}
        >
          Add Claim
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={claims}
        loading={loading}
        onView={(c) => {
          const details = `Claim Details:\nNumber: ${c.claimNumber}\nDescription: ${c.description}\nTotal Claimed: $${c.totalAmount}\nStatus: ${c.status}`;
          if (c.status === "DRAFT") {
            if (confirm(`${details}\n\nWould you like to SUBMIT this expense claim?`)) {
              handleSubmit(c);
            }
          } else if (c.status === "SUBMITTED") {
            const act = prompt(`${details}\n\nEnter "APPROVE" to approve claim, or "REJECT" to deny:`);
            if (act?.toUpperCase() === "APPROVE") {
              handleApprove(c);
            } else if (act?.toUpperCase() === "REJECT") {
              handleReject(c);
            }
          } else if (c.status === "APPROVED") {
            if (confirm(`${details}\n\nWould you like to mark this claim as REIMBURSED?`)) {
              handleReimburse(c);
            }
          } else {
            alert(details);
          }
        }}
        onEdit={(c) => {
          setEditingClaim(c);
          setFormOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search expense claims..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingClaim ? "Edit Expense Claim" : "Add Expense Claim"}
        fields={formFields}
        initialValues={editingClaim || { totalAmount: 0 }}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />
    </ModuleLayout>
  );
}
