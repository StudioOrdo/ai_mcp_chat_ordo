import { describe, expect, it } from "vitest";

import {
  isCapabilityResultEnvelope,
  projectCapabilityResultEnvelope,
} from "./capability-result-envelope";

describe("capability-result-envelope", () => {
  it("projects a known chat capability into a normalized result envelope", () => {
    const envelope = projectCapabilityResultEnvelope({
      toolName: "admin_web_search",
      inputSnapshot: { query: "ordo site architecture" },
      payload: {
        action: "admin_web_search",
        query: "ordo site architecture",
        answer: "A".repeat(700),
        citations: [],
        sources: ["https://example.com/architecture"],
        model: "gpt-5",
      },
    });

    expect(envelope).not.toBeNull();
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      toolName: "admin_web_search",
      family: "search",
      cardKind: "search_result",
      executionMode: "deferred",
      inputSnapshot: { query: "ordo site architecture" },
    });
    expect(envelope?.summary.title).toBe("ordo site architecture");
    expect(envelope?.summary.message?.length ?? 0).toBeLessThanOrEqual(500);
    expect(JSON.stringify(envelope?.replaySnapshot ?? {}).length).toBeLessThanOrEqual(24 * 1024);
  });

  it("preserves native envelopes while applying additive overrides", () => {
    const nativeEnvelope = {
      schemaVersion: 1 as const,
      toolName: "generate_audio",
      family: "artifact" as const,
      cardKind: "artifact_viewer" as const,
      executionMode: "inline" as const,
      inputSnapshot: { text: "Hello world" },
      summary: {
        title: "Voiceover",
        subtitle: "gpt-5",
        message: "Queued.",
      },
      replaySnapshot: { title: "Voiceover" },
      payload: {
        action: "generate_audio",
        title: "Voiceover",
      },
    };

    const envelope = projectCapabilityResultEnvelope({
      toolName: "generate_audio",
      payload: nativeEnvelope,
      summary: { message: "Completed." },
    });

    expect(isCapabilityResultEnvelope(envelope)).toBe(true);
    expect(envelope?.summary).toMatchObject({
      title: "Voiceover",
      subtitle: "gpt-5",
      message: "Completed.",
    });
    expect(envelope?.payload).toEqual(nativeEnvelope.payload);
  });

  it("returns null for unknown capabilities that have no presentation descriptor", () => {
    expect(
      projectCapabilityResultEnvelope({
        toolName: "nonexistent_tool",
        payload: { ok: true },
      }),
    ).toBeNull();
  });

  it("serializes progress-only envelopes with a null payload", () => {
    const envelope = projectCapabilityResultEnvelope({
      toolName: "produce_blog_article",
      inputSnapshot: { brief: "Launch Plan" },
      payload: undefined,
      executionMode: "deferred",
      progress: {
        percent: 42,
        label: "Reviewing article",
        phases: [
          { key: "compose_blog_article", label: "Composing article", status: "succeeded" },
          { key: "qa_blog_article", label: "Reviewing article", status: "active", percent: 60 },
        ],
        activePhaseKey: "qa_blog_article",
      },
    });

    expect(envelope).not.toBeNull();
    expect(envelope?.payload).toBeNull();
    expect(isCapabilityResultEnvelope(JSON.parse(JSON.stringify(envelope)))).toBe(true);
  });
});
