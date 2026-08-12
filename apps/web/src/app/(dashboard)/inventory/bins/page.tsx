"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { Button } from "../../../../components/ui/button";

export default function BinsPage() {
  const [bins, setBins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Dropdowns
  const [zones, setZones] = useState<{ label: string; value: string }[]>([]);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingBin, setEditingBin] = useState<any>(null);

  const [allBins, setAllBins] = useState<any[]>([]);

  const fetchLookupData = async () => {
    try {
      const res = await apiClient("/wms/zones");
      const normalized = normalizeResponse(res);
      setZones(normalized.items.map((z: any) => ({ label: `${z.warehouse?.code} - ${z.code}`, value: z.id })));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBins = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/wms/bins");
      const normalized = normalizeResponse(res);
      setAllBins(normalized.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLookupData();
    fetchBins();
  }, []);

  useEffect(() => {
    let filtered = allBins;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((b: any) => {
        const code = (b.code || "").toLowerCase();
        const zone = (b.zone?.code || "").toLowerCase();
        const status = (b.status || "").toLowerCase();
        return code.includes(q) || zone.includes(q) || status.includes(q);
      });
    }

    const pageSize = 10;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    setTotalPages(pages);
    setTotalCount(total);

    const startIndex = (page - 1) * pageSize;
    setBins(filtered.slice(startIndex, startIndex + pageSize));
  }, [allBins, searchQuery, page]);

  const handleCreateOrUpdate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      if (editingBin) {
        await apiClient(`/wms/bins/${editingBin.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiClient("/wms/bins", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setFormOpen(false);
      fetchBins();
    } catch (err: any) {
      alert(err.message || "Failed to save bin");
    } finally {
      setFormLoading(false);
    }
  };

  const formattedBins = bins.map((b) => ({
    ...b,
    warehouseName: b.zone?.warehouse?.name || "—",
    zoneCode: b.zone?.code || "—",
  }));

  const columns: ColumnConfig[] = [
    { key: "code", header: "Bin Code" },
    { key: "zoneCode", header: "Zone" },
    { key: "warehouseName", header: "Warehouse" },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeColors: {
        ACTIVE: "bg-emerald-500/10 text-emerald-500",
        INACTIVE: "bg-zinc-500/10 text-zinc-500",
      },
    },
  ];

  const formFields: FormField[] = [
    { name: "code", label: "Bin Code", type: "text", required: true },
    { name: "zoneId", label: "Warehouse Zone", type: "select", options: zones, required: true },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Inactive", value: "INACTIVE" },
      ],
      required: true,
    },
  ];

  return (
    <ModuleLayout
      title="Warehouse Bins"
      description="Manage warehouse bin designations and location rules."
      breadcrumbs={[{ label: "Inventory & WMS", href: "/inventory" }, { label: "Bins" }]}
      stats={[
        { label: "Total Bins", value: totalCount },
        { label: "Active Bins", value: bins.filter((b) => b.status === "ACTIVE").length },
      ]}
      actions={
        <Button
          onClick={() => {
            setEditingBin(null);
            setFormOpen(true);
          }}
        >
          Add Bin
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={formattedBins}
        loading={loading}
        onEdit={(b) => {
          setEditingBin(b);
          setFormOpen(true);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search bins..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingBin ? "Edit Bin" : "Add Bin"}
        fields={formFields}
        initialValues={editingBin || { status: "ACTIVE" }}
        onSubmit={handleCreateOrUpdate}
        loading={formLoading}
      />
    </ModuleLayout>
  );
}
