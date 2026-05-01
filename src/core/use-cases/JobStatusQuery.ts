import type { JobStatus } from "@/core/entities/job";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

export interface JobStatusQueryOptions {
  statuses?: JobStatus[];
  limit?: number;
}

export interface JobStatusQuery {
  getJobSnapshot(jobId: string): Promise<CanonicalJobSnapshot | null>;
  getUserJobSnapshot(userId: string, jobId: string): Promise<CanonicalJobSnapshot | null>;
  listConversationJobSnapshots(
    conversationId: string,
    options?: JobStatusQueryOptions,
  ): Promise<CanonicalJobSnapshot[]>;
  listUserJobSnapshots(
    userId: string,
    options?: JobStatusQueryOptions,
  ): Promise<CanonicalJobSnapshot[]>;
}