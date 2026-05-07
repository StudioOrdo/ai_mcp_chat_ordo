import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "@/core/use-cases/ConversationInteractor";
import { GET, POST } from "@/app/api/chat/jobs/route";
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
  createOperationMock,
  replaceActionsMock,
  findWorkflowByOperationIdMock,
  buildWorkflowSnapshotMock,
  dispatchOperationActionMock,
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
  createOperationMock: vi.fn(),
  replaceActionsMock: vi.fn(),
  findWorkflowByOperationIdMock: vi.fn(),
  buildWorkflowSnapshotMock: vi.fn(),
  dispatchOperationActionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
  resolveSessionAuthorizationRole: (user: { roles: string[]; realRoles?: string[] }) =>
    [...(user.realRoles ?? []), ...user.roles].includes("ADMIN") ? "ADMIN" : user.roles[0],
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
    buildSnapshot: buildWorkflowSnapshotMock,
  }),
  getOperationRepository: () => ({
    createOperation: createOperationMock,
    replaceActions: replaceActionsMock,
  }),
  getMediaWorkflowRepository: () => ({
    findWorkflowByOperationId: findWorkflowByOperationIdMock,
  }),
}));

vi.mock("@/lib/operations/operation-action-dispatch-root", () => ({
  createOperationActionDispatchService: () => ({
    dispatch: dispatchOperationActionMock,
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
    findWorkflowByOperationIdMock.mockReturnValue({ workflow: { id: "workflow_media_1" } });
    buildWorkflowSnapshotMock.mockResolvedValue({
      workflow: {
        id: "workflow_media_1",
        status: "queued",
      },
      linkedJobIds: ["job_media_1"],
      linkedJobs: [
        {
          jobId: "job_media_1",
          toolName: "compose_media",
          status: "queued",
          resultEnvelope: {
            executionMode: "deferred",
            family: "media",
          },
        },
      ],
      finalArtifact: null,
    });
    dispatchOperationActionMock.mockResolvedValue({
      snapshot: {
        operation: {
          id: "op_media_test",
          kind: "media_workflow",
          status: "running",
        },
      },
      availableActions: [],
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

  it("creates and dispatches a media workflow operation for compose_media requests", async () => {
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
    expect(createOperationMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: "media_workflow",
      title: "Compose media",
      conversationId: "conv_existing",
      createdByUserId: "usr_owner",
      input: expect.objectContaining({
        request: expect.objectContaining({
          toolName: "compose_media",
          promptBindingId: "pb_root_1",
        }),
      }),
    }));
    expect(replaceActionsMock).toHaveBeenCalledWith(expect.objectContaining({
      operationId: expect.stringMatching(/^op_media_/),
      actions: [
        expect.objectContaining({
          actionType: "media.workflow.create",
          payload: expect.objectContaining({
            template: "compose_media",
            requestedDeliverable: "video",
            compose: { plan: basePlan },
          }),
        }),
      ],
    }));
    expect(dispatchOperationActionMock).toHaveBeenCalledWith(expect.objectContaining({
      operationId: expect.stringMatching(/^op_media_/),
      actorUserId: "usr_owner",
      actorRole: "AUTHENTICATED",
      confirmation: { confirmed: true },
      payload: expect.objectContaining({
        template: "compose_media",
      }),
    }));
    expect(findActiveJobByDedupeKeyMock).not.toHaveBeenCalled();
    expect(createJobMock).not.toHaveBeenCalled();
    expect(appendEventMock).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      ok: true,
      operation: {
        kind: "media_workflow",
        status: "running",
      },
      jobId: "job_media_1",
      deduplicated: false,
      job: {
        jobId: "job_media_1",
        toolName: "compose_media",
        status: "queued",
        resultEnvelope: expect.objectContaining({
          executionMode: "deferred",
          family: "media",
        }),
      },
    });
    expect(recordPromptBindingFromSourceMock).not.toHaveBeenCalled();
  });

  it("creates and dispatches a media workflow operation for generate_audio requests", async () => {
    const audioInput = {
      title: "Founder memo",
      text: "This is the founder memo for the weekly review.",
    };
    buildWorkflowSnapshotMock.mockResolvedValueOnce({
      workflow: {
        id: "workflow_audio_1",
        status: "queued",
      },
      linkedJobIds: ["job_audio_1"],
      linkedJobs: [
        {
          jobId: "job_audio_1",
          toolName: "generate_audio",
          status: "queued",
          resultEnvelope: {
            executionMode: "deferred",
            family: "media",
          },
        },
      ],
      finalArtifact: null,
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
    expect(createOperationMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: "media_workflow",
      title: "Generate audio",
      conversationId: "conv_existing",
    }));
    expect(replaceActionsMock).toHaveBeenCalledWith(expect.objectContaining({
      actions: [
        expect.objectContaining({
          actionType: "media.workflow.create",
          payload: expect.objectContaining({
            template: "generated_audio",
            requestedDeliverable: "audio",
            audio: audioInput,
          }),
        }),
      ],
    }));
    expect(dispatchOperationActionMock).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        template: "generated_audio",
        audio: audioInput,
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
          family: "media",
        }),
      },
    });
  });

  it("returns an operation snapshot even when the media workflow has no linked job yet", async () => {
    findWorkflowByOperationIdMock.mockReturnValue(null);
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

    expect(response.status).toBe(201);
    expect(dispatchOperationActionMock).toHaveBeenCalledOnce();
    expect(payload).toMatchObject({
      ok: true,
      jobId: null,
      job: null,
      workflow: null,
      deduplicated: false,
    });
  });

  it("returns 400 when media workflow operation validation fails", async () => {
    dispatchOperationActionMock.mockRejectedValueOnce(
      new Error("Invalid visual clip assetId at index 0: must reference a saved media asset"),
    );

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
