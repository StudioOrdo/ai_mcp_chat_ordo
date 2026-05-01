import { describe, expect, it, vi } from "vitest";

import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";

import {
  prepareFallbackContext,
  prepareStreamContext,
} from "./stream-preparation";

function createBuilder() {
  const builder = {
    withConversationSummary: vi.fn(() => builder),
    withRoutingContext: vi.fn(() => builder),
    withSection: vi.fn(() => builder),
  };

  return builder;
}

describe("stream-preparation", () => {
  it("injects media continuity context into primary stream preparation", async () => {
    const builder = createBuilder();
    const routingSnapshot = createConversationRoutingSnapshot({
      lane: "development",
      confidence: 0.92,
    });

    const prepared = await prepareStreamContext({
      builder: builder as never,
      interactor: {
        getForStreamingContext: vi.fn().mockResolvedValue({
          conversation: { routingSnapshot },
          messages: [],
        }),
        updateRoutingSnapshot: vi.fn().mockResolvedValue(undefined),
      } as never,
      routingAnalyzer: {
        analyze: vi.fn().mockResolvedValue(routingSnapshot),
      } as never,
      relationshipMemoryReader: {
        listActiveByConversation: vi.fn().mockResolvedValue([]),
      } as never,
      conversationId: "conv_media_1",
      userId: "usr_1",
      incomingMessages: [{ role: "user", content: "combine them" }],
      latestUserText: "combine them",
      latestUserContent: "combine them",
      taskOriginHandoff: null,
      mediaContinuityHandoff: {
        assets: [
          { assetId: "uf_chart_1", kind: "chart", aliases: ["growth chart"] },
          { assetId: "uf_audio_1", kind: "audio", aliases: ["growth narration"] },
        ],
      },
    });

    expect(prepared.mode).toBe("primary");
    expect(builder.withSection).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "media_continuity_handoff",
        priority: 88,
        content: expect.stringContaining("uf_chart_1"),
        payload: {
          assets: [
            { assetId: "uf_chart_1", kind: "chart", aliases: ["growth chart"] },
            { assetId: "uf_audio_1", kind: "audio", aliases: ["growth narration"] },
          ],
        },
      }),
    );
    expect(builder.withSection).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "media_continuity_handoff",
        content: expect.stringContaining("uf_audio_1"),
      }),
    );
  });

  it("injects canonical relationship memory into primary stream preparation", async () => {
    const builder = createBuilder();
    const routingSnapshot = createConversationRoutingSnapshot();

    await prepareStreamContext({
      builder: builder as never,
      interactor: {
        getForStreamingContext: vi.fn().mockResolvedValue({
          conversation: { routingSnapshot },
          messages: [],
        }),
        updateRoutingSnapshot: vi.fn().mockResolvedValue(undefined),
      } as never,
      routingAnalyzer: {
        analyze: vi.fn().mockResolvedValue(routingSnapshot),
      } as never,
      relationshipMemoryReader: {
        listActiveByConversation: vi.fn().mockResolvedValue([
          {
            id: "mem_goal_1",
            userId: "usr_1",
            conversationId: "conv_media_1",
            memoryType: "goal",
            summary: "Goal: launch the new offer",
            evidenceRefs: [],
            status: "active",
            confidence: 0.86,
            createdAt: "2026-04-29T10:00:00.000Z",
            updatedAt: "2026-04-29T10:00:00.000Z",
          },
          {
            id: "mem_decision_1",
            userId: "usr_1",
            conversationId: "conv_media_1",
            memoryType: "decision",
            summary: "Decision: start with a worksheet",
            evidenceRefs: [],
            status: "active",
            confidence: 0.88,
            createdAt: "2026-04-29T10:05:00.000Z",
            updatedAt: "2026-04-29T10:05:00.000Z",
          },
        ]),
      } as never,
      conversationId: "conv_media_1",
      userId: "usr_1",
      incomingMessages: [{ role: "user", content: "what next" }],
      latestUserText: "what next",
      latestUserContent: "what next",
      taskOriginHandoff: null,
      mediaContinuityHandoff: null,
    });

    expect(builder.withSection).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "relationship_memory",
        priority: 44,
        content: expect.stringContaining("[Relationship memory]"),
        payload: {
          memoryRefs: [
            { id: "mem_goal_1", memoryType: "goal", updatedAt: "2026-04-29T10:00:00.000Z" },
            { id: "mem_decision_1", memoryType: "decision", updatedAt: "2026-04-29T10:05:00.000Z" },
          ],
        },
      }),
    );
    expect(builder.withSection).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "relationship_memory",
        content: expect.stringContaining("Goal: launch the new offer"),
      }),
    );
  });

  it("injects media continuity context into fallback stream preparation", async () => {
    const builder = createBuilder();

    const prepared = await prepareFallbackContext({
      builder: builder as never,
      incomingMessages: [{ role: "user", content: "combine them" }],
      latestUserContent: "combine them",
      taskOriginHandoff: null,
      mediaContinuityHandoff: {
        assets: [
          { assetId: "uf_chart_1", kind: "chart", aliases: ["growth chart"] },
          { assetId: "uf_audio_1", kind: "audio", aliases: ["growth narration"] },
        ],
      },
    });

    expect(prepared.mode).toBe("fallback");
    expect(builder.withSection).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "media_continuity_handoff",
        priority: 88,
        content: expect.stringContaining("growth narration"),
        payload: {
          assets: [
            { assetId: "uf_chart_1", kind: "chart", aliases: ["growth chart"] },
            { assetId: "uf_audio_1", kind: "audio", aliases: ["growth narration"] },
          ],
        },
      }),
    );
  });
});