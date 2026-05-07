"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { JobDetailPanel } from "@/components/jobs/JobDetailPanel";
import {
  type JobAction,
  buildJobFailureClipboardText,
  buildJobLogExport,
  buildJobSummaryClipboardText,
  formatJobSummary,
  formatJobTimestamp,
  getJobAction,
  getJobArtifactLink,
  getJobLogExportFileName,
  getStatusTone,
  STATUS_LABELS,
} from "@/components/jobs/job-workspace-helpers";
import {
  applyJobsWorkspaceEvent,
  applyOptimisticJobSnapshot,
  buildOptimisticJobHistoryEntry,
  createJobsWorkspaceState,
  getJobsWorkspaceMaxSequence,
  reconcileSelectedJobsWorkspaceJob,
  replaceJobsWorkspaceState,
  selectJobsWorkspaceJob,
  type JobsWorkspaceState,
} from "@/components/jobs/job-snapshot-reducer";
import { useJobsEventStream } from "@/components/jobs/useJobsEventStream";
import type { JobRequest } from "@/core/entities/job";
import type { OperationAction } from "@/core/entities/operation";
import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import { buildCanonicalJobSnapshot, type CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type {
  UserJobsWorkspacePageInfo,
  UserJobsWorkspaceQuery,
} from "@/lib/jobs/load-user-jobs-workspace";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";

interface JobsWorkspaceProps {
  workflows?: CanonicalMediaWorkflowSnapshot[];
  jobs: CanonicalJobSnapshot[];
  selectedJob: CanonicalJobSnapshot | null;
  selectedJobHistory: JobHistoryEntry[];
  selectedJobId: string | null;
  userName: string;
  query?: UserJobsWorkspaceQuery;
  pageInfo?: UserJobsWorkspacePageInfo;
}

const EMPTY_WORKFLOWS: CanonicalMediaWorkflowSnapshot[] = [];

interface JobSelectionResponse {
  job?: CanonicalJobSnapshot;
}

interface JobHistoryResponse {
  events?: JobHistoryEntry[];
}

interface JobActionResponse {
  job?: JobRequest;
  eventSequence?: number;
  deduped?: boolean;
  replay?: {
    outcome: "queued" | "deduped";
    sourceJobId: string;
    targetJobId: string;
    dedupeKey: string;
  };
}

interface OperationActionResponse {
  ok?: boolean;
  error?: string;
}

const DEFAULT_QUERY: UserJobsWorkspaceQuery = {
  jobId: null,
  sourceId: null,
  status: null,
  bucket: null,
  sourceKind: null,
  q: null,
  page: 1,
  limit: 20,
};

const DEFAULT_PAGE_INFO: UserJobsWorkspacePageInfo = {
  page: 1,
  limit: 20,
  total: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const WORK_INDEX_FILTERS: Array<{ label: string; params: Partial<UserJobsWorkspaceQuery> }> = [
  { label: "All", params: {} },
  { label: "Running", params: { bucket: "running" } },
  { label: "Needs attention", params: { bucket: "needs_attention" } },
  { label: "Completed", params: { bucket: "completed" } },
  { label: "History", params: { bucket: "history" } },
  { label: "Jobs", params: { sourceKind: "job" } },
  { label: "Workflows", params: { sourceKind: "media_workflow" } },
];

async function writeTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function downloadJsonDocument(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  queueMicrotask(() => URL.revokeObjectURL(objectUrl));
}

function getSyncLabel(syncState: ReturnType<typeof useJobsEventStream>): string {
  switch (syncState) {
    case "live":
      return "Live updates connected.";
    case "fallback":
      return "Live updates unavailable. Using periodic refresh fallback.";
    case "reconnecting":
    default:
      return "Live updates reconnecting. Recent state is being refreshed.";
  }
}

function buildJobsHref(params: Partial<UserJobsWorkspaceQuery> = {}): string {
  const searchParams = new URLSearchParams();

  if (params.bucket) searchParams.set("bucket", params.bucket);
  if (params.sourceKind) searchParams.set("sourceKind", params.sourceKind);
  if (params.status) searchParams.set("status", params.status);
  if (params.q) searchParams.set("q", params.q);
  if (params.jobId) searchParams.set("jobId", params.jobId);
  if (params.sourceId) searchParams.set("sourceId", params.sourceId);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));

  const queryString = searchParams.toString();
  return queryString ? `/jobs?${queryString}` : "/jobs";
}

function buildSelectionHref(query: UserJobsWorkspaceQuery, jobId: string): string {
  return buildJobsHref({
    bucket: query.bucket,
    sourceKind: query.sourceKind,
    status: query.status,
    q: query.q,
    page: query.page,
    jobId,
  });
}

function buildReconcileSearch(query: UserJobsWorkspaceQuery): string {
  const searchParams = new URLSearchParams();
  if (query.bucket) searchParams.set("bucket", query.bucket);
  if (query.sourceKind) searchParams.set("sourceKind", query.sourceKind);
  if (query.status) searchParams.set("status", query.status);
  if (query.q) searchParams.set("q", query.q);
  if (query.jobId) searchParams.set("jobId", query.jobId);
  if (query.sourceId) searchParams.set("sourceId", query.sourceId);
  if (query.page > 1) searchParams.set("page", String(query.page));
  return searchParams.toString();
}

function isFilterActive(filter: Partial<UserJobsWorkspaceQuery>, query: UserJobsWorkspaceQuery): boolean {
  if (!filter.bucket && !filter.sourceKind && !filter.status) {
    return !query.bucket && !query.sourceKind && !query.status;
  }

  return (!filter.bucket || query.bucket === filter.bucket)
    && (!filter.sourceKind || query.sourceKind === filter.sourceKind)
    && (!filter.status || query.status === filter.status);
}

function getWorkflowStatusTone(status: CanonicalMediaWorkflowSnapshot["status"]): string {
  if (status === "blocked") {
    return getStatusTone("failed");
  }
  if (status === "succeeded" || status === "failed" || status === "canceled") {
    return getStatusTone(status);
  }
  return getStatusTone("running");
}

function getWorkflowStatusLabel(status: CanonicalMediaWorkflowSnapshot["status"]): string {
  switch (status) {
    case "blocked":
      return "Needs attention";
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "failed":
      return "Failed";
    case "succeeded":
      return "Succeeded";
    case "canceled":
      return "Canceled";
  }
}

function isWorkflowActive(workflow: CanonicalMediaWorkflowSnapshot): boolean {
  return workflow.status === "queued" || workflow.status === "running";
}

function isWorkflowAttention(workflow: CanonicalMediaWorkflowSnapshot): boolean {
  return workflow.status === "failed" || workflow.status === "blocked";
}

function getJobBucket(job: CanonicalJobSnapshot): UserJobsWorkspaceQuery["bucket"] {
  if (job.status === "queued" || job.status === "running") {
    return "running";
  }
  if (job.status === "failed" || job.status === "dead_letter") {
    return "needs_attention";
  }
  if (job.status === "succeeded") {
    return "completed";
  }
  return "history";
}

function getWorkflowBucket(workflow: CanonicalMediaWorkflowSnapshot): UserJobsWorkspaceQuery["bucket"] {
  if (workflow.status === "queued" || workflow.status === "running") {
    return "running";
  }
  if (workflow.status === "failed" || workflow.status === "blocked") {
    return "needs_attention";
  }
  if (workflow.status === "succeeded") {
    return "completed";
  }
  return "history";
}

function getWorkIndexBucketRank(bucket: UserJobsWorkspaceQuery["bucket"]): number {
  switch (bucket) {
    case "running":
      return 0;
    case "needs_attention":
      return 1;
    case "completed":
      return 2;
    case "history":
    case null:
    default:
      return 3;
  }
}

function getWorkIndexStatusRank(
  item:
    | { kind: "job"; job: CanonicalJobSnapshot }
    | { kind: "media_workflow"; workflow: CanonicalMediaWorkflowSnapshot },
): number {
  const status = item.kind === "job" ? item.job.status : item.workflow.status;

  if (status === "running") {
    return 0;
  }
  if (status === "queued") {
    return 1;
  }
  if (status === "failed" || status === "dead_letter" || status === "blocked") {
    return 2;
  }
  if (status === "succeeded") {
    return 3;
  }
  return 4;
}

function getWorkflowSourceLabel(workflow: CanonicalMediaWorkflowSnapshot): string {
  return `${workflow.requestedDeliverable} workflow`;
}

function updatedAtMs(value: string | null | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function includesQuery(fields: Array<string | null | undefined>, query: string | null): boolean {
  if (!query) {
    return true;
  }

  const lowerQuery = query.toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(lowerQuery));
}

function isSelectedJobOverride(job: CanonicalJobSnapshot, query: UserJobsWorkspaceQuery): boolean {
  return job.jobId === query.jobId || job.jobId === query.sourceId;
}

function jobMatchesWorkIndexQuery(job: CanonicalJobSnapshot, query: UserJobsWorkspaceQuery): boolean {
  if (isSelectedJobOverride(job, query)) {
    return true;
  }

  if (query.sourceKind && query.sourceKind !== "job") {
    return false;
  }

  if (query.status && job.status !== query.status) {
    return false;
  }

  if (query.bucket && getJobBucket(job) !== query.bucket) {
    return false;
  }

  if (query.sourceId && job.jobId !== query.sourceId) {
    return false;
  }

  return includesQuery([
    job.jobId,
    job.conversationId,
    job.toolName,
    job.label,
    job.title,
    job.subtitle,
    job.summary,
    job.status,
    job.progressLabel,
    job.error,
  ], query.q);
}

function workflowMatchesWorkIndexQuery(workflow: CanonicalMediaWorkflowSnapshot, query: UserJobsWorkspaceQuery): boolean {
  if (query.sourceKind && query.sourceKind !== "media_workflow") {
    return false;
  }

  if (query.status && workflow.status !== query.status) {
    return false;
  }

  if (query.bucket && getWorkflowBucket(workflow) !== query.bucket) {
    return false;
  }

  if (query.sourceId && workflow.workflowId !== query.sourceId) {
    return false;
  }

  return includesQuery([
    workflow.workflowId,
    workflow.conversationId,
    workflow.title,
    workflow.requestedDeliverable,
    workflow.status,
    workflow.stage.label,
    workflow.failure.message,
    workflow.finalArtifact?.assetId,
    ...workflow.linkedJobIds,
    ...workflow.linkedJobs.flatMap((job) => [job.jobId, job.title, job.label, job.toolName]),
  ], query.q);
}

export function JobsWorkspace({
  workflows = EMPTY_WORKFLOWS,
  jobs,
  selectedJob,
  selectedJobHistory,
  selectedJobId,
  userName,
  query = DEFAULT_QUERY,
  pageInfo,
}: JobsWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [workspace, setWorkspace] = useState<JobsWorkspaceState>(() =>
    createJobsWorkspaceState({
      workflows,
      jobs,
      selectedJob,
      selectedJobHistory,
      selectedJobId,
    }),
  );
  const selectionRequestRef = useRef(0);
  const activeQuery = { ...DEFAULT_QUERY, ...query };
  const activePageInfo = { ...DEFAULT_PAGE_INFO, total: jobs.length + workflows.length, ...pageInfo };

  useEffect(() => {
    selectionRequestRef.current += 1;
    setIsHistoryLoading(false);
    setWorkspace((current) =>
      replaceJobsWorkspaceState(current, {
        jobs,
        workflows,
        selectedJob,
        selectedJobHistory,
        selectedJobId,
      }),
    );
  }, [jobs, selectedJob, selectedJobHistory, selectedJobId, workflows]);

  const syncState = useJobsEventStream({
    initialAfterSequence: getJobsWorkspaceMaxSequence(workspace),
    selectedJobId: workspace.selectedJobId,
    reconcileSearch: buildReconcileSearch(activeQuery),
    onEvent: (event) => {
      setWorkspace((current) => applyJobsWorkspaceEvent(current, event));
    },
    onReconciled: (payload) => {
      setWorkspace((current) => replaceJobsWorkspaceState(current, payload));
      setIsHistoryLoading(false);
    },
  });

  const workspaceWorkflows = workspace.workflows ?? [];
  const visibleJobs = workspace.jobs.filter((job) => jobMatchesWorkIndexQuery(job, activeQuery));
  const visibleWorkflows = workspaceWorkflows.filter((workflow) => workflowMatchesWorkIndexQuery(workflow, activeQuery));
  const activeCount = visibleJobs.filter((job) => job.status === "queued" || job.status === "running").length
    + visibleWorkflows.filter(isWorkflowActive).length;
  const attentionCount = visibleJobs.filter((job) => job.status === "failed" || job.status === "dead_letter").length
    + visibleWorkflows.filter(isWorkflowAttention).length;
  const completedCount = visibleJobs.filter((job) => job.status === "succeeded").length
    + visibleWorkflows.filter((workflow) => workflow.status === "succeeded").length;
  const pageCount = Math.max(1, Math.ceil(activePageInfo.total / activePageInfo.limit));
  const workItems = [
    ...visibleWorkflows.map((workflow) => ({
      kind: "media_workflow" as const,
      id: workflow.workflowId,
      updatedAt: workflow.updatedAt,
      workflow,
    })),
    ...visibleJobs.map((job) => ({
      kind: "job" as const,
      id: job.jobId,
      updatedAt: job.updatedAt,
      job,
    })),
  ].sort((left, right) => {
    const leftBucket = left.kind === "job" ? getJobBucket(left.job) : getWorkflowBucket(left.workflow);
    const rightBucket = right.kind === "job" ? getJobBucket(right.job) : getWorkflowBucket(right.workflow);
    const bucketDelta = getWorkIndexBucketRank(leftBucket) - getWorkIndexBucketRank(rightBucket);

    if (bucketDelta !== 0) {
      return bucketDelta;
    }

    const statusDelta = getWorkIndexStatusRank(left) - getWorkIndexStatusRank(right);

    if (statusDelta !== 0) {
      return statusDelta;
    }

    return updatedAtMs(right.updatedAt) - updatedAtMs(left.updatedAt);
  });
  const hasWork = workItems.length > 0;

  async function loadSelectedJob(jobId: string): Promise<void> {
    const requestId = selectionRequestRef.current + 1;
    selectionRequestRef.current = requestId;
    setIsHistoryLoading(true);

    try {
      const [jobResponse, historyResponse] = await Promise.all([
        fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
          credentials: "same-origin",
        }),
        fetch(`/api/jobs/${encodeURIComponent(jobId)}/events?limit=50`, {
          credentials: "same-origin",
        }),
      ]);

      if (selectionRequestRef.current !== requestId) {
        return;
      }

      const jobPayload = jobResponse.ok
        ? await jobResponse.json() as JobSelectionResponse
        : null;
      const historyPayload = historyResponse.ok
        ? await historyResponse.json() as JobHistoryResponse
        : null;

      const nextSelectedJob = jobPayload?.job ?? workspace.jobs.find((job) => job.jobId === jobId) ?? null;
      const nextSelectedHistory = Array.isArray(historyPayload?.events) ? historyPayload.events : [];

      setWorkspace((current) =>
        reconcileSelectedJobsWorkspaceJob(current, jobId, nextSelectedJob, nextSelectedHistory),
      );
    } catch (error) {
      void error;
      if (selectionRequestRef.current === requestId) {
        setErrorMessage("Unable to load that job right now.");
      }
    } finally {
      if (selectionRequestRef.current === requestId) {
        setIsHistoryLoading(false);
      }
    }
  }

  function handleSelectJob(jobId: string): void {
    if (jobId === workspace.selectedJobId) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setWorkspace((current) => selectJobsWorkspaceJob(current, jobId));
    router.push(buildSelectionHref(activeQuery, jobId));
    void loadSelectedJob(jobId);
  }

  async function runJobAction(jobId: string, action: JobAction): Promise<void> {
    setErrorMessage(null);
    setStatusMessage(null);
    setPendingJobId(jobId);

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `Unable to ${action} this job right now.`);
      }

      const body = await response.json() as JobActionResponse;
      const nextSnapshot = body.job ? buildCanonicalJobSnapshot(body.job) : null;

      if (nextSnapshot) {
        const isSelectedJobAction = workspace.selectedJobId === jobId;
        const optimisticEntry = buildOptimisticJobHistoryEntry(
          nextSnapshot,
          action === "cancel" ? "canceled" : "queued",
          body.eventSequence,
        );

        setWorkspace((current) =>
          applyOptimisticJobSnapshot(current, nextSnapshot, {
            selectJob: isSelectedJobAction,
            optimisticHistoryEntry: isSelectedJobAction ? optimisticEntry : undefined,
          }),
        );

        if (action === "retry" && isSelectedJobAction && nextSnapshot.jobId !== jobId) {
          router.replace(buildSelectionHref(activeQuery, nextSnapshot.jobId));
          void loadSelectedJob(nextSnapshot.jobId);
        }

        if (action === "cancel") {
          setStatusMessage("Job canceled.");
        } else if (body.replay?.outcome === "deduped") {
          setStatusMessage("Equivalent work is already running. Switched to the active job.");
        } else {
          setStatusMessage("Replay queued as a new job.");
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Unable to ${action} this job right now.`);
    } finally {
      setPendingJobId(null);
    }
  }

  async function runOperationAction(action: OperationAction): Promise<void> {
    setErrorMessage(null);
    setStatusMessage(null);
    setPendingJobId(action.id);

    try {
      const response = await fetch(`/api/operations/${encodeURIComponent(action.operationId)}/actions/${encodeURIComponent(action.id)}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: action.idempotencyKey,
          operationRevision: action.operationRevision,
          payload: action.payload,
          confirmation: action.confirmPolicy === "single_click"
            ? { confirmed: true }
            : action.confirmPolicy === "phrase" && action.confirmationText
              ? { phrase: action.confirmationText }
              : undefined,
        }),
      });

      const body = await response.json().catch(() => null) as OperationActionResponse | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Unable to ${action.label.toLowerCase()} right now.`);
      }

      setStatusMessage(`${action.label} requested.`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Unable to ${action.label.toLowerCase()} right now.`);
    } finally {
      setPendingJobId(null);
    }
  }

  function handleOperationAction(action: OperationAction): void {
    startTransition(() => {
      void runOperationAction(action);
    });
  }

  function handleJobAction(jobId: string, action: JobAction): void {
    startTransition(() => {
      void runJobAction(jobId, action);
    });
  }

  async function handleCopySummary(job: CanonicalJobSnapshot): Promise<void> {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await writeTextToClipboard(buildJobSummaryClipboardText(job));
      setStatusMessage("Job summary copied.");
    } catch {
      setErrorMessage("Unable to copy the job summary right now.");
    }
  }

  async function handleCopyFailure(job: CanonicalJobSnapshot): Promise<void> {
    setErrorMessage(null);
    setStatusMessage(null);

    const failureText = buildJobFailureClipboardText(job);
    if (!failureText) {
      setErrorMessage("No failure details are available for this job.");
      return;
    }

    try {
      await writeTextToClipboard(failureText);
      setStatusMessage("Failure details copied.");
    } catch {
      setErrorMessage("Unable to copy the failure details right now.");
    }
  }

  function handleExportLog(job: CanonicalJobSnapshot, history: JobHistoryEntry[]): void {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      downloadJsonDocument(buildJobLogExport(job, history), getJobLogExportFileName(job));
      setStatusMessage("Job log exported.");
    } catch {
      setErrorMessage("Unable to export this job log right now.");
    }
  }

  return (
    <section className="jobs-page-shell" data-testid="jobs-workspace-shell" data-jobs-workspace="true">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-(--space-4) px-(--space-frame-mobile) py-(--space-section-tight) sm:gap-(--space-section-default) sm:px-(--space-frame-default) sm:py-(--space-frame-mobile)">
        <header className="jobs-hero-surface px-(--space-inset-default) py-(--space-inset-default) sm:px-(--space-inset-panel) sm:py-(--space-inset-panel)" data-jobs-hero="true">
          <div className="jobs-hero-grid">
            <div className="max-w-3xl space-y-(--space-2)" data-jobs-hero-copy="true">
              <p className="text-xs font-semibold uppercase text-foreground/45">Workspace</p>
              <h1 className="theme-display text-3xl font-semibold text-foreground sm:text-4xl">Work Index</h1>
              <p className="max-w-2xl text-sm leading-6 text-foreground/68 sm:text-base">
                Track active, completed, and attention-needed work tied to this account. Jobs remain inspectable, but this view follows the work you asked Ordo to do.
              </p>
              <div className="jobs-hero-meta">
                <p className="text-sm text-foreground/50">Signed in as {userName}.</p>
                <p className="text-sm text-foreground/50" data-testid="jobs-sync-state">{getSyncLabel(syncState)}</p>
              </div>
            </div>

            <div className="jobs-summary-strip" data-jobs-summary-strip="true">
              <div className="jobs-panel-surface jobs-summary-card min-w-32 px-(--space-3) py-(--space-3)" data-jobs-summary-card="active">
                <p className="text-xs uppercase text-foreground/45">Running</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{activeCount}</p>
              </div>
              <div className="jobs-panel-surface jobs-summary-card min-w-32 px-(--space-3) py-(--space-3)" data-jobs-summary-card="attention">
                <p className="text-xs uppercase text-foreground/45">Needs attention</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{attentionCount}</p>
              </div>
              <div className="jobs-panel-surface jobs-summary-card min-w-32 px-(--space-3) py-(--space-3)" data-jobs-summary-card="completed">
                <p className="text-xs uppercase text-foreground/45">Completed</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{completedCount}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="jobs-panel-surface px-(--space-3) py-(--space-3)" data-work-index-toolbar="true">
          <div className="flex flex-col gap-(--space-3) lg:flex-row lg:items-end lg:justify-between">
            <form action="/jobs" role="search" className="grid gap-(--space-2) sm:flex sm:items-end">
              <label className="grid gap-(--space-1) text-sm font-medium text-foreground/70">
                Search work
                <input
                  type="search"
                  name="q"
                  defaultValue={activeQuery.q ?? ""}
                  placeholder="Title, job id, workflow, status..."
                  className="min-h-10 rounded-full border border-foreground/10 bg-background px-(--space-3) text-sm text-foreground outline-none transition focus:border-foreground/30"
                />
              </label>
              {activeQuery.bucket ? <input type="hidden" name="bucket" value={activeQuery.bucket} /> : null}
              {activeQuery.sourceKind ? <input type="hidden" name="sourceKind" value={activeQuery.sourceKind} /> : null}
              {activeQuery.status ? <input type="hidden" name="status" value={activeQuery.status} /> : null}
              {activeQuery.jobId ? <input type="hidden" name="jobId" value={activeQuery.jobId} /> : null}
              {activeQuery.sourceId ? <input type="hidden" name="sourceId" value={activeQuery.sourceId} /> : null}
              <button
                type="submit"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-foreground/12 bg-foreground px-(--space-3) py-(--space-2) text-sm font-semibold text-background transition hover:opacity-85 focus-ring"
              >
                Search
              </button>
            </form>
            <p className="text-sm text-foreground/55">
              {activePageInfo.total} item{activePageInfo.total === 1 ? "" : "s"}
            </p>
          </div>

          <nav aria-label="Work filters" className="mt-(--space-3) flex gap-(--space-1) overflow-x-auto pb-(--space-1)">
            {WORK_INDEX_FILTERS.map((filter) => {
              const active = isFilterActive(filter.params, activeQuery);
              return (
                <Link
                  key={filter.label}
                  href={buildJobsHref({ ...filter.params, q: activeQuery.q })}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-9 flex-none items-center rounded-full border px-(--space-3) py-(--space-1) text-[0.76rem] font-semibold transition focus-ring ${
                    active
                      ? "border-foreground/24 bg-foreground text-background"
                      : "border-foreground/10 text-foreground/66 hover:border-foreground/18 hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {errorMessage && (
          <div role="alert" className="jobs-detail-surface px-(--space-4) py-(--space-3) text-sm text-foreground/78" data-jobs-alert="true">
            {errorMessage}
          </div>
        )}

        {statusMessage && (
          <div role="status" className="jobs-detail-surface px-(--space-4) py-(--space-3) text-sm text-foreground/78" data-jobs-status="true">
            {statusMessage}
          </div>
        )}

        {!hasWork ? (
          <div className="jobs-empty-state px-(--space-inset-default) py-(--space-10) text-center sm:px-(--space-inset-panel) sm:py-(--space-16)" data-jobs-empty-state="true">
            <h2 className="text-xl font-semibold text-foreground/72">No work for this view</h2>
            <p className="mx-auto mt-(--space-3) max-w-xl text-sm leading-6 text-foreground/55">
              Try another filter or return to the dashboard. New work appears here as Ordo queues, runs, completes, or needs your attention.
            </p>
          </div>
        ) : (
          <div className="grid gap-(--space-3) sm:gap-(--space-4)" data-work-index-layout="single-column" data-jobs-workspace-grid="true">
            <div className="jobs-job-list grid gap-(--space-2) sm:gap-(--space-3)" data-work-index-list="true" data-jobs-list="true">
              {workItems.map((item) => {
                if (item.kind === "media_workflow") {
                  const workflow = item.workflow;

                  return (
                    <article
                      key={workflow.workflowId}
                      className="jobs-detail-surface w-full px-(--space-inset-default) py-(--space-inset-default) text-left sm:px-(--space-inset-panel) sm:py-(--space-inset-panel)"
                      data-testid={`workflow-card-${workflow.workflowId}`}
                      data-work-index-card="media_workflow"
                      data-jobs-workflow-card="true"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-(--space-3)">
                        <div className="flex flex-wrap items-center gap-(--space-2)">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase ${getWorkflowStatusTone(workflow.status)}`}>
                            {getWorkflowStatusLabel(workflow.status)}
                          </span>
                          <span className="jobs-metric-pill inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-semibold uppercase text-foreground/55">
                            {getWorkflowSourceLabel(workflow)}
                          </span>
                        </div>
                        <span className="text-xs text-foreground/45">Updated {formatJobTimestamp(workflow.updatedAt)}</span>
                      </div>

                      <h2 className="mt-(--space-3) text-lg font-semibold text-foreground">{workflow.title}</h2>
                      <p className="mt-(--space-3) text-sm leading-6 text-foreground/68">
                        {workflow.failure.message ?? workflow.stage.label}
                      </p>
                      {workflow.stage.progressPercent != null ? (
                        <div className="mt-(--space-3) space-y-1">
                          <div className="flex items-center justify-between text-[0.68rem] font-semibold uppercase text-foreground/45">
                            <span>{workflow.stage.label}</span>
                            <span>{Math.round(workflow.stage.progressPercent)}%</span>
                          </div>
                          <div className="jobs-progress-track h-1.5 overflow-hidden rounded-full">
                            <div
                              className="jobs-progress-fill h-full rounded-full"
                              style={{ width: `${Math.max(0, Math.min(100, workflow.stage.progressPercent))}%` }}
                            />
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-(--space-3) flex flex-wrap gap-(--space-2)" data-workflow-linked-jobs={workflow.workflowId}>
                        {workflow.linkedJobs.map((linkedJob) => (
                          <button
                            key={linkedJob.jobId}
                            type="button"
                            className="rounded-full border border-foreground/12 px-3 py-1.5 text-xs font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground focus-ring"
                            onClick={() => handleSelectJob(linkedJob.jobId)}
                          >
                            Open linked job {linkedJob.title ?? linkedJob.label}
                          </button>
                        ))}
                        {workflow.linkedJobIds.length > workflow.linkedJobs.length ? (
                          <span className="rounded-full border border-dashed border-foreground/10 px-3 py-1.5 text-xs text-foreground/45">
                            {workflow.linkedJobIds.length - workflow.linkedJobs.length} linked job{workflow.linkedJobIds.length - workflow.linkedJobs.length === 1 ? "" : "s"} unavailable
                          </span>
                        ) : null}
                        {workflow.finalArtifact ? (
                          <Link
                            className="rounded-full border border-foreground/12 px-3 py-1.5 text-xs font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground focus-ring"
                            href={`/api/user-files/${workflow.finalArtifact.assetId}`}
                          >
                            Open {workflow.finalArtifact.kind}
                          </Link>
                        ) : null}
                      </div>

                      {workflow.operation?.availableActions.length ? (
                        <div className="mt-(--space-3) flex flex-wrap gap-(--space-2)" data-jobs-workflow-operation-actions="true">
                          {workflow.operation.availableActions.map((action) => (
                            <button
                              key={action.id}
                              type="button"
                              className="ui-capability-action focus-ring"
                              data-chat-action-link="operation"
                              data-operation-action="true"
                              disabled={pendingJobId === action.id && isPending}
                              onClick={() => handleOperationAction(action)}
                            >
                              {pendingJobId === action.id && isPending ? "Working..." : action.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                }

                const snapshot = item.job;
                const title = snapshot.title ?? snapshot.label;
                const isSelected = snapshot.jobId === workspace.selectedJobId;
                const summary = formatJobSummary(snapshot);
                const action = getJobAction(snapshot.status);
                const artifactLink = getJobArtifactLink(snapshot);
                const history = isSelected ? workspace.selectedJobHistory : [];

                return (
                  <article
                    key={snapshot.jobId}
                    className={`jobs-detail-surface w-full px-(--space-inset-default) py-(--space-inset-default) text-left transition sm:px-(--space-inset-panel) sm:py-(--space-inset-panel) ${isSelected ? "jobs-card-selected" : "jobs-card-idle"}`}
                    data-testid={`job-card-${snapshot.jobId}`}
                    data-work-index-card="job"
                    data-jobs-card="true"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-(--space-3)">
                      <div className="flex flex-wrap items-center gap-(--space-2)">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase ${getStatusTone(snapshot.status)}`}>
                          {STATUS_LABELS[snapshot.status]}
                        </span>
                        <span className="jobs-metric-pill inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-semibold uppercase text-foreground/55">
                          {snapshot.toolName}
                        </span>
                        {isSelected ? (
                          <span className="inline-flex rounded-full border border-foreground/12 px-2 py-0.5 text-[0.68rem] font-semibold uppercase text-foreground/50">
                            Selected
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs text-foreground/45">Updated {formatJobTimestamp(snapshot.updatedAt)}</span>
                    </div>

                    <h2 className="mt-(--space-3) text-lg font-semibold text-foreground">{title}</h2>
                    {snapshot.subtitle ? (
                      <p className="mt-1 text-sm text-foreground/55">{snapshot.subtitle}</p>
                    ) : null}
                    <p className="mt-(--space-3) text-sm leading-6 text-foreground/68">{summary}</p>

                    {snapshot.progressPercent != null ? (
                      <div className="mt-(--space-3) space-y-1">
                        <div className="flex items-center justify-between text-[0.68rem] font-semibold uppercase text-foreground/45">
                          <span>{snapshot.progressLabel ?? "Progress"}</span>
                          <span>{Math.round(snapshot.progressPercent)}%</span>
                        </div>
                        <div className="jobs-progress-track h-1.5 overflow-hidden rounded-full">
                          <div
                            className="jobs-progress-fill h-full rounded-full"
                            style={{ width: `${Math.max(0, Math.min(100, snapshot.progressPercent))}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {!isSelected ? (
                      <div className="mt-(--space-3) flex flex-wrap items-center gap-(--space-2)" data-work-index-card-actions="true">
                        <button
                          type="button"
                          className="rounded-full border border-foreground/12 px-3 py-1.5 text-xs font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground focus-ring"
                          onClick={() => handleSelectJob(snapshot.jobId)}
                          aria-label={`Open details for ${title}`}
                        >
                          Details
                        </button>
                        {action ? (
                          <button
                            type="button"
                            className="rounded-full border border-foreground/12 px-3 py-1.5 text-xs font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-45"
                            onClick={() => handleJobAction(snapshot.jobId, action.action)}
                            disabled={pendingJobId === snapshot.jobId && isPending}
                            aria-label={`${action.label} ${title}`}
                          >
                            {pendingJobId === snapshot.jobId && isPending ? "Working..." : action.label}
                          </button>
                        ) : null}
                        {snapshot.conversationId ? (
                          <Link
                            href={`/?conversationId=${encodeURIComponent(snapshot.conversationId)}`}
                            aria-label={`Open conversation for ${title}`}
                            className="rounded-full border border-foreground/12 px-3 py-1.5 text-xs font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground focus-ring"
                          >
                            Open conversation
                          </Link>
                        ) : null}
                        {artifactLink ? (
                          <Link
                            href={artifactLink.href}
                            className="rounded-full border border-foreground/12 px-3 py-1.5 text-xs font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground focus-ring"
                          >
                            {artifactLink.label}
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          className="rounded-full border border-foreground/12 px-3 py-1.5 text-xs font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground focus-ring"
                          onClick={() => {
                            void handleCopySummary(snapshot);
                          }}
                          aria-label={`Copy summary for ${title}`}
                        >
                          Copy summary
                        </button>
                        {snapshot.error ? (
                          <button
                            type="button"
                            className="rounded-full border border-foreground/12 px-3 py-1.5 text-xs font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground focus-ring"
                            onClick={() => {
                              void handleCopyFailure(snapshot);
                            }}
                            aria-label={`Copy failure for ${title}`}
                          >
                            Copy failure
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded-full border border-foreground/12 px-3 py-1.5 text-xs font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground focus-ring"
                          onClick={() => handleExportLog(snapshot, history)}
                          aria-label={`Export log for ${title}`}
                        >
                          Export log
                        </button>
                      </div>
                    ) : (
                      <div data-work-index-inline-timeline="true">
                        <JobDetailPanel
                          job={workspace.selectedJob}
                          history={workspace.selectedJobHistory}
                          isHistoryLoading={isHistoryLoading}
                          isPending={pendingJobId === workspace.selectedJobId && isPending}
                          onJobAction={handleJobAction}
                          onCopySummary={(job) => {
                            void handleCopySummary(job);
                          }}
                          onCopyFailure={(job) => {
                            void handleCopyFailure(job);
                          }}
                          onExportLog={handleExportLog}
                          embedded
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {pageCount > 1 ? (
              <nav className="flex items-center justify-between gap-(--space-3)" aria-label="Work pages" data-work-index-pagination="true">
                {activePageInfo.hasPreviousPage ? (
                  <Link
                    href={buildJobsHref({ ...activeQuery, page: activePageInfo.page - 1 })}
                    className="rounded-full border border-foreground/12 px-3 py-2 text-sm font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground focus-ring"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="rounded-full border border-foreground/8 px-3 py-2 text-sm text-foreground/35">Previous</span>
                )}
                <span className="text-sm text-foreground/55">Page {activePageInfo.page} of {pageCount}</span>
                {activePageInfo.hasNextPage ? (
                  <Link
                    href={buildJobsHref({ ...activeQuery, page: activePageInfo.page + 1 })}
                    className="rounded-full border border-foreground/12 px-3 py-2 text-sm font-semibold text-foreground/66 transition hover:border-foreground/24 hover:text-foreground focus-ring"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="rounded-full border border-foreground/8 px-3 py-2 text-sm text-foreground/35">Next</span>
                )}
              </nav>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
