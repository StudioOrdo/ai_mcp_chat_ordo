import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getJobQueueRepository, getJobStatusQuery, getMaterializationRepository, getMediaWorkflowReadModel, getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import { NotFoundError } from "@/core/use-cases/ConversationInteractor";
import type { MaterializationRecord } from "@/core/entities/materialization";
import { createConversationRouteServices } from "@/lib/chat/conversation-root";
import { resolveUserId } from "@/lib/chat/resolve-user";
import { errorJson, runRouteTemplate, successJson } from "@/lib/chat/http-facade";
import { enqueueComposeMediaDeferredJob, InvalidComposeMediaDeferredJobError } from "@/lib/jobs/compose-media-deferred-job";
import { enqueueGenerateAudioDeferredJob, InvalidGenerateAudioDeferredJobError } from "@/lib/jobs/generate-audio-deferred-job";
import { buildCanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import { getActiveJobStatuses } from "@/lib/jobs/job-read-model";
import { isRegisteredJobCapability } from "@/lib/jobs/job-capability-registry";
import { logEvent } from "@/lib/observability/logger";
import { recordPromptBindingFromSource } from "@/lib/prompts/prompt-binding-service";

type SupportedMediaJobToolName = "compose_media" | "generate_audio";

function buildReuseAliasMaterializationId(conversationId: string, materializationKey: string): string {
  const suffix = createHash("sha1").update(materializationKey).digest("hex").slice(0, 12);
  return `mat_reuse_${conversationId}_${suffix}`;
}

async function ensureConversationReuseMaterialization(
  materialization: MaterializationRecord,
  conversationId: string,
  userId: string,
): Promise<MaterializationRecord> {
  if (materialization.conversationId === conversationId) {
    return materialization;
  }

  const repository = getMaterializationRepository();
  const now = new Date().toISOString();
  const aliasId = buildReuseAliasMaterializationId(conversationId, materialization.materializationKey);
  const existing = await repository.findById(aliasId);

  return repository.upsert({
    ...materialization,
    id: aliasId,
    userId,
    conversationId,
    evidenceRefs: [
      ...materialization.evidenceRefs,
      {
        source: {
          sourceKind: "materialization_record",
          sourceId: materialization.id,
          userId,
          conversationId: materialization.conversationId,
        },
        observedAt: now,
        summary: `Attached exact reuse of ${materialization.toolName} output to conversation ${conversationId}.`,
      },
    ],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

function summarizeComposePlan(plan: unknown): Record<string, unknown> | null {
  if (typeof plan !== "object" || plan === null) {
    return null;
  }

  const raw = plan as {
    id?: unknown;
    conversationId?: unknown;
    visualClips?: unknown;
    audioClips?: unknown;
    profile?: unknown;
    outputFormat?: unknown;
  };

  const summarizeClip = (clip: unknown) => {
    if (typeof clip !== "object" || clip === null) {
      return { invalid: true };
    }

    const value = clip as { assetId?: unknown; kind?: unknown; sourceAssetId?: unknown };
    return {
      assetId: typeof value.assetId === "string" ? value.assetId : null,
      kind: typeof value.kind === "string" ? value.kind : null,
      sourceAssetId: typeof value.sourceAssetId === "string" ? value.sourceAssetId : null,
    };
  };

  return {
    id: typeof raw.id === "string" ? raw.id : null,
    conversationId: typeof raw.conversationId === "string" ? raw.conversationId : null,
    profile: typeof raw.profile === "string" ? raw.profile : null,
    outputFormat: typeof raw.outputFormat === "string" ? raw.outputFormat : null,
    visualClips: Array.isArray(raw.visualClips) ? raw.visualClips.map(summarizeClip) : [],
    audioClips: Array.isArray(raw.audioClips) ? raw.audioClips.map(summarizeClip) : [],
  };
}

function summarizeAudioRequest(input: unknown): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const raw = input as { title?: unknown; text?: unknown; assetId?: unknown };
  return {
    title: typeof raw.title === "string" ? raw.title : null,
    textLength: typeof raw.text === "string" ? raw.text.length : null,
    hasAssetId: typeof raw.assetId === "string" && raw.assetId.trim().length > 0,
  };
}

type MediaJobEnqueueOptions = {
  raw: Record<string, unknown>;
  conversationId: string;
  userId: string;
  promptBindingId: string | null;
};

const MEDIA_JOB_ENQUEUE_STRATEGIES = {
  compose_media: {
    summarize: (raw: Record<string, unknown>) => ({ plan: summarizeComposePlan(raw["plan"]) }),
    enqueue: (options: MediaJobEnqueueOptions) => enqueueComposeMediaDeferredJob({
      repository: getJobQueueRepository(),
      materializationRepository: getMaterializationRepository(),
      conversationId: options.conversationId,
      userId: options.userId,
      plan: options.raw["plan"],
      promptBindingId: options.promptBindingId,
      initiatorType: "user",
      priority: 5,
    }),
  },
  generate_audio: {
    summarize: (raw: Record<string, unknown>) => ({ audio: summarizeAudioRequest(raw["input"] ?? raw) }),
    enqueue: (options: MediaJobEnqueueOptions) => enqueueGenerateAudioDeferredJob({
      repository: getJobQueueRepository(),
      materializationRepository: getMaterializationRepository(),
      conversationId: options.conversationId,
      userId: options.userId,
      input: options.raw["input"] ?? options.raw,
      promptBindingId: options.promptBindingId,
      initiatorType: "user",
      priority: 5,
    }),
  },
} satisfies Record<SupportedMediaJobToolName, {
  summarize: (raw: Record<string, unknown>) => Record<string, unknown>;
  enqueue: (options: MediaJobEnqueueOptions) => ReturnType<typeof enqueueComposeMediaDeferredJob> | ReturnType<typeof enqueueGenerateAudioDeferredJob>;
}>;

function isSupportedMediaJobToolName(value: unknown): value is SupportedMediaJobToolName {
  return typeof value === "string" && value in MEDIA_JOB_ENQUEUE_STRATEGIES;
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function resolveConversationId(request: NextRequest, userId: string): Promise<string | null> {
  const requestedConversationId = request.nextUrl.searchParams.get("conversationId");
  const { interactor } = createConversationRouteServices();

  if (requestedConversationId) {
    try {
      await interactor.get(requestedConversationId, userId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return requestedConversationId;
      }
      throw error;
    }
    return requestedConversationId;
  }

  const active = await interactor.getActiveForUser(userId);
  return active?.conversation.id ?? null;
}

export async function GET(request: NextRequest) {
  return runRouteTemplate({
    route: "/api/chat/jobs",
    request,
    validationMessages: [],
    execute: async (context) => {
      const { userId } = await resolveUserId();
      const requestedConversationId = request.nextUrl.searchParams.get("conversationId");
      const conversationId = await resolveConversationId(request, userId);
      const resolvedConversationId = conversationId ?? requestedConversationId;

      if (!resolvedConversationId) {
        return errorJson(
          context,
          "No active conversation",
          404,
        );
      }

      const activeOnly = request.nextUrl.searchParams.get("activeOnly") === "true";
      const limit = parsePositiveInteger(request.nextUrl.searchParams.get("limit"), 25);

      const interactions = await getPlatformInteractionFacade().listConversationJobInteractions(resolvedConversationId, {
        statuses: activeOnly ? getActiveJobStatuses() : undefined,
        limit,
      });
      const workflows = await getMediaWorkflowReadModel().listConversationWorkflows(resolvedConversationId);

      return successJson(context, {
        ok: true,
        conversationId: resolvedConversationId,
        jobs: interactions.map((result) => result.snapshot),
        workflows,
      });
    },
  });
}

/**
 * POST /api/chat/jobs
 *
 * Enqueues a canonical deferred media job.
 *
 * Body:
 * - { toolName: "compose_media", conversationId: string, plan: unknown }
 * - { toolName: "generate_audio", conversationId: string, input: { title: string, text: string } }
 */
export async function POST(request: NextRequest) {
  return runRouteTemplate({
    route: "POST /api/chat/jobs",
    request,
    execute: async (context) => {
      const { userId } = await resolveUserId();

      let body: unknown;
      try {
        body = await request.json();
      } catch (error) {
        void error;
        return errorJson(context, "Request body must be valid JSON", 400);
      }

      if (typeof body !== "object" || body === null) {
        return errorJson(context, "Request body must be an object", 400);
      }

      const raw = body as Record<string, unknown>;
      const toolName = raw["toolName"];

      if (!isSupportedMediaJobToolName(toolName)) {
        return errorJson(context, `Unsupported tool for media enqueue: ${String(toolName)}`, 400);
      }

      const strategy = MEDIA_JOB_ENQUEUE_STRATEGIES[toolName];

      if (!isRegisteredJobCapability(toolName)) {
        return errorJson(context, `Tool is not a registered job capability: ${toolName}`, 400);
      }

      const conversationId = typeof raw["conversationId"] === "string"
        ? raw["conversationId"].trim()
        : null;
      const promptBindingId = typeof raw["promptBindingId"] === "string"
        ? raw["promptBindingId"].trim()
        : null;

      if (!conversationId) {
        return errorJson(context, "conversationId is required", 400);
      }

      // Authorize: conversation must belong to the requesting user
      const { interactor } = createConversationRouteServices();
      try {
        await interactor.get(conversationId, userId);
      } catch (err) {
        if (err instanceof NotFoundError) {
          return errorJson(context, "Conversation not found or access denied", 404);
        }
        throw err;
      }

      try {
        logEvent("info", "MEDIA_DEFERRED_ENQUEUE_REQUESTED", {
          conversationId,
          userId,
          toolName,
          ...strategy.summarize(raw),
        });

        const result = await strategy.enqueue({
          raw,
          conversationId,
          userId,
          promptBindingId,
        });

        if (result.outcome === "exact_reuse") {
          const reusableMaterialization = result.materialization
            ? await ensureConversationReuseMaterialization(result.materialization, conversationId, userId)
            : null;
          if (promptBindingId && reusableMaterialization) {
            await recordPromptBindingFromSource({
              userId,
              conversationId,
              sourcePromptBindingId: promptBindingId,
              surface: "materialization_decision",
              target: {
                targetKind: "materialization_record",
                targetId: reusableMaterialization.id,
              },
              decisionSourceRefs: [
                {
                  sourceKind: "materialization_record",
                  sourceId: reusableMaterialization.id,
                  userId,
                  conversationId: reusableMaterialization.conversationId,
                },
              ],
              evidenceRefs: [...reusableMaterialization.evidenceRefs],
              createdAt: reusableMaterialization.updatedAt,
            });
          }
          const reusedSnapshot = reusableMaterialization?.producedByJobId
            ? await getJobStatusQuery().getJobSnapshot(reusableMaterialization.producedByJobId)
            : null;

          return successJson(
            context,
            {
              ok: true,
              exactReuse: true,
              deduplicated: false,
              materialization: reusableMaterialization,
              jobId: reusedSnapshot?.jobId ?? reusableMaterialization?.producedByJobId ?? null,
              job: reusedSnapshot,
            },
            { status: 200 },
          );
        }

        return successJson(
          context,
          {
            ok: true,
            jobId: result.job?.id ?? null,
            deduplicated: result.deduplicated,
            exactReuse: false,
            job: result.job && result.event ? buildCanonicalJobSnapshot(result.job, result.event) : null,
          },
          { status: result.deduplicated ? 200 : 201 },
        );
      } catch (error) {
        if (
          error instanceof InvalidComposeMediaDeferredJobError
          || error instanceof InvalidGenerateAudioDeferredJobError
        ) {
          return errorJson(context, error.message, 400);
        }

        throw error;
      }
    },
  });
}
