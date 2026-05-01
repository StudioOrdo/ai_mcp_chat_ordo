import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JobEvent, JobRequest } from "@/core/entities/job";
import type { MaterializationRecord } from "@/core/entities/materialization";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";

const { appendRuntimeAuditLogMock } = vi.hoisted(() => ({
  appendRuntimeAuditLogMock: vi.fn(async () => undefined),
}));
const { recordPromptBindingFromSourceMock } = vi.hoisted(() => ({
  recordPromptBindingFromSourceMock: vi.fn(async () => null),
}));

vi.mock("@/lib/observability/runtime-audit-log", () => ({
  appendRuntimeAuditLog: appendRuntimeAuditLogMock,
}));
vi.mock("@/lib/prompts/prompt-binding-service", () => ({
  recordPromptBindingFromSource: recordPromptBindingFromSourceMock,
}));

import {
  enqueueComposeMediaDeferredJob,
  InvalidComposeMediaDeferredJobError,
} from "./compose-media-deferred-job";
import { buildComposeMediaMaterializationKey } from "./materialization-key";
import { normalizeMediaCompositionPlan } from "@/lib/media/ffmpeg/media-composition-plan";

function createJobRequest(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_media_1",
    conversationId: "conv_media_1",
    userId: "user_1",
    toolName: "compose_media",
    status: "queued",
    priority: 5,
    dedupeKey: "compose_media:plan_media_1",
    initiatorType: "user",
    requestPayload: {
      plan: {
        id: "plan_media_1",
        conversationId: "conv_media_1",
        visualClips: [{ assetId: "asset_visual_1", kind: "video" }],
        audioClips: [],
        subtitlePolicy: "none",
        waveformPolicy: "none",
        outputFormat: "mp4",
      },
    },
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 0,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: "rerun",
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-04-13T12:00:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-04-13T12:00:00.000Z",
    ...overrides,
  };
}

function createJobEvent(overrides: Partial<JobEvent> = {}): JobEvent {
  return {
    id: "evt_media_1",
    jobId: "job_media_1",
    conversationId: "conv_media_1",
    sequence: 1,
    eventType: "queued",
    payload: { toolName: "compose_media" },
    createdAt: "2026-04-13T12:00:00.000Z",
    ...overrides,
  };
}

function createRepositoryMock(overrides: Partial<JobQueueRepository> = {}): JobQueueRepository {
  return {
    createJob: vi.fn(async () => createJobRequest()),
    findJobById: vi.fn(async () => null),
    findLatestEventForJob: vi.fn(async () => null),
    findLatestRenderableEventForJob: vi.fn(async () => null),
    findActiveJobByDedupeKey: vi.fn(async () => null),
    listJobsByConversation: vi.fn(async () => []),
    listJobsByUser: vi.fn(async () => []),
    appendEvent: vi.fn(async () => createJobEvent()),
    requeueExpiredRunningJobs: vi.fn(async () => []),
    listConversationEvents: vi.fn(async () => []),
    listUserEvents: vi.fn(async () => []),
    listEventsForUserJob: vi.fn(async () => []),
    claimNextQueuedJob: vi.fn(async () => null),
    transferJobsToUser: vi.fn(async () => []),
    updateJobStatus: vi.fn(async () => { throw new Error("unused"); }),
    cancelJob: vi.fn(async () => { throw new Error("unused"); }),
    ...overrides,
  } as unknown as JobQueueRepository;
}

describe("compose-media-deferred-job", () => {
  beforeEach(() => {
    appendRuntimeAuditLogMock.mockClear();
    recordPromptBindingFromSourceMock.mockClear();
  });

  const basePlan = {
    id: "plan_media_1",
    conversationId: "conv_media_1",
    visualClips: [{ assetId: "asset_visual_1", kind: "video" as const }],
    audioClips: [],
    subtitlePolicy: "none" as const,
    waveformPolicy: "none" as const,
    outputFormat: "mp4" as const,
  };
  const normalizedBasePlan = normalizeMediaCompositionPlan(basePlan, "conv_media_1");
  if (!normalizedBasePlan) {
    throw new Error("base compose media plan fixture must normalize");
  }

  function createReusableMaterialization(
    overrides: Partial<MaterializationRecord> = {},
  ): MaterializationRecord {
    return {
      id: "mat_1",
      userId: "user_1",
      conversationId: "conv_media_1",
      materializationKey: buildComposeMediaMaterializationKey(normalizedBasePlan!),
      toolName: "compose_media",
      pipelineVersion: "compose_media:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [],
      outputRefs: [{
        kind: "asset",
        id: "asset_out_1",
        userId: "user_1",
        conversationId: "conv_media_1",
      }],
      evidenceRefs: [],
      producedByJobId: "job_completed_1",
      supersededByRecordId: null,
      createdAt: "2026-04-13T12:00:00.000Z",
      updatedAt: "2026-04-13T12:00:00.000Z",
      ...overrides,
    };
  }

  it("creates a queued compose_media deferred job payload with a renderable event", async () => {
    const repository = createRepositoryMock();

    const result = await enqueueComposeMediaDeferredJob({
      repository,
      conversationId: "conv_media_1",
      userId: "user_1",
      plan: basePlan,
    });

    expect(repository.findActiveJobByDedupeKey).toHaveBeenCalledWith(
      "conv_media_1",
      buildComposeMediaMaterializationKey(normalizedBasePlan),
    );
    expect(repository.createJob).toHaveBeenCalledTimes(1);
    expect(repository.appendEvent).toHaveBeenCalledTimes(1);
    const createJobSeed = vi.mocked(repository.createJob).mock.calls[0]?.[0];
    const createdPlan = normalizeMediaCompositionPlan(createJobSeed?.requestPayload.plan, "conv_media_1");
    if (!createdPlan) {
      throw new Error("created compose media plan fixture must normalize");
    }
    expect(createJobSeed?.requestPayload.materializationKey).toBe(
      buildComposeMediaMaterializationKey(createdPlan),
    );
    expect(createJobSeed?.requestPayload.executionTarget).toBe("deferred_remote");
    expect(appendRuntimeAuditLogMock).toHaveBeenCalledWith(
      "deferred_job",
      "enqueued",
      expect.objectContaining({
        jobId: "job_media_1",
        planId: "plan_media_1",
        dedupeKey: buildComposeMediaMaterializationKey(normalizedBasePlan),
        deduplicated: false,
        status: "queued",
      }),
    );
    expect(result.deduplicated).toBe(false);
    expect(result.outcome).toBe("queued");
    expect(result.materialization).toBeNull();
    expect(result.payload).toMatchObject({
      deferred_job: {
        jobId: "job_media_1",
        toolName: "compose_media",
        status: "queued",
        lifecyclePhase: "compose_queued_deferred",
        resultEnvelope: expect.objectContaining({
          toolName: "compose_media",
          executionMode: "deferred",
        }),
      },
    });
  });

  it("accepts chart source assets for server materialization before still-image composition", async () => {
    const repository = createRepositoryMock();

    const result = await enqueueComposeMediaDeferredJob({
      repository,
      conversationId: "conv_media_1",
      userId: "user_1",
      plan: {
        id: "plan_chart_media_1",
        conversationId: "conv_media_1",
        visualClips: [{ assetId: "chart_blooms_ai", kind: "chart" }],
        audioClips: [{ assetId: "uf_audio_1", kind: "audio" }],
        profile: "still_image_narration_fast",
        subtitlePolicy: "none",
        waveformPolicy: "none",
        outputFormat: "mp4",
        resolution: { width: 1024, height: 1536 },
      },
    });

    expect(result.outcome).toBe("queued");
    const createJobSeed = vi.mocked(repository.createJob).mock.calls[0]?.[0];
    expect(createJobSeed?.requestPayload.plan).toMatchObject({
      visualClips: [{ assetId: "chart_blooms_ai", kind: "chart" }],
      audioClips: [{ assetId: "uf_audio_1", kind: "audio" }],
    });
  });

  it("reuses an existing active compose_media job and returns a deduplicated deferred payload", async () => {
    const existingJob = createJobRequest({
      id: "job_media_existing",
      status: "running",
      progressPercent: 42,
      progressLabel: "Uploading composition artifact",
      attemptCount: 1,
      startedAt: "2026-04-13T12:00:01.000Z",
      updatedAt: "2026-04-13T12:00:10.000Z",
    });
    const repository = createRepositoryMock({
      findActiveJobByDedupeKey: vi.fn(async () => existingJob),
      findLatestRenderableEventForJob: vi.fn(async () => createJobEvent({
        id: "evt_media_existing",
        jobId: "job_media_existing",
        sequence: 4,
        eventType: "progress",
        payload: {
          progressPercent: 42,
          progressLabel: "Uploading composition artifact",
        },
        createdAt: "2026-04-13T12:00:10.000Z",
      })),
    });

    const result = await enqueueComposeMediaDeferredJob({
      repository,
      conversationId: "conv_media_1",
      userId: "user_1",
      plan: basePlan,
    });

    expect(repository.createJob).not.toHaveBeenCalled();
    expect(repository.appendEvent).not.toHaveBeenCalled();
    expect(appendRuntimeAuditLogMock).toHaveBeenCalledWith(
      "deferred_job",
      "enqueue_deduplicated",
      expect.objectContaining({
        jobId: "job_media_existing",
        planId: "plan_media_1",
        deduplicated: true,
        status: "running",
      }),
    );
    expect(result.deduplicated).toBe(true);
    expect(result.outcome).toBe("active_equivalent");
    expect(result.payload).toMatchObject({
      deferred_job: {
        jobId: "job_media_existing",
        toolName: "compose_media",
        status: "running",
        lifecyclePhase: "compose_running_deferred",
        deduped: true,
      },
    });
  });

  it("treats semantically equivalent plans with different ids as the same active job", async () => {
    const activeJob = createJobRequest({
      id: "job_media_existing",
      status: "running",
      dedupeKey: buildComposeMediaMaterializationKey(normalizedBasePlan),
    });
    const repository = createRepositoryMock({
      findActiveJobByDedupeKey: vi.fn(async () => activeJob),
      findLatestRenderableEventForJob: vi.fn(async () => createJobEvent({
        id: "evt_media_existing",
        jobId: "job_media_existing",
        eventType: "progress",
      })),
    });

    const result = await enqueueComposeMediaDeferredJob({
      repository,
      conversationId: "conv_media_1",
      userId: "user_1",
      plan: {
        ...basePlan,
        id: "plan_media_2",
      },
    });

    expect(repository.findActiveJobByDedupeKey).toHaveBeenCalledWith(
      "conv_media_1",
      buildComposeMediaMaterializationKey(normalizedBasePlan),
    );
    expect(repository.createJob).not.toHaveBeenCalled();
    expect(result.outcome).toBe("active_equivalent");
    expect(result.job?.id).toBe("job_media_existing");
  });

  it("returns exact reuse when a reusable materialization already exists", async () => {
    const repository = createRepositoryMock();
    const materializationRepository: MaterializationRepository = {
      findById: vi.fn(async () => null),
      findByMaterializationKey: vi.fn(async () => null),
      findReusableSuccess: vi.fn(async () => createReusableMaterialization({
        materializationKey: buildComposeMediaMaterializationKey({
          id: "plan_media_1",
          conversationId: "conv_media_1",
          visualClips: [{ assetId: "asset_visual_1", kind: "video" }],
          audioClips: [],
          subtitlePolicy: "none",
          waveformPolicy: "none",
          outputFormat: "mp4",
        }),
      })),
      upsert: vi.fn(async () => { throw new Error("unused"); }),
      markSuperseded: vi.fn(async () => null),
      listByConversation: vi.fn(async () => []),
      findLatestByOutputRef: vi.fn(async () => null),
    };

    const result = await enqueueComposeMediaDeferredJob({
      repository,
      materializationRepository,
      conversationId: "conv_media_1",
      userId: "user_1",
      plan: basePlan,
    });

    expect(repository.createJob).not.toHaveBeenCalled();
    expect(result.outcome).toBe("exact_reuse");
    expect(result.deduplicated).toBe(false);
    expect(result.job).toBeNull();
    expect(result.payload).toBeNull();
    expect(result.materialization?.producedByJobId).toBe("job_completed_1");
    expect(appendRuntimeAuditLogMock).toHaveBeenCalledWith(
      "deferred_job",
      "materialization_reused",
      expect.objectContaining({
        materializationId: "mat_1",
        producedByJobId: "job_completed_1",
      }),
    );
    expect(recordPromptBindingFromSourceMock).not.toHaveBeenCalled();
  });

  it("records a materialization_decision binding when exact reuse is chosen from a source prompt binding", async () => {
    const repository = createRepositoryMock();
    const materializationRepository: MaterializationRepository = {
      findById: vi.fn(async () => null),
      findByMaterializationKey: vi.fn(async () => null),
      findReusableSuccess: vi.fn(async () => createReusableMaterialization()),
      upsert: vi.fn(async () => { throw new Error("unused"); }),
      markSuperseded: vi.fn(async () => null),
      listByConversation: vi.fn(async () => []),
      findLatestByOutputRef: vi.fn(async () => null),
    };

    await enqueueComposeMediaDeferredJob({
      repository,
      materializationRepository,
      conversationId: "conv_media_1",
      userId: "user_1",
      plan: basePlan,
      promptBindingId: "pb_root_1",
    });

    expect(recordPromptBindingFromSourceMock).toHaveBeenCalledWith(expect.objectContaining({
      sourcePromptBindingId: "pb_root_1",
      surface: "materialization_decision",
      target: {
        targetKind: "materialization_record",
        targetId: "mat_1",
      },
    }));
  });

  it("rejects invalid compose_media plans before touching the queue", async () => {
    const repository = createRepositoryMock();

    await expect(
      enqueueComposeMediaDeferredJob({
        repository,
        conversationId: "conv_media_1",
        userId: "user_1",
        plan: {},
      }),
    ).rejects.toBeInstanceOf(InvalidComposeMediaDeferredJobError);

    expect(repository.findActiveJobByDedupeKey).not.toHaveBeenCalled();
    expect(repository.createJob).not.toHaveBeenCalled();
    expect(appendRuntimeAuditLogMock).not.toHaveBeenCalled();
  });
});
