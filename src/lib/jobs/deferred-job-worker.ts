import type { JobFailureClass, JobRequest } from "@/core/entities/job";
import type { ToolProgressUpdate } from "@/core/tool-registry/ToolExecutionContext";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import { isCapabilityResultEnvelope } from "@/lib/capabilities/capability-result-envelope";
import type { DeferredJobNotificationResult } from "./deferred-job-notifications";
import { getMediaWorkflowRepository } from "@/adapters/RepositoryFactory";
import { getJobCapability, type JobRetryPolicy } from "./job-capability-registry";
import { getJobPhaseDefinitions, normalizeJobProgressState } from "./job-progress-state";
import { appendRuntimeAuditLog } from "@/lib/observability/runtime-audit-log";
import { MediaWorkflowOrchestrator } from "@/lib/media/workflows/orchestrator";
import {
  registerComposeMediaMaterialization,
  registerGenerateAudioMaterialization,
} from "./materialization-registration";
import { AudioGenerationError } from "@/lib/audio/audio-generation-errors";

export type DeferredJobProgressUpdate = ToolProgressUpdate;

export interface DeferredJobHandlerContext {
  reportProgress: (update: DeferredJobProgressUpdate) => Promise<void>;
  abortSignal: AbortSignal;
}

export type DeferredJobHandler = (
  job: JobRequest,
  context: DeferredJobHandlerContext,
) => Promise<unknown>;

export interface DeferredJobWorkerOptions {
  workerId: string;
  leaseDurationMs?: number;
  now?: Date;
}

export interface DeferredJobWorkerResult {
  reclaimedExpiredCount: number;
  job: JobRequest | null;
  outcome: "idle" | "succeeded" | "failed" | "canceled" | "scheduled_retry";
  result?: unknown;
  errorMessage?: string;
}

export interface DeferredJobNotificationDispatcher {
  notify(job: JobRequest, eventType: "result" | "failed" | "canceled"): Promise<DeferredJobNotificationResult>;
}

function buildLeaseExpiresAt(now: Date, leaseDurationMs: number): string {
  return toIso(new Date(now.getTime() + leaseDurationMs));
}

function toIso(date: Date): string {
  return date.toISOString();
}

function resolveAbortReason(signal: AbortSignal, fallbackReason: string): string {
  if (typeof signal.reason === "string" && signal.reason.trim().length > 0) {
    return signal.reason;
  }

  if (signal.reason instanceof Error && signal.reason.message.trim().length > 0) {
    return signal.reason.message;
  }

  return fallbackReason;
}

function createAbortSignalError(signal: AbortSignal, fallbackReason: string): Error {
  const error = new Error(resolveAbortReason(signal, fallbackReason));
  error.name = "AbortError";
  return error;
}

function classifyJobFailure(error: unknown): JobFailureClass {
  if (error instanceof AudioGenerationError) {
    return error.failureClass;
  }

  if (
    typeof error === "object"
    && error !== null
    && "failureClass" in error
    && (
      error.failureClass === "transient"
      || error.failureClass === "terminal"
      || error.failureClass === "policy"
      || error.failureClass === "canceled"
    )
  ) {
    return error.failureClass;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return "canceled";
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (/(policy|forbidden|permission|not allowed|unauthorized|rbac|access denied)/.test(normalized)) {
    return "policy";
  }

  if (/(sqlite_busy|sqlite_busy_snapshot|database is locked|database table is locked|database busy|busy timeout)/.test(normalized)) {
    return "transient";
  }

  if (/(timeout|timed out|temporary|temporarily|try again|rate limit|too many requests|service unavailable|network|socket hang up|connection reset|econn|eai_again|429|502|503|504|offline|asset_pending)/.test(normalized)) {
    return "transient";
  }

  if (/(cancel|aborted)/.test(normalized)) {
    return "canceled";
  }

  return "terminal";
}

function calculateRetryDelayMs(policy: JobRetryPolicy, attemptCount: number): number {
  const baseDelayMs = policy.baseDelayMs ?? 0;

  switch (policy.backoffStrategy) {
    case "none":
      return 0;
    case "exponential":
      return baseDelayMs * Math.max(1, 2 ** Math.max(0, attemptCount - 1));
    case "fixed":
    default:
      return baseDelayMs;
  }
}

function shouldScheduleAutomaticRetry(
  policy: JobRetryPolicy | undefined,
  failureClass: JobFailureClass,
  attemptCount: number,
): policy is JobRetryPolicy & { mode: "automatic"; maxAttempts: number } {
  return policy?.mode === "automatic"
    && typeof policy.maxAttempts === "number"
    && policy.maxAttempts > 0
    && failureClass === "transient"
    && attemptCount < policy.maxAttempts;
}

function isAutomaticRetryExhausted(
  policy: JobRetryPolicy | undefined,
  failureClass: JobFailureClass,
  attemptCount: number,
): policy is JobRetryPolicy & { mode: "automatic"; maxAttempts: number } {
  return policy?.mode === "automatic"
    && typeof policy.maxAttempts === "number"
    && policy.maxAttempts > 0
    && failureClass === "transient"
    && attemptCount >= policy.maxAttempts;
}

function buildRetryScheduledSummary(nextAttempt: number, maxAttempts: number, nextRetryAt: string): string {
  return `Transient failure detected. Retry ${nextAttempt} of ${maxAttempts} scheduled for ${nextRetryAt}.`;
}

function buildRetryExhaustedSummary(attemptCount: number, maxAttempts: number): string {
  return `Automatic retries exhausted after ${attemptCount} of ${maxAttempts} allowed attempts.`;
}

function buildLeaseRecoveredSummary(previousClaimedBy: string | null): string {
  return previousClaimedBy
    ? `Worker lease expired for ${previousClaimedBy}. Job requeued for recovery.`
    : "Worker lease expired. Job requeued for recovery.";
}

function buildNotificationSentSummary(
  eventType: "result" | "failed" | "canceled",
  deliveredCount: number,
  failedCount: number,
): string {
  const deliveryLabel = deliveredCount === 1 ? "1 subscription" : `${deliveredCount} subscriptions`;
  const partialFailureLabel = failedCount > 0
    ? ` ${failedCount} endpoint${failedCount === 1 ? "" : "s"} failed and will be retried on a future terminal event.`
    : "";

  return `Push notification delivered for the ${eventType} terminal event to ${deliveryLabel}.${partialFailureLabel}`;
}

function buildNotificationFailedSummary(
  eventType: "result" | "failed" | "canceled",
  attemptedCount: number,
  errorMessage: string | null,
): string {
  const attemptsLabel = attemptedCount === 1 ? "1 subscription" : `${attemptedCount} subscriptions`;

  if (errorMessage) {
    return `Push notification delivery failed for the ${eventType} terminal event across ${attemptsLabel}: ${errorMessage}`;
  }

  return `Push notification delivery failed for the ${eventType} terminal event across ${attemptsLabel}.`;
}

function normalizeProgressUpdate(
  toolName: string,
  update: DeferredJobProgressUpdate,
): DeferredJobProgressUpdate {
  const normalizedState = normalizeJobProgressState({
    toolName,
    phases: update.phases,
    activePhaseKey: update.activePhaseKey,
    progressPercent: update.progressPercent,
    progressLabel: update.progressLabel,
  });

  return {
    ...update,
    ...normalizedState,
  };
}

function buildEventPayload(update: DeferredJobProgressUpdate): Record<string, unknown> {
  return {
    ...(update.payload ?? {}),
    ...(update.progressPercent !== undefined ? { progressPercent: update.progressPercent } : {}),
    ...(update.progressLabel !== undefined ? { progressLabel: update.progressLabel } : {}),
    ...(update.phases ? { phases: update.phases } : {}),
    ...(update.activePhaseKey !== undefined ? { activePhaseKey: update.activePhaseKey } : {}),
    ...(update.summary !== undefined ? { summary: update.summary } : {}),
    ...(update.replaySnapshot !== undefined ? { replaySnapshot: update.replaySnapshot } : {}),
    ...(update.artifacts ? { artifacts: update.artifacts } : {}),
    ...(update.resultEnvelope !== undefined ? { resultEnvelope: update.resultEnvelope } : {}),
  };
}

function buildCompletedProgressUpdate(
  toolName: string,
  update: DeferredJobProgressUpdate | null,
): DeferredJobProgressUpdate | null {
  const definitions = getJobPhaseDefinitions(toolName);
  const phases = definitions && definitions.length > 0
    ? definitions.map((definition) => ({
        key: definition.key,
        label: definition.label,
        status: "succeeded" as const,
      }))
    : update?.phases?.map((phase) => ({
        key: phase.key,
        label: phase.label,
        status: "succeeded" as const,
      }));

  if (!phases || phases.length === 0) {
    return normalizeProgressUpdate(toolName, { progressPercent: 100 });
  }

  return normalizeProgressUpdate(toolName, {
    ...update,
    phases,
    activePhaseKey: null,
    progressPercent: 100,
  });
}

function buildTerminalEventPayload(
  result: unknown,
  update: DeferredJobProgressUpdate | null,
): Record<string, unknown> {
  return {
    result,
    ...(update ? buildEventPayload({ ...update, summary: undefined }) : {}),
    ...(isCapabilityResultEnvelope(result) ? { resultEnvelope: result } : {}),
  };
}

function buildFailedEventPayload(
  errorMessage: string,
  failureClass: JobFailureClass,
): Record<string, unknown> {
  return {
    progressPercent: null,
    progressLabel: null,
    activePhaseKey: null,
    errorMessage,
    failureClass,
  };
}

function buildAuditContext(job: JobRequest, workerId: string, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    jobId: job.id,
    toolName: job.toolName,
    conversationId: job.conversationId,
    attemptCount: job.attemptCount,
    workerId,
    ...(extra ?? {}),
  };
}

function getProgressLabel(update: DeferredJobProgressUpdate | null): string | null {
  return update?.progressLabel ?? null;
}

function getProgressPercent(update: DeferredJobProgressUpdate | null): number | null {
  return update?.progressPercent ?? null;
}

function getActivePhaseKey(update: DeferredJobProgressUpdate | null): string | null {
  return update?.activePhaseKey ?? null;
}

export class DeferredJobWorker {
  constructor(
    private readonly repository: JobQueueRepository,
    private readonly handlers: Record<string, DeferredJobHandler>,
    private readonly notificationDispatcher?: DeferredJobNotificationDispatcher,
    private readonly materializationRepository?: MaterializationRepository,
  ) {}

  private async recordNotification(job: JobRequest, eventType: "result" | "failed" | "canceled"): Promise<void> {
    if (!this.notificationDispatcher) {
      return;
    }

    let notificationResult: DeferredJobNotificationResult;

    try {
      notificationResult = await this.notificationDispatcher.notify(job, eventType);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.repository.appendEvent({
        jobId: job.id,
        conversationId: job.conversationId,
        eventType: "notification_failed",
        payload: {
          terminalEventType: eventType,
          attemptedCount: 1,
          failedCount: 1,
          reason: "dispatcher_error",
          errorMessage,
          summary: buildNotificationFailedSummary(eventType, 1, errorMessage),
        },
      });
      return;
    }

    if (notificationResult.status === "suppressed") {
      return;
    }

    if (notificationResult.status === "failed") {
      await this.repository.appendEvent({
        jobId: job.id,
        conversationId: job.conversationId,
        eventType: "notification_failed",
        payload: {
          terminalEventType: eventType,
          attemptedCount: notificationResult.attemptedCount,
          failedCount: notificationResult.failedCount,
          reason: notificationResult.reason,
          errorMessage: notificationResult.lastErrorMessage,
          statusCode: notificationResult.lastErrorStatusCode,
          summary: buildNotificationFailedSummary(
            eventType,
            notificationResult.attemptedCount,
            notificationResult.lastErrorMessage,
          ),
        },
      });
      return;
    }

    await this.repository.appendEvent({
      jobId: job.id,
      conversationId: job.conversationId,
      eventType: "notification_sent",
      payload: {
        terminalEventType: eventType,
        attemptedCount: notificationResult.attemptedCount,
        deliveredCount: notificationResult.deliveredCount,
        failedCount: notificationResult.failedCount,
        summary: buildNotificationSentSummary(
          eventType,
          notificationResult.deliveredCount,
          notificationResult.failedCount,
        ),
      },
    });
  }

  private async wasCanceled(jobId: string): Promise<JobRequest | null> {
    const current = await this.repository.findJobById(jobId);
    if (current?.status === "canceled") {
      return current;
    }
    return null;
  }

  private startCancellationMonitor(jobId: string, abortController: AbortController): () => void {
    let stopped = false;

    const checkForCancellation = async () => {
      if (stopped || abortController.signal.aborted) {
        return;
      }

      const canceledJob = await this.wasCanceled(jobId);
      if (canceledJob && !abortController.signal.aborted) {
        abortController.abort("deferred_job_canceled");
      }
    };

    void checkForCancellation();

    const intervalId = setInterval(() => {
      void checkForCancellation();
    }, 250);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }

  async runNext(options: DeferredJobWorkerOptions): Promise<DeferredJobWorkerResult> {
    const baseNow = options.now ?? new Date();
    const nowIso = toIso(baseNow);
    const leaseDurationMs = options.leaseDurationMs ?? 30_000;
    const leaseExpiresAt = buildLeaseExpiresAt(baseNow, leaseDurationMs);

    const reclaimedExpiredJobs = await this.repository.requeueExpiredRunningJobs(nowIso);
    for (const recovery of reclaimedExpiredJobs) {
      await appendRuntimeAuditLog("deferred_job", "lease_recovered", {
        jobId: recovery.job.id,
        toolName: recovery.job.toolName,
        conversationId: recovery.job.conversationId,
        previousClaimedBy: recovery.previousClaimedBy,
        previousLeaseExpiresAt: recovery.previousLeaseExpiresAt,
        workerId: options.workerId,
      });
      await this.repository.appendEvent({
        jobId: recovery.job.id,
        conversationId: recovery.job.conversationId,
        eventType: "lease_recovered",
        payload: {
          previousClaimedBy: recovery.previousClaimedBy,
          previousLeaseExpiresAt: recovery.previousLeaseExpiresAt,
          summary: buildLeaseRecoveredSummary(recovery.previousClaimedBy),
        },
      });
    }

    const reclaimedExpiredCount = reclaimedExpiredJobs.length;
    const job = await this.repository.claimNextQueuedJob({
      workerId: options.workerId,
      leaseExpiresAt,
      now: nowIso,
    });

    if (!job) {
      return {
        reclaimedExpiredCount,
        job: null,
        outcome: "idle",
      };
    }

    await appendRuntimeAuditLog("deferred_job", "started", buildAuditContext(job, options.workerId, {
      leaseExpiresAt,
      recoveryMode: job.recoveryMode,
    }));

    await this.repository.appendEvent({
      jobId: job.id,
      conversationId: job.conversationId,
      eventType: "started",
      payload: { workerId: options.workerId, leaseExpiresAt },
    });

    const handler = this.handlers[job.toolName];

    if (!handler) {
      const errorMessage = `No deferred job handler registered for tool: ${job.toolName}`;
      await appendRuntimeAuditLog("deferred_job", "handler_missing", buildAuditContext(job, options.workerId, {
        errorMessage,
      }));
      const completedAt = toIso(new Date());
      await this.repository.updateJobStatus(job.id, {
        status: "failed",
        errorMessage,
        completedAt,
        leaseExpiresAt: null,
        claimedBy: null,
      });
      await this.repository.appendEvent({
        jobId: job.id,
        conversationId: job.conversationId,
        eventType: "failed",
        payload: { errorMessage },
      });
      const failedJob = await this.repository.findJobById(job.id);

      return {
        reclaimedExpiredCount,
        job: failedJob,
        outcome: "failed",
        errorMessage,
      };
    }

    let lastProgressUpdate: DeferredJobProgressUpdate | null = null;
    const abortController = new AbortController();
    const stopCancellationMonitor = this.startCancellationMonitor(job.id, abortController);

    let lastProgressReportTimeMs = 0;
    let lastProgressReportPercent = 0;

    try {

      const result = await handler(job, {
        abortSignal: abortController.signal,
        reportProgress: async (update) => {
          if (abortController.signal.aborted) {
            throw createAbortSignalError(abortController.signal, "deferred_job_canceled");
          }

          if (await this.wasCanceled(job.id)) {
            await appendRuntimeAuditLog("deferred_job", "progress_ignored_after_cancel", buildAuditContext(job, options.workerId));
            abortController.abort("deferred_job_canceled");
            throw createAbortSignalError(abortController.signal, "deferred_job_canceled");
          }

          const normalizedUpdate = normalizeProgressUpdate(job.toolName, update);
          lastProgressUpdate = normalizedUpdate;

          const progressNow = new Date();
          const nowMs = progressNow.getTime();
          const currentPercent = normalizedUpdate.progressPercent ?? 0;

          // Throttle progress updates to avoid SQLite write-lock contention.
          // Always flush if it's been > 500ms, or if progress jumped by > 5%, or if it's 100%.
          if (
            currentPercent !== 100 &&
            nowMs - lastProgressReportTimeMs < 500 &&
            currentPercent - lastProgressReportPercent < 5
          ) {
            return; // Skip DB write, but lastProgressUpdate is safely updated in memory
          }

          lastProgressReportTimeMs = nowMs;
          lastProgressReportPercent = currentPercent;

          const renewedLeaseExpiresAt = buildLeaseExpiresAt(progressNow, leaseDurationMs);

          await appendRuntimeAuditLog("deferred_job", "progress", buildAuditContext(job, options.workerId, {
            progressPercent: normalizedUpdate.progressPercent,
            progressLabel: normalizedUpdate.progressLabel,
            activePhaseKey: normalizedUpdate.activePhaseKey,
            phases: normalizedUpdate.phases,
            leaseExpiresAt: renewedLeaseExpiresAt,
          }));

          await this.repository.updateJobStatus(job.id, {
            status: "running",
            progressPercent: normalizedUpdate.progressPercent,
            progressLabel: normalizedUpdate.progressLabel,
            leaseExpiresAt: renewedLeaseExpiresAt,
            claimedBy: options.workerId,
          });
          await this.repository.appendEvent({
            jobId: job.id,
            conversationId: job.conversationId,
            eventType: "progress",
            payload: buildEventPayload(normalizedUpdate),
          });
        },
      });

      const canceledJob = await this.wasCanceled(job.id);
      if (canceledJob) {
        await appendRuntimeAuditLog("deferred_job", "canceled", buildAuditContext(canceledJob, options.workerId, {
          stage: "post_handler",
        }));
        await this.recordNotification(canceledJob, "canceled");
        return {
          reclaimedExpiredCount,
          job: canceledJob,
          outcome: "canceled",
        };
      }

      const completedAt = toIso(new Date());
      await this.repository.updateJobStatus(job.id, {
        status: "succeeded",
        resultPayload: result,
        errorMessage: null,
        completedAt,
        leaseExpiresAt: null,
        claimedBy: null,
        failureClass: null,
        nextRetryAt: null,
      });
      await this.repository.appendEvent({
        jobId: job.id,
        conversationId: job.conversationId,
        eventType: "result",
        payload: buildTerminalEventPayload(
          result,
          buildCompletedProgressUpdate(job.toolName, lastProgressUpdate),
        ),
      });
      const succeededJob = await this.repository.findJobById(job.id);
      if (succeededJob) {
        if (this.materializationRepository && succeededJob.toolName === "compose_media") {
          await registerComposeMediaMaterialization(this.materializationRepository, succeededJob, result);
        }
        if (this.materializationRepository && succeededJob.toolName === "generate_audio") {
          await registerGenerateAudioMaterialization(this.materializationRepository, succeededJob, result);
        }
        try {
          await new MediaWorkflowOrchestrator({
            workflowRepository: getMediaWorkflowRepository(),
            jobRepository: this.repository,
            ...(this.materializationRepository ? { materializationRepository: this.materializationRepository } : {}),
          }).advanceByJobId(succeededJob.id);
        } catch (workflowError) {
          await appendRuntimeAuditLog("deferred_job", "media_workflow_advance_failed", buildAuditContext(succeededJob, options.workerId, {
            errorMessage: workflowError instanceof Error ? workflowError.message : String(workflowError),
          }));
        }
        await this.recordNotification(succeededJob, "result");
      }

      await appendRuntimeAuditLog("deferred_job", "succeeded", buildAuditContext(job, options.workerId, {
        progressPercent: 100,
        progressLabel: getProgressLabel(lastProgressUpdate),
        result,
      }));

      return {
        reclaimedExpiredCount,
        job: succeededJob,
        outcome: "succeeded",
        result,
      };
    } catch (error) {
      const canceledJob = await this.wasCanceled(job.id);
      if (canceledJob) {
        await appendRuntimeAuditLog("deferred_job", "canceled", buildAuditContext(canceledJob, options.workerId, {
          stage: "error_path",
        }));
        await this.recordNotification(canceledJob, "canceled");
        return {
          reclaimedExpiredCount,
          job: canceledJob,
          outcome: "canceled",
        };
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const failureClass = classifyJobFailure(error);
      const capability = getJobCapability(job.toolName);

      if (shouldScheduleAutomaticRetry(capability?.retryPolicy, failureClass, job.attemptCount)) {
        const delayMs = calculateRetryDelayMs(capability.retryPolicy, job.attemptCount);
        const nextRetryAt = toIso(new Date(baseNow.getTime() + delayMs));
        const scheduledJob = await this.repository.updateJobStatus(job.id, {
          status: "queued",
          errorMessage,
          progressPercent: null,
          progressLabel: null,
          completedAt: null,
          leaseExpiresAt: null,
          claimedBy: null,
          failureClass,
          nextRetryAt,
          recoveryMode: capability.recoveryMode,
        });
        await this.repository.appendEvent({
          jobId: job.id,
          conversationId: job.conversationId,
          eventType: "retry_scheduled",
          payload: {
            ...(lastProgressUpdate ? buildEventPayload(lastProgressUpdate) : {}),
            errorMessage,
            failureClass,
            nextRetryAt,
            attemptCount: scheduledJob.attemptCount,
            maxAttempts: capability.retryPolicy.maxAttempts,
            summary: buildRetryScheduledSummary(
              scheduledJob.attemptCount + 1,
              capability.retryPolicy.maxAttempts,
              nextRetryAt,
            ),
          },
        });

        await appendRuntimeAuditLog("deferred_job", "retry_scheduled", buildAuditContext(scheduledJob, options.workerId, {
          errorMessage,
          failureClass,
          nextRetryAt,
          progressPercent: getProgressPercent(lastProgressUpdate),
          progressLabel: getProgressLabel(lastProgressUpdate),
        }));

        return {
          reclaimedExpiredCount,
          job: scheduledJob,
          outcome: "scheduled_retry",
          errorMessage,
        };
      }

      const completedAt = toIso(new Date());
      await this.repository.updateJobStatus(job.id, {
        status: "failed",
        errorMessage,
        progressPercent: null,
        progressLabel: null,
        completedAt,
        leaseExpiresAt: null,
        claimedBy: null,
        failureClass,
        nextRetryAt: null,
        recoveryMode: capability?.recoveryMode ?? job.recoveryMode,
      });
      await this.repository.appendEvent({
        jobId: job.id,
        conversationId: job.conversationId,
        eventType: "failed",
        payload: buildFailedEventPayload(errorMessage, failureClass),
      });
      const failedJob = await this.repository.findJobById(job.id);
      if (failedJob) {
        if (isAutomaticRetryExhausted(capability?.retryPolicy, failureClass, failedJob.attemptCount)) {
          await this.repository.appendEvent({
            jobId: failedJob.id,
            conversationId: failedJob.conversationId,
            eventType: "retry_exhausted",
            payload: {
              progressPercent: null,
              progressLabel: null,
              activePhaseKey: null,
              errorMessage,
              failureClass,
              attemptCount: failedJob.attemptCount,
              maxAttempts: capability.retryPolicy.maxAttempts,
              summary: buildRetryExhaustedSummary(
                failedJob.attemptCount,
                capability.retryPolicy.maxAttempts,
              ),
            },
          });
        }

        try {
          await new MediaWorkflowOrchestrator({
            workflowRepository: getMediaWorkflowRepository(),
            jobRepository: this.repository,
            ...(this.materializationRepository ? { materializationRepository: this.materializationRepository } : {}),
          }).advanceByJobId(failedJob.id);
        } catch (workflowError) {
          await appendRuntimeAuditLog("deferred_job", "media_workflow_advance_failed", buildAuditContext(failedJob, options.workerId, {
            errorMessage: workflowError instanceof Error ? workflowError.message : String(workflowError),
          }));
        }

        await this.recordNotification(failedJob, "failed");
      }

      await appendRuntimeAuditLog("deferred_job", "failed", buildAuditContext(job, options.workerId, {
        errorMessage,
        failureClass,
        progressPercent: getProgressPercent(lastProgressUpdate),
        progressLabel: getProgressLabel(lastProgressUpdate),
        activePhaseKey: getActivePhaseKey(lastProgressUpdate),
      }));

      return {
        reclaimedExpiredCount,
        job: failedJob,
        outcome: "failed",
        errorMessage,
      };
    } finally {
      stopCancellationMonitor();
    }
  }
}
