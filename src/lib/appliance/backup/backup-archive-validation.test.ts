import { describe, expect, it } from "vitest";
import {
  BACKUP_ARCHIVE_HASH_ALGORITHM,
  BACKUP_MANIFEST_SCHEMA_VERSION,
  BACKUP_RESTORE_PLAN_VERSION,
  createBackupCompatibilityReport,
  type BackupManifest,
} from "./backup-manifest";
import {
  validateBackupArchiveEntryPath,
  type BackupArchiveEntry,
} from "./backup-archive-paths";
import { Sha256ArchiveIntegrityService } from "./backup-archive-integrity";
import {
  BackupArchiveValidator,
  type ArchiveReader,
} from "./backup-archive-validator";
import { ZipBackupArchiveReader } from "./backup-zip-archive-reader";

function validManifest(overrides: Partial<BackupManifest> = {}): BackupManifest {
  return {
    schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
    appVersion: "0.1.0",
    createdAt: "2026-05-02T12:00:00.000Z",
    backupId: "backup_123",
    kind: "manual",
    sourceRuntimeProfileId: "test",
    sourceDataRoot: "/tmp/ordo/.data",
    sqlite: {
      pathPolicy: "sqlite_backup_api_snapshot",
      relativePath: "data/local.db",
      quickIntegrityCheck: "ok",
      pageCount: 1,
      userVersion: 0,
    },
    roots: [
      {
        name: "local.db",
        relativePath: "data/local.db",
        optional: false,
        empty: false,
      },
      {
        name: "blog-assets",
        relativePath: "data/blog-assets/",
        optional: true,
        empty: true,
      },
      {
        name: "user-files",
        relativePath: "data/user-files/",
        optional: true,
        empty: true,
      },
    ],
    exclusions: {
      paths: [".server.lock", ".runtime-logs"],
      symlinks: "rejected",
      runtimeLogs: "excluded",
      existingBackups: "excluded",
    },
    archive: {
      hashAlgorithm: BACKUP_ARCHIVE_HASH_ALGORITHM,
    },
    compatibility: {
      warnings: [],
      requiresRestorePlanVersion: BACKUP_RESTORE_PLAN_VERSION,
    },
    ...overrides,
  };
}

class MemoryArchiveReader implements ArchiveReader {
  constructor(
    private readonly entries: BackupArchiveEntry[],
    private readonly manifest: unknown,
  ) {}

  async getEntries(): Promise<BackupArchiveEntry[]> {
    return this.entries;
  }

  async readManifest(): Promise<unknown | null> {
    return this.manifest;
  }
}

describe("backup manifest and archive validation", () => {
  it("accepts a valid v1 manifest", () => {
    const report = createBackupCompatibilityReport({
      manifest: validManifest(),
      expectedBackupId: "backup_123",
    });

    expect(report.compatible).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.manifest?.backupId).toBe("backup_123");
  });

  it("rejects unsupported future manifest versions", () => {
    const report = createBackupCompatibilityReport({
      manifest: {
        ...validManifest(),
        schemaVersion: "2",
      },
    });

    expect(report.compatible).toBe(false);
    expect(report.errors.join(" ")).toMatch(/Unsupported backup manifest schema version/);
  });

  it("rejects secret-like manifest keys and circular archive metadata", () => {
    const report = createBackupCompatibilityReport({
      manifest: {
        ...validManifest(),
        apiKey: "secret",
        archive: {
          hashAlgorithm: "sha256",
          hash: "sha256:abc",
          sizeBytes: 123,
        },
      },
    });

    expect(report.compatible).toBe(false);
    expect(report.errors.join(" ")).toMatch(/secret-like key/);
    expect(report.errors.join(" ")).toMatch(/must not contain final archive hash/);
  });

  it("rejects manifests whose SQLite quick integrity check failed", () => {
    const report = createBackupCompatibilityReport({
      manifest: validManifest({
        sqlite: {
          pathPolicy: "sqlite_backup_api_snapshot",
          relativePath: "data/local.db",
          quickIntegrityCheck: "failed",
        },
      }),
    });

    expect(report.compatible).toBe(false);
    expect(report.errors.join(" ")).toMatch(/quick integrity check failed/);
  });

  it.each([
    "/data/local.db",
    "C:\\backup\\local.db",
    "../data/local.db",
    "data/../local.db",
    "data\\..\\local.db",
    "",
    ".",
    "data/private.env",
  ])("rejects unsafe archive path %s", (name) => {
    expect(() => validateBackupArchiveEntryPath({
      name,
      kind: "file",
    })).toThrow();
  });

  it("accepts the allowed archive layout and rejects symlinks", () => {
    expect(() => validateBackupArchiveEntryPath({
      name: "data/local.db",
      kind: "file",
    })).not.toThrow();
    expect(() => validateBackupArchiveEntryPath({
      name: "data/blog-assets/image.png",
      kind: "file",
    })).not.toThrow();
    expect(() => validateBackupArchiveEntryPath({
      name: "data/user-files/report.pdf",
      kind: "file",
    })).not.toThrow();
    expect(() => validateBackupArchiveEntryPath({
      name: "data/user-files/link",
      kind: "symlink",
    })).toThrow(/symlink/);
  });

  it("computes and compares archive integrity outside the manifest", () => {
    const service = new Sha256ArchiveIntegrityService();
    const actual = service.fromBuffer(Buffer.from("backup bytes"));

    expect(actual.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(actual.sizeBytes).toBe(12);
    expect(() => service.assertMatches(actual, actual)).not.toThrow();
    expect(() => service.assertMatches(actual, {
      hash: actual.hash.replace(/.$/, "0"),
      sizeBytes: actual.sizeBytes,
    })).toThrow(/hash mismatch/);
    expect(() => service.assertMatches(actual, {
      hash: actual.hash,
      sizeBytes: actual.sizeBytes + 1,
    })).toThrow(/byte size mismatch/);
  });

  it("validates a complete archive reader result", async () => {
    const integrity = new Sha256ArchiveIntegrityService();
    const validator = new BackupArchiveValidator(integrity);
    const actual = integrity.fromBuffer(Buffer.from("archive"));
    const result = await validator.validate({
      reader: new MemoryArchiveReader([
        { name: "manifest.json", kind: "file" },
        { name: "data/local.db", kind: "file" },
        { name: "data/blog-assets/", kind: "directory" },
        { name: "data/user-files/", kind: "directory" },
      ], validManifest()),
      actualIntegrity: actual,
      expectedIntegrity: actual,
      expectedBackupId: "backup_123",
    });

    expect(result.valid).toBe(true);
    expect(result.manifest?.backupId).toBe("backup_123");
  });

  it("reports missing manifest, traversal, id mismatch, and integrity mismatch", async () => {
    const integrity = new Sha256ArchiveIntegrityService();
    const validator = new BackupArchiveValidator(integrity);
    const actual = integrity.fromBuffer(Buffer.from("archive"));
    const result = await validator.validate({
      reader: new MemoryArchiveReader([
        { name: "data/../local.db", kind: "file" },
      ], validManifest({ backupId: "backup_other" })),
      actualIntegrity: actual,
      expectedIntegrity: {
        hash: actual.hash,
        sizeBytes: actual.sizeBytes + 1,
      },
      expectedBackupId: "backup_123",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/unsafe/);
    expect(result.errors.join(" ")).toMatch(/missing manifest/);
    expect(result.errors.join(" ")).toMatch(/backupId does not match/);
    expect(result.errors.join(" ")).toMatch(/byte size mismatch/);
  });

  it("returns structured validation errors for duplicate and malformed manifests", async () => {
    const integrity = new Sha256ArchiveIntegrityService();
    const validator = new BackupArchiveValidator(integrity);
    const actual = integrity.fromBuffer(Buffer.from("archive"));
    const result = await validator.validate({
      reader: new MemoryArchiveReader([
        { name: "manifest.json", kind: "file" },
        { name: "manifest.json", kind: "file" },
        { name: "data/local.db", kind: "file" },
      ], "not-an-object"),
      actualIntegrity: actual,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/duplicate manifest/);
    expect(result.errors.join(" ")).toMatch(/must be a JSON object/);
  });

  it("does not throw when the archive reader cannot parse manifest JSON", async () => {
    const integrity = new Sha256ArchiveIntegrityService();
    const validator = new BackupArchiveValidator(integrity);
    const actual = integrity.fromBuffer(Buffer.from("archive"));
    const result = await validator.validate({
      reader: {
        async getEntries() {
          return [{ name: "manifest.json", kind: "file" as const }];
        },
        async readManifest() {
          throw new Error("Backup archive manifest is not valid JSON.");
        },
      },
      actualIntegrity: actual,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/not valid JSON/);
  });

  it("reads real zip archive entries and manifest without extracting", async () => {
    const archiveBytes = Buffer.from(
      "UEsDBBQAAAgIAHyeolxfBD3FBwAAAAUAAAAaAAAAZGF0YS9ibG9nLWFzc2V0cy9pbWFnZS5wbmfLzE1MTwUAUEsDBBQAAAgIAHyeolyChru4CAAAAAYAAAANAAAAZGF0YS9sb2NhbC5kYisuzMksSQUAUEsDBBQAAAgIAHyeolyEdy/ECAAAAAYAAAAaAAAAZGF0YS91c2VyLWZpbGVzL3JlcG9ydC50eHQrSi3ILyoBAFBLAwQUAAAICAB8nqJcMUzuYJYBAAANAwAADQAAAG1hbmlmZXN0Lmpzb26FUkFP6zAM/i85b21WBIfeeI8LEodpQhxAaPJS04QmcUhSoJr235+z8diQQEg91J8/f59jeyuS0ujgDmMy5EUrFmImIIQjIKtFJRlUESFjd5kZa2RzMZfnc9ncLppWSv4qKeU90zaghjFcd8w6/K4XzRnjg/EFc+BHsBwnGqPC1eizcbiM9GQs7qsypvyZv4IMK6LiWWcXaood1VXHaKG8WJNRtFsRIOslWaMmJh7g9Yc7BLNOHkLSVGQjWsjmFZdcwdyiVFtSYKtuw+mX0ajh2mfso8nTX41qYBYNYsel3EcS7cNWeHBsK07qfpGlkHmY/O72CWzCmUAX8vQR7WafihtL/RxSQjb6XvSEUX8RznE86pbgRHZMGOdlwD+pHgm/iT5y+K7sWI4j/R99mYqoWOMVY8XPHgTT0uSs8QPn2PIZFd9OcT8s/Ib6kthLdfsEvpuUje//7Nf2Jcmzh6g091wMNSR9aXviBWlX1q2hOb8oJEWOuzEbw/ufCvUNomfJ0t5jeThvN2Ja8YFRxKUFf3r2u90/UEsBAhQDFAAACAgAfJ6iXF8EPcUHAAAABQAAABoAAAAAAAAAAAAAAACAAAAAAGRhdGEvYmxvZy1hc3NldHMvaW1hZ2UucG5nUEsBAhQDFAAACAgAfJ6iXIKGu7gIAAAABgAAAA0AAAAAAAAAAAAAAACAPwAAAGRhdGEvbG9jYWwuZGJQSwECFAMUAAAICAB8nqJchHcvxAgAAAAGAAAAGgAAAAAAAAAAAAAAAIByAAAAZGF0YS91c2VyLWZpbGVzL3JlcG9ydC50eHRQSwECFAMUAAAICAB8nqJcMUzuYJYBAAANAwAADQAAAAAAAAAAAAAAAICyAAAAbWFuaWZlc3QuanNvblBLBQYAAAAABAAEAAYBAABzAgAAAAA=",
      "base64",
    );

    const reader = new ZipBackupArchiveReader(archiveBytes);
    const entries = await reader.getEntries();
    const payload = await reader.readManifest();

    expect(entries.map((entry) => entry.name)).toEqual(expect.arrayContaining([
      "manifest.json",
      "data/local.db",
      "data/blog-assets/image.png",
      "data/user-files/report.txt",
    ]));
    expect((payload as BackupManifest).backupId).toBe("backup_123");
  });
});
