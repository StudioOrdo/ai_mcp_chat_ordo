import {
  BACKUP_KINDS,
  type BackupKind,
} from "./types";
import { assertNoSecretLikeKeys } from "./backup-command-validation";

export const BACKUP_MANIFEST_SCHEMA_VERSION = "1" as const;
export const BACKUP_ARCHIVE_HASH_ALGORITHM = "sha256" as const;
export const BACKUP_RESTORE_PLAN_VERSION = "1" as const;

export type BackupManifestSchemaVersion = typeof BACKUP_MANIFEST_SCHEMA_VERSION;
export type BackupArchiveHashAlgorithm = typeof BACKUP_ARCHIVE_HASH_ALGORITHM;
export type BackupSqliteQuickIntegrityCheck = "ok" | "failed" | "skipped";

export interface BackupManifestRoot {
  name: "local.db" | "blog-assets" | "user-files";
  relativePath: string;
  optional: boolean;
  empty: boolean;
}

export interface BackupManifestSqlite {
  pathPolicy: "sqlite_backup_api_snapshot";
  relativePath: "data/local.db";
  quickIntegrityCheck: BackupSqliteQuickIntegrityCheck;
  pageCount?: number;
  userVersion?: number;
}

export interface BackupManifestArchive {
  hashAlgorithm: BackupArchiveHashAlgorithm;
}

export interface BackupManifestCompatibility {
  warnings: string[];
  requiresRestorePlanVersion: typeof BACKUP_RESTORE_PLAN_VERSION;
}

export interface BackupManifest {
  schemaVersion: BackupManifestSchemaVersion;
  appVersion: string;
  createdAt: string;
  backupId: string;
  kind: BackupKind;
  sourceRuntimeProfileId: string;
  sourceDataRoot: string;
  sqlite: BackupManifestSqlite;
  roots: BackupManifestRoot[];
  exclusions: {
    paths: string[];
    symlinks: "rejected";
    runtimeLogs: "excluded";
    existingBackups: "excluded";
  };
  archive: BackupManifestArchive;
  compatibility: BackupManifestCompatibility;
}

export interface BackupCompatibilityReport {
  compatible: boolean;
  errors: string[];
  warnings: string[];
  manifest: BackupManifest | null;
}

const REQUIRED_ROOTS: Array<BackupManifestRoot["name"]> = [
  "local.db",
  "blog-assets",
  "user-files",
];

export function createBackupCompatibilityReport(input: {
  manifest: unknown;
  expectedBackupId?: string;
}): BackupCompatibilityReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const manifest = isRecord(input.manifest) ? input.manifest : null;

  if (!manifest) {
    return {
      compatible: false,
      errors: ["Backup manifest must be a JSON object."],
      warnings,
      manifest: null,
    };
  }

  try {
    assertNoSecretLikeKeys(manifest);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Backup manifest contains a secret-like key.");
  }

  if (manifest.schemaVersion !== BACKUP_MANIFEST_SCHEMA_VERSION) {
    errors.push(`Unsupported backup manifest schema version: ${String(manifest.schemaVersion)}`);
  }
  if (typeof manifest.appVersion !== "string" || !manifest.appVersion.trim()) {
    errors.push("Backup manifest requires appVersion.");
  }
  if (typeof manifest.createdAt !== "string" || Number.isNaN(Date.parse(manifest.createdAt))) {
    errors.push("Backup manifest requires a valid createdAt timestamp.");
  }
  if (typeof manifest.backupId !== "string" || !manifest.backupId.trim()) {
    errors.push("Backup manifest requires backupId.");
  }
  if (input.expectedBackupId && manifest.backupId !== input.expectedBackupId) {
    errors.push("Backup manifest backupId does not match expected snapshot id.");
  }
  if (typeof manifest.kind !== "string" || !BACKUP_KINDS.includes(manifest.kind as BackupKind)) {
    errors.push(`Invalid backup manifest kind: ${String(manifest.kind)}`);
  }
  if (typeof manifest.sourceRuntimeProfileId !== "string" || !manifest.sourceRuntimeProfileId.trim()) {
    errors.push("Backup manifest requires sourceRuntimeProfileId.");
  }
  if (typeof manifest.sourceDataRoot !== "string" || !manifest.sourceDataRoot.trim()) {
    errors.push("Backup manifest requires sourceDataRoot.");
  }

  validateSqliteSection(manifest.sqlite, errors);
  validateRoots(manifest.roots, errors);
  validateExclusions(manifest.exclusions, errors);
  validateArchiveSection(manifest.archive, errors);
  validateCompatibilitySection(manifest.compatibility, errors, warnings);
  rejectCircularArchiveMetadata(manifest, errors);

  return {
    compatible: errors.length === 0,
    errors,
    warnings,
    manifest: errors.length === 0 ? manifest as unknown as BackupManifest : null,
  };
}

function validateSqliteSection(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("Backup manifest requires sqlite metadata.");
    return;
  }
  if (value.pathPolicy !== "sqlite_backup_api_snapshot") {
    errors.push("Backup manifest sqlite.pathPolicy must be sqlite_backup_api_snapshot.");
  }
  if (value.relativePath !== "data/local.db") {
    errors.push("Backup manifest sqlite.relativePath must be data/local.db.");
  }
  if (!["ok", "failed", "skipped"].includes(String(value.quickIntegrityCheck))) {
    errors.push("Backup manifest sqlite.quickIntegrityCheck is invalid.");
  } else if (value.quickIntegrityCheck === "failed") {
    errors.push("Backup manifest SQLite quick integrity check failed.");
  }
  if (value.pageCount !== undefined && !isNonNegativeInteger(value.pageCount)) {
    errors.push("Backup manifest sqlite.pageCount must be a non-negative integer.");
  }
  if (value.userVersion !== undefined && !isNonNegativeInteger(value.userVersion)) {
    errors.push("Backup manifest sqlite.userVersion must be a non-negative integer.");
  }
}

function validateRoots(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("Backup manifest requires roots.");
    return;
  }

  const seen = new Set<string>();
  for (const root of value) {
    if (!isRecord(root)) {
      errors.push("Backup manifest roots must be objects.");
      continue;
    }
    if (!REQUIRED_ROOTS.includes(root.name as BackupManifestRoot["name"])) {
      errors.push(`Backup manifest has invalid root: ${String(root.name)}`);
      continue;
    }
    seen.add(root.name as string);
    if (!expectedRootPath(root.name as BackupManifestRoot["name"], root.relativePath)) {
      errors.push(`Backup manifest root ${String(root.name)} has invalid relativePath.`);
    }
    if (typeof root.optional !== "boolean" || typeof root.empty !== "boolean") {
      errors.push(`Backup manifest root ${String(root.name)} requires optional and empty booleans.`);
    }
  }

  for (const required of REQUIRED_ROOTS) {
    if (!seen.has(required)) {
      errors.push(`Backup manifest is missing root: ${required}`);
    }
  }
}

function validateExclusions(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("Backup manifest requires exclusions.");
    return;
  }
  if (!Array.isArray(value.paths) || value.paths.some((entry) => typeof entry !== "string")) {
    errors.push("Backup manifest exclusions.paths must be strings.");
  }
  if (value.symlinks !== "rejected") {
    errors.push("Backup manifest exclusions.symlinks must be rejected.");
  }
  if (value.runtimeLogs !== "excluded") {
    errors.push("Backup manifest exclusions.runtimeLogs must be excluded.");
  }
  if (value.existingBackups !== "excluded") {
    errors.push("Backup manifest exclusions.existingBackups must be excluded.");
  }
}

function validateArchiveSection(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("Backup manifest requires archive metadata.");
    return;
  }
  if (value.hashAlgorithm !== BACKUP_ARCHIVE_HASH_ALGORITHM) {
    errors.push("Backup manifest archive.hashAlgorithm must be sha256.");
  }
}

function validateCompatibilitySection(value: unknown, errors: string[], warnings: string[]): void {
  if (!isRecord(value)) {
    errors.push("Backup manifest requires compatibility metadata.");
    return;
  }
  if (!Array.isArray(value.warnings) || value.warnings.some((entry) => typeof entry !== "string")) {
    errors.push("Backup manifest compatibility.warnings must be strings.");
  } else {
    warnings.push(...value.warnings);
  }
  if (value.requiresRestorePlanVersion !== BACKUP_RESTORE_PLAN_VERSION) {
    errors.push("Backup manifest compatibility.requiresRestorePlanVersion is unsupported.");
  }
}

function rejectCircularArchiveMetadata(manifest: Record<string, unknown>, errors: string[]): void {
  const archive = isRecord(manifest.archive) ? manifest.archive : {};
  if ("hash" in archive || "sizeBytes" in archive) {
    errors.push("Backup manifest must not contain final archive hash or finalized byte size.");
  }
}

function expectedRootPath(name: BackupManifestRoot["name"], value: unknown): boolean {
  if (name === "local.db") return value === "data/local.db";
  if (name === "blog-assets") return value === "data/blog-assets/";
  return value === "data/user-files/";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
