import { revalidatePath } from "next/cache";

import { readRequiredText } from "@/lib/admin/shared/admin-form-parsers";
import { runAdminAction } from "@/lib/admin/shared/admin-action-helpers";
import { getJobQueueDataMapper } from "@/adapters/RepositoryFactory";
import type { JobRequest, JobStatus } from "@/core/entities/job";
import type { RoleName } from "@/core/entities/user";
import { getAdminJobsDetailPath } from "@/lib/admin/jobs/admin-jobs-routes";
import { canRolesManageGlobalJob } from "@/lib/jobs/job-capability-registry";
import { performManualJobReplay } from "@/lib/jobs/manual-replay";

// ── Single actions ─────────────────────────────────────────────────────

function ensureGlobalManagePermission(job: JobRequest, roles: readonly RoleName[]) {
  if (!canRolesManageGlobalJob(job.toolName, roles)) {
    throw new Error(`Job ${job.id} is not globally actionable for this role`);
  }
}

export async function cancelJobAction(formData: FormData) {
  "use server";

  return runAdminAction(formData, async (admin, formData) => {
    const id = readRequiredText(formData, "id");
    const mapper = getJobQueueDataMapper();
    const job = await mapper.findJobById(id);
    if (!job) throw new Error(`Job not found: ${id}`);

    ensureGlobalManagePermission(job, admin.roles);
    if (!CANCELABLE_STATUSES.has(job.status)) {
      throw new Error(`Job ${id} cannot be canceled from status: ${job.status}`);
    }

    const now = new Date().toISOString();
    await mapper.cancelJob(id, now);
    revalidatePath("/admin/jobs");
    revalidatePath(getAdminJobsDetailPath(id));
  });
}

export async function retryJobAction(formData: FormData) {
  "use server";

  return runAdminAction(formData, async (admin, formData) => {
    const id = readRequiredText(formData, "id");
    const mapper = getJobQueueDataMapper();
    const job = await mapper.findJobById(id);
    if (!job) throw new Error(`Job not found: ${id}`);

    ensureGlobalManagePermission(job, admin.roles);

    if (!RETRIABLE_STATUSES.has(job.status)) {
      throw new Error(`Job ${id} cannot be retried from status: ${job.status}`);
    }

    const replay = await performManualJobReplay(mapper, job, {
      requestedByUserId: admin.id,
    });
    revalidatePath("/admin/jobs");
    revalidatePath(getAdminJobsDetailPath(id));

    if (replay.job.id !== id) {
      revalidatePath(getAdminJobsDetailPath(replay.job.id));
    }
  });
}

export async function requeueJobAction(formData: FormData) {
  "use server";

  return runAdminAction(formData, async (admin, formData) => {
    const id = readRequiredText(formData, "id");
    const mapper = getJobQueueDataMapper();
    const job = await mapper.findJobById(id);
    if (!job) throw new Error(`Job not found: ${id}`);

    ensureGlobalManagePermission(job, admin.roles);

    if (!REQUEUEABLE_STATUSES.has(job.status)) {
      throw new Error(`Job ${id} cannot be requeued from status: ${job.status}`);
    }

    const requeuedJob = await mapper.updateJobStatus(id, {
      status: "queued",
      resultPayload: null,
      errorMessage: null,
      progressPercent: null,
      progressLabel: null,
      startedAt: null,
      completedAt: null,
      leaseExpiresAt: null,
      claimedBy: null,
      failureClass: null,
      nextRetryAt: null,
    });

    await mapper.appendEvent({
      jobId: job.id,
      conversationId: job.conversationId,
      eventType: "requeued",
      payload: {
        previousStatus: job.status,
        previousClaimedBy: job.claimedBy,
        requestedByUserId: admin.id,
        summary: `Admin requeued job from ${job.status} state.`,
      },
    });

    void requeuedJob;
    revalidatePath("/admin/jobs");
    revalidatePath(getAdminJobsDetailPath(id));
  });
}

// ── Bulk actions ───────────────────────────────────────────────────────

const CANCELABLE_STATUSES = new Set<JobStatus>(["queued", "running"]);
const REQUEUEABLE_STATUSES = new Set<JobStatus>(["queued", "running"]);
const RETRIABLE_STATUSES = new Set<JobStatus>(["failed", "canceled"]);

export async function bulkCancelJobsAction(formData: FormData) {
  "use server";

  return runAdminAction(formData, async (admin, formData) => {
    const idsRaw = readRequiredText(formData, "ids");
    const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const mapper = getJobQueueDataMapper();
    const now = new Date().toISOString();

    for (const id of ids) {
      const job = await mapper.findJobById(id);
      if (!job) {
        continue;
      }

      ensureGlobalManagePermission(job, admin.roles);

      if (CANCELABLE_STATUSES.has(job.status)) {
        await mapper.cancelJob(id, now);
      }
    }
    revalidatePath("/admin/jobs");
  });
}

export async function bulkRetryJobsAction(formData: FormData) {
  "use server";

  return runAdminAction(formData, async (admin, formData) => {
    const idsRaw = readRequiredText(formData, "ids");
    const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const mapper = getJobQueueDataMapper();

    for (const id of ids) {
      const job = await mapper.findJobById(id);
      if (!job) {
        continue;
      }

      ensureGlobalManagePermission(job, admin.roles);

      if (RETRIABLE_STATUSES.has(job.status)) {
        await performManualJobReplay(mapper, job, {
          requestedByUserId: admin.id,
        });
      }
    }
    revalidatePath("/admin/jobs");
  });
}

export async function bulkRequeueJobsAction(formData: FormData) {
  "use server";

  return runAdminAction(formData, async (admin, formData) => {
    const idsRaw = readRequiredText(formData, "ids");
    const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const mapper = getJobQueueDataMapper();

    for (const id of ids) {
      const job = await mapper.findJobById(id);
      if (!job) {
        continue;
      }

      ensureGlobalManagePermission(job, admin.roles);

      if (REQUEUEABLE_STATUSES.has(job.status)) {
        await mapper.updateJobStatus(id, {
          status: "queued",
          resultPayload: null,
          errorMessage: null,
          progressPercent: null,
          progressLabel: null,
          startedAt: null,
          completedAt: null,
          leaseExpiresAt: null,
          claimedBy: null,
          failureClass: null,
          nextRetryAt: null,
        });

        await mapper.appendEvent({
          jobId: job.id,
          conversationId: job.conversationId,
          eventType: "requeued",
          payload: {
            previousStatus: job.status,
            previousClaimedBy: job.claimedBy,
            requestedByUserId: admin.id,
            summary: `Admin requeued job from ${job.status} state.`,
          },
        });
      }
    }

    revalidatePath("/admin/jobs");
  });
}
