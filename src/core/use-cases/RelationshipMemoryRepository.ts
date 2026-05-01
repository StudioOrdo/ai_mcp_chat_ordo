import type { RelationshipMemoryRecord } from "../entities/relationship-memory";

export interface RelationshipMemoryReader {
  findById(id: string): Promise<RelationshipMemoryRecord | null>;
  listActiveByConversation(conversationId: string): Promise<RelationshipMemoryRecord[]>;
  listActiveByUser(userId: string, options?: { limit?: number }): Promise<RelationshipMemoryRecord[]>;
}

export interface RelationshipMemoryWriter {
  upsert(record: RelationshipMemoryRecord): Promise<RelationshipMemoryRecord>;
  markSuperseded(id: string, supersededById: string, updatedAt: string): Promise<RelationshipMemoryRecord | null>;
  transferOwnershipForConversations?(input: {
    conversationIds: readonly string[];
    previousUserId: string;
    userId: string;
    transferredAt?: string;
  }): Promise<RelationshipMemoryRecord[]>;
}

export interface RelationshipMemoryRepository extends RelationshipMemoryReader, RelationshipMemoryWriter {}
