import { describe, expect, it } from "vitest";
import {
  assertAdminRole,
  redactAuditMetadata,
  validateBackupCreatePayload,
  validateRestoreRequestPayload,
} from "./backup-command-validation";

describe("backup command validation", () => {
  const validBackupPayload = {
    kind: "manual",
    requestedAt: "2026-05-02T12:00:00.000Z",
    snapshotId: "backup_123",
    dataBoundary: {
      dataDir: "/tmp/ordo/.data",
      sqlitePath: "/tmp/ordo/.data/local.db",
      blogAssetRoot: "/tmp/ordo/.data/blog-assets",
      userFileRoot: "/tmp/ordo/.data/user-files",
    },
    appVersion: "0.1.0",
    sourceRuntimeProfileId: "test",
    operation: {
      operationId: "op_backup",
      stepId: "op_backup:backup.create",
      actionId: "act_backup",
      operationKind: "backup_create",
    },
  } as const;

  it("accepts operation-backed manual and operation-null scheduled backup command shapes", () => {
    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
    })).not.toThrow();
    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
      kind: "scheduled",
      operation: undefined,
    })).not.toThrow();
  });

  it("rejects operation-null manual and pre-restore backup commands", () => {
    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
      operation: undefined,
    })).toThrow(/operation metadata is required/);
    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
      kind: "pre_restore",
      restorePlanId: "restore_123",
      operation: undefined,
    })).toThrow(/operation metadata is required/);
  });

  it("rejects invalid backup kinds and secret-like keys", () => {
    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
      kind: "surprise",
    })).toThrow(/Invalid backup kind/);

    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
      apiKey: "nope",
    })).toThrow(/secret-like key/);
  });

  it("validates restore request shape without authorizing execution", () => {
    expect(() => validateRestoreRequestPayload({
      restorePlanId: "restore_123",
      snapshotId: "backup_123",
      archivePath: "/tmp/backup.zip",
      expectedArchiveHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectedArchiveSizeBytes: 1024,
      manifestSchemaVersion: "1",
      restorePlanVersion: "1",
      requestedAt: "2026-05-02T12:00:00.000Z",
      dataBoundary: validBackupPayload.dataBoundary,
      operation: {
        operationId: "op_restore",
        stepId: "op_restore:restore.execute",
        actionId: "act_execute",
        operationKind: "restore_execute",
      },
    })).not.toThrow();
    expect(() => validateRestoreRequestPayload({
      restorePlanId: "restore_123",
      requestedAt: "2026-05-02T12:00:00.000Z",
    })).toThrow(/snapshotId/);
  });

  it("requires restorePlanId for pre-restore backup commands only", () => {
    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
      kind: "pre_restore",
      restorePlanId: "restore_123",
      operation: {
        operationId: "op_restore",
        stepId: "op_restore:restore.safety_backup",
        actionId: "act_safety",
        operationKind: "restore_execute",
      },
    })).not.toThrow();
    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
      kind: "pre_restore",
    })).toThrow(/restorePlanId/);
  });

  it("accepts operation metadata when it matches the command context", () => {
    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
      operation: {
        operationId: "op_backup",
        stepId: "op_backup:backup.create",
        actionId: "act_backup",
        operationKind: "backup_create",
      },
    })).not.toThrow();
    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
      kind: "pre_restore",
      restorePlanId: "restore_123",
      operation: {
        operationId: "op_restore",
        stepId: "op_restore:restore.safety_backup",
        actionId: "act_safety",
        operationKind: "restore_execute",
      },
    })).not.toThrow();
    expect(() => validateRestoreRequestPayload({
      restorePlanId: "restore_123",
      snapshotId: "backup_123",
      archivePath: "/tmp/backup.zip",
      expectedArchiveHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectedArchiveSizeBytes: 1024,
      manifestSchemaVersion: "1",
      restorePlanVersion: "1",
      requestedAt: "2026-05-02T12:00:00.000Z",
      dataBoundary: validBackupPayload.dataBoundary,
      operation: {
        operationId: "op_restore",
        stepId: "op_restore:restore.execute",
        actionId: "act_execute",
        operationKind: "restore_execute",
      },
    })).not.toThrow();
  });

  it("rejects malformed or mismatched operation metadata", () => {
    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
      operation: {
        operationId: "",
        stepId: "op_backup:backup.create",
        actionId: "act_backup",
        operationKind: "backup_create",
      },
    })).toThrow(/operationId/);
    expect(() => validateBackupCreatePayload({
      ...validBackupPayload,
      operation: {
        operationId: "op_restore",
        stepId: "op_restore:restore.safety_backup",
        actionId: "act_safety",
        operationKind: "restore_execute",
      },
    })).toThrow(/backup_create/);
  });

  it("requires admin role for governance commands", () => {
    expect(() => assertAdminRole("ADMIN")).not.toThrow();
    expect(() => assertAdminRole("STAFF")).toThrow(/ADMIN/);
  });

  it("redacts secret-like audit metadata recursively", () => {
    expect(redactAuditMetadata({
      archivePath: "/tmp/backup.zip",
      nested: {
        bearerToken: "secret",
      },
    })).toEqual({
      archivePath: "/tmp/backup.zip",
      nested: {
        bearerToken: "[redacted]",
      },
    });
  });
});
