import { randomUUID } from "crypto";

import { assertNotJobIdAssetReference, assertStepReadyState } from "./state";
import type { MediaWorkflowDraft, MediaWorkflowStepKind, MediaWorkflowStepSeed } from "./types";

function workflowId(): string {
  return `mwf_${randomUUID()}`;
}

function stepId(): string {
  return `mwfs_${randomUUID()}`;
}

export interface CreateChartAudioVideoWorkflowInput {
  userId: string;
  conversationId: string;
  originMessageId?: string | null;
  originTurnId?: string | null;
  title: string;
  chart: {
    assetId: string;
    title?: string;
    input?: Record<string, unknown>;
  };
  audio: {
    title: string;
    text: string;
    jobId?: string | null;
    input?: Record<string, unknown>;
  };
  compose?: {
    planId?: string;
    resolution?: { width: number; height: number };
    profile?: string;
    outputFormat?: "mp4";
    input?: Record<string, unknown>;
  };
  request?: Record<string, unknown>;
  now?: string;
}

export interface CreateVisualAudioVideoWorkflowInput {
  userId: string;
  conversationId: string;
  originMessageId?: string | null;
  originTurnId?: string | null;
  title: string;
  visual: {
    assetId: string;
    kind: Extract<MediaWorkflowStepKind, "reuse_asset" | "generate_chart" | "generate_image">;
    title?: string;
    input?: Record<string, unknown>;
  };
  audio: {
    title: string;
    text: string;
    jobId?: string | null;
    input?: Record<string, unknown>;
  };
  compose?: CreateChartAudioVideoWorkflowInput["compose"];
  request?: Record<string, unknown>;
  now?: string;
}

export interface CreateGeneratedAudioWorkflowInput {
  userId: string;
  conversationId: string;
  originMessageId?: string | null;
  originTurnId?: string | null;
  title: string;
  audio: {
    title: string;
    text: string;
    jobId?: string | null;
    input?: Record<string, unknown>;
  };
  request?: Record<string, unknown>;
  now?: string;
}

export function createChartAudioVideoWorkflowDraft(input: CreateChartAudioVideoWorkflowInput): MediaWorkflowDraft {
  return createVisualAudioVideoWorkflowDraft({
    ...input,
    visual: {
      assetId: input.chart.assetId,
      kind: "generate_chart",
      title: input.chart.title,
      input: input.chart.input,
    },
    request: {
      template: "chart_audio_video",
      ...input.request,
    },
  });
}

export function createVisualAudioVideoWorkflowDraft(input: CreateVisualAudioVideoWorkflowInput): MediaWorkflowDraft {
  const now = input.now ?? new Date().toISOString();
  const id = workflowId();
  const visualStepId = stepId();
  const audioStepId = stepId();
  const composeStepId = stepId();

  assertNotJobIdAssetReference(input.visual.assetId, "visual.assetId");

  const visualStep: MediaWorkflowStepSeed = {
    id: visualStepId,
    workflowId: id,
    sequence: 1,
    kind: input.visual.kind,
    status: "ready",
    assetId: input.visual.assetId,
    input: {
      title: input.visual.title ?? input.title,
      ...input.visual.input,
    },
    output: {
      assetId: input.visual.assetId,
    },
    createdAt: now,
    updatedAt: now,
  };

  assertStepReadyState({
    status: "ready",
    assetId: visualStep.assetId,
    output: visualStep.output,
  });

  return {
    workflow: {
      id,
      userId: input.userId,
      conversationId: input.conversationId,
      originMessageId: input.originMessageId ?? null,
      originTurnId: input.originTurnId ?? null,
      requestedDeliverable: "video",
      title: input.title,
      status: "queued",
      request: {
        template: "visual_audio_video",
        ...input.request,
      },
      createdAt: now,
      updatedAt: now,
    },
    steps: [
      visualStep,
      {
        id: audioStepId,
        workflowId: id,
        sequence: 2,
        kind: "generate_audio",
        status: input.audio.jobId ? "queued" : "pending",
        jobId: input.audio.jobId ?? null,
        dependsOnStepIds: [],
        input: {
          title: input.audio.title,
          text: input.audio.text,
          ...input.audio.input,
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: composeStepId,
        workflowId: id,
        sequence: 3,
        kind: "compose_media",
        status: "pending",
        dependsOnStepIds: [visualStepId, audioStepId],
        input: {
          planId: input.compose?.planId ?? `${id}_compose`,
          outputFormat: input.compose?.outputFormat ?? "mp4",
          profile: input.compose?.profile ?? "still_image_narration_fast",
          resolution: input.compose?.resolution,
          ...input.compose?.input,
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    initialEvent: {
      eventType: "workflow_created",
      payload: { template: input.request?.template ?? "visual_audio_video" },
      createdAt: now,
    },
  };
}

export function createGeneratedAudioWorkflowDraft(input: CreateGeneratedAudioWorkflowInput): MediaWorkflowDraft {
  const now = input.now ?? new Date().toISOString();
  const id = workflowId();

  return {
    workflow: {
      id,
      userId: input.userId,
      conversationId: input.conversationId,
      originMessageId: input.originMessageId ?? null,
      originTurnId: input.originTurnId ?? null,
      requestedDeliverable: "audio",
      title: input.title,
      status: "queued",
      request: {
        template: "generated_audio",
        ...input.request,
      },
      createdAt: now,
      updatedAt: now,
    },
    steps: [{
      id: stepId(),
      workflowId: id,
      sequence: 1,
      kind: "generate_audio",
      status: input.audio.jobId ? "queued" : "pending",
      jobId: input.audio.jobId ?? null,
      input: {
        title: input.audio.title,
        text: input.audio.text,
        ...input.audio.input,
      },
      createdAt: now,
      updatedAt: now,
    }],
    initialEvent: {
      eventType: "workflow_created",
      payload: { template: "generated_audio" },
      createdAt: now,
    },
  };
}
