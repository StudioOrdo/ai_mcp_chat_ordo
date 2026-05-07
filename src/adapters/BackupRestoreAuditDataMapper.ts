import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { redactAuditMetadata } from "@/lib/appliance/backup/backup-command-validation";
import type {
  BackupOperationAuditEvent,
  BackupOperationKind,
  BackupRestoreAuditQuery,
  BackupRestoreAuditRepository,
} from "@/lib/appliance/backup/types";
import type { RoleName } from "@/core/entities/user";

type BackupRestoreAuditEventRow = {
  id: string;
  operation_id: string;
  operation_kind: BackupOperationKind;
  event_type: string;
  actor_user_id: string | null;
  actor_role: RoleName | null;
  metadata_json: string;
  created_at: string;
};

function mapAuditEvent(row: BackupRestoreAuditEventRow): BackupOperationAuditEvent {
  return {
    id: row.id,
    operationId: row.operation_id,
    operationKind: row.operation_kind,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export class BackupRestoreAuditDataMapper implements BackupRestoreAuditRepository, BackupRestoreAuditQuery {
  constructor(private readonly db: Database.Database) {}

  async append(input: {
    operationId: string;
    operationKind: BackupOperationKind;
    eventType: string;
    actorUserId: string | null;
    actorRole: RoleName | null;
    metadata: Record<string, unknown>;
  }): Promise<BackupOperationAuditEvent> {
    const id = `backupaudit_${randomUUID()}`;
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO backup_restore_audit_events (
        id, operation_id, operation_kind, event_type, actor_user_id,
        actor_role, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.operationId,
      input.operationKind,
      input.eventType,
      input.actorUserId,
      input.actorRole,
      JSON.stringify(redactAuditMetadata(input.metadata)),
      now,
    );

    const event = await this.findById(id);
    if (!event) {
      throw new Error(`Failed to read inserted backup audit event ${id}.`);
    }
    return event;
  }

  async findById(id: string): Promise<BackupOperationAuditEvent | null> {
    const row = this.db.prepare(
      `SELECT * FROM backup_restore_audit_events WHERE id = ?`,
    ).get(id) as BackupRestoreAuditEventRow | undefined;
    return row ? mapAuditEvent(row) : null;
  }

  async listByOperationId(operationId: string, limit = 50): Promise<BackupOperationAuditEvent[]> {
    const rows = this.db.prepare(
      `SELECT * FROM backup_restore_audit_events
       WHERE operation_id = ?
       ORDER BY created_at ASC, id ASC
       LIMIT ?`,
    ).all(operationId, normalizeLimit(limit)) as BackupRestoreAuditEventRow[];
    return rows.map(mapAuditEvent);
  }
}

function normalizeLimit(limit: number): number {
  return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;
}
