import { createMediaWorkerServer } from "@/lib/media/server/media-worker-http";

const PORT = Number.parseInt(process.env.MEDIA_WORKER_PORT ?? "3101", 10);
const shutdownTimeoutMs = Number.parseInt(process.env.MEDIA_WORKER_SHUTDOWN_TIMEOUT_MS ?? process.env.SHUTDOWN_TIMEOUT_MS ?? "10000", 10);
const server = createMediaWorkerServer();
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  process.stdout.write(`[media-worker] shutting down on ${signal}\n`);

  server.close((error) => {
    if (error) {
      process.stderr.write(`[media-worker] shutdown error: ${error.message}\n`);
      process.exit(1);
      return;
    }

    process.stdout.write("[media-worker] stopped cleanly\n");
    process.exit(0);
  });

  setTimeout(() => {
    process.stderr.write("[media-worker] shutdown timeout reached; forcing exit\n");
    process.exit(1);
  }, shutdownTimeoutMs).unref();
}

server.on("error", (error) => {
  process.stderr.write(`[media-worker] server error: ${error.message}\n`);
  process.exit(1);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`[media-worker] listening on :${PORT}\n`);
});
