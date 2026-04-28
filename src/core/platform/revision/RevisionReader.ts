import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { ReadRevisionRequest, RevisionInspection } from "@/core/platform/revision/RevisionContract";
import {
  createUnsupportedRevision,
  projectJobRevision,
  projectWorkOrderRevision,
} from "@/core/platform/revision/RevisionProjector";
import {
  createExecutionTimelineReader,
  type ExecutionTimelineReader,
  type JobExecutionTimelineReadResult,
  type WorkOrderExecutionTimelineReadResult,
} from "@/core/platform/execution/ExecutionTimelineReader";

export interface JobRevisionReadResult extends JobExecutionTimelineReadResult {
  revision: RevisionInspection;
}

export interface WorkOrderRevisionReadResult extends WorkOrderExecutionTimelineReadResult {
  revision: RevisionInspection;
}

export interface RevisionReader {
  readRevision(request: ReadRevisionRequest): Promise<RevisionInspection | null>;
  getJobRevision(jobId: string): Promise<JobRevisionReadResult | null>;
  getUserJobRevision(userId: string, jobId: string): Promise<JobRevisionReadResult | null>;
  getWorkOrderRevision(workOrderId: string): Promise<WorkOrderRevisionReadResult | null>;
}

export class RepositoryBackedRevisionReader implements RevisionReader {
  constructor(
    private readonly executionTimelineReader: ExecutionTimelineReader,
  ) {}

  async readRevision(request: ReadRevisionRequest): Promise<RevisionInspection | null> {
    switch (request.executionKind) {
      case "job": {
        const result = request.userId
          ? await this.getUserJobRevision(request.userId, request.executionId)
          : await this.getJobRevision(request.executionId);
        return result?.revision ?? null;
      }
      case "work_order": {
        const result = await this.getWorkOrderRevision(request.executionId);
        return result?.revision ?? null;
      }
      case "tool":
        return createUnsupportedRevision({
          executionId: request.executionId,
          executionKind: request.executionKind,
          title: request.toolName ?? request.executionId,
          summary: "Tool executions are not backed by a platform revision owner.",
        });
      case "chat_turn":
        return createUnsupportedRevision({
          executionId: request.executionId,
          executionKind: request.executionKind,
          title: "Chat turn",
          summary: "Chat turns do not expose platform revision support.",
          conversationId: request.conversationId,
        });
      case "observability":
        return createUnsupportedRevision({
          executionId: request.executionId,
          executionKind: request.executionKind,
          title: "Observability execution",
          summary: "Observability events do not expose platform revision support.",
        });
    }
  }

  async getJobRevision(jobId: string): Promise<JobRevisionReadResult | null> {
    const result = await this.executionTimelineReader.getJobTimeline(jobId);
    if (!result) {
      return null;
    }

    return {
      ...result,
      revision: projectJobRevision({
        job: result.job,
        timeline: result.timeline,
      }),
    };
  }

  async getUserJobRevision(userId: string, jobId: string): Promise<JobRevisionReadResult | null> {
    const result = await this.executionTimelineReader.getUserJobTimeline(userId, jobId);
    if (!result) {
      return null;
    }

    return {
      ...result,
      revision: projectJobRevision({
        job: result.job,
        timeline: result.timeline,
      }),
    };
  }

  async getWorkOrderRevision(workOrderId: string): Promise<WorkOrderRevisionReadResult | null> {
    const result = await this.executionTimelineReader.getWorkOrderTimeline(workOrderId);
    if (!result) {
      return null;
    }

    return {
      ...result,
      revision: projectWorkOrderRevision({
        workOrder: result.workOrder,
        activeCheckpoint: result.activeCheckpoint,
        timeline: result.timeline,
      }),
    };
  }
}

export function createRevisionReader(
  jobRepository: JobQueueRepository,
  factoryRepository?: FactoryRepository,
  executionTimelineReader = createExecutionTimelineReader(jobRepository, factoryRepository),
): RevisionReader {
  return new RepositoryBackedRevisionReader(executionTimelineReader);
}