#!/usr/bin/env node
/**
 * Starts `next dev` on the first available port, beginning with PORT
 * from the environment (default 3000). If that port is busy, it tries
 * the next one, up to 10 attempts.
 */
import { createServer } from "net";
import { spawn, spawnSync } from "child_process";
import { join, resolve } from "path";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { once } from "events";

const PREFERRED = parseInt(process.env.PORT || "3000", 10);
const MAX_ATTEMPTS = 10;
const DEV_STACK_LOCK_PATH = resolve(".next", "dev-stack.lock");
const MEDIA_WORKER_PORT = parseInt(process.env.MEDIA_WORKER_PORT || "3101", 10);
const CHILD_EXIT_TIMEOUT_MS = parseInt(process.env.DEV_CHILD_EXIT_TIMEOUT_MS || "5000", 10);
const MEDIA_WORKER_READY_TIMEOUT_MS = parseInt(process.env.MEDIA_WORKER_READY_TIMEOUT_MS || "10000", 10);
const BACKUP_EXECUTOR_ENABLED = process.env.DISABLE_BACKUP_EXECUTOR !== "1";
const BACKUP_SCHEDULER_ENABLED = process.env.DISABLE_BACKUP_SCHEDULER !== "1";
const BACKUP_EXECUTOR_PATH = process.env.ORDO_BACKUP_EXECUTOR_PATH?.trim() || resolve("bin", "ordo-backup");
const BACKUP_EXECUTOR_POLL_INTERVAL_MS = parseInt(process.env.ORDO_BACKUP_EXECUTOR_POLL_INTERVAL_MS || "2000", 10);
const BACKUP_EXECUTOR_LEASE_SECONDS = parseInt(process.env.ORDO_BACKUP_EXECUTOR_LEASE_SECONDS || "900", 10);
const DATA_DIR = resolve(process.env.DATA_DIR || ".data");
const SQLITE_PATH = resolve(process.env.STUDIO_ORDO_DB_PATH || join(DATA_DIR, "local.db"));

process.env.ORDO_RUNTIME_PROCESS_ROLE = process.env.ORDO_RUNTIME_PROCESS_ROLE ?? "app";
process.env.ORDO_MEDIA_WORKER_MODE = process.env.DISABLE_MEDIA_WORKER === "1"
  ? "disabled"
  : "local_dev";

function assertNativeRuntime() {
  const result = spawnSync(
    process.execPath,
    ["scripts/check-native-runtime.mjs", "better-sqlite3"],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

assertNativeRuntime();

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockPid() {
  try {
    const lock = JSON.parse(readFileSync(DEV_STACK_LOCK_PATH, "utf8"));
    return typeof lock.pid === "number" ? lock.pid : null;
  } catch {
    return null;
  }
}

function acquireDevStackLock() {
  if (process.env.ORDO_ALLOW_MULTIPLE_DEV_STACKS === "1") {
    return;
  }

  mkdirSync(resolve(".next"), { recursive: true });

  if (existsSync(DEV_STACK_LOCK_PATH)) {
    const pid = readLockPid();
    if (pid && isProcessAlive(pid)) {
      console.error(
        `[dev] Another Studio Ordo dev stack is already running (pid ${pid}). `
        + "Stop it before starting a second stack, or set ORDO_ALLOW_MULTIPLE_DEV_STACKS=1 if you really need parallel workers.",
      );
      process.exit(1);
    }

    rmSync(DEV_STACK_LOCK_PATH, { force: true });
  }

  writeFileSync(
    DEV_STACK_LOCK_PATH,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2),
    { flag: "wx" },
  );
}

function releaseDevStackLock() {
  if (process.env.ORDO_ALLOW_MULTIPLE_DEV_STACKS === "1") {
    return;
  }

  const pid = readLockPid();
  if (pid === process.pid) {
    rmSync(DEV_STACK_LOCK_PATH, { force: true });
  }
}

function isExpectedChildShutdownSignal(signal) {
  return signal === "SIGINT" || signal === "SIGTERM";
}

acquireDevStackLock();

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => {
      srv.close(() => resolve(true));
    });
    srv.listen(port, "0.0.0.0");
  });
}

async function findFreePort(start) {
  for (let port = start; port < start + MAX_ATTEMPTS; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(
    `No free port found in range ${start}–${start + MAX_ATTEMPTS - 1}`,
  );
}

const port = await findFreePort(PREFERRED);
if (port !== PREFERRED) {
  console.log(`⚡ Port ${PREFERRED} is busy — using port ${port}`);
}

const nextBin = resolve("node_modules/.bin/next");

function spawnManaged(command, args, env) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env,
  });

  child.on("error", (error) => {
    console.error("[dev] managed process failed to start", {
      command,
      args,
      error: error instanceof Error ? error.message : String(error),
    });
    void shutdown("SIGTERM", 1);
  });

  return child;
}

async function waitForHttpReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // Worker may still be booting.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForChildExit(child, timeoutMs = CHILD_EXIT_TIMEOUT_MS) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const forceKillTimer = setTimeout(() => {
    terminate(child, "SIGKILL");
  }, timeoutMs);

  try {
    await once(child, "exit");
  } finally {
    clearTimeout(forceKillTimer);
  }
}

const tsxCli = resolve("node_modules", "tsx", "dist", "cli.mjs");
const sharedEnv = { ...process.env, PORT: String(port) };
if (!(await isPortFree(MEDIA_WORKER_PORT))) {
  console.error(
    `[dev] Media worker port ${MEDIA_WORKER_PORT} is already in use. Stop the stale process or set MEDIA_WORKER_PORT to another port before running npm run dev.`,
  );
  releaseDevStackLock();
  process.exit(1);
}

console.log("⚡ Ensuring database schema is fully initialized...");
const initDbResult = spawnSync(process.execPath, [tsxCli, "scripts/ensure-db-schema.ts"], { stdio: "inherit", env: sharedEnv });
if (initDbResult.status !== 0) {
  console.error("[dev] Failed to initialize database schema.");
  process.exit(1);
}

const nextProcess = spawnManaged(nextBin, ["dev", "--port", String(port)], sharedEnv);
const workerProcess = spawnManaged(process.execPath, [tsxCli, "scripts/process-deferred-jobs.ts"], {
  ...sharedEnv,
  DEFERRED_JOB_WORKER_ID: process.env.DEFERRED_JOB_WORKER_ID ?? `worker_dev_${port}`,
});
const mediaWorkerProcess = spawnManaged(process.execPath, [tsxCli, "scripts/media-worker-server.ts"], sharedEnv);
const backupExecutorProcess = spawnBackupExecutor();
const backupSchedulerProcess = BACKUP_SCHEDULER_ENABLED
  ? spawnManaged(process.execPath, [tsxCli, "scripts/process-backup-scheduler.ts"], sharedEnv)
  : null;

let shuttingDown = false;
let shutdownPromise = null;

function terminate(child, signal = "SIGTERM") {
  if (child && !child.killed) {
    child.kill(signal);
  }
}

async function shutdown(signal, exitCode = 0) {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shuttingDown = true;
  terminate(workerProcess, signal);
  terminate(mediaWorkerProcess, signal);
  terminate(backupExecutorProcess, signal);
  terminate(backupSchedulerProcess, signal);
  terminate(nextProcess, signal);
  releaseDevStackLock();

  shutdownPromise = Promise.all([
    waitForChildExit(workerProcess),
    waitForChildExit(mediaWorkerProcess),
    waitForChildExit(backupExecutorProcess),
    waitForChildExit(backupSchedulerProcess),
    waitForChildExit(nextProcess),
  ]).finally(() => {
    process.exit(exitCode);
  });

  return shutdownPromise;
}

process.on("SIGINT", () => {
  void shutdown("SIGINT", 0);
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM", 0);
});

workerProcess.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }

  console.error("[deferred-jobs] worker exited unexpectedly", { code, signal });
  void shutdown("SIGTERM", code ?? 1);
});

mediaWorkerProcess.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }

  console.error("[media-worker] process exited unexpectedly", { code, signal });
  void shutdown("SIGTERM", code ?? 1);
});

backupExecutorProcess?.on("exit", (code, signal) => {
  if (shuttingDown || isExpectedChildShutdownSignal(signal)) {
    return;
  }

  console.error("[backup-executor] process exited unexpectedly", { code, signal });
  void shutdown("SIGTERM", code ?? 1);
});

backupSchedulerProcess?.on("exit", (code, signal) => {
  if (shuttingDown || isExpectedChildShutdownSignal(signal)) {
    return;
  }

  console.error("[backup-scheduler] process exited unexpectedly", { code, signal });
  void shutdown("SIGTERM", code ?? 1);
});

nextProcess.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }

  console.error("[next-dev] process exited", { code, signal });
  void shutdown("SIGTERM", code ?? 1);
});

function spawnBackupExecutor() {
  if (!BACKUP_EXECUTOR_ENABLED) {
    console.warn("[backup-executor] disabled by DISABLE_BACKUP_EXECUTOR=1");
    return null;
  }

  if (!existsSync(BACKUP_EXECUTOR_PATH)) {
    console.warn(`[backup-executor] binary unavailable at ${BACKUP_EXECUTOR_PATH}; building local executor`);
    const install = spawnSync(
      process.execPath,
      ["scripts/install-backup-executor.mjs"],
      { stdio: "inherit", env: sharedEnv },
    );

    if (install.status !== 0 || !existsSync(BACKUP_EXECUTOR_PATH)) {
      console.warn(
        `[backup-executor] binary unavailable at ${BACKUP_EXECUTOR_PATH}. `
        + "Run npm run backup:install-executor to inspect the build failure.",
      );
      return null;
    }
  }

  return spawnManaged(BACKUP_EXECUTOR_PATH, [
    "daemon",
    "--db-path",
    SQLITE_PATH,
    "--poll-interval-ms",
    String(BACKUP_EXECUTOR_POLL_INTERVAL_MS),
    "--lease-seconds",
    String(BACKUP_EXECUTOR_LEASE_SECONDS),
    "--lease-owner",
    process.env.ORDO_BACKUP_EXECUTOR_LEASE_OWNER ?? `backup_executor_dev_${port}`,
  ], {
    ...sharedEnv,
    ORDO_RUNTIME_PROCESS_ROLE: "app",
  });
}

try {
  await waitForHttpReady(`http://127.0.0.1:${MEDIA_WORKER_PORT}/health`, MEDIA_WORKER_READY_TIMEOUT_MS);
} catch (error) {
  console.error("[dev] media worker failed readiness check", {
    port: MEDIA_WORKER_PORT,
    error: error instanceof Error ? error.message : String(error),
  });
  await shutdown("SIGTERM", 1);
}
