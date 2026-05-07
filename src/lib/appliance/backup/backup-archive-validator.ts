import {
  type BackupArchiveEntry,
  validateBackupArchiveEntries,
} from "./backup-archive-paths";
import {
  type ArchiveIntegrityService,
  type BackupArchiveIntegrity,
} from "./backup-archive-integrity";
import {
  createBackupCompatibilityReport,
  type BackupCompatibilityReport,
  type BackupManifest,
} from "./backup-manifest";

export interface ArchiveReader {
  getEntries(): Promise<BackupArchiveEntry[]>;
  readManifest(): Promise<unknown | null>;
}

export interface BackupArchiveValidationInput {
  reader: ArchiveReader;
  actualIntegrity: BackupArchiveIntegrity;
  expectedIntegrity?: BackupArchiveIntegrity;
  expectedBackupId?: string;
}

export interface BackupArchiveValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest: BackupManifest | null;
}

export class BackupArchiveValidator {
  constructor(private readonly integrity: ArchiveIntegrityService) {}

  async validate(input: BackupArchiveValidationInput): Promise<BackupArchiveValidationResult> {
    const errors: string[] = [];
    const entries = await input.reader.getEntries();

    try {
      validateBackupArchiveEntries(entries);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Backup archive contains an unsafe entry.");
    }

    const manifestEntries = entries.filter((entry) => entry.name === "manifest.json");
    if (manifestEntries.length === 0) {
      errors.push("Backup archive is missing manifest.json.");
    } else if (manifestEntries.length > 1) {
      errors.push("Backup archive contains duplicate manifest.json entries.");
    }

    let compatibility: BackupCompatibilityReport = {
      compatible: false,
      errors: [],
      warnings: [],
      manifest: null,
    };
    let rawManifest: unknown | null = null;
    try {
      rawManifest = await input.reader.readManifest();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Backup archive manifest could not be parsed.");
    }

    if (rawManifest === null) {
      errors.push("Backup archive manifest could not be read.");
    } else {
      compatibility = createBackupCompatibilityReport({
        manifest: rawManifest,
        expectedBackupId: input.expectedBackupId,
      });
      errors.push(...compatibility.errors);
    }

    if (input.expectedIntegrity) {
      try {
        this.integrity.assertMatches(input.actualIntegrity, input.expectedIntegrity);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Backup archive integrity mismatch.");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: compatibility.warnings,
      manifest: errors.length === 0 ? compatibility.manifest : null,
    };
  }
}
