import { unlink } from "node:fs/promises";
import path from "node:path";
import { getApplianceDataBoundary } from "@/lib/appliance/data-boundary";
import type {
  BackupRestoreAuditRepository,
  BackupSnapshot,
  BackupSnapshotQuery,
  BackupSnapshotRepository,
} from "./types";

export interface BackupRetentionResult {
  deleted: BackupSnapshot[];
  warnings: string[];
}

export interface BackupArchiveStore {
  deleteArchive(archivePath: string): Promise<void>;
}

export class FileSystemBackupArchiveStore implements BackupArchiveStore {
  constructor(private readonly deps: {
    backupsDir?: string;
  } = {}) {}

  async deleteArchive(archivePath: string): Promise<void> {
    const backupsDir = this.deps.backupsDir ?? path.join(getApplianceDataBoundary().dataDir, "backups");
    const resolvedBackupsDir = path.resolve(backupsDir);
    const resolvedArchivePath = path.resolve(archivePath);
    const relative = path.relative(resolvedBackupsDir, resolvedArchivePath);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Refusing to delete backup archive outside backups directory: ${archivePath}`);
    }
    await unlink(resolvedArchivePath);
  }
}

export class BackupRetentionService {
  constructor(private readonly deps: {
    snapshots: BackupSnapshotRepository & BackupSnapshotQuery;
    audit: BackupRestoreAuditRepository;
    archiveStore?: BackupArchiveStore;
  }) {}

  async pruneAfterValidatedBackup(input: {
    snapshotId: string;
    retentionCount: number;
    latestSuccessfulBackupId: string | null;
  }): Promise<BackupRetentionResult> {
    const candidates = await this.deps.snapshots.listPrunableScheduledSnapshots(input.retentionCount);
    const archiveStore = this.deps.archiveStore ?? new FileSystemBackupArchiveStore();
    const deleted: BackupSnapshot[] = [];
    const warnings: string[] = [];

    for (const snapshot of candidates) {
      if (snapshot.id === input.snapshotId || snapshot.id === input.latestSuccessfulBackupId) {
        continue;
      }
      if (snapshot.kind !== "scheduled" || snapshot.status !== "succeeded" || !snapshot.archivePath) {
        continue;
      }

      try {
        await archiveStore.deleteArchive(snapshot.archivePath);
        const marked = await this.deps.snapshots.markDeleted(snapshot.id);
        deleted.push(marked);
        await this.deps.audit.append({
          operationId: snapshot.id,
          operationKind: "backup",
          eventType: "scheduled_backup_retention_deleted",
          actorUserId: null,
          actorRole: null,
          metadata: {
            triggerSnapshotId: input.snapshotId,
            archivePath: snapshot.archivePath,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(message);
        await this.deps.audit.append({
          operationId: snapshot.id,
          operationKind: "backup",
          eventType: "scheduled_backup_retention_delete_failed",
          actorUserId: null,
          actorRole: null,
          metadata: {
            triggerSnapshotId: input.snapshotId,
            archivePath: snapshot.archivePath,
            error: message,
          },
        });
      }
    }

    return { deleted, warnings };
  }
}
