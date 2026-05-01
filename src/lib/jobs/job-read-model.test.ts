import { describe, expect, it } from "vitest";

import type { JobEvent, JobRequest } from "@/core/entities/job";
import { buildCanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

function buildJob(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_1",
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "produce_blog_article",
    status: "running",
    priority: 100,
    dedupeKey: null,
    initiatorType: "user",
    requestPayload: {
      brief: "Inherited migration brief",
      audience: "Queue recovery operators",
    },
    resultPayload: null,
    errorMessage: null,
    progressPercent: 12,
    progressLabel: "Awaiting sign-in recovery",
    attemptCount: 1,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: "rerun",
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-03-25T03:00:00.000Z",
    startedAt: "2026-03-25T03:00:01.000Z",
    completedAt: null,
    updatedAt: "2026-03-25T03:00:02.000Z",
    ...overrides,
  };
}

function buildEvent(overrides: Partial<JobEvent> = {}): JobEvent {
  return {
    id: "jobevt_1",
    jobId: "job_1",
    conversationId: "conv_1",
    sequence: 9,
    eventType: "ownership_transferred",
    payload: {
      summary: "Job ownership transferred from the anonymous session to the signed-in account.",
      previousUserId: "anon_seed",
      nextUserId: "usr_1",
    },
    createdAt: "2026-03-25T03:00:03.000Z",
    ...overrides,
  };
}

describe("buildCanonicalJobSnapshot", () => {
  it("uses the durable job state for audit-only events", () => {
    const snapshot = buildCanonicalJobSnapshot(buildJob(), buildEvent());

    expect(snapshot.status).toBe("running");
    expect(snapshot.progressLabel).toBe("Awaiting sign-in recovery");
    expect(snapshot.progressPercent).toBe(12);
    expect(snapshot.summary).toBeUndefined();
  });

  it("preserves phased progress metadata when a renderable event is available", () => {
    const snapshot = buildCanonicalJobSnapshot(
      buildJob(),
      buildEvent({
        eventType: "progress",
        payload: {
          progressPercent: 42,
          progressLabel: "Reviewing article",
          phases: [
            { key: "compose_blog_article", label: "Composing article", status: "succeeded" },
            { key: "qa_blog_article", label: "Reviewing article", status: "active", percent: 60 },
          ],
          activePhaseKey: "qa_blog_article",
        },
      }),
    );

    expect(snapshot.resultEnvelope?.progress).toMatchObject({
      activePhaseKey: "qa_blog_article",
      phases: expect.arrayContaining([
        expect.objectContaining({ key: "qa_blog_article", status: "active", percent: 60 }),
      ]),
    });
  });

  it("redacts sensitive request and envelope input fields from the product snapshot", () => {
    const snapshot = buildCanonicalJobSnapshot(
      buildJob({
        requestPayload: {
          brief: "Inherited migration brief",
          nested: {
            apiKey: "sk-live",
            safe: "visible",
          },
          tokens: ["one", "two"],
        },
      }),
      buildEvent({
        eventType: "progress",
        payload: {
          resultEnvelope: {
            schemaVersion: 1,
            toolName: "produce_blog_article",
            family: "editorial",
            cardKind: "editorial_workflow",
            executionMode: "deferred",
            inputSnapshot: {
              brief: "Inherited migration brief",
              authorization: "Bearer secret",
              nested: {
                sessionCookie: "cookie",
                safe: "visible",
              },
            },
            summary: { title: "Launch plan" },
            payload: null,
          },
        },
      }),
    );

    expect(snapshot.inputSnapshot).toMatchObject({
      brief: "Inherited migration brief",
      authorization: "[redacted]",
      nested: {
        sessionCookie: "[redacted]",
        safe: "visible",
      },
    });
    expect(snapshot.resultEnvelope?.inputSnapshot).toEqual(snapshot.inputSnapshot);
  });
});
