import { describe, expect, it } from "vitest";

import type { JobStateEntry } from "@/hooks/chat/useJobStateStore";
import { resolveJobsRail } from "./resolve-jobs-rail";
import {
  createKeithBaselineJobStateEntries,
  KEITH_BASELINE_CONVERSATION_ID,
  KEITH_BASELINE_JOB_ID,
} from "../../../../tests/fixtures/chat-job-event-baseline";

function entry(
  jobId: string,
  status: JobStateEntry["status"],
  overrides: Partial<JobStateEntry> = {},
): JobStateEntry {
  const updatedAt = overrides.updatedAt ?? "2026-04-29T12:00:00.000Z";
  return {
    jobId,
    conversationId: "conv_1",
    userId: null,
    toolName: "compose_media",
    label: "Compose media",
    status,
    sequence: 1,
    createdAt: updatedAt,
    startedAt: null,
    completedAt: null,
    updatedAt,
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
      ...overrides.failure,
    },
    ...overrides,
  };
}

describe("resolveJobsRail", () => {
  it("maps active backend statuses to running state", () => {
    const model = resolveJobsRail({
      entries: [entry("job_queued", "queued"), entry("job_running", "running")],
      conversationId: "conv_1",
      syncState: "live",
      canExportDiagnostics: false,
    });

    expect(model.primaryState).toBe("running");
    expect(model.activeCount).toBe(2);
    expect(model.items.map((item) => item.state)).toEqual(["running", "running"]);
  });

  it("maps policy failures to Revise instead of Retry", () => {
    const model = resolveJobsRail({
      entries: [entry("job_policy", "failed", { failure: { failureClass: "policy", recoveryMode: null, nextRetryAt: null, lastCheckpointId: null, replayedFromJobId: null, supersededByJobId: null } })],
      conversationId: "conv_1",
      syncState: "live",
      canExportDiagnostics: false,
    });

    expect(model.primaryState).toBe("needs_input");
    expect(model.items[0]?.statusLabel).toBe("Needs revision");
    expect(model.items[0]?.actions[0]).toMatchObject({
      kind: "revise",
      label: "Revise",
      primary: true,
      actionType: "send",
    });
    expect(model.items[0]?.actions.find((action) => action.kind === "retry")).toBeUndefined();
  });

  it("maps transient failures to Retry", () => {
    const model = resolveJobsRail({
      entries: [entry("job_retry", "failed", { failure: { failureClass: "transient", recoveryMode: null, nextRetryAt: null, lastCheckpointId: null, replayedFromJobId: null, supersededByJobId: null } })],
      conversationId: "conv_1",
      syncState: "live",
      canExportDiagnostics: false,
    });

    expect(model.items[0]?.actions[0]).toMatchObject({
      kind: "retry",
      label: "Retry",
      primary: true,
      actionType: "job",
      params: { operation: "retry" },
    });
  });

  it("maps terminal and unknown failures to Diagnose", () => {
    const model = resolveJobsRail({
      entries: [
        entry("job_terminal", "failed", { failure: { failureClass: "terminal", recoveryMode: null, nextRetryAt: null, lastCheckpointId: null, replayedFromJobId: null, supersededByJobId: null }, updatedAt: "2026-04-29T12:01:00.000Z" }),
        entry("job_unknown", "failed"),
      ],
      conversationId: "conv_1",
      syncState: "live",
      canExportDiagnostics: false,
    });

    expect(model.items.map((item) => item.actions[0]?.kind)).toEqual(["diagnose", "diagnose"]);
  });

  it("hides superseded and canceled jobs by default", () => {
    const model = resolveJobsRail({
      entries: [
        entry("job_old", "failed", { failure: { failureClass: null, recoveryMode: null, nextRetryAt: null, lastCheckpointId: null, replayedFromJobId: null, supersededByJobId: "job_new" } }),
        entry("job_cancel", "canceled"),
        entry("job_new", "running"),
      ],
      conversationId: "conv_1",
      syncState: "live",
      canExportDiagnostics: false,
    });

    expect(model.items.map((item) => item.jobId)).toEqual(["job_new"]);
  });

  it("adds a diagnostic overflow action when allowed", () => {
    const model = resolveJobsRail({
      entries: [],
      conversationId: "conv_1",
      syncState: "live",
      canExportDiagnostics: true,
    });

    expect(model.overflowActions.map((action) => action.kind)).toContain("download_bundle");
  });

  it("keeps one durable rail item for Keith-style repeated status snapshots", () => {
    const model = resolveJobsRail({
      entries: createKeithBaselineJobStateEntries(),
      conversationId: KEITH_BASELINE_CONVERSATION_ID,
      syncState: "live",
      canExportDiagnostics: false,
    });

    expect(model.items).toHaveLength(1);
    expect(model.completedCount).toBe(1);
    expect(model.items[0]).toMatchObject({
      jobId: KEITH_BASELINE_JOB_ID,
      state: "completed",
      statusLabel: "Done",
    });
  });
});
