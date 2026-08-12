"use client";

import React from "react";
import { useCompany } from "../../providers/company-provider";
import { useAuthStore } from "../../hooks/use-auth-store";
import { Select } from "../ui/select";

export function CompanySelector() {
  const { companies, loading } = useCompany();
  const { activeCompanyId, setActiveCompanyId } = useAuthStore();

  if (loading) {
    return <div className="text-xs text-zinc-500">Loading companies...</div>;
  }

  if (companies.length === 0) {
    return <div className="text-xs text-zinc-500">No companies seeded</div>;
  }

  return (
    <div className="w-64">
      <Select
        value={activeCompanyId || ""}
        onChange={(e) => setActiveCompanyId(e.target.value || null)}
        className="h-9 py-1 bg-zinc-900 border-zinc-800 text-zinc-200"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.code})
          </option>
        ))}
      </Select>
    </div>
  );
}
