import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { ContinuitySourceRef } from "@/core/entities/conversation-continuity";
import type { JobRequest } from "@/core/entities/job";
import type { MaterializationRecord } from "@/core/entities/materialization";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import {
  buildComposeMediaMaterializationKey,
  COMPOSE_MEDIA_MATERIALIZATION_PIPELINE_VERSION,
  buildGenerateAudioMaterializationKey,
  GENERATE_AUDIO_MATERIALIZATION_PIPELINE_VERSION,
} from "@/lib/jobs/materialization-key";
import { recordPromptBindingFromSource } from "@/lib/prompts/prompt-binding-service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isComposeMediaEnvelope(value: unknown): value is CapabilityResultEnvelope<Record<string, unknown>> {
  return isRecord(value)
    && value.schemaVersion === 1
    && value.toolName === "compose_media"
    && isRecord(value.payload);
}

function isGenerateAudioEnvelope(value: unknown): value is CapabilityResultEnvelope<Record<string, unknown>> {
  return isRecord(value)
    && value.schemaVersion === 1
    && value.toolName === "generate_audio"
    && isRecord(value.payload);
}

function resolveSourceKind(assetId: string): ContinuitySourceRef["sourceKind"] {
  return assetId.startsWith("blogasset_") ? "blog_asset" : "user_file";
}

function toSourceRef(job: JobRequest, assetId: string): ContinuitySourceRef {
  return {
    sourceKind: resolveSourceKind(assetId),
    sourceId: assetId,
    userId: job.userId,
    conversationId: job.conversationId,
  };
}

function buildInputSourceRefs(job: JobRequest, plan: MediaCompositionPlan): readonly ContinuitySourceRef[] {
  return [
    ...plan.visualClips.map((clip) => toSourceRef(job, clip.sourceAssetId ?? clip.assetId)),
    ...plan.audioClips.map((clip) => toSourceRef(job, clip.sourceAssetId ?? clip.assetId)),
  ];
}

export async function registerComposeMediaMaterialization(
  repository: MaterializationRepository,
  job: JobRequest,
  result: unknown,
): Promise<MaterializationRecord | null> {
  const plan = isRecord(job.requestPayload.plan)
    ? job.requestPayload.plan as unknown as MediaCompositionPlan
    : null;
  if (!plan) {
    return null;
  }

  const envelope = isComposeMediaEnvelope(result) ? result : null;
  const primaryAssetId = typeof envelope?.payload?.primaryAssetId === "string"
    ? envelope.payload.primaryAssetId
    : null;

  if (!primaryAssetId) {
    return null;
  }

  const materializationKey = typeof job.requestPayload.materializationKey === "string"
    ? job.requestPayload.materializationKey
    : buildComposeMediaMaterializationKey(plan);
  const promptBindingId = typeof job.requestPayload.promptBindingId === "string"
    ? job.requestPayload.promptBindingId
    : null;
  const now = job.completedAt ?? job.updatedAt;
  const nextRecordId = `mat_job_${job.id}`;

  const current = await repository.findReusableSuccess(materializationKey, job.userId, job.conversationId);
  const record = await repository.upsert({
    id: nextRecordId,
    userId: job.userId,
    conversationId: job.conversationId,
    materializationKey,
    toolName: job.toolName,
    pipelineVersion: COMPOSE_MEDIA_MATERIALIZATION_PIPELINE_VERSION,
    status: "ready",
    reusePolicy: "same_user",
    inputSourceRefs: buildInputSourceRefs(job, plan),
    outputRefs: [
      {
        kind: "asset",
        id: primaryAssetId,
        userId: job.userId,
        conversationId: job.conversationId,
      },
    ],
    evidenceRefs: [
      {
        source: {
          sourceKind: "job",
          sourceId: job.id,
          userId: job.userId,
          conversationId: job.conversationId,
        },
        observedAt: now,
        summary: "compose_media produced a reusable durable output.",
      },
    ],
    producedByJobId: job.id,
    supersededByRecordId: null,
    createdAt: now,
    updatedAt: now,
  });

  if (current && current.id !== nextRecordId) {
    await repository.markSuperseded(current.id, nextRecordId, now);
  }

  if (promptBindingId && job.userId) {
    await recordPromptBindingFromSource({
      userId: job.userId,
      conversationId: job.conversationId,
      sourcePromptBindingId: promptBindingId,
      surface: "materialization_decision",
      target: {
        targetKind: "materialization_record",
        targetId: record.id,
      },
      decisionSourceRefs: [
        {
          sourceKind: "materialization_record",
          sourceId: record.id,
          userId: job.userId,
          conversationId: job.conversationId,
        },
        {
          sourceKind: "job",
          sourceId: job.id,
          userId: job.userId,
          conversationId: job.conversationId,
        },
      ],
      evidenceRefs: [...record.evidenceRefs],
      createdAt: now,
    });
  }

  return record;
}

export async function registerGenerateAudioMaterialization(
  repository: MaterializationRepository,
  job: JobRequest,
  result: unknown,
): Promise<MaterializationRecord | null> {
  const envelope = isGenerateAudioEnvelope(result) ? result : null;
  const payload = envelope?.payload;
  const assetId = typeof payload?.assetId === "string" && payload.assetId.trim().length > 0
    ? payload.assetId
    : null;
  const title = typeof job.requestPayload.title === "string" ? job.requestPayload.title : null;
  const text = typeof job.requestPayload.text === "string" ? job.requestPayload.text : null;

  if (!assetId || !title || !text) {
    return null;
  }

  const materializationKey = typeof job.requestPayload.materializationKey === "string"
    ? job.requestPayload.materializationKey
    : buildGenerateAudioMaterializationKey({ title, text });
  const promptBindingId = typeof job.requestPayload.promptBindingId === "string"
    ? job.requestPayload.promptBindingId
    : null;
  const now = job.completedAt ?? job.updatedAt;
  const nextRecordId = `mat_job_${job.id}`;

  const current = await repository.findReusableSuccess(materializationKey, job.userId, job.conversationId);
  const record = await repository.upsert({
    id: nextRecordId,
    userId: job.userId,
    conversationId: job.conversationId,
    materializationKey,
    toolName: job.toolName,
    pipelineVersion: GENERATE_AUDIO_MATERIALIZATION_PIPELINE_VERSION,
    status: "ready",
    reusePolicy: "same_user",
    inputSourceRefs: [],
    outputRefs: [
      {
        kind: "asset",
        id: assetId,
        userId: job.userId,
        conversationId: job.conversationId,
      },
    ],
    evidenceRefs: [
      {
        source: {
          sourceKind: "job",
          sourceId: job.id,
          userId: job.userId,
          conversationId: job.conversationId,
        },
        observedAt: now,
        summary: "generate_audio produced a reusable durable audio output.",
      },
    ],
    producedByJobId: job.id,
    supersededByRecordId: null,
    createdAt: now,
    updatedAt: now,
  });

  if (current && current.id !== nextRecordId) {
    await repository.markSuperseded(current.id, nextRecordId, now);
  }

  if (promptBindingId && job.userId) {
    await recordPromptBindingFromSource({
      userId: job.userId,
      conversationId: job.conversationId,
      sourcePromptBindingId: promptBindingId,
      surface: "materialization_decision",
      target: {
        targetKind: "materialization_record",
        targetId: record.id,
      },
      decisionSourceRefs: [
        {
          sourceKind: "materialization_record",
          sourceId: record.id,
          userId: job.userId,
          conversationId: job.conversationId,
        },
        {
          sourceKind: "job",
          sourceId: job.id,
          userId: job.userId,
          conversationId: job.conversationId,
        },
      ],
      evidenceRefs: [...record.evidenceRefs],
      createdAt: now,
    });
  }

  return record;
}
