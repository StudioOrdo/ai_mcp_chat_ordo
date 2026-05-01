import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJobStatusQuery } from "@/lib/jobs/job-status-query";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import { getGlobalJobOperatorRoles } from "@/lib/jobs/job-capability-registry";
import {
  createGetDeferredJobStatusTool,
  createListDeferredJobsTool,
} from "@/core/use-cases/tools/deferred-job-status.tool";

describe("deferred job status tools", () => {
  const findJobByIdMock = vi.fn();
  const findLatestEventForJobMock = vi.fn();
  const listJobsByConversationMock = vi.fn();

  const repository: JobQueueRepository = {
    createJob: vi.fn(),
    findJobById: findJobByIdMock,
    findLatestEventForJob: findLatestEventForJobMock,
    findLatestRenderableEventForJob: findLatestEventForJobMock,
    findActiveJobByDedupeKey: vi.fn(),
    listJobsByConversation: listJobsByConversationMock,
    listJobsByUser: vi.fn(),
    appendEvent: vi.fn(),
    requeueExpiredRunningJobs: vi.fn(),
    listConversationEvents: vi.fn(),
    listUserEvents: vi.fn(),
    listEventsForUserJob: vi.fn(),
    claimNextQueuedJob: vi.fn(),
    transferJobsToUser: vi.fn(),
    updateJobStatus: vi.fn(),
    cancelJob: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a normalized status snapshot by job id", async () => {
    findJobByIdMock.mockResolvedValue({
      id: "job_1",
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "produce_blog_article",
      status: "succeeded",
      priority: 100,
      dedupeKey: null,
      initiatorType: "user",
      requestPayload: { brief: "Write a post" },
      resultPayload: { id: "post_1", slug: "launch-plan", imageAssetId: "asset_1" },
      errorMessage: null,
      progressPercent: 100,
      progressLabel: "Done",
      attemptCount: 1,
      leaseExpiresAt: null,
      claimedBy: null,
      createdAt: "2026-03-25T03:00:00.000Z",
      startedAt: "2026-03-25T03:01:00.000Z",
      completedAt: "2026-03-25T03:02:00.000Z",
      updatedAt: "2026-03-25T03:02:00.000Z",
    });
    findLatestEventForJobMock.mockResolvedValue(null);

    const tool = createGetDeferredJobStatusTool(createJobStatusQuery(repository));
  expect(tool.roles).toEqual(getGlobalJobOperatorRoles());
    const result = await tool.command.execute({ job_id: "job_1" });

    expect(result.job).toMatchObject({
      jobId: "job_1",
      toolName: "produce_blog_article",
      status: "succeeded",
    });
  });

  it("describes admin status tools as explicit inspection instead of wait-loop polling", () => {
    const query = createJobStatusQuery(repository);
    const getTool = createGetDeferredJobStatusTool(query);
    const listTool = createListDeferredJobsTool(query);

    for (const tool of [getTool, listTool]) {
      expect(tool.schema.description).toContain("explicit inspection or diagnostics");
      expect(tool.schema.description).toContain("active chat waits through job events and reconciliation");
      expect(tool.schema.description).toContain("Do not repeatedly call status tools for unchanged jobId/status/sequence");
    }
  });

  it("lists active jobs for the current conversation by default", async () => {
    listJobsByConversationMock.mockResolvedValue([
      {
        id: "job_1",
        conversationId: "conv_jobs",
        userId: "usr_test",
        toolName: "draft_content",
        status: "queued",
        priority: 100,
        dedupeKey: null,
        initiatorType: "user",
        requestPayload: { title: "Queued" },
        resultPayload: null,
        errorMessage: null,
        progressPercent: null,
        progressLabel: null,
        attemptCount: 0,
        leaseExpiresAt: null,
        claimedBy: null,
        createdAt: "2026-03-25T03:00:00.000Z",
        startedAt: null,
        completedAt: null,
        updatedAt: "2026-03-25T03:00:00.000Z",
      },
    ]);
    findLatestEventForJobMock.mockResolvedValue(null);

    const tool = createListDeferredJobsTool(createJobStatusQuery(repository));
  expect(tool.roles).toEqual(getGlobalJobOperatorRoles());
    const result = await tool.command.execute({}, { userId: "usr_test", role: "ADMIN", conversationId: "conv_jobs" });

    expect(listJobsByConversationMock).toHaveBeenCalledWith("conv_jobs", {
      statuses: ["queued", "running"],
      limit: 10,
    });
    expect(result.jobs).toHaveLength(1);
  });
});