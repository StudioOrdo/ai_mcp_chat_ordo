import type { RoleName } from "@/core/entities/user";
import type {
  BackupRestoreAuditRepository,
  BackupSnapshot,
  BackupSnapshotRepository,
} from "./types";
import type {
  BackupArchiveValidationInput,
  BackupArchiveValidationResult,
} from "./backup-archive-validator";
import { BackupArchiveValidator } from "./backup-archive-validator";

export interface BackupArchiveServiceValidateInput extends BackupArchiveValidationInput {
  snapshotId: string;
  archivePath: string;
  actorUserId: string | null;
  actorRole: RoleName | null;
  markSucceeded?: boolean;
}

export interface BackupArchiveServiceValidateResult {
  validation: BackupArchiveValidationResult;
  snapshot: BackupSnapshot;
}

export class BackupArchiveService {
  constructor(private readonly deps: {
    validator: BackupArchiveValidator;
    snapshots: BackupSnapshotRepository;
    audit: BackupRestoreAuditRepository;
  }) {}

  async validateSnapshotArchive(
    input: BackupArchiveServiceValidateInput,
  ): Promise<BackupArchiveServiceValidateResult> {
    await this.deps.snapshots.markValidating(input.snapshotId);
    await this.deps.audit.append({
      operationId: input.snapshotId,
      operationKind: "backup",
      eventType: "backup_archive_validation_started",
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      metadata: {
        archivePath: input.archivePath,
      },
    });

    const validation = await this.deps.validator.validate({
      reader: input.reader,
      actualIntegrity: input.actualIntegrity,
      expectedIntegrity: input.expectedIntegrity,
      expectedBackupId: input.expectedBackupId ?? input.snapshotId,
    });

    if (!validation.valid || !validation.manifest) {
      const failureMessage = validation.errors.join("; ") || "Backup archive validation failed.";
      const snapshot = await this.deps.snapshots.markFailed({
        id: input.snapshotId,
        failureMessage,
      });
      await this.deps.audit.append({
        operationId: input.snapshotId,
        operationKind: "backup",
        eventType: "backup_archive_validation_failed",
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        metadata: {
          archivePath: input.archivePath,
          errors: validation.errors,
        },
      });

      return { validation, snapshot };
    }

    const snapshotInput = {
      id: input.snapshotId,
      archivePath: input.archivePath,
      archiveHash: input.actualIntegrity.hash,
      archiveSizeBytes: input.actualIntegrity.sizeBytes,
      manifestSchemaVersion: validation.manifest.schemaVersion,
      appVersion: validation.manifest.appVersion,
    };
    const snapshot = input.markSucceeded
      ? await this.deps.snapshots.markSucceeded(snapshotInput)
      : await this.deps.snapshots.markValidated(snapshotInput);

    await this.deps.audit.append({
      operationId: input.snapshotId,
      operationKind: "backup",
      eventType: "backup_archive_validation_succeeded",
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      metadata: {
        archivePath: input.archivePath,
        archiveHash: input.actualIntegrity.hash,
        archiveSizeBytes: input.actualIntegrity.sizeBytes,
        manifestSchemaVersion: validation.manifest.schemaVersion,
        appVersion: validation.manifest.appVersion,
        warnings: validation.warnings,
      },
    });

    return { validation, snapshot };
  }
}
