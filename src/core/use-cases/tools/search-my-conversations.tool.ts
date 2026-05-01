import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolCommand } from "@/core/tool-registry/ToolCommand";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { VectorStore } from "@/core/search/ports/VectorStore";
import type { Embedder } from "@/core/search/ports/Embedder";
import type { ConversationSearchResult } from "@/core/search/types";
import type { ConversationMetadata } from "@/core/search/ports/Chunker";
import { l2Normalize } from "@/core/search/l2Normalize";

interface SearchInput {
  query: string;
  max_results?: number;
}

class SearchMyConversationsCommand implements ToolCommand<SearchInput, string> {
  constructor(
    private readonly vectorStore: VectorStore,
    private readonly embedder: Embedder,
  ) {}

  async execute(input: SearchInput, context?: ToolExecutionContext): Promise<string> {
    const userId = context?.userId;
    if (!userId) return "Unable to search: no user context.";

    const maxResults = Math.min(Math.max(input.max_results ?? 5, 1), 10);

    // Vector similarity search
    const queryEmbedding = l2Normalize(await this.embedder.embed(input.query));
    const candidates = this.vectorStore.searchSimilar({
      embedding: queryEmbedding,
      filters: {
        sourceType: "conversation",
        chunkLevel: "passage",
        sourceIdPrefix: `${userId}/`,
      },
      limit: maxResults,
    });

    if (candidates.length === 0) {
      return "No conversation history found to search.";
    }

    const records = this.vectorStore.hydrateByIds(candidates.map((candidate) => candidate.id));
    const recordsById = new Map(records.map((record) => [record.id, record]));

    const results: ConversationSearchResult[] = candidates.flatMap((item, rank) => {
      const record = recordsById.get(item.id);
      if (!record) {
        return [];
      }
      const meta = record.metadata as ConversationMetadata;
      return {
        conversationId: meta.conversationId,
        conversationTitle: "",
        conversationDate: "",
        matchPassage: record.content,
        matchHighlight: record.content,
        turnIndex: meta.turnIndex,
        rrfScore: item.score,
        relevance: rank < 2 ? "high" : rank < 5 ? "medium" : "low",
      };
    });

    if (results.length === 0) {
      return "No matching conversations found.";
    }

    return results
      .map((r, i) => {
        const relevanceTag = `[${r.relevance}]`;
        return `${i + 1}. ${relevanceTag} (turn ${r.turnIndex})\n${r.matchPassage}`;
      })
      .join("\n\n");
  }
}

export function createSearchMyConversationsTool(
  vectorStore: VectorStore,
  embedder: Embedder,
): ToolDescriptor {
  return {
    name: "search_my_conversations",
    schema: {
      description: "Search your own conversation history to recall past discussions.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
          max_results: { type: "number", description: "Max results (1-10)." },
        },
        required: ["query"],
      },
    },
    command: new SearchMyConversationsCommand(vectorStore, embedder),
    roles: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
    category: "content",
  };
}
