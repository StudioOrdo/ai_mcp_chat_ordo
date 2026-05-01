import { getJobQueueRepository, getJobStatusQuery, getMediaWorkflowReadModel } from "@/adapters/RepositoryFactory";
import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import { mapJobEventHistory } from "@/lib/jobs/job-event-history";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import { sortUserJobSnapshots } from "@/lib/jobs/user-jobs-workspace";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";

const INITIAL_JOBS_LIMIT = 25;
const JOB_HISTORY_LIMIT = 50;

export interface UserJobsWorkspaceData {
  workflows?: CanonicalMediaWorkflowSnapshot[];
  jobs: CanonicalJobSnapshot[];
  selectedJobId: string | null;
  selectedJob: CanonicalJobSnapshot | null;
  selectedJobHistory: JobHistoryEntry[];
}

function normalizeJobId(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export async function loadUserJobsWorkspace(
  userId: string,
  requestedJobIdValue?: string | string[],
): Promise<UserJobsWorkspaceData> {
  const jobStatusQuery = getJobStatusQuery();
  const repository = getJobQueueRepository();
  const workflowReadModel = getMediaWorkflowReadModel();
  const requestedJobId = normalizeJobId(requestedJobIdValue);

  const [listedJobs, requestedJob, workflows] = await Promise.all([
    jobStatusQuery.listUserJobSnapshots(userId, { limit: INITIAL_JOBS_LIMIT }),
    requestedJobId ? jobStatusQuery.getUserJobSnapshot(userId, requestedJobId) : Promise.resolve(null),
    workflowReadModel.listUserWorkflows(userId, { limit: INITIAL_JOBS_LIMIT }),
  ]);

  const jobs = mergeSelectedJob(sortUserJobSnapshots(listedJobs), requestedJob);
  const selectedJob = requestedJob ?? jobs[0] ?? null;

  if (!selectedJob) {
    return {
      jobs,
      workflows,
      selectedJobId: null,
      selectedJob: null,
      selectedJobHistory: [],
    };
  }

  const selectedJobRecord = await repository.findJobById(selectedJob.jobId);
  if (!selectedJobRecord) {
    return {
      jobs,
      workflows,
      selectedJobId: selectedJob.jobId,
      selectedJob,
      selectedJobHistory: [],
    };
  }

  const selectedJobEvents = await repository.listEventsForUserJob(userId, selectedJobRecord.id, {
    limit: JOB_HISTORY_LIMIT,
  });

  return {
    jobs,
    workflows,
    selectedJobId: selectedJob.jobId,
    selectedJob,
    selectedJobHistory: mapJobEventHistory(selectedJobRecord, selectedJobEvents),
  };
}
