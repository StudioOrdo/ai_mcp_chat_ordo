import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listUserJobSnapshotsMock,
  getUserJobSnapshotMock,
  findJobByIdMock,
  listEventsForUserJobMock,
  listUserWorkflowsMock,
} = vi.hoisted(() => ({
  listUserJobSnapshotsMock: vi.fn(),
  getUserJobSnapshotMock: vi.fn(),
  findJobByIdMock: vi.fn(),
  listEventsForUserJobMock: vi.fn(),
  listUserWorkflowsMock: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobStatusQuery: () => ({
    listUserJobSnapshots: listUserJobSnapshotsMock,
    getUserJobSnapshot: getUserJobSnapshotMock,
  }),
  getJobQueueRepository: () => ({
    findJobById: findJobByIdMock,
    listEventsForUserJob: listEventsForUserJobMock,
  }),
  getMediaWorkflowReadModel: () => ({
    listUserWorkflows: listUserWorkflowsMock,
  }),
}));

import { loadUserJobsWorkspace } from "@/lib/jobs/load-user-jobs-workspace";

function makeSnapshot(jobId: string, status: "queued" | "running" | "succeeded" | "failed" | "canceled", updatedAt: string) {
  return {
    jobId,
    conversationId: "conv_jobs",
    userId: "usr_1",
    toolName: "produce_blog_article",
    label: "Produce Blog Article",
    status,
    sequence: 0,
    createdAt: updatedAt,
    startedAt: null,
    completedAt: null,
    updatedAt,
    summary: `${jobId} summary`,
    origin: { fallback: "job_created_at" },
    inputSnapshot: {},
    resultEnvelope: null,
    artifactRefs: [],
    materializationRefs: [],
    ownership: { userId: "usr_1", visibility: "owner", initiatorType: "user" },
    failure: {
      failureClass: null,
      recoveryMode: null,
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
  };
}

function makeJobRecord(jobId: string) {
  return {
    id: jobId,
    conversationId: "conv_jobs",
    userId: "usr_1",
    toolName: "produce_blog_article",
    status: "running" as const,
    priority: 100,
    dedupeKey: null,
    initiatorType: "user" as const,
    requestPayload: { brief: "Launch Plan" },
    resultPayload: null,
    errorMessage: null,
    progressPercent: 50,
    progressLabel: "Drafting",
    attemptCount: 1,
    leaseExpiresAt: null,
    claimedBy: null,
    createdAt: "2026-03-30T10:00:00.000Z",
    startedAt: "2026-03-30T10:00:01.000Z",
    completedAt: null,
    updatedAt: "2026-03-30T10:00:02.000Z",
  };
}

describe("loadUserJobsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUserWorkflowsMock.mockResolvedValue([]);
  });

  it("defaults to the first active job and loads durable history", async () => {
    listUserJobSnapshotsMock.mockResolvedValue([
      makeSnapshot("job_done", "succeeded", "2026-03-30T08:00:00.000Z"),
      makeSnapshot("job_active", "running", "2026-03-30T09:00:00.000Z"),
    ]);
    getUserJobSnapshotMock.mockResolvedValue(null);
    findJobByIdMock.mockResolvedValue(makeJobRecord("job_active"));
    listEventsForUserJobMock.mockResolvedValue([
      {
        id: "evt_1",
        jobId: "job_active",
        conversationId: "conv_jobs",
        sequence: 1,
        eventType: "progress",
        payload: { progressPercent: 50, progressLabel: "Drafting" },
        createdAt: "2026-03-30T10:00:02.000Z",
      },
    ]);

    const result = await loadUserJobsWorkspace("usr_1");

    expect(result.selectedJobId).toBe("job_active");
    expect(result.jobs[0].jobId).toBe("job_active");
    expect(listEventsForUserJobMock).toHaveBeenCalledWith("usr_1", "job_active", { limit: 50 });
    expect(result.selectedJobHistory).toHaveLength(1);
  });

  it("keeps a requested deep-linked job selected even when it is outside the initial list", async () => {
    listUserJobSnapshotsMock.mockResolvedValue([
      makeSnapshot("job_active", "running", "2026-03-30T09:00:00.000Z"),
    ]);
    getUserJobSnapshotMock.mockResolvedValue(
      makeSnapshot("job_old", "failed", "2026-03-29T09:00:00.000Z"),
    );
    findJobByIdMock.mockResolvedValue(makeJobRecord("job_old"));
    listEventsForUserJobMock.mockResolvedValue([]);

    const result = await loadUserJobsWorkspace("usr_1", "job_old");

    expect(result.selectedJobId).toBe("job_old");
    expect(result.selectedJob?.jobId).toBe("job_old");
    expect(result.jobs.map((job) => job.jobId)).toContain("job_old");
  });
});
