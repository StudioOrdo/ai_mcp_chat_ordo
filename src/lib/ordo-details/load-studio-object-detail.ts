import {
  getAssetCatalogReader,
  getJobQueueRepository,
  getJobStatusQuery,
  getMediaWorkflowReadModel,
  getMediaWorkflowRepository,
} from "@/adapters/RepositoryFactory";
import { sessionHasRole, type SessionUser } from "@/lib/auth";
import { mapJobEventHistory } from "@/lib/jobs/job-event-history";
import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";
import {
  loadOwnerContentCampaign,
  loadOwnerContentItem,
} from "@/lib/content/content-campaign-read-model";

import {
  projectContentCampaignToOrdoDetail,
  projectContentItemToOrdoDetail,
  projectMediaAssetToOrdoDetail,
  projectWorkflowRunToOrdoDetail,
} from "./ordo-detail-projectors";
import type { OrdoObjectDetailModel } from "./ordo-detail-types";

const DETAIL_WORKFLOW_LOOKUP_LIMIT = 100;
const DETAIL_JOB_HISTORY_LIMIT = 50;

async function loadOwnerJob(
  userId: string,
  jobId: string | null,
): Promise<CanonicalJobSnapshot | null> {
  if (!jobId) {
    return null;
  }

  return getJobStatusQuery().getUserJobSnapshot(userId, jobId);
}

async function loadOwnerJobHistory(
  userId: string,
  jobId: string | null,
): Promise<JobHistoryEntry[]> {
  if (!jobId) {
    return [];
  }

  const repository = getJobQueueRepository();
  const job = await repository.findJobById(jobId);
  if (!job || job.userId !== userId) {
    return [];
  }

  const events = await repository.listEventsForUserJob(userId, job.id, {
    limit: DETAIL_JOB_HISTORY_LIMIT,
  });
  return mapJobEventHistory(job, events);
}

function workflowUsesAsset(
  workflow: CanonicalMediaWorkflowSnapshot,
  assetId: string,
): boolean {
  return workflow.finalArtifact?.assetId === assetId
    || workflow.steps.some((step) => step.assetId === assetId);
}

async function findWorkflowForAsset(
  userId: string,
  assetId: string,
): Promise<CanonicalMediaWorkflowSnapshot | null> {
  const workflows = await getMediaWorkflowReadModel().listUserWorkflows(userId, {
    limit: DETAIL_WORKFLOW_LOOKUP_LIMIT,
  });
  return workflows.find((workflow) => workflowUsesAsset(workflow, assetId)) ?? null;
}

export async function loadStudioMediaDetail(
  user: SessionUser,
  assetId: string,
): Promise<OrdoObjectDetailModel | null> {
  const entry = await getAssetCatalogReader().findByAssetId({
    assetId,
    userId: user.id,
  });
  if (!entry) {
    return null;
  }

  const [producingJob, jobHistory, workflow] = await Promise.all([
    loadOwnerJob(user.id, entry.producedByJobId),
    loadOwnerJobHistory(user.id, entry.producedByJobId),
    findWorkflowForAsset(user.id, entry.assetId),
  ]);

  return projectMediaAssetToOrdoDetail({
    entry,
    producingJob,
    jobHistory,
    workflow,
    canViewAdminDiagnostics: sessionHasRole(user, ["STAFF", "ADMIN"]),
  });
}

export async function loadStudioWorkflowDetail(
  user: SessionUser,
  workflowId: string,
): Promise<OrdoObjectDetailModel | null> {
  const snapshot = getMediaWorkflowRepository().findWorkflowById(workflowId);
  if (!snapshot || snapshot.workflow.userId !== user.id) {
    return null;
  }

  const workflow = await getMediaWorkflowReadModel().buildSnapshot(snapshot);
  return projectWorkflowRunToOrdoDetail(workflow, {
    canViewAdminDiagnostics: sessionHasRole(user, ["STAFF", "ADMIN"]),
  });
}

export async function loadStudioContentDetail(
  user: SessionUser,
  contentId: string,
): Promise<OrdoObjectDetailModel | null> {
  const item = await loadOwnerContentItem(user.id, contentId);
  return item ? projectContentItemToOrdoDetail(item) : null;
}

export async function loadStudioCampaignDetail(
  user: SessionUser,
  campaignId: string,
): Promise<OrdoObjectDetailModel | null> {
  const campaign = await loadOwnerContentCampaign(user.id, campaignId);
  return campaign ? projectContentCampaignToOrdoDetail(campaign) : null;
}
