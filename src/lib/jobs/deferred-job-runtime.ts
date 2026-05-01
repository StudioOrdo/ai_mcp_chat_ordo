import { setTimeout as delay } from "node:timers/promises";
import { createDeferredJobNotificationDispatcher } from "@/lib/jobs/deferred-job-notifications";
import { getMaterializationRepository } from "@/adapters/RepositoryFactory";
import { DeferredJobWorker, type DeferredJobWorkerOptions, type DeferredJobWorkerResult } from "@/lib/jobs/deferred-job-worker";
import { createDeferredJobHandlers, getDeferredJobRepository } from "./deferred-job-handlers";

export interface DeferredJobRuntimeOptions {
  workerId: string;
  pollIntervalMs?: number;
  leaseDurationMs?: number;
  signal?: AbortSignal;
  logger?: Pick<Console, "log" | "error">;
  singlePass?: boolean;
}

export interface DeferredJobRuntimeSummary {
  iterations: number;
  processedCount: number;
  reclaimedExpiredCount: number;
  lastResult: DeferredJobWorkerResult | null;
}

function logResult(logger: Pick<Console, "log" | "error">, result: DeferredJobWorkerResult): void {
  if (result.outcome === "idle") {
    logger.log("[deferred-jobs] idle", {
      reclaimedExpiredCount: result.reclaimedExpiredCount,
    });
    return;
  }

  logger.log("[deferred-jobs] processed", {
    outcome: result.outcome,
    reclaimedExpiredCount: result.reclaimedExpiredCount,
    jobId: result.job?.id ?? null,
    toolName: result.job?.toolName ?? null,
    errorMessage: result.errorMessage,
  });
}

export function createDeferredJobWorker(): DeferredJobWorker {
  return new DeferredJobWorker(
    getDeferredJobRepository(),
    createDeferredJobHandlers(),
    createDeferredJobNotificationDispatcher(),
    getMaterializationRepository(),
  );
}

export async function runDeferredJobRuntime(options: DeferredJobRuntimeOptions): Promise<DeferredJobRuntimeSummary> {
  const logger = options.logger ?? console;
  const pollIntervalMs = options.pollIntervalMs ?? Number.parseInt(process.env.DEFERRED_JOB_POLL_INTERVAL_MS ?? "2000", 10);
  const worker = createDeferredJobWorker();

  let iterations = 0;
  let processedCount = 0;
  let reclaimedExpiredCount = 0;
  let lastResult: DeferredJobWorkerResult | null = null;

  while (!options.signal?.aborted) {
    const workerOptions: DeferredJobWorkerOptions = {
      workerId: options.workerId,
      leaseDurationMs: options.leaseDurationMs,
    };

    let result: DeferredJobWorkerResult;
    try {
      result = await worker.runNext(workerOptions);
    } catch (error) {
      logger.error("[deferred-jobs] fatal", error);
      throw error;
    }

    iterations += 1;
    reclaimedExpiredCount += result.reclaimedExpiredCount;
    lastResult = result;
    logResult(logger, result);

    if (result.outcome !== "idle") {
      processedCount += 1;
    }

    if (options.singlePass) {
      break;
    }

    if (result.outcome === "idle" && pollIntervalMs > 0) {
      await delay(pollIntervalMs, undefined, { signal: options.signal }).catch((error: unknown) => {
        if (!(error instanceof Error) || error.name !== "AbortError") {
          throw error;
        }
      });
    }
  }

  logger.log("[deferred-jobs] stopped", {
    iterations,
    processedCount,
    reclaimedExpiredCount,
  });

  return {
    iterations,
    processedCount,
    reclaimedExpiredCount,
    lastResult,
  };
}
