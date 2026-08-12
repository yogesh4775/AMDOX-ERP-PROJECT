"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/purchase?limit=100");
      const normalized = normalizeResponse(res);
      
      // Extract unique supplier names from POs
      const nameMap = new Map<string, any>();
      normalized.items.forEach((po: any) => {
        if (po.supplierName) {
          nameMap.set(po.supplierName, {
            id: po.id,
            name: po.supplierName,
            poCount: (nameMap.get(po.supplierName)?.poCount || 0) + 1,
            totalSpend: (nameMap.get(po.supplierName)?.totalSpend || 0) + Number(po.totalAmount || 0),
          });
        }
      });
      
      const supplierList = Array.from(nameMap.values());
      
      // Apply client-side search query
      const filtered = supplierList.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
      setSuppliers(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [searchQuery]);

  const columns: ColumnConfig[] = [
    { key: "name", header: "Supplier/Vendor Name" },
    { key: "poCount", header: "Purchase Orders Count", type: "number" },
    { key: "totalSpend", header: "Total Purchase Spend", type: "currency" },
  ];

  return (
    <ModuleLayout
      title="Suppliers"
      description="View suppliers and spend statistics derived from purchase order histories."
      breadcrumbs={[{ label: "Procurement", href: "/procurement" }, { label: "Suppliers" }]}
      stats={[
        { label: "Total Vendors", value: suppliers.length },
        {
          label: "Total Procurement Spend",
          value: `$${suppliers
            .reduce((sum, s) => sum + Number(s.totalSpend || 0), 0)
            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
      ]}
    >
      <DataTable
        columns={columns}
        data={suppliers}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search suppliers..."
      />
    </ModuleLayout>
  );
}
