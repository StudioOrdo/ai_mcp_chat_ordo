"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { BackupSelfServiceDashboard } from "@/lib/appliance/backup/backup-self-service";

interface Props {
  dashboard: BackupSelfServiceDashboard;
  initialView?: "all" | "backups" | "restore-plans";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Backup action failed.";
}

async function postJson(path: string, body?: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Backup action failed.");
  }
  return data;
}

function formatBytes(value: number | null): string {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function BackupSelfServiceManager({ dashboard, initialView = "all" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Record<string, string>>({});
  const [policy, setPolicy] = useState({
    enabled: dashboard.policy.enabled,
    interval: dashboard.policy.interval,
    retentionCount: dashboard.policy.retentionCount,
  });
  const canEnqueue = dashboard.executor.canEnqueueExecution;
  const showBackupControls = initialView === "all" || initialView === "backups";
  const showRestorePlans = initialView === "all" || initialView === "restore-plans";

  async function run(key: string, action: () => Promise<unknown>) {
    setLoading(key);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="admin-route-stack">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-100 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {dashboard.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-100 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {dashboard.warnings[0]}
        </div>
      ) : null}

      {showBackupControls ? (
      <section className="rounded-lg border bg-card p-5" data-backup-self-service-section="status">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Backup Status</h2>
            <p className="text-sm text-muted-foreground">{dashboard.executor.summary}</p>
            {dashboard.executor.remediation ? (
              <p className="mt-1 text-xs text-muted-foreground">{dashboard.executor.remediation}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            disabled={!canEnqueue || loading !== null}
            onClick={() => run("backup", () => postJson("/api/admin/system/backups"))}
          >
            Create Backup
          </button>
        </div>
        <dl className="admin-system-list mt-4 text-sm text-foreground/62">
          <div className="admin-system-row"><dt>Executor</dt><dd>{dashboard.executor.status}</dd></div>
          <div className="admin-system-row"><dt>Pending</dt><dd>{dashboard.commandCounts.pending ?? 0}</dd></div>
          <div className="admin-system-row"><dt>Running</dt><dd>{dashboard.commandCounts.running ?? 0}</dd></div>
          <div className="admin-system-row"><dt>Failed</dt><dd>{dashboard.commandCounts.failed ?? 0}</dd></div>
          <div className="admin-system-row"><dt>Policy</dt><dd>{dashboard.policy.enabled ? dashboard.policy.interval : "disabled"}</dd></div>
          <div className="admin-system-row"><dt>Data Free</dt><dd>{formatBytes(dashboard.resources.metadata.freeBytes ?? null)}</dd></div>
          <div className="admin-system-row"><dt>Resource State</dt><dd>{dashboard.resources.status}</dd></div>
        </dl>
      </section>
      ) : null}

      {showBackupControls ? (
      <section className="rounded-lg border bg-card p-5" data-backup-self-service-section="policy">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Automatic Backups</h2>
            <p className="text-sm text-muted-foreground">{dashboard.policyHealth.summary}</p>
          </div>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            disabled={loading !== null}
            onClick={() => run("policy", () => fetch("/api/admin/system/backups/policy", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(policy),
            }).then(async (response) => {
              const data = await response.json();
              if (!response.ok) throw new Error(data.error ?? "Backup policy update failed.");
              return data;
            }))}
          >
            Save Policy
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={(event) => setPolicy((current) => ({ ...current, enabled: event.target.checked, interval: event.target.checked && current.interval === "disabled" ? "daily" : current.interval }))}
            />
            Enabled
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Interval</span>
            <select
              className="rounded-md border bg-background px-3 py-2"
              value={policy.interval}
              onChange={(event) => setPolicy((current) => ({ ...current, interval: event.target.value as typeof current.interval, enabled: event.target.value !== "disabled" }))}
            >
              <option value="disabled">Disabled</option>
              <option value="6h">Every 6 hours</option>
              <option value="12h">Every 12 hours</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Scheduled Retention</span>
            <input
              className="rounded-md border bg-background px-3 py-2"
              type="number"
              min={1}
              max={365}
              value={policy.retentionCount}
              onChange={(event) => setPolicy((current) => ({ ...current, retentionCount: Number(event.target.value) }))}
            />
          </label>
        </div>
        <dl className="admin-system-list mt-4 text-sm text-foreground/62">
          <div className="admin-system-row"><dt>Next Scheduled</dt><dd>{dashboard.policyHealth.nextScheduledAt ?? "-"}</dd></div>
          <div className="admin-system-row"><dt>Latest Attempt</dt><dd>{dashboard.policyHealth.latestAttemptStatus}</dd></div>
          <div className="admin-system-row"><dt>Validated Backups</dt><dd>{dashboard.policyHealth.validatedBackupCount}</dd></div>
        </dl>
      </section>
      ) : null}

      {showBackupControls ? (
      <section className="rounded-lg border bg-card p-5" data-backup-self-service-section="backups">
        <h2 className="text-lg font-semibold">Backups</h2>
        {dashboard.recentBackups.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No backups exist. Create a backup before making risky changes.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {dashboard.recentBackups.map((backup) => {
              const eligible = (backup.status === "validated" || backup.status === "succeeded")
                && backup.archivePath && backup.archiveHash && backup.archiveSizeBytes;
              return (
                <div key={backup.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{backup.id}</span>
                        <span className="rounded border px-2 py-0.5 text-xs">{backup.status}</span>
                        <span className="rounded border px-2 py-0.5 text-xs">{backup.kind}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {backup.appVersion ?? "unknown app"} · {formatBytes(backup.archiveSizeBytes)} · {backup.createdAt}
                      </p>
                      {backup.failureMessage ? <p className="mt-1 text-xs text-red-600">{backup.failureMessage}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                        disabled={!eligible || loading !== null}
                        onClick={() => run(`validate:${backup.id}`, () => postJson(`/api/admin/system/backups/${backup.id}/validate`))}
                      >
                        Validate
                      </button>
                      <button
                        type="button"
                        className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                        disabled={!eligible || loading !== null}
                        onClick={() => run(`restore:${backup.id}`, () => postJson(`/api/admin/system/backups/${backup.id}/restore-plans`))}
                      >
                        Prepare Restore
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      ) : null}

      {showRestorePlans ? (
      <section className="rounded-lg border bg-card p-5" data-backup-self-service-section="restore-plans">
        <h2 className="text-lg font-semibold">Restore Plans</h2>
        {dashboard.recentRestorePlans.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No restore plans exist.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {dashboard.recentRestorePlans.map((plan) => (
              <div key={plan.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{plan.id}</span>
                  <span className="rounded border px-2 py-0.5 text-xs">{plan.status}</span>
                  <span className="text-xs text-muted-foreground">snapshot {plan.snapshotId}</span>
                </div>
                <p className="mt-2 text-sm text-foreground/75">Restore will replace your current business data with this backup.</p>
                <p className="mt-1 text-xs text-muted-foreground">A safety backup will be created first. Type {plan.confirmationPhrase} to confirm.</p>
                {plan.failureMessage ? <p className="mt-1 text-xs text-red-600">{plan.failureMessage}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder={plan.confirmationPhrase}
                    value={confirmation[plan.id] ?? ""}
                    disabled={plan.status !== "confirmation_required"}
                    onChange={(event) => setConfirmation((current) => ({ ...current, [plan.id]: event.target.value }))}
                  />
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    disabled={plan.status !== "confirmation_required" || loading !== null}
                    onClick={() => run(`confirm:${plan.id}`, () => postJson(`/api/admin/system/restore-plans/${plan.id}/confirm`, {
                      confirmationPhrase: confirmation[plan.id] ?? "",
                    }))}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    disabled={plan.status !== "confirmed" || Boolean(plan.preRestoreBackupCommandId) || !canEnqueue || loading !== null}
                    onClick={() => run(`safety:${plan.id}`, () => postJson(`/api/admin/system/restore-plans/${plan.id}/pre-restore-backup`))}
                  >
                    Safety Backup
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    disabled={plan.status !== "confirmed" || !plan.preRestoreBackupSnapshotId || !canEnqueue || loading !== null}
                    onClick={() => run(`execute:${plan.id}`, () => postJson(`/api/admin/system/restore-plans/${plan.id}/execute`))}
                  >
                    Execute Restore
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    disabled={plan.status === "running" || plan.status === "succeeded" || loading !== null}
                    onClick={() => run(`cancel:${plan.id}`, () => postJson(`/api/admin/system/restore-plans/${plan.id}/cancel`))}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      ) : null}
    </div>
  );
}
