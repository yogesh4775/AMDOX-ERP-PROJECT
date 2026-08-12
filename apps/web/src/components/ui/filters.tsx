"use client";

import React from "react";
import { Input } from "./input";
import { Select } from "./select";

interface FilterOption {
  value: string;
  label: string;
}

interface FiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: FilterOption[];
  filterLabel?: string;
}

export function Filters({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterValue,
  onFilterChange,
  filterOptions,
  filterLabel,
}: FiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 w-full bg-white dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex-1">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
        />
      </div>
      {onFilterChange && filterOptions && (
        <div className="w-full sm:w-64">
          <Select
            label={filterLabel}
            value={filterValue}
            onChange={(e) => onFilterChange(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
