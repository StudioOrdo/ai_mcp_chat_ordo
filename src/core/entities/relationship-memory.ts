import type { CanonicalEvidenceRef } from "./conversation-continuity";

export type RelationshipMemoryType = "goal" | "preference" | "decision" | "commitment" | "open_question" | "milestone" | "asset_context";
export type RelationshipMemoryStatus = "active" | "resolved" | "superseded" | "retracted";

export interface RelationshipMemoryRecord {
  id: string;
  userId: string;
  conversationId: string;
  memoryType: RelationshipMemoryType;
  summary: string;
  evidenceRefs: readonly CanonicalEvidenceRef[];
  status: RelationshipMemoryStatus;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export function isActiveRelationshipMemory(record: RelationshipMemoryRecord): boolean {
  return record.status === "active";
}