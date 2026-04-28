"use client";

/**
 * Responsive admin data table.
 * Renders <table> on desktop (>=640px), card stack on mobile.
 * Supports optional row selection with checkboxes.
 */

import { useState, useCallback } from "react";

export interface ColumnDef {
  key: string;
  header: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface AdminDataTableProps {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  emptyMessage?: string;
  ariaLabel?: string;
  rowKey?: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

function getRowId(row: Record<string, unknown>, rowKey: string): string {
  return String(row[rowKey] ?? row["id"] ?? "");
}

export function AdminDataTable({
  columns,
  rows,
  emptyMessage,
  ariaLabel,
  rowKey = "id",
  selectable,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
}: AdminDataTableProps) {
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
  const selectedIds = controlledSelectedIds ?? internalSelected;

  const toggleRow = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (onSelectionChange) {
        onSelectionChange(next);
      } else {
        setInternalSelected(next);
      }
    },
    [selectedIds, onSelectionChange],
  );

  const toggleAll = useCallback(() => {
    if (selectedIds.size === rows.length) {
      const next = new Set<string>();
      if (onSelectionChange) {
        onSelectionChange(next);
      } else {
        setInternalSelected(next);
      }
    } else {
      const next = new Set(rows.map((r) => getRowId(r, rowKey)));
      if (onSelectionChange) {
        onSelectionChange(next);
      } else {
        setInternalSelected(next);
      }
    }
  }, [selectedIds, rows, rowKey, onSelectionChange]);

  if (rows.length === 0 && !ariaLabel) {
    return <p className="py-(--space-8) text-center text-sm text-foreground/40">{emptyMessage}</p>;
  }

  const renderCell = (col: ColumnDef, row: Record<string, unknown>) => {
    const value = row[col.key];
    return col.render ? col.render(value, row) : (value != null ? String(value) : "—");
  };

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const primaryColumn = columns[0] ?? null;
  const secondaryColumns = primaryColumn ? columns.slice(1) : columns;

  return (
    <>
      {/* Desktop table */}
      <div className="admin-scroll-shell hidden sm:block" data-admin-data-table="desktop" data-admin-scroll-shell="table">
        <table className="admin-scroll-table w-full text-sm" aria-label={ariaLabel}>
          <thead>
            <tr className="border-b border-foreground/8">
              {selectable && (
                <th scope="col" className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                    className="accent-foreground"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-(--space-3) py-2 text-left text-xs font-(--font-label) tracking-wide text-foreground/50"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && emptyMessage ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="py-(--space-8) text-center text-sm text-foreground/40"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = getRowId(row, rowKey);
                const checked = selectedIds.has(id);
                return (
                  <tr
                    key={id}
                    className={`border-b border-foreground/5 transition ${checked ? "bg-foreground/4" : "hover:bg-foreground/3"}`}
                  >
                    {selectable && (
                      <td className="w-10 px-2 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRow(id)}
                          aria-label={`Select row ${id}`}
                          className="accent-foreground"
                        />
                      </td>
                    )}
                    {columns.map((col, ci) =>
                      ci === 0 ? (
                        <th
                          key={col.key}
                          scope="row"
                          className="px-(--space-3) py-2 text-left font-normal text-foreground/80"
                        >
                          {renderCell(col, row)}
                        </th>
                      ) : (
                        <td
                          key={col.key}
                          className="px-(--space-3) py-2 text-foreground/80"
                        >
                          {renderCell(col, row)}
                        </td>
                      )
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card stack */}
      <div className="flex flex-col gap-(--space-2) sm:hidden" data-admin-data-table="mobile">
        {selectable && rows.length > 1 ? (
          <div
            className="flex items-center justify-between rounded-xl border border-foreground/8 bg-foreground/2.5 px-(--space-3) py-(--space-2)"
            data-admin-mobile-selection-bar="true"
          >
            <div className="text-xs text-foreground/55">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${rows.length} rows`}
            </div>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70 transition hover:text-foreground"
            >
              {allSelected ? "Clear selection" : "Select all rows"}
            </button>
          </div>
        ) : null}
        {rows.map((row) => {
          const id = getRowId(row, rowKey);
          const checked = selectedIds.has(id);
          return (
            <div
              key={id}
              className={`rounded-xl border px-(--space-3) py-(--space-3) transition ${
                checked ? "border-foreground/20 bg-foreground/4" : "border-foreground/8"
              }`}
              data-admin-record-card="true"
            >
              {selectable && (
                <label className="mb-(--space-2) flex items-center justify-between gap-2 text-xs text-foreground/50">
                  <span>Select</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRow(id)}
                    aria-label={`Select row ${id}`}
                    className="accent-foreground"
                  />
                </label>
              )}
              {primaryColumn ? (
                <div className="min-w-0">
                  <div className="min-w-0 wrap-break-word text-sm font-semibold text-foreground">
                    {renderCell(primaryColumn, row)}
                  </div>
                </div>
              ) : null}
              {secondaryColumns.length > 0 ? (
                <div className="mt-(--space-2) grid grid-cols-2 gap-(--space-2)">
                  {secondaryColumns.map((col) => (
                    <div
                      key={col.key}
                      className="min-w-0 rounded-lg border border-foreground/8 bg-foreground/2.5 px-(--space-2) py-(--space-2)"
                    >
                      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-foreground/45">
                        {col.header}
                      </div>
                      <div className="mt-1 min-w-0 wrap-break-word text-sm text-foreground/78">
                        {renderCell(col, row)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
