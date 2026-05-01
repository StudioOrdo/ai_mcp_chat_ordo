import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import type { ChatMessage } from "@/core/entities/chat-message";

import { buildAssetResolutionIndex, useAssetResolutionIndex } from "./useAssetResolutionIndex";

function buildMessages(): ChatMessage[] {
  return [
    {
      id: "msg-1",
      role: "assistant",
      content: "",
      timestamp: new Date("2026-04-11T12:00:00.000Z"),
      parts: [
        { type: "tool_call", name: "generate_chart", args: { title: "Revenue Chart", downloadFileName: "revenue-chart" } },
        {
          type: "tool_result",
          name: "generate_chart",
          result: { code: "flowchart TD\nA-->B", title: "Revenue Chart", assetId: "uf_chart_1", mimeType: "text/vnd.mermaid" },
        },
      ],
    },
    {
      id: "msg-2",
      role: "assistant",
      content: "",
      timestamp: new Date("2026-04-11T12:01:00.000Z"),
      parts: [
        { type: "tool_call", name: "generate_graph", args: { title: "Lead Mix", downloadFileName: "lead-mix" } },
        {
          type: "tool_result",
          name: "generate_graph",
          result: {
            graph: { kind: "bar", data: [{ week: "W1", leads: 4 }], x: { field: "week", type: "ordinal" }, y: { field: "leads", type: "quantitative" } },
            title: "Lead Mix",
            assetId: "uf_graph_1",
            mimeType: "application/vnd.studioordo.graph+json",
          },
        },
      ],
    },
    {
      id: "msg-3",
      role: "assistant",
      content: "",
      timestamp: new Date("2026-04-11T12:02:00.000Z"),
      parts: [
        { type: "tool_call", name: "generate_audio", args: { title: "Greeting" } },
        {
          type: "tool_result",
          name: "generate_audio",
          result: {
            action: "generate_audio",
            title: "Greeting",
            text: "Hello world",
            assetId: "uf_audio_1",
            provider: "openai-speech",
            generationStatus: "cached_asset",
            estimatedDurationSeconds: 4,
            estimatedGenerationSeconds: 2,
          },
        },
      ],
    },
  ];
}

describe("buildAssetResolutionIndex", () => {
  it("looks up chart payloads by assetId", () => {
    const index = buildAssetResolutionIndex(buildMessages());

    expect(index.getChartPayloadByAssetId("uf_chart_1")).toEqual(expect.objectContaining({ title: "Revenue Chart" }));
  });

  it("keeps chart and graph lookups isolated by kind", () => {
    const index = buildAssetResolutionIndex(buildMessages());

    expect(index.getGraphPayloadByAssetId("uf_graph_1")).toEqual(expect.objectContaining({ title: "Lead Mix" }));
    expect(index.getChartPayloadByAssetId("uf_graph_1")).toBeNull();
  });

  it("does not promote direct generate_audio transcript payloads into product asset state", () => {
    const index = buildAssetResolutionIndex(buildMessages());

    expect(index.listCandidates()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: "uf_audio_1" }),
    ]));
    expect(Object.keys(index)).not.toContain("getAudioPayloadByAssetId");
  });

  it("returns canonicalization candidates with alias metadata", () => {
    const index = buildAssetResolutionIndex(buildMessages());
    const candidates = index.listCandidates();

    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: "uf_chart_1", aliases: expect.arrayContaining(["Revenue Chart", "revenue-chart"]) }),
      expect.objectContaining({ assetId: "uf_graph_1", aliases: expect.arrayContaining(["Lead Mix", "lead-mix"]) }),
    ]));
  });

  it("returns null and empty candidates for empty messages", () => {
    const index = buildAssetResolutionIndex([]);

    expect(index.getChartPayloadByAssetId("missing")).toBeNull();
    expect(index.getGraphPayloadByAssetId("missing")).toBeNull();
    expect(index.listCandidates()).toEqual([]);
  });

  it("rebuilds lookups when the message set changes", () => {
    const first = buildAssetResolutionIndex(buildMessages());
    const second = buildAssetResolutionIndex(buildMessages().slice(1));

    expect(first.getChartPayloadByAssetId("uf_chart_1")).not.toBeNull();
    expect(second.getChartPayloadByAssetId("uf_chart_1")).toBeNull();
    expect(second.getGraphPayloadByAssetId("uf_graph_1")).not.toBeNull();
  });

  it("uses one map lookup per chart payload resolution", () => {
    const originalGet = Map.prototype.get;
    const getSpy = vi.spyOn(Map.prototype, "get").mockImplementation(function patchedGet<TKey, TValue>(
      this: Map<TKey, TValue>,
      key: TKey,
    ) {
      return originalGet.call(this, key);
    });
    const index = buildAssetResolutionIndex(
      Array.from({ length: 500 }, (_, index) => ({
        id: `msg-${index}`,
        role: "assistant" as const,
        content: "",
        timestamp: new Date(`2026-04-11T12:${String(index % 60).padStart(2, "0")}:00.000Z`),
        parts: [
          { type: "tool_call", name: "generate_chart", args: { title: `Chart ${index}` } },
          {
            type: "tool_result",
            name: "generate_chart",
            result: { code: "flowchart TD\nA-->B", title: `Chart ${index}`, assetId: `uf_chart_${index}` },
          },
        ],
      })),
    );

    getSpy.mockClear();

    for (let chartIndex = 0; chartIndex < 100; chartIndex += 1) {
      expect(index.getChartPayloadByAssetId(`uf_chart_${chartIndex}`)).toEqual(
        expect.objectContaining({ title: `Chart ${chartIndex}` }),
      );
    }

    expect(getSpy).toHaveBeenCalledTimes(100);
  });

  it("memoizes the index when the messages identity is stable", () => {
    const messages = buildMessages();
    const { result, rerender } = renderHook(
      ({ currentMessages }) => useAssetResolutionIndex(currentMessages),
      { initialProps: { currentMessages: messages as ChatMessage[] } },
    );

    const first = result.current;
    rerender({ currentMessages: messages });
    expect(result.current).toBe(first);

    rerender({ currentMessages: [...messages] });
    expect(result.current).not.toBe(first);
  });
});
