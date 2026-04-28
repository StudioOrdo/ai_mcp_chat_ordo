import { describe, expect, it } from "vitest";

import { EventParser, JobProgressParser, ToolCallParser, ToolResultParser } from "./EventParserStrategy";

describe("EventParserStrategy", () => {
  it("preserves normalized job parts on parsed SSE payloads", () => {
    const parser = new EventParser([new JobProgressParser()]);
    const rawPayload = {
      type: "job_progress",
      jobId: "job_1",
      conversationId: "conv_1",
      sequence: 8,
      toolName: "produce_blog_article",
      label: "Produce Blog Article",
      progressPercent: 42,
      progressLabel: "Reviewing article",
      part: {
        type: "job_status",
        jobId: "job_1",
        toolName: "produce_blog_article",
        label: "Produce Blog Article",
        status: "running",
        toolInvocationId: "toolu_job_1",
        sequence: 8,
        progressPercent: 42,
        progressLabel: "Reviewing article",
        lifecyclePhase: "compose_running_deferred",
        failureCode: null,
        failureStage: null,
        recoveryMode: "rerun",
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
              { key: "qa_blog_article", label: "Reviewing article", status: "active", percent: 60 },
            ],
            activePhaseKey: "qa_blog_article",
          },
          payload: null,
        },
      },
    };
    const event = parser.parse(JSON.parse(JSON.stringify(rawPayload)));

    expect(event).toMatchObject({
      type: "job_progress",
      part: expect.objectContaining({
        type: "job_status",
        toolInvocationId: "toolu_job_1",
        lifecyclePhase: "compose_running_deferred",
        failureCode: null,
        failureStage: null,
        recoveryMode: "rerun",
        resultEnvelope: expect.objectContaining({
          toolName: "produce_blog_article",
          payload: null,
        }),
      }),
    });
  });

  it("preserves tool_result source metadata when provided", () => {
    const parser = new EventParser([new ToolResultParser()]);
    const event = parser.parse({
      tool_result: {
        name: "generate_audio",
        result: { assetId: "uf_audio_1" },
        toolInvocationId: "toolu_audio_1",
        sourceMessageId: "msg_1",
        contentHash: "hash_audio_1",
      },
    });

    expect(event).toEqual({
      type: "tool_result",
      name: "generate_audio",
      result: { assetId: "uf_audio_1" },
      toolInvocationId: "toolu_audio_1",
      sourceMessageId: "msg_1",
      contentHash: "hash_audio_1",
    });
  });

  it("preserves tool_call invocation identity when provided", () => {
    const parser = new EventParser([new ToolCallParser()]);
    const event = parser.parse({
      tool_call: {
        name: "generate_chart",
        args: { title: "Cheese Flow" },
        toolInvocationId: "toolu_chart_1",
      },
    });

    expect(event).toEqual({
      type: "tool_call",
      name: "generate_chart",
      args: { title: "Cheese Flow" },
      toolInvocationId: "toolu_chart_1",
    });
  });
});