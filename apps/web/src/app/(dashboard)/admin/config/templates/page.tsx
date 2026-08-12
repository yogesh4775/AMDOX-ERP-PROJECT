"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Select } from "../../../../../components/ui/select";
import { ArrowLeft } from "lucide-react";

const TEMPLATE_TAGS = ["{{User}}", "{{VerificationCode}}", "{{Company}}", "{{ExpiryTime}}"];

export default function TemplatesPage() {
  const [selectedType, setSelectedType] = useState("MFA_EMAIL");
  const [content, setContent] = useState(
    "Hello {{User}},\n\nYour Amdox ERP security verification code is: {{VerificationCode}}.\nThis code is valid for the next {{ExpiryTime}} minutes under entity {{Company}}.\n\nRegards,\nAmdox Security System"
  );

  const insertTag = (tag: string) => {
    setContent((prev) => prev + " " + tag);
  };

  const handleSave = () => {
    alert(`Template formulas saved successfully for type: ${selectedType}!`);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Notification Templates</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Configure email and SMS notification bodies with template codes.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-col gap-4">
          <Select
            label="Template Trigger Type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="MFA_EMAIL">MFA Token Email Body</option>
            <option value="MFA_SMS">MFA Token SMS Body</option>
            <option value="WORKFLOW_ALERT">Workflow Pending Action Email</option>
          </Select>

          {/* Dynamic Placeholder Insertion Tags Bar */}
          <div>
            <span className="text-xs font-semibold text-zinc-400 block mb-2">Available Placeholder tags</span>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertTag(tag)}
                  className="text-xs font-mono bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 block mb-1">Monospaced Content Editor</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 font-mono text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave}>Save Template</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
