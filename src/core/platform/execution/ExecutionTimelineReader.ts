import type { JobStatus } from "@/core/entities/job";
import type { StageRunRecord } from "@/core/entities/stage-run-record";
import type { WorkOrder } from "@/core/entities/work-order";
import type {
  FactoryCheckpointRecord,
  FactoryEventRecord,
  FactoryOutputRecord,
  FactoryRepository,
} from "@/core/use-cases/FactoryRepository";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { JobStatusQuery, JobStatusQueryOptions } from "@/core/use-cases/JobStatusQuery";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import type { MessageRepository } from "@/core/use-cases/MessageRepository";
import type {
  ExecutionTimeline,
  ReadExecutionTimelineRequest,
} from "@/core/platform/execution/ExecutionTimeline";
import {
  projectChatTurnExecutionTimeline,
  createUnsupportedExecutionTimeline,
  projectJobExecutionTimeline,
  projectToolExecutionTimeline,
  projectWorkOrderExecutionTimeline,
} from "@/core/platform/execution/ExecutionTimelineProjector";
import { projectObservabilityExecutionTimeline } from "@/core/platform/execution/ObservabilityTimelineProjector";
import { mapJobEventHistory, type JobHistoryEntry } from "@/lib/jobs/job-event-history";
import { buildCanonicalJobSnapshot, type CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { PromptTurnProvenanceRecord } from "@/lib/prompts/prompt-provenance-store";

export interface PromptTurnProvenanceReader {
  findById?(id: string): Promise<PromptTurnProvenanceRecord | null>;
  findByConversationAndTurnId(conversationId: string, turnId: string): Promise<PromptTurnProvenanceRecord | null>;
}

export interface ChatTurnTimelineDeps {
  promptTurnReader?: PromptTurnProvenanceReader;
  messageRepository?: MessageRepository;
}

type JobRecord = NonNullable<Awaited<ReturnType<JobQueueRepository["findJobById"]>>>;

export interface JobExecutionTimelineReadResult {
  job: JobRecord;
  snapshot: CanonicalJobSnapshot;
  timeline: ExecutionTimeline;
  history: JobHistoryEntry[];
}

export interface WorkOrderExecutionTimelineReadResult {
  workOrder: WorkOrder;
  activeCheckpoint: FactoryCheckpointRecord | null;
  stageRuns: StageRunRecord[];
  outputs: FactoryOutputRecord[];
  events: FactoryEventRecord[];
  timeline: ExecutionTimeline;
}

export interface ExecutionTimelineReader extends JobStatusQuery {
  readExecutionTimeline(request: ReadExecutionTimelineRequest): Promise<ExecutionTimeline | null>;
  getJobTimeline(jobId: string): Promise<JobExecutionTimelineReadResult | null>;
  getUserJobTimeline(userId: string, jobId: string): Promise<JobExecutionTimelineReadResult | null>;
  listConversationJobTimelines(
    conversationId: string,
    options?: JobStatusQueryOptions,
  ): Promise<JobExecutionTimelineReadResult[]>;
  listUserJobTimelines(userId: string, options?: JobStatusQueryOptions): Promise<JobExecutionTimelineReadResult[]>;
  getUserJobHistory(
    userId: string,
    jobId: string,
    options?: { limit?: number },
  ): Promise<JobExecutionTimelineReadResult | null>;
  getWorkOrderTimeline(workOrderId: string): Promise<WorkOrderExecutionTimelineReadResult | null>;
}

async function buildJobReadResult(
  repository: JobQueueRepository,
  job: JobRecord,
  options?: {
    history?: Awaited<ReturnType<JobQueueRepository["listEventsForUserJob"]>>;
    materializationRepository?: MaterializationRepository;
  },
): Promise<JobExecutionTimelineReadResult> {
  const [latestRenderableEvent, materialization] = await Promise.all([
    repository.findLatestRenderableEventForJob(job.id),
    options?.materializationRepository?.findByProducedJobId?.(job.id) ?? Promise.resolve(null),
  ]);
  const historyEvents = options?.history ?? [];

  return {
    job,
    snapshot: buildCanonicalJobSnapshot(job, latestRenderableEvent, { materialization }),
    timeline: projectJobExecutionTimeline({
      job,
      latestRenderableEvent,
      history: historyEvents,
    }),
    history: mapJobEventHistory(job, historyEvents),
  };
}

export class RepositoryBackedExecutionTimelineReader implements ExecutionTimelineReader {
  constructor(
    private readonly jobRepository: JobQueueRepository,
    private readonly factoryRepository?: FactoryRepository,
    private readonly chatTurnDeps: ChatTurnTimelineDeps = {},
    private readonly materializationRepository?: MaterializationRepository,
  ) {}

  async readExecutionTimeline(request: ReadExecutionTimelineRequest): Promise<ExecutionTimeline | null> {
    switch (request.executionKind) {
      case "job": {
        const result = request.userId
          ? await this.getUserJobTimeline(request.userId, request.executionId)
          : await this.getJobTimeline(request.executionId);
        return result?.timeline ?? null;
      }
      case "work_order": {
        const result = await this.getWorkOrderTimeline(request.executionId);
        return result?.timeline ?? null;
      }
      case "tool":
        return projectToolExecutionTimeline({
          executionId: request.executionId,
          toolName: request.toolName ?? request.executionId,
          envelope: request.envelope,
        });
      case "chat_turn":
        return this.getChatTurnTimeline(request.executionId, request.conversationId);
      case "observability":
        return projectObservabilityExecutionTimeline(request.executionId);
    }
  }

  private async getChatTurnTimeline(
    executionId: string,
    conversationId?: string,
  ): Promise<ExecutionTimeline> {
    const promptTurnReader = this.chatTurnDeps.promptTurnReader;
    const messageRepository = this.chatTurnDeps.messageRepository;

    if (!promptTurnReader || !messageRepository) {
      return createUnsupportedExecutionTimeline({
        executionId,
        executionKind: "chat_turn",
        title: "Chat turn",
        summary: "Chat-turn timeline projection is not yet backed by a persisted reader.",
        conversationId,
      });
    }

    const record = conversationId
      ? await promptTurnReader.findByConversationAndTurnId(conversationId, executionId)
      : await promptTurnReader.findById?.(executionId) ?? null;

    if (!record) {
      return createUnsupportedExecutionTimeline({
        executionId,
        executionKind: "chat_turn",
        title: "Chat turn",
        summary: "No persisted prompt provenance record was found for this turn.",
        conversationId,
      });
    }

    const [userMessage, assistantMessage] = await Promise.all([
      messageRepository.findById(record.userMessageId),
      record.assistantMessageId ? messageRepository.findById(record.assistantMessageId) : Promise.resolve(null),
    ]);

    return projectChatTurnExecutionTimeline({
      executionId,
      record,
      userMessage,
      assistantMessage,
    });
  }

  async getJobTimeline(jobId: string): Promise<JobExecutionTimelineReadResult | null> {
    const job = await this.jobRepository.findJobById(jobId);
    if (!job) {
      return null;
    }

    return buildJobReadResult(this.jobRepository, job, {
      materializationRepository: this.materializationRepository,
    });
  }

  async getUserJobTimeline(userId: string, jobId: string): Promise<JobExecutionTimelineReadResult | null> {
    const jobs = await this.jobRepository.listJobsByUser(userId, { limit: 100 });
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job) {
      return null;
    }

    return buildJobReadResult(this.jobRepository, job, {
      materializationRepository: this.materializationRepository,
    });
  }

  async listConversationJobTimelines(
    conversationId: string,
    options?: JobStatusQueryOptions,
  ): Promise<JobExecutionTimelineReadResult[]> {
    const jobs = await this.jobRepository.listJobsByConversation(conversationId, options);
    return Promise.all(jobs.map((job) => buildJobReadResult(this.jobRepository, job, {
      materializationRepository: this.materializationRepository,
    })));
  }

  async listUserJobTimelines(userId: string, options?: JobStatusQueryOptions): Promise<JobExecutionTimelineReadResult[]> {
    const jobs = await this.jobRepository.listJobsByUser(userId, options);
    return Promise.all(jobs.map((job) => buildJobReadResult(this.jobRepository, job, {
      materializationRepository: this.materializationRepository,
    })));
  }

  async getUserJobHistory(
    userId: string,
    jobId: string,
    options?: { limit?: number },
  ): Promise<JobExecutionTimelineReadResult | null> {
    const job = await this.jobRepository.findJobById(jobId);
    if (!job) {
      return null;
    }

    const history = await this.jobRepository.listEventsForUserJob(userId, job.id, options);
    return buildJobReadResult(this.jobRepository, job, {
      history,
      materializationRepository: this.materializationRepository,
    });
  }

  async getWorkOrderTimeline(workOrderId: string): Promise<WorkOrderExecutionTimelineReadResult | null> {
    if (!this.factoryRepository) {
      return null;
    }

    const workOrder = await this.factoryRepository.findWorkOrderById(workOrderId);
    if (!workOrder) {
      return null;
    }

    const [activeCheckpoint, stageRuns, outputs, events] = await Promise.all([
      this.factoryRepository.findLatestActiveCheckpoint(workOrderId),
      this.factoryRepository.listStageRunsForWorkOrder(workOrderId),
      this.factoryRepository.listOutputsForWorkOrder(workOrderId),
      this.factoryRepository.listEventsForWorkOrder(workOrderId),
    ]);

    return {
      workOrder,
      activeCheckpoint,
      stageRuns,
      outputs,
      events,
      timeline: projectWorkOrderExecutionTimeline({
        workOrder,
        stageRuns,
        outputs,
        events,
        activeCheckpoint,
      }),
    };
  }

  async getJobSnapshot(jobId: string): Promise<CanonicalJobSnapshot | null> {
    const result = await this.getJobTimeline(jobId);
    return result?.snapshot ?? null;
  }

  async getUserJobSnapshot(userId: string, jobId: string): Promise<CanonicalJobSnapshot | null> {
    const result = await this.getUserJobTimeline(userId, jobId);
    return result?.snapshot ?? null;
  }

  async listConversationJobSnapshots(
    conversationId: string,
    options?: JobStatusQueryOptions,
  ): Promise<CanonicalJobSnapshot[]> {
    const results = await this.listConversationJobTimelines(conversationId, options);
    return results.map((result) => result.snapshot);
  }

  async listUserJobSnapshots(userId: string, options?: JobStatusQueryOptions): Promise<CanonicalJobSnapshot[]> {
    const results = await this.listUserJobTimelines(userId, options);
    return results.map((result) => result.snapshot);
  }
}

export function createExecutionTimelineReader(
  jobRepository: JobQueueRepository,
  factoryRepository?: FactoryRepository,
  chatTurnDeps: ChatTurnTimelineDeps = {},
  materializationRepository?: MaterializationRepository,
): ExecutionTimelineReader {
  return new RepositoryBackedExecutionTimelineReader(
    jobRepository,
    factoryRepository,
    chatTurnDeps,
    materializationRepository,
  );
}
