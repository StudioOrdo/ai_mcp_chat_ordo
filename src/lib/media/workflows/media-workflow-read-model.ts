import type { JobStatus } from "@/core/entities/job";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

import type { SqliteMediaWorkflowRepository } from "./sqlite-media-workflow-repository";
import type {
  MediaWorkflowDeliverable,
  MediaWorkflowSnapshot,
  MediaWorkflowStatus,
  MediaWorkflowStep,
  MediaWorkflowStepKind,
  MediaWorkflowStepStatus,
} from "./types";

export type CanonicalMediaWorkflowArtifactKind = "video" | "audio" | "image" | "chart" | "graph";

export interface CanonicalMediaWorkflowSnapshot {
  workflowId: string;
  conversationId: string;
  userId: string;
  title: string;
  requestedDeliverable: MediaWorkflowDeliverable;
  status: MediaWorkflowStatus;
  stage: {
    key: string;
    label: string;
    progressPercent: number | null;
  };
  steps: Array<{
    stepId: string;
    kind: MediaWorkflowStepKind;
    status: MediaWorkflowStepStatus;
    jobId: string | null;
    assetId: string | null;
    label: string;
  }>;
  finalArtifact: {
    assetId: string;
    kind: CanonicalMediaWorkflowArtifactKind;
  } | null;
  failure: {
    code: string | null;
    message: string | null;
  };
  linkedJobIds: string[];
  linkedJobs: CanonicalJobSnapshot[];
  originMessageId: string | null;
  originTurnId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface MediaWorkflowReadModelOptions {
  workflowRepository: SqliteMediaWorkflowRepository;
  jobStatusQuery?: JobStatusQuery;
}

const STEP_LABELS: Record<MediaWorkflowStepKind, string> = {
  compose_media: "Compose video",
  generate_audio: "Generate audio",
  generate_chart: "Prepare chart",
  generate_image: "Prepare image",
  reuse_asset: "Prepare asset",
};

const STATUS_PROGRESS: Record<MediaWorkflowStatus, number | null> = {
  queued: 0,
  running: null,
  blocked: null,
  failed: null,
  succeeded: 100,
  canceled: null,
};

function isActiveStepStatus(status: MediaWorkflowStepStatus): boolean {
  return status === "queued" || status === "running";
}

function isTerminalWorkflowStatus(status: MediaWorkflowStatus): boolean {
  return status === "failed" || status === "succeeded" || status === "canceled";
}

function inferArtifactKind(deliverable: MediaWorkflowDeliverable, assetId: string): CanonicalMediaWorkflowArtifactKind {
  if (deliverable === "video" || assetId.startsWith("uf_video")) {
    return "video";
  }
  if (deliverable === "audio" || assetId.startsWith("uf_audio")) {
    return "audio";
  }
  if (assetId.startsWith("chart_")) {
    return "chart";
  }
  if (assetId.startsWith("graph_")) {
    return "graph";
  }
  return deliverable === "chart" || deliverable === "image" ? deliverable : "image";
}

function resolveFinalArtifact(snapshot: MediaWorkflowSnapshot): CanonicalMediaWorkflowSnapshot["finalArtifact"] {
  const finalStep = [...snapshot.steps].reverse().find((step) => {
    if (snapshot.workflow.requestedDeliverable === "video") {
      return step.kind === "compose_media" && step.status === "ready" && step.assetId;
    }
    if (snapshot.workflow.requestedDeliverable === "audio") {
      return step.kind === "generate_audio" && step.status === "ready" && step.assetId;
    }
    return step.status === "ready" && step.assetId;
  });
  const finalAssetId = snapshot.workflow.finalAssetId
    ?? finalStep?.assetId
    ?? null;

  if (!finalAssetId) {
    return null;
  }

  return {
    assetId: finalAssetId,
    kind: inferArtifactKind(snapshot.workflow.requestedDeliverable, finalAssetId),
  };
}

function getStepProgress(step: MediaWorkflowStep): number | null {
  if (step.status === "ready" || step.status === "skipped") {
    return 100;
  }
  if (step.status === "queued") {
    return 5;
  }
  if (step.status === "running") {
    return 50;
  }
  return null;
}

function resolveStage(snapshot: MediaWorkflowSnapshot): CanonicalMediaWorkflowSnapshot["stage"] {
  const { workflow } = snapshot;
  if (workflow.status === "succeeded") {
    return {
      key: "succeeded",
      label: `${workflow.requestedDeliverable[0]?.toUpperCase() ?? ""}${workflow.requestedDeliverable.slice(1)} ready`,
      progressPercent: 100,
    };
  }

  if (workflow.status === "failed" || workflow.status === "blocked") {
    return {
      key: workflow.status,
      label: workflow.failureMessage ?? "Workflow needs attention",
      progressPercent: null,
    };
  }

  if (workflow.status === "canceled") {
    return {
      key: "canceled",
      label: "Workflow canceled",
      progressPercent: null,
    };
  }

  const activeStep = snapshot.steps.find((step) => isActiveStepStatus(step.status));
  if (activeStep) {
    return {
      key: activeStep.kind,
      label: STEP_LABELS[activeStep.kind],
      progressPercent: getStepProgress(activeStep),
    };
  }

  const pendingStep = snapshot.steps.find((step) => step.status === "pending");
  if (pendingStep) {
    return {
      key: pendingStep.kind,
      label: `Waiting to ${STEP_LABELS[pendingStep.kind].toLowerCase()}`,
      progressPercent: STATUS_PROGRESS[workflow.status],
    };
  }

  return {
    key: workflow.status,
    label: isTerminalWorkflowStatus(workflow.status) ? workflow.status : "Workflow running",
    progressPercent: STATUS_PROGRESS[workflow.status],
  };
}

function getLinkedJobIds(snapshot: MediaWorkflowSnapshot): string[] {
  return snapshot.steps.flatMap((step) => step.jobId ? [step.jobId] : []);
}

function toWorkflowSnapshot(
  snapshot: MediaWorkflowSnapshot,
  linkedJobs: CanonicalJobSnapshot[],
): CanonicalMediaWorkflowSnapshot {
  const finalArtifact = resolveFinalArtifact(snapshot);

  return {
    workflowId: snapshot.workflow.id,
    conversationId: snapshot.workflow.conversationId,
    userId: snapshot.workflow.userId,
    title: snapshot.workflow.title,
    requestedDeliverable: snapshot.workflow.requestedDeliverable,
    status: snapshot.workflow.status,
    stage: resolveStage(snapshot),
    steps: snapshot.steps.map((step) => ({
      stepId: step.id,
      kind: step.kind,
      status: step.status,
      jobId: step.jobId,
      assetId: step.assetId,
      label: STEP_LABELS[step.kind],
    })),
    finalArtifact,
    failure: {
      code: snapshot.workflow.failureCode,
      message: snapshot.workflow.failureMessage,
    },
    linkedJobIds: getLinkedJobIds(snapshot),
    linkedJobs,
    originMessageId: snapshot.workflow.originMessageId,
    originTurnId: snapshot.workflow.originTurnId,
    createdAt: snapshot.workflow.createdAt,
    updatedAt: snapshot.workflow.updatedAt,
    completedAt: snapshot.workflow.completedAt,
  };
}

function sortWorkflows(workflows: CanonicalMediaWorkflowSnapshot[]): CanonicalMediaWorkflowSnapshot[] {
  return [...workflows].sort((left, right) => {
    const activeDelta = Number(right.status === "queued" || right.status === "running") - Number(left.status === "queued" || left.status === "running");
    if (activeDelta !== 0) {
      return activeDelta;
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}

export function isCanonicalMediaWorkflowSnapshot(value: unknown): value is CanonicalMediaWorkflowSnapshot {
  return typeof value === "object"
    && value !== null
    && typeof (value as { workflowId?: unknown }).workflowId === "string"
    && typeof (value as { conversationId?: unknown }).conversationId === "string"
    && typeof (value as { userId?: unknown }).userId === "string"
    && typeof (value as { title?: unknown }).title === "string"
    && typeof (value as { status?: unknown }).status === "string"
    && Array.isArray((value as { steps?: unknown }).steps)
    && Array.isArray((value as { linkedJobIds?: unknown }).linkedJobIds);
}

export class MediaWorkflowReadModel {
  constructor(private readonly options: MediaWorkflowReadModelOptions) {}

  async buildSnapshot(snapshot: MediaWorkflowSnapshot): Promise<CanonicalMediaWorkflowSnapshot> {
    const linkedJobs = await this.loadLinkedJobs(snapshot);
    return toWorkflowSnapshot(snapshot, linkedJobs);
  }

  async listConversationWorkflows(conversationId: string): Promise<CanonicalMediaWorkflowSnapshot[]> {
    const snapshots = this.options.workflowRepository.listWorkflowsByConversation(conversationId);
    return sortWorkflows(await Promise.all(snapshots.map((snapshot) => this.buildSnapshot(snapshot))));
  }

  async listUserWorkflows(userId: string, options: { limit?: number } = {}): Promise<CanonicalMediaWorkflowSnapshot[]> {
    const snapshots = this.options.workflowRepository.listWorkflowsByUser(userId, options);
    return sortWorkflows(await Promise.all(snapshots.map((snapshot) => this.buildSnapshot(snapshot))));
  }

  private async loadLinkedJobs(snapshot: MediaWorkflowSnapshot): Promise<CanonicalJobSnapshot[]> {
    if (!this.options.jobStatusQuery) {
      return [];
    }

    const jobs = await Promise.all(getLinkedJobIds(snapshot).map((jobId) =>
      this.options.jobStatusQuery?.getUserJobSnapshot(snapshot.workflow.userId, jobId) ?? Promise.resolve(null),
    ));

    return jobs.filter((job): job is CanonicalJobSnapshot => Boolean(job));
  }
}

export function getWorkflowLinkedJobIdSet(workflows: readonly CanonicalMediaWorkflowSnapshot[]): Set<string> {
  return new Set(workflows.flatMap((workflow) => workflow.linkedJobIds));
}

export function shouldSuppressWorkflowLinkedJob(
  job: CanonicalJobSnapshot,
  workflows: readonly CanonicalMediaWorkflowSnapshot[],
): boolean {
  return getWorkflowLinkedJobIdSet(workflows).has(job.jobId);
}

export function filterPrimaryJobSnapshotsForWorkflows(
  jobs: readonly CanonicalJobSnapshot[],
  workflows: readonly CanonicalMediaWorkflowSnapshot[],
): CanonicalJobSnapshot[] {
  return jobs.filter((job) => !shouldSuppressWorkflowLinkedJob(job, workflows));
}

export function getWorkflowStatusBucket(status: MediaWorkflowStatus): "active" | "attention" | "completed" {
  if (status === "failed" || status === "blocked" || status === "canceled") {
    return "attention";
  }

  return status === "succeeded" ? "completed" : "active";
}

export function workflowStatusToJobStatus(status: MediaWorkflowStatus): JobStatus {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "failed":
    case "blocked":
      return "failed";
    case "canceled":
      return "canceled";
    case "queued":
      return "queued";
    case "running":
      return "running";
  }
}
