"use client";

import React from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table";
import { Button } from "./button";
import { Pagination } from "./pagination";
import { Filters } from "./filters";

export interface ColumnConfig {
  key: string;
  header: string;
  type?: "badge" | "date" | "number" | "text" | "currency";
  badgeColors?: Record<string, string>;
}

interface DataTableProps {
  columns: ColumnConfig[];
  data: any[];
  loading?: boolean;
  onView?: (item: any) => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}

export function DataTable({
  columns,
  data,
  loading = false,
  onView,
  onEdit,
  onDelete,
  page = 1,
  totalPages = 1,
  onPageChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  actions,
}: DataTableProps) {
  const hasActions = onView || onEdit || onDelete;

  const renderCellContent = (item: any, col: ColumnConfig) => {
    const val = item[col.key];

    if (val === undefined || val === null) {
      return <span className="text-zinc-400 dark:text-zinc-600">—</span>;
    }

    if (col.type === "currency") {
      return <span>${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
    }

    if (col.type === "date") {
      return <span>{new Date(val).toLocaleDateString()}</span>;
    }

    if (col.type === "number") {
      return <span>{Number(val).toLocaleString()}</span>;
    }

    if (col.type === "badge") {
      const colorClass = col.badgeColors?.[val] || "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200";
      return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>
          {val}
        </span>
      );
    }

    return <span>{String(val)}</span>;
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between gap-4">
        {onSearchChange !== undefined && searchQuery !== undefined ? (
          <div className="flex-1 max-w-sm">
            <Filters
              searchQuery={searchQuery}
              onSearchChange={onSearchChange}
              searchPlaceholder={searchPlaceholder}
            />
          </div>
        ) : (
          <div />
        )}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.header}</TableHead>
              ))}
              {hasActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (hasActions ? 1 : 0)} className="h-32 text-center text-zinc-500">
                  <div className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
                    Loading records...
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (hasActions ? 1 : 0)} className="h-32 text-center text-zinc-500">
                  No matching records found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, idx) => (
                <TableRow key={item.id || idx}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>{renderCellContent(item, col)}</TableCell>
                  ))}
                  {hasActions && (
                    <TableCell className="text-right space-x-2">
                      {onView && (
                        <Button variant="ghost" size="sm" onClick={() => onView(item)}>
                          View
                        </Button>
                      )}
                      {onEdit && (
                        <Button variant="secondary" size="sm" onClick={() => onEdit(item)}>
                          Edit
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="ghost" size="sm" className="hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600" onClick={() => onDelete(item)}>
                          Delete
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {onPageChange && totalPages > 1 && (
        <div className="flex justify-end pt-2">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}
