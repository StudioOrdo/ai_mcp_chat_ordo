import { createHash, randomUUID } from "node:crypto";

import {
  getMediaWorkflowReadModel,
  getMediaWorkflowRepository,
  getOperationRepository,
} from "@/adapters/RepositoryFactory";
import type { RoleName } from "@/core/entities/user";
import { createMediaWorkflowCreateAction } from "@/core/use-cases/operations/MediaWorkflowOperationActions";
import type { OperationActionDispatchService } from "@/core/use-cases/operations/OperationActionDispatch";
import type { OperationActionDispatchResult } from "@/core/use-cases/operations/OperationActionDispatch";
import type { OperationRepository } from "@/core/use-cases/operations/OperationRepository";
import { isRegisteredJobCapability } from "@/lib/jobs/job-capability-registry";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";
import type { SqliteMediaWorkflowRepository } from "@/lib/media/workflows/sqlite-media-workflow-repository";
import { createOperationActionDispatchService } from "@/lib/operations/operation-action-dispatch-root";

export type MediaWorkflowOperationToolName = "compose_media" | "generate_audio";

export interface MediaWorkflowOperationLaunchInput {
  toolName: MediaWorkflowOperationToolName;
  conversationId: string;
  userId: string;
  role: RoleName;
  request: Record<string, unknown>;
  sourceSurface?: string;
  operationRepository?: OperationRepository;
  workflowRepository?: Pick<SqliteMediaWorkflowRepository, "findWorkflowByOperationId">;
  workflowReadModel?: {
    buildSnapshot(snapshot: NonNullable<ReturnType<SqliteMediaWorkflowRepository["findWorkflowByOperationId"]>>): Promise<CanonicalMediaWorkflowSnapshot>;
  };
  dispatchService?: Pick<OperationActionDispatchService, "dispatch">;
  idFactory?: (prefix: string) => string;
}

export interface MediaWorkflowOperationLaunchResult {
  operation: OperationActionDispatchResult["snapshot"]["operation"];
  snapshot: OperationActionDispatchResult["snapshot"];
  availableActions: OperationActionDispatchResult["availableActions"];
  workflow: CanonicalMediaWorkflowSnapshot | null;
  jobId: string | null;
  job: CanonicalMediaWorkflowSnapshot["linkedJobs"][number] | null;
  exactReuse: boolean;
  deduplicated: false;
}

export type MediaWorkflowOperationLauncher = (
  input: MediaWorkflowOperationLaunchInput,
) => Promise<MediaWorkflowOperationLaunchResult>;

export function mediaWorkflowOperationIdempotencyKey(
  toolName: MediaWorkflowOperationToolName,
  conversationId: string,
  raw: Record<string, unknown>,
): string {
  const digest = createHash("sha1")
    .update(JSON.stringify({ toolName, conversationId, raw }))
    .digest("hex")
    .slice(0, 16);
  return `media:${toolName}:${conversationId}:${digest}`;
}

export function buildMediaWorkflowOperationPayload(
  toolName: MediaWorkflowOperationToolName,
  raw: Record<string, unknown>,
  conversationId: string,
): Record<string, unknown> {
  if (toolName === "compose_media") {
    return {
      template: "compose_media",
      requestedDeliverable: "video",
      conversationId,
      idempotencyKey: mediaWorkflowOperationIdempotencyKey(toolName, conversationId, raw),
      compose: { plan: raw["plan"] },
      plan: raw["plan"],
      request: raw,
    };
  }

  const audio = raw["input"] ?? raw;
  return {
    template: "generated_audio",
    requestedDeliverable: "audio",
    conversationId,
    idempotencyKey: mediaWorkflowOperationIdempotencyKey(toolName, conversationId, raw),
    audio,
    input: audio,
    request: raw,
  };
}

export function summarizeMediaWorkflowOperationRequest(
  toolName: MediaWorkflowOperationToolName,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  if (toolName === "compose_media") {
    return { plan: summarizeComposePlan(raw["plan"]) };
  }

  return { audio: summarizeAudioRequest(raw["input"] ?? raw) };
}

export function mediaWorkflowOperationTitle(toolName: MediaWorkflowOperationToolName): string {
  return toolName === "generate_audio" ? "Generate audio" : "Compose media";
}

export async function launchMediaWorkflowOperation(
  input: MediaWorkflowOperationLaunchInput,
): Promise<MediaWorkflowOperationLaunchResult> {
  if (!isRegisteredJobCapability(input.toolName)) {
    throw new Error(`Tool is not a registered job capability: ${input.toolName}`);
  }

  const operationRepository = input.operationRepository ?? getOperationRepository();
  const workflowRepository = input.workflowRepository ?? getMediaWorkflowRepository();
  const workflowReadModel = input.workflowReadModel ?? getMediaWorkflowReadModel();
  const idFactory = input.idFactory ?? ((prefix: string) => `${prefix}_${randomUUID()}`);
  const operationId = idFactory("op_media");

  await operationRepository.createOperation({
    id: operationId,
    kind: "media_workflow",
    title: mediaWorkflowOperationTitle(input.toolName),
    summary: "Media workflow requested from a user-facing media tool surface.",
    status: "draft",
    riskLevel: "medium",
    conversationId: input.conversationId,
    createdByUserId: input.userId,
    createdByRole: input.role,
    visibility: "user",
    input: {
      request: input.request,
      migration: {
        sourceSurface: input.sourceSurface ?? "media_workflow_operation_launcher",
        toolName: input.toolName,
      },
    },
    actorType: "user",
    actorId: input.userId,
  });

  const action = createMediaWorkflowCreateAction({
    operationId,
    operationRevision: 1,
    idFactory,
    payload: buildMediaWorkflowOperationPayload(input.toolName, input.request, input.conversationId),
  });
  await operationRepository.replaceActions({
    operationId,
    actions: [action],
    actorType: "system",
    actorId: input.userId,
  });

  const dispatch = input.dispatchService ?? createOperationActionDispatchService({ repository: operationRepository });
  const result = await dispatch.dispatch({
    operationId,
    actionId: action.id,
    idempotencyKey: action.idempotencyKey,
    clientOperationRevision: action.operationRevision,
    actorUserId: input.userId,
    actorRole: input.role,
    payload: action.payload,
    confirmation: { confirmed: true },
  });

  const workflow = workflowRepository.findWorkflowByOperationId(operationId);
  const workflowSnapshot = workflow ? await workflowReadModel.buildSnapshot(workflow) : null;

  return {
    operation: result.snapshot.operation,
    snapshot: result.snapshot,
    availableActions: result.availableActions,
    workflow: workflowSnapshot,
    jobId: workflowSnapshot?.linkedJobIds[0] ?? null,
    job: workflowSnapshot?.linkedJobs[0] ?? null,
    exactReuse: Boolean(workflowSnapshot?.finalArtifact && workflowSnapshot.linkedJobIds.length === 0),
    deduplicated: false,
  };
}

export function toMediaWorkflowOperationToolResult(
  toolName: MediaWorkflowOperationToolName,
  result: MediaWorkflowOperationLaunchResult,
): Record<string, unknown> {
  return {
    action: toolName,
    outcome: "operation_created",
    operationId: result.operation.id,
    operation: result.operation,
    snapshot: result.snapshot,
    availableActions: result.availableActions,
    workflow: result.workflow,
    jobId: result.jobId,
    job: result.job,
    exactReuse: result.exactReuse,
    deduplicated: result.deduplicated,
  };
}

function summarizeComposePlan(plan: unknown): Record<string, unknown> | null {
  if (typeof plan !== "object" || plan === null) {
    return null;
  }

  const raw = plan as {
    id?: unknown;
    conversationId?: unknown;
    visualClips?: unknown;
    audioClips?: unknown;
    profile?: unknown;
    outputFormat?: unknown;
  };
  const summarizeClip = (clip: unknown) => {
    if (typeof clip !== "object" || clip === null) {
      return { invalid: true };
    }

    const value = clip as { assetId?: unknown; kind?: unknown; sourceAssetId?: unknown };
    return {
      assetId: typeof value.assetId === "string" ? value.assetId : null,
      kind: typeof value.kind === "string" ? value.kind : null,
      sourceAssetId: typeof value.sourceAssetId === "string" ? value.sourceAssetId : null,
    };
  };

  return {
    id: typeof raw.id === "string" ? raw.id : null,
    conversationId: typeof raw.conversationId === "string" ? raw.conversationId : null,
    profile: typeof raw.profile === "string" ? raw.profile : null,
    outputFormat: typeof raw.outputFormat === "string" ? raw.outputFormat : null,
    visualClips: Array.isArray(raw.visualClips) ? raw.visualClips.map(summarizeClip) : [],
    audioClips: Array.isArray(raw.audioClips) ? raw.audioClips.map(summarizeClip) : [],
  };
}

function summarizeAudioRequest(input: unknown): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const raw = input as { title?: unknown; text?: unknown; assetId?: unknown };
  return {
    title: typeof raw.title === "string" ? raw.title : null,
    textLength: typeof raw.text === "string" ? raw.text.length : null,
    hasAssetId: typeof raw.assetId === "string" && raw.assetId.trim().length > 0,
  };
}
