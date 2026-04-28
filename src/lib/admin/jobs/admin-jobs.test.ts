import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  countForAdminMock,
  countByStatusMock,
  countByToolNameMock,
  listForAdminMock,
  findJobByIdMock,
  listEventsForJobMock,
  getJobInteractionMock,
  notFoundMock,
} = vi.hoisted(() => ({
  countForAdminMock: vi.fn(),
  countByStatusMock: vi.fn(),
  countByToolNameMock: vi.fn(),
  listForAdminMock: vi.fn(),
  findJobByIdMock: vi.fn(),
  listEventsForJobMock: vi.fn(),
  getJobInteractionMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobQueueDataMapper: () => ({
    countForAdmin: countForAdminMock,
    countByStatus: countByStatusMock,
    countByToolName: countByToolNameMock,
    listForAdmin: listForAdminMock,
    findJobById: findJobByIdMock,
    listEventsForJob: listEventsForJobMock,
  }),
  getPlatformInteractionFacade: () => ({
    getJobInteraction: getJobInteractionMock,
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

import {
  loadAdminJobDetail,
  loadAdminJobList,
  parseAdminJobFilters,
} from "@/lib/admin/jobs/admin-jobs";

function makeInteraction(jobId: string, state = "running") {
  return {
    timeline: {
      executionId: jobId,
      executionKind: "job",
      supportLevel: "full",
      state,
      title: "Job interaction",
      summary: `Timeline summary for ${jobId}`,
      events: [{ id: `${jobId}_evt_1` }, { id: `${jobId}_evt_2` }],
      artifacts: [],
      checkpoints: [],
      nextActions: [{ key: "retry", label: "Retry", kind: "job", value: jobId, available: true }],
    },
    revision: {
      executionId: jobId,
      executionKind: "job",
      supportLevel: "reduced",
      state: state === "failed" ? "recoverable" : "active",
      title: "Job revision",
      summary: `Revision summary for ${jobId}`,
      actions: [{ key: "retry", label: "Retry", operation: "retry", transportKind: "job", value: jobId, available: true }],
      checkpoints: [],
    },
  };
}

describe("admin jobs loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getJobInteractionMock.mockImplementation(async (jobId: string) => makeInteraction(jobId));
  });

  it("parses status and tool filters from raw search params", () => {
    expect(parseAdminJobFilters({ status: "running", family: "editorial", toolName: "produce_blog_article" })).toEqual({
      status: "running",
      family: "editorial",
      toolName: "produce_blog_article",
    });
  });

  it("falls back to the all-status filter for invalid values", () => {
    expect(parseAdminJobFilters({ status: "not-a-status", toolName: ["publish_content"] })).toEqual({
      status: "all",
      family: "all",
      toolName: "publish_content",
    });
  });

  it("returns a mapped list view model from the raw admin queue data", async () => {
    countForAdminMock.mockResolvedValue(2);
    countByStatusMock.mockResolvedValue({ queued: 1, running: 1 });
    countByToolNameMock.mockResolvedValue({ produce_blog_article: 2 });
    listForAdminMock.mockResolvedValue([
      {
        id: "job_1",
        toolName: "produce_blog_article",
        status: "queued",
        priority: 100,
        userId: "usr_1",
        progressPercent: null,
        progressLabel: null,
        attemptCount: 1,
        createdAt: "2026-03-31T08:00:00.000Z",
        startedAt: null,
        completedAt: null,
        conversationId: "conv_1",
      },
      {
        id: "job_2",
        toolName: "produce_blog_article",
        status: "running",
        priority: 100,
        userId: "usr_2",
        progressPercent: 55,
        progressLabel: "Drafting",
        attemptCount: 2,
        createdAt: "2026-03-31T09:00:00.000Z",
        startedAt: "2026-03-31T09:01:00.000Z",
        completedAt: null,
        conversationId: "conv_2",
      },
    ]);

    const result = await loadAdminJobList(
      { status: "running", family: "editorial", toolName: "produce_blog_article" },
      ["ADMIN"],
      { limit: 50, offset: 50 },
    );

    expect(countForAdminMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "running",
      toolName: "produce_blog_article",
      toolNames: expect.arrayContaining(["produce_blog_article", "publish_content"]),
    }));
    expect(countByStatusMock).toHaveBeenCalledWith(expect.objectContaining({
      toolName: "produce_blog_article",
      toolNames: expect.arrayContaining(["produce_blog_article", "publish_content"]),
    }));
    expect(countByToolNameMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "running",
      toolNames: expect.arrayContaining(["produce_blog_article", "publish_content"]),
    }));
    expect(listForAdminMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "running",
      toolName: "produce_blog_article",
      limit: 50,
      offset: 50,
      toolNames: expect.arrayContaining(["produce_blog_article", "publish_content"]),
    }));
    expect(result.total).toBe(2);
    expect(result.filters).toEqual({
      status: "running",
      family: "editorial",
      toolName: "produce_blog_article",
    });
    expect(result.statusCounts).toEqual({ queued: 1, running: 1 });
    expect(result.toolNameCounts).toEqual({ produce_blog_article: 2 });
    expect(result.familyCounts).toEqual(expect.objectContaining({ editorial: 2, media: 0 }));
    expect(result.familyOptions).toEqual(expect.arrayContaining([
      { value: "editorial", label: "Editorial", count: 2 },
      { value: "media", label: "Media", count: 0 },
    ]));
    expect(result.toolOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        value: "produce_blog_article",
        label: "Produce Blog Article",
        family: "editorial",
      }),
    ]));
    expect(result.toolOptions.some((option) => option.value === "compose_media")).toBe(false);
    expect(result.jobs[0]).toMatchObject({
      id: "job_1",
      toolName: "produce_blog_article",
      toolLabel: "Produce Blog Article",
      toolFamily: "editorial",
      executionPrincipal: "system_worker",
      canManage: true,
      canCancel: true,
      canRequeue: true,
      canRetry: false,
      interactionExecutionState: "running",
      interactionTimelineSupportLevel: "full",
      interactionRevisionSupportLevel: "reduced",
      detailHref: "/admin/jobs/job_1",
    });
    expect(result.jobs[1]).toMatchObject({
      duration: "running",
      canCancel: true,
      canRetry: false,
    });
  });

  it("fails closed when the mapper returns an unregistered tool", async () => {
    countForAdminMock.mockResolvedValue(1);
    countByStatusMock.mockResolvedValue({ running: 1 });
    countByToolNameMock.mockResolvedValue({ legacy_hidden_tool: 1 });
    listForAdminMock.mockResolvedValue([
      {
        id: "job_hidden",
        toolName: "legacy_hidden_tool",
        status: "running",
        priority: 100,
        userId: "usr_1",
        progressPercent: 10,
        progressLabel: "Hidden",
        attemptCount: 1,
        createdAt: "2026-03-31T10:00:00.000Z",
        startedAt: "2026-03-31T10:01:00.000Z",
        completedAt: null,
        conversationId: "conv_hidden",
      },
    ]);

    const result = await loadAdminJobList({}, ["ADMIN"]);

    expect(result.jobs).toEqual([]);
    expect(result.toolOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "produce_blog_article" }),
    ]));
  });

  it("returns detail and event timeline data for an existing job", async () => {
    findJobByIdMock.mockResolvedValue({
      id: "job_9",
      toolName: "publish_content",
      status: "failed",
      priority: 80,
      userId: "usr_editor",
      progressPercent: null,
      progressLabel: null,
      attemptCount: 3,
      createdAt: "2026-03-31T07:00:00.000Z",
      startedAt: "2026-03-31T07:01:00.000Z",
      completedAt: "2026-03-31T07:02:30.000Z",
      conversationId: "conv_publish",
      requestPayload: { post_id: "post_1" },
      resultPayload: null,
      errorMessage: "Publish target missing.",
      dedupeKey: "post_1_publish",
      initiatorType: "user",
      claimedBy: "worker_1",
      leaseExpiresAt: null,
      failureClass: "transient",
      nextRetryAt: null,
      recoveryMode: "rerun",
    });
    listEventsForJobMock.mockResolvedValue([
      {
        id: "evt_1",
        eventType: "failed",
        payload: { error: "Publish target missing." },
        createdAt: "2026-03-31T07:02:30.000Z",
      },
    ]);
    getJobInteractionMock.mockResolvedValue(makeInteraction("job_9", "failed"));

    const result = await loadAdminJobDetail("job_9");

    expect(findJobByIdMock).toHaveBeenCalledWith("job_9");
    expect(listEventsForJobMock).toHaveBeenCalledWith("job_9");
    expect(result.job).toMatchObject({
      id: "job_9",
      toolName: "publish_content",
      toolLabel: "Publish Content",
      toolFamily: "editorial",
      errorMessage: "Publish target missing.",
      failureClass: "transient",
      nextRetryAt: null,
      recoveryMode: "rerun",
      detailHref: "/admin/jobs/job_9",
    });
    expect(result.policy).toEqual({
      canManage: true,
      canCancel: false,
      canRequeue: false,
      canRetry: true,
      retryMode: "automatic",
      maxAttempts: 3,
      backoffStrategy: "fixed",
      baseDelayMs: 3000,
      retryExhausted: true,
    });
    expect(result.capabilityPolicy).toEqual({
      description: "Publish an editorial draft and align any linked hero assets for public visibility.",
      executionPrincipal: "system_worker",
      executionAllowedRoles: ["ADMIN"],
      globalViewerRoles: ["ADMIN"],
      globalActionRoles: ["ADMIN"],
      resultRetention: "retain",
      artifactPolicy: "open_artifact",
    });
    expect(result.interaction.timeline).toEqual(expect.objectContaining({
      executionId: "job_9",
      state: "failed",
      supportLevel: "full",
    }));
    expect(result.interaction.revision).toEqual(expect.objectContaining({
      executionId: "job_9",
      state: "recoverable",
      supportLevel: "reduced",
    }));
    expect(result.events).toEqual([
      {
        id: "evt_1",
        eventType: "failed",
        eventPayload: { error: "Publish target missing." },
        createdAt: "2026-03-31T07:02:30.000Z",
      },
    ]);
  });

  it("calls notFound for a missing job", async () => {
    findJobByIdMock.mockResolvedValue(null);

    await expect(loadAdminJobDetail("job_missing")).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("calls notFound for an unregistered job capability", async () => {
    findJobByIdMock.mockResolvedValue({
      id: "job_hidden",
      toolName: "legacy_hidden_tool",
      status: "running",
      priority: 80,
      userId: "usr_editor",
      progressPercent: null,
      progressLabel: null,
      attemptCount: 1,
      createdAt: "2026-03-31T07:00:00.000Z",
      startedAt: null,
      completedAt: null,
      conversationId: "conv_hidden",
      requestPayload: {},
      resultPayload: null,
      errorMessage: null,
      dedupeKey: null,
      initiatorType: "user",
      claimedBy: null,
      leaseExpiresAt: null,
      failureClass: null,
      nextRetryAt: null,
      recoveryMode: null,
    });

    await expect(loadAdminJobDetail("job_hidden")).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalled();
  });
});