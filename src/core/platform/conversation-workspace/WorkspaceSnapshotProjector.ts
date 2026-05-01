import type { Conversation } from "@/core/entities/conversation";
import type { WorkspaceAssetRef, WorkspaceJobRef, WorkspaceSnapshot } from "@/core/entities/conversation-workspace";
import type { JobRequest } from "@/core/entities/job";
import type { OperatorTransitionProfile } from "@/core/entities/operator-transition";
import type { PromptBinding } from "@/core/entities/prompt-binding";
import type { RelationshipMemoryRecord } from "@/core/entities/relationship-memory";
import type { TrustDistributionContext } from "@/core/entities/trust-distribution";
import type { UserFile } from "@/core/entities/user-file";
import type { BusinessWorkflowContext } from "@/core/entities/business-workflow-context";
import type { MaterializationRecord } from "@/core/entities/materialization";
import { projectUserFileToConversationMediaAssetCandidate } from "@/lib/media/media-asset-projection";

export interface WorkspaceSnapshotProjectionInput {
  conversation: Conversation;
  activeJobs: readonly JobRequest[];
  userFiles: readonly UserFile[];
  workflowContext?: BusinessWorkflowContext | null;
  operatorTransition?: OperatorTransitionProfile | null;
  trustDistribution?: TrustDistributionContext | null;
  activeMemory?: readonly RelationshipMemoryRecord[];
  promptBindings?: readonly PromptBinding[];
  importantAssetRefs?: readonly WorkspaceAssetRef[];
  materializationsByAssetId?: ReadonlyMap<string, MaterializationRecord | null>;
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function toSnapshotStatus(conversation: Conversation): WorkspaceSnapshot["status"] {
  if (conversation.deletedAt) {
    return "deleted";
  }

  return conversation.status;
}

function toJobRef(job: JobRequest): WorkspaceJobRef | null {
  if (job.status !== "queued" && job.status !== "running") {
    return null;
  }

  const materializationKey = typeof job.requestPayload.materializationKey === "string"
    ? trimToNull(job.requestPayload.materializationKey)
    : null;

  return {
    jobId: job.id,
    toolName: job.toolName,
    status: job.status,
    materializationKey,
    updatedAt: job.updatedAt,
  };
}

function toAssetRef(
  file: UserFile,
  materialization: MaterializationRecord | null | undefined,
): WorkspaceAssetRef | null {
  const candidate = projectUserFileToConversationMediaAssetCandidate(file);

  if (candidate) {
    return {
      assetId: candidate.assetId,
      kind: candidate.assetKind,
      status: file.status,
      producedByJobId: materialization?.producedByJobId ?? null,
      materializationKey: materialization?.materializationKey ?? null,
      updatedAt: materialization?.updatedAt ?? file.createdAt,
    };
  }

  if (file.fileType === "document") {
    return {
      assetId: file.id,
      kind: "document",
      status: file.status,
      producedByJobId: materialization?.producedByJobId ?? null,
      materializationKey: materialization?.materializationKey ?? null,
      updatedAt: materialization?.updatedAt ?? file.createdAt,
    };
  }

  return null;
}

function pickLatestMemoryId(records: readonly RelationshipMemoryRecord[] | undefined): string | null {
  if (!records || records.length === 0) {
    return null;
  }

  return [...records]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.id ?? null;
}

function pickLatestPromptBindingId(bindings: readonly PromptBinding[] | undefined): string | null {
  if (!bindings || bindings.length === 0) {
    return null;
  }

  return [...bindings]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.id ?? null;
}

function resolveUpdatedAt(input: WorkspaceSnapshotProjectionInput): string {
  const timestamps = [
    input.conversation.updatedAt,
    input.conversation.routingSnapshot.lastAnalyzedAt,
    input.workflowContext?.updatedAt,
    input.operatorTransition?.updatedAt,
    input.trustDistribution?.updatedAt,
    ...(input.activeJobs.map((job) => job.updatedAt)),
    ...(input.userFiles.map((file) => file.createdAt)),
    ...((input.importantAssetRefs ?? []).map((asset) => asset.updatedAt)),
    ...((input.activeMemory ?? []).map((record) => record.updatedAt)),
    ...((input.promptBindings ?? []).map((binding) => binding.createdAt)),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  return timestamps.sort((left, right) => right.localeCompare(left))[0] ?? input.conversation.updatedAt;
}

export function projectWorkspaceSnapshot(input: WorkspaceSnapshotProjectionInput): WorkspaceSnapshot {
  const activeJobRefs = input.activeJobs
    .map(toJobRef)
    .filter((ref): ref is WorkspaceJobRef => ref !== null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const importantAssetRefs = input.importantAssetRefs
    ? [...input.importantAssetRefs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    : input.userFiles
      .map((file) => toAssetRef(file, input.materializationsByAssetId?.get(file.id)))
      .filter((ref): ref is WorkspaceAssetRef => ref !== null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return {
    id: `workspace:${input.conversation.id}`,
    userId: input.conversation.userId,
    conversationId: input.conversation.id,
    status: toSnapshotStatus(input.conversation),
    title: input.conversation.title,
    currentObjective: trimToNull(input.conversation.routingSnapshot.detectedNeedSummary),
    recommendedNextStep: trimToNull(input.conversation.routingSnapshot.recommendedNextStep),
    openLoops: [],
    activeJobRefs,
    importantAssetRefs,
    workflowContextRef: input.workflowContext?.id ?? null,
    operatorTransitionRef: input.operatorTransition?.id ?? null,
    trustDistributionRef: input.trustDistribution?.id ?? null,
    relatedBusinessRefs: input.workflowContext?.relatedRefs ?? [],
    latestMemoryRef: pickLatestMemoryId(input.activeMemory),
    latestPromptBindingRef: pickLatestPromptBindingId(input.promptBindings),
    updatedAt: resolveUpdatedAt(input),
  };
}