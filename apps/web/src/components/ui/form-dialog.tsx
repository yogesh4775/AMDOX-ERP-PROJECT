"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "./modal";
import { Button } from "./button";
import { Input } from "./input";
import { Select } from "./select";

export interface FormField {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "textarea";
  options?: { label: string; value: string }[];
  required?: boolean;
}

interface FormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fields: FormField[];
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
  loading?: boolean;
}

export function FormDialog({
  isOpen,
  onClose,
  title,
  fields,
  initialValues,
  onSubmit,
  loading = false,
}: FormDialogProps) {
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (isOpen) {
      const defaultValues: Record<string, any> = {};
      fields.forEach((f) => {
        defaultValues[f.name] = initialValues?.[f.name] ?? "";
      });
      setValues(defaultValues);
    }
  }, [isOpen, fields, initialValues]);

  const handleChange = (name: string, val: any) => {
    setValues((prev) => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(values);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {f.label} {f.required && <span className="text-rose-500">*</span>}
            </label>

            {f.type === "select" ? (
              <Select
                value={values[f.name] || ""}
                onChange={(e) => handleChange(f.name, e.target.value)}
                required={f.required}
                disabled={loading}
              >
                <option value="">Select option...</option>
                {f.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            ) : f.type === "textarea" ? (
              <textarea
                value={values[f.name] || ""}
                onChange={(e) => handleChange(f.name, e.target.value)}
                required={f.required}
                disabled={loading}
                rows={3}
                className="flex w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-50"
              />
            ) : (
              <Input
                type={f.type}
                value={values[f.name] || ""}
                onChange={(e) => handleChange(f.name, e.target.value)}
                required={f.required}
                disabled={loading}
              />
            )}
          </div>
        ))}

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-6">
          <Button variant="secondary" onClick={onClose} disabled={loading} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
