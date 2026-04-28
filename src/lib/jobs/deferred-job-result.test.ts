import { describe, expect, it } from "vitest";

import {
  createDeferredJobResultPayload,
  deferredJobResultToMessagePart,
  deferredJobResultToStreamEvent,
} from "./deferred-job-result";

describe("deferred-job-result", () => {
  it("persists the projected capability result envelope inside deferred job payloads", () => {
    const payload = createDeferredJobResultPayload(
      {
        id: "job_1",
        conversationId: "conv_1",
        userId: "user_1",
        toolName: "prepare_journal_post_for_publish",
        status: "succeeded",
        priority: 1,
        dedupeKey: null,
        initiatorType: "user",
        requestPayload: { post_id: "post_1" },
        resultPayload: null,
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
        createdAt: "2026-04-10T12:00:00.000Z",
        startedAt: "2026-04-10T12:00:01.000Z",
        completedAt: "2026-04-10T12:00:30.000Z",
        updatedAt: "2026-04-10T12:00:30.000Z",
      },
      {
        id: "evt_1",
        jobId: "job_1",
        conversationId: "conv_1",
        sequence: 7,
        eventType: "result",
        payload: {
          toolInvocationId: "toolu_job_1",
          result: {
            action: "prepare_journal_post_for_publish",
            ready: true,
            summary: "The journal draft is ready.",
            blockers: [],
            revision_count: 2,
            post: {
              id: "post_1",
              title: "Launch Plan",
              detail_route: "/admin/journal/post_1",
              preview_route: "/admin/journal/preview/launch-plan",
            },
          },
        },
        createdAt: "2026-04-10T12:00:30.000Z",
      },
    );

    expect(payload.deferred_job.resultEnvelope).toMatchObject({
      toolName: "prepare_journal_post_for_publish",
      family: "journal",
      cardKind: "journal_workflow",
    });
    expect(payload.deferred_job.toolInvocationId).toBe("toolu_job_1");
  });

  it("hydrates message parts from deferred payload envelopes when legacy summary fields are absent", () => {
    const part = deferredJobResultToMessagePart({
      deferred_job: {
        jobId: "job_2",
        conversationId: "conv_2",
        toolName: "draft_content",
        label: "Draft Content",
        status: "running",
        sequence: 2,
        toolInvocationId: "toolu_draft_1",
        resultPayload: null,
        resultEnvelope: {
          schemaVersion: 1,
          toolName: "draft_content",
          family: "editorial",
          cardKind: "editorial_workflow",
          executionMode: "deferred",
          inputSnapshot: { title: "Launch Plan" },
          summary: {
            title: "Envelope Title",
            subtitle: "Envelope Subtitle",
            message: "Envelope summary",
          },
          replaySnapshot: { title: "Envelope Title" },
          progress: {
            percent: 55,
            label: "Drafting",
          },
          payload: {
            id: "post_1",
            slug: "launch-plan",
            status: "draft",
            title: "Launch Plan",
          },
        },
      },
    });

    expect(part.title).toBe("Envelope Title");
    expect(part.subtitle).toBe("Envelope Subtitle");
    expect(part.summary).toBe("Envelope summary");
    expect(part.progressPercent).toBe(55);
    expect(part.progressLabel).toBe("Drafting");
    expect(part.resultEnvelope?.toolName).toBe("draft_content");
    expect(part.toolInvocationId).toBe("toolu_draft_1");
  });

  it("emits normalized job parts on deferred job stream events", () => {
    const event = deferredJobResultToStreamEvent({
      deferred_job: {
        jobId: "job_3",
        toolInvocationId: "toolu_blog_1",
        conversationId: "conv_3",
        toolName: "produce_blog_article",
        label: "Produce Blog Article",
        status: "running",
        sequence: 9,
        progressPercent: 42,
        progressLabel: "Reviewing article",
        resultEnvelope: {
          schemaVersion: 1,
          toolName: "produce_blog_article",
          family: "editorial",
          cardKind: "editorial_workflow",
          executionMode: "deferred",
          inputSnapshot: { brief: "Launch Plan" },
          summary: { title: "Launch Plan" },
          progress: {
            percent: 42,
            label: "Reviewing article",
            phases: [
              { key: "compose_blog_article", label: "Composing article", status: "succeeded" },
              { key: "qa_blog_article", label: "Reviewing article", status: "active", percent: 60 },
            ],
            activePhaseKey: "qa_blog_article",
          },
          payload: null,
        },
      },
    });

    expect(event).toMatchObject({
      type: "job_progress",
      part: expect.objectContaining({
        type: "job_status",
        jobId: "job_3",
        toolInvocationId: "toolu_blog_1",
        resultEnvelope: expect.objectContaining({ toolName: "produce_blog_article" }),
      }),
    });
  });
});