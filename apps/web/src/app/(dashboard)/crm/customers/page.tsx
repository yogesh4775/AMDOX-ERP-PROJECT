"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { Button } from "../../../../components/ui/button";

export default function CrmCustomersPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingAcc, setEditingAcc] = useState<any>(null);

  const [allAccounts, setAllAccounts] = useState<any[]>([]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/crm/accounts");
      const normalized = normalizeResponse(res);
      setAllAccounts(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    let filtered = allAccounts;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((acc: any) => {
        const name = (acc.name || "").toLowerCase();
        const industry = (acc.industry || "").toLowerCase();
        const phone = (acc.phone || "").toLowerCase();
        return name.includes(q) || industry.includes(q) || phone.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setAccounts(filtered.slice(startIndex, startIndex + pageSize));
  }, [allAccounts, searchQuery, page]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      if (editingAcc) {
        await apiClient(`/crm/accounts/${editingAcc.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiClient("/crm/accounts", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setFormOpen(false);
      fetchAccounts();
    } catch (err: any) {
      alert(err.message || "Failed to save CRM customer account");
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    { key: "name", header: "Company Name" },
    { key: "industry", header: "Industry" },
    { key: "website", header: "Website" },
    { key: "phone", header: "Phone Number" },
  ];

  const formFields: FormField[] = [
    { name: "name", label: "Company Name", type: "text", required: true },
    { name: "industry", label: "Industry Sector", type: "text" },
    { name: "website", label: "Website URL", type: "text" },
    { name: "phone", label: "Phone Number", type: "text" },
  ];

  return (
    <ModuleLayout
      title="CRM Customers"
      description="Manage customer company accounts, industry tags, and websites."
      breadcrumbs={[{ label: "Sales & CRM", href: "/sales" }, { label: "CRM Customers" }]}
      stats={[
        { label: "Total CRM Customers", value: totalCount },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingAcc(null);
            setFormOpen(true);
          }}
        >
          Add CRM Account
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={accounts}
        loading={loading}
        onEdit={(a) => {
          setEditingAcc(a);
          setFormOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search CRM customers..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingAcc ? "Edit CRM Account" : "Add CRM Account"}
        fields={formFields}
        initialValues={editingAcc || {}}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />
    </ModuleLayout>
  );
}
