import { describe, it, expect } from "vitest";
import {
  updateMessageAtIndex,
  appendPart,
  appendTextDelta,
  isJobStatusMessagePart,
  isGenerationStatusMessagePart,
  upsertJobStatusMessage,
  upsertGenerationStatusMessage,
  setFailedSendMetadata,
} from "@/core/services/ConversationMessages";
import type { ChatMessage } from "@/core/entities/chat-message";
import type { GenerationStatusMessagePart, JobStatusMessagePart } from "@/core/entities/message-parts";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg_1",
    role: "assistant",
    content: "",
    timestamp: new Date("2026-01-01T00:00:00Z"),
    parts: [],
    ...overrides,
  };
}

function makeJobPart(overrides: Partial<JobStatusMessagePart> = {}): JobStatusMessagePart {
  return {
    type: "job_status",
    jobId: "job_1",
    toolName: "set_theme",
    label: "Theme",
    status: "running",
    ...overrides,
  };
}

describe("updateMessageAtIndex", () => {
  it("updates the message at the given index", () => {
    const messages = [makeMessage({ id: "a" }), makeMessage({ id: "b" })];
    const result = updateMessageAtIndex(messages, 1, (m) => ({ ...m, content: "updated" }));
    expect(result[1].content).toBe("updated");
    expect(result[0].id).toBe("a");
  });

  it("returns original array when index is out of bounds", () => {
    const messages = [makeMessage()];
    expect(updateMessageAtIndex(messages, 5, (m) => m)).toBe(messages);
  });

  it("does not mutate the input array", () => {
    const messages = [makeMessage()];
    const original = [...messages];
    updateMessageAtIndex(messages, 0, (m) => ({ ...m, content: "changed" }));
    expect(messages).toEqual(original);
  });
});

describe("appendPart", () => {
  it("adds a part to the message", () => {
    const msg = makeMessage({ parts: [] });
    const result = appendPart(msg, { type: "text", text: "hello" });
    expect(result.parts).toHaveLength(1);
    expect(result.parts![0]).toEqual({ type: "text", text: "hello" });
  });

  it("handles undefined parts gracefully", () => {
    const msg = makeMessage({ parts: undefined });
    const result = appendPart(msg, { type: "text", text: "hello" });
    expect(result.parts).toHaveLength(1);
  });
});

describe("appendTextDelta", () => {
  it("appends text to existing text part", () => {
    const msg = makeMessage({
      content: "Hello",
      parts: [{ type: "text", text: "Hello" }],
    });
    const result = appendTextDelta(msg, " world");
    expect(result.content).toBe("Hello world");
    expect(result.parts).toHaveLength(1);
    expect(result.parts![0]).toEqual({ type: "text", text: "Hello world" });
  });

  it("creates new text part when last part is not text", () => {
    const msg = makeMessage({
      content: "",
      parts: [{ type: "tool_call", name: "foo", args: {} }],
    });
    const result = appendTextDelta(msg, "hello");
    expect(result.parts).toHaveLength(2);
    expect(result.parts![1]).toEqual({ type: "text", text: "hello" });
  });

  it("creates text part when parts is empty", () => {
    const msg = makeMessage({ content: "", parts: [] });
    const result = appendTextDelta(msg, "start");
    expect(result.content).toBe("start");
    expect(result.parts).toHaveLength(1);
  });

  it("does not mutate the input message", () => {
    const msg = makeMessage({ content: "x", parts: [{ type: "text", text: "x" }] });
    const originalContent = msg.content;
    appendTextDelta(msg, "y");
    expect(msg.content).toBe(originalContent);
  });
});

describe("isJobStatusMessagePart", () => {
  it("returns true for job_status parts", () => {
    expect(isJobStatusMessagePart(makeJobPart())).toBe(true);
  });

  it("returns false for other parts", () => {
    expect(isJobStatusMessagePart({ type: "text", text: "hello" })).toBe(false);
  });
});

describe("isGenerationStatusMessagePart", () => {
  it("returns true for generation_status parts", () => {
    expect(
      isGenerationStatusMessagePart({
        type: "generation_status",
        status: "stopped",
        actor: "user",
        reason: "test",
        partialContentRetained: false,
      }),
    ).toBe(true);
  });

  it("returns false for other parts", () => {
    expect(isGenerationStatusMessagePart({ type: "text", text: "x" })).toBe(false);
  });
});

describe("upsertJobStatusMessage", () => {
  it("updates status of an existing job part", () => {
    const messages = [makeMessage({ parts: [makeJobPart()] })];
    const result = upsertJobStatusMessage(messages, makeJobPart({ status: "succeeded" }));
    const parts = result[0].parts!;
    expect(parts).toHaveLength(1);
    expect((parts[0] as JobStatusMessagePart).status).toBe("succeeded");
  });

  it("creates a new message when job not found", () => {
    const messages = [makeMessage()];
    const result = upsertJobStatusMessage(messages, makeJobPart({ jobId: "new_job" }));
    expect(result).toHaveLength(2);
    expect(result[1].id).toBe("job_new_job");
  });

  it("returns unchanged array structure when messageId not found", () => {
    const messages = [makeMessage({ id: "msg_1" })];
    const result = upsertJobStatusMessage(
      messages,
      makeJobPart({ jobId: "absent" }),
      "nonexistent_msg",
    );
    // A new message is appended since neither messageId matched nor jobId found
    expect(result).toHaveLength(2);
  });

  it("does not mutate the input array", () => {
    const messages = [makeMessage({ parts: [makeJobPart()] })];
    const original = JSON.parse(JSON.stringify(messages));
    upsertJobStatusMessage(messages, makeJobPart({ status: "succeeded" }));
    expect(messages[0].parts![0]).toEqual(original[0].parts[0]);
  });

  it("uses messageId for targeting when provided", () => {
    const messages = [
      makeMessage({ id: "msg_a", parts: [] }),
      makeMessage({ id: "msg_b", parts: [] }),
    ];
    const result = upsertJobStatusMessage(messages, makeJobPart(), "msg_b");
    expect(result[1].parts).toHaveLength(1);
    expect(result[0].parts).toHaveLength(0);
  });

  it("updates only the matching job when a message contains multiple job cards", () => {
    const messages = [makeMessage({
      id: "msg_multi_job",
      parts: [
        makeJobPart({ jobId: "job_audio", toolName: "generate_audio", status: "succeeded", sequence: 3 }),
        makeJobPart({ jobId: "job_video", toolName: "compose_media", status: "running", sequence: 4 }),
      ],
    })];

    const result = upsertJobStatusMessage(
      messages,
      makeJobPart({ jobId: "job_video", toolName: "compose_media", status: "succeeded", sequence: 5 }),
      "msg_multi_job",
    );

    expect(result[0].parts).toEqual([
      expect.objectContaining({ jobId: "job_audio", toolName: "generate_audio", status: "succeeded" }),
      expect.objectContaining({ jobId: "job_video", toolName: "compose_media", status: "succeeded", sequence: 5 }),
    ]);
  });

  it("preserves richer job envelopes when a thinner live update arrives with a newer sequence", () => {
    const messages = [makeMessage({
      parts: [makeJobPart({
        toolName: "produce_blog_article",
        label: "Produce Blog Article",
        sequence: 7,
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
      })],
    })];

    const result = upsertJobStatusMessage(messages, makeJobPart({
      toolName: "produce_blog_article",
      label: "Produce Blog Article",
      sequence: 8,
      progressPercent: 42,
      progressLabel: "Reviewing article",
    }));

    expect(result[0].parts?.[0]).toMatchObject({
      sequence: 8,
      resultEnvelope: expect.objectContaining({
        toolName: "produce_blog_article",
        progress: expect.objectContaining({ activePhaseKey: "qa_blog_article" }),
      }),
    });
  });
});

describe("upsertGenerationStatusMessage", () => {
  it("adds generation status to a message", () => {
    const messages = [makeMessage({ content: "hello" })];
    const result = upsertGenerationStatusMessage(messages, 0, {
      status: "stopped",
      actor: "user",
      reason: "User stopped",
    });
    const genPart = result[0].parts!.find((p) => p.type === "generation_status");
    expect(genPart).toBeDefined();
    expect((genPart as GenerationStatusMessagePart).status).toBe("stopped");
    expect((genPart as GenerationStatusMessagePart).partialContentRetained).toBe(true); // has retained content
  });

  it("replaces existing generation status", () => {
    const messages = [
      makeMessage({
        parts: [
          {
            type: "generation_status",
            status: "stopped",
            actor: "user",
            reason: "old",
            partialContentRetained: false,
          },
        ],
      }),
    ];
    const result = upsertGenerationStatusMessage(messages, 0, {
      status: "interrupted",
      actor: "system",
      reason: "new",
    });
    const genParts = result[0].parts!.filter((p) => p.type === "generation_status");
    expect(genParts).toHaveLength(1);
    expect((genParts[0] as GenerationStatusMessagePart).status).toBe("interrupted");
  });
});

describe("setFailedSendMetadata", () => {
  it("sets failed send metadata on the message", () => {
    const messages = [makeMessage()];
    const result = setFailedSendMetadata(messages, 0, {
      retryKey: "retry_1",
      failedUserMessageId: "user_1",
    });
    expect(result[0].metadata?.failedSend?.retryKey).toBe("retry_1");
  });
});
