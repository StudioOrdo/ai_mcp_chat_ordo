import type { Metadata } from "next";

import { AdminSection } from "@/components/admin/AdminSection";
import { AdminDetailShell } from "@/components/admin/AdminDetailShell";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminMetaBox } from "@/components/admin/AdminMetaBox";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import { loadAdminJobDetail } from "@/lib/admin/jobs/admin-jobs";
import {
  cancelJobAction,
  requeueJobAction,
  retryJobAction,
} from "@/lib/admin/jobs/admin-jobs-actions";
import { getAdminJobsExportPath } from "@/lib/admin/jobs/admin-jobs-routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Job Detail",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
};

const FAILURE_CLASS_LABELS: Record<string, string> = {
  canceled: "Canceled",
  policy: "Policy blocked",
  terminal: "Terminal",
  transient: "Transient",
  unknown: "Unknown",
};

const EXECUTION_PRINCIPAL_LABELS: Record<string, string> = {
  system_worker: "System worker",
  admin_delegate: "Admin delegate",
  owner_delegate: "Owner delegate",
};

const RESULT_RETENTION_LABELS: Record<string, string> = {
  retain: "Retain payload and events",
  prune_payload_keep_events: "Prune payload, keep events",
};

const ARTIFACT_POLICY_LABELS: Record<string, string> = {
  retain: "Retain only",
  open_artifact: "Open artifact",
  open_or_download: "Open or download",
};

function formatFailureClass(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return FAILURE_CLASS_LABELS[value] ?? value;
}

function formatRetryPolicy(policy: {
  retryMode: "manual_only" | "automatic";
  maxAttempts: number | null;
  backoffStrategy: string | null;
  baseDelayMs: number | null;
}): string {
  if (policy.retryMode !== "automatic") {
    return "Manual replay only";
  }

  const strategy = policy.backoffStrategy ? policy.backoffStrategy.replace(/_/g, " ") : "retry";
  const delay = typeof policy.baseDelayMs === "number"
    ? `${Math.max(0, policy.baseDelayMs) / 1000}s`
    : null;
  const parts = [
    policy.maxAttempts ? `${policy.maxAttempts} attempts max` : null,
    strategy !== "retry" ? `${strategy} backoff` : null,
    delay ? `base ${delay}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? `Automatic retry (${parts.join(", ")})` : "Automatic retry";
}

function formatRoleList(roles: readonly string[]): string {
  return roles.join(", ");
}

function formatTokenLabel(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }

  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdminPageAccess();
  const { id } = await params;
  const detail = await loadAdminJobDetail(id, admin.roles);
  const { job, events, policy, capabilityPolicy, interaction } = detail;

  const canCancel = policy.canCancel;
  const canRequeue = policy.canRequeue;
  const canRetry = policy.canRetry;
  const failureClass = formatFailureClass(job.failureClass);

  return (
    <AdminSection
      title={job.toolLabel}
      description={`Job ${job.id} • ${job.toolFamilyLabel} • ${job.toolName}`}
    >
      <div className="px-(--space-inset-panel)">
        <AdminDetailShell
          main={
            <div className="grid gap-(--space-section-default)">
              {/* Header: status + progress */}
              <AdminCard
                title={STATUS_LABELS[job.status] ?? job.status}
                status={
                  job.status === "succeeded"
                    ? "ok"
                    : job.status === "failed" || job.status === "canceled"
                      ? "warning"
                      : "neutral"
                }
              >
                  <p className="mb-(--space-3) text-xs uppercase tracking-[0.18em] text-foreground/45">
                    {job.toolFamilyLabel} • {job.defaultSurface === "global" ? "Global queue" : "Self-service default"}
                  </p>
                {job.progressPercent != null && (
                  <div className="grid gap-(--space-2)">
                    <div className="h-2 w-full rounded-full bg-foreground/8">
                      <div
                        className="h-full rounded-full bg-foreground/30 transition-all"
                        style={{ width: `${Math.min(100, job.progressPercent)}%` }}
                      />
                    </div>
                    <p className="text-xs text-foreground/50 tabular-nums">
                      {job.progressPercent}%{job.progressLabel ? ` — ${job.progressLabel}` : ""}
                    </p>
                  </div>
                )}
                {!policy.canManage && (
                  <p className="text-xs text-foreground/50">
                    This job is visible to your role, but global mutating actions are disabled by capability policy.
                  </p>
                )}
                <dl className="mt-(--space-3) grid gap-(--space-2) text-xs text-foreground/55">
                  <div className="flex justify-between gap-(--space-3)">
                    <dt>Timeline</dt>
                    <dd>{formatTokenLabel(interaction.timeline.state)} • {formatTokenLabel(interaction.timeline.supportLevel)}</dd>
                  </div>
                  <div className="flex justify-between gap-(--space-3)">
                    <dt>Revision</dt>
                    <dd>{formatTokenLabel(interaction.revision.state)} • {formatTokenLabel(interaction.revision.supportLevel)}</dd>
                  </div>
                  <div className="flex justify-between gap-(--space-3)">
                    <dt>Next actions</dt>
                    <dd>{interaction.timeline.nextActions.length} timeline • {interaction.revision.actions.length} revision</dd>
                  </div>
                </dl>
              </AdminCard>

              <section className="rounded-xl border border-foreground/8 p-(--space-inset-panel)">
                <h2 className="text-sm font-semibold text-foreground/60">Platform interaction</h2>
                <dl className="mt-(--space-3) grid gap-(--space-2) text-sm">
                  <div className="flex justify-between gap-(--space-3)">
                    <dt className="text-foreground/50">Timeline summary</dt>
                    <dd className="text-right text-foreground text-xs">{interaction.timeline.summary ?? "No timeline summary recorded."}</dd>
                  </div>
                  <div className="flex justify-between gap-(--space-3)">
                    <dt className="text-foreground/50">Timeline events</dt>
                    <dd className="text-right text-foreground text-xs">{interaction.timeline.events.length}</dd>
                  </div>
                  <div className="flex justify-between gap-(--space-3)">
                    <dt className="text-foreground/50">Artifacts</dt>
                    <dd className="text-right text-foreground text-xs">{interaction.timeline.artifacts.length}</dd>
                  </div>
                  <div className="flex justify-between gap-(--space-3)">
                    <dt className="text-foreground/50">Revision summary</dt>
                    <dd className="text-right text-foreground text-xs">{interaction.revision.summary ?? "No revision summary recorded."}</dd>
                  </div>
                </dl>
              </section>

              {/* Request payload */}
              <section className="rounded-xl border border-foreground/8 p-(--space-inset-panel)">
                <h2 className="text-sm font-semibold text-foreground/60">Request payload</h2>
                <pre className="mt-(--space-3) max-h-80 overflow-auto rounded-lg bg-foreground/3 p-(--space-3) text-xs text-foreground/70">
                  {JSON.stringify(job.requestPayload, null, 2)}
                </pre>
              </section>

              {/* Result payload */}
              {job.resultPayload != null && (
                <section className="rounded-xl border border-foreground/8 p-(--space-inset-panel)">
                  <h2 className="text-sm font-semibold text-foreground/60">Result payload</h2>
                  <pre className="mt-(--space-3) max-h-80 overflow-auto rounded-lg bg-foreground/3 p-(--space-3) text-xs text-foreground/70">
                    {JSON.stringify(job.resultPayload, null, 2)}
                  </pre>
                </section>
              )}

              {/* Error message */}
              {job.errorMessage && (
                <section className="rounded-xl border border-foreground/8 p-(--space-inset-panel)">
                  <h2 className="text-sm font-semibold text-foreground/60">Error</h2>
                  <p className="mt-(--space-3) text-sm text-foreground/70">{job.errorMessage}</p>
                </section>
              )}

              {(job.nextRetryAt || policy.retryExhausted || failureClass || job.recoveryMode) && (
                <section className="rounded-xl border border-foreground/8 p-(--space-inset-panel)">
                  <h2 className="text-sm font-semibold text-foreground/60">Resilience state</h2>
                  <dl className="mt-(--space-3) grid gap-(--space-2) text-sm">
                    <div className="flex justify-between gap-(--space-3)">
                      <dt className="text-foreground/50">Retry policy</dt>
                      <dd className="text-right text-foreground text-xs">{formatRetryPolicy(policy)}</dd>
                    </div>
                    {failureClass && (
                      <div className="flex justify-between gap-(--space-3)">
                        <dt className="text-foreground/50">Failure class</dt>
                        <dd className="text-right text-foreground text-xs">{failureClass}</dd>
                      </div>
                    )}
                    {job.nextRetryAt && (
                      <div className="flex justify-between gap-(--space-3)">
                        <dt className="text-foreground/50">Next retry</dt>
                        <dd className="text-right text-foreground text-xs">{job.nextRetryAt}</dd>
                      </div>
                    )}
                    {job.recoveryMode && (
                      <div className="flex justify-between gap-(--space-3)">
                        <dt className="text-foreground/50">Recovery mode</dt>
                        <dd className="text-right text-foreground text-xs">{job.recoveryMode}</dd>
                      </div>
                    )}
                  </dl>
                  {policy.retryExhausted && (
                    <p className="mt-(--space-3) text-xs text-foreground/55">
                      Automatic retries are exhausted for this job. Manual replay is still available.
                    </p>
                  )}
                </section>
              )}

              {/* Event timeline */}
              <section className="rounded-xl border border-foreground/8 p-(--space-inset-panel)">
                <h2 className="text-sm font-semibold text-foreground/60">
                  Event timeline ({events.length})
                </h2>
                {events.length === 0 ? (
                  <p className="mt-(--space-2) text-xs text-foreground/40">No events recorded.</p>
                ) : (
                  <ul className="mt-(--space-3) grid gap-(--space-2)">
                    {events.map((evt) => (
                      <li key={evt.id} className="flex items-start gap-(--space-3) border-b border-foreground/5 pb-(--space-2)">
                        <span className="inline-flex shrink-0 rounded-full border border-foreground/12 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em]">
                          {evt.eventType}
                        </span>
                        <div className="min-w-0 flex-1">
                          <pre className="max-h-24 overflow-auto text-xs text-foreground/60">
                            {JSON.stringify(evt.eventPayload, null, 2)}
                          </pre>
                        </div>
                        <time className="shrink-0 text-xs text-foreground/40">{evt.createdAt}</time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Action bar */}
              {(canCancel || canRequeue || canRetry || policy.canManage) && (
                <div className="flex gap-(--space-2)">
                  {canCancel && (
                    <form action={cancelJobAction}>
                      <input type="hidden" name="id" value={job.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-foreground/12 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5"
                      >
                        Cancel job
                      </button>
                    </form>
                  )}
                  {canRequeue && (
                    <form action={requeueJobAction}>
                      <input type="hidden" name="id" value={job.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-foreground/12 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5"
                      >
                        Requeue job
                      </button>
                    </form>
                  )}
                  {canRetry && (
                    <form action={retryJobAction}>
                      <input type="hidden" name="id" value={job.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-foreground/8 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/14"
                      >
                        Retry job
                      </button>
                    </form>
                  )}
                  <a
                    href={getAdminJobsExportPath(job.id)}
                    className="rounded-lg border border-foreground/12 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5"
                  >
                    Export log
                  </a>
                </div>
              )}
            </div>
          }
          sidebar={
            <div className="grid gap-(--space-section-default)">
              <AdminMetaBox title="Metadata">
                <dl className="mt-(--space-3) grid gap-(--space-2) text-sm">
                  <div className="flex justify-between">
                    <dt className="text-foreground/50">Capability</dt>
                    <dd className="text-foreground text-xs">{job.toolLabel}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/50">Family</dt>
                    <dd className="text-foreground text-xs">{job.toolFamilyLabel}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/50">Surface</dt>
                    <dd className="text-foreground text-xs">{job.defaultSurface}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/50">Policy</dt>
                    <dd className="text-foreground text-xs">{policy.canManage ? "Global manage" : "View only"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/50">Execution</dt>
                    <dd className="text-right text-foreground text-xs">
                      {EXECUTION_PRINCIPAL_LABELS[job.executionPrincipal] ?? job.executionPrincipal}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/50">ID</dt>
                    <dd className="truncate text-foreground text-xs font-mono">{job.id}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/50">Priority</dt>
                    <dd className="text-foreground">{job.priority}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/50">Attempts</dt>
                    <dd className="text-foreground">{job.attemptCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/50">Retry policy</dt>
                    <dd className="text-right text-foreground text-xs">{formatRetryPolicy(policy)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/50">Initiator</dt>
                    <dd className="text-foreground">{job.initiatorType}</dd>
                  </div>
                  {job.dedupeKey && (
                    <div className="flex justify-between">
                      <dt className="text-foreground/50">Dedupe key</dt>
                      <dd className="truncate text-foreground text-xs">{job.dedupeKey}</dd>
                    </div>
                  )}
                  {job.claimedBy && (
                    <div className="flex justify-between">
                      <dt className="text-foreground/50">Worker</dt>
                      <dd className="truncate text-foreground text-xs">{job.claimedBy}</dd>
                    </div>
                  )}
                  {job.leaseExpiresAt && (
                    <div className="flex justify-between">
                      <dt className="text-foreground/50">Lease expires</dt>
                      <dd className="text-foreground text-xs">{job.leaseExpiresAt}</dd>
                    </div>
                  )}
                </dl>
              </AdminMetaBox>

              <AdminMetaBox title="Capability policy" collapsible>
                <p className="mt-(--space-2) text-xs leading-5 text-foreground/55">
                  {capabilityPolicy.description}
                </p>
                <dl className="mt-(--space-3) grid gap-(--space-2) text-sm">
                  <div className="flex justify-between gap-(--space-3)">
                    <dt className="text-foreground/50">Execution principal</dt>
                    <dd className="text-right text-foreground text-xs">
                      {EXECUTION_PRINCIPAL_LABELS[capabilityPolicy.executionPrincipal] ?? capabilityPolicy.executionPrincipal}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-(--space-3)">
                    <dt className="text-foreground/50">Execution roles</dt>
                    <dd className="text-right text-foreground text-xs">{formatRoleList(capabilityPolicy.executionAllowedRoles)}</dd>
                  </div>
                  <div className="flex justify-between gap-(--space-3)">
                    <dt className="text-foreground/50">Global viewers</dt>
                    <dd className="text-right text-foreground text-xs">{formatRoleList(capabilityPolicy.globalViewerRoles)}</dd>
                  </div>
                  <div className="flex justify-between gap-(--space-3)">
                    <dt className="text-foreground/50">Global actions</dt>
                    <dd className="text-right text-foreground text-xs">{formatRoleList(capabilityPolicy.globalActionRoles)}</dd>
                  </div>
                  <div className="flex justify-between gap-(--space-3)">
                    <dt className="text-foreground/50">Result retention</dt>
                    <dd className="text-right text-foreground text-xs">
                      {RESULT_RETENTION_LABELS[capabilityPolicy.resultRetention] ?? capabilityPolicy.resultRetention}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-(--space-3)">
                    <dt className="text-foreground/50">Artifact policy</dt>
                    <dd className="text-right text-foreground text-xs">
                      {ARTIFACT_POLICY_LABELS[capabilityPolicy.artifactPolicy] ?? capabilityPolicy.artifactPolicy}
                    </dd>
                  </div>
                </dl>
              </AdminMetaBox>

              <AdminMetaBox title="Timestamps" collapsible>
                <dl className="mt-(--space-3) grid gap-(--space-2) text-sm">
                  <div className="flex justify-between">
                    <dt className="text-foreground/50">Created</dt>
                    <dd className="text-foreground text-xs">{job.createdAt}</dd>
                  </div>
                  {job.startedAt && (
                    <div className="flex justify-between">
                      <dt className="text-foreground/50">Started</dt>
                      <dd className="text-foreground text-xs">{job.startedAt}</dd>
                    </div>
                  )}
                  {job.completedAt && (
                    <div className="flex justify-between">
                      <dt className="text-foreground/50">Completed</dt>
                      <dd className="text-foreground text-xs">{job.completedAt}</dd>
                    </div>
                  )}
                  {job.duration && (
                    <div className="flex justify-between">
                      <dt className="text-foreground/50">Duration</dt>
                      <dd className="text-foreground">{job.duration}</dd>
                    </div>
                  )}
                </dl>
              </AdminMetaBox>

              <AdminMetaBox title="User" collapsible>
                <p className="mt-(--space-2) text-xs text-foreground/60">
                  {job.userName ?? "Anonymous / system"}
                </p>
              </AdminMetaBox>
            </div>
          }
        />
      </div>
    </AdminSection>
  );
}
