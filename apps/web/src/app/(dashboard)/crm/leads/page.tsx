"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";
import { Filters } from "../../../../components/ui/filters";
import { Pagination } from "../../../../components/ui/pagination";

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await apiClient<{ items: Record<string, unknown>[]; totalPages: number }>(`/crm/leads?page=${page}&limit=10&search=${searchQuery}&status=${statusFilter}`);
      setLeads(data.items || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      // Mock data fallback
      setLeads([
        { id: "l1", firstName: "Alice", lastName: "Smith", companyName: "Acme Corp", email: "alice@acme.com", status: "NEW", phone: "+123456789" },
        { id: "l2", firstName: "Bob", lastName: "Jones", companyName: "Globex Inc", email: "bob@globex.com", status: "CONTACTED", phone: "+987654321" },
        { id: "l3", firstName: "Charlie", lastName: "Brown", companyName: "Peanuts Ltd", email: "charlie@peanuts.com", status: "QUALIFIED", phone: "+555666777" },
      ]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchLeads();
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Leads Registry</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Track corporate contacts and sales acquisitions.</p>
        </div>
        <Button onClick={() => alert("Create Lead Form overlay")}>New Lead</Button>
      </div>

      <Filters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search leads by name or company..."
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterLabel="Lead Status"
        filterOptions={[
          { value: "ALL", label: "All Statuses" },
          { value: "NEW", label: "New" },
          { value: "CONTACTED", label: "Contacted" },
          { value: "QUALIFIED", label: "Qualified" },
          { value: "LOST", label: "Lost" },
        ]}
      />

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading leads...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-semibold">{lead.firstName} {lead.lastName}</TableCell>
                  <TableCell>{lead.companyName}</TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      lead.status === "NEW" ? "bg-blue-500/10 text-blue-500" :
                      lead.status === "CONTACTED" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {lead.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => window.location.href = `/crm/leads/${lead.id}`}>
                      View details
                    </Button>
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
