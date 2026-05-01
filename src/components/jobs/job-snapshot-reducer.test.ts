import { describe, expect, it } from "vitest";

import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

import {
  reconcileSelectedJobsWorkspaceJob,
  replaceJobsWorkspaceState,
  type JobsWorkspaceState,
} from "@/components/jobs/job-snapshot-reducer";

function makeSnapshot(overrides: Partial<CanonicalJobSnapshot> = {}): CanonicalJobSnapshot {
  return {
    jobId: "job_1",
    conversationId: "conv_jobs",
    userId: null,
    toolName: "produce_blog_article",
    label: "Produce Blog Article",
    status: "running",
    sequence: 10,
    progressLabel: "Reviewing article",
    createdAt: "2026-03-30T09:00:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-03-30T09:10:00.000Z",
    origin: { fallback: "job_created_at" },
    inputSnapshot: {},
    resultEnvelope: null,
    artifactRefs: [],
    materializationRefs: [],
    ownership: { userId: null, visibility: "anonymous_session", initiatorType: "user" },
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

function makeHistoryEntry(sequence: number, jobId = "job_1"): JobHistoryEntry {
  return {
    id: `${jobId}_${sequence}`,
    jobId,
    conversationId: "conv_jobs",
    sequence,
    eventType: "progress",
    createdAt: `2026-03-30T09:${String(sequence).padStart(2, "0")}:00.000Z`,
    part: {
      type: "job_status",
      jobId,
      toolName: "produce_blog_article",
      label: "Produce Blog Article",
      status: "running",
      sequence,
    },
  };
}

function makeState(): JobsWorkspaceState {
  return {
    jobs: [makeSnapshot()],
    selectedJobId: "job_1",
    selectedJob: makeSnapshot(),
    selectedJobHistory: [makeHistoryEntry(10)],
  };
}

describe("job-snapshot-reducer", () => {
  it("keeps the fresher workspace snapshot during full reconcile", () => {
    const current = makeState();
    const nextState = {
      jobs: [makeSnapshot({ sequence: 4, progressLabel: "Older state" })],
      selectedJobId: "job_1",
      selectedJob: makeSnapshot({ sequence: 4, progressLabel: "Older state" }),
      selectedJobHistory: [makeHistoryEntry(4)],
    };

    const merged = replaceJobsWorkspaceState(current, nextState);

    expect(merged.jobs[0]?.sequence).toBe(10);
    expect(merged.selectedJob?.progressLabel).toBe("Reviewing article");
    expect(merged.selectedJobHistory.map((entry) => entry.sequence)).toEqual([4, 10]);
  });

  it("keeps the fresher selected job during targeted reconcile", () => {
    const current = makeState();

    const merged = reconcileSelectedJobsWorkspaceJob(
      current,
      "job_1",
      makeSnapshot({ sequence: 8, progressLabel: "Older selected state" }),
      [makeHistoryEntry(8)],
    );

    expect(merged.selectedJob?.sequence).toBe(10);
    expect(merged.selectedJob?.progressLabel).toBe("Reviewing article");
    expect(merged.selectedJobHistory.map((entry) => entry.sequence)).toEqual([8, 10]);
  });
});
