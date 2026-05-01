import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import { buildCatalogBoundToolDescriptor } from "@/core/capability-catalog/runtime-tool-projection";
import type { RelationshipMemoryType } from "@/core/entities/relationship-memory";
import { RelationshipMemorySearchService } from "@/core/use-cases/RelationshipMemorySearchService";

export interface SearchRelationshipMemoryInput {
  query: string;
  max_results?: number;
  memory_types?: RelationshipMemoryType[];
}

const RELATIONSHIP_MEMORY_TYPES: readonly RelationshipMemoryType[] = [
  "goal",
  "preference",
  "decision",
  "commitment",
  "open_question",
  "milestone",
  "asset_context",
];

function isRelationshipMemoryType(value: string): value is RelationshipMemoryType {
  return RELATIONSHIP_MEMORY_TYPES.includes(value as RelationshipMemoryType);
}

function formatResultLine(
  index: number,
  result: Awaited<ReturnType<RelationshipMemorySearchService["search"]>>[number],
): string {
  const evidence = result.record.evidenceRefs
    .slice(0, 2)
    .map((ref) => ref.source.sourceKind === "message" ? `message:${ref.source.sourceId}` : ref.source.sourceKind)
    .join(", ");

  const evidenceSuffix = evidence ? `\nEvidence: ${evidence}` : "";
  return `${index + 1}. [${result.record.memoryType}] ${result.record.summary}${evidenceSuffix}`;
}

export function parseSearchRelationshipMemoryInput(value: unknown): SearchRelationshipMemoryInput {
  if (!value || typeof value !== "object") {
    throw new Error("search_relationship_memory input must be an object.");
  }

  const record = value as Record<string, unknown>;
  const query = typeof record.query === "string" ? record.query.trim() : "";
  if (!query) {
    throw new Error("search_relationship_memory requires a non-empty query.");
  }

  let maxResults: number | undefined;
  if (record.max_results !== undefined) {
    if (typeof record.max_results !== "number" || !Number.isFinite(record.max_results) || record.max_results <= 0) {
      throw new Error("search_relationship_memory max_results must be a positive number.");
    }
    maxResults = Math.floor(record.max_results);
  }

  let memoryTypes: RelationshipMemoryType[] | undefined;
  if (record.memory_types !== undefined) {
    if (!Array.isArray(record.memory_types)) {
      throw new Error("search_relationship_memory memory_types must be an array.");
    }
    memoryTypes = record.memory_types.map((value) => {
      if (typeof value !== "string" || !isRelationshipMemoryType(value)) {
        throw new Error(`search_relationship_memory memory_types contains unsupported value: ${String(value)}`);
      }
      return value;
    });
  }

  return {
    query,
    max_results: maxResults,
    memory_types: memoryTypes,
  };
}

export function createSearchRelationshipMemoryTool(
  searchService: RelationshipMemorySearchService,
) {
  return buildCatalogBoundToolDescriptor(CAPABILITY_CATALOG.search_relationship_memory, {
    parse: parseSearchRelationshipMemoryInput,
    execute: async (input, context) => {
      const userId = context?.userId;
      if (!userId) {
        return "Unable to search relationship memory: no user context.";
      }

      const results = await searchService.search({
        userId,
        conversationId: context?.conversationId,
        query: input.query,
        limit: input.max_results,
        memoryTypes: input.memory_types,
      });

      if (results.length === 0) {
        return `No active relationship memory matched \"${input.query}\".`;
      }

      return results.map((result, index) => formatResultLine(index, result)).join("\n\n");
    },
  });
}