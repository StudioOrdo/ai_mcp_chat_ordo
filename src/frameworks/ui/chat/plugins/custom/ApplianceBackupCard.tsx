"use client";

import type { ToolPluginProps } from "../../registry/types";
import { CapabilityActionRail } from "../../primitives/CapabilityActionRail";
import { CapabilityCardShell } from "../../primitives/CapabilityCardShell";
import type { CapabilityCardState } from "../../primitives/capability-card-tone";
import type { InlineNode } from "@/core/entities/rich-content";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: RecordValue | null | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(record: RecordValue | null | undefined, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatBytes(value: number | null): string {
  if (value == null) {
    return "Pending";
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function shortId(id: string | null): string {
  if (!id) {
    return "Unknown";
  }
  const [prefix, suffix] = id.split("_", 2);
  return prefix && suffix ? `${prefix}_${suffix.slice(0, 8)}` : id.slice(0, 17);
}

function statusTone(status: string | null): "success" | "warning" | "danger" | "neutral" {
  if (status === "succeeded" || status === "validated") {
    return "success";
  }
  if (status === "failed") {
    return "danger";
  }
  if (status === "pending" || status === "running" || status === "confirmation_required" || status === "confirmed") {
    return "warning";
  }
  return "neutral";
}

function snapshotRows(payload: RecordValue): RecordValue[] {
  if (isRecord(payload.snapshot)) {
    return [payload.snapshot];
  }
  return Array.isArray(payload.recentBackups)
    ? payload.recentBackups.filter(isRecord).slice(0, 5)
    : [];
}

function restorePlanRows(payload: RecordValue): RecordValue[] {
  if (isRecord(payload.restorePlan)) {
    return [payload.restorePlan];
  }
  return Array.isArray(payload.recentRestorePlans)
    ? payload.recentRestorePlans.filter(isRecord).slice(0, 3)
    : [];
}

function actionsFrom(record: RecordValue): InlineNode[] | null {
  const actions = record.actions;
  if (!Array.isArray(actions)) {
    return null;
  }
  const nodes = actions.filter((action): action is InlineNode =>
    isRecord(action) && action.type === "action-link",
  );
  return nodes.length > 0 ? nodes : null;
}

export function ApplianceBackupCard({
  descriptor,
  resultEnvelope,
  computedActions,
  onActionClick,
}: ToolPluginProps) {
  const payload = isRecord(resultEnvelope?.payload) ? resultEnvelope.payload : {};
  const snapshots = snapshotRows(payload);
  const restorePlans = restorePlanRows(payload);
  const status = readString(payload, "status")
    ?? readString(isRecord(payload.snapshot) ? payload.snapshot : null, "status")
    ?? readString(isRecord(payload.restorePlan) ? payload.restorePlan : null, "status");
  const summary = readString(payload, "summary") ?? resultEnvelope?.summary.message ?? "Appliance backup state.";
  const title = resultEnvelope?.summary.title ?? descriptor?.label ?? "Appliance Backups";

  return (
    <CapabilityCardShell
      descriptor={descriptor}
      tone={statusTone(status)}
      state={toCardState(status)}
      ariaLabel={`${title} status`}
    >
      <div className="ui-system-job-compact-row" aria-disabled="true">
        <span className="ui-system-job-label">{title}</span>
        <span className="ui-system-job-meta">{summary}</span>
        {status ? <span className="ui-system-job-status">{status}</span> : null}
      </div>

      {snapshots.length > 0 ? (
        <div className="ui-system-job-body">
          <dl className="ui-system-job-details">
            {snapshots.map((snapshot, index) => {
              const id = readString(snapshot, "id");
              return (
                <div key={id ?? `snapshot-${index}`}>
                  <dt>{shortId(id)}</dt>
                  <dd>
                    {readString(snapshot, "status") ?? "unknown"} · {formatBytes(readNumber(snapshot, "archiveSizeBytes"))}
                  </dd>
                  <dd>
                    <CapabilityActionRail actions={actionsFrom(snapshot)} onActionClick={onActionClick} />
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ) : null}

      {restorePlans.length > 0 ? (
        <div className="ui-system-job-body">
          <dl className="ui-system-job-details">
            {restorePlans.map((plan, index) => {
              const id = readString(plan, "id");
              const confirmationPhrase = readString(plan, "confirmationPhrase");
              return (
                <div key={id ?? `restore-plan-${index}`}>
                  <dt>{shortId(id)}</dt>
                  <dd>
                    {readString(plan, "status") ?? "unknown"}
                    {confirmationPhrase ? ` · ${confirmationPhrase}` : ""}
                  </dd>
                  <dd>
                    <CapabilityActionRail actions={actionsFrom(plan)} onActionClick={onActionClick} />
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ) : null}

      <CapabilityActionRail actions={computedActions} onActionClick={onActionClick} />
    </CapabilityCardShell>
  );
}

function toCardState(status: string | null): CapabilityCardState {
  if (status === "succeeded" || status === "failed" || status === "canceled") {
    return status;
  }
  if (status === "running") {
    return status;
  }
  if (status === "pending" || status === "confirmation_required" || status === "confirmed") {
    return "queued";
  }
  return "idle";
}
