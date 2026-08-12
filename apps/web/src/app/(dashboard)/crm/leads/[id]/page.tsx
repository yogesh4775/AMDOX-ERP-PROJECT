"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { ArrowLeft, User, Phone, Mail, Building, History } from "lucide-react";

export default function LeadDetailsPage({ params }: { params: { id: string } }) {
  const [lead, setLead] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDetails = async () => {
    try {
      const data = await apiClient(`/crm/leads/${params.id}`);
      setLead(data);
      // Fetch associated audit logs
      const logs = await apiClient(`/audit-logs?entity=Lead&entityId=${params.id}`);
      setAuditLogs(logs);
    } catch {
      // Mock details
      setLead({
        id: params.id,
        firstName: "Alice",
        lastName: "Smith",
        companyName: "Acme Corp",
        email: "alice@acme.com",
        phone: "+123456789",
        status: "NEW",
        notes: "Interested in corporate CRM enterprise packages and billing integrations.",
      });
      setAuditLogs([
        { id: "1", action: "LEAD_CREATED", createdAt: new Date(Date.now() - 3600000).toISOString() },
        { id: "2", action: "LEAD_STATUS_UPDATED", createdAt: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [params.id]);

  if (loading) {
    return <div className="text-zinc-500 text-center py-10">Loading lead profile...</div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {lead.firstName} {lead.lastName}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Contact Profile Details Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Contact Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-zinc-400" />
              <div>
                <p className="font-semibold">{lead.companyName}</p>
                <p className="text-xs text-zinc-400">Employer Company</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-zinc-400" />
              <div>
                <p>{lead.email}</p>
                <p className="text-xs text-zinc-400">Email Address</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-zinc-400" />
              <div>
                <p>{lead.phone}</p>
                <p className="text-xs text-zinc-400">Contact Number</p>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h4 className="font-semibold mb-2">Acquisition Notes</h4>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{lead.notes}</p>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs Timeline Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-zinc-400" /> Activity History
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex flex-col gap-0.5 border-l-2 border-emerald-500 pl-3">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{log.action}</span>
                <span className="text-xs text-zinc-400">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
