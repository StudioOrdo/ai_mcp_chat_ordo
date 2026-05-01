import { describe, expect, it, vi } from "vitest";

import type { JobEvent, JobRequest } from "@/core/entities/job";
import {
  createJobEventStreamResponse,
  mapJobEventPayload,
} from "@/lib/jobs/job-event-stream";

function buildJob(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_1",
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "produce_blog_article",
    status: "succeeded",
    priority: 100,
    dedupeKey: null,
    initiatorType: "user",
    requestPayload: {
      brief: "Queue recovery brief",
      audience: "Operators",
    },
    resultPayload: {
      summary: "Produced draft \"Queue recovery brief\" at /blog/queue-recovery-brief.",
      slug: "queue-recovery-brief",
    },
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
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
    completedAt: "2026-03-25T03:00:02.000Z",
    updatedAt: "2026-03-25T03:00:02.000Z",
    ...overrides,
  };
}

function buildEvent(overrides: Partial<JobEvent> = {}): JobEvent {
  return {
    id: "jobevt_1",
    jobId: "job_1",
    conversationId: "conv_1",
    sequence: 5,
    eventType: "notification_failed",
    payload: {
      summary: "Push notification delivery failed for the result terminal event.",
      terminalEventType: "result",
    },
    createdAt: "2026-03-25T03:00:03.000Z",
    ...overrides,
  };
}

describe("mapJobEventPayload", () => {
  it("preserves the stable completed payload for audit-only events on succeeded jobs", () => {
    const payload = mapJobEventPayload(buildJob(), buildEvent());

    expect(payload).toMatchObject({
      type: "job_completed",
      jobId: "job_1",
      sequence: 5,
      summary: "Produced draft \"Queue recovery brief\" at /blog/queue-recovery-brief.",
      resultPayload: {
        summary: "Produced draft \"Queue recovery brief\" at /blog/queue-recovery-brief.",
        slug: "queue-recovery-brief",
      },
      part: expect.objectContaining({
        type: "job_status",
        status: "succeeded",
      }),
    });
  });

  it("preserves running progress for ownership transfer audit events", () => {
    const payload = mapJobEventPayload(
      buildJob({
        status: "running",
        progressPercent: 48,
        progressLabel: "Awaiting sign-in recovery",
        resultPayload: null,
        completedAt: null,
      }),
      buildEvent({
        eventType: "ownership_transferred",
        payload: {
          previousUserId: "anon_seed",
          nextUserId: "usr_1",
        },
      }),
    );

    expect(payload).toMatchObject({
      type: "job_progress",
      jobId: "job_1",
      sequence: 5,
      progressPercent: 48,
      progressLabel: "Awaiting sign-in recovery",
      part: expect.objectContaining({
        type: "job_status",
        status: "running",
      }),
    });
  });

  it("uses the latest renderable event to preserve phased state for audit-only live updates", () => {
    const payload = mapJobEventPayload(
      buildJob({
        status: "running",
        progressPercent: 42,
        progressLabel: "Reviewing article",
        resultPayload: null,
        completedAt: null,
      }),
      buildEvent({ eventType: "notification_sent", payload: { summary: "Push sent." } }),
      {
        id: "jobevt_renderable",
        jobId: "job_1",
        conversationId: "conv_1",
        sequence: 4,
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
        createdAt: "2026-03-25T03:00:02.000Z",
      },
    );

    expect(payload).toMatchObject({
      type: "job_progress",
      sequence: 5,
      part: expect.objectContaining({
        sequence: 5,
        resultEnvelope: expect.objectContaining({
          progress: expect.objectContaining({ activePhaseKey: "qa_blog_article" }),
        }),
      }),
    });
  });
});

describe("createJobEventStreamResponse", () => {
  it("performs an initial backlog poll even when the stream window is already exhausted", async () => {
    const listEvents = vi.fn().mockResolvedValue([]);
    const findJobById = vi.fn();

    const response = createJobEventStreamResponse({
      request: new Request("http://localhost/api/jobs/events"),
      requestId: "req_1",
      initialAfterSequence: 10,
      pollIntervalMs: 1,
      streamWindowMs: 0,
      batchLimit: 100,
      listEvents,
      findJobById,
    });

    await response.text();

    expect(listEvents).toHaveBeenCalledTimes(1);
    expect(listEvents).toHaveBeenCalledWith(10, 100);
    expect(findJobById).not.toHaveBeenCalled();
  });

  it("skips missing jobs while advancing the stream cursor by event sequence", async () => {
    const controller = new AbortController();
    const listEvents = vi.fn(async () => {
      if (listEvents.mock.calls.length === 1) {
        return [
          buildEvent({ id: "evt_11", sequence: 11, jobId: "missing_job" }),
          buildEvent({ id: "evt_12", sequence: 12, eventType: "result" }),
        ];
      }

      controller.abort();
      return [];
    });
    const findJobById = vi.fn(async (jobId: string) => (jobId === "job_1" ? buildJob() : null));

    const response = createJobEventStreamResponse({
      request: new Request("http://localhost/api/jobs/events", { signal: controller.signal }),
      requestId: "req_1",
      initialAfterSequence: 10,
      pollIntervalMs: 1,
      streamWindowMs: 50,
      batchLimit: 100,
      listEvents,
      findJobById,
    });

    const body = await response.text();

    expect(findJobById).toHaveBeenCalledWith("missing_job");
    expect(findJobById).toHaveBeenCalledWith("job_1");
    expect(listEvents).toHaveBeenNthCalledWith(1, 10, 100);
    expect(listEvents).toHaveBeenNthCalledWith(2, 12, 100);
    expect(body).not.toContain("id: 11");
    expect(body).toContain("id: 12");
  });
});