import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  assertSystemCommandName,
  assertSystemCommandTarget,
  validateSystemCommandPayload,
  assertBackupCommandStatus,
  assertRequesterMetadata,
} from "@/lib/appliance/backup/backup-command-validation";
import type {
  BackupCommandStatus,
  SystemCommand,
  SystemCommandName,
  SystemCommandRepository,
  SystemCommandTarget,
  RestoreCommandRepository,
  RestoreCommandRequest,
  SystemCommandQuery,
} from "@/lib/appliance/backup/types";

type SystemCommandRow = {
  id: string;
  target: SystemCommandTarget;
  command: SystemCommandName;
  status: BackupCommandStatus;
  payload_json: string;
  result_payload: string | null;
  error_message: string | null;
  requested_by_user_id: string | null;
  requested_by_role: SystemCommand["requestedByRole"];
  requested_from: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapSystemCommand(row: SystemCommandRow): SystemCommand {
  return {
    id: row.id,
    target: row.target,
    command: row.command,
    status: row.status,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    resultPayload: row.result_payload ? JSON.parse(row.result_payload) as Record<string, unknown> : null,
    errorMessage: row.error_message,
    requestedByUserId: row.requested_by_user_id,
    requestedByRole: row.requested_by_role,
    requestedFrom: row.requested_from,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BackupSystemCommandDataMapper implements SystemCommandRepository, RestoreCommandRepository, SystemCommandQuery {
  constructor(private readonly db: Database.Database) {}

  async enqueue(input: {
    target: SystemCommandTarget;
    command: SystemCommandName;
    status?: BackupCommandStatus;
    payload: Record<string, unknown>;
    requestedByUserId: string | null;
    requestedByRole: SystemCommand["requestedByRole"];
    requestedFrom: string;
  }): Promise<SystemCommand> {
    if (input.command === "restore.request") {
      throw new Error("Restore command enqueue is deferred until Phase 04C.");
    }
    return this.insertCommand({
      ...input,
      status: input.status ?? "pending",
    });
  }

  async findById(id: string): Promise<SystemCommand | null> {
    const row = this.db.prepare(
      `SELECT * FROM system_commands WHERE id = ?`,
    ).get(id) as SystemCommandRow | undefined;
    return row ? mapSystemCommand(row) : null;
  }

  async listRecentBackupRestore(limit: number, offset = 0): Promise<SystemCommand[]> {
    const rows = this.db.prepare(
      `SELECT * FROM system_commands
       WHERE target = 'rust_daemon'
         AND command IN ('backup.create', 'restore.request')
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    ).all(normalizeLimit(limit), normalizeOffset(offset)) as SystemCommandRow[];
    return rows.map(mapSystemCommand);
  }

  async listBySnapshotId(snapshotId: string): Promise<SystemCommand[]> {
    const rows = this.db.prepare(
      `SELECT * FROM system_commands
       WHERE target = 'rust_daemon'
         AND command IN ('backup.create', 'restore.request')
         AND json_extract(payload_json, '$.snapshotId') = ?
       ORDER BY created_at DESC, id DESC`,
    ).all(snapshotId) as SystemCommandRow[];
    return rows.map(mapSystemCommand);
  }

  async listByRestorePlanId(restorePlanId: string): Promise<SystemCommand[]> {
    const rows = this.db.prepare(
      `SELECT * FROM system_commands
       WHERE target = 'rust_daemon'
         AND command IN ('backup.create', 'restore.request')
         AND json_extract(payload_json, '$.restorePlanId') = ?
       ORDER BY created_at DESC, id DESC`,
    ).all(restorePlanId) as SystemCommandRow[];
    return rows.map(mapSystemCommand);
  }

  async listRecentOperationBackedCommands(limit: number, offset = 0): Promise<SystemCommand[]> {
    const rows = this.db.prepare(
      `SELECT * FROM system_commands
       WHERE target = 'rust_daemon'
         AND command IN ('backup.create', 'restore.request')
         AND json_type(payload_json, '$.operation') = 'object'
       ORDER BY updated_at DESC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    ).all(normalizeLimit(limit), normalizeOffset(offset)) as SystemCommandRow[];
    return rows.map(mapSystemCommand);
  }

  async listByOperationId(operationId: string, limit = 25): Promise<SystemCommand[]> {
    const rows = this.db.prepare(
      `SELECT * FROM system_commands
       WHERE target = 'rust_daemon'
         AND command IN ('backup.create', 'restore.request')
         AND json_extract(payload_json, '$.operation.operationId') = ?
       ORDER BY updated_at DESC, created_at DESC, id DESC
       LIMIT ?`,
    ).all(operationId, normalizeLimit(limit)) as SystemCommandRow[];
    return rows.map(mapSystemCommand);
  }

  async countByStatusForRustDaemon(): Promise<Partial<Record<BackupCommandStatus, number>>> {
    const rows = this.db.prepare(
      `SELECT status, COUNT(*) AS count
       FROM system_commands
       WHERE target = 'rust_daemon'
         AND command IN ('backup.create', 'restore.request')
       GROUP BY status`,
    ).all() as Array<{ status: BackupCommandStatus; count: number }>;
    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  }

  async hasActiveBackupOrRestoreCommand(): Promise<boolean> {
    const row = this.db.prepare(
      `SELECT COUNT(*) AS count
       FROM system_commands
       WHERE target = 'rust_daemon'
         AND command IN ('backup.create', 'restore.request')
         AND status IN ('pending', 'running')`,
    ).get() as { count: number };
    return row.count > 0;
  }

  async findLatestScheduledCommand(): Promise<SystemCommand | null> {
    const row = this.db.prepare(
      `SELECT * FROM system_commands
       WHERE target = 'rust_daemon'
         AND command = 'backup.create'
         AND json_extract(payload_json, '$.kind') = 'scheduled'
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    ).get() as SystemCommandRow | undefined;
    return row ? mapSystemCommand(row) : null;
  }

  async listSucceededScheduledBackupCommands(limit: number): Promise<SystemCommand[]> {
    const rows = this.db.prepare(
      `SELECT * FROM system_commands
       WHERE target = 'rust_daemon'
         AND command = 'backup.create'
         AND status = 'succeeded'
         AND json_extract(payload_json, '$.kind') = 'scheduled'
       ORDER BY updated_at DESC, created_at DESC, id DESC
       LIMIT ?`,
    ).all(normalizeLimit(limit)) as SystemCommandRow[];
    return rows.map(mapSystemCommand);
  }

  async enqueueRestoreRequest(input: {
    payload: RestoreCommandRequest;
    requestedByUserId: string | null;
    requestedByRole: SystemCommand["requestedByRole"];
    requestedFrom: string;
  }): Promise<SystemCommand> {
    return this.insertCommand({
      target: "rust_daemon",
      command: "restore.request",
      status: "pending",
      payload: input.payload,
      requestedByUserId: input.requestedByUserId,
      requestedByRole: input.requestedByRole,
      requestedFrom: input.requestedFrom,
    });
  }

  private async insertCommand(input: {
    target: SystemCommandTarget;
    command: SystemCommandName;
    status: BackupCommandStatus;
    payload: Record<string, unknown>;
    requestedByUserId: string | null;
    requestedByRole: SystemCommand["requestedByRole"];
    requestedFrom: string;
  }): Promise<SystemCommand> {
    assertSystemCommandTarget(input.target);
    assertSystemCommandName(input.command);
    assertBackupCommandStatus(input.status);
    validateSystemCommandPayload(input.command, input.payload);
    assertRequesterMetadata({
      command: input.command,
      payload: input.payload,
      requestedByRole: input.requestedByRole,
      requestedFrom: input.requestedFrom,
    });

    const id = `syscmd_${randomUUID()}`;
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO system_commands (
        id, target, command, status, payload_json, requested_by_user_id,
        requested_by_role, requested_from, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.target,
      input.command,
      input.status,
      JSON.stringify(input.payload),
      input.requestedByUserId,
      input.requestedByRole,
      input.requestedFrom,
      now,
      now,
    );

    const command = await this.findById(id);
    if (!command) {
      throw new Error(`Failed to read inserted system command ${id}.`);
    }
    return command;
  }
}

function normalizeLimit(limit: number): number {
  return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 25;
}

function normalizeOffset(offset: number): number {
  return Number.isSafeInteger(offset) && offset > 0 ? offset : 0;
}
