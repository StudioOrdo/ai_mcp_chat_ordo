import { describe, expect, it, vi } from "vitest";

import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

import {
  buildJobFailureClipboardText,
  buildJobLogExport,
  buildJobSummaryClipboardText,
  formatJobFailureClass,
  getJobArtifactLink,
  getJobLogExportFileName,
} from "@/components/jobs/job-workspace-helpers";

function makeSnapshot(
  overrides: Partial<CanonicalJobSnapshot> = {},
): CanonicalJobSnapshot {
  return {
    jobId: "job_1",
    conversationId: "conv_jobs",
    userId: null,
    toolName: "publish_content",
    label: "Publish Content",
    status: "succeeded",
    title: "Launch Plan",
    subtitle: "Publish the approved article",
    summary: 'Published journal article "Launch Plan" at /journal/launch-plan.',
    createdAt: "2026-04-08T14:59:00.000Z",
    startedAt: null,
    completedAt: "2026-04-08T15:00:00.000Z",
    updatedAt: "2026-04-08T15:00:00.000Z",
    origin: { fallback: "job_created_at" },
    inputSnapshot: {},
    resultPayload: {
      slug: "launch-plan",
      title: "Launch Plan",
      status: "published",
    },
    resultEnvelope: null,
    artifactRefs: [],
    materializationRefs: [],
    ownership: { userId: null, visibility: "anonymous_session", initiatorType: "user" },
    failure: {
      failureClass: null,
      recoveryMode: "rerun",
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
    ...overrides,
    sequence: overrides.sequence ?? 0,
  };
}

function makeHistoryEntry(overrides: Partial<JobHistoryEntry> = {}): JobHistoryEntry {
  return {
    id: "evt_1",
    jobId: "job_1",
    conversationId: "conv_jobs",
    sequence: 1,
    eventType: "result",
    createdAt: "2026-04-08T15:00:00.000Z",
    part: {
      type: "job_status",
      jobId: "job_1",
      toolName: "publish_content",
      label: "Publish Content",
      status: "succeeded",
      summary: 'Published journal article "Launch Plan" at /journal/launch-plan.',
    },
    ...overrides,
  };
}

describe("job workspace helpers", () => {
  it("resolves policy-driven artifact links for published and draft outputs", () => {
    expect(getJobArtifactLink(makeSnapshot())).toEqual({
      href: "/journal/launch-plan",
      label: "Open artifact",
    });

    expect(getJobArtifactLink(makeSnapshot({
      toolName: "draft_content",
      label: "Draft Content",
      resultPayload: { slug: "launch-plan", status: "draft" },
    }))).toEqual({
      href: "/admin/journal/preview/launch-plan",
      label: "Open artifact",
    });

    expect(getJobArtifactLink(makeSnapshot({
      toolName: "qa_blog_article",
      label: "QA Blog Article",
    }))).toBeNull();
  });

  it("builds copy-safe summary and failure text", () => {
    const summaryText = buildJobSummaryClipboardText(makeSnapshot({
      failure: {
        failureClass: null,
        recoveryMode: "rerun",
        nextRetryAt: null,
        lastCheckpointId: null,
        replayedFromJobId: "job_0",
        supersededByJobId: null,
      },
    }));
    expect(summaryText).toContain("Launch Plan");
    expect(summaryText).toContain("Replayed from: job_0");
    expect(summaryText).toContain("Summary:");

    const failureText = buildJobFailureClipboardText(makeSnapshot({
      status: "failed",
      error: "Provider offline",
      failure: {
        failureClass: "transient",
        recoveryMode: "rerun",
        nextRetryAt: null,
        lastCheckpointId: null,
        replayedFromJobId: null,
        supersededByJobId: null,
      },
    }));
    expect(failureText).toContain("Failure class: Transient failure");
    expect(failureText).toContain("Failure: Provider offline");
    expect(buildJobFailureClipboardText(makeSnapshot())).toBeNull();
  });

  it("formats job failure classes for self-service detail", () => {
    expect(formatJobFailureClass("policy")).toBe("Policy blocked");
    expect(formatJobFailureClass(null)).toBeNull();
  });

  it("builds exported job log payloads and stable filenames", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T16:00:00.000Z"));

    const snapshot = makeSnapshot({
      failure: {
        failureClass: null,
        recoveryMode: "rerun",
        nextRetryAt: null,
        lastCheckpointId: null,
        replayedFromJobId: "job_0",
        supersededByJobId: "job_2",
      },
    });
    const exportPayload = buildJobLogExport(snapshot, [makeHistoryEntry()]);

    expect(exportPayload).toEqual({
      version: 1,
      exportedAt: "2026-04-08T16:00:00.000Z",
      job: expect.objectContaining({
        jobId: "job_1",
        summary: 'Published journal article "Launch Plan" at /journal/launch-plan.',
        replayedFromJobId: "job_0",
        supersededByJobId: "job_2",
      }),
      history: [
        expect.objectContaining({
          sequence: 1,
          status: "succeeded",
        }),
      ],
    });
    expect(getJobLogExportFileName(snapshot)).toBe("launch-plan-job_1.json");

    vi.useRealTimers();
  });
});
