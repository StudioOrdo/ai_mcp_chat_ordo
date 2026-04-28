import { describe, expect, it } from "vitest";

import { buildJobStatusPartFromProjection, describeJobStatus } from "./job-status";

describe("job-status", () => {
  it("projects a deferred job payload into a capability result envelope", () => {
    const part = buildJobStatusPartFromProjection(
      {
        id: "job_1",
        status: "succeeded",
        toolName: "prepare_journal_post_for_publish",
        requestPayload: { post_id: "post_1" },
        progressPercent: null,
        progressLabel: null,
        resultPayload: null,
        errorMessage: null,
        failureClass: null,
        recoveryMode: "rerun",
        replayedFromJobId: null,
        supersededByJobId: null,
      },
      {
        id: "evt_1",
        jobId: "job_1",
        conversationId: "conv_1",
        sequence: 3,
        eventType: "result",
        payload: {
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
        createdAt: "2026-04-10T12:00:00.000Z",
      },
    );

    expect(part.summary).toBe("The journal draft is ready.");
    expect(part.resultEnvelope).toMatchObject({
      toolName: "prepare_journal_post_for_publish",
      family: "journal",
      cardKind: "journal_workflow",
      executionMode: "deferred",
      summary: {
        title: "Journal publish readiness for post_1",
        message: "The journal draft is ready.",
      },
    });
  });

  it("prefers native envelope summary fields when the job payload already provides them", () => {
    const nativeEnvelope = {
      schemaVersion: 1 as const,
      toolName: "draft_content",
      family: "editorial" as const,
      cardKind: "editorial_workflow" as const,
      executionMode: "deferred" as const,
      inputSnapshot: { title: "Legacy Title" },
      summary: {
        title: "Envelope Title",
        subtitle: "Envelope Subtitle",
        message: "Envelope summary",
      },
      replaySnapshot: { title: "Envelope Title" },
      payload: {
        id: "post_1",
        slug: "launch-plan",
        status: "draft",
        title: "Launch Plan",
      },
    };

    const part = buildJobStatusPartFromProjection(
      {
        id: "job_2",
        status: "succeeded",
        toolName: "draft_content",
        requestPayload: { title: "Legacy Title" },
        progressPercent: null,
        progressLabel: null,
        resultPayload: nativeEnvelope,
        errorMessage: null,
        failureClass: null,
        recoveryMode: "rerun",
        replayedFromJobId: null,
        supersededByJobId: null,
      },
      {
        id: "evt_2",
        jobId: "job_2",
        conversationId: "conv_1",
        sequence: 4,
        eventType: "result",
        payload: {
          result: nativeEnvelope,
        },
        createdAt: "2026-04-10T12:05:00.000Z",
      },
    );

    expect(part.title).toBe("Envelope Title");
    expect(part.subtitle).toBe("Envelope Subtitle");
    expect(part.summary).toBe("Envelope summary");
    expect(part.resultEnvelope).toEqual(nativeEnvelope);
  });

  it("projects phased running progress into the normalized result envelope", () => {
    const part = buildJobStatusPartFromProjection(
      {
        id: "job_3",
        status: "running",
        toolName: "produce_blog_article",
        requestPayload: { brief: "Launch Plan" },
        progressPercent: 42,
        progressLabel: "Reviewing article",
        resultPayload: null,
        errorMessage: null,
        failureClass: null,
        recoveryMode: "rerun",
        replayedFromJobId: "job_prior",
        supersededByJobId: null,
      },
      {
        id: "evt_3",
        jobId: "job_3",
        conversationId: "conv_1",
        sequence: 5,
        eventType: "progress",
        payload: {
          phases: [
            { key: "compose_blog_article", label: "Composing article", status: "succeeded" },
            { key: "qa_blog_article", label: "Reviewing article", status: "active", percent: 60 },
            { key: "resolve_blog_article_qa", label: "Resolving QA findings", status: "pending" },
          ],
          activePhaseKey: "qa_blog_article",
          replaySnapshot: { brief: "Launch Plan", checkpoint: "qa" },
        },
        createdAt: "2026-04-10T12:10:00.000Z",
      },
    );

    expect(part.progressPercent).toBe(42);
    expect(part.progressLabel).toBe("Reviewing article");
    expect(part.resultEnvelope?.progress).toMatchObject({
      activePhaseKey: "qa_blog_article",
      phases: expect.arrayContaining([
        expect.objectContaining({ key: "compose_blog_article", status: "succeeded" }),
        expect.objectContaining({ key: "qa_blog_article", status: "active", percent: 60 }),
      ]),
    });
    expect(part.resultEnvelope?.replaySnapshot).toEqual({ brief: "Launch Plan", checkpoint: "qa" });
    expect(part.replayedFromJobId).toBe("job_prior");
    expect(describeJobStatus(part)).toContain("Reviewing article (42%)");
  });

  it("falls back to registry descriptions for job subtitles", () => {
    const part = buildJobStatusPartFromProjection(
      {
        id: "job_4",
        status: "running",
        toolName: "qa_blog_article",
        requestPayload: { title: "AI Governance Playbook" },
        progressPercent: 15,
        progressLabel: "Reviewing article",
        resultPayload: null,
        errorMessage: null,
        failureClass: null,
        recoveryMode: "rerun",
        replayedFromJobId: null,
        supersededByJobId: null,
      },
      {
        id: "evt_4",
        jobId: "job_4",
        conversationId: "conv_1",
        sequence: 6,
        eventType: "progress",
        payload: {
          progressPercent: 15,
          progressLabel: "Reviewing article",
        },
        createdAt: "2026-04-10T12:15:00.000Z",
      },
    );

    expect(part.title).toBe("AI Governance Playbook");
    expect(part.subtitle).toBe(
      "Run editorial QA against the current article draft and return structured findings.",
    );
  });

  it("presents standalone image generation jobs with generic image wording", () => {
    const part = buildJobStatusPartFromProjection(
      {
        id: "job_image_1",
        status: "running",
        toolName: "generate_blog_image",
        requestPayload: {
          prompt: "A geometric operator portrait in a bright workspace",
          alt_text: "Operator portrait in a bright workspace",
        },
        progressPercent: 18,
        progressLabel: "Generating image",
        resultPayload: null,
        errorMessage: null,
        failureClass: null,
        recoveryMode: "rerun",
        replayedFromJobId: null,
        supersededByJobId: null,
      },
      {
        id: "evt_image_1",
        jobId: "job_image_1",
        conversationId: "conv_1",
        sequence: 9,
        eventType: "progress",
        payload: {
          progressPercent: 18,
          progressLabel: "Generating image",
        },
        createdAt: "2026-04-10T12:25:00.000Z",
      },
    );

    expect(part.label).toBe("Generate Image");
    expect(part.title).toBe("Operator portrait in a bright workspace");
    expect(part.subtitle).toBe("Generate and store an image asset for reuse in the conversation.");
  });

  it("keeps editorial wording for blog image jobs that target a post", () => {
    const part = buildJobStatusPartFromProjection(
      {
        id: "job_blog_image_1",
        status: "running",
        toolName: "generate_blog_image",
        requestPayload: {
          post_id: "post_1",
          prompt: "A founder strategy room",
          alt_text: "Founders in a strategy room",
        },
        progressPercent: 30,
        progressLabel: "Generating hero image",
        resultPayload: null,
        errorMessage: null,
        failureClass: null,
        recoveryMode: "rerun",
        replayedFromJobId: null,
        supersededByJobId: null,
      },
      {
        id: "evt_blog_image_1",
        jobId: "job_blog_image_1",
        conversationId: "conv_1",
        sequence: 10,
        eventType: "progress",
        payload: {
          progressPercent: 30,
          progressLabel: "Generating hero image",
        },
        createdAt: "2026-04-10T12:26:00.000Z",
      },
    );

    expect(part.label).toBe("Generate Blog Image");
  });

  it("prefers payload context over registry description when editorial context is available", () => {
    const part = buildJobStatusPartFromProjection(
      {
        id: "job_5",
        status: "running",
        toolName: "produce_blog_article",
        requestPayload: {
          brief: "Create an AI governance playbook article.",
          audience: "Operators running customer delivery",
          objective: "Turn platform capability into a publishable article",
        },
        progressPercent: 42,
        progressLabel: "Reviewing article",
        resultPayload: null,
        errorMessage: null,
        failureClass: null,
        recoveryMode: "rerun",
        replayedFromJobId: null,
        supersededByJobId: null,
      },
      {
        id: "evt_5",
        jobId: "job_5",
        conversationId: "conv_1",
        sequence: 7,
        eventType: "progress",
        payload: {
          progressPercent: 42,
          progressLabel: "Reviewing article",
        },
        createdAt: "2026-04-10T12:20:00.000Z",
      },
    );

    expect(part.title).toBe("Create an AI governance playbook article.");
    expect(part.subtitle).toContain("Audience: Operators running customer delivery");
    expect(part.subtitle).toContain("Objective: Turn platform capability into a publish");
  });

  it("clears progress details for failed deferred jobs", () => {
    const part = buildJobStatusPartFromProjection(
      {
        id: "job_6",
        status: "failed",
        toolName: "produce_blog_article",
        requestPayload: { brief: "Launch Plan" },
        progressPercent: 50,
        progressLabel: "Resolving QA findings",
        resultPayload: null,
        errorMessage: "Request timed out.",
        failureClass: "transient",
        recoveryMode: "rerun",
        replayedFromJobId: null,
        supersededByJobId: null,
      },
      {
        id: "evt_6",
        jobId: "job_6",
        conversationId: "conv_1",
        sequence: 8,
        eventType: "failed",
        payload: {
          progressPercent: null,
          progressLabel: null,
          activePhaseKey: null,
          phases: [
            { key: "resolve_blog_article_qa", label: "Resolving QA findings", status: "active", percent: 50 },
          ],
          errorMessage: "Request timed out.",
          failureClass: "transient",
        },
        createdAt: "2026-04-10T12:25:00.000Z",
      },
    );

    expect(part.progressPercent).toBeNull();
    expect(part.progressLabel).toBeNull();
    expect(part.resultEnvelope?.progress).toBeUndefined();
    expect(describeJobStatus(part)).toContain("failed: Request timed out.");
  });

  it("publishes compose_media deferred progress with canonical deferred lifecycle metadata", () => {
    const part = buildJobStatusPartFromProjection(
      {
        id: "job_media_7",
        status: "running",
        toolName: "compose_media",
        requestPayload: { plan: { id: "plan_media_7" } },
        progressPercent: 42,
        progressLabel: "Uploading composition artifact",
        resultPayload: null,
        errorMessage: null,
        failureClass: null,
        recoveryMode: "rerun",
        replayedFromJobId: null,
        supersededByJobId: null,
      },
      {
        id: "evt_media_7",
        jobId: "job_media_7",
        conversationId: "conv_media_7",
        sequence: 4,
        eventType: "progress",
        payload: {
          progressPercent: 42,
          progressLabel: "Uploading composition artifact",
        },
        createdAt: "2026-04-10T12:30:00.000Z",
      },
    );

    expect(part).toMatchObject({
      lifecyclePhase: "compose_running_deferred",
      failureCode: null,
      failureStage: null,
      recoveryMode: "rerun",
    });
  });

  it("publishes compose_media deferred failures with explicit canonical failure metadata", () => {
    const part = buildJobStatusPartFromProjection(
      {
        id: "job_media_8",
        status: "failed",
        toolName: "compose_media",
        requestPayload: { plan: { id: "plan_media_8" } },
        progressPercent: null,
        progressLabel: null,
        resultPayload: null,
        errorMessage: "Remote FFmpeg failed.",
        failureClass: "terminal",
        recoveryMode: "rerun",
        replayedFromJobId: null,
        supersededByJobId: null,
      },
      {
        id: "evt_media_8",
        jobId: "job_media_8",
        conversationId: "conv_media_8",
        sequence: 5,
        eventType: "failed",
        payload: {
          errorMessage: "Remote FFmpeg failed.",
        },
        createdAt: "2026-04-10T12:35:00.000Z",
      },
    );

    expect(part).toMatchObject({
      lifecyclePhase: "compose_failed_terminal",
      failureCode: "deferred_execution_failed",
      failureStage: "deferred_execution",
      failureClass: "terminal",
    });
  });
});