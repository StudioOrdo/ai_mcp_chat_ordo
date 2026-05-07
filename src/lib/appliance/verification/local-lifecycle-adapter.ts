import { mkdtemp, mkdir, rm, writeFile, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommand } from "./command-runner";

export interface PreparedLocalRuntime {
  rootDir: string;
  dataDir: string;
  sqlitePath: string;
  seedFile: string;
  executorPath: string;
}

export class LocalLifecycleAdapter {
  async prepare(): Promise<PreparedLocalRuntime> {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "ordo-appliance-smoke-"));
    const dataDir = path.join(rootDir, ".data");
    const sqlitePath = path.join(dataDir, "local.db");
    const seedDir = path.join(dataDir, "user-files", "smoke");
    const seedFile = path.join(seedDir, "seed.txt");
    await mkdir(seedDir, { recursive: true });
    await writeFile(seedFile, "ordo appliance smoke seed\n", "utf-8");
    return {
      rootDir,
      dataDir,
      sqlitePath,
      seedFile,
      executorPath: path.join(process.cwd(), "bin", "ordo-backup"),
    };
  }

  async ensureExecutor(runtime: PreparedLocalRuntime): Promise<void> {
    const result = await runCommand(process.execPath, ["scripts/install-backup-executor.mjs"], { timeoutMs: 120_000 });
    if (result.status !== 0) {
      throw new Error(`Rust backup executor install failed: ${result.stderr || result.stdout}`);
    }
    await access(runtime.executorPath, constants.X_OK);
  }

  async runExecutorOnce(runtime: PreparedLocalRuntime): Promise<void> {
    const result = await runCommand(runtime.executorPath, [
      "run-once",
      "--db-path",
      runtime.sqlitePath,
      "--lease-owner",
      "appliance_smoke",
    ], {
      env: {
        DATA_DIR: runtime.dataDir,
        STUDIO_ORDO_DB_PATH: runtime.sqlitePath,
      },
      timeoutMs: 30_000,
    });
    if (result.status !== 0) {
      throw new Error(`Rust backup executor run-once failed: ${result.stderr || result.stdout}`);
    }
  }

  async readSeed(runtime: PreparedLocalRuntime): Promise<string> {
    return readFile(runtime.seedFile, "utf-8");
  }

  async deleteSeed(runtime: PreparedLocalRuntime): Promise<void> {
    await rm(runtime.seedFile, { force: true });
  }

  async cleanup(runtime: PreparedLocalRuntime): Promise<void> {
    if (process.env.APPLIANCE_SMOKE_KEEP_DATA === "1") {
      return;
    }
    await rm(runtime.rootDir, { recursive: true, force: true });
  }
}
