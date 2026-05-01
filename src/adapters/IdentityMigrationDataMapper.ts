import type Database from "better-sqlite3";

import type {
  IdentityMigrationEvent,
  IdentityMigrationObjectCount,
  IdentityMigrationRepairRef,
  IdentityMigrationStage,
  IdentityMigrationStatus,
} from "@/core/entities/identity-migration";
import type { IdentityMigrationRepository } from "@/core/use-cases/IdentityMigrationRepository";

interface IdentityMigrationRow {
  id: string;
  source_user_id: string;
  target_user_id: string;
  migrated_conversation_ids_json: string;
  migrated_job_ids_json: string;
  migrated_asset_ids_json: string;
  repaired_memory_refs_json: string;
  repaired_search_source_ids_json: string;
  object_counts_json: string;
  repair_refs_json: string;
  status: IdentityMigrationStatus;
  current_stage: IdentityMigrationStage | null;
  failure_message: string | null;
  created_at: string;
  completed_at: string | null;
}

function parseJsonArray<T>(value: string): readonly T[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function mapRow(row: IdentityMigrationRow): IdentityMigrationEvent {
  return {
    id: row.id,
    sourceUserId: row.source_user_id,
    targetUserId: row.target_user_id,
    migratedConversationIds: parseJsonArray<string>(row.migrated_conversation_ids_json),
    migratedJobIds: parseJsonArray<string>(row.migrated_job_ids_json),
    migratedAssetIds: parseJsonArray<string>(row.migrated_asset_ids_json),
    repairedMemoryRefs: parseJsonArray<string>(row.repaired_memory_refs_json),
    repairedSearchSourceIds: parseJsonArray<string>(row.repaired_search_source_ids_json),
    objectCounts: parseJsonArray<IdentityMigrationObjectCount>(row.object_counts_json),
    repairRefs: parseJsonArray<IdentityMigrationRepairRef>(row.repair_refs_json),
    status: row.status,
    currentStage: row.current_stage ?? undefined,
    failureMessage: row.failure_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function serialize(event: IdentityMigrationEvent): Record<string, unknown> {
  return {
    id: event.id,
    source_user_id: event.sourceUserId,
    target_user_id: event.targetUserId,
    migrated_conversation_ids_json: JSON.stringify(event.migratedConversationIds),
    migrated_job_ids_json: JSON.stringify(event.migratedJobIds),
    migrated_asset_ids_json: JSON.stringify(event.migratedAssetIds),
    repaired_memory_refs_json: JSON.stringify(event.repairedMemoryRefs),
    repaired_search_source_ids_json: JSON.stringify(event.repairedSearchSourceIds),
    object_counts_json: JSON.stringify(event.objectCounts),
    repair_refs_json: JSON.stringify(event.repairRefs),
    status: event.status,
    current_stage: event.currentStage ?? null,
    failure_message: event.failureMessage ?? null,
    created_at: event.createdAt,
    completed_at: event.completedAt,
  };
}

export class IdentityMigrationDataMapper implements IdentityMigrationRepository {
  constructor(private readonly db: Database.Database) {}

  async record(event: IdentityMigrationEvent): Promise<IdentityMigrationEvent> {
    const payload = serialize(event);

    this.db.prepare(
      `INSERT INTO identity_migration_events (
         id,
         source_user_id,
         target_user_id,
         migrated_conversation_ids_json,
         migrated_job_ids_json,
         migrated_asset_ids_json,
         repaired_memory_refs_json,
         repaired_search_source_ids_json,
         object_counts_json,
         repair_refs_json,
         status,
         current_stage,
         failure_message,
         created_at,
         completed_at
       ) VALUES (
         @id,
         @source_user_id,
         @target_user_id,
         @migrated_conversation_ids_json,
         @migrated_job_ids_json,
         @migrated_asset_ids_json,
         @repaired_memory_refs_json,
         @repaired_search_source_ids_json,
         @object_counts_json,
         @repair_refs_json,
         @status,
         @current_stage,
         @failure_message,
         @created_at,
         @completed_at
       )
       ON CONFLICT(id) DO UPDATE SET
         migrated_conversation_ids_json = excluded.migrated_conversation_ids_json,
         migrated_job_ids_json = excluded.migrated_job_ids_json,
         migrated_asset_ids_json = excluded.migrated_asset_ids_json,
         repaired_memory_refs_json = excluded.repaired_memory_refs_json,
         repaired_search_source_ids_json = excluded.repaired_search_source_ids_json,
         object_counts_json = excluded.object_counts_json,
         repair_refs_json = excluded.repair_refs_json,
         status = excluded.status,
         current_stage = excluded.current_stage,
         failure_message = excluded.failure_message,
         completed_at = excluded.completed_at`,
    ).run(payload);

    return event;
  }

  async update(event: IdentityMigrationEvent): Promise<IdentityMigrationEvent> {
    return this.record(event);
  }

  async findById(id: string): Promise<IdentityMigrationEvent | null> {
    const row = this.db.prepare(
      `SELECT * FROM identity_migration_events WHERE id = ? LIMIT 1`,
    ).get(id) as IdentityMigrationRow | undefined;

    return row ? mapRow(row) : null;
  }

  async findLatestForSourceIdentity(sourceUserId: string): Promise<IdentityMigrationEvent | null> {
    const row = this.db.prepare(
      `SELECT * FROM identity_migration_events
       WHERE source_user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    ).get(sourceUserId) as IdentityMigrationRow | undefined;

    return row ? mapRow(row) : null;
  }

  async findLatestForTargetIdentity(targetUserId: string): Promise<IdentityMigrationEvent | null> {
    const row = this.db.prepare(
      `SELECT * FROM identity_migration_events
       WHERE target_user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    ).get(targetUserId) as IdentityMigrationRow | undefined;

    return row ? mapRow(row) : null;
  }
}
