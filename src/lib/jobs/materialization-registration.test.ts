import { describe, expect, it, vi } from "vitest";

import type { MaterializationRecord } from "@/core/entities/materialization";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";

const { recordPromptBindingFromSourceMock } = vi.hoisted(() => ({
  recordPromptBindingFromSourceMock: vi.fn(async () => null),
}));

vi.mock("@/lib/prompts/prompt-binding-service", () => ({
  recordPromptBindingFromSource: recordPromptBindingFromSourceMock,
}));

import {
  registerComposeMediaMaterialization,
  registerGenerateAudioMaterialization,
} from "./materialization-registration";

describe("materialization-registration", () => {
  it("records blogasset inputs with blog_asset continuity source refs", async () => {
    const repository: MaterializationRepository = {
      findById: vi.fn(async () => null),
      findByMaterializationKey: vi.fn(async () => null),
      listByConversation: vi.fn(async () => []),
      findLatestByOutputRef: vi.fn(async () => null),
      findReusableSuccess: vi.fn(async () => null),
      upsert: vi.fn(async (record) => record),
      markSuperseded: vi.fn(async () => null),
    };

    const record = await registerComposeMediaMaterialization(
      repository,
      {
        id: "job_compose_1",
        conversationId: "conv_1",
        userId: "usr_1",
        toolName: "compose_media",
        status: "succeeded",
        priority: 5,
        dedupeKey: "compose_media:key_1",
        initiatorType: "user",
        requestPayload: {
          materializationKey: "compose_media:key_1",
          plan: {
            id: "plan_1",
            conversationId: "conv_1",
            visualClips: [{ assetId: "blogasset_hero_1", kind: "image" }],
            audioClips: [],
            subtitlePolicy: "none",
            waveformPolicy: "none",
            outputFormat: "mp4",
          },
        },
        resultPayload: null,
        errorMessage: null,
        progressPercent: 100,
        progressLabel: "Completed",
        attemptCount: 1,
        leaseExpiresAt: null,
        claimedBy: null,
        failureClass: null,
        nextRetryAt: null,
        recoveryMode: "rerun",
        lastCheckpointId: null,
        replayedFromJobId: null,
        supersededByJobId: null,
        createdAt: "2026-04-13T12:00:00.000Z",
        startedAt: "2026-04-13T12:00:01.000Z",
        completedAt: "2026-04-13T12:00:02.000Z",
        updatedAt: "2026-04-13T12:00:02.000Z",
      },
      {
        schemaVersion: 1,
        toolName: "compose_media",
        family: "media",
        cardKind: "media_output",
        executionMode: "deferred",
        inputSnapshot: {},
        summary: { title: "Media Composition" },
        payload: { primaryAssetId: "asset_out_1" },
      },
    );

    expect(record?.inputSourceRefs).toEqual([
      expect.objectContaining({
        sourceKind: "blog_asset",
        sourceId: "blogasset_hero_1",
      }),
    ]);
    expect(recordPromptBindingFromSourceMock).not.toHaveBeenCalled();
  });

  it("records a materialization_decision binding when the job carries a source prompt binding", async () => {
    const repository: MaterializationRepository = {
      findById: vi.fn(async () => null),
      findByMaterializationKey: vi.fn(async () => null),
      listByConversation: vi.fn(async () => []),
      findLatestByOutputRef: vi.fn(async () => null),
      findReusableSuccess: vi.fn(async () => null),
      upsert: vi.fn(async (record) => record),
      markSuperseded: vi.fn(async () => null),
    };

    await registerComposeMediaMaterialization(
      repository,
      {
        id: "job_compose_2",
        conversationId: "conv_1",
        userId: "usr_1",
        toolName: "compose_media",
        status: "succeeded",
        priority: 5,
        dedupeKey: "compose_media:key_2",
        initiatorType: "user",
        requestPayload: {
          materializationKey: "compose_media:key_2",
          promptBindingId: "pb_root_1",
          plan: {
            id: "plan_2",
            conversationId: "conv_1",
            visualClips: [{ assetId: "blogasset_hero_1", kind: "image" }],
            audioClips: [],
            subtitlePolicy: "none",
            waveformPolicy: "none",
            outputFormat: "mp4",
          },
        },
        resultPayload: null,
        errorMessage: null,
        progressPercent: 100,
        progressLabel: "Completed",
        attemptCount: 1,
        leaseExpiresAt: null,
        claimedBy: null,
        failureClass: null,
        nextRetryAt: null,
        recoveryMode: "rerun",
        lastCheckpointId: null,
        replayedFromJobId: null,
        supersededByJobId: null,
        createdAt: "2026-04-13T12:00:00.000Z",
        startedAt: "2026-04-13T12:00:01.000Z",
        completedAt: "2026-04-13T12:00:02.000Z",
        updatedAt: "2026-04-13T12:00:02.000Z",
      },
      {
        schemaVersion: 1,
        toolName: "compose_media",
        family: "media",
        cardKind: "media_output",
        executionMode: "deferred",
        inputSnapshot: {},
        summary: { title: "Media Composition" },
        payload: { primaryAssetId: "asset_out_2" },
      },
    );

    expect(recordPromptBindingFromSourceMock).toHaveBeenCalledWith(expect.objectContaining({
      sourcePromptBindingId: "pb_root_1",
      surface: "materialization_decision",
      target: {
        targetKind: "materialization_record",
        targetId: "mat_job_job_compose_2",
      },
    }));
  });

  it("records generated audio materializations with durable asset refs", async () => {
    recordPromptBindingFromSourceMock.mockClear();
    const repository: MaterializationRepository = {
      findById: vi.fn(async () => null),
      findByMaterializationKey: vi.fn(async () => null),
      listByConversation: vi.fn(async () => []),
      findLatestByOutputRef: vi.fn(async () => null),
      findReusableSuccess: vi.fn(async () => null),
      upsert: vi.fn(async (record) => record),
      markSuperseded: vi.fn(async () => null),
    };

    const record = await registerGenerateAudioMaterialization(
      repository,
      {
        id: "job_audio_1",
        conversationId: "conv_1",
        userId: "usr_1",
        toolName: "generate_audio",
        status: "succeeded",
        priority: 5,
        dedupeKey: "generate_audio:key_1",
        initiatorType: "user",
        requestPayload: {
          materializationKey: "generate_audio:key_1",
          title: "Founder memo",
          text: "This is the founder memo for the weekly review.",
        },
        resultPayload: null,
        errorMessage: null,
        progressPercent: 100,
        progressLabel: "Completed",
        attemptCount: 1,
        leaseExpiresAt: null,
        claimedBy: null,
        failureClass: null,
        nextRetryAt: null,
        recoveryMode: "rerun",
        lastCheckpointId: null,
        replayedFromJobId: null,
        supersededByJobId: null,
        createdAt: "2026-04-13T12:00:00.000Z",
        startedAt: "2026-04-13T12:00:01.000Z",
        completedAt: "2026-04-13T12:00:02.000Z",
        updatedAt: "2026-04-13T12:00:02.000Z",
      },
      {
        schemaVersion: 1,
        toolName: "generate_audio",
        family: "artifact",
        cardKind: "artifact_viewer",
        executionMode: "deferred",
        inputSnapshot: {},
        summary: { title: "Founder memo" },
        payload: { assetId: "uf_audio_1" },
      },
    );

    expect(record).toMatchObject({
      id: "mat_job_job_audio_1",
      toolName: "generate_audio",
      materializationKey: "generate_audio:key_1",
      pipelineVersion: "generate_audio:v1",
      outputRefs: [
        expect.objectContaining({
          kind: "asset",
          id: "uf_audio_1",
        }),
      ],
    });
    expect(repository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      inputSourceRefs: [],
      evidenceRefs: [
        expect.objectContaining({
          summary: "generate_audio produced a reusable durable audio output.",
        }),
      ],
    }));
  });

  it("records prompt binding and supersedes older generated audio materializations", async () => {
    recordPromptBindingFromSourceMock.mockClear();
    const repository: MaterializationRepository = {
      findById: vi.fn(async () => null),
      findByMaterializationKey: vi.fn(async () => null),
      listByConversation: vi.fn(async () => []),
      findLatestByOutputRef: vi.fn(async () => null),
      findReusableSuccess: vi.fn(async (): Promise<MaterializationRecord> => ({
        id: "mat_audio_old_1",
        userId: "usr_1",
        conversationId: "conv_1",
        materializationKey: "generate_audio:key_1",
        toolName: "generate_audio",
        pipelineVersion: "generate_audio:v1",
        status: "ready",
        reusePolicy: "same_user",
        inputSourceRefs: [],
        outputRefs: [{ kind: "asset", id: "uf_audio_old_1", userId: "usr_1", conversationId: "conv_1" }],
        evidenceRefs: [],
        producedByJobId: "job_audio_old_1",
        supersededByRecordId: null,
        createdAt: "2026-04-13T11:00:00.000Z",
        updatedAt: "2026-04-13T11:00:00.000Z",
      })),
      upsert: vi.fn(async (record) => record),
      markSuperseded: vi.fn(async () => null),
    };

    await registerGenerateAudioMaterialization(
      repository,
      {
        id: "job_audio_2",
        conversationId: "conv_1",
        userId: "usr_1",
        toolName: "generate_audio",
        status: "succeeded",
        priority: 5,
        dedupeKey: "generate_audio:key_1",
        initiatorType: "user",
        requestPayload: {
          materializationKey: "generate_audio:key_1",
          promptBindingId: "pb_audio_1",
          title: "Founder memo",
          text: "This is the founder memo for the weekly review.",
        },
        resultPayload: null,
        errorMessage: null,
        progressPercent: 100,
        progressLabel: "Completed",
        attemptCount: 1,
        leaseExpiresAt: null,
        claimedBy: null,
        failureClass: null,
        nextRetryAt: null,
        recoveryMode: "rerun",
        lastCheckpointId: null,
        replayedFromJobId: null,
        supersededByJobId: null,
        createdAt: "2026-04-13T12:00:00.000Z",
        startedAt: "2026-04-13T12:00:01.000Z",
        completedAt: "2026-04-13T12:00:02.000Z",
        updatedAt: "2026-04-13T12:00:02.000Z",
      },
      {
        schemaVersion: 1,
        toolName: "generate_audio",
        family: "artifact",
        cardKind: "artifact_viewer",
        executionMode: "deferred",
        inputSnapshot: {},
        summary: { title: "Founder memo" },
        payload: { assetId: "uf_audio_2" },
      },
    );

    expect(repository.markSuperseded).toHaveBeenCalledWith(
      "mat_audio_old_1",
      "mat_job_job_audio_2",
      "2026-04-13T12:00:02.000Z",
    );
    expect(recordPromptBindingFromSourceMock).toHaveBeenCalledWith(expect.objectContaining({
      sourcePromptBindingId: "pb_audio_1",
      surface: "materialization_decision",
      target: {
        targetKind: "materialization_record",
        targetId: "mat_job_job_audio_2",
      },
    }));
  });
});
