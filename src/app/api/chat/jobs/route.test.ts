import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "@/core/use-cases/ConversationInteractor";
import { GET, POST } from "@/app/api/chat/jobs/route";
import {
  buildComposeMediaMaterializationKey,
  buildGenerateAudioMaterializationKey,
} from "@/lib/jobs/materialization-key";
import { normalizeMediaCompositionPlan } from "@/lib/media/ffmpeg/media-composition-plan";
import {
  createAuthenticatedSessionUser,
  createRouteRequest,
} from "../../../../../tests/helpers/workflow-route-fixture";

function buildCanonicalSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    jobId: "job_1",
    conversationId: "conv_existing",
    userId: "usr_owner",
    toolName: "produce_blog_article",
    label: "Produce Blog Article",
    title: "Launch plan",
    status: "running",
    sequence: 3,
    progressPercent: 42,
    progressLabel: "Reviewing article",
    createdAt: "2026-03-25T03:00:00.000Z",
    startedAt: "2026-03-25T03:00:01.000Z",
    completedAt: null,
    updatedAt: "2026-03-25T03:00:07.000Z",
    origin: { fallback: "job_created_at" },
    inputSnapshot: { brief: "Launch plan" },
    resultEnvelope: {
      schemaVersion: 1,
      toolName: "produce_blog_article",
      family: "editorial",
      cardKind: "editorial_workflow",
      executionMode: "deferred",
      inputSnapshot: { brief: "Launch plan" },
      summary: { title: "Launch plan" },
      progress: {
        percent: 42,
        label: "Reviewing article",
        phases: [
          { key: "qa_blog_article", label: "Reviewing article", status: "active", percent: 60 },
        ],
        activePhaseKey: "qa_blog_article",
      },
      payload: null,
    },
    artifactRefs: [],
    materializationRefs: [],
    ownership: { userId: "usr_owner", visibility: "owner", initiatorType: "user" },
    failure: {
      failureClass: null,
      recoveryMode: null,
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
    ...overrides,
  };
}

const {
  appendEventMock,
  appendRuntimeAuditLogMock,
  createJobMock,
  findActiveJobByDedupeKeyMock,
  findLatestRenderableEventForJobMock,
  findMaterializationByIdMock,
  findReusableSuccessMock,
  getSessionUserMock,
  listConversationJobInteractionsMock,
  listConversationWorkflowsMock,
  getConversationMock,
  getActiveForUserMock,
  getJobSnapshotMock,
  listMaterializationsByConversationMock,
  recordPromptBindingFromSourceMock,
  upsertMaterializationMock,
} = vi.hoisted(() => ({
  appendEventMock: vi.fn(),
  appendRuntimeAuditLogMock: vi.fn(async () => undefined),
  createJobMock: vi.fn(),
  findActiveJobByDedupeKeyMock: vi.fn(),
  findLatestRenderableEventForJobMock: vi.fn(),
  findMaterializationByIdMock: vi.fn(),
  findReusableSuccessMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  listConversationJobInteractionsMock: vi.fn(),
  listConversationWorkflowsMock: vi.fn(),
  getConversationMock: vi.fn(),
  getActiveForUserMock: vi.fn(),
  getJobSnapshotMock: vi.fn(),
  listMaterializationsByConversationMock: vi.fn(),
  recordPromptBindingFromSourceMock: vi.fn(async () => null),
  upsertMaterializationMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/observability/runtime-audit-log", () => ({
  appendRuntimeAuditLog: appendRuntimeAuditLogMock,
}));

vi.mock("@/lib/prompts/prompt-binding-service", () => ({
  recordPromptBindingFromSource: recordPromptBindingFromSourceMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobQueueRepository: () => ({
    appendEvent: appendEventMock,
    createJob: createJobMock,
    findActiveJobByDedupeKey: findActiveJobByDedupeKeyMock,
    findLatestRenderableEventForJob: findLatestRenderableEventForJobMock,
  }),
  getJobStatusQuery: () => ({
    getJobSnapshot: getJobSnapshotMock,
  }),
  getMaterializationRepository: () => ({
    findById: findMaterializationByIdMock,
    findReusableSuccess: findReusableSuccessMock,
    listByConversation: listMaterializationsByConversationMock,
    upsert: upsertMaterializationMock,
  }),
  getPlatformInteractionFacade: () => ({
    listConversationJobInteractions: listConversationJobInteractionsMock,
  }),
  getMediaWorkflowReadModel: () => ({
    listConversationWorkflows: listConversationWorkflowsMock,
  }),
}));

vi.mock("@/lib/chat/conversation-root", () => ({
  createConversationRouteServices: () => ({
    interactor: {
      get: getConversationMock,
      getActiveForUser: getActiveForUserMock,
    },
  }),
}));

describe("GET /api/chat/jobs", () => {
  const basePlan = {
    id: "plan_media_1",
    conversationId: "conv_existing",
    visualClips: [{ assetId: "asset_visual_1", kind: "video" as const }],
    audioClips: [],
    subtitlePolicy: "none" as const,
    waveformPolicy: "none" as const,
    outputFormat: "mp4" as const,
  };
  const normalizedBasePlan = normalizeMediaCompositionPlan(basePlan, "conv_existing");
  if (!normalizedBasePlan) {
    throw new Error("base compose media plan fixture must normalize");
  }

  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    getConversationMock.mockResolvedValue({ conversation: { id: "conv_existing" } });
    findActiveJobByDedupeKeyMock.mockResolvedValue(null);
    findLatestRenderableEventForJobMock.mockResolvedValue(null);
    findMaterializationByIdMock.mockResolvedValue(null);
    findReusableSuccessMock.mockResolvedValue(null);
    getJobSnapshotMock.mockResolvedValue(null);
    listMaterializationsByConversationMock.mockResolvedValue([]);
    listConversationWorkflowsMock.mockResolvedValue([]);
    upsertMaterializationMock.mockImplementation(async (value) => value);
    recordPromptBindingFromSourceMock.mockClear();
    createJobMock.mockResolvedValue({
      id: "job_media_1",
      conversationId: "conv_existing",
      userId: "usr_owner",
      toolName: "compose_media",
      status: "queued",
      priority: 5,
      dedupeKey: buildComposeMediaMaterializationKey(normalizedBasePlan),
      initiatorType: "user",
      requestPayload: {
        plan: {
          id: "plan_media_1",
          conversationId: "conv_existing",
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
    });
    appendEventMock.mockResolvedValue({
      id: "evt_media_1",
      jobId: "job_media_1",
      conversationId: "conv_existing",
      sequence: 1,
      eventType: "queued",
      payload: { toolName: "compose_media" },
      createdAt: "2026-04-13T12:00:00.000Z",
    });
  });

  it("returns an empty snapshot when the requested conversation does not exist", async () => {
    getConversationMock.mockRejectedValue(new NotFoundError("Conversation not found"));
    listConversationJobInteractionsMock.mockResolvedValue([]);

    const response = await GET(createRouteRequest("/api/chat/jobs?conversationId=conv_missing"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.jobs).toEqual([]);
    expect(listConversationJobInteractionsMock).toHaveBeenCalledWith("conv_missing", {
      statuses: undefined,
      limit: 25,
    });
  });

  it("returns job snapshots for an existing requested conversation", async () => {
    getConversationMock.mockResolvedValue({ conversation: { id: "conv_existing" } });
    listConversationJobInteractionsMock.mockResolvedValue([
      {
        snapshot: buildCanonicalSnapshot(),
      },
    ]);

    const response = await GET(createRouteRequest("/api/chat/jobs?conversationId=conv_existing&limit=12"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getConversationMock).toHaveBeenCalledWith("conv_existing", "usr_owner");
    expect(listConversationJobInteractionsMock).toHaveBeenCalledWith("conv_existing", {
      statuses: undefined,
      limit: 12,
    });
    expect(payload.interactions).toBeUndefined();
    expect(payload.workflows).toEqual([]);
    expect(payload.jobs[0]).toMatchObject({
      jobId: "job_1",
      status: "running",
      progressLabel: "Reviewing article",
      resultEnvelope: expect.anything(),
    });
  });

  it("enqueues a compose_media deferred job through the shared route surface", async () => {
    const response = await POST(createRouteRequest(
      "/api/chat/jobs",
      "POST",
      {
        toolName: "compose_media",
        conversationId: "conv_existing",
        plan: basePlan,
        promptBindingId: "pb_root_1",
      },
      { "Content-Type": "application/json" },
    ));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(findActiveJobByDedupeKeyMock).toHaveBeenCalledWith(
      "conv_existing",
      buildComposeMediaMaterializationKey(normalizedBasePlan),
    );
    expect(createJobMock).toHaveBeenCalledTimes(1);
    expect(createJobMock).toHaveBeenCalledWith(expect.objectContaining({
      requestPayload: expect.objectContaining({
        promptBindingId: "pb_root_1",
      }),
    }));
    expect(appendEventMock).toHaveBeenCalledTimes(1);
    expect(appendRuntimeAuditLogMock).toHaveBeenCalledWith(
      "deferred_job",
      "enqueued",
      expect.objectContaining({
        jobId: "job_media_1",
        planId: "plan_media_1",
        deduplicated: false,
      }),
    );
    expect(payload).toMatchObject({
      ok: true,
      jobId: "job_media_1",
      deduplicated: false,
      job: {
        jobId: "job_media_1",
        toolName: "compose_media",
        status: "queued",
        origin: expect.objectContaining({ fallback: "job_created_at" }),
        resultEnvelope: expect.objectContaining({
          executionMode: "deferred",
          family: "artifact",
        }),
      },
    });
    expect(recordPromptBindingFromSourceMock).toHaveBeenCalledWith(expect.objectContaining({
      sourcePromptBindingId: "pb_root_1",
      surface: "job_execution",
      target: {
        targetKind: "job",
        targetId: "job_media_1",
      },
    }));
  });

  it("enqueues a generate_audio deferred job through the shared route surface", async () => {
    const audioInput = {
      title: "Founder memo",
      text: "This is the founder memo for the weekly review.",
    };
    createJobMock.mockResolvedValueOnce({
      id: "job_audio_1",
      conversationId: "conv_existing",
      userId: "usr_owner",
      toolName: "generate_audio",
      status: "queued",
      priority: 5,
      dedupeKey: buildGenerateAudioMaterializationKey(audioInput),
      initiatorType: "user",
      requestPayload: {
        ...audioInput,
        materializationKey: buildGenerateAudioMaterializationKey(audioInput),
        executionTarget: "deferred_remote",
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
    });
    appendEventMock.mockResolvedValueOnce({
      id: "evt_audio_1",
      jobId: "job_audio_1",
      conversationId: "conv_existing",
      sequence: 1,
      eventType: "queued",
      payload: { toolName: "generate_audio" },
      createdAt: "2026-04-13T12:00:00.000Z",
    });

    const response = await POST(createRouteRequest(
      "/api/chat/jobs",
      "POST",
      {
        toolName: "generate_audio",
        conversationId: "conv_existing",
        input: audioInput,
      },
      { "Content-Type": "application/json" },
    ));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(findActiveJobByDedupeKeyMock).toHaveBeenCalledWith(
      "conv_existing",
      buildGenerateAudioMaterializationKey(audioInput),
    );
    expect(createJobMock).toHaveBeenCalledWith(expect.objectContaining({
      toolName: "generate_audio",
      requestPayload: expect.objectContaining({
        title: "Founder memo",
        text: "This is the founder memo for the weekly review.",
        materializationKey: buildGenerateAudioMaterializationKey(audioInput),
        executionTarget: "deferred_remote",
      }),
    }));
    expect(payload).toMatchObject({
      ok: true,
      jobId: "job_audio_1",
      exactReuse: false,
      job: {
        jobId: "job_audio_1",
        toolName: "generate_audio",
        status: "queued",
        resultEnvelope: expect.objectContaining({
          executionMode: "deferred",
          family: "artifact",
        }),
      },
    });
  });

  it("returns the existing compose_media job when the route deduplicates an active plan", async () => {
    findActiveJobByDedupeKeyMock.mockResolvedValue({
      id: "job_media_existing",
      conversationId: "conv_existing",
      userId: "usr_owner",
      toolName: "compose_media",
      status: "queued",
      priority: 5,
      dedupeKey: "compose_media:plan_media_1",
      initiatorType: "user",
      requestPayload: {
        plan: {
          id: "plan_media_1",
          conversationId: "conv_existing",
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
    });
    findLatestRenderableEventForJobMock.mockResolvedValue({
      id: "evt_media_existing",
      jobId: "job_media_existing",
      conversationId: "conv_existing",
      sequence: 3,
      eventType: "queued",
      payload: { toolName: "compose_media" },
      createdAt: "2026-04-13T12:00:00.000Z",
    });

    const response = await POST(createRouteRequest(
      "/api/chat/jobs",
      "POST",
      {
        toolName: "compose_media",
        conversationId: "conv_existing",
        plan: basePlan,
      },
      { "Content-Type": "application/json" },
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(createJobMock).not.toHaveBeenCalled();
    expect(appendEventMock).not.toHaveBeenCalled();
    expect(appendRuntimeAuditLogMock).toHaveBeenCalledWith(
      "deferred_job",
      "enqueue_deduplicated",
      expect.objectContaining({
        jobId: "job_media_existing",
        planId: "plan_media_1",
        deduplicated: true,
      }),
    );
    expect(payload).toMatchObject({
      ok: true,
      jobId: "job_media_existing",
      deduplicated: true,
      exactReuse: false,
      job: {
        jobId: "job_media_existing",
        toolName: "compose_media",
        status: "queued",
        origin: expect.objectContaining({ fallback: "job_created_at" }),
        resultEnvelope: expect.objectContaining({
          executionMode: "deferred",
          family: "artifact",
        }),
      },
    });
  });

  it("returns a succeeded snapshot when an exact compose_media reuse is available", async () => {
    findReusableSuccessMock.mockResolvedValue({
      id: "mat_reuse_1",
      userId: "usr_owner",
      conversationId: "conv_existing",
      materializationKey: "compose_media:key",
      toolName: "compose_media",
      pipelineVersion: "compose_media:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [],
      outputRefs: [{ kind: "asset", id: "asset_out_1", userId: "usr_owner", conversationId: "conv_existing" }],
      evidenceRefs: [],
      producedByJobId: "job_completed_1",
      supersededByRecordId: null,
      createdAt: "2026-04-13T12:00:00.000Z",
      updatedAt: "2026-04-13T12:00:00.000Z",
    });
    getJobSnapshotMock.mockResolvedValue({
      ...buildCanonicalSnapshot({
        jobId: "job_completed_1",
        conversationId: "conv_existing",
        toolName: "compose_media",
        label: "Compose Media",
        title: "Media Composition",
        status: "succeeded",
        sequence: 4,
        progressPercent: 100,
        progressLabel: "Completed",
        createdAt: "2026-04-13T12:00:00.000Z",
        startedAt: "2026-04-13T12:00:01.000Z",
        completedAt: "2026-04-13T12:00:02.000Z",
        updatedAt: "2026-04-13T12:00:02.000Z",
        inputSnapshot: {},
        resultEnvelope: {
          schemaVersion: 1,
          toolName: "compose_media",
          family: "media",
          cardKind: "media_output",
          executionMode: "deferred",
          inputSnapshot: {},
          summary: { title: "Media Composition" },
          payload: { primaryAssetId: "asset_out_1" },
        },
        materializationRefs: ["mat_reuse_1"],
      }),
    });

    const response = await POST(createRouteRequest(
      "/api/chat/jobs",
      "POST",
      {
        toolName: "compose_media",
        conversationId: "conv_existing",
        plan: basePlan,
        promptBindingId: "pb_root_1",
      },
      { "Content-Type": "application/json" },
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(createJobMock).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      ok: true,
      exactReuse: true,
      deduplicated: false,
      jobId: "job_completed_1",
      materialization: {
        id: "mat_reuse_1",
        producedByJobId: "job_completed_1",
      },
      job: {
        jobId: "job_completed_1",
        status: "succeeded",
        materializationRefs: ["mat_reuse_1"],
      },
    });
    expect(recordPromptBindingFromSourceMock).toHaveBeenCalledWith(expect.objectContaining({
      sourcePromptBindingId: "pb_root_1",
      surface: "materialization_decision",
      target: {
        targetKind: "materialization_record",
        targetId: "mat_reuse_1",
      },
    }));
  });

  it("aliases exact reuse into the requesting conversation when the reusable output originated elsewhere", async () => {
    findReusableSuccessMock.mockResolvedValue({
      id: "mat_reuse_source",
      userId: "usr_owner",
      conversationId: "conv_source",
      materializationKey: "compose_media:key",
      toolName: "compose_media",
      pipelineVersion: "compose_media:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [],
      outputRefs: [{ kind: "asset", id: "asset_out_1", userId: "usr_owner", conversationId: "conv_source" }],
      evidenceRefs: [],
      producedByJobId: "job_completed_1",
      supersededByRecordId: null,
      createdAt: "2026-04-13T12:00:00.000Z",
      updatedAt: "2026-04-13T12:00:00.000Z",
    });
    upsertMaterializationMock.mockImplementation(async (value) => ({
      ...value,
      id: "mat_reuse_conv_existing_alias",
    }));
    getJobSnapshotMock.mockResolvedValue({
      ...buildCanonicalSnapshot({
        jobId: "job_completed_1",
        conversationId: "conv_source",
        toolName: "compose_media",
        label: "Compose Media",
        title: "Media Composition",
        status: "succeeded",
        sequence: 4,
        progressPercent: 100,
        progressLabel: "Completed",
        createdAt: "2026-04-13T12:00:00.000Z",
        startedAt: "2026-04-13T12:00:01.000Z",
        completedAt: "2026-04-13T12:00:02.000Z",
        updatedAt: "2026-04-13T12:00:02.000Z",
        inputSnapshot: {},
        resultEnvelope: {
          schemaVersion: 1,
          toolName: "compose_media",
          family: "media",
          cardKind: "media_output",
          executionMode: "deferred",
          inputSnapshot: {},
          summary: { title: "Media Composition" },
          payload: { primaryAssetId: "asset_out_1" },
        },
        materializationRefs: ["mat_reuse_source"],
      }),
    });

    const response = await POST(createRouteRequest(
      "/api/chat/jobs",
      "POST",
      {
        toolName: "compose_media",
        conversationId: "conv_existing",
        plan: basePlan,
      },
      { "Content-Type": "application/json" },
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(upsertMaterializationMock).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "conv_existing",
      producedByJobId: "job_completed_1",
      outputRefs: [{ kind: "asset", id: "asset_out_1", userId: "usr_owner", conversationId: "conv_source" }],
    }));
    expect(payload.materialization).toMatchObject({
      id: "mat_reuse_conv_existing_alias",
      conversationId: "conv_existing",
      producedByJobId: "job_completed_1",
    });
  });

  it("returns 400 when compose_media includes non-canonical visual asset references", async () => {
    const response = await POST(createRouteRequest(
      "/api/chat/jobs",
      "POST",
      {
        toolName: "compose_media",
        conversationId: "conv_existing",
        plan: {
          id: "plan_media_invalid_asset",
          conversationId: "conv_existing",
          visualClips: [{ assetId: "generate:a plate of cheese", kind: "image" }],
          audioClips: [{ assetId: "uf_audio_1", kind: "audio" }],
          subtitlePolicy: "none",
          waveformPolicy: "none",
          outputFormat: "mp4",
        },
      },
      { "Content-Type": "application/json" },
    ));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: expect.stringMatching(/Invalid visual clip assetId at index 0/),
    });
    expect(findActiveJobByDedupeKeyMock).not.toHaveBeenCalled();
    expect(createJobMock).not.toHaveBeenCalled();
    expect(appendEventMock).not.toHaveBeenCalled();
  });
});
