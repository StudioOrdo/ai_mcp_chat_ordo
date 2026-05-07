import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  RESTORE_STATUSES,
  type RestorePlan,
  type RestorePlanImpactSummary,
  type RestorePlanQuery,
  type RestorePlanRepository,
  type RestoreStatus,
} from "@/lib/appliance/backup/types";

type RestorePlanRow = {
  id: string;
  snapshot_id: string;
  status: RestoreStatus;
  archive_path: string;
  archive_hash: string;
  archive_size_bytes: number;
  manifest_schema_version: string;
  app_version: string;
  restore_plan_version: string;
  impact_json: string;
  validation_warnings_json: string;
  confirmation_phrase: string;
  pre_restore_backup_command_id: string | null;
  pre_restore_backup_snapshot_id: string | null;
  restore_command_id: string | null;
  confirmed_by_user_id: string | null;
  confirmed_at: string | null;
  failure_message: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapRestorePlan(row: RestorePlanRow): RestorePlan {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    status: row.status,
    archivePath: row.archive_path,
    archiveHash: row.archive_hash,
    archiveSizeBytes: row.archive_size_bytes,
    manifestSchemaVersion: row.manifest_schema_version,
    appVersion: row.app_version,
    restorePlanVersion: row.restore_plan_version,
    impact: JSON.parse(row.impact_json) as RestorePlanImpactSummary,
    validationWarnings: JSON.parse(row.validation_warnings_json) as string[],
    confirmationPhrase: row.confirmation_phrase,
    preRestoreBackupCommandId: row.pre_restore_backup_command_id,
    preRestoreBackupSnapshotId: row.pre_restore_backup_snapshot_id,
    restoreCommandId: row.restore_command_id,
    confirmedByUserId: row.confirmed_by_user_id,
    confirmedAt: row.confirmed_at,
    failureMessage: row.failure_message,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RestorePlanDataMapper implements RestorePlanRepository, RestorePlanQuery {
  constructor(private readonly db: Database.Database) {}

  async createDraft(input: {
    id?: string;
    snapshotId: string;
    archivePath: string;
    archiveHash: string;
    archiveSizeBytes: number;
    manifestSchemaVersion: string;
    appVersion: string;
    restorePlanVersion: string;
    impact: RestorePlanImpactSummary;
    validationWarnings: string[];
    confirmationPhrase: string;
    createdByUserId: string | null;
  }): Promise<RestorePlan> {
    assertRestorePlanMetadata(input);
    const id = input.id ?? `restore_${randomUUID()}`;
    if (!/^restore_[A-Za-z0-9-]+$/.test(id)) {
      throw new Error("Restore plan id must use the restore_ prefix.");
    }
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO restore_plans (
        id, snapshot_id, status, archive_path, archive_hash, archive_size_bytes,
        manifest_schema_version, app_version, restore_plan_version, impact_json,
        validation_warnings_json, confirmation_phrase, created_by_user_id,
        created_at, updated_at
      ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.snapshotId,
      input.archivePath,
      input.archiveHash,
      input.archiveSizeBytes,
      input.manifestSchemaVersion,
      input.appVersion,
      input.restorePlanVersion,
      JSON.stringify(input.impact),
      JSON.stringify(input.validationWarnings),
      input.confirmationPhrase,
      input.createdByUserId,
      now,
      now,
    );

    return this.readRequired(id);
  }

  async findById(id: string): Promise<RestorePlan | null> {
    const row = this.db.prepare(
      `SELECT * FROM restore_plans WHERE id = ?`,
    ).get(id) as RestorePlanRow | undefined;
    return row ? mapRestorePlan(row) : null;
  }

  async listRecent(limit: number, offset = 0): Promise<RestorePlan[]> {
    const rows = this.db.prepare(
      `SELECT * FROM restore_plans
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    ).all(normalizeLimit(limit), normalizeOffset(offset)) as RestorePlanRow[];
    return rows.map(mapRestorePlan);
  }

  async findActiveBySnapshotId(snapshotId: string): Promise<RestorePlan | null> {
    const row = this.db.prepare(
      `SELECT * FROM restore_plans
       WHERE snapshot_id = ?
         AND status IN ('draft', 'validated', 'confirmation_required', 'confirmed', 'running')
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    ).get(snapshotId) as RestorePlanRow | undefined;
    return row ? mapRestorePlan(row) : null;
  }

  async hasRestoreInProgressOrArmed(): Promise<boolean> {
    const row = this.db.prepare(
      `SELECT COUNT(*) AS count
       FROM restore_plans
       WHERE status IN ('confirmed', 'running')`,
    ).get() as { count: number };
    return row.count > 0;
  }

  async markValidated(id: string): Promise<RestorePlan> {
    await this.assertCurrentStatus(id, ["draft"]);
    return this.markStatus(id, "validated");
  }

  async markConfirmationRequired(id: string): Promise<RestorePlan> {
    await this.assertCurrentStatus(id, ["validated"]);
    return this.markStatus(id, "confirmation_required");
  }

  async markConfirmed(input: {
    id: string;
    confirmedByUserId: string | null;
  }): Promise<RestorePlan> {
    await this.assertCurrentStatus(input.id, ["confirmation_required"]);
    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE restore_plans
       SET status = 'confirmed',
           confirmed_by_user_id = ?,
           confirmed_at = ?,
           failure_message = NULL,
           updated_at = ?
       WHERE id = ?`,
    ).run(input.confirmedByUserId, now, now, input.id);

    return this.readRequired(input.id);
  }

  async markPreRestoreBackupRequired(input: {
    id: string;
    commandId: string;
  }): Promise<RestorePlan> {
    await this.assertCurrentStatus(input.id, ["confirmed"]);
    if (!input.commandId.trim()) {
      throw new Error("Restore plan pre-restore backup command id is required.");
    }
    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE restore_plans
       SET pre_restore_backup_command_id = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(input.commandId, now, input.id);

    return this.readRequired(input.id);
  }

  async linkPreRestoreBackupSnapshot(input: {
    id: string;
    snapshotId: string;
  }): Promise<RestorePlan> {
    await this.assertCurrentStatus(input.id, ["confirmed"]);
    if (!input.snapshotId.trim()) {
      throw new Error("Restore plan pre-restore backup snapshot id is required.");
    }
    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE restore_plans
       SET pre_restore_backup_snapshot_id = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(input.snapshotId, now, input.id);

    return this.readRequired(input.id);
  }

  async markRunning(input: {
    id: string;
    restoreCommandId: string;
  }): Promise<RestorePlan> {
    await this.assertCurrentStatus(input.id, ["confirmed"]);
    if (!input.restoreCommandId.trim()) {
      throw new Error("Restore plan restore command id is required.");
    }
    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE restore_plans
       SET status = 'running',
           restore_command_id = ?,
           failure_message = NULL,
           updated_at = ?
       WHERE id = ?`,
    ).run(input.restoreCommandId, now, input.id);

    return this.readRequired(input.id);
  }

  async markSucceeded(id: string): Promise<RestorePlan> {
    await this.assertCurrentStatus(id, ["running"]);
    return this.markStatus(id, "succeeded");
  }

  async markFailed(input: {
    id: string;
    failureMessage: string;
  }): Promise<RestorePlan> {
    const current = await this.readRequired(input.id);
    if (current.status === "succeeded") {
      throw new Error("Restore plan cannot fail after it has succeeded.");
    }
    const message = input.failureMessage.trim();
    if (!message) {
      throw new Error("Restore plan failure message is required.");
    }
    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE restore_plans
       SET status = 'failed',
           failure_message = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(message, now, input.id);

    return this.readRequired(input.id);
  }

  async markCancelled(input: {
    id: string;
    failureMessage?: string | null;
  }): Promise<RestorePlan> {
    const current = await this.readRequired(input.id);
    if (current.status === "succeeded" || current.status === "running") {
      throw new Error(`Restore plan cannot be cancelled from ${current.status}.`);
    }
    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE restore_plans
       SET status = 'cancelled',
           failure_message = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(input.failureMessage?.trim() || null, now, input.id);

    return this.readRequired(input.id);
  }

  private async markStatus(id: string, status: RestoreStatus): Promise<RestorePlan> {
    assertRestoreStatus(status);
    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE restore_plans
       SET status = ?,
           failure_message = NULL,
           updated_at = ?
       WHERE id = ?`,
    ).run(status, now, id);

    return this.readRequired(id);
  }

  private async readRequired(id: string): Promise<RestorePlan> {
    const plan = await this.findById(id);
    if (!plan) {
      throw new Error(`Restore plan not found: ${id}`);
    }
    return plan;
  }

  private async assertCurrentStatus(id: string, allowed: RestoreStatus[]): Promise<void> {
    const current = await this.readRequired(id);
    if (!allowed.includes(current.status)) {
      throw new Error(`Restore plan cannot transition from ${current.status}.`);
    }
  }
}

function normalizeLimit(limit: number): number {
  return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 25;
}

function normalizeOffset(offset: number): number {
  return Number.isSafeInteger(offset) && offset > 0 ? offset : 0;
}

function assertRestoreStatus(value: string): asserts value is RestoreStatus {
  if (!RESTORE_STATUSES.includes(value as RestoreStatus)) {
    throw new Error(`Invalid restore status: ${value}`);
  }
}

function assertRestorePlanMetadata(input: {
  snapshotId: string;
  archivePath: string;
  archiveHash: string;
  archiveSizeBytes: number;
  manifestSchemaVersion: string;
  appVersion: string;
  restorePlanVersion: string;
  confirmationPhrase: string;
}): void {
  if (!input.snapshotId.trim()) {
    throw new Error("Restore plan snapshot id is required.");
  }
  if (!input.archivePath.trim()) {
    throw new Error("Restore plan archive path is required.");
  }
  if (!/^sha256:[a-f0-9]{64}$/i.test(input.archiveHash)) {
    throw new Error("Restore plan archive hash must be a sha256 digest.");
  }
  if (!Number.isSafeInteger(input.archiveSizeBytes) || input.archiveSizeBytes <= 0) {
    throw new Error("Restore plan archive size must be a positive integer.");
  }
  if (!input.manifestSchemaVersion.trim()) {
    throw new Error("Restore plan manifest schema version is required.");
  }
  if (!input.appVersion.trim()) {
    throw new Error("Restore plan app version is required.");
  }
  if (!input.restorePlanVersion.trim()) {
    throw new Error("Restore plan version is required.");
  }
  if (!input.confirmationPhrase.trim()) {
    throw new Error("Restore plan confirmation phrase is required.");
  }
}
