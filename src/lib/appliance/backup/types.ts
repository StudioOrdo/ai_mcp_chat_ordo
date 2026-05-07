import type { RoleName } from "@/core/entities/user";

export const BACKUP_COMMAND_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "superseded",
] as const;

export type BackupCommandStatus = typeof BACKUP_COMMAND_STATUSES[number];

export const BACKUP_KINDS = ["manual", "scheduled", "pre_restore"] as const;
export type BackupKind = typeof BACKUP_KINDS[number];

export const RESTORE_STATUSES = [
  "draft",
  "validated",
  "confirmation_required",
  "confirmed",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type RestoreStatus = typeof RESTORE_STATUSES[number];

export const BACKUP_INTERVALS = ["disabled", "6h", "12h", "daily", "weekly"] as const;
export type BackupInterval = typeof BACKUP_INTERVALS[number];

export const SYSTEM_COMMAND_TARGETS = ["rust_daemon", "node_scheduler"] as const;
export type SystemCommandTarget = typeof SYSTEM_COMMAND_TARGETS[number];

export const SYSTEM_COMMAND_NAMES = ["backup.create", "restore.request"] as const;
export type SystemCommandName = typeof SYSTEM_COMMAND_NAMES[number];

export interface OperationCommandMetadata extends Record<string, unknown> {
  operationId: string;
  stepId: string;
  actionId: string;
  operationKind: "backup_create" | "restore_execute";
}

export interface BackupPolicy {
  id: "default";
  enabled: boolean;
  interval: BackupInterval;
  retentionCount: number;
  latestSuccessfulBackupId: string | null;
  lastScheduledAt: string | null;
  nextScheduledAt: string | null;
  updatedByUserId: string | null;
  updatedAt: string;
}

export interface BackupCommandPayload extends Record<string, unknown> {
  kind: BackupKind;
  requestedAt: string;
  snapshotId: string;
  dataBoundary: {
    dataDir: string;
    sqlitePath: string;
    blogAssetRoot: string;
    userFileRoot: string;
  };
  appVersion: string;
  sourceRuntimeProfileId: string;
  restorePlanId?: string;
  operation: OperationCommandMetadata | null;
}

export interface RestoreCommandRequest extends Record<string, unknown> {
  restorePlanId: string;
  snapshotId: string;
  archivePath: string;
  expectedArchiveHash: string;
  expectedArchiveSizeBytes: number;
  manifestSchemaVersion: string;
  restorePlanVersion: string;
  requestedAt: string;
  dataBoundary: {
    dataDir: string;
    sqlitePath: string;
    blogAssetRoot: string;
    userFileRoot: string;
  };
  confirmationRef?: string;
  operation: OperationCommandMetadata;
}

export type BackupOperationStatus = BackupCommandStatus | RestoreStatus;

export interface SystemCommand {
  id: string;
  target: SystemCommandTarget;
  command: SystemCommandName;
  status: BackupCommandStatus;
  payload: Record<string, unknown>;
  resultPayload: Record<string, unknown> | null;
  errorMessage: string | null;
  requestedByUserId: string | null;
  requestedByRole: RoleName | null;
  requestedFrom: string;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BackupCommand = SystemCommand & {
  command: "backup.create";
  payload: BackupCommandPayload;
};

export type RestoreCommand = SystemCommand & {
  command: "restore.request";
  payload: RestoreCommandRequest;
};

export type BackupSnapshotStatus =
  | "pending"
  | "validating"
  | "validated"
  | "succeeded"
  | "failed"
  | "deleted";

export interface BackupSnapshot {
  id: string;
  kind: BackupKind;
  status: BackupSnapshotStatus;
  archivePath: string | null;
  archiveHash: string | null;
  archiveSizeBytes: number | null;
  manifestSchemaVersion: string | null;
  appVersion: string | null;
  createdByUserId: string | null;
  createdAt: string;
  validatedAt: string | null;
  failureMessage: string | null;
}

export type BackupOperationKind = "backup" | "restore" | "policy";

export interface BackupOperationAuditEvent {
  id: string;
  operationId: string;
  operationKind: BackupOperationKind;
  eventType: string;
  actorUserId: string | null;
  actorRole: RoleName | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface BackupCommandRequester {
  userId: string | null;
  role: RoleName;
  requestedFrom: string;
}

export interface SystemCommandRepository {
  enqueue(input: {
    target: SystemCommandTarget;
    command: SystemCommandName;
    status?: BackupCommandStatus;
    payload: Record<string, unknown>;
    requestedByUserId: string | null;
    requestedByRole: RoleName | null;
    requestedFrom: string;
  }): Promise<SystemCommand>;
  findById(id: string): Promise<SystemCommand | null>;
}

export interface SystemCommandQuery {
  listRecentBackupRestore(limit: number, offset?: number): Promise<SystemCommand[]>;
  listBySnapshotId(snapshotId: string): Promise<SystemCommand[]>;
  listByRestorePlanId(restorePlanId: string): Promise<SystemCommand[]>;
  listRecentOperationBackedCommands(limit: number, offset?: number): Promise<SystemCommand[]>;
  listByOperationId(operationId: string, limit?: number): Promise<SystemCommand[]>;
  countByStatusForRustDaemon(): Promise<Partial<Record<BackupCommandStatus, number>>>;
  hasActiveBackupOrRestoreCommand(): Promise<boolean>;
  findLatestScheduledCommand(): Promise<SystemCommand | null>;
  listSucceededScheduledBackupCommands(limit: number): Promise<SystemCommand[]>;
}

export interface BackupPolicyRepository {
  getOrCreateDefaultPolicy(): Promise<BackupPolicy>;
  updateDefaultPolicy(input: {
    enabled: boolean;
    interval: BackupInterval;
    retentionCount: number;
    latestSuccessfulBackupId?: string | null;
    lastScheduledAt?: string | null;
    nextScheduledAt?: string | null;
    updatedByUserId?: string | null;
  }): Promise<BackupPolicy>;
}

export interface BackupSnapshotRepository {
  createPending(input: {
    kind: BackupKind;
    createdByUserId: string | null;
  }): Promise<BackupSnapshot>;
  findById(id: string): Promise<BackupSnapshot | null>;
  markValidating(id: string): Promise<BackupSnapshot>;
  markValidated(input: {
    id: string;
    archivePath: string;
    archiveHash: string;
    archiveSizeBytes: number;
    manifestSchemaVersion: string;
    appVersion: string;
  }): Promise<BackupSnapshot>;
  markSucceeded(input: {
    id: string;
    archivePath: string;
    archiveHash: string;
    archiveSizeBytes: number;
    manifestSchemaVersion: string;
    appVersion: string;
  }): Promise<BackupSnapshot>;
  markFailed(input: {
    id: string;
    failureMessage: string;
  }): Promise<BackupSnapshot>;
  markDeleted(id: string): Promise<BackupSnapshot>;
}

export interface BackupSnapshotQuery {
  listRecent(limit: number, offset?: number): Promise<BackupSnapshot[]>;
  findLatestSuccessful(): Promise<BackupSnapshot | null>;
  findLatestAttempt(): Promise<BackupSnapshot | null>;
  listPrunableScheduledSnapshots(retentionCount: number): Promise<BackupSnapshot[]>;
  countSucceededSnapshots(): Promise<number>;
}

export interface BackupRestoreAuditRepository {
  append(input: {
    operationId: string;
    operationKind: BackupOperationKind;
    eventType: string;
    actorUserId: string | null;
    actorRole: RoleName | null;
    metadata: Record<string, unknown>;
  }): Promise<BackupOperationAuditEvent>;
  findById(id: string): Promise<BackupOperationAuditEvent | null>;
}

export interface BackupRestoreAuditQuery {
  listByOperationId(operationId: string, limit?: number): Promise<BackupOperationAuditEvent[]>;
}

export interface RestorePlanImpactSummary {
  snapshotId: string;
  snapshotKind: BackupKind;
  snapshotCreatedAt: string;
  archivePath: string;
  archiveHash: string;
  archiveSizeBytes: number;
  manifestSchemaVersion: string;
  appVersion: string;
  sourceRuntimeProfileId: string;
  sourceDataRoot: string;
  targetDataDir: string;
  targetSqlitePath: string;
  targetBlogAssetRoot: string;
  targetUserFileRoot: string;
  includedRoots: string[];
  manifestWarnings: string[];
  dataBoundaryWarnings: string[];
  environmentNote: string;
}

export interface RestorePlan {
  id: string;
  snapshotId: string;
  status: RestoreStatus;
  archivePath: string;
  archiveHash: string;
  archiveSizeBytes: number;
  manifestSchemaVersion: string;
  appVersion: string;
  restorePlanVersion: string;
  impact: RestorePlanImpactSummary;
  validationWarnings: string[];
  confirmationPhrase: string;
  preRestoreBackupCommandId: string | null;
  preRestoreBackupSnapshotId: string | null;
  restoreCommandId: string | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  failureMessage: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestorePlanRepository {
  createDraft(input: {
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
  }): Promise<RestorePlan>;
  findById(id: string): Promise<RestorePlan | null>;
  markValidated(id: string): Promise<RestorePlan>;
  markConfirmationRequired(id: string): Promise<RestorePlan>;
  markConfirmed(input: {
    id: string;
    confirmedByUserId: string | null;
  }): Promise<RestorePlan>;
  markPreRestoreBackupRequired(input: {
    id: string;
    commandId: string;
  }): Promise<RestorePlan>;
  linkPreRestoreBackupSnapshot(input: {
    id: string;
    snapshotId: string;
  }): Promise<RestorePlan>;
  markRunning(input: {
    id: string;
    restoreCommandId: string;
  }): Promise<RestorePlan>;
  markSucceeded(id: string): Promise<RestorePlan>;
  markFailed(input: {
    id: string;
    failureMessage: string;
  }): Promise<RestorePlan>;
  markCancelled(input: {
    id: string;
    failureMessage?: string | null;
  }): Promise<RestorePlan>;
}

export interface RestorePlanQuery {
  listRecent(limit: number, offset?: number): Promise<RestorePlan[]>;
  findActiveBySnapshotId(snapshotId: string): Promise<RestorePlan | null>;
  hasRestoreInProgressOrArmed(): Promise<boolean>;
}

export interface RestoreCommandRepository {
  enqueueRestoreRequest(input: {
    payload: RestoreCommandRequest;
    requestedByUserId: string | null;
    requestedByRole: RoleName | null;
    requestedFrom: string;
  }): Promise<SystemCommand>;
}
