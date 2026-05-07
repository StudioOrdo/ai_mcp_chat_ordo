import { loadLocalEnv } from "./load-local-env";
import {
  getBackupScheduleReconciler,
  getBackupScheduleService,
} from "@/adapters/RepositoryFactory";

loadLocalEnv();

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);
if (nodeMajor !== 22) {
  throw new Error(
    `Backup scheduler requires Node 22 because better-sqlite3 is native; current runtime is ${process.version}.`,
  );
}

const pollIntervalMs = Number.parseInt(process.env.ORDO_BACKUP_SCHEDULER_POLL_INTERVAL_MS ?? "60000", 10);
const runOnce = process.env.ORDO_BACKUP_SCHEDULER_RUN_ONCE === "1";
const disabled = process.env.DISABLE_BACKUP_SCHEDULER === "1";

async function tick() {
  const reconcile = await getBackupScheduleReconciler().reconcile();
  const scheduled = await getBackupScheduleService().runOnce();
  return { reconcile, scheduled };
}

async function main() {
  if (disabled) {
    console.info("[backup-scheduler] disabled by DISABLE_BACKUP_SCHEDULER=1");
    return;
  }

  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  do {
    const result = await tick();
    if (result.reconcile.promotedSnapshotId) {
      console.info("[backup-scheduler] reconciled scheduled backup", {
        promotedSnapshotId: result.reconcile.promotedSnapshotId,
      });
    }
    if (result.scheduled.result) {
      console.info("[backup-scheduler] enqueued scheduled backup", {
        snapshotId: result.scheduled.result.snapshot.id,
        commandId: result.scheduled.result.command.id,
      });
    }
    if (runOnce) {
      return;
    }
    await sleep(pollIntervalMs, controller.signal);
  } while (!controller.signal.aborted);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, Math.max(1000, ms));
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

main().catch((error) => {
  console.error("[backup-scheduler] fatal", error);
  process.exitCode = 1;
});
