import type { RoleName } from "@/core/entities/user";
import { redactSecrets } from "@/lib/observability/secret-redaction";
import {
  BACKUP_COMMAND_STATUSES,
  BACKUP_INTERVALS,
  BACKUP_KINDS,
  SYSTEM_COMMAND_NAMES,
  SYSTEM_COMMAND_TARGETS,
  type BackupCommandStatus,
  type BackupInterval,
  type BackupKind,
  type SystemCommandName,
  type SystemCommandTarget,
} from "./types";

const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|password|bearer|authorization|credential)/i;

function assertInSet<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

export function assertBackupCommandStatus(value: string): asserts value is BackupCommandStatus {
  assertInSet(value, BACKUP_COMMAND_STATUSES, "backup command status");
}

export function assertBackupKind(value: string): asserts value is BackupKind {
  assertInSet(value, BACKUP_KINDS, "backup kind");
}

export function assertBackupInterval(value: string): asserts value is BackupInterval {
  assertInSet(value, BACKUP_INTERVALS, "backup interval");
}

export function assertSystemCommandTarget(value: string): asserts value is SystemCommandTarget {
  assertInSet(value, SYSTEM_COMMAND_TARGETS, "system command target");
}

export function assertSystemCommandName(value: string): asserts value is SystemCommandName {
  assertInSet(value, SYSTEM_COMMAND_NAMES, "system command name");
}

export function assertAdminRole(role: RoleName): void {
  if (role !== "ADMIN") {
    throw new Error("Backup governance commands require ADMIN role.");
  }
}

export function assertRequesterMetadata(input: {
  command: SystemCommandName;
  payload: Record<string, unknown>;
  requestedByRole: RoleName | null;
  requestedFrom: string;
}): void {
  if (input.requestedFrom.trim().length === 0) {
    throw new Error("Backup governance command requires requestedFrom.");
  }

  if (input.command === "backup.create" && (
    input.payload.kind === "manual" || input.payload.kind === "pre_restore"
  )) {
    if (input.requestedByRole !== "ADMIN") {
      throw new Error("Manual and pre-restore backup commands require ADMIN requester role.");
    }
  }
}

export function assertRetentionCount(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 365) {
    throw new Error("Backup retention count must be an integer between 1 and 365.");
  }
}

function inspectSecretKeys(value: unknown, path: string[] = []): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = [...path, key];
    if (SECRET_KEY_PATTERN.test(key)) {
      return nextPath.join(".");
    }

    const nestedMatch = inspectSecretKeys(nested, nextPath);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

export function assertNoSecretLikeKeys(payload: Record<string, unknown>): void {
  const match = inspectSecretKeys(payload);
  if (match) {
    throw new Error(`Backup governance payload contains secret-like key: ${match}`);
  }
}

export function redactAuditMetadata(input: Record<string, unknown>): Record<string, unknown> {
  return redactSecrets(input).value as Record<string, unknown>;
}

export function validateBackupCreatePayload(payload: Record<string, unknown>): void {
  assertNoSecretLikeKeys(payload);
  if (typeof payload.kind !== "string") {
    throw new Error("backup.create payload requires kind.");
  }
  assertBackupKind(payload.kind);
  if (typeof payload.requestedAt !== "string" || payload.requestedAt.trim().length === 0) {
    throw new Error("backup.create payload requires requestedAt.");
  }
  if (typeof payload.snapshotId !== "string" || payload.snapshotId.trim().length === 0) {
    throw new Error("backup.create payload requires snapshotId.");
  }
  if (typeof payload.appVersion !== "string" || payload.appVersion.trim().length === 0) {
    throw new Error("backup.create payload requires appVersion.");
  }
  if (typeof payload.sourceRuntimeProfileId !== "string" || payload.sourceRuntimeProfileId.trim().length === 0) {
    throw new Error("backup.create payload requires sourceRuntimeProfileId.");
  }
  assertBackupDataBoundary(payload.dataBoundary);
  if (payload.kind === "pre_restore") {
    if (typeof payload.restorePlanId !== "string" || payload.restorePlanId.trim().length === 0) {
      throw new Error("backup.create pre_restore payload requires restorePlanId.");
    }
  }
  if (payload.kind === "scheduled") {
    validateOperationCommandMetadata(payload.operation, "backup_create", { required: false });
    return;
  }
  validateOperationCommandMetadata(
    payload.operation,
    payload.kind === "pre_restore" ? "restore_execute" : "backup_create",
    { required: true },
  );
}

function assertBackupDataBoundary(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("backup.create payload requires dataBoundary.");
  }
  const boundary = value as Record<string, unknown>;
  for (const key of ["dataDir", "sqlitePath", "blogAssetRoot", "userFileRoot"]) {
    if (typeof boundary[key] !== "string" || !boundary[key].trim()) {
      throw new Error(`backup.create dataBoundary requires ${key}.`);
    }
  }
}

export function validateRestoreRequestPayload(payload: Record<string, unknown>): void {
  assertNoSecretLikeKeys(payload);
  if (typeof payload.restorePlanId !== "string" || payload.restorePlanId.trim().length === 0) {
    throw new Error("restore.request payload requires restorePlanId.");
  }
  if (typeof payload.snapshotId !== "string" || payload.snapshotId.trim().length === 0) {
    throw new Error("restore.request payload requires snapshotId.");
  }
  if (typeof payload.archivePath !== "string" || payload.archivePath.trim().length === 0) {
    throw new Error("restore.request payload requires archivePath.");
  }
  if (typeof payload.expectedArchiveHash !== "string" || !/^sha256:[a-f0-9]{64}$/i.test(payload.expectedArchiveHash)) {
    throw new Error("restore.request payload requires expectedArchiveHash.");
  }
  if (!Number.isSafeInteger(payload.expectedArchiveSizeBytes) || Number(payload.expectedArchiveSizeBytes) <= 0) {
    throw new Error("restore.request payload requires expectedArchiveSizeBytes.");
  }
  if (typeof payload.manifestSchemaVersion !== "string" || payload.manifestSchemaVersion.trim().length === 0) {
    throw new Error("restore.request payload requires manifestSchemaVersion.");
  }
  if (typeof payload.restorePlanVersion !== "string" || payload.restorePlanVersion.trim().length === 0) {
    throw new Error("restore.request payload requires restorePlanVersion.");
  }
  if (typeof payload.requestedAt !== "string" || payload.requestedAt.trim().length === 0) {
    throw new Error("restore.request payload requires requestedAt.");
  }
  assertBackupDataBoundary(payload.dataBoundary);
  validateOperationCommandMetadata(payload.operation, "restore_execute", { required: true });
}

export function validateOperationCommandMetadata(
  value: unknown,
  expectedKind?: "backup_create" | "restore_execute",
  options: { required?: boolean } = {},
): void {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new Error("operation metadata is required.");
    }
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("operation metadata must be an object when present.");
  }
  const metadata = value as Record<string, unknown>;
  for (const key of ["operationId", "stepId", "actionId"]) {
    if (typeof metadata[key] !== "string" || !metadata[key].trim()) {
      throw new Error(`operation metadata requires ${key}.`);
    }
  }
  if (metadata.operationKind !== "backup_create" && metadata.operationKind !== "restore_execute") {
    throw new Error("operation metadata requires operationKind backup_create or restore_execute.");
  }
  if (expectedKind && metadata.operationKind !== expectedKind) {
    throw new Error(`operation metadata operationKind must be ${expectedKind}.`);
  }
}

export function validateSystemCommandPayload(
  command: SystemCommandName,
  payload: Record<string, unknown>,
): void {
  if (command === "backup.create") {
    validateBackupCreatePayload(payload);
    return;
  }

  validateRestoreRequestPayload(payload);
}
