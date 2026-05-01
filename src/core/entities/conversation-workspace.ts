import type { BusinessObjectRef, CanonicalEvidenceRef } from "./conversation-continuity";

export type WorkspaceSnapshotStatus = "active" | "archived" | "deleted";
export type WorkspaceOpenLoopKind = "question" | "commitment" | "follow_up" | "blocked_work" | "review";
export type WorkspaceOpenLoopStatus = "open" | "blocked" | "resolved" | "superseded";
export type WorkspaceActiveJobStatus = "queued" | "running";
export type WorkspaceAssetKind = "audio" | "chart" | "graph" | "image" | "video" | "subtitle" | "waveform" | "document";
export type WorkspaceAssetStatus = "pending" | "ready" | "failed" | "superseded" | "deleted";

export interface WorkspaceOpenLoop {
  id: string;
  kind: WorkspaceOpenLoopKind;
  status: WorkspaceOpenLoopStatus;
  label: string;
  evidenceRefs: readonly CanonicalEvidenceRef[];
  dueAt: string | null;
}

export interface WorkspaceJobRef {
  jobId: string;
  toolName: string;
  status: WorkspaceActiveJobStatus;
  materializationKey: string | null;
  updatedAt: string;
}

export interface WorkspaceAssetRef {
  assetId: string;
  kind: WorkspaceAssetKind;
  status: WorkspaceAssetStatus;
  producedByJobId: string | null;
  materializationKey: string | null;
  updatedAt: string;
}

export interface WorkspaceSnapshot {
  id: string;
  userId: string;
  conversationId: string;
  status: WorkspaceSnapshotStatus;
  title: string;
  currentObjective: string | null;
  recommendedNextStep: string | null;
  openLoops: readonly WorkspaceOpenLoop[];
  activeJobRefs: readonly WorkspaceJobRef[];
  importantAssetRefs: readonly WorkspaceAssetRef[];
  workflowContextRef: string | null;
  operatorTransitionRef: string | null;
  trustDistributionRef: string | null;
  relatedBusinessRefs: readonly BusinessObjectRef[];
  latestMemoryRef: string | null;
  latestPromptBindingRef: string | null;
  updatedAt: string;
}

export interface CreateEmptyWorkspaceSnapshotInput {
  id: string;
  userId: string;
  conversationId: string;
  title: string;
  status?: WorkspaceSnapshotStatus;
  updatedAt: string;
}

export function createEmptyWorkspaceSnapshot(input: CreateEmptyWorkspaceSnapshotInput): WorkspaceSnapshot {
  return {
    id: input.id,
    userId: input.userId,
    conversationId: input.conversationId,
    status: input.status ?? "active",
    title: input.title,
    currentObjective: null,
    recommendedNextStep: null,
    openLoops: [],
    activeJobRefs: [],
    importantAssetRefs: [],
    workflowContextRef: null,
    operatorTransitionRef: null,
    trustDistributionRef: null,
    relatedBusinessRefs: [],
    latestMemoryRef: null,
    latestPromptBindingRef: null,
    updatedAt: input.updatedAt,
  };
}

export function isWorkspaceSnapshotRestorable(snapshot: WorkspaceSnapshot): boolean {
  return snapshot.status !== "deleted";
}