import { randomUUID } from "node:crypto";

import type {
  Operation,
  OperationArtifact,
  OperationErrorPayload,
  OperationResourceRef,
  OperationStep,
  OperationStepStatus,
} from "@/core/entities/operation";
import {
  backupRestoreStepId,
  createRestoreCancelAction,
  createRestoreExecuteAction,
  type BackupRestoreOperationIdFactory,
  type BackupRestoreOperationStepKind,
} from "@/core/use-cases/operations/BackupRestoreOperationActions";
import type {
  OperationRepository,
  OperationSnapshot,
} from "@/core/use-cases/operations/OperationRepository";
import {
  advanceOperationStatus,
  requireOperationSnapshot,
} from "@/lib/appliance/backup/backup-restore-operation-executor";
import {
  NativeResultReconciler,
  type NativeResultReconciliation,
} from "@/lib/appliance/native/native-result-reconciler";
import type {
  NativeCommandResult,
  NativeOperationRef,
} from "@/lib/appliance/native/native-command-contract";
import type {
  BackupSnapshot,
  BackupSnapshotRepository,
  OperationCommandMetadata,
  RestorePlan,
  RestorePlanRepository,
  SystemCommand,
  SystemCommandQuery,
} from "@/lib/appliance/backup/types";

const STEP_SEQUENCE: Record<BackupRestoreOperationStepKind, number> = {
  "backup.create": 1,
  "backup.validate": 2,
  "restore.prepare": 1,
  "restore.confirm": 2,
  "restore.safety_backup": 3,
  "restore.execute": 4,
  "restore.verify": 5,
};

export interface BackupRestoreOperationReconcilerDeps {
  operations: OperationRepository;
  commands: SystemCommandQuery;
  snapshots: BackupSnapshotRepository;
  plans: RestorePlanRepository;
  idFactory?: BackupRestoreOperationIdFactory;
  now?: () => string;
}

export class BackupRestoreOperationReconciler {
  private readonly idFactory: BackupRestoreOperationIdFactory;

  constructor(private readonly deps: BackupRestoreOperationReconcilerDeps) {
    this.idFactory = deps.idFactory ?? ((prefix) => `${prefix}_${randomUUID()}`);
  }

  async reconcileRecent(limit = 50, offset = 0): Promise<void> {
    const commands = await this.deps.commands.listRecentOperationBackedCommands(limit, offset);
    for (const command of commands) {
      await this.reconcileCommand(command);
    }
  }

  async reconcileOperation(operationId: string, limit = 25): Promise<void> {
    const commands = await this.deps.commands.listByOperationId(operationId, limit);
    for (const command of commands) {
      await this.reconcileCommand(command);
    }
  }

  async reconcileCommand(command: SystemCommand): Promise<void> {
    const metadata = readOperationMetadata(command);
    if (!metadata) return;

    const snapshot = await this.deps.operations.findOperationById(metadata.operationId);
    if (!snapshot) return;

    switch (command.status) {
      case "pending":
        await this.reconcilePending(command, snapshot, metadata);
        return;
      case "running":
        await this.reconcileRunning(command, snapshot, metadata);
        return;
      case "succeeded":
        await this.reconcileSucceeded(command, snapshot, metadata);
        return;
      case "failed":
      case "cancelled":
      case "superseded":
        await this.reconcileFailed(command, snapshot, metadata);
        return;
    }
  }

  private async reconcilePending(
    command: SystemCommand,
    snapshot: OperationSnapshot,
    metadata: OperationCommandMetadata,
  ): Promise<void> {
    await this.setStep(snapshot.operation, metadata.stepId, inferStepKind(command, metadata), "running", {
      systemCommandId: command.id,
      output: commandOutput(command),
      resourceRef: commandResource(command),
    });
    await advanceOperationStatus(this.deps.operations, snapshot.operation.id, "queued", null, this.now());
  }

  private async reconcileRunning(
    command: SystemCommand,
    snapshot: OperationSnapshot,
    metadata: OperationCommandMetadata,
  ): Promise<void> {
    await this.setStep(snapshot.operation, metadata.stepId, inferStepKind(command, metadata), "running", {
      systemCommandId: command.id,
      output: commandOutput(command),
      resourceRef: commandResource(command),
    });
    await advanceOperationStatus(this.deps.operations, snapshot.operation.id, "running", null, this.now());
  }

  private async reconcileSucceeded(
    command: SystemCommand,
    snapshot: OperationSnapshot,
    metadata: OperationCommandMetadata,
  ): Promise<void> {
    const native = await this.reconcileNativeTerminalResult(command, snapshot, metadata, { requireValid: true });
    if (!native) return;
    if (native.status !== "succeeded") {
      await this.failNativeResult(command, snapshot, metadata, "Native result status was failed for a succeeded system command.", {
        nativeStatus: native.status,
        nativeError: native.error,
      });
      return;
    }
    if (command.command === "backup.create" && command.payload.kind === "pre_restore") {
      await this.reconcilePreRestoreBackupSucceeded(command, snapshot, metadata);
      return;
    }
    if (command.command === "backup.create") {
      await this.reconcileManualBackupSucceeded(command, snapshot, metadata);
      return;
    }
    await this.reconcileRestoreSucceeded(command, snapshot, metadata);
  }

  private async reconcileManualBackupSucceeded(
    command: SystemCommand,
    snapshot: OperationSnapshot,
    metadata: OperationCommandMetadata,
  ): Promise<void> {
    const snapshotId = stringValue(command.payload.snapshotId);
    const backupSnapshot = snapshotId ? await this.deps.snapshots.findById(snapshotId) : null;
    await this.setStep(snapshot.operation, metadata.stepId, "backup.create", "succeeded", {
      systemCommandId: command.id,
      output: commandOutput(command),
      resourceRef: backupSnapshot ? backupResource(backupSnapshot) : commandResource(command),
    });
    if (backupSnapshot) {
      await this.attachArtifactOnce(snapshot.operation.id, metadata.stepId, backupArtifact(snapshot.operation.id, metadata.stepId, backupSnapshot, command));
    }
    await advanceOperationStatus(this.deps.operations, snapshot.operation.id, "succeeded", null, this.now());
  }

  private async reconcilePreRestoreBackupSucceeded(
    command: SystemCommand,
    snapshot: OperationSnapshot,
    metadata: OperationCommandMetadata,
  ): Promise<void> {
    const restorePlanId = stringValue(command.payload.restorePlanId);
    const snapshotId = stringValue(command.payload.snapshotId);
    const backupSnapshot = snapshotId ? await this.deps.snapshots.findById(snapshotId) : null;
    let plan = restorePlanId ? await this.deps.plans.findById(restorePlanId) : null;

    if (plan && backupSnapshot && !plan.preRestoreBackupSnapshotId) {
      plan = await this.deps.plans.linkPreRestoreBackupSnapshot({
        id: plan.id,
        snapshotId: backupSnapshot.id,
      });
    }

    await this.setStep(snapshot.operation, metadata.stepId, "restore.safety_backup", "succeeded", {
      systemCommandId: command.id,
      output: commandOutput(command),
      resourceRef: backupSnapshot ? backupResource(backupSnapshot) : commandResource(command),
    });
    if (backupSnapshot) {
      await this.attachArtifactOnce(snapshot.operation.id, metadata.stepId, backupArtifact(snapshot.operation.id, metadata.stepId, backupSnapshot, command));
    }

    await advanceOperationStatus(this.deps.operations, snapshot.operation.id, "blocked", null, this.now());
    await this.exposeRestoreExecuteIfEligible(snapshot.operation.id, plan, backupSnapshot);
  }

  private async reconcileRestoreSucceeded(
    command: SystemCommand,
    snapshot: OperationSnapshot,
    metadata: OperationCommandMetadata,
  ): Promise<void> {
    const restorePlanId = stringValue(command.payload.restorePlanId);
    const plan = restorePlanId ? await this.deps.plans.findById(restorePlanId) : null;
    await this.setStep(snapshot.operation, metadata.stepId, "restore.execute", "succeeded", {
      systemCommandId: command.id,
      output: commandOutput(command),
      resourceRef: plan ? restorePlanResource(plan) : commandResource(command),
    });
    await this.setStep(snapshot.operation, backupRestoreStepId(snapshot.operation.id, "restore.verify"), "restore.verify", "succeeded", {
      output: {
        restorePlanId,
        commandId: command.id,
        commandStatus: command.status,
        planStatus: plan?.status ?? null,
      },
      resourceRef: plan ? restorePlanResource(plan) : null,
    });
    if (plan) {
      await this.attachArtifactOnce(snapshot.operation.id, metadata.stepId, restorePlanArtifact(snapshot.operation.id, metadata.stepId, plan, command));
    }
    await advanceOperationStatus(this.deps.operations, snapshot.operation.id, "succeeded", null, this.now());
  }

  private async reconcileFailed(
    command: SystemCommand,
    snapshot: OperationSnapshot,
    metadata: OperationCommandMetadata,
  ): Promise<void> {
    await this.reconcileNativeTerminalResult(command, snapshot, metadata, { requireValid: false });
    const message = command.errorMessage ?? `${command.command} command ${command.status}.`;
    await this.setStep(snapshot.operation, metadata.stepId, inferStepKind(command, metadata), "failed", {
      systemCommandId: command.id,
      output: commandOutput(command),
      error: {
        code: "BACKUP_RESTORE_COMMAND_FAILED",
        message,
        details: {
          commandId: command.id,
          command: command.command,
          status: command.status,
        },
      },
      resourceRef: commandResource(command),
    });
    await advanceOperationStatus(this.deps.operations, snapshot.operation.id, "failed", null, this.now());
  }

  private async reconcileNativeTerminalResult(
    command: SystemCommand,
    snapshot: OperationSnapshot,
    metadata: OperationCommandMetadata,
    options: { requireValid: boolean },
  ): Promise<NativeCommandResult | null> {
    const reconciler = new NativeResultReconciler({
      operations: this.deps.operations,
      now: () => this.now(),
    });
    try {
      const reconciliation: NativeResultReconciliation = await reconciler.reconcile({
        command,
        expectedOperation: toNativeOperationRef(metadata),
      });
      return reconciliation.result;
    } catch (error) {
      if (!options.requireValid) return null;
      await this.failNativeResult(command, snapshot, metadata, "Native result payload was invalid.", {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async failNativeResult(
    command: SystemCommand,
    snapshot: OperationSnapshot,
    metadata: OperationCommandMetadata,
    message: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.setStep(snapshot.operation, metadata.stepId, inferStepKind(command, metadata), "failed", {
      systemCommandId: command.id,
      output: commandOutput(command),
      error: {
        code: "NATIVE_RESULT_INVALID",
        message,
        details: {
          commandId: command.id,
          command: command.command,
          status: command.status,
          ...details,
        },
      },
      resourceRef: commandResource(command),
    });
    await advanceOperationStatus(this.deps.operations, snapshot.operation.id, "failed", null, this.now());
  }

  private async exposeRestoreExecuteIfEligible(
    operationId: string,
    plan: RestorePlan | null,
    safetySnapshot: BackupSnapshot | null,
  ): Promise<void> {
    const current = await requireOperationSnapshot(this.deps.operations, operationId);
    const disabledReason = restoreExecuteDisabledReason(plan, safetySnapshot);
    await this.deps.operations.replaceActions({
      operationId,
      actions: [
        createRestoreExecuteAction({
          operationId,
          operationRevision: current.operation.revision,
          idFactory: this.idFactory,
          restorePlanId: plan?.id ?? "",
          disabledReason,
        }),
        ...(plan ? [createRestoreCancelAction({
          operationId,
          operationRevision: current.operation.revision,
          idFactory: this.idFactory,
          restorePlanId: plan.id,
        })] : []),
      ],
      actorType: "system",
      actorId: null,
      now: this.now(),
    });
  }

  private async setStep(
    operation: Operation,
    stepId: string,
    kind: BackupRestoreOperationStepKind,
    status: OperationStepStatus,
    input: {
      systemCommandId?: string | null;
      output?: Record<string, unknown> | null;
      error?: OperationErrorPayload | null;
      resourceRef?: OperationResourceRef | null;
    },
  ): Promise<void> {
    const current = await requireOperationSnapshot(this.deps.operations, operation.id);
    const existing = current.steps.find((step) => step.id === stepId);
    if (
      existing?.status === status
      && existing.systemCommandId === (input.systemCommandId ?? existing.systemCommandId)
      && existing.error?.message === input.error?.message
    ) {
      return;
    }

    const now = this.now();
    const step: OperationStep = {
      id: stepId,
      operationId: operation.id,
      sequence: STEP_SEQUENCE[kind],
      kind,
      status,
      dependsOnStepIds: existing?.dependsOnStepIds ?? dependsOn(operation.id, kind),
      capabilityName: existing?.capabilityName ?? (kind.startsWith("backup.") ? "appliance_backup" : "appliance_restore"),
      jobId: existing?.jobId ?? null,
      systemCommandId: input.systemCommandId ?? existing?.systemCommandId ?? null,
      resourceRef: input.resourceRef ?? existing?.resourceRef ?? null,
      input: existing?.input ?? {},
      output: input.output ?? existing?.output ?? null,
      error: input.error ?? null,
      retryCount: existing?.retryCount ?? 0,
      startedAt: existing?.startedAt ?? (status === "running" ? now : null),
      completedAt: terminalStepStatus(status) ? now : null,
    };

    await this.deps.operations.upsertStep({
      step,
      actorType: "system",
      actorId: null,
      now,
    });
  }

  private async attachArtifactOnce(
    operationId: string,
    stepId: string,
    artifact: Omit<OperationArtifact, "createdAt">,
  ): Promise<void> {
    const existing = await this.deps.operations.listArtifacts(operationId, { limit: 200 });
    if (existing.some((candidate) => candidate.id === artifact.id)) return;
    await this.deps.operations.attachArtifact({
      artifact: { ...artifact, stepId },
      actorType: "system",
      actorId: null,
      now: this.now(),
    });
  }

  private now(): string {
    return this.deps.now?.() ?? new Date().toISOString();
  }
}

function readOperationMetadata(command: SystemCommand): OperationCommandMetadata | null {
  const value = command.payload.operation;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  if (
    typeof metadata.operationId !== "string"
    || typeof metadata.stepId !== "string"
    || typeof metadata.actionId !== "string"
    || (metadata.operationKind !== "backup_create" && metadata.operationKind !== "restore_execute")
  ) {
    return null;
  }
  return {
    operationId: metadata.operationId,
    stepId: metadata.stepId,
    actionId: metadata.actionId,
    operationKind: metadata.operationKind,
  };
}

function toNativeOperationRef(metadata: OperationCommandMetadata): NativeOperationRef {
  return {
    operationId: metadata.operationId,
    stepId: metadata.stepId,
    actionId: metadata.actionId,
    operationKind: metadata.operationKind,
  };
}

function inferStepKind(command: SystemCommand, metadata: OperationCommandMetadata): BackupRestoreOperationStepKind {
  if (command.command === "restore.request") return "restore.execute";
  if (command.payload.kind === "pre_restore") return "restore.safety_backup";
  return metadata.operationKind === "backup_create" ? "backup.create" : "restore.safety_backup";
}

function commandOutput(command: SystemCommand): Record<string, unknown> {
  return {
    commandId: command.id,
    command: command.command,
    status: command.status,
    payload: command.payload,
    resultPayload: command.resultPayload,
    errorMessage: command.errorMessage,
  };
}

function commandResource(command: SystemCommand): OperationResourceRef {
  return { type: "system_command", id: command.id, uri: `system-command:${command.id}` };
}

function backupResource(snapshot: BackupSnapshot): OperationResourceRef {
  return { type: "backup_snapshot", id: snapshot.id, uri: `backup-snapshot:${snapshot.id}` };
}

function restorePlanResource(plan: RestorePlan): OperationResourceRef {
  return { type: "restore_plan", id: plan.id, uri: `restore-plan:${plan.id}` };
}

function backupArtifact(
  operationId: string,
  stepId: string,
  snapshot: BackupSnapshot,
  command: SystemCommand,
): Omit<OperationArtifact, "createdAt"> {
  return {
    id: `${operationId}:backup_snapshot:${snapshot.id}`,
    operationId,
    stepId,
    kind: "backup_snapshot",
    uri: `backup-snapshot:${snapshot.id}`,
    label: `Backup snapshot ${snapshot.id}`,
    metadata: {
      snapshotId: snapshot.id,
      kind: snapshot.kind,
      status: snapshot.status,
      archivePath: snapshot.archivePath,
      archiveHash: snapshot.archiveHash,
      archiveSizeBytes: snapshot.archiveSizeBytes,
      commandId: command.id,
    },
  };
}

function restorePlanArtifact(
  operationId: string,
  stepId: string,
  plan: RestorePlan,
  command: SystemCommand,
): Omit<OperationArtifact, "createdAt"> {
  return {
    id: `${operationId}:restore_plan:${plan.id}`,
    operationId,
    stepId,
    kind: "restore_plan",
    uri: `restore-plan:${plan.id}`,
    label: `Restore plan ${plan.id}`,
    metadata: {
      restorePlanId: plan.id,
      snapshotId: plan.snapshotId,
      status: plan.status,
      commandId: command.id,
    },
  };
}

function restoreExecuteDisabledReason(plan: RestorePlan | null, safetySnapshot: BackupSnapshot | null): string | null {
  if (!plan) return "Restore plan is not available.";
  if (plan.status !== "confirmed") return "Restore plan must be confirmed before execution.";
  if (!plan.preRestoreBackupCommandId) return "Safety backup command has not been created.";
  if (!plan.preRestoreBackupSnapshotId) return "Safety backup snapshot is not linked yet.";
  if (!safetySnapshot || safetySnapshot.status !== "succeeded") return "Safety backup has not succeeded yet.";
  return null;
}

function dependsOn(operationId: string, kind: BackupRestoreOperationStepKind): readonly string[] {
  switch (kind) {
    case "restore.confirm":
      return [backupRestoreStepId(operationId, "restore.prepare")];
    case "restore.safety_backup":
      return [backupRestoreStepId(operationId, "restore.confirm")];
    case "restore.execute":
      return [backupRestoreStepId(operationId, "restore.safety_backup")];
    case "restore.verify":
      return [backupRestoreStepId(operationId, "restore.execute")];
    case "backup.create":
    case "backup.validate":
    case "restore.prepare":
      return [];
  }
}

function terminalStepStatus(status: OperationStepStatus): boolean {
  return ["succeeded", "failed", "skipped", "cancelled"].includes(status);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
