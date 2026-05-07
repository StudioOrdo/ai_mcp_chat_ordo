import type { ActionLinkType } from "@/core/entities/rich-content";
import type { JobFailureClass, JobStatus } from "@/core/entities/job";
import type { JobStateEntry } from "@/hooks/chat/useJobStateStore";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";
import { operationActionToActionLink } from "@/lib/operations/operation-action-view-model";

export type JobsRailItemState =
  | "running"
  | "needs_input"
  | "completed"
  | "history";

export type JobsRailSyncState = "live" | "reconnecting" | "stale" | "unknown";

export type JobsRailPrimaryState =
  | "idle"
  | "running"
  | "needs_input"
  | "completed"
  | "reconnecting";

export type JobsRailActionKind =
  | "open"
  | "cancel"
  | "retry"
  | "revise"
  | "diagnose"
  | "dismiss"
  | "archive"
  | "download_bundle";

export interface JobsRailAction {
  kind: JobsRailActionKind;
  label: string;
  actionType: Extract<ActionLinkType, "route" | "job" | "send" | "operation">;
  value: string;
  params?: Record<string, string>;
  primary: boolean;
}

export interface JobsRailItem {
  jobId: string;
  conversationId: string | null;
  toolName: string;
  title: string;
  subtitle: string | null;
  state: JobsRailItemState;
  statusLabel: string;
  progressLabel: string | null;
  progressPercent: number | null;
  updatedAt: string | null;
  failureClass: JobFailureClass | "unknown" | null;
  actions: JobsRailAction[];
}

export interface JobsRailModel {
  primaryState: JobsRailPrimaryState;
  syncState: JobsRailSyncState;
  syncLabel: string;
  activeCount: number;
  attentionCount: number;
  completedCount: number;
  items: JobsRailItem[];
  overflowActions: JobsRailAction[];
}

export interface ResolveJobsRailOptions {
  entries: readonly JobStateEntry[];
  workflows?: readonly CanonicalMediaWorkflowSnapshot[];
  syncState?: JobsRailSyncState;
  conversationId: string | null;
  canExportDiagnostics: boolean;
  maxVisibleItems?: number;
}

const DEFAULT_MAX_VISIBLE_ITEMS = 8;

function statusToItemState(status: JobStatus, failureClass: JobFailureClass | null | undefined): JobsRailItemState {
  switch (status) {
    case "queued":
    case "running":
      return "running";
    case "succeeded":
      return "completed";
    case "failed":
    case "dead_letter":
      return "needs_input";
    case "canceled":
      return failureClass === "canceled" ? "history" : "history";
  }
}

function resolveStatusLabel(status: JobStatus, failureClass: JobFailureClass | null | undefined): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "succeeded":
      return "Done";
    case "failed":
      if (failureClass === "policy") return "Needs revision";
      if (failureClass === "transient") return "Retry available";
      if (failureClass === "terminal") return "Failed";
      return "Needs review";
    case "dead_letter":
      return "Failed";
    case "canceled":
      return "Canceled";
  }
}

function latestEntryByJob(entries: readonly JobStateEntry[]): JobStateEntry[] {
  const byJobId = new Map<string, JobStateEntry>();

  for (const entry of entries) {
    const existing = byJobId.get(entry.jobId);
    if (!existing) {
      byJobId.set(entry.jobId, entry);
      continue;
    }

    const existingSequence = existing.sequence ?? -1;
    const nextSequence = entry.sequence ?? -1;
    const existingUpdated = Date.parse(existing.updatedAt ?? "") || 0;
    const nextUpdated = Date.parse(entry.updatedAt ?? "") || 0;

    if (nextSequence > existingSequence || (nextSequence === existingSequence && nextUpdated >= existingUpdated)) {
      byJobId.set(entry.jobId, entry);
    }
  }

  return [...byJobId.values()];
}

function updatedAtMs(item: JobsRailItem): number {
  return Date.parse(item.updatedAt ?? "") || 0;
}

function compareItems(left: JobsRailItem, right: JobsRailItem): number {
  const stateRank: Record<JobsRailItemState, number> = {
    needs_input: 0,
    running: 1,
    completed: 2,
    history: 3,
  };
  const rankDiff = stateRank[left.state] - stateRank[right.state];
  if (rankDiff !== 0) return rankDiff;

  const timeDiff = updatedAtMs(right) - updatedAtMs(left);
  if (timeDiff !== 0) return timeDiff;

  return left.title.localeCompare(right.title);
}

function action(kind: JobsRailActionKind, label: string, actionType: JobsRailAction["actionType"], value: string, primary: boolean, params?: Record<string, string>): JobsRailAction {
  return { kind, label, actionType, value, primary, params };
}

function buildOpenAction(jobId: string, primary = true): JobsRailAction {
  return action("open", "Open", "route", `/jobs?jobId=${encodeURIComponent(jobId)}`, primary);
}

function buildActions(entry: JobStateEntry): JobsRailAction[] {
  const snapshot = entry;
  const jobId = snapshot.jobId;
  const failureClass = snapshot.failure.failureClass ?? null;

  if (snapshot.status === "queued" || snapshot.status === "running") {
    return [
      buildOpenAction(jobId),
      action("cancel", "Cancel", "job", jobId, false, { operation: "cancel" }),
    ];
  }

  if (snapshot.status === "succeeded") {
    return [buildOpenAction(jobId)];
  }

  if (snapshot.status === "canceled") {
    return [
      action("dismiss", "Dismiss", "send", `Dismiss job ${jobId} from the jobs rail.`, true),
      buildOpenAction(jobId, false),
    ];
  }

  if (failureClass === "policy") {
    return [
      action("revise", "Revise", "send", `Help me revise the request for job ${jobId}.`, true, { jobId }),
      buildOpenAction(jobId, false),
      action("diagnose", "Diagnose", "send", `Diagnose job ${jobId} and explain the policy failure.`, false, { jobId }),
    ];
  }

  if (failureClass === "transient") {
    return [
      action("retry", "Retry", "job", jobId, true, { operation: "retry" }),
      buildOpenAction(jobId, false),
      action("diagnose", "Diagnose", "send", `Diagnose job ${jobId} before retrying.`, false, { jobId }),
    ];
  }

  return [
    action("diagnose", "Diagnose", "send", `Diagnose job ${jobId} and summarize the next recovery step.`, true, { jobId }),
    buildOpenAction(jobId, false),
  ];
}

function workflowState(status: CanonicalMediaWorkflowSnapshot["status"]): JobsRailItemState {
  if (status === "queued" || status === "running") return "running";
  if (status === "succeeded") return "completed";
  if (status === "failed" || status === "blocked") return "needs_input";
  return "history";
}

function workflowStatusLabel(status: CanonicalMediaWorkflowSnapshot["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "blocked":
      return "Needs attention";
    case "failed":
      return "Failed";
    case "succeeded":
      return "Done";
    case "canceled":
      return "Canceled";
  }
}

function buildWorkflowActions(workflow: CanonicalMediaWorkflowSnapshot): JobsRailAction[] {
  const operationActions = workflow.operation?.availableActions.map((operationAction): JobsRailAction => {
    const link = operationActionToActionLink(operationAction);
    const lower = operationAction.label.toLowerCase();
    return {
      kind: lower.includes("cancel") ? "cancel" : lower.includes("retry") ? "retry" : "open",
      label: operationAction.label,
      actionType: "operation",
      value: link.value,
      params: link.params,
      primary: !lower.includes("cancel"),
    };
  }) ?? [];

  return [
    ...operationActions,
    action("open", "Open jobs workspace", "route", "/jobs", operationActions.length === 0),
  ];
}

function resolveSyncLabel(syncState: JobsRailSyncState): string {
  switch (syncState) {
    case "live":
      return "Live";
    case "reconnecting":
      return "Reconnecting";
    case "stale":
      return "Stale";
    case "unknown":
      return "Unknown";
  }
}

export function resolveJobsRail(options: ResolveJobsRailOptions): JobsRailModel {
  const syncState = options.syncState ?? "unknown";
  const maxVisibleItems = options.maxVisibleItems ?? DEFAULT_MAX_VISIBLE_ITEMS;
  const visibleEntries = latestEntryByJob(options.entries)
    .filter((entry) => !entry.failure.supersededByJobId)
    .filter((entry) => entry.status !== "canceled");

  const jobItems = visibleEntries
    .map((entry): JobsRailItem => {
      const snapshot = entry;
      const failureClass = snapshot.failure.failureClass;
      const state = statusToItemState(snapshot.status, failureClass);
      return {
        jobId: snapshot.jobId,
        conversationId: snapshot.conversationId || options.conversationId,
        toolName: snapshot.toolName,
        title: snapshot.title ?? snapshot.label ?? snapshot.toolName,
        subtitle: snapshot.subtitle ?? snapshot.summary ?? null,
        state,
        statusLabel: resolveStatusLabel(snapshot.status, failureClass),
        progressLabel: snapshot.progressLabel ?? null,
        progressPercent: snapshot.status === "queued" || snapshot.status === "running"
          ? snapshot.progressPercent ?? null
          : null,
        updatedAt: snapshot.updatedAt ?? null,
        failureClass: failureClass ?? (snapshot.status === "failed" || snapshot.status === "dead_letter" ? "unknown" : null),
        actions: buildActions(entry),
      };
    })
    .sort(compareItems);

  const workflowItems = (options.workflows ?? [])
    .filter((workflow) => workflow.status !== "canceled")
    .map((workflow): JobsRailItem => {
      const state = workflowState(workflow.status);
      return {
        jobId: workflow.workflowId,
        conversationId: workflow.conversationId || options.conversationId,
        toolName: "media_workflow",
        title: workflow.title,
        subtitle: workflow.failure.message ?? workflow.stage.label,
        state,
        statusLabel: workflowStatusLabel(workflow.status),
        progressLabel: workflow.stage.label,
        progressPercent: workflow.status === "queued" || workflow.status === "running"
          ? workflow.stage.progressPercent
          : null,
        updatedAt: workflow.updatedAt,
        failureClass: workflow.status === "failed" || workflow.status === "blocked" ? "unknown" : null,
        actions: buildWorkflowActions(workflow),
      };
    });

  const items = [...workflowItems, ...jobItems]
    .sort(compareItems)
    .slice(0, maxVisibleItems);

  const activeCount = items.filter((item) => item.state === "running").length;
  const attentionCount = items.filter((item) => item.state === "needs_input").length;
  const completedCount = items.filter((item) => item.state === "completed").length;

  const primaryState: JobsRailPrimaryState = syncState === "reconnecting"
    ? "reconnecting"
    : attentionCount > 0
      ? "needs_input"
      : activeCount > 0
        ? "running"
        : completedCount > 0
          ? "completed"
          : "idle";

  const overflowActions: JobsRailAction[] = [
    action("open", "Open jobs workspace", "route", "/jobs", false),
  ];

  if (options.canExportDiagnostics && options.conversationId) {
    overflowActions.push(action(
      "download_bundle",
      "Download diagnostic bundle",
      "send",
      "Download a diagnostic bundle for this conversation.",
      false,
      { conversationId: options.conversationId },
    ));
  }

  return {
    primaryState,
    syncState,
    syncLabel: resolveSyncLabel(syncState),
    activeCount,
    attentionCount,
    completedCount,
    items,
    overflowActions,
  };
}
