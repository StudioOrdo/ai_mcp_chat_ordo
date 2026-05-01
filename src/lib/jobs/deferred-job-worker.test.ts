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
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import { AudioGenerationError } from "@/lib/audio/audio-generation-errors";
import { REASON_CODES } from "@/lib/observability/reason-codes";

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
    const repository = new InMemoryJobQueueRepository(createJob({ attemptCount: 10 }));
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
      attemptCount: 10,
      maxAttempts: 10,
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

  it("registers a reusable materialization after compose_media succeeds", async () => {
    const repository = new InMemoryJobQueueRepository(createJob({
      requestPayload: {
        plan: {
          id: "plan_media_1",
          conversationId: "conv_media_1",
          visualClips: [{ assetId: "asset_visual_1", kind: "video" }],
          audioClips: [],
          subtitlePolicy: "none",
          waveformPolicy: "none",
          outputFormat: "mp4",
        },
        materializationKey: "compose_media:key_1",
      },
    }));
    const materializationRepository: MaterializationRepository = {
      findById: vi.fn(async () => null),
      findByMaterializationKey: vi.fn(async () => null),
      findReusableSuccess: vi.fn(async () => null),
      upsert: vi.fn(async (record) => record),
      markSuperseded: vi.fn(async () => null),
      listByConversation: vi.fn(async () => []),
      findLatestByOutputRef: vi.fn(async () => null),
    };
    const worker = new DeferredJobWorker(repository, {
      compose_media: async () => ({
        schemaVersion: 1,
        toolName: "compose_media",
        family: "media",
        cardKind: "media_output",
        executionMode: "deferred",
        inputSnapshot: {},
        summary: { title: "Media Composition" },
        payload: { primaryAssetId: "asset_output_1" },
      }),
    }, undefined, materializationRepository);

    const result = await worker.runNext({
      workerId: "worker_dev_3000",
      now: new Date("2026-04-20T03:00:00.000Z"),
    });

    expect(result.outcome).toBe("succeeded");
    expect(materializationRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "mat_job_job_media_1",
      status: "ready",
      producedByJobId: "job_media_1",
      outputRefs: [
        expect.objectContaining({ id: "asset_output_1", kind: "asset" }),
      ],
    }));
  });

  it("registers a reusable materialization after generate_audio succeeds", async () => {
    const repository = new InMemoryJobQueueRepository(createJob({
      id: "job_audio_1",
      toolName: "generate_audio",
      dedupeKey: "generate_audio:key_1",
      requestPayload: {
        title: "Founder memo",
        text: "This is the founder memo for the weekly review.",
        materializationKey: "generate_audio:key_1",
      },
    }));
    const materializationRepository: MaterializationRepository = {
      findById: vi.fn(async () => null),
      findByMaterializationKey: vi.fn(async () => null),
      findReusableSuccess: vi.fn(async () => null),
      upsert: vi.fn(async (record) => record),
      markSuperseded: vi.fn(async () => null),
      listByConversation: vi.fn(async () => []),
      findLatestByOutputRef: vi.fn(async () => null),
    };
    const worker = new DeferredJobWorker(repository, {
      generate_audio: async () => ({
        schemaVersion: 1,
        toolName: "generate_audio",
        family: "artifact",
        cardKind: "artifact_viewer",
        executionMode: "deferred",
        inputSnapshot: {},
        summary: { title: "Founder memo" },
        payload: { assetId: "uf_audio_1" },
      }),
    }, undefined, materializationRepository);

    const result = await worker.runNext({
      workerId: "worker_dev_3000",
      now: new Date("2026-04-20T03:00:00.000Z"),
    });

    expect(result.outcome).toBe("succeeded");
    expect(materializationRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "mat_job_job_audio_1",
      status: "ready",
      producedByJobId: "job_audio_1",
      outputRefs: [
        expect.objectContaining({ id: "uf_audio_1", kind: "asset" }),
      ],
    }));
  });

  it("classifies transient audio provider failures without registering materialization", async () => {
    const repository = new InMemoryJobQueueRepository(createJob({
      id: "job_audio_failed_1",
      toolName: "generate_audio",
      dedupeKey: "generate_audio:key_failed_1",
      requestPayload: {
        title: "Founder memo",
        text: "This is the founder memo for the weekly review.",
        materializationKey: "generate_audio:key_failed_1",
      },
    }));
    const materializationRepository: MaterializationRepository = {
      findById: vi.fn(async () => null),
      findByMaterializationKey: vi.fn(async () => null),
      findReusableSuccess: vi.fn(async () => null),
      upsert: vi.fn(async (record) => record),
      markSuperseded: vi.fn(async () => null),
      listByConversation: vi.fn(async () => []),
      findLatestByOutputRef: vi.fn(async () => null),
    };
    const worker = new DeferredJobWorker(repository, {
      generate_audio: async () => {
        throw new AudioGenerationError(
          "OpenAI TTS failed to generate audio with status 503.",
          "transient",
          REASON_CODES.TTS_PROVIDER_FAILED,
          503,
        );
      },
    }, undefined, materializationRepository);

    const result = await worker.runNext({
      workerId: "worker_dev_3000",
      now: new Date("2026-04-20T03:00:00.000Z"),
    });

    expect(result.outcome).toBe("failed");
    expect(repository.currentJob?.failureClass).toBe("transient");
    expect(materializationRepository.upsert).not.toHaveBeenCalled();
    expect(repository.events.find((event) => event.eventType === "failed")?.payload).toMatchObject({
      failureClass: "transient",
      errorMessage: "OpenAI TTS failed to generate audio with status 503.",
    });
  });
});
