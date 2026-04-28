import type { JobStatusQueryOptions } from "@/core/use-cases/JobStatusQuery";
import type {
  JobExecutionTimelineReadResult,
  WorkOrderExecutionTimelineReadResult,
  ExecutionTimelineReader,
} from "@/core/platform/execution/ExecutionTimelineReader";
import type { RevisionInspection } from "@/core/platform/revision/RevisionContract";
import {
  projectJobRevision,
  projectWorkOrderRevision,
} from "@/core/platform/revision/RevisionProjector";

export interface JobPlatformInteraction extends JobExecutionTimelineReadResult {
  revision: RevisionInspection;
}

export interface WorkOrderPlatformInteraction extends WorkOrderExecutionTimelineReadResult {
  revision: RevisionInspection;
}

export interface PlatformInteractionFacadeDeps {
  executionTimelineReader: ExecutionTimelineReader;
}

function toJobPlatformInteraction(result: JobExecutionTimelineReadResult): JobPlatformInteraction {
  return {
    ...result,
    revision: projectJobRevision({
      job: result.job,
      timeline: result.timeline,
    }),
  };
}

function toWorkOrderPlatformInteraction(
  result: WorkOrderExecutionTimelineReadResult,
): WorkOrderPlatformInteraction {
  return {
    ...result,
    revision: projectWorkOrderRevision({
      workOrder: result.workOrder,
      activeCheckpoint: result.activeCheckpoint,
      timeline: result.timeline,
    }),
  };
}

export class PlatformInteractionFacade {
  constructor(private readonly deps: PlatformInteractionFacadeDeps) {}

  async listUserJobInteractions(
    userId: string,
    options?: JobStatusQueryOptions,
  ): Promise<JobPlatformInteraction[]> {
    const results = await this.deps.executionTimelineReader.listUserJobTimelines(userId, options);
    return results.map(toJobPlatformInteraction);
  }

  async listConversationJobInteractions(
    conversationId: string,
    options?: JobStatusQueryOptions,
  ): Promise<JobPlatformInteraction[]> {
    const results = await this.deps.executionTimelineReader.listConversationJobTimelines(conversationId, options);
    return results.map(toJobPlatformInteraction);
  }

  async getJobInteraction(jobId: string): Promise<JobPlatformInteraction | null> {
    const result = await this.deps.executionTimelineReader.getJobTimeline(jobId);
    return result ? toJobPlatformInteraction(result) : null;
  }

  async getUserJobInteraction(userId: string, jobId: string): Promise<JobPlatformInteraction | null> {
    const result = await this.deps.executionTimelineReader.getUserJobTimeline(userId, jobId);
    return result ? toJobPlatformInteraction(result) : null;
  }

  async getUserJobHistoryInteraction(
    userId: string,
    jobId: string,
    options?: { limit?: number },
  ): Promise<JobPlatformInteraction | null> {
    const result = await this.deps.executionTimelineReader.getUserJobHistory(userId, jobId, options);
    return result ? toJobPlatformInteraction(result) : null;
  }

  async getWorkOrderInteraction(workOrderId: string): Promise<WorkOrderPlatformInteraction | null> {
    const result = await this.deps.executionTimelineReader.getWorkOrderTimeline(workOrderId);
    return result ? toWorkOrderPlatformInteraction(result) : null;
  }
}