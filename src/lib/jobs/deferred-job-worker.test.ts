import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  JobClaimOptions,
  JobEvent,
  JobEventSeed,
  JobLeaseRecovery,
  JobOwnershipTransferRequest,
  JobRequest,
  JobRequestSeed,
  JobStatus,
  JobStatusUpdate,
} from "@/core/entities/job";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";

const { appendRuntimeAuditLogMock } = vi.hoisted(() => ({
  appendRuntimeAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/observability/runtime-audit-log", () => ({
  appendRuntimeAuditLog: appendRuntimeAuditLogMock,
}));

import { DeferredJobWorker } from "./deferred-job-worker";
import { jobEventBus } from "./job-event-bus";

function createJob(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_media_1",
    conversationId: "conv_media_1",
    userId: "usr_1",
    toolName: "compose_media",
    status: "running",
    priority: 5,
    dedupeKey: "compose_media:plan_media_1",
    initiatorType: "user",
    requestPayload: { plan: { id: "plan_media_1" } },
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 2,
    leaseExpiresAt: "2026-04-20T03:00:30.000Z",
    claimedBy: "worker_dev_3000",
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: "rerun",
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-04-20T03:00:00.000Z",
    startedAt: "2026-04-20T03:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-04-20T03:00:00.000Z",
    ...overrides,
  };
}

class InMemoryJobQueueRepository implements JobQueueRepository {
  public currentJob: JobRequest | null;

  public readonly events: JobEvent[] = [];

  constructor(job: JobRequest | null) {
    this.currentJob = job;
  }

  async createJob(_seed: JobRequestSeed): Promise<JobRequest> {
    throw new Error("Not implemented in test.");
  }

  async findJobById(id: string): Promise<JobRequest | null> {
    return this.currentJob?.id === id ? this.currentJob : null;
  }

  async findLatestEventForJob(jobId: string): Promise<JobEvent | null> {
    return this.events.filter((event) => event.jobId === jobId).at(-1) ?? null;
  }

  async findLatestRenderableEventForJob(jobId: string): Promise<JobEvent | null> {
    return this.findLatestEventForJob(jobId);
  }

  async findActiveJobByDedupeKey(_conversationId: string, _dedupeKey: string): Promise<JobRequest | null> {
    return null;
  }

  async listJobsByConversation(
    _conversationId: string,
    _options?: { statuses?: JobStatus[]; limit?: number },
  ): Promise<JobRequest[]> {
    return this.currentJob ? [this.currentJob] : [];
  }

  async listJobsByUser(
    _userId: string,
    _options?: { statuses?: JobStatus[]; limit?: number },
  ): Promise<JobRequest[]> {
    return this.currentJob ? [this.currentJob] : [];
  }

  async appendEvent(seed: JobEventSeed): Promise<JobEvent> {
    const event: JobEvent = {
      id: `jobevt_${this.events.length + 1}`,
      jobId: seed.jobId,
      conversationId: seed.conversationId,
      sequence: this.events.length + 1,
      eventType: seed.eventType,
      payload: seed.payload ?? {},
      createdAt: `2026-04-20T03:00:${String(this.events.length).padStart(2, "0")}.000Z`,
    };
    this.events.push(event);
    return event;
  }

  async requeueExpiredRunningJobs(_now: string): Promise<JobLeaseRecovery[]> {
    return [];
  }

  async listConversationEvents(
    _conversationId: string,
    _options?: { afterSequence?: number; limit?: number },
  ): Promise<JobEvent[]> {
    return [...this.events];
  }

  async listUserEvents(
    _userId: string,
    _options?: { afterSequence?: number; limit?: number },
  ): Promise<JobEvent[]> {
    return [...this.events];
  }

  async listEventsForUserJob(
    _userId: string,
    _jobId: string,
    _options?: { limit?: number },
  ): Promise<JobEvent[]> {
    return [...this.events];
  }

  async claimNextQueuedJob(_options: JobClaimOptions): Promise<JobRequest | null> {
    return this.currentJob;
  }

  async transferJobsToUser(_request: JobOwnershipTransferRequest): Promise<JobRequest[]> {
    return this.currentJob ? [this.currentJob] : [];
  }

  async updateJobStatus(id: string, update: JobStatusUpdate): Promise<JobRequest> {
    if (!this.currentJob || this.currentJob.id !== id) {
      throw new Error(`Unknown job: ${id}`);
    }

    this.currentJob = {
      ...this.currentJob,
      ...update,
      updatedAt: "2026-04-20T03:00:59.000Z",
    };

    return this.currentJob;
  }

  async cancelJob(id: string, now: string): Promise<JobRequest> {
    return this.updateJobStatus(id, {
      status: "canceled",
      completedAt: now,
    });
  }
}

describe("deferred-job-worker", () => {
  beforeEach(() => {
    appendRuntimeAuditLogMock.mockReset();
    appendRuntimeAuditLogMock.mockResolvedValue(undefined);
  });

  it("preserves structured failure metadata on failed compose_media events", async () => {
    const repository = new InMemoryJobQueueRepository(createJob());
    const error = Object.assign(
      new Error("Governed chart source asset asset_chart_1 could not be rehydrated for server composition."),
      {
        failureCode: "source_rehydration_failed",
        failureStage: "composition_preflight" as const,
      },
    );
    const worker = new DeferredJobWorker(repository, {
      compose_media: async () => {
        throw error;
      },
    });

    const result = await worker.runNext({
      workerId: "worker_dev_3000",
      now: new Date("2026-04-20T03:00:00.000Z"),
    });

    expect(result.outcome).toBe("failed");
    const failedEvent = repository.events.find((event) => event.eventType === "failed");
    expect(failedEvent?.payload).toMatchObject({
      errorMessage: "Governed chart source asset asset_chart_1 could not be rehydrated for server composition.",
      failureClass: "terminal",
    });
  });

  it("marks retry exhaustion as dead_letter and emits retry_exhausted metadata", async () => {
    const repository = new InMemoryJobQueueRepository(createJob({ attemptCount: 2 }));
    const worker = new DeferredJobWorker(repository, {
      compose_media: async () => {
        throw new Error("Temporary network timeout while composing media.");
      },
    });

    const result = await worker.runNext({
      workerId: "worker_dev_3000",
      now: new Date("2026-04-20T03:00:00.000Z"),
    });

    expect(result.outcome).toBe("failed");
    expect(repository.currentJob?.status).toBe("failed");
    const exhaustedEvent = repository.events.find((event) => event.eventType === "retry_exhausted");
    expect(exhaustedEvent?.payload).toMatchObject({
      errorMessage: "Temporary network timeout while composing media.",
      failureClass: "transient",
      attemptCount: 2,
      maxAttempts: 2,
    });
  });

  it("aborts an active job when the cancellation bus emits for that job", async () => {
    const repository = new InMemoryJobQueueRepository(createJob());
    const worker = new DeferredJobWorker(repository, {
      compose_media: async (_job, context) => new Promise((_resolve, reject) => {
        context.abortSignal.addEventListener("abort", () => {
          reject(new Error("handler aborted"));
        }, { once: true });
      }),
    });

    const runPromise = worker.runNext({
      workerId: "worker_dev_3000",
      now: new Date("2026-04-20T03:00:00.000Z"),
    });

    await Promise.resolve();
    await repository.cancelJob("job_media_1", "2026-04-20T03:00:05.000Z");
    jobEventBus.emitJobCanceled("job_media_1", "usr_owner");

    const result = await runPromise;

    expect(result.outcome).toBe("canceled");
    expect(repository.currentJob?.status).toBe("canceled");
  });
});