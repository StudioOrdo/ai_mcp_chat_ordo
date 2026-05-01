import {
  getCorpusRepository,
  getExecutionTimelineReader,
  getJobQueueRepository,
} from "@/adapters/RepositoryFactory";
import {
  AgentPlatformFacade,
  RevisionActionError,
  type AgentPlatformFacadeDeps,
  type RevisionActionRequest,
  type RevisionActionResult,
  type RevisionActionRuntime,
} from "@/core/platform/facade/AgentPlatformFacade";
import type { ProductBrief } from "@/core/entities/product-brief";
import { KnowledgeAccessService } from "@/core/platform/knowledge-access/KnowledgeAccessService";
import { getToolComposition } from "@/lib/chat/tool-composition-root";
import { createFactoryRevisionRoot } from "@/lib/factory/factory-revision-root";
import { canManualReplayJob, isJobCancelable, performManualJobReplay } from "@/lib/jobs/manual-replay";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildCanceledEventPayload(
  latestRenderablePayload: Record<string, unknown> | undefined,
  canceledBy: string,
): Record<string, unknown> {
  return {
    ...(typeof latestRenderablePayload?.progressPercent === "number"
      ? { progressPercent: latestRenderablePayload.progressPercent }
      : {}),
    ...(typeof latestRenderablePayload?.progressLabel === "string"
      || latestRenderablePayload?.progressLabel === null
      ? { progressLabel: latestRenderablePayload.progressLabel }
      : {}),
    ...(Array.isArray(latestRenderablePayload?.phases)
      ? { phases: latestRenderablePayload.phases }
      : {}),
    ...(typeof latestRenderablePayload?.activePhaseKey === "string"
      || latestRenderablePayload?.activePhaseKey === null
      ? { activePhaseKey: latestRenderablePayload.activePhaseKey }
      : {}),
    ...(typeof latestRenderablePayload?.summary === "string"
      ? { summary: latestRenderablePayload.summary }
      : {}),
    ...(latestRenderablePayload?.resultEnvelope === null || isRecord(latestRenderablePayload?.resultEnvelope)
      ? { resultEnvelope: latestRenderablePayload.resultEnvelope }
      : {}),
    ...(latestRenderablePayload?.replaySnapshot === null || isRecord(latestRenderablePayload?.replaySnapshot)
      ? { replaySnapshot: latestRenderablePayload.replaySnapshot }
      : {}),
    ...(Array.isArray(latestRenderablePayload?.artifacts)
      ? { artifacts: latestRenderablePayload.artifacts }
      : {}),
    canceledBy,
  };
}

class DefaultRevisionActionRuntime implements RevisionActionRuntime {
  async reviseExecution(request: RevisionActionRequest): Promise<RevisionActionResult> {
    if (request.executionKind === "job") {
      return this.reviseJob(request);
    }

    if (request.role !== "ADMIN") {
      throw new RevisionActionError("Factory revision controls are restricted to administrators.", 403);
    }

    return this.reviseWorkOrder(request);
  }

  private async reviseJob(request: RevisionActionRequest): Promise<RevisionActionResult> {
    const repository = getJobQueueRepository();
    const job = await repository.findJobById(request.executionId);

    if (!job) {
      throw new RevisionActionError("Job not found", 404);
    }

    const now = new Date().toISOString();

    if (request.action === "cancel") {
      if (!isJobCancelable(job.status)) {
        throw new RevisionActionError("Job cannot be canceled in its current state", 409);
      }

      const latestRenderableEvent = await repository.findLatestRenderableEventForJob(job.id);
      const canceledJob = await repository.cancelJob(job.id, now);
      const canceledEvent = await repository.appendEvent({
        jobId: job.id,
        conversationId: job.conversationId,
        eventType: "canceled",
        payload: buildCanceledEventPayload(latestRenderableEvent?.payload, request.userId),
      });

      return {
        accepted: true,
        status: "completed",
        message: "Job canceled.",
        timelineRef: job.id,
        payload: {
          job: canceledJob,
          eventSequence: canceledEvent.sequence,
        },
      };
    }

    if (request.action !== "retry") {
      throw new RevisionActionError("action must be one of cancel or retry.", 400);
    }

    if (!canManualReplayJob(job)) {
      throw new RevisionActionError("Job cannot be retried in its current state", 409);
    }

    const replay = await performManualJobReplay(repository, job, {
      ownerUserId: request.userId,
      requestedByUserId: request.userId,
    });

    return {
      accepted: true,
      status: replay.outcome === "queued" ? "queued" : "completed",
      message: replay.outcome === "queued" ? "Manual replay queued." : "Existing active replay reused.",
      nextExecutionId: replay.job.id,
      timelineRef: replay.job.id,
      payload: {
        deduped: replay.outcome === "deduped",
        replay: {
          outcome: replay.outcome,
          sourceJobId: replay.sourceJobId,
          targetJobId: replay.job.id,
          dedupeKey: replay.dedupeKey,
        },
        job: replay.job,
        ...(replay.eventSequence ? { eventSequence: replay.eventSequence } : {}),
      },
    };
  }

  private async reviseWorkOrder(request: RevisionActionRequest): Promise<RevisionActionResult> {
    const root = createFactoryRevisionRoot();
    const payload = request.payload ?? {};

    if (request.action === "pause") {
      const result = await root.revisionControl.pauseWorkOrder({
        workOrderId: request.executionId,
        requestedBy: request.userId,
        reason: parseOptionalString(payload.reason),
      });

      return {
        accepted: true,
        status: "completed",
        message: "Work order paused.",
        timelineRef: request.executionId,
        payload: { result },
      };
    }

    if (request.action === "refine") {
      const assetId = parseOptionalString(payload.assetId);
      const mode = parseOptionalString(payload.mode);
      if (!assetId || !mode) {
        throw new RevisionActionError("assetId and mode are required for refine.", 400);
      }

      const result = await root.revisionControl.refineAsset({
        workOrderId: request.executionId,
        assetId,
        mode: mode as "regenerate" | "replace_with_upload" | "metadata_fix",
        requestedBy: request.userId,
        ...(isRecord(payload.brief) ? { brief: payload.brief as unknown as ProductBrief } : {}),
        ...(isRecord(payload.parameterOverrides) ? { parameterOverrides: payload.parameterOverrides } : {}),
        ...(parseOptionalString(payload.requestedStageKey)
          ? { requestedStageKey: parseOptionalString(payload.requestedStageKey) }
          : {}),
        ...(parseOptionalString(payload.userFileId)
          ? { userFileId: parseOptionalString(payload.userFileId) }
          : {}),
      });

      return {
        accepted: true,
        status: "completed",
        message: "Work order refinement applied.",
        timelineRef: request.executionId,
        payload: { result },
      };
    }

    if (request.action !== "resume") {
      throw new RevisionActionError("action must be one of pause, refine, or resume.", 400);
    }

    if (!isRecord(payload.brief)) {
      throw new RevisionActionError("brief is required.", 400);
    }

    const result = await root.revisionControl.resumeWorkOrder({
      workOrderId: request.executionId,
      brief: payload.brief as unknown as ProductBrief,
      ...(parseOptionalString(payload.requestedStageKey)
        ? { requestedStageKey: parseOptionalString(payload.requestedStageKey) }
        : {}),
    });

    return {
      accepted: true,
      status: "completed",
      message: "Work order resumed.",
      timelineRef: request.executionId,
      payload: { result },
    };
  }
}

let facade: AgentPlatformFacade | null = null;

function createAgentPlatformFacadeDeps(): AgentPlatformFacadeDeps {
  return {
    knowledgeAccess: new KnowledgeAccessService(getCorpusRepository()),
    executionTimelineReader: getExecutionTimelineReader(),
    revisionRuntime: new DefaultRevisionActionRuntime(),
    executionSurfaceProvider: {
      getExecutionSurface: () => getToolComposition(),
    },
  };
}

export function getAgentPlatformFacade(): AgentPlatformFacade {
  if (!facade) {
    facade = new AgentPlatformFacade(createAgentPlatformFacadeDeps());
  }

  return facade;
}
