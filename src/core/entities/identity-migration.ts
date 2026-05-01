import type { CanonicalEvidenceRef } from "./conversation-continuity";

export type IdentityMigrationStatus = "started" | "completed" | "failed" | "partially_repaired";
export type IdentityMigrationStage =
  | "started"
  | "conversation_transfer"
  | "search_repair"
  | "job_transfer"
  | "asset_transfer"
  | "materialization_transfer"
  | "relationship_memory_transfer"
  | "prompt_binding_transfer"
  | "prompt_provenance_policy"
  | "referral_repair"
  | "restore_verification"
  | "completed"
  | "failed";
export type IdentityMigrationObjectKind = "conversation" | "message" | "job" | "job_event" | "asset" | "materialization" | "relationship_memory" | "workspace_snapshot" | "search_source" | "prompt_binding" | "prompt_provenance" | "referral";

export interface IdentityMigrationObjectCount {
  kind: IdentityMigrationObjectKind;
  attempted: number;
  migrated: number;
  failed: number;
}

export interface IdentityMigrationRepairRef {
  kind: IdentityMigrationObjectKind;
  id: string;
  status: "repaired" | "failed" | "skipped";
  evidenceRefs: readonly CanonicalEvidenceRef[];
}

export interface IdentityMigrationEvent {
  id: string;
  sourceUserId: string;
  targetUserId: string;
  migratedConversationIds: readonly string[];
  migratedJobIds: readonly string[];
  migratedAssetIds: readonly string[];
  repairedMemoryRefs: readonly string[];
  repairedSearchSourceIds: readonly string[];
  objectCounts: readonly IdentityMigrationObjectCount[];
  repairRefs: readonly IdentityMigrationRepairRef[];
  status: IdentityMigrationStatus;
  currentStage?: IdentityMigrationStage;
  failureMessage?: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function isIdentityMigrationTerminal(event: IdentityMigrationEvent): boolean {
  return event.status === "completed" || event.status === "failed" || event.status === "partially_repaired";
}
