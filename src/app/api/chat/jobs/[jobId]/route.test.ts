import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/chat/jobs/[jobId]/route";
import { createRouteParams, createRouteRequest } from "@/__test-utils__";

const {
  findJobByIdMock,
  findLatestRenderableEventForJobMock,
  cancelJobMock,
  appendEventMock,
  createJobMock,
  findActiveJobByDedupeKeyMock,
  updateJobStatusMock,
  getJobInteractionMock,
  getConversationMock,
  resolveUserIdMock,
  reviseExecutionMock,
  findWorkflowByStepJobIdMock,
  listAvailableActionsMock,
  findWorkflowByIdMock,
  buildWorkflowSnapshotMock,
  dispatchOperationActionMock,
} = vi.hoisted(() => ({
  findJobByIdMock: vi.fn(),
  findLatestRenderableEventForJobMock: vi.fn(),
  cancelJobMock: vi.fn(),
  appendEventMock: vi.fn(),
  createJobMock: vi.fn(),
  findActiveJobByDedupeKeyMock: vi.fn(),
  updateJobStatusMock: vi.fn(),
  getJobInteractionMock: vi.fn(),

  getConversationMock: vi.fn(),
  resolveUserIdMock: vi.fn(),
  reviseExecutionMock: vi.fn(),
  findWorkflowByStepJobIdMock: vi.fn(),
  listAvailableActionsMock: vi.fn(),
  findWorkflowByIdMock: vi.fn(),
  buildWorkflowSnapshotMock: vi.fn(),
  dispatchOperationActionMock: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getJobQueueRepository: () => ({
        findJobById: findJobByIdMock,
        findLatestRenderableEventForJob: findLatestRenderableEventForJobMock,
        cancelJob: cancelJobMock,
        appendEvent: appendEventMock,
        createJob: createJobMock,
        findActiveJobByDedupeKey: findActiveJobByDedupeKeyMock,
        updateJobStatus: updateJobStatusMock,
      }),
      getPlatformInteractionFacade: () => ({
        getJobInteraction: getJobInteractionMock,
      }),
      getMediaWorkflowRepository: () => ({
        findWorkflowByStepJobId: findWorkflowByStepJobIdMock,
        findWorkflowById: findWorkflowByIdMock,
      }),
      getOperationRepository: () => ({
        listAvailableActions: listAvailableActionsMock,
      }),
      getMediaWorkflowReadModel: () => ({
        buildSnapshot: buildWorkflowSnapshotMock,
      }),
    })
  };
});

vi.mock("@/lib/operations/operation-action-dispatch-root", () => ({
  createOperationActionDispatchService: () => ({
    dispatch: dispatchOperationActionMock,
  }),
}));

vi.mock("@/lib/platform/agent-platform-facade-root", () => ({
  getAgentPlatformFacade: () => ({
    reviseExecution: reviseExecutionMock,
  }),
}));

vi.mock("@/lib/chat/resolve-user", () => ({
  resolveUserId: resolveUserIdMock,
}));



vi.mock("@/lib/chat/conversation-root", () => ({
  createConversationRouteServices: () => ({
    interactor: { get: getConversationMock },
  }),
}));

describe("/api/chat/jobs/[jobId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserIdMock.mockResolvedValue({ userId: "usr_owner" });
    getConversationMock.mockResolvedValue({ conversation: { id: "conv_jobs" }, messages: [] });
    findWorkflowByStepJobIdMock.mockReturnValue(null);
    listAvailableActionsMock.mockResolvedValue([]);
    findWorkflowByIdMock.mockReturnValue(null);
    buildWorkflowSnapshotMock.mockResolvedValue(null);
  });

  it("returns the job snapshot when the conversation is accessible", async () => {
    getJobInteractionMock.mockResolvedValue({
      job: {
        id: "job_1",
        conversationId: "conv_jobs",
      },
      snapshot: {
        jobId: "job_1",
        conversationId: "conv_jobs",
        toolName: "publish_content",
        status: "running",
        part: {
          jobId: "job_1",
          status: "running",
        },
      },
      timeline: { executionId: "job_1" },
      revision: {
        executionId: "job_1",
        executionKind: "job",
        supportLevel: "reduced",
        state: "active",
        title: "Publish Content",
        actions: [{ key: "cancel", label: "Cancel", operation: "cancel", transportKind: "job", value: "job_1", available: true }],
        checkpoints: [],
      },
    });

    const response = await GET(createRouteRequest("/api/chat/jobs/job_1"), createRouteParams({ jobId: "job_1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getConversationMock).toHaveBeenCalledWith("conv_jobs", "usr_owner");
    expect(body.job).toMatchObject({ jobId: "job_1", status: "running" });
    expect(body.revision).toMatchObject({ executionId: "job_1", supportLevel: "reduced", state: "active" });
  });

  it("cancels a running chat job using the canonical canceled payload shape", async () => {
    getJobInteractionMock.mockResolvedValue({
      job: {
        id: "job_running",
        conversationId: "conv_jobs",
      },
    });
    reviseExecutionMock.mockResolvedValue({
      payload: {
        job: { id: "job_running", status: "canceled" },
        eventSequence: 12,
      },
    });

    const response = await POST(createRouteRequest("/api/chat/jobs/job_running", "POST", { action: "cancel" }), createRouteParams({ jobId: "job_running" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getConversationMock).toHaveBeenCalledWith("conv_jobs", "usr_owner");
    expect(reviseExecutionMock).toHaveBeenCalledWith(expect.objectContaining({
      executionKind: "job",
      executionId: "job_running",
      action: "cancel",
      userId: "usr_owner",
    }));
    expect(body).toMatchObject({
      ok: true,
      action: "cancel",
      eventSequence: 12,
    });
  });

  it("replays a failed chat job through the shared executor", async () => {
    getJobInteractionMock.mockResolvedValue({
      job: {
        id: "job_failed",
        conversationId: "conv_jobs",
      },
    });
    reviseExecutionMock.mockResolvedValue({
      payload: {
        deduped: false,
        replay: {
          outcome: "queued",
          sourceJobId: "job_failed",
          targetJobId: "job_retry",
          dedupeKey: "conv_jobs:publish_content",
        },
        job: {
          id: "job_retry",
          conversationId: "conv_jobs",
          userId: "usr_owner",
          toolName: "publish_content",
          status: "queued",
          recoveryMode: "rerun",
          replayedFromJobId: "job_failed",
        },
        eventSequence: 12,
      },
    });

    const response = await POST(createRouteRequest("/api/chat/jobs/job_failed", "POST", { action: "retry" }), createRouteParams({ jobId: "job_failed" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(reviseExecutionMock).toHaveBeenCalledWith(expect.objectContaining({
      executionKind: "job",
      executionId: "job_failed",
      action: "retry",
      userId: "usr_owner",
    }));
    expect(body).toMatchObject({
      ok: true,
      action: "retry",
      deduped: false,
      replay: {
        outcome: "queued",
        sourceJobId: "job_failed",
        targetJobId: "job_retry",
      },
      eventSequence: 12,
    });
  });

  it("routes media workflow job actions through the operation dispatcher", async () => {
    getJobInteractionMock.mockResolvedValue({
      job: {
        id: "job_media_1",
        conversationId: "conv_jobs",
      },
    });
    findWorkflowByStepJobIdMock.mockReturnValue({
      workflow: {
        id: "workflow_media_1",
        request: {
          operation: {
            operationId: "op_media_1",
          },
        },
      },
    });
    listAvailableActionsMock.mockResolvedValue([
      {
        id: "action_cancel_1",
        operationId: "op_media_1",
        operationRevision: 3,
        actionType: "media.workflow.cancel",
        label: "Cancel workflow",
        riskLevel: "low",
        confirmPolicy: "single_click",
        requiredRole: "AUTHENTICATED",
        payload: {
          workflowId: "workflow_media_1",
          reason: "user_cancelled",
        },
        idempotencyKey: "idem_cancel_1",
        enabled: true,
      },
    ]);
    dispatchOperationActionMock.mockResolvedValue({
      snapshot: {
        operation: {
          id: "op_media_1",
          status: "cancelled",
        },
      },
      availableActions: [],
    });
    findWorkflowByIdMock.mockReturnValue({ workflow: { id: "workflow_media_1" } });
    buildWorkflowSnapshotMock.mockResolvedValue({
      workflow: {
        id: "workflow_media_1",
        status: "canceled",
      },
    });

    const response = await POST(
      createRouteRequest("/api/chat/jobs/job_media_1", "POST", { action: "cancel" }),
      createRouteParams({ jobId: "job_media_1" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(reviseExecutionMock).not.toHaveBeenCalled();
    expect(dispatchOperationActionMock).toHaveBeenCalledWith(expect.objectContaining({
      operationId: "op_media_1",
      actionId: "action_cancel_1",
      idempotencyKey: "idem_cancel_1",
      clientOperationRevision: 3,
      actorUserId: "usr_owner",
      confirmation: { confirmed: true },
    }));
    expect(body).toMatchObject({
      ok: true,
      action: "cancel",
      operation: {
        id: "op_media_1",
        status: "cancelled",
      },
      workflow: {
        workflow: {
          id: "workflow_media_1",
          status: "canceled",
        },
      },
    });
  });
});
