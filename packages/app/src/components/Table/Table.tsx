"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc";

export interface ColumnDef<T> {
  key: string;
  header: string;
  /** Render cell content; receives the row. Defaults to `(row as any)[key]`. */
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** Hide on mobile (stacked layout shows only non-hidden columns). */
  hideOnMobile?: boolean;
  className?: string;
}

export interface RowAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  variant?: "default" | "danger";
  disabled?: (row: T) => boolean;
}

export interface TableProps<T extends { id: string | number }> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  /** Total records for server-side pagination */
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  sortKey?: string;
  sortDir?: SortDirection;
  onSort?: (key: string, dir: SortDirection) => void;
  rowActions?: RowAction<T>[];
  selectable?: boolean;
  selectedIds?: Set<string | number>;
  onSelectionChange?: (ids: Set<string | number>) => void;
  emptyMessage?: string;
  className?: string;
  "aria-label"?: string;
}

// ─── Sort icon helper ─────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir?: SortDirection }) {
  if (!active) return <ChevronsUpDown size={14} className="text-gray-400" />;
  return dir === "asc"
    ? <ChevronUp size={14} className="text-brand-600" />
    : <ChevronDown size={14} className="text-brand-600" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Table<T extends { id: string | number }>({
  columns,
  data,
  loading,
  total,
  page = 1,
  pageSize = 20,
  onPageChange,
  sortKey,
  sortDir,
  onSort,
  rowActions,
  selectable,
  selectedIds,
  onSelectionChange,
  emptyMessage = "No results found.",
  className,
  "aria-label": ariaLabel,
}: TableProps<T>) {
  const allIds = data.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds?.has(id));
  const someSelected = !allSelected && allIds.some((id) => selectedIds?.has(id));
  const totalPages = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : undefined;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      const next = new Set(selectedIds);
      allIds.forEach((id) => next.delete(id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      allIds.forEach((id) => next.add(id));
      onSelectionChange(next);
    }
  };

  const toggleRow = (id: string | number) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  };

  const handleSort = (col: ColumnDef<T>) => {
    if (!col.sortable || !onSort) return;
    if (sortKey === col.key) {
      onSort(col.key, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSort(col.key, "asc");
    }
  };

  const visibleCols = columns.filter((c) => !c.hideOnMobile);

  return (
    <div className={cn("w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700", className)}>
      {/* Desktop table */}
      <div className="overflow-x-auto">
        <table
          className="hidden w-full min-w-full text-sm sm:table"
          aria-label={ariaLabel}
          aria-busy={loading}
        >
          <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="accent-brand-600 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-left font-semibold",
                    col.sortable && "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700",
                    col.className
                  )}
                  onClick={() => handleSort(col)}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === "asc" ? "ascending" : "descending"
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                  </span>
                </th>
              ))}
              {rowActions && rowActions.length > 0 && (
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="py-16 text-center text-gray-400"
                >
                  <Loader2 size={28} className="mx-auto animate-spin" aria-label="Loading" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="py-16 text-center text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
                    selectedIds?.has(row.id) && "bg-brand-50 dark:bg-brand-900/20"
                  )}
                >
                  {selectable && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select row ${row.id}`}
                        checked={selectedIds?.has(row.id) ?? false}
                        onChange={() => toggleRow(row.id)}
                        className="accent-brand-600 cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3 text-gray-900 dark:text-gray-100", col.className)}>
                      {col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                  {rowActions && rowActions.length > 0 && (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {rowActions.map((action) => (
                          <button
                            key={action.label}
                            type="button"
                            onClick={() => action.onClick(row)}
                            disabled={action.disabled?.(row)}
                            title={action.label}
                            aria-label={action.label}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                              "disabled:pointer-events-none disabled:opacity-50",
                              action.variant === "danger"
                                ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                          >
                            {action.icon}
                            <span className="hidden lg:inline">{action.label}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700 sm:hidden bg-white dark:bg-gray-900">
        {loading ? (
          <div className="py-12 text-center text-gray-400">
            <Loader2 size={28} className="mx-auto animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">{emptyMessage}</div>
        ) : (
          data.map((row) => (
            <div key={row.id} className={cn("p-4 space-y-2", selectedIds?.has(row.id) && "bg-brand-50 dark:bg-brand-900/20")}>
              {selectable && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(row.id) ?? false}
                    onChange={() => toggleRow(row.id)}
                    aria-label={`Select row ${row.id}`}
                    className="accent-brand-600"
                  />
                  <span className="text-xs text-gray-400">Select</span>
                </div>
              )}
              {visibleCols.map((col) => (
                <div key={col.key} className="flex justify-between text-sm">
                  <span className="font-medium text-gray-500 dark:text-gray-400">{col.header}</span>
                  <span className="text-gray-900 dark:text-gray-100 text-right">
                    {col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </span>
                </div>
              ))}
              {rowActions && rowActions.length > 0 && (
                <div className="flex gap-2 pt-1">
                  {rowActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => action.onClick(row)}
                      disabled={action.disabled?.(row)}
                      className={cn(
                        "flex-1 rounded-md py-1.5 text-xs font-medium border transition-colors",
                        "disabled:pointer-events-none disabled:opacity-50",
                        action.variant === "danger"
                          ? "border-red-200 text-red-600 hover:bg-red-50"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                      )}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages !== undefined && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
            {total !== undefined && ` · ${total} total`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
