import type { ApplianceDataBoundary } from "@/lib/appliance/data-boundary";
import type {
  BackupManifest,
} from "./backup-manifest";
import type {
  BackupSnapshot,
  RestorePlanImpactSummary,
} from "./types";

export function createRestorePlanImpactSummary(input: {
  snapshot: BackupSnapshot;
  manifest: BackupManifest;
  dataBoundary: ApplianceDataBoundary;
}): RestorePlanImpactSummary {
  return {
    snapshotId: input.snapshot.id,
    snapshotKind: input.snapshot.kind,
    snapshotCreatedAt: input.snapshot.createdAt,
    archivePath: input.snapshot.archivePath ?? "",
    archiveHash: input.snapshot.archiveHash ?? "",
    archiveSizeBytes: input.snapshot.archiveSizeBytes ?? 0,
    manifestSchemaVersion: input.snapshot.manifestSchemaVersion ?? input.manifest.schemaVersion,
    appVersion: input.snapshot.appVersion ?? input.manifest.appVersion,
    sourceRuntimeProfileId: input.manifest.sourceRuntimeProfileId,
    sourceDataRoot: input.manifest.sourceDataRoot,
    targetDataDir: input.dataBoundary.dataDir,
    targetSqlitePath: input.dataBoundary.sqlitePath,
    targetBlogAssetRoot: input.dataBoundary.blogAssetRoot,
    targetUserFileRoot: input.dataBoundary.userFileRoot,
    includedRoots: input.manifest.roots.map((root) => root.name),
    manifestWarnings: input.manifest.compatibility.warnings,
    dataBoundaryWarnings: input.dataBoundary.warnings,
    environmentNote: "Provider keys and environment variables are not part of the backup artifact.",
  };
}
