import { describe, expect, it } from "vitest";
import type { JobEvent, JobRequest } from "@/core/entities/job";
import {
  buildJobPublication,
  publicationToStreamEvent,
} from "./job-publication";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeJobRequest(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_test_1",
    conversationId: "conv_1",
    userId: "user_1",
    toolName: "draft_content",
    status: "queued",
    priority: 0,
    dedupeKey: null,
    initiatorType: "user",
    requestPayload: { title: "Test Article", content: "# Hello\n\nTest body" },
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 0,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: "rerun",
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-01-01T00:00:00Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeJobEvent(overrides: Partial<JobEvent> = {}): JobEvent {
  return {
    id: "evt_1",
    jobId: "job_test_1",
    conversationId: "conv_1",
    sequence: 1,
    eventType: "queued",
    payload: {},
    createdAt: "2026-01-01T00:00:01Z",
    ...overrides,
  };
}

describe("job-publication", () => {
  describe("buildJobPublication", () => {
    it("builds a publication from a job and a renderable event", () => {
      const job = makeJobRequest();
      const event = makeJobEvent({ eventType: "queued" });
      const pub = buildJobPublication(job, event);

      expect(pub.part.type).toBe("job_status");
      expect(pub.part.jobId).toBe("job_test_1");
      expect(pub.part.toolName).toBe("draft_content");
      expect(pub.part.status).toBe("queued");
      expect(pub.resolvedEvent).toBe(event);
    });

    it("falls back to synthetic event when no event provided", () => {
      const job = makeJobRequest({ status: "running", progressPercent: 50 });
      const pub = buildJobPublication(job);

      expect(pub.part.status).toBe("running");
      expect(pub.resolvedEvent.id).toMatch(/^synthetic_/);
      expect(pub.resolvedEvent.jobId).toBe("job_test_1");
    });

    it("falls back to synthetic event when event is null", () => {
      const job = makeJobRequest({ status: "succeeded" });
      const pub = buildJobPublication(job, null);

      expect(pub.part.status).toBe("succeeded");
      expect(pub.resolvedEvent.id).toMatch(/^synthetic_/);
    });

    it("uses persisted job state when the latest renderable event is stale", () => {
      const job = makeJobRequest({
        status: "running",
        progressPercent: 18,
        progressLabel: "Generating outline",
        updatedAt: "2026-01-01T00:00:05Z",
      });
      const staleQueuedEvent = makeJobEvent({
        eventType: "queued",
        createdAt: "2026-01-01T00:00:01Z",
      });
      const pub = buildJobPublication(job, staleQueuedEvent);

      expect(pub.resolvedEvent.id).toMatch(/^synthetic_/);
      expect(pub.part.status).toBe("running");
      expect(pub.part.progressPercent).toBe(18);
      expect(pub.part.progressLabel).toBe("Generating outline");
    });

    it("uses persisted job state when stale event and job update timestamps match", () => {
      const job = makeJobRequest({
        status: "running",
        progressPercent: 24,
        progressLabel: "Rendering preview",
        updatedAt: "2026-01-01T00:00:01Z",
      });
      const staleQueuedEvent = makeJobEvent({
        eventType: "queued",
        createdAt: "2026-01-01T00:00:01Z",
      });
      const pub = buildJobPublication(job, staleQueuedEvent);

      expect(pub.resolvedEvent.id).toMatch(/^synthetic_/);
      expect(pub.part.status).toBe("running");
      expect(pub.part.progressPercent).toBe(24);
      expect(pub.part.progressLabel).toBe("Rendering preview");
    });

    it("uses renderable event over audit-only event", () => {
      const job = makeJobRequest();
      const auditEvent = makeJobEvent({ eventType: "notification_sent", sequence: 5 });
      const renderableEvent = makeJobEvent({ eventType: "progress", sequence: 3, payload: { progressPercent: 75 } });
      const pub = buildJobPublication(job, auditEvent, renderableEvent);

      // Should use the renderable event, not the audit event
      expect(pub.resolvedEvent).toBe(renderableEvent);
      expect(pub.part.status).toBe("running");
    });

    it("falls back to synthetic when both event and renderableEvent are audit-only", () => {
      const job = makeJobRequest({ status: "running" });
      const auditEvent = makeJobEvent({ eventType: "notification_sent" });
      const anotherAudit = makeJobEvent({ eventType: "notification_failed" });
      const pub = buildJobPublication(job, auditEvent, anotherAudit);

      expect(pub.resolvedEvent.id).toMatch(/^synthetic_/);
    });

    it("produces correct part for succeeded job", () => {
      const job = makeJobRequest({
        status: "succeeded",
        resultPayload: { status: "draft", title: "My Article", slug: "my-article" },
      });
      const event = makeJobEvent({
        eventType: "result",
        payload: { result: { status: "draft", title: "My Article", slug: "my-article" } },
      });
      const pub = buildJobPublication(job, event);

      expect(pub.part.status).toBe("succeeded");
      expect(pub.part.toolName).toBe("draft_content");
      expect(pub.part.label).toBe("Draft Content");
    });

    it("produces correct part for failed job", () => {
      const job = makeJobRequest({
        status: "failed",
        errorMessage: "DB connection lost",
        failureClass: "terminal",
      });
      const event = makeJobEvent({
        eventType: "failed",
        payload: { errorMessage: "DB connection lost" },
      });
      const pub = buildJobPublication(job, event);

      expect(pub.part.status).toBe("failed");
      expect(pub.part.error).toBe("DB connection lost");
      expect(pub.part.failureClass).toBe("terminal");
    });
  });

  describe("publicationToStreamEvent", () => {
    it("wraps a publication as a stream event with correct messageId", () => {
      const job = makeJobRequest();
      const event = makeJobEvent({ eventType: "queued", sequence: 42 });
      const pub = buildJobPublication(job, event);

      const streamEvent = publicationToStreamEvent(pub, job, { sequence: 42 });

      expect(streamEvent).toBeDefined();
      expect((streamEvent as Record<string, unknown>).type).toBe("job_queued");
      expect((streamEvent as Record<string, unknown>).jobId).toBe("job_test_1");
      expect((streamEvent as Record<string, unknown>).messageId).toBe("jobmsg_job_test_1");
      expect((streamEvent as Record<string, unknown>).conversationId).toBe("conv_1");
    });
  });

  describe("channel equivalence", () => {
    it("produces identical parts regardless of entry path", () => {
      const job = makeJobRequest({ status: "running" });
      const event = makeJobEvent({
        eventType: "progress",
        payload: { progressPercent: 50, progressLabel: "Writing..." },
      });

      // Simulate all channels using buildJobPublication
      const pub1 = buildJobPublication(job, event);      // SSE channel
      const pub2 = buildJobPublication(job, event);      // Conversation projector
      const pub3 = buildJobPublication(job, event, event); // SSE with renderableEvent

      // All channels produce identical parts
      expect(pub1.part).toEqual(pub2.part);
      expect(pub2.part).toEqual(pub3.part);
    });
  });
});
