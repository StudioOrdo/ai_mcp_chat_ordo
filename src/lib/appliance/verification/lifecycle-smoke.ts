import { mkdir } from "node:fs/promises";
import path from "node:path";
import { closeDbConnection, ensureDbSchema } from "@/lib/db";
import {
  getBackupPolicyDataMapper,
  getBackupScheduleReconciler,
  getBackupScheduleService,
  getBackupSelfService,
  getBackupSystemCommandDataMapper,
  getRestorePlanDataMapper,
} from "@/adapters/RepositoryFactory";
import { getApplianceHealthReport } from "@/lib/appliance/health-facade";
import { LocalLifecycleAdapter } from "./local-lifecycle-adapter";
import { DockerLifecycleAdapter } from "./docker-lifecycle-adapter";
import { hashPrefix, redactPathLabel, writeLifecycleEvidence } from "./lifecycle-evidence";
import { runCommand } from "./command-runner";
import type {
  ApplianceSmokeMode,
  LifecycleSmokeEvidence,
  LifecycleSmokeStatus,
  LifecycleSmokeStepResult,
} from "./lifecycle-types";

const requester = {
  userId: null,
  role: "ADMIN" as const,
  requestedFrom: "appliance_lifecycle_smoke",
};

export async function runApplianceLifecycleSmoke(input: {
  mode: ApplianceSmokeMode;
  writeEvidence?: boolean;
  evidenceDir?: string;
}): Promise<{ evidence: LifecycleSmokeEvidence; evidencePaths?: { jsonPath: string; markdownPath: string } }> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const steps: LifecycleSmokeStepResult[] = [];
  const warnings: string[] = [];
  const rustVersion = await getRustVersion();
  const gitRevision = await getGitRevision();

  let evidence: LifecycleSmokeEvidence;

  if (input.mode === "docker" || input.mode === "compose-single-image") {
    evidence = await runDockerAvailabilitySmoke({
      mode: input.mode,
      startedAt,
      startedMs,
      steps,
      warnings,
      rustVersion,
      gitRevision,
    });
  } else {
    evidence = await runLocalSmoke({
      startedAt,
      startedMs,
      steps,
      warnings,
      rustVersion,
      gitRevision,
    });
  }

  const evidencePaths = input.writeEvidence
    ? await writeLifecycleEvidence({ evidence, outputDir: input.evidenceDir })
    : undefined;
  return { evidence, evidencePaths };
}

async function runLocalSmoke(input: {
  startedAt: string;
  startedMs: number;
  steps: LifecycleSmokeStepResult[];
  warnings: string[];
  rustVersion: string | null;
  gitRevision: string | null;
}): Promise<LifecycleSmokeEvidence> {
  const adapter = new LocalLifecycleAdapter();
  const runtime = await step(input.steps, "prepare temp data boundary", async () => {
    const prepared = await adapter.prepare();
    process.env.DATA_DIR = prepared.dataDir;
    process.env.STUDIO_ORDO_DB_PATH = prepared.sqlitePath;
    process.env.STUDIO_ORDO_BLOG_ASSET_ROOT = path.join(prepared.dataDir, "blog-assets");
    process.env.STUDIO_ORDO_USER_FILE_ROOT = path.join(prepared.dataDir, "user-files");
    process.env.ORDO_BACKUP_EXECUTOR_PATH = prepared.executorPath;
    process.env.DISABLE_BACKUP_EXECUTOR = "0";
    process.env.DISABLE_BACKUP_SCHEDULER = "0";
    process.env.DISABLE_MEDIA_WORKER = "1";
    await mkdir(path.join(prepared.dataDir, "blog-assets"), { recursive: true });
    return prepared;
  });

  let manualBackupId: string | null = null;
  let scheduledBackupId: string | null = null;
  let archiveSizeBytes: number | null = null;
  let archiveHash: string | null = null;
  let restorePlanId: string | null = null;
  let schedulerCommandId: string | null = null;
  let schedulerDecision: string | null = null;
  let restoredSeedFile = false;
  let health: Awaited<ReturnType<typeof getUnavailableHealth>> | Awaited<ReturnType<typeof getApplianceHealthReport>> = await getUnavailableHealth();

  try {
    await step(input.steps, "install Rust backup executor", async () => {
      await adapter.ensureExecutor(runtime);
      return "executor available";
    });

    await step(input.steps, "initialize SQLite schema", async () => {
      ensureDbSchema();
      return "schema initialized";
    });

    health = await step(input.steps, "read appliance health", async () => getApplianceHealthReport({ timeoutMs: 2_500 }));

    const manual = await step(input.steps, "create manual backup through Rust", async () => {
      const queued = await getBackupSelfService().createManualBackup(
        requester,
        smokeOperationMetadata("op_smoke_backup", "op_smoke_backup:backup.create", "act_smoke_backup", "backup_create"),
      );
      await adapter.runExecutorOnce(runtime);
      const snapshotId = queued.snapshot?.id;
      if (!snapshotId) {
        throw new Error("Manual backup did not create a snapshot id.");
      }
      const validated = await getBackupSelfService().validateBackup(snapshotId, requester);
      const snapshot = validated.snapshot;
      if (!snapshot?.archivePath || !snapshot.archiveHash || !snapshot.archiveSizeBytes) {
        throw new Error("Manual backup did not produce complete archive metadata.");
      }
      return snapshot;
    });
    manualBackupId = manual.id;
    archiveSizeBytes = manual.archiveSizeBytes;
    archiveHash = manual.archiveHash;

    await step(input.steps, "verify restart-persistent seed data", async () => {
      const seed = await adapter.readSeed(runtime);
      if (!seed.includes("ordo appliance smoke seed")) {
        throw new Error("Seed file was not readable after backup.");
      }
      return "seed file readable";
    });

    const scheduled = await step(input.steps, "enqueue and complete scheduled backup", async () => {
      const policy = await getBackupPolicyDataMapper().getOrCreateDefaultPolicy();
      await getBackupPolicyDataMapper().updateDefaultPolicy({
        enabled: true,
        interval: "6h",
        retentionCount: 7,
        latestSuccessfulBackupId: policy.latestSuccessfulBackupId,
        lastScheduledAt: null,
        nextScheduledAt: new Date(Date.now() - 60_000).toISOString(),
        updatedByUserId: null,
      });
      const scheduledRun = await getBackupScheduleService().runOnce();
      schedulerDecision = scheduledRun.decision.action;
      schedulerCommandId = scheduledRun.result?.command.id ?? null;
      if (!scheduledRun.result?.snapshot.id) {
        throw new Error(`Scheduled backup was not enqueued: ${scheduledRun.decision.action}`);
      }
      await adapter.runExecutorOnce(runtime);
      await getBackupScheduleReconciler().reconcile();
      const snapshot = await getBackupSystemCommandDataMapper().findById(scheduledRun.result.command.id)
        .then(async (command) => {
          const snapshotId = typeof command?.payload.snapshotId === "string" ? command.payload.snapshotId : null;
          return snapshotId ? getBackupSelfService().validateBackup(snapshotId, requester).then((result) => result.snapshot) : null;
        });
      if (!snapshot?.id) {
        throw new Error("Scheduled backup did not complete with a readable snapshot.");
      }
      return snapshot;
    });
    scheduledBackupId = scheduled.id;

    const restorePlan = await step(input.steps, "prepare and execute restore", async () => {
      if (!manualBackupId) {
        throw new Error("Manual backup id missing before restore.");
      }
      const planResult = await getBackupSelfService().createRestorePlan(manualBackupId, requester);
      const plan = planResult.restorePlan;
      if (!plan) {
        throw new Error("Restore plan was not created.");
      }
      restorePlanId = plan.id;
      await getBackupSelfService().confirmRestorePlan(plan.id, plan.confirmationPhrase, requester);
      const preRestore = await getBackupSelfService().requestPreRestoreBackup(
        plan.id,
        requester,
        smokeOperationMetadata("op_smoke_restore", "op_smoke_restore:restore.safety_backup", "act_smoke_safety", "restore_execute"),
      );
      await adapter.runExecutorOnce(runtime);
      const preRestoreCommandId = preRestore.command?.id;
      const preRestoreCommand = preRestoreCommandId
        ? await getBackupSystemCommandDataMapper().findById(preRestoreCommandId)
        : null;
      const preRestoreSnapshotId = typeof preRestoreCommand?.payload.snapshotId === "string"
        ? preRestoreCommand.payload.snapshotId
        : null;
      if (!preRestoreSnapshotId) {
        throw new Error("Pre-restore backup did not expose a snapshot id.");
      }
      await getRestorePlanDataMapper().linkPreRestoreBackupSnapshot({
        id: plan.id,
        snapshotId: preRestoreSnapshotId,
      });
      await adapter.deleteSeed(runtime);
      const execute = await getBackupSelfService().executeConfirmedRestore(
        plan.id,
        requester,
        smokeOperationMetadata("op_smoke_restore", "op_smoke_restore:restore.execute", "act_smoke_execute", "restore_execute"),
      );
      if (!execute.command?.id) {
        throw new Error("Restore command was not enqueued.");
      }
      closeDbConnection();
      await adapter.runExecutorOnce(runtime);
      const restored = await adapter.readSeed(runtime);
      if (!restored.includes("ordo appliance smoke seed")) {
        throw new Error("Restore did not recover the seed file.");
      }
      restoredSeedFile = true;
      return plan;
    });
    restorePlanId = restorePlan.id;

    return buildEvidence({
      mode: "local",
      status: "passed",
      startedAt: input.startedAt,
      startedMs: input.startedMs,
      steps: input.steps,
      warnings: input.warnings,
      rustVersion: input.rustVersion,
      gitRevision: input.gitRevision,
      dataDirLabel: redactPathLabel(runtime.dataDir),
      appPort: null,
      mediaPort: null,
      executorPath: runtime.executorPath,
      health,
      manualBackupId,
      scheduledBackupId,
      archiveSizeBytes,
      archiveHash,
      restorePlanId,
      schedulerCommandId,
      schedulerDecision,
      restoredSeedFile,
      restartVerified: true,
    });
  } catch (error) {
    input.warnings.push(error instanceof Error ? error.message : String(error));
    return buildEvidence({
      mode: "local",
      status: "failed",
      startedAt: input.startedAt,
      startedMs: input.startedMs,
      steps: input.steps,
      warnings: input.warnings,
      rustVersion: input.rustVersion,
      gitRevision: input.gitRevision,
      dataDirLabel: redactPathLabel(runtime.dataDir),
      appPort: null,
      mediaPort: null,
      executorPath: runtime.executorPath,
      health,
      manualBackupId,
      scheduledBackupId,
      archiveSizeBytes,
      archiveHash,
      restorePlanId,
      schedulerCommandId,
      schedulerDecision,
      restoredSeedFile,
      restartVerified: false,
    });
  } finally {
    await adapter.cleanup(runtime);
  }
}

function smokeOperationMetadata(
  operationId: string,
  stepId: string,
  actionId: string,
  operationKind: "backup_create" | "restore_execute",
) {
  return { operationId, stepId, actionId, operationKind };
}

async function runDockerAvailabilitySmoke(input: {
  mode: "docker" | "compose-single-image";
  startedAt: string;
  startedMs: number;
  steps: LifecycleSmokeStepResult[];
  warnings: string[];
  rustVersion: string | null;
  gitRevision: string | null;
}): Promise<LifecycleSmokeEvidence> {
  const adapter = new DockerLifecycleAdapter();
  const available = await step(input.steps, "check Docker availability", async () => adapter.isAvailable());
  if (!available) {
    input.warnings.push("Docker is unavailable; run APPLIANCE_SMOKE_MODE=local for non-Docker proof.");
    return buildEvidence({
      mode: input.mode,
      status: "skipped",
      startedAt: input.startedAt,
      startedMs: input.startedMs,
      steps: input.steps,
      warnings: input.warnings,
      rustVersion: input.rustVersion,
      gitRevision: input.gitRevision,
      dataDirLabel: "unavailable",
      appPort: null,
      mediaPort: null,
      executorPath: null,
      health: await getUnavailableHealth(),
      manualBackupId: null,
      scheduledBackupId: null,
      archiveSizeBytes: null,
      archiveHash: null,
      restorePlanId: null,
      schedulerCommandId: null,
      schedulerDecision: null,
      restoredSeedFile: false,
      restartVerified: false,
    });
  }

  const composeServices = input.mode === "compose-single-image"
    ? await step(input.steps, "inspect compose single-image services", async () => adapter.inspectSingleImageComposeContract())
    : null;
  if (composeServices && (
    composeServices.stdout.split(/\s+/).filter(Boolean).some((service) => service !== "app")
  )) {
    throw new Error(`Compose must expose only the app service, got: ${composeServices.stdout.trim()}`);
  }

  const imageTag = `ordo-appliance-smoke:${Date.now()}`;
  await step(input.steps, "build Docker appliance image", async () => {
    const result = await adapter.buildImage(imageTag);
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "Docker build failed.");
    }
    return imageTag;
  });

  return buildEvidence({
    mode: input.mode,
    status: "passed",
    startedAt: input.startedAt,
    startedMs: input.startedMs,
    steps: input.steps,
    warnings: input.warnings,
    rustVersion: input.rustVersion,
    gitRevision: input.gitRevision,
    dataDirLabel: "docker-temp",
    appPort: null,
    mediaPort: null,
    executorPath: "/app/bin/ordo-backup",
    imageTag,
    health: await getUnavailableHealth(),
    manualBackupId: null,
    scheduledBackupId: null,
    archiveSizeBytes: null,
    archiveHash: null,
    restorePlanId: null,
    schedulerCommandId: null,
    schedulerDecision: null,
    restoredSeedFile: false,
    restartVerified: false,
  });
}

async function step<T>(
  steps: LifecycleSmokeStepResult[],
  name: string,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const result = await run();
    steps.push({
      name,
      status: "passed",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      summary: typeof result === "string" ? result : "completed",
    });
    return result;
  } catch (error) {
    steps.push({
      name,
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      summary: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function buildEvidence(input: {
  mode: ApplianceSmokeMode;
  status: LifecycleSmokeStatus;
  startedAt: string;
  startedMs: number;
  steps: LifecycleSmokeStepResult[];
  warnings: string[];
  rustVersion: string | null;
  gitRevision: string | null;
  dataDirLabel: string;
  appPort: number | null;
  mediaPort: number | null;
  executorPath: string | null;
  imageTag?: string | null;
  health: Awaited<ReturnType<typeof getUnavailableHealth>> | Awaited<ReturnType<typeof getApplianceHealthReport>>;
  manualBackupId: string | null;
  scheduledBackupId: string | null;
  archiveSizeBytes: number | null;
  archiveHash: string | null;
  restorePlanId: string | null;
  schedulerCommandId: string | null;
  schedulerDecision: string | null;
  restoredSeedFile: boolean;
  restartVerified: boolean;
}): LifecycleSmokeEvidence {
  const completedAt = new Date().toISOString();
  return {
    phase: "05-docker-and-worker-verification-harness",
    mode: input.mode,
    status: input.status,
    startedAt: input.startedAt,
    completedAt,
    durationMs: Date.now() - input.startedMs,
    nodeVersion: process.version,
    rustVersion: input.rustVersion,
    imageTag: input.imageTag ?? null,
    gitRevision: input.gitRevision,
    dataDirLabel: input.dataDirLabel,
    appPort: input.appPort,
    mediaPort: input.mediaPort,
    executorPath: input.executorPath,
    health: {
      status: input.health.status,
      summary: "summary" in input.health ? input.health.summary : null,
      warnings: input.health.warnings,
    },
    backup: {
      manualBackupId: input.manualBackupId,
      scheduledBackupId: input.scheduledBackupId,
      archiveSizeBytes: input.archiveSizeBytes,
      archiveHashPrefix: hashPrefix(input.archiveHash),
    },
    restore: {
      restorePlanId: input.restorePlanId,
      restoredSeedFile: input.restoredSeedFile,
    },
    scheduler: {
      commandId: input.schedulerCommandId,
      decision: input.schedulerDecision,
    },
    restart: {
      verified: input.restartVerified,
    },
    steps: input.steps,
    warnings: input.warnings,
  };
}

async function getRustVersion(): Promise<string | null> {
  const result = await runCommand("rustc", ["--version"]);
  return result.status === 0 ? result.stdout.trim() : null;
}

async function getGitRevision(): Promise<string | null> {
  const result = await runCommand("git", ["rev-parse", "--short", "HEAD"]);
  return result.status === 0 ? result.stdout.trim() : null;
}

async function getUnavailableHealth() {
  return {
    status: "unavailable" as const,
    summary: null,
    warnings: [] as string[],
  };
}
