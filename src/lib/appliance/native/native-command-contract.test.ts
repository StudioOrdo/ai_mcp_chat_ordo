import { describe, expect, it } from "vitest";
import {
  NativeCommandContractError,
  createNativeCommandResult,
  nativeOperationRefsEqual,
  parseNativeCommandResult,
} from "./native-command-contract";

const operation = {
  operationId: "op_1",
  stepId: "op_1:backup.create",
  actionId: "act_1",
  operationKind: "backup_create" as const,
};

describe("native command contract", () => {
  it("accepts structured native command results", () => {
    const result = parseNativeCommandResult({
      schemaVersion: "1",
      commandId: "syscmd_1",
      operation,
      status: "succeeded",
      summary: "Backup completed.",
      artifacts: [{
        kind: "backup_archive",
        uri: "file:///tmp/backup.zip",
        label: "Backup archive",
        metadata: { bytesWritten: 12 },
      }],
      metrics: {
        bytesWritten: 12,
        archiveHash: "sha256:abc",
        verified: true,
        skipped: null,
      },
      error: null,
    });

    expect(result.operation?.operationId).toBe("op_1");
    expect(result.artifacts[0]?.kind).toBe("backup_archive");
  });

  it("rejects malformed schema, operation refs, artifacts, and metrics", () => {
    expect(() => parseNativeCommandResult({
      schemaVersion: "2",
      commandId: "syscmd_1",
      operation: null,
      status: "succeeded",
      summary: "done",
      artifacts: [],
      metrics: {},
      error: null,
    })).toThrow(NativeCommandContractError);

    expect(() => parseNativeCommandResult({
      schemaVersion: "1",
      commandId: "syscmd_1",
      operation: { ...operation, operationKind: "unknown" },
      status: "succeeded",
      summary: "done",
      artifacts: [],
      metrics: {},
      error: null,
    })).toThrow(/operationKind/);

    expect(() => parseNativeCommandResult({
      schemaVersion: "1",
      commandId: "syscmd_1",
      operation,
      status: "succeeded",
      summary: "done",
      artifacts: [{ kind: "backup_archive", uri: "", label: "Archive", metadata: {} }],
      metrics: {},
      error: null,
    })).toThrow(/uri/);

    expect(() => parseNativeCommandResult({
      schemaVersion: "1",
      commandId: "syscmd_1",
      operation,
      status: "succeeded",
      summary: "done",
      artifacts: [],
      metrics: { nested: { nope: true } },
      error: null,
    })).toThrow(/metric/);
  });

  it("constructs validated results and compares operation references", () => {
    const result = createNativeCommandResult({
      commandId: "syscmd_1",
      operation,
      status: "failed",
      summary: "Backup failed.",
      error: {
        code: "BACKUP_FAILED",
        message: "Disk full.",
      },
    });

    expect(result.error?.code).toBe("BACKUP_FAILED");
    expect(nativeOperationRefsEqual(result.operation, operation)).toBe(true);
    expect(nativeOperationRefsEqual(result.operation, { ...operation, actionId: "other" })).toBe(false);
  });
});
