import {
  isActiveRelationshipMemory,
  type RelationshipMemoryRecord,
  type RelationshipMemoryType,
} from "../entities/relationship-memory";
import type { RelationshipMemoryReader } from "./RelationshipMemoryRepository";

export interface RelationshipMemorySearchRequest {
  userId: string;
  conversationId?: string | null;
  query: string;
  memoryTypes?: readonly RelationshipMemoryType[];
  limit?: number;
}

export interface RelationshipMemorySearchResult {
  record: RelationshipMemoryRecord;
  score: number;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 2);
}

function scoreRecord(record: RelationshipMemoryRecord, query: string, tokens: readonly string[]): number {
  const summary = record.summary.toLowerCase();
  let score = 0;
  let matched = false;

  if (summary.includes(query)) {
    score += 8;
    matched = true;
  }

  for (const token of tokens) {
    if (summary.includes(token)) {
      score += 2;
      matched = true;
    }
    if (record.memoryType.includes(token)) {
      score += 3;
      matched = true;
    }
  }

  if (!matched) {
    return 0;
  }

  score += Math.round(record.confidence * 10);
  return score;
}

export class RelationshipMemorySearchService {
  constructor(private readonly relationshipMemoryReader: RelationshipMemoryReader) {}

  async search(
    request: RelationshipMemorySearchRequest,
  ): Promise<RelationshipMemorySearchResult[]> {
    const normalizedQuery = request.query.trim().toLowerCase();
    const tokens = tokenize(normalizedQuery);
    const limit = Math.min(Math.max(request.limit ?? 5, 1), 10);
    const memoryTypes = request.memoryTypes ? new Set(request.memoryTypes) : null;

    const sourceRecords = request.conversationId
      ? await this.relationshipMemoryReader.listActiveByConversation(request.conversationId)
      : await this.relationshipMemoryReader.listActiveByUser(request.userId, { limit: 50 });

    const filtered = sourceRecords.filter((record) => {
      if (!isActiveRelationshipMemory(record)) {
        return false;
      }
      if (memoryTypes && !memoryTypes.has(record.memoryType)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      return scoreRecord(record, normalizedQuery, tokens) > 0;
    });

    return filtered
      .map((record) => ({
        record,
        score: normalizedQuery ? scoreRecord(record, normalizedQuery, tokens) : 0,
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (right.record.updatedAt !== left.record.updatedAt) {
          return right.record.updatedAt.localeCompare(left.record.updatedAt);
        }
        return right.record.confidence - left.record.confidence;
      })
      .slice(0, limit);
  }
}