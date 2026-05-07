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
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";

function makeSnapshot(jobId: string, status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "dead_letter", updatedAt: string) {
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

function makeWorkflow(overrides: Partial<CanonicalMediaWorkflowSnapshot> = {}): CanonicalMediaWorkflowSnapshot {
  return {
    workflowId: "mwf_1",
    conversationId: "conv_jobs",
    userId: "usr_1",
    title: "Founder short",
    requestedDeliverable: "video",
    status: "running",
    stage: { key: "compose_media", label: "Compose video", progressPercent: 50 },
    steps: [],
    finalArtifact: null,
    failure: { code: null, message: null },
    linkedJobIds: [],
    linkedJobs: [],
    originMessageId: null,
    originTurnId: null,
    createdAt: "2026-03-30T09:00:00.000Z",
    updatedAt: "2026-03-30T09:00:00.000Z",
    completedAt: null,
    ...overrides,
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

  it("paginates active work before newer completed work", async () => {
    listUserJobSnapshotsMock.mockResolvedValue([
      makeSnapshot("job_active", "running", "2026-03-30T09:00:00.000Z"),
    ]);
    listUserWorkflowsMock.mockResolvedValue([
      makeWorkflow({
        workflowId: "mwf_done",
        status: "succeeded",
        updatedAt: "2026-03-30T12:00:00.000Z",
      }),
    ]);
    getUserJobSnapshotMock.mockResolvedValue(null);
    findJobByIdMock.mockResolvedValue(makeJobRecord("job_active"));
    listEventsForUserJobMock.mockResolvedValue([]);

    const result = await loadUserJobsWorkspace("usr_1", { limit: "1" });

    expect(result.jobs.map((job) => job.jobId)).toEqual(["job_active"]);
    expect(result.workflows).toEqual([]);
    expect(result.selectedJobId).toBe("job_active");
  });

  it("paginates running work before newer queued work", async () => {
    listUserJobSnapshotsMock.mockResolvedValue([
      makeSnapshot("job_running", "running", "2026-03-30T09:00:00.000Z"),
      makeSnapshot("job_queued", "queued", "2026-03-30T12:00:00.000Z"),
    ]);
    getUserJobSnapshotMock.mockResolvedValue(null);
    findJobByIdMock.mockResolvedValue(makeJobRecord("job_running"));
    listEventsForUserJobMock.mockResolvedValue([]);

    const result = await loadUserJobsWorkspace("usr_1", { limit: "1" });

    expect(result.jobs.map((job) => job.jobId)).toEqual(["job_running"]);
    expect(result.selectedJobId).toBe("job_running");
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

  it("filters the work index by query, bucket, and source kind", async () => {
    listUserJobSnapshotsMock.mockResolvedValue([
      makeSnapshot("job_audio", "succeeded", "2026-03-30T11:00:00.000Z"),
      makeSnapshot("job_canceled", "canceled", "2026-03-30T10:00:00.000Z"),
      makeSnapshot("job_running", "running", "2026-03-30T09:00:00.000Z"),
    ]);
    listUserWorkflowsMock.mockResolvedValue([
      makeWorkflow({
        workflowId: "mwf_founder_short",
        title: "Founder short campaign",
        status: "running",
        updatedAt: "2026-03-30T12:00:00.000Z",
      }),
    ]);
    getUserJobSnapshotMock.mockResolvedValue(null);
    findJobByIdMock.mockResolvedValue(null);

    const runningJobs = await loadUserJobsWorkspace("usr_1", {
      bucket: "running",
      sourceKind: "job",
      q: "running",
    });

    expect(runningJobs.jobs.map((job) => job.jobId)).toEqual(["job_running"]);
    expect(runningJobs.workflows).toEqual([]);
    expect(runningJobs.pageInfo?.total).toBe(1);

    const workflowResults = await loadUserJobsWorkspace("usr_1", {
      sourceKind: "media_workflow",
      q: "founder",
    });

    expect(workflowResults.jobs).toEqual([]);
    expect(workflowResults.workflows?.map((workflow) => workflow.workflowId)).toEqual(["mwf_founder_short"]);
  });

  it("keeps canceled work out of the running bucket", async () => {
    listUserJobSnapshotsMock.mockResolvedValue([
      makeSnapshot("job_canceled", "canceled", "2026-03-30T10:00:00.000Z"),
      makeSnapshot("job_running", "running", "2026-03-30T09:00:00.000Z"),
    ]);
    getUserJobSnapshotMock.mockResolvedValue(null);
    findJobByIdMock.mockResolvedValue(null);
    listEventsForUserJobMock.mockResolvedValue([]);

    const result = await loadUserJobsWorkspace("usr_1", { bucket: "running" });

    expect(result.jobs.map((job) => job.jobId)).toEqual(["job_running"]);
  });

  it("does not select another user's requested job when the scoped read model rejects it", async () => {
    listUserJobSnapshotsMock.mockResolvedValue([
      makeSnapshot("job_active", "running", "2026-03-30T09:00:00.000Z"),
    ]);
    getUserJobSnapshotMock.mockResolvedValue(null);
    findJobByIdMock.mockResolvedValue(makeJobRecord("job_active"));
    listEventsForUserJobMock.mockResolvedValue([]);

    const result = await loadUserJobsWorkspace("usr_1", { jobId: "job_other" });

    expect(getUserJobSnapshotMock).toHaveBeenCalledWith("usr_1", "job_other");
    expect(result.selectedJobId).toBe("job_active");
    expect(result.jobs.map((job) => job.jobId)).not.toContain("job_other");
  });
});
