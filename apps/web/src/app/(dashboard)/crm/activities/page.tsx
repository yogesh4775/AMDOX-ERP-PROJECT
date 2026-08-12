"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { ModuleLayout } from "../../../../components/ui/module-layout";
import { DataTable, ColumnConfig } from "../../../../components/ui/data-table";
import { FormDialog, FormField } from "../../../../components/ui/form-dialog";
import { Select } from "../../../../components/ui/select";
import { Button } from "../../../../components/ui/button";

export default function CrmActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<{ label: string; value: string }[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const fetchLeads = async () => {
    try {
      const res = await apiClient("/crm/leads");
      const normalized = normalizeResponse(res);
      setLeads(normalized.items.map((l: any) => ({ label: `${l.companyName || "Lead"} - ${l.firstName} ${l.lastName}`, value: l.id })));
      if (normalized.items.length > 0) {
        setSelectedLeadId(normalized.items[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTimeline = async () => {
    if (!selectedLeadId) return;
    setLoading(true);
    try {
      const res = await apiClient(`/crm/leads/${selectedLeadId}/timeline`);
      // The timeline returns an array of activities directly
      const normalized = normalizeResponse(res);
      setActivities(normalized.items);
    } catch (err) {
      console.error(err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    fetchTimeline();
  }, [selectedLeadId]);

  const handleCreate = async (values: Record<string, any>) => {
    setFormLoading(true);
    try {
      await apiClient("/crm/activities", {
        method: "POST",
        body: JSON.stringify({
          leadId: selectedLeadId,
          type: values.type,
          subject: values.subject,
          description: values.description,
          activityDate: new Date().toISOString(),
        }),
      });
      setFormOpen(false);
      fetchTimeline();
    } catch (err: any) {
      alert(err.message || "Failed to log activity");
    } finally {
      setFormLoading(false);
    }
  };

  const formattedActivities = activities.map((act: any) => ({
    ...act,
    formattedDate: act.activityDate ? new Date(act.activityDate).toLocaleString() : "—",
  }));

  const columns: ColumnConfig[] = [
    {
      key: "type",
      header: "Type",
      type: "badge",
      badgeColors: {
        CALL: "bg-blue-500/10 text-blue-500",
        EMAIL: "bg-purple-500/10 text-purple-500",
        MEETING: "bg-emerald-500/10 text-emerald-500",
        TASK: "bg-zinc-500/10 text-zinc-500",
      },
    },
    { key: "subject", header: "Subject" },
    { key: "description", header: "Activity Notes" },
    { key: "formattedDate", header: "Logged At" },
  ];

  const formFields: FormField[] = [
    {
      name: "type",
      label: "Activity Type",
      type: "select",
      options: [
        { label: "Phone Call", value: "CALL" },
        { label: "Email", value: "EMAIL" },
        { label: "Meeting", value: "MEETING" },
        { label: "Task", value: "TASK" },
      ],
      required: true,
    },
    { name: "subject", label: "Subject", type: "text", required: true },
    { name: "description", label: "Activity Notes / Call Log Details", type: "textarea" },
  ];

  return (
    <ModuleLayout
      title="CRM Activities"
      description="Log and view interactions history for leads and clients."
      breadcrumbs={[{ label: "Sales & CRM", href: "/sales" }, { label: "CRM Activities" }]}
      stats={[
        { label: "Total logged timeline items", value: activities.length },
      ]}
      actions={
        <div className="flex items-center gap-4">
          <Select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            className="w-64"
          >
            {leads.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
          <Button onClick={() => setFormOpen(true)} disabled={!selectedLeadId}>
            Log Activity
          </Button>
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={formattedActivities}
        loading={loading}
        page={1}
        totalPages={1}
        searchPlaceholder="Filter interactions logs..."
      />

      <FormDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title="Log Client Interaction"
        fields={formFields}
        onSubmit={handleCreate}
        loading={formLoading}
      />
    </ModuleLayout>
  );
}
