import { describe, it, expect, vi } from "vitest";
import { createSearchMyConversationsTool } from "@/core/use-cases/tools/search-my-conversations.tool";
import { InMemoryVectorStore } from "@/adapters/InMemoryVectorStore";
import type { VectorStore, EmbeddingRecord } from "@/core/search/ports/VectorStore";
import type { Embedder } from "@/core/search/ports/Embedder";
import type { ConversationMetadata } from "@/core/search/ports/Chunker";

function makeRecord(
  sourceId: string,
  content: string,
  embedding: number[],
  turnIndex: number,
): EmbeddingRecord {
  const meta: ConversationMetadata = {
    sourceType: "conversation",
    conversationId: sourceId.split("/")[1],
    userId: sourceId.split("/")[0],
    role: "user",
    turnIndex,
  };
  return {
    id: `${sourceId}-${turnIndex}`,
    sourceType: "conversation",
    sourceId,
    chunkIndex: turnIndex,
    chunkLevel: "passage",
    heading: null,
    content,
    embeddingInput: content,
    contentHash: "h",
    modelVersion: "test",
    embedding: new Float32Array(embedding),
    metadata: meta,
  };
}

function makeMockVectorStore(records: EmbeddingRecord[]): VectorStore {
  const store = new InMemoryVectorStore();
  store.upsert(records);
  return store;
}

function makeMockEmbedder(embedding: number[]): Embedder {
  return {
    embed: vi.fn().mockResolvedValue(new Float32Array(embedding)),
  } as unknown as Embedder;
}

describe("SearchMyConversationsCommand", () => {
  it("returns only the requesting user's conversations", async () => {
    const userARecord = makeRecord("userA/conv1", "Discussed clean arch", [1, 0, 0], 0);
    const userBRecord = makeRecord("userB/conv2", "Discussed testing", [0.9, 0.1, 0], 0);
    const vs = makeMockVectorStore([userARecord, userBRecord]);
    const embedder = makeMockEmbedder([1, 0, 0]);

    const tool = createSearchMyConversationsTool(vs, embedder);
    const result = await tool.command.execute(
      { query: "clean architecture" },
      { role: "AUTHENTICATED", userId: "userA" },
    );

    expect(result).toContain("clean arch");
    expect(result).not.toContain("testing");
  });

  it("returns no-history message when user has no conversations", async () => {
    const otherRecord = makeRecord("otherUser/conv1", "Other user's data", [1, 0, 0], 0);
    const vs = makeMockVectorStore([otherRecord]);
    const embedder = makeMockEmbedder([1, 0, 0]);

    const tool = createSearchMyConversationsTool(vs, embedder);
    const result = await tool.command.execute(
      { query: "anything" },
      { role: "AUTHENTICATED", userId: "lonelyUser" },
    );

    expect(result).toBe("No conversation history found to search.");
  });

  it("ignores stale anonymous prefixes after ownership migration", async () => {
    const staleAnonRecord = makeRecord("anon_123/conv1", "Old anonymous ownership", [1, 0, 0], 0);
    const migratedRecord = makeRecord("userA/conv1", "Now owned by userA", [0.95, 0.05, 0], 0);
    const vs = makeMockVectorStore([staleAnonRecord, migratedRecord]);
    const embedder = makeMockEmbedder([1, 0, 0]);

    const tool = createSearchMyConversationsTool(vs, embedder);
    const result = await tool.command.execute(
      { query: "ownership migration" },
      { role: "AUTHENTICATED", userId: "userA" },
    );

    expect(result).toContain("Now owned by userA");
    expect(result).not.toContain("Old anonymous ownership");
  });
});
