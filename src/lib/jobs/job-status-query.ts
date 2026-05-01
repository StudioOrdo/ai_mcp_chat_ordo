import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { JobStatusQuery, JobStatusQueryOptions } from "@/core/use-cases/JobStatusQuery";
import { createExecutionTimelineReader } from "@/core/platform/execution/ExecutionTimelineReader";
import {
  buildCanonicalJobSnapshot,
  type CanonicalJobSnapshot,
} from "@/lib/jobs/job-read-model";

async function buildSnapshot(
  repository: JobQueueRepository,
  jobId: string,
): Promise<CanonicalJobSnapshot | null> {
  const job = await repository.findJobById(jobId);
  if (!job) {
    return null;
  }

  const event = await repository.findLatestRenderableEventForJob(job.id);
  return buildCanonicalJobSnapshot(job, event);
}

async function buildSnapshotsForJobs(
  repository: JobQueueRepository,
  jobs: Awaited<ReturnType<JobQueueRepository["listJobsByUser"]>>,
): Promise<CanonicalJobSnapshot[]> {
  return Promise.all(jobs.map(async (job) => {
    const event = await repository.findLatestRenderableEventForJob(job.id);
    return buildCanonicalJobSnapshot(job, event);
  }));
}

export class RepositoryBackedJobStatusQuery implements JobStatusQuery {
  constructor(private readonly repository: JobQueueRepository) {}

  getJobSnapshot(jobId: string): Promise<CanonicalJobSnapshot | null> {
    return buildSnapshot(this.repository, jobId);
  }

  async getUserJobSnapshot(userId: string, jobId: string): Promise<CanonicalJobSnapshot | null> {
    const jobs = await this.repository.listJobsByUser(userId, { limit: 100 });
    const job = jobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      return null;
    }

    const event = await this.repository.findLatestRenderableEventForJob(job.id);
    return buildCanonicalJobSnapshot(job, event);
  }

  async listConversationJobSnapshots(
    conversationId: string,
    options?: JobStatusQueryOptions,
  ): Promise<CanonicalJobSnapshot[]> {
    const jobs = await this.repository.listJobsByConversation(conversationId, options);
    return buildSnapshotsForJobs(this.repository, jobs);
  }

  async listUserJobSnapshots(
    userId: string,
    options?: JobStatusQueryOptions,
  ): Promise<CanonicalJobSnapshot[]> {
    const jobs = await this.repository.listJobsByUser(userId, options);
    return buildSnapshotsForJobs(this.repository, jobs);
  }
}

export function createJobStatusQuery(repository: JobQueueRepository): JobStatusQuery {
  return createExecutionTimelineReader(repository);
}