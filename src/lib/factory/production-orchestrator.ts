import { randomUUID } from "node:crypto";

import type { ProductBrief } from "@/core/entities/product-brief";
import type { ProductionStage } from "@/core/entities/production-stage";
import type { StageRunRecord } from "@/core/entities/stage-run-record";
import { deriveWorkOrderProgress, type ExecutionLogEntry, type WorkOrder } from "@/core/entities/work-order";
import type { FactoryOutputRecord, FactoryRepository } from "@/core/use-cases/FactoryRepository";
import type { ToolProgressUpdate } from "@/core/tool-registry/ToolExecutionContext";

import type { StageExecutorRegistry } from "./stage-executor-registry";

export interface ProductionOrchestratorOptions {
  repository: FactoryRepository;
  executorRegistry: StageExecutorRegistry;
  now?: () => string;
  idGenerator?: () => string;
  reportProgress?: (update: ToolProgressUpdate) => Promise<void> | void;
}

export interface ProductionOrchestratorExecuteInput {
  workOrderId: string;
  brief: ProductBrief;
  abortSignal?: AbortSignal;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRetryableError(error: unknown): boolean {
  if (isAbortError(error)) {
    return false;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  if (/(invalid|required|not found|cannot|must|missing)/.test(message)) {
    return false;
  }

  return /(timeout|temporary|temporarily|retry|transient|busy|locked|network|service unavailable|rate limit)/.test(message);
}

export class ProductionOrchestrator {
  constructor(private readonly options: ProductionOrchestratorOptions) {}

  async execute(input: ProductionOrchestratorExecuteInput): Promise<WorkOrder> {
    let workOrder = await this.requireWorkOrder(input.workOrderId);

    if (workOrder.status === "paused") {
      const checkpoint = await this.options.repository.findLatestActiveCheckpoint(workOrder.id);
      if (checkpoint) {
        await this.options.repository.markCheckpointConsumed(checkpoint.checkpointId, this.now());
        workOrder = await this.options.repository.updateWorkOrder(this.bumpWorkOrder({
          ...workOrder,
          status: "running",
          pausedState: undefined,
          executionLog: this.appendExecutionLog(workOrder.executionLog, {
            timestamp: this.now(),
            stageKey: checkpoint.resumeFromStageKey,
            eventType: "resumed",
            details: { checkpointId: checkpoint.checkpointId },
          }),
        }));
      }
    }

    if (!workOrder.startedAt) {
      workOrder = await this.options.repository.updateWorkOrder(this.bumpWorkOrder({
        ...workOrder,
        status: "running",
        startedAt: this.now(),
      }));
    }

    while (true) {
      input.abortSignal?.throwIfAborted();

      const current = await this.requireWorkOrder(input.workOrderId);
      const nextStage = this.findNextRunnableStage(current);

      if (current.status === "running" && nextStage) {
        const pendingPauseRequest = await this.findPendingPauseRequest(current.id);
        if (pendingPauseRequest) {
          const pausedState = {
            pausedAt: this.now(),
            reason: this.getPauseReason(pendingPauseRequest),
            resumeFromStageKey: nextStage.key,
          };
          const checkpointId = `checkpoint_${this.id()}`;

          await this.options.repository.createCheckpoint({
            checkpointId,
            workOrderId: current.id,
            pauseState: pausedState,
            resumeFromStageKey: nextStage.key,
            createdAt: this.now(),
          });
          await this.options.repository.appendEvent({
            workOrderId: current.id,
            eventType: "revision_pause_honored",
            payload: {
              requestEventId: pendingPauseRequest.id,
              resumeFromStageKey: nextStage.key,
            },
            createdAt: this.now(),
          });

          workOrder = await this.options.repository.updateWorkOrder(this.bumpWorkOrder({
            ...current,
            status: "paused",
            pausedState,
            executionLog: this.appendExecutionLog(current.executionLog, {
              timestamp: this.now(),
              stageKey: nextStage.key,
              eventType: "paused",
              details: { reason: pausedState.reason, requestEventId: pendingPauseRequest.id },
            }),
          }));
          await this.reportProgress(workOrder, nextStage.key, pausedState.reason);
          return workOrder;
        }
      }

      if (!nextStage) {
        const succeeded = await this.options.repository.updateWorkOrder(this.bumpWorkOrder({
          ...current,
          status: "succeeded",
          pausedState: undefined,
          completedAt: this.now(),
        }));
        await this.reportProgress(succeeded, undefined, `Completed ${succeeded.currentDag.stages.length} stages.`);
        return succeeded;
      }

      const existingStageRun = current.stageRuns.find((stageRun) => stageRun.stageKey === nextStage.key);
      const runningStageRun: StageRunRecord = {
        id: existingStageRun?.id ?? `sr_${this.id()}`,
        stageKey: nextStage.key,
        status: "running",
        startedAt: this.now(),
        completedAt: undefined,
        resultRef: undefined,
        errorCode: undefined,
        errorMessage: undefined,
        attemptCount: (existingStageRun?.attemptCount ?? 0) + 1,
      };

      await this.options.repository.upsertStageRun(current.id, runningStageRun);
      await this.options.repository.appendEvent({
        workOrderId: current.id,
        stageRunId: runningStageRun.id,
        eventType: "stage_started",
        payload: { stageKey: nextStage.key, attemptCount: runningStageRun.attemptCount },
        createdAt: this.now(),
      });

      workOrder = await this.options.repository.updateWorkOrder(this.bumpWorkOrder({
        ...current,
        status: "running",
        stageRuns: this.replaceStageRun(current.stageRuns, runningStageRun),
        pausedState: undefined,
        executionLog: this.appendExecutionLog(current.executionLog, {
          timestamp: this.now(),
          stageKey: nextStage.key,
          eventType: "started",
          details: { attemptCount: runningStageRun.attemptCount },
        }),
      }));
      await this.reportProgress(workOrder, nextStage.key, `Running ${nextStage.label}`);

      try {
        const stageRunWithResult = await this.executeStage(workOrder, input.brief, nextStage, runningStageRun, input.abortSignal);
        workOrder = await this.options.repository.updateWorkOrder(this.bumpWorkOrder({
          ...workOrder,
          stageRuns: this.replaceStageRun(workOrder.stageRuns, stageRunWithResult),
          executionLog: this.appendExecutionLog(workOrder.executionLog, {
            timestamp: this.now(),
            stageKey: nextStage.key,
            eventType: "succeeded",
            details: { resultEntityId: stageRunWithResult.resultRef?.entityId },
          }),
        }));
        await this.reportProgress(workOrder, nextStage.key, `Completed ${nextStage.label}`);
      } catch (error) {
        if (this.shouldRetry(input.brief, runningStageRun, error)) {
          await this.options.repository.appendEvent({
            workOrderId: current.id,
            stageRunId: runningStageRun.id,
            eventType: "stage_retry_scheduled",
            payload: { stageKey: nextStage.key, attemptCount: runningStageRun.attemptCount + 1 },
            createdAt: this.now(),
          });
          continue;
        }

        const failedStageRun: StageRunRecord = {
          ...runningStageRun,
          status: isAbortError(error) ? "canceled" : "failed",
          completedAt: this.now(),
          errorCode: isAbortError(error) ? "aborted" : "stage_failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        };

        await this.options.repository.upsertStageRun(current.id, failedStageRun);
        const checkpointId = `checkpoint_${this.id()}`;
        const pauseState = {
          pausedAt: this.now(),
          reason: failedStageRun.errorMessage ?? "Stage execution failed.",
          resumeFromStageKey: nextStage.key,
        };

        await this.options.repository.createCheckpoint({
          checkpointId,
          workOrderId: current.id,
          stageRunId: failedStageRun.id,
          pauseState,
          resumeFromStageKey: nextStage.key,
          createdAt: this.now(),
        });
        await this.options.repository.appendEvent({
          workOrderId: current.id,
          stageRunId: failedStageRun.id,
          eventType: "stage_failed",
          payload: { stageKey: nextStage.key, errorMessage: failedStageRun.errorMessage },
          createdAt: this.now(),
        });

        workOrder = await this.options.repository.updateWorkOrder(this.bumpWorkOrder({
          ...workOrder,
          status: "paused",
          stageRuns: this.replaceStageRun(workOrder.stageRuns, failedStageRun),
          pausedState: pauseState,
          executionLog: this.appendExecutionLog(workOrder.executionLog, {
            timestamp: this.now(),
            stageKey: nextStage.key,
            eventType: isAbortError(error) ? "canceled" : "failed",
            errorCode: failedStageRun.errorCode,
            errorMessage: failedStageRun.errorMessage,
          }),
        }));
        await this.reportProgress(workOrder, nextStage.key, failedStageRun.errorMessage ?? `Failed ${nextStage.label}`);
        return workOrder;
      }
    }
  }

  private async executeStage(
    workOrder: WorkOrder,
    brief: ProductBrief,
    stage: ProductionStage,
    runningStageRun: StageRunRecord,
    abortSignal?: AbortSignal,
  ): Promise<StageRunRecord> {
    const outputsByStageKey = await this.buildOutputsByStageKey(workOrder.id);
    const executor = this.options.executorRegistry.require(stage.kind);

    const timeoutMs = stage.timeoutMs ?? 60_000;
    const result = await Promise.race([
      executor.execute({
        workOrder,
        brief,
        stage,
        priorStageRuns: workOrder.stageRuns,
        resolvedInputs: { outputsByStageKey },
        abortSignal,
        emitProgress: async (payload) => {
          await this.options.repository.appendEvent({
            workOrderId: workOrder.id,
            stageRunId: runningStageRun.id,
            eventType: "stage_progress",
            payload: { stageKey: stage.key, ...payload },
            createdAt: this.now(),
          });
        },
      }),
      new Promise<never>((_, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Stage ${stage.key} timed out after ${timeoutMs}ms.`)), timeoutMs);
        abortSignal?.addEventListener("abort", () => {
          clearTimeout(timeout);
          const error = new Error("Stage execution aborted.");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      }),
    ]);

    for (const supplementalOutput of result.supplementalOutputs ?? []) {
      await this.options.repository.appendOutput({
        entityKind: supplementalOutput.entityKind,
        entity: supplementalOutput.entity as never,
        workOrderId: workOrder.id,
        stageRunId: runningStageRun.id,
        supersedesEntityId: supplementalOutput.supersedesEntityId,
      });
    }

    const output = await this.options.repository.appendOutput({
      entityKind: result.entityKind,
      entity: result.entity as never,
      workOrderId: workOrder.id,
      stageRunId: runningStageRun.id,
      supersedesEntityId: result.supersedesEntityId,
    });

    const succeededStageRun: StageRunRecord = {
      ...runningStageRun,
      status: "succeeded",
      completedAt: this.now(),
      resultRef: {
        entityKind: output.entityKind,
        entityId: output.entityId,
      },
    };

    await this.options.repository.upsertStageRun(workOrder.id, succeededStageRun);
    await this.options.repository.appendEvent({
      workOrderId: workOrder.id,
      stageRunId: runningStageRun.id,
      eventType: "stage_succeeded",
      payload: {
        stageKey: stage.key,
        resultEntityId: output.entityId,
        resultEntityKind: output.entityKind,
        supplementalOutputCount: result.supplementalOutputs?.length ?? 0,
      },
      createdAt: this.now(),
    });

    return succeededStageRun;
  }

  private async buildOutputsByStageKey(workOrderId: string): Promise<ReadonlyMap<string, FactoryOutputRecord[]>> {
    const stageRuns = await this.options.repository.listStageRunsForWorkOrder(workOrderId);
    const outputs = await this.options.repository.listOutputsForWorkOrder(workOrderId);
    const stageRunById = new Map(stageRuns.map((stageRun) => [stageRun.id, stageRun]));
    const outputsByStageKey = new Map<string, FactoryOutputRecord[]>();

    for (const output of outputs) {
      if (!output.stageRunId) {
        continue;
      }

      const stageRun = stageRunById.get(output.stageRunId);
      if (!stageRun) {
        continue;
      }

      const existing = outputsByStageKey.get(stageRun.stageKey) ?? [];
      existing.push(output);
      outputsByStageKey.set(stageRun.stageKey, existing);
    }

    return outputsByStageKey;
  }

  private findNextRunnableStage(workOrder: WorkOrder): ProductionStage | undefined {
    for (const stage of workOrder.currentDag.stages) {
      const stageRun = workOrder.stageRuns.find((candidate) => candidate.stageKey === stage.key);
      if (stageRun?.status === "succeeded") {
        continue;
      }

      const dependenciesSatisfied = stage.dependencyKeys.every((dependencyKey) =>
        workOrder.stageRuns.some((dependencyRun) => dependencyRun.stageKey === dependencyKey && dependencyRun.status === "succeeded"),
      );

      if (dependenciesSatisfied) {
        return stage;
      }
    }

    return undefined;
  }

  private shouldRetry(brief: ProductBrief, stageRun: StageRunRecord, error: unknown): boolean {
    return brief.executionPreferences.autoRetryOnFailure
      && stageRun.attemptCount < 2
      && isRetryableError(error);
  }

  private replaceStageRun(stageRuns: readonly StageRunRecord[], stageRun: StageRunRecord): StageRunRecord[] {
    const filtered = stageRuns.filter((candidate) => candidate.stageKey !== stageRun.stageKey);
    return [...filtered, stageRun];
  }

  private appendExecutionLog(log: readonly ExecutionLogEntry[], entry: ExecutionLogEntry): ExecutionLogEntry[] {
    return [...log, entry];
  }

  private bumpWorkOrder(workOrder: WorkOrder): WorkOrder {
    return {
      ...workOrder,
      revision: workOrder.revision + 1,
    };
  }

  private async requireWorkOrder(workOrderId: string): Promise<WorkOrder> {
    const workOrder = await this.options.repository.findWorkOrderById(workOrderId);
    if (!workOrder) {
      throw new Error(`Factory work order not found: ${workOrderId}`);
    }
    return workOrder;
  }

  private async findPendingPauseRequest(workOrderId: string) {
    const events = await this.options.repository.listEventsForWorkOrder(workOrderId);
    const honoredRequestIds = new Set(
      events
        .filter((event) => event.eventType === "revision_pause_honored")
        .flatMap((event) => typeof event.payload.requestEventId === "string" ? [event.payload.requestEventId] : []),
    );

    return events
      .filter((event) => event.eventType === "revision_pause_requested" && !honoredRequestIds.has(event.id))
      .at(-1);
  }

  private getPauseReason(event: { payload: Record<string, unknown> }): string {
    return typeof event.payload.reason === "string"
      ? event.payload.reason
      : "Pause requested by operator.";
  }

  private async reportProgress(workOrder: WorkOrder, activeStageKey: string | undefined, summary: string): Promise<void> {
    const snapshot = deriveWorkOrderProgress(workOrder);
    await this.options.reportProgress?.({
      progressPercent: snapshot.percent,
      progressLabel: summary,
      activePhaseKey: activeStageKey ?? null,
      phases: snapshot.phases,
      summary,
      payload: { workOrderId: workOrder.id },
    });
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }

  private id(): string {
    return this.options.idGenerator?.() ?? randomUUID();
  }
}
