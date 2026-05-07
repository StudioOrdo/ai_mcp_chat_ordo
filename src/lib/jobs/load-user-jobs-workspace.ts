import { getJobQueueRepository, getJobStatusQuery, getMediaWorkflowReadModel } from "@/adapters/RepositoryFactory";
import type { JobStatus } from "@/core/entities/job";
import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import { mapJobEventHistory } from "@/lib/jobs/job-event-history";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import { sortUserJobSnapshots } from "@/lib/jobs/user-jobs-workspace";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";

const INITIAL_JOBS_LIMIT = 100;
const JOB_HISTORY_LIMIT = 50;
const WORK_INDEX_PAGE_LIMIT = 20;

export type JobsWorkIndexSourceKind = "job" | "media_workflow";
export type JobsWorkIndexBucket = "running" | "needs_attention" | "completed" | "history";

export interface UserJobsWorkspaceQuery {
  jobId: string | null;
  sourceId: string | null;
  status: string | null;
  bucket: JobsWorkIndexBucket | null;
  sourceKind: JobsWorkIndexSourceKind | null;
  q: string | null;
  page: number;
  limit: number;
}

export interface UserJobsWorkspacePageInfo {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface UserJobsWorkspaceData {
  workflows?: CanonicalMediaWorkflowSnapshot[];
  jobs: CanonicalJobSnapshot[];
  selectedJobId: string | null;
  selectedJob: CanonicalJobSnapshot | null;
  selectedJobHistory: JobHistoryEntry[];
  query?: UserJobsWorkspaceQuery;
  pageInfo?: UserJobsWorkspacePageInfo;
}

type RawJobsWorkspaceSearchParams = Record<string, string | string[] | undefined>;

const VALID_SOURCE_KINDS = new Set<JobsWorkIndexSourceKind>(["job", "media_workflow"]);
const VALID_BUCKETS = new Set<JobsWorkIndexBucket>(["running", "needs_attention", "completed", "history"]);
const VALID_JOB_STATUSES = new Set<JobStatus>(["queued", "running", "succeeded", "failed", "canceled", "dead_letter"]);
const VALID_WORKFLOW_STATUSES = new Set<CanonicalMediaWorkflowSnapshot["status"]>([
  "queued",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "canceled",
]);

function firstSearchValue(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeJobId(value: string | string[] | undefined): string | null {
  return firstSearchValue(value);
}

function normalizePage(value: string | string[] | undefined): number {
  const candidate = firstSearchValue(value);
  if (!candidate) {
    return 1;
  }

  const parsed = Number.parseInt(candidate, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value: string | string[] | undefined): number {
  const candidate = firstSearchValue(value);
  if (!candidate) {
    return WORK_INDEX_PAGE_LIMIT;
  }

  const parsed = Number.parseInt(candidate, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return WORK_INDEX_PAGE_LIMIT;
  }

  return Math.min(50, parsed);
}

function normalizeSourceKind(value: string | string[] | undefined): JobsWorkIndexSourceKind | null {
  const candidate = firstSearchValue(value);
  return candidate && VALID_SOURCE_KINDS.has(candidate as JobsWorkIndexSourceKind)
    ? candidate as JobsWorkIndexSourceKind
    : null;
}

function normalizeBucket(value: string | string[] | undefined): JobsWorkIndexBucket | null {
  const candidate = firstSearchValue(value);
  return candidate && VALID_BUCKETS.has(candidate as JobsWorkIndexBucket)
    ? candidate as JobsWorkIndexBucket
    : null;
}

function normalizeStatus(value: string | string[] | undefined): string | null {
  const candidate = firstSearchValue(value);
  if (!candidate) {
    return null;
  }

  return VALID_JOB_STATUSES.has(candidate as JobStatus) || VALID_WORKFLOW_STATUSES.has(candidate as CanonicalMediaWorkflowSnapshot["status"])
    ? candidate
    : null;
}

function normalizeSearch(value: string | string[] | undefined): string | null {
  const candidate = firstSearchValue(value);
  return candidate ? candidate.slice(0, 120) : null;
}

export function parseUserJobsWorkspaceQuery(
  searchParamsOrJobId?: RawJobsWorkspaceSearchParams | string | string[],
): UserJobsWorkspaceQuery {
  if (typeof searchParamsOrJobId === "string" || Array.isArray(searchParamsOrJobId)) {
    const jobId = normalizeJobId(searchParamsOrJobId);
    return {
      jobId,
      sourceId: jobId,
      status: null,
      bucket: null,
      sourceKind: null,
      q: null,
      page: 1,
      limit: WORK_INDEX_PAGE_LIMIT,
    };
  }

  const searchParams = searchParamsOrJobId ?? {};
  const jobId = normalizeJobId(searchParams.jobId);
  const sourceId = firstSearchValue(searchParams.sourceId);
  return {
    jobId,
    sourceId,
    status: normalizeStatus(searchParams.status),
    bucket: normalizeBucket(searchParams.bucket),
    sourceKind: normalizeSourceKind(searchParams.sourceKind),
    q: normalizeSearch(searchParams.q),
    page: normalizePage(searchParams.page),
    limit: normalizeLimit(searchParams.limit),
  };
}

function mergeSelectedJob(
  jobs: CanonicalJobSnapshot[],
  selectedJob: CanonicalJobSnapshot | null,
): CanonicalJobSnapshot[] {
  if (!selectedJob) {
    return jobs;
  }

  const index = jobs.findIndex((candidate) => candidate.jobId === selectedJob.jobId);
  if (index === -1) {
    return sortUserJobSnapshots([selectedJob, ...jobs]);
  }

  const next = [...jobs];
  next[index] = selectedJob;
  return sortUserJobSnapshots(next);
}

function getJobBucket(job: CanonicalJobSnapshot): JobsWorkIndexBucket {
  if (job.status === "queued" || job.status === "running") {
    return "running";
  }
  if (job.status === "failed" || job.status === "dead_letter") {
    return "needs_attention";
  }
  if (job.status === "succeeded") {
    return "completed";
  }
  return "history";
}

function getWorkflowBucket(workflow: CanonicalMediaWorkflowSnapshot): JobsWorkIndexBucket {
  if (workflow.status === "queued" || workflow.status === "running") {
    return "running";
  }
  if (workflow.status === "failed" || workflow.status === "blocked") {
    return "needs_attention";
  }
  if (workflow.status === "succeeded") {
    return "completed";
  }
  return "history";
}

function getWorkIndexBucketRank(bucket: JobsWorkIndexBucket): number {
  switch (bucket) {
    case "running":
      return 0;
    case "needs_attention":
      return 1;
    case "completed":
      return 2;
    case "history":
      return 3;
  }
}

function getWorkIndexStatusRank(item: WorkIndexItem): number {
  const status = item.value.status;

  if (status === "running") {
    return 0;
  }
  if (status === "queued") {
    return 1;
  }
  if (status === "failed" || status === "dead_letter" || status === "blocked") {
    return 2;
  }
  if (status === "succeeded") {
    return 3;
  }
  return 4;
}

function includesQuery(fields: Array<string | null | undefined>, query: string | null): boolean {
  if (!query) {
    return true;
  }

  const lowerQuery = query.toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(lowerQuery));
}

function jobMatchesQuery(job: CanonicalJobSnapshot, query: UserJobsWorkspaceQuery): boolean {
  if (query.sourceKind && query.sourceKind !== "job") {
    return false;
  }

  if (query.status && job.status !== query.status) {
    return false;
  }

  if (query.bucket && getJobBucket(job) !== query.bucket) {
    return false;
  }

  if (query.sourceId && job.jobId !== query.sourceId && job.jobId !== query.jobId) {
    return false;
  }

  return includesQuery([
    job.jobId,
    job.conversationId,
    job.toolName,
    job.label,
    job.title,
    job.subtitle,
    job.summary,
    job.status,
    job.progressLabel,
    job.error,
  ], query.q);
}

function workflowMatchesQuery(workflow: CanonicalMediaWorkflowSnapshot, query: UserJobsWorkspaceQuery): boolean {
  if (query.sourceKind && query.sourceKind !== "media_workflow") {
    return false;
  }

  if (query.status && workflow.status !== query.status) {
    return false;
  }

  if (query.bucket && getWorkflowBucket(workflow) !== query.bucket) {
    return false;
  }

  if (query.sourceId && workflow.workflowId !== query.sourceId) {
    return false;
  }

  return includesQuery([
    workflow.workflowId,
    workflow.conversationId,
    workflow.title,
    workflow.requestedDeliverable,
    workflow.status,
    workflow.stage.label,
    workflow.failure.message,
    workflow.finalArtifact?.assetId,
    ...workflow.linkedJobIds,
    ...workflow.linkedJobs.flatMap((job) => [job.jobId, job.title, job.label, job.toolName]),
  ], query.q);
}

function updatedAtMs(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

type WorkIndexItem =
  | {
      kind: "media_workflow";
      updatedAt: string | null;
      value: CanonicalMediaWorkflowSnapshot;
    }
  | {
      kind: "job";
      updatedAt: string | null;
      value: CanonicalJobSnapshot;
    };

function compareWorkIndexItems(left: WorkIndexItem, right: WorkIndexItem): number {
  const leftBucket = left.kind === "job" ? getJobBucket(left.value) : getWorkflowBucket(left.value);
  const rightBucket = right.kind === "job" ? getJobBucket(right.value) : getWorkflowBucket(right.value);
  const bucketDelta = getWorkIndexBucketRank(leftBucket) - getWorkIndexBucketRank(rightBucket);

  if (bucketDelta !== 0) {
    return bucketDelta;
  }

  const statusDelta = getWorkIndexStatusRank(left) - getWorkIndexStatusRank(right);

  if (statusDelta !== 0) {
    return statusDelta;
  }

  return updatedAtMs(right.updatedAt) - updatedAtMs(left.updatedAt);
}

function paginateWorkIndex<T extends { updatedAt?: string | null }>(
  items: T[],
  query: UserJobsWorkspaceQuery,
): { items: T[]; pageInfo: UserJobsWorkspacePageInfo } {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * query.limit;
  return {
    items: items.slice(start, start + query.limit),
    pageInfo: {
      page,
      limit: query.limit,
      total,
      hasNextPage: page < pageCount,
      hasPreviousPage: page > 1,
    },
  };
}

export async function loadUserJobsWorkspace(
  userId: string,
  searchParamsOrJobId?: RawJobsWorkspaceSearchParams | string | string[],
): Promise<UserJobsWorkspaceData> {
  const jobStatusQuery = getJobStatusQuery();
  const repository = getJobQueueRepository();
  const workflowReadModel = getMediaWorkflowReadModel();
  const query = parseUserJobsWorkspaceQuery(searchParamsOrJobId);
  const requestedJobId = query.jobId ?? (query.sourceKind === "job" ? query.sourceId : null);

  const [listedJobs, requestedJob, workflows] = await Promise.all([
    jobStatusQuery.listUserJobSnapshots(userId, { limit: INITIAL_JOBS_LIMIT }),
    requestedJobId ? jobStatusQuery.getUserJobSnapshot(userId, requestedJobId) : Promise.resolve(null),
    workflowReadModel.listUserWorkflows(userId, { limit: INITIAL_JOBS_LIMIT }),
  ]);

  const mergedJobs = mergeSelectedJob(sortUserJobSnapshots(listedJobs), requestedJob);
  const filteredJobs = sortUserJobSnapshots(mergedJobs.filter((job) => jobMatchesQuery(job, query)));
  const filteredWorkflows = workflows
    .filter((workflow) => workflowMatchesQuery(workflow, query))
    .sort((left, right) => updatedAtMs(right.updatedAt) - updatedAtMs(left.updatedAt));

  const combined = [
    ...filteredWorkflows.map((workflow) => ({ kind: "media_workflow" as const, updatedAt: workflow.updatedAt, value: workflow })),
    ...filteredJobs.map((job) => ({ kind: "job" as const, updatedAt: job.updatedAt, value: job })),
  ].sort(compareWorkIndexItems);

  const { items: pageItems, pageInfo } = paginateWorkIndex(combined, query);
  const jobs = sortUserJobSnapshots(pageItems.filter((item) => item.kind === "job").map((item) => item.value as CanonicalJobSnapshot));
  const selectedJobCandidate = requestedJob ?? jobs[0] ?? filteredJobs[0] ?? null;
  const pagedJobIds = new Set(jobs.map((job) => job.jobId));
  const jobsWithSelected = selectedJobCandidate && !pagedJobIds.has(selectedJobCandidate.jobId)
    ? mergeSelectedJob(jobs, selectedJobCandidate)
    : jobs;
  const pagedWorkflowIds = new Set(pageItems.filter((item) => item.kind === "media_workflow").map((item) => item.value.workflowId));
  const workflowsPage = filteredWorkflows.filter((workflow) => pagedWorkflowIds.has(workflow.workflowId));
  const selectedJob = selectedJobCandidate;

  if (!selectedJob) {
    return {
      jobs: jobsWithSelected,
      workflows: workflowsPage,
      selectedJobId: null,
      selectedJob: null,
      selectedJobHistory: [],
      query,
      pageInfo,
    };
  }

  const selectedJobRecord = await repository.findJobById(selectedJob.jobId);
  if (!selectedJobRecord) {
    return {
      jobs: jobsWithSelected,
      workflows: workflowsPage,
      selectedJobId: selectedJob.jobId,
      selectedJob,
      selectedJobHistory: [],
      query,
      pageInfo,
    };
  }

  const selectedJobEvents = await repository.listEventsForUserJob(userId, selectedJobRecord.id, {
    limit: JOB_HISTORY_LIMIT,
  });

  return {
    jobs: jobsWithSelected,
    workflows: workflowsPage,
    selectedJobId: selectedJob.jobId,
    selectedJob,
    selectedJobHistory: mapJobEventHistory(selectedJobRecord, selectedJobEvents),
    query,
    pageInfo,
  };
}
