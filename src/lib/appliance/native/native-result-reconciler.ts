import type {
  OperationArtifact,
  OperationEvent,
  OperationStepStatus,
} from "@/core/entities/operation";
import type {
  OperationRepository,
  OperationSnapshot,
} from "@/core/use-cases/operations/OperationRepository";
import type { SystemCommand } from "@/lib/appliance/backup/types";
import { redactSecrets } from "@/lib/observability/secret-redaction";
import {
  nativeOperationRefsEqual,
  parseNativeCommandResult,
  redactNativeCommandResult,
  type NativeCommandResult,
  type NativeOperationRef,
} from "@/lib/appliance/native/native-command-contract";

export interface NativeResultReconcilerDeps {
  operations: OperationRepository;
  now?: () => string;
}

export interface NativeResultReconciliation {
  result: NativeCommandResult;
  operationId: string | null;
  eventAppended: boolean;
  artifactIds: string[];
  skippedReason: string | null;
}

export class NativeResultReconciler {
  constructor(private readonly deps: NativeResultReconcilerDeps) {}

  async reconcile(input: {
    command: SystemCommand;
    expectedOperation?: NativeOperationRef | null;
    markStep?: boolean;
  }): Promise<NativeResultReconciliation> {
    const result = parseNativeCommandResult(input.command.resultPayload);
    if (result.commandId !== input.command.id) {
      throw new Error(`Native result commandId ${result.commandId} does not match system command ${input.command.id}.`);
    }
    if (input.expectedOperation !== undefined && !nativeOperationRefsEqual(result.operation, input.expectedOperation)) {
      throw new Error("Native result operation metadata does not match the queued system command.");
    }
    if (!result.operation) {
      return {
        result,
        operationId: null,
        eventAppended: false,
        artifactIds: [],
        skippedReason: "operation_null",
      };
    }

    const snapshot = await this.deps.operations.findOperationById(result.operation.operationId);
    if (!snapshot) {
      return {
        result,
        operationId: result.operation.operationId,
        eventAppended: false,
        artifactIds: [],
        skippedReason: "operation_not_found",
      };
    }

    const stepId = snapshot.steps.some((step) => step.id === result.operation?.stepId)
      ? result.operation.stepId
      : null;

    if (input.markStep) {
      await this.deps.operations.transitionStep({
        operationId: snapshot.operation.id,
        stepId: result.operation.stepId,
        status: nativeStatusToStepStatus(result.status),
        actorType: "worker",
        actorId: "native",
        now: this.now(),
      });
    }

    const eventAppended = await this.appendExecutorEventOnce(snapshot, stepId, input.command, result);
    const artifactIds = await this.attachNativeArtifactsOnce(snapshot, stepId, input.command, result);

    return {
      result,
      operationId: snapshot.operation.id,
      eventAppended,
      artifactIds,
      skippedReason: null,
    };
  }

  private async appendExecutorEventOnce(
    snapshot: OperationSnapshot,
    stepId: string | null,
    command: SystemCommand,
    result: NativeCommandResult,
  ): Promise<boolean> {
    const existing = await this.deps.operations.listEvents(snapshot.operation.id, { limit: 200 });
    if (existing.some((event) => isNativeExecutorEventForCommand(event, command.id))) {
      return false;
    }

    await this.deps.operations.appendEvent({
      id: nativeExecutorEventId(snapshot.operation.id, command.id),
      operationId: snapshot.operation.id,
      stepId,
      type: "executor_event_received",
      actorType: "worker",
      actorId: "native",
      now: this.now(),
      payload: nativeEventPayload(command, result),
    });
    return true;
  }

  private async attachNativeArtifactsOnce(
    snapshot: OperationSnapshot,
    stepId: string | null,
    command: SystemCommand,
    result: NativeCommandResult,
  ): Promise<string[]> {
    const existing = await this.deps.operations.listArtifacts(snapshot.operation.id, { limit: 200 });
    const existingIds = new Set(existing.map((artifact) => artifact.id));
    const attached: string[] = [];

    for (const [index, artifact] of result.artifacts.entries()) {
      const operationArtifact = nativeArtifact(snapshot.operation.id, stepId, command.id, artifact, index);
      if (existingIds.has(operationArtifact.id)) continue;
      await this.deps.operations.attachArtifact({
        artifact: operationArtifact,
        actorType: "worker",
        actorId: "native",
        now: this.now(),
      });
      attached.push(operationArtifact.id);
    }

    return attached;
  }

  private now(): string {
    return this.deps.now?.() ?? new Date().toISOString();
  }
}

function nativeStatusToStepStatus(status: NativeCommandResult["status"]): OperationStepStatus {
  return status === "succeeded" ? "succeeded" : "failed";
}

function nativeEventPayload(command: SystemCommand, result: NativeCommandResult): Record<string, unknown> {
  const safe = redactNativeCommandResult(result);
  return {
    source: "native_executor",
    commandId: command.id,
    command: command.command,
    target: command.target,
    nativeStatus: safe.status,
    summary: safe.summary,
    operation: safe.operation,
    metrics: safe.metrics,
    artifacts: safe.artifacts.map((artifact) => ({
      kind: artifact.kind,
      uri: artifact.uri,
      label: artifact.label,
      metadata: artifact.metadata,
    })),
    error: safe.error,
    schemaVersion: safe.schemaVersion,
  };
}

function isNativeExecutorEventForCommand(event: OperationEvent, commandId: string): boolean {
  return event.type === "executor_event_received"
    && event.payload.source === "native_executor"
    && event.payload.commandId === commandId;
}

function nativeArtifact(
  operationId: string,
  stepId: string | null,
  commandId: string,
  artifact: NativeCommandResult["artifacts"][number],
  index: number,
): Omit<OperationArtifact, "createdAt"> {
  const idKind = artifact.kind.replace(/[^a-zA-Z0-9_.:-]+/g, "_").slice(0, 80) || "artifact";
  const metadata = redactSecrets(artifact.metadata).value as Record<string, unknown>;
  return {
    id: `${operationId}:native:${commandId}:${index}:${idKind}`,
    operationId,
    stepId,
    kind: `native_${artifact.kind}`,
    uri: artifact.uri,
    label: artifact.label,
    metadata: {
      ...metadata,
      commandId,
      nativeKind: artifact.kind,
    },
  };
}

function nativeExecutorEventId(operationId: string, commandId: string): string {
  return `opevt_native_${operationId}_${commandId}`.replace(/[^a-zA-Z0-9_.:-]+/g, "_");
}
