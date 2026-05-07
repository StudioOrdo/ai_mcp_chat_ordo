import { describe, expect, it } from "vitest";
import {
  getNativeBinaryRegistry,
  getNativeBinaryStatus,
  resolveNativeBinaryPath,
} from "./native-binary-registry";

describe("native binary registry", () => {
  it("resolves configured and default native binary paths", () => {
    expect(resolveNativeBinaryPath("ordo-backup", {
      cwd: "/app",
      env: {},
    })).toBe("/app/bin/ordo-backup");

    expect(resolveNativeBinaryPath("ordo-backup", {
      cwd: "/app",
      env: { ORDO_BACKUP_EXECUTOR_PATH: "/custom/ordo-backup" },
    })).toBe("/custom/ordo-backup");
  });

  it("reports disabled, missing, non-executable, and available statuses", () => {
    expect(getNativeBinaryStatus("ordo-backup", {
      env: { DISABLE_BACKUP_EXECUTOR: "1" },
    })).toMatchObject({
      disabled: true,
      available: false,
      executable: false,
    });

    expect(getNativeBinaryStatus("ordo-backup", {
      env: { ORDO_BACKUP_EXECUTOR_PATH: "/missing" },
      exists: () => false,
    })).toMatchObject({
      available: false,
      executable: false,
      summary: "Backup executor binary is unavailable.",
    });

    expect(getNativeBinaryStatus("ordo-backup", {
      env: { ORDO_BACKUP_EXECUTOR_PATH: "/present" },
      exists: () => true,
      executable: () => false,
    })).toMatchObject({
      available: false,
      executable: false,
      summary: "Backup executor binary is not executable.",
    });

    expect(getNativeBinaryStatus("ordo-backup", {
      env: { ORDO_BACKUP_EXECUTOR_PATH: "/present" },
      exists: () => true,
      executable: () => true,
    })).toMatchObject({
      available: true,
      executable: true,
      summary: "Backup executor binary is available.",
    });
  });

  it("keeps optional runtime guard non-required until implemented", () => {
    const registry = getNativeBinaryRegistry({
      cwd: "/app",
      env: {},
      exists: () => false,
    });

    expect(registry["ordo-backup"].required).toBe(true);
    expect(registry["ordo-runtime"].required).toBe(false);
  });
});
