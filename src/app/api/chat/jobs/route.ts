import type { NextRequest } from "next/server";
import { getMediaWorkflowReadModel, getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import { NotFoundError } from "@/core/use-cases/ConversationInteractor";
import { createConversationRouteServices } from "@/lib/chat/conversation-root";
import { resolveUserId } from "@/lib/chat/resolve-user";
import { errorJson, runRouteTemplate, successJson } from "@/lib/chat/http-facade";
import { getActiveJobStatuses } from "@/lib/jobs/job-read-model";
import {
  launchMediaWorkflowOperation,
  type MediaWorkflowOperationToolName,
  summarizeMediaWorkflowOperationRequest,
} from "@/lib/media/workflows/media-workflow-operation-launcher";
import { logEvent } from "@/lib/observability/logger";

function isSupportedMediaJobToolName(value: unknown): value is MediaWorkflowOperationToolName {
  return value === "compose_media" || value === "generate_audio";
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

      const conversationId = typeof raw["conversationId"] === "string"
        ? raw["conversationId"].trim()
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
          ...summarizeMediaWorkflowOperationRequest(toolName, raw),
          mutationPath: "operation_kernel",
        });

        const result = await launchMediaWorkflowOperation({
          toolName,
          conversationId,
          userId,
          role: "AUTHENTICATED",
          request: raw,
          sourceSurface: "/api/chat/jobs",
        });

        return successJson(
          context,
          {
            ok: true,
            operation: result.operation,
            snapshot: result.snapshot,
            availableActions: result.availableActions,
            workflow: result.workflow,
            jobId: result.jobId,
            job: result.job,
            exactReuse: result.exactReuse,
            deduplicated: result.deduplicated,
          },
          { status: 201 },
        );
      } catch (error) {
        if (error instanceof Error && /Invalid|required|requires/i.test(error.message)) {
          return errorJson(context, error.message, 400);
        }

        throw error;
      }
    },
  });
}
