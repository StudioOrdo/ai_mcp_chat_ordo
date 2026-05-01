import { describe, it, expect, vi } from "vitest";
import { 
  JobProgressStrategy,
  StreamProcessor, 
  TextDeltaStrategy, 
  ToolCallStrategy,
  ToolResultStrategy,
} from "./StreamStrategy";
import type { StreamEvent } from "@/core/entities/chat-stream";

describe("StreamStrategy Processor", () => {
  it("should route text delta to dispatch", () => {
    const dispatch = vi.fn();
    const processor = new StreamProcessor([new TextDeltaStrategy()]);
    
    const event: StreamEvent = { type: "text", delta: "Hello" };
    processor.process(event, { dispatch, assistantIndex: 1 });
    
    expect(dispatch).toHaveBeenCalledWith({
      type: "APPEND_TEXT",
      index: 1,
      delta: "Hello"
    });
  });

  it("should route tool call to dispatch", () => {
    const dispatch = vi.fn();
    const processor = new StreamProcessor([new ToolCallStrategy()]);
    
    const event: StreamEvent = { type: "tool_call", name: "test", args: { x: 1 }, toolInvocationId: "toolu_test_1" };
    processor.process(event, { dispatch, assistantIndex: 1 });
    
    expect(dispatch).toHaveBeenCalledWith({
      type: "APPEND_TOOL_CALL",
      index: 1,
      name: "test",
      args: { x: 1 },
      toolInvocationId: "toolu_test_1",
    });
  });

  it("should route tool results with invocation identity to dispatch", () => {
    const dispatch = vi.fn();
    const processor = new StreamProcessor([new ToolResultStrategy()]);

    const event: StreamEvent = {
      type: "tool_result",
      name: "generate_audio",
      result: { assetId: "uf_audio_1" },
      toolInvocationId: "toolu_audio_1",
    };
    processor.process(event, { dispatch, assistantIndex: 1 });

    expect(dispatch).toHaveBeenCalledWith({
      type: "APPEND_TOOL_RESULT",
      index: 1,
      name: "generate_audio",
      result: { assetId: "uf_audio_1" },
      toolInvocationId: "toolu_audio_1",
      sourceMessageId: undefined,
      contentHash: undefined,
    });
  });

  it("should leave product job stream events out of transcript mutation", () => {
    const dispatch = vi.fn();
    const processor = new StreamProcessor([new JobProgressStrategy()]);
    processor.process({
      type: "job_progress",
      messageId: "jobmsg_job_1",
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
        sequence: 8,
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
              { key: "qa_blog_article", label: "Reviewing article", status: "active", percent: 60 },
            ],
            activePhaseKey: "qa_blog_article",
          },
          payload: null,
        },
      },
    }, { dispatch, assistantIndex: 1 });

    expect(dispatch).not.toHaveBeenCalled();
  });
});
