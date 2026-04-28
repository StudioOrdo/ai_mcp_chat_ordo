"use client";

import { AdminBulkTableWrapper } from "@/components/admin/AdminBulkTableWrapper";
import type { ColumnDef } from "@/components/admin/AdminDataTable";

interface JobRow {
  toolName: string;
  toolLabel: string;
  toolFamily: string;
  toolFamilyLabel: string;
  defaultSurface: string;
  executionPrincipal: string;
  status: string;
  progressPercent: number | null;
  progressLabel: string | null;
  userName: string;
  attemptCount: number;
  createdAt: string;
  duration: string | null;
  detailHref: string;
  canManage: boolean;
  canRequeue: boolean;
  interactionExecutionState: string;
  interactionTimelineSupportLevel: string;
  interactionTimelineSummary: string | null;
  interactionRevisionState: string;
  interactionRevisionActionCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
};

const EXECUTION_PRINCIPAL_LABELS: Record<string, string> = {
  system_worker: "System worker",
  admin_delegate: "Admin delegate",
  owner_delegate: "Owner delegate",
};

function formatTokenLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

const columns: ColumnDef[] = [
  {
    key: "toolLabel",
    header: "Capability",
    render: (_value: unknown, row: Record<string, unknown>) => {
      const entry = row as unknown as JobRow;
      return (
        <div className="min-w-0">
          <a href={entry.detailHref} className="text-foreground underline underline-offset-4">
            {entry.toolLabel}
          </a>
          <div className="mt-1 text-xs text-foreground/50">
            {entry.toolFamilyLabel} • {entry.toolName}
          </div>
        </div>
      );
    },
  },
  {
    key: "status",
    header: "Status",
    render: (value: unknown) => {
      const status = String(value);
      const tone = status === "succeeded"
        ? "jobs-status-succeeded"
        : status === "failed" || status === "canceled"
          ? "jobs-status-failed"
          : status === "running"
            ? "jobs-status-running"
            : "jobs-count-pill";
      return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${tone}`}>
          {STATUS_LABELS[status] ?? status}
        </span>
      );
    },
  },
  {
    key: "executionPrincipal",
    header: "Governance",
    render: (value: unknown, row: Record<string, unknown>) => {
      const entry = row as unknown as JobRow;
      const principal = String(value);

      return (
        <div className="min-w-0 text-xs text-foreground/60">
          <div>{EXECUTION_PRINCIPAL_LABELS[principal] ?? principal}</div>
          <div className="mt-1 text-foreground/45">
            {entry.canManage ? "Global manage" : "View only"}
          </div>
        </div>
      );
    },
  },
  {
    key: "interactionExecutionState",
    header: "Interaction",
    render: (_value: unknown, row: Record<string, unknown>) => {
      const entry = row as unknown as JobRow;

      return (
        <div className="min-w-0 text-xs text-foreground/60">
          <div>
            {formatTokenLabel(entry.interactionExecutionState)} • {formatTokenLabel(entry.interactionTimelineSupportLevel)} timeline
          </div>
          <div className="mt-1 text-foreground/45">
            {formatTokenLabel(entry.interactionRevisionState)} • {entry.interactionRevisionActionCount} revision actions
          </div>
          {entry.interactionTimelineSummary && (
            <div className="mt-1 truncate text-foreground/40">{entry.interactionTimelineSummary}</div>
          )}
        </div>
      );
    },
  },
  {
    key: "progressPercent",
    header: "Progress",
    render: (value: unknown, row: Record<string, unknown>) => {
      const entry = row as unknown as JobRow;
      if (value == null) return "—";
      return (
        <span className="tabular-nums">
          {Number(value)}%{entry.progressLabel ? ` (${entry.progressLabel})` : ""}
        </span>
      );
    },
  },
  { key: "userName", header: "User" },
  {
    key: "attemptCount",
    header: "Attempts",
    render: (value: unknown) => <span className="tabular-nums">{String(value)}</span>,
  },
  {
    key: "createdAt",
    header: "Created",
    render: (value: unknown) => {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime())
        ? String(value)
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    },
  },
  {
    key: "duration",
    header: "Duration",
    render: (value: unknown) => value ? String(value) : "—",
  },
];

export function JobsTableClient({
  action,
  rows,
}: {
  action: (formData: FormData) => void | Promise<void>;
  rows: Record<string, unknown>[];
}) {
  const hasCancelableRows = rows.some((row) => Boolean(row["canManage"]) && String(row["status"]) !== "failed" && String(row["status"]) !== "canceled");
  const hasRequeueableRows = rows.some((row) => Boolean(row["canRequeue"]));
  const hasRetryableRows = rows.some((row) => Boolean(row["canManage"]) && (String(row["status"]) === "failed" || String(row["status"]) === "canceled"));

  const bulkActions = [
    ...(hasCancelableRows ? [{ label: "Cancel selected", action: "cancel", variant: "destructive" as const }] : []),
    ...(hasRequeueableRows ? [{ label: "Requeue selected", action: "requeue" }] : []),
    ...(hasRetryableRows ? [{ label: "Retry selected", action: "retry" }] : []),
  ];

  return (
    <AdminBulkTableWrapper
      action={action}
      columns={columns}
      rows={rows}
      emptyMessage="No jobs in the queue."
      bulkActions={bulkActions}
    />
  );
}
