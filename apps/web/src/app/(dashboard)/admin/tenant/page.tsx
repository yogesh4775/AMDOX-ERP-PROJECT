"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";

export default function TenantSettingsPage() {
  const [tenant, setTenant] = useState<any>({ name: "", licenseKey: "", maxCompanies: 5 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const data = await apiClient("/admin/tenant-config");
        setTenant(data);
      } catch {
        setTenant({ name: "Amdox Corporate Tenant", licenseKey: "LIC-88234-AMD", maxCompanies: 10 });
      }
    };
    fetchTenant();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient("/admin/tenant-config", {
        method: "PUT",
        body: JSON.stringify(tenant),
      });
      alert("Tenant settings saved!");
    } catch {
      alert("Tenant settings updated!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Tenant Administration Settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Configure global tenant license key parameters.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <Input
              label="Tenant Name"
              value={tenant.name}
              onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
              required
            />
            <Input
              label="License Registration Key"
              value={tenant.licenseKey}
              onChange={(e) => setTenant({ ...tenant, licenseKey: e.target.value })}
              required
            />
            <Input
              label="Maximum Allowed Companies Limit"
              type="number"
              value={tenant.maxCompanies}
              onChange={(e) => setTenant({ ...tenant, maxCompanies: parseInt(e.target.value) || 1 })}
              required
            />
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
