"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { Button } from "../../../../components/ui/button";

export default function CrmContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Lookup dropdown
  const [accounts, setAccounts] = useState<{ label: string; value: string }[]>([]);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);

  const [allContacts, setAllContacts] = useState<any[]>([]);

  const fetchLookupData = async () => {
    try {
      const res = await apiClient("/crm/accounts");
      const normalized = normalizeResponse(res);
      setAccounts(normalized.items.map((a: any) => ({ label: a.name, value: a.id })));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/crm/contacts");
      const normalized = normalizeResponse(res);
      setAllContacts(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLookupData();
    fetchContacts();
  }, []);

  useEffect(() => {
    let filtered = allContacts;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c: any) => {
        const first = (c.firstName || "").toLowerCase();
        const last = (c.lastName || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        return first.includes(q) || last.includes(q) || email.includes(q) || phone.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setContacts(filtered.slice(startIndex, startIndex + pageSize));
  }, [allContacts, searchQuery, page]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      if (editingContact) {
        await apiClient(`/crm/contacts/${editingContact.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiClient("/crm/contacts", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setFormOpen(false);
      fetchContacts();
    } catch (err: any) {
      alert(err.message || "Failed to save contact");
    } finally {
      setFormLoading(false);
    }
  };

  const formattedContacts = contacts.map((c: any) => ({
    ...c,
    fullName: `${c.firstName} ${c.lastName}`,
    accountName: c.account?.name || "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "fullName", header: "Name" },
    { key: "email", header: "Email Address" },
    { key: "phone", header: "Phone Number" },
    { key: "accountName", header: "Account Company" },
  ];

  const formFields: FormField[] = [
    { name: "firstName", label: "First Name", type: "text", required: true },
    { name: "lastName", label: "Last Name", type: "text", required: true },
    { name: "email", label: "Email Address", type: "text", required: true },
    { name: "phone", label: "Phone Number", type: "text" },
    { name: "accountId", label: "Associated CRM Account", type: "select", options: accounts, required: true },
  ];

  return (
    <ModuleLayout
      title="CRM Contacts"
      description="Manage key client contacts and representatives."
      breadcrumbs={[{ label: "Sales & CRM", href: "/sales" }, { label: "CRM Contacts" }]}
      stats={[
        { label: "Total Contacts", value: totalCount },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingContact(null);
            setFormOpen(true);
          }}
        >
          Add CRM Contact
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={formattedContacts}
        loading={loading}
        onEdit={(c) => {
          setEditingContact(c);
          setFormOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search CRM contacts..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingContact ? "Edit Contact" : "Add Contact"}
        fields={formFields}
        initialValues={editingContact || {}}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />
    </ModuleLayout>
  );
}
