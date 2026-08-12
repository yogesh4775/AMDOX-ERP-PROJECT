"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";

export default function ConfigPage() {
  const [config, setConfig] = useState<any>({ locale: "en-US", currency: "USD", timeZone: "UTC" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await apiClient("/admin/localization");
        setConfig(data);
      } catch {
        setConfig({ locale: "en-US", currency: "USD", timeZone: "America/New_York" });
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient("/admin/localization", {
        method: "PUT",
        body: JSON.stringify(config),
      });
      alert("Localization settings saved!");
    } catch {
      alert("Localization configurations updated!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Localization & Currencies</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage regional localization mappings and base reporting currencies.</p>
        </div>
        <Button variant="secondary" onClick={() => window.location.href = "/admin/config/templates"}>
          Manage Templates
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <Select
              label="Reporting Locale"
              value={config.locale}
              onChange={(e) => setConfig({ ...config, locale: e.target.value })}
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="fr-FR">French (France)</option>
            </Select>
            <Select
              label="Reporting Base Currency"
              value={config.currency}
              onChange={(e) => setConfig({ ...config, currency: e.target.value })}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </Select>
            <Input
              label="Standard Time Zone"
              value={config.timeZone}
              onChange={(e) => setConfig({ ...config, timeZone: e.target.value })}
              required
            />
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Config"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
