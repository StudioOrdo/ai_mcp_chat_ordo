import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { resolveRuntimeSecret } from "./secret-source";

describe("resolveRuntimeSecret", () => {
  it("resolves direct env before file env", () => {
    const dir = mkdtempSync(join(tmpdir(), "ordo-secret-"));
    try {
      const file = join(dir, "secret");
      writeFileSync(file, "file-secret\n");
      expect(resolveRuntimeSecret("ANTHROPIC_API_KEY", {
        ANTHROPIC_API_KEY: "env-secret",
        ANTHROPIC_API_KEY_FILE: file,
      }).value).toBe("env-secret");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves file secrets and reports file source without exposing the path", () => {
    const dir = mkdtempSync(join(tmpdir(), "ordo-secret-"));
    try {
      const file = join(dir, "secret");
      writeFileSync(file, "file-secret\n");
      const resolved = resolveRuntimeSecret("OPENAI_API_KEY", { OPENAI_API_KEY_FILE: file });
      expect(resolved).toMatchObject({
        key: "OPENAI_API_KEY",
        value: "file-secret",
        source: "file",
        configured: true,
      });
      expect(JSON.stringify(resolved)).not.toContain(file);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats blank and unreadable files as missing with safe diagnostics", () => {
    const dir = mkdtempSync(join(tmpdir(), "ordo-secret-"));
    try {
      const blank = join(dir, "blank");
      writeFileSync(blank, " \n");
      expect(resolveRuntimeSecret("DEEPSEEK_API_KEY", { DEEPSEEK_API_KEY_FILE: blank })).toMatchObject({
        source: "missing",
        configured: false,
      });

      const missing = join(dir, "missing");
      const resolved = resolveRuntimeSecret("DEEPSEEK_API_KEY", { DEEPSEEK_API_KEY_FILE: missing });
      expect(resolved).toMatchObject({
        source: "missing",
        configured: false,
        error: "Secret file configured by DEEPSEEK_API_KEY_FILE could not be read.",
      });
      expect(JSON.stringify(resolved)).not.toContain(missing);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
