import { describe, expect, it } from "vitest";

import type { RelationshipMemoryReader } from "./RelationshipMemoryRepository";
import { RelationshipMemorySearchService } from "./RelationshipMemorySearchService";

function createReader(): RelationshipMemoryReader {
  return {
    findById: async () => null,
    listActiveByConversation: async () => [
      {
        id: "mem_goal",
        userId: "usr_1",
        conversationId: "conv_1",
        memoryType: "goal",
        summary: "Launch the revenue triage offer this month.",
        evidenceRefs: [],
        status: "active",
        confidence: 0.9,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      },
      {
        id: "mem_pref",
        userId: "usr_1",
        conversationId: "conv_1",
        memoryType: "preference",
        summary: "Prefers concise operator summaries with NOW, NEXT, WAIT.",
        evidenceRefs: [],
        status: "active",
        confidence: 0.8,
        createdAt: "2026-04-02T00:00:00.000Z",
        updatedAt: "2026-04-11T00:00:00.000Z",
      },
    ],
    listActiveByUser: async () => [],
  };
}

describe("RelationshipMemorySearchService", () => {
  it("returns matching active memory records ordered by score", async () => {
    const service = new RelationshipMemorySearchService(createReader());

    const results = await service.search({
      userId: "usr_1",
      conversationId: "conv_1",
      query: "launch offer",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.record.memoryType).toBe("goal");
  });

  it("filters by memory type when requested", async () => {
    const service = new RelationshipMemorySearchService(createReader());

    const results = await service.search({
      userId: "usr_1",
      conversationId: "conv_1",
      query: "concise operator",
      memoryTypes: ["preference"],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.record.memoryType).toBe("preference");
  });
});