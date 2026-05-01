import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import next from "next";

const requiredServerFilesPath = resolve(".next", "required-server-files.json");

if (!process.env.__NEXT_PRIVATE_STANDALONE_CONFIG && existsSync(requiredServerFilesPath)) {
  try {
    const requiredServerFiles = JSON.parse(readFileSync(requiredServerFilesPath, "utf-8"));
    if (requiredServerFiles?.config?.output === "standalone") {
      process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(requiredServerFiles.config);
    }
  } catch (error) {
    console.warn("[startup] unable to load serialized standalone config", error);
  }
}

// ── Instance lock ────────────────────────────────────────────────────────────

const dataDir = resolve(process.env.DATA_DIR ?? ".data");
const lockFile = join(dataDir, ".server.lock");

ensureWritableDirectory(dataDir, "DATA_DIR");

if (existsSync(lockFile)) {
  const existing = readFileSync(lockFile, "utf-8").trim();

  if (isProcessRunning(existing)) {
    console.error(
      `Another server instance appears to be running (PID: ${existing}). ` +
      `SQLite requires single-writer access. Remove ${lockFile} if the previous instance crashed.`
    );
    process.exit(1);
  }

  console.warn(`[startup] removing stale server lock for PID ${existing}`);
  releaseInstanceLock();
}

writeFileSync(lockFile, String(process.pid), "utf-8");

function releaseInstanceLock() {
  try { unlinkSync(lockFile); } catch { /* already cleaned */ }
}

function isProcessRunning(pidValue) {
  const pid = Number.parseInt(pidValue, 10);
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function ensureWritableDirectory(dir, label) {
  mkdirSync(dir, { recursive: true });

  const probePath = join(dir, `.write-probe-${process.pid}`);
  try {
    writeFileSync(probePath, "ok", "utf-8");
    unlinkSync(probePath);
  } catch (error) {
    console.error(`[startup] ${label} is not writable at ${dir}`, error);
    process.exit(1);
  }
}

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const shutdownTimeoutMs = Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS ?? "10000", 10);
const workerEnabled = process.env.DISABLE_DEFERRED_JOB_WORKER !== "1";
const externalMediaWorkerUrl = process.env.MEDIA_WORKER_URL?.trim();
const mediaWorkerEnabled = process.env.DISABLE_MEDIA_WORKER !== "1" && !externalMediaWorkerUrl;
const mediaWorkerPort = Number.parseInt(process.env.MEDIA_WORKER_PORT ?? "3101", 10);

if (mediaWorkerEnabled) {
  process.env.MEDIA_WORKER_URL = `http://127.0.0.1:${mediaWorkerPort}`;
}

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();
const tsxCli = resolve("node_modules", "tsx", "dist", "cli.mjs");
let shuttingDown = false;

// ── Worker restart-with-backoff ──────────────────────────────────────────────

const MAX_WORKER_RESTARTS = 3;
const RESTART_WINDOW_MS = 60_000;

let workerRestarts = [];
let workerHealthy = !workerEnabled;
let mediaWorkerRestarts = [];
let mediaWorkerHealthy = !mediaWorkerEnabled;
let mediaWorkerProcess = null;
let workerProcess = null;

function spawnWorker() {
  const worker = spawn(process.execPath, [tsxCli, "scripts/process-deferred-jobs.ts"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      DEFERRED_JOB_WORKER_ID: process.env.DEFERRED_JOB_WORKER_ID ?? `worker_server_${port}`,
    },
  });

  worker.stdout.on("data", (data) => {
    process.stdout.write(`[worker] ${data}`);
  });
  worker.stderr.on("data", (data) => {
    process.stderr.write(`[worker] ${data}`);
  });

  worker.on("exit", (code, signal) => {
    if (shuttingDown) return;

    workerHealthy = false;

    const now = Date.now();
    workerRestarts = workerRestarts.filter((t) => now - t < RESTART_WINDOW_MS);
    workerRestarts.push(now);

    if (workerRestarts.length > MAX_WORKER_RESTARTS) {
      console.error(
        `[deferred-jobs] worker crashed ${MAX_WORKER_RESTARTS + 1} times in ${RESTART_WINDOW_MS / 1000}s — shutting down`,
        { code, signal },
      );
      shutdown("SIGTERM");
      return;
    }

    console.warn(
      `[deferred-jobs] worker exited unexpectedly — restarting (${workerRestarts.length}/${MAX_WORKER_RESTARTS})`,
      { code, signal },
    );
    workerProcess = spawnWorker();
    workerHealthy = true;
  });

  return worker;
}

function spawnMediaWorker() {
  const worker = spawn(process.execPath, [tsxCli, "scripts/media-worker-server.ts"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      MEDIA_WORKER_PORT: String(mediaWorkerPort),
    },
  });

  worker.stdout.on("data", (data) => {
    process.stdout.write(`[media-worker] ${data}`);
  });
  worker.stderr.on("data", (data) => {
    process.stderr.write(`[media-worker] ${data}`);
  });

  worker.on("exit", (code, signal) => {
    if (shuttingDown) return;

    mediaWorkerHealthy = false;

    const now = Date.now();
    mediaWorkerRestarts = mediaWorkerRestarts.filter((t) => now - t < RESTART_WINDOW_MS);
    mediaWorkerRestarts.push(now);

    if (mediaWorkerRestarts.length > MAX_WORKER_RESTARTS) {
      console.error(
        `[media-worker] crashed ${MAX_WORKER_RESTARTS + 1} times in ${RESTART_WINDOW_MS / 1000}s — shutting down`,
        { code, signal },
      );
      shutdown("SIGTERM");
      return;
    }

    console.warn(
      `[media-worker] exited unexpectedly — restarting (${mediaWorkerRestarts.length}/${MAX_WORKER_RESTARTS})`,
      { code, signal },
    );
    mediaWorkerProcess = spawnMediaWorker();
    mediaWorkerHealthy = true;
  });

  return worker;
}

// ── Server setup ─────────────────────────────────────────────────────────────

await app.prepare();

const sockets = new Set();

async function waitForChildExit(child, timeoutMs = shutdownTimeoutMs) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const forceKillTimer = setTimeout(() => {
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  }, timeoutMs);

  try {
    await once(child, "exit");
  } finally {
    clearTimeout(forceKillTimer);
  }
}

const server = createServer((req, res) => {
  if (shuttingDown) {
    res.statusCode = 503;
    res.setHeader("Connection", "close");
    res.end("Server is shutting down.");
    return;
  }

  void handle(req, res);
});

server.on("connection", (socket) => {
  sockets.add(socket);
  socket.on("close", () => {
    sockets.delete(socket);
  });
});

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.info(`[shutdown] received ${signal}; draining connections`);
  releaseInstanceLock();

  if (workerProcess && !workerProcess.killed) {
    workerProcess.kill(signal);
  }

  if (mediaWorkerProcess && !mediaWorkerProcess.killed) {
    mediaWorkerProcess.kill(signal);
  }

  server.close(async () => {
    await waitForChildExit(workerProcess);
    await waitForChildExit(mediaWorkerProcess);
    console.info("[shutdown] server closed cleanly");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[shutdown] timeout reached; force closing remaining sockets");
    for (const socket of sockets) {
      socket.destroy();
    }
    process.exit(1);
  }, shutdownTimeoutMs).unref();
}

mediaWorkerProcess = mediaWorkerEnabled ? spawnMediaWorker() : null;
workerProcess = workerEnabled ? spawnWorker() : null;

if (workerEnabled) {
  workerHealthy = true;
}

if (mediaWorkerEnabled) {
  mediaWorkerHealthy = true;
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { workerHealthy, mediaWorkerHealthy, MAX_WORKER_RESTARTS, RESTART_WINDOW_MS };

server.listen(port, hostname, () => {
  console.info(`server listening on http://${hostname}:${port}`);
});
