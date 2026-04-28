import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN_USER = {
  id: "admin_1",
  email: "admin@example.com",
  name: "Admin",
  roles: ["ADMIN"],
};

const {
  runAdminActionMock,
  revalidatePathMock,
  cancelJobMock,
  findJobByIdMock,
  createJobMock,
  appendEventMock,
  findActiveJobByDedupeKeyMock,
  updateJobStatusMock,
  getDescriptorMock,
  projectMock,
} = vi.hoisted(() => ({
  runAdminActionMock: vi.fn(async (formData: FormData, handler: (user: typeof ADMIN_USER, formData: FormData) => Promise<unknown>) =>
    handler(ADMIN_USER, formData)),
  revalidatePathMock: vi.fn(),
  cancelJobMock: vi.fn(),
  findJobByIdMock: vi.fn(),
  createJobMock: vi.fn(),
  appendEventMock: vi.fn(),
  findActiveJobByDedupeKeyMock: vi.fn(),
  updateJobStatusMock: vi.fn(),
  getDescriptorMock: vi.fn(),
  projectMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/admin/shared/admin-action-helpers", () => ({
  runAdminAction: runAdminActionMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobQueueDataMapper: () => ({
    cancelJob: cancelJobMock,
    findJobById: findJobByIdMock,
    createJob: createJobMock,
    appendEvent: appendEventMock,
    findActiveJobByDedupeKey: findActiveJobByDedupeKeyMock,
    updateJobStatus: updateJobStatusMock,
  }),
}));

vi.mock("@/lib/chat/tool-composition-root", () => ({
  getToolComposition: () => ({
    registry: { getDescriptor: getDescriptorMock },
    executor: vi.fn(),
  }),
}));

vi.mock("@/lib/jobs/deferred-job-projector-root", () => ({
  createDeferredJobConversationProjector: () => ({
    project: projectMock,
  }),
}));

import {
  bulkCancelJobsAction,
  bulkRequeueJobsAction,
  bulkRetryJobsAction,
  cancelJobAction,
  requeueJobAction,
  retryJobAction,
} from "@/lib/admin/jobs/admin-jobs-actions";

function makeFormData(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("admin job actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendEventMock.mockResolvedValue({ sequence: 9 });
    findActiveJobByDedupeKeyMock.mockResolvedValue(null);
    updateJobStatusMock.mockResolvedValue({ id: "job_failed" });
    getDescriptorMock.mockReturnValue(undefined);
    projectMock.mockResolvedValue(undefined);
  });

  it("cancels a single job and revalidates the admin jobs page", async () => {
    findJobByIdMock.mockResolvedValue({
      id: "job_1",
      toolName: "produce_blog_article",
      status: "running",
    });
    cancelJobMock.mockResolvedValue({ id: "job_1" });

    await cancelJobAction(makeFormData({ id: "job_1" }));

    expect(runAdminActionMock).toHaveBeenCalled();
    expect(findJobByIdMock).toHaveBeenCalledWith("job_1");
    expect(cancelJobMock).toHaveBeenCalledWith("job_1", expect.any(String));
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/jobs");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/jobs/job_1");
  });

  it("rejects single-job actions for unregistered global job types", async () => {
    findJobByIdMock.mockResolvedValue({
      id: "job_hidden",
      toolName: "legacy_hidden_tool",
      status: "running",
    });

    await expect(cancelJobAction(makeFormData({ id: "job_hidden" }))).rejects.toThrow(
      "Job job_hidden is not globally actionable for this role",
    );

    expect(cancelJobMock).not.toHaveBeenCalled();
  });

  it("retries a failed job by cloning its request payload", async () => {
    findJobByIdMock.mockResolvedValue({
      id: "job_failed",
      conversationId: "conv_1",
      userId: "usr_1",
      toolName: "produce_blog_article",
      status: "failed",
      priority: 100,
      dedupeKey: "brief_1",
      initiatorType: "user",
      requestPayload: { brief: "Roadmap" },
    });
    createJobMock.mockResolvedValue({ id: "job_retry" });

    await retryJobAction(makeFormData({ id: "job_failed" }));

    expect(findJobByIdMock).toHaveBeenCalledWith("job_failed");
    expect(createJobMock).toHaveBeenCalledWith({
      conversationId: "conv_1",
      userId: "usr_1",
      toolName: "produce_blog_article",
      priority: 100,
      dedupeKey: "brief_1",
      initiatorType: "user",
      recoveryMode: "rerun",
      replayedFromJobId: "job_failed",
      requestPayload: { brief: "Roadmap" },
    });
    expect(updateJobStatusMock).toHaveBeenCalledWith("job_failed", {
      status: "failed",
      supersededByJobId: "job_retry",
    });
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "queued",
      payload: expect.objectContaining({ replayedFromJobId: "job_failed" }),
    }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/jobs");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/jobs/job_retry");
  });

  it("rejects retry attempts from non-retriable statuses", async () => {
    findJobByIdMock.mockResolvedValue({
      id: "job_running",
      conversationId: "conv_2",
      userId: "usr_2",
      toolName: "publish_content",
      status: "running",
      priority: 80,
      dedupeKey: null,
      initiatorType: "user",
      requestPayload: { post_id: "post_1" },
    });

    await expect(retryJobAction(makeFormData({ id: "job_running" }))).rejects.toThrow(
      "Job job_running cannot be retried from status: running",
    );
    expect(createJobMock).not.toHaveBeenCalled();
  });

  it("requeues a running job and records an audited intervention", async () => {
    findJobByIdMock.mockResolvedValue({
      id: "job_running",
      conversationId: "conv_2",
      userId: "usr_2",
      toolName: "publish_content",
      status: "running",
      priority: 80,
      dedupeKey: null,
      initiatorType: "user",
      requestPayload: { post_id: "post_1" },
      claimedBy: "worker_1",
    });
    updateJobStatusMock.mockResolvedValue({ id: "job_running", conversationId: "conv_2" });

    await requeueJobAction(makeFormData({ id: "job_running" }));

    expect(updateJobStatusMock).toHaveBeenCalledWith("job_running", {
      status: "queued",
      resultPayload: null,
      errorMessage: null,
      progressPercent: null,
      progressLabel: null,
      startedAt: null,
      completedAt: null,
      leaseExpiresAt: null,
      claimedBy: null,
      failureClass: null,
      nextRetryAt: null,
    });
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "requeued",
      payload: expect.objectContaining({
        previousStatus: "running",
        previousClaimedBy: "worker_1",
        requestedByUserId: "admin_1",
      }),
    }));
    expect(projectMock).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/jobs/job_running");
  });

  it("bulk-cancels only queued and running jobs", async () => {
    findJobByIdMock
      .mockResolvedValueOnce({ id: "job_1", toolName: "produce_blog_article", status: "queued" })
      .mockResolvedValueOnce({ id: "job_2", toolName: "publish_content", status: "running" })
      .mockResolvedValueOnce({ id: "job_3", toolName: "publish_content", status: "succeeded" });

    await bulkCancelJobsAction(makeFormData({ ids: "job_1,job_2,job_3" }));

    expect(cancelJobMock).toHaveBeenCalledTimes(2);
    expect(cancelJobMock).toHaveBeenNthCalledWith(1, "job_1", expect.any(String));
    expect(cancelJobMock).toHaveBeenNthCalledWith(2, "job_2", expect.any(String));
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/jobs");
  });

  it("bulk-retries only failed and canceled jobs", async () => {
    findJobByIdMock
      .mockResolvedValueOnce({
        id: "job_4",
        conversationId: "conv_4",
        userId: "usr_4",
        toolName: "produce_blog_article",
        status: "failed",
        priority: 50,
        dedupeKey: null,
        initiatorType: "user",
        requestPayload: { brief: "One" },
      })
      .mockResolvedValueOnce({
        id: "job_5",
        conversationId: "conv_5",
        userId: "usr_5",
        toolName: "publish_content",
        status: "canceled",
        priority: 40,
        dedupeKey: null,
        initiatorType: "user",
        requestPayload: { post_id: "post_5" },
      })
      .mockResolvedValueOnce({
        id: "job_6",
        conversationId: "conv_6",
        userId: "usr_6",
        toolName: "publish_content",
        status: "running",
        priority: 20,
        dedupeKey: null,
        initiatorType: "user",
        requestPayload: { post_id: "post_6" },
      });

    await bulkRetryJobsAction(makeFormData({ ids: "job_4,job_5,job_6" }));

    expect(createJobMock).toHaveBeenCalledTimes(2);
    expect(createJobMock).toHaveBeenNthCalledWith(1, {
      conversationId: "conv_4",
      userId: "usr_4",
      toolName: "produce_blog_article",
      priority: 50,
      dedupeKey: null,
      initiatorType: "user",
      recoveryMode: "rerun",
      replayedFromJobId: "job_4",
      requestPayload: { brief: "One" },
    });
    expect(createJobMock).toHaveBeenNthCalledWith(2, {
      conversationId: "conv_5",
      userId: "usr_5",
      toolName: "publish_content",
      priority: 40,
      dedupeKey: null,
      initiatorType: "user",
      recoveryMode: "rerun",
      replayedFromJobId: "job_5",
      requestPayload: { post_id: "post_5" },
    });
  });

  it("bulk-requeues only queued and running jobs", async () => {
    findJobByIdMock
      .mockResolvedValueOnce({
        id: "job_1",
        conversationId: "conv_1",
        toolName: "publish_content",
        status: "queued",
        claimedBy: null,
      })
      .mockResolvedValueOnce({
        id: "job_2",
        conversationId: "conv_2",
        toolName: "publish_content",
        status: "running",
        claimedBy: "worker_2",
      })
      .mockResolvedValueOnce({
        id: "job_3",
        conversationId: "conv_3",
        toolName: "publish_content",
        status: "failed",
        claimedBy: null,
      });
    updateJobStatusMock.mockResolvedValue({ id: "job_requeued" });

    await bulkRequeueJobsAction(makeFormData({ ids: "job_1,job_2,job_3" }));

    expect(updateJobStatusMock).toHaveBeenCalledTimes(2);
    expect(appendEventMock).toHaveBeenCalledTimes(2);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/jobs");
  });

  it("rejects bulk actions when a selected job is not globally manageable", async () => {
    findJobByIdMock.mockResolvedValue({
      id: "job_hidden",
      toolName: "legacy_hidden_tool",
      status: "failed",
    });

    await expect(bulkRetryJobsAction(makeFormData({ ids: "job_hidden" }))).rejects.toThrow(
      "Job job_hidden is not globally actionable for this role",
    );

    expect(createJobMock).not.toHaveBeenCalled();
  });
});