import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJobStatusQuery } from "@/lib/jobs/job-status-query";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import { getSignedInJobAudienceRoles } from "@/lib/jobs/job-capability-registry";

import {
  createGetMyJobStatusTool,
  createListMyJobsTool,
} from "@/core/use-cases/tools/deferred-job-status.tool";

describe("job status summary tools", () => {
  const findLatestEventForJobMock = vi.fn();
  const listJobsByUserMock = vi.fn();

  const repository: JobQueueRepository = {
    createJob: vi.fn(),
    findJobById: vi.fn(),
    findLatestEventForJob: findLatestEventForJobMock,
    findLatestRenderableEventForJob: findLatestEventForJobMock,
    findActiveJobByDedupeKey: vi.fn(),
    listJobsByConversation: vi.fn(),
    listJobsByUser: listJobsByUserMock,
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

  it("lists active jobs for the signed-in user by default", async () => {
    listJobsByUserMock.mockResolvedValue([
      {
        id: "job_1",
        conversationId: "conv_jobs",
        userId: "usr_member",
        toolName: "produce_blog_article",
        status: "running",
        priority: 100,
        dedupeKey: null,
        initiatorType: "user",
        requestPayload: { brief: "AI Governance Playbook" },
        resultPayload: null,
        errorMessage: null,
        progressPercent: 42,
        progressLabel: "Reviewing article",
        attemptCount: 1,
        leaseExpiresAt: null,
        claimedBy: "worker_1",
        createdAt: "2026-03-25T03:00:00.000Z",
        startedAt: "2026-03-25T03:00:01.000Z",
        completedAt: null,
        updatedAt: "2026-03-25T03:00:07.000Z",
      },
    ]);
    findLatestEventForJobMock.mockResolvedValue({
      id: "evt_1",
      jobId: "job_1",
      conversationId: "conv_jobs",
      sequence: 8,
      eventType: "progress",
      payload: { progressPercent: 42, progressLabel: "Reviewing article" },
      createdAt: "2026-03-25T03:00:07.000Z",
    });

    const tool = createListMyJobsTool(createJobStatusQuery(repository));
  expect(tool.roles).toEqual(getSignedInJobAudienceRoles());
    const result = await tool.command.execute({}, { role: "AUTHENTICATED", userId: "usr_member" });

    expect(listJobsByUserMock).toHaveBeenCalledWith("usr_member", {
      statuses: ["queued", "running"],
      limit: 10,
    });
    expect(result.summary).toContain("active jobs");
    expect(result.jobs[0].part).toMatchObject({
      jobId: "job_1",
      status: "running",
      progressLabel: "Reviewing article",
    });
  });

  it("includes recent terminal jobs only when explicitly requested", async () => {
    listJobsByUserMock.mockResolvedValue([]);

    const tool = createListMyJobsTool(createJobStatusQuery(repository));
  expect(tool.roles).toEqual(getSignedInJobAudienceRoles());
    const result = await tool.command.execute({ active_only: false, limit: 25 }, { role: "STAFF", userId: "usr_staff" });

    expect(listJobsByUserMock).toHaveBeenCalledWith("usr_staff", {
      statuses: undefined,
      limit: 25,
    });
    expect(result.summary).toContain("recent terminal");
  });

  it("returns one signed-in user's job by id", async () => {
    listJobsByUserMock.mockResolvedValue([
      {
        id: "job_9",
        conversationId: "conv_jobs",
        userId: "usr_member",
        toolName: "draft_content",
        status: "queued",
        priority: 100,
        dedupeKey: null,
        initiatorType: "user",
        requestPayload: { title: "Deferred Queue Post" },
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

    const tool = createGetMyJobStatusTool(createJobStatusQuery(repository));
  expect(tool.roles).toEqual(getSignedInJobAudienceRoles());
    const result = await tool.command.execute({ job_id: "job_9" }, { role: "APPRENTICE", userId: "usr_member" });

    expect(listJobsByUserMock).toHaveBeenCalledWith("usr_member", { limit: 100 });
    expect(result.job.part).toMatchObject({
      jobId: "job_9",
      status: "queued",
      toolName: "draft_content",
    });
  });

  it("humanizes journal publish-readiness jobs for operator status reads", async () => {
    listJobsByUserMock.mockResolvedValue([
      {
        id: "job_ready_1",
        conversationId: "conv_jobs",
        userId: "usr_member",
        toolName: "prepare_journal_post_for_publish",
        status: "succeeded",
        priority: 100,
        dedupeKey: null,
        initiatorType: "user",
        requestPayload: { post_id: "post_42" },
        resultPayload: {
          action: "prepare_journal_post_for_publish",
          ready: false,
          summary: '"Launch Plan" is not ready to publish yet. 2 blockers remain.',
          blockers: ["Standfirst is missing.", "Hero image is not selected."],
          revision_count: 1,
          post: {
            id: "post_42",
            title: "Launch Plan",
            detail_route: "/admin/journal/post_42",
            preview_route: "/admin/journal/preview/launch-plan",
          },
        },
        errorMessage: null,
        progressPercent: 100,
        progressLabel: "Ready check complete",
        attemptCount: 1,
        leaseExpiresAt: null,
        claimedBy: null,
        createdAt: "2026-03-25T03:00:00.000Z",
        startedAt: "2026-03-25T03:00:01.000Z",
        completedAt: "2026-03-25T03:00:10.000Z",
        updatedAt: "2026-03-25T03:00:10.000Z",
      },
    ]);
    findLatestEventForJobMock.mockResolvedValue(null);

    const tool = createGetMyJobStatusTool(createJobStatusQuery(repository));
  expect(tool.roles).toEqual(getSignedInJobAudienceRoles());
    const result = await tool.command.execute({ job_id: "job_ready_1" }, { role: "ADMIN", userId: "usr_member" });

    expect(result.job.part).toMatchObject({
      toolName: "prepare_journal_post_for_publish",
      title: "Journal publish readiness for post_42",
      subtitle: "Check whether a journal post is ready to publish and summarize blockers, active work, and QA findings.",
      summary: '"Launch Plan" is not ready to publish yet. 2 blockers remain.',
    });
  });

  it("rejects anonymous callers", async () => {
    const tool = createListMyJobsTool(createJobStatusQuery(repository));
    expect(tool.roles).toEqual(getSignedInJobAudienceRoles());

    await expect(tool.command.execute({}, { role: "ANONYMOUS", userId: "anon_1" })).rejects.toThrow(
      "Sign in is required to inspect your jobs.",
    );
  });
});