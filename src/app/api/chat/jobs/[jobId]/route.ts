import type { NextRequest } from "next/server";
import { getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import { RevisionActionError } from "@/core/platform/facade/AgentPlatformFacade";
import { createConversationRouteServices } from "@/lib/chat/conversation-root";
import { resolveUserId } from "@/lib/chat/resolve-user";
import { errorJson, runRouteTemplate, successJson } from "@/lib/chat/http-facade";
import { getAgentPlatformFacade } from "@/lib/platform/agent-platform-facade-root";

type RouteParams = {
  params: Promise<{ jobId: string }>;
};

function parseAction(value: unknown): "cancel" | "retry" | null {
  return value === "cancel" || value === "retry" ? value : null;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  return runRouteTemplate({
    route: "/api/chat/jobs/[jobId]",
    request: _request,
    validationMessages: [],
    execute: async (context) => {
      const { jobId } = await params;
      const result = await getPlatformInteractionFacade().getJobInteraction(jobId);
      const snapshot = result?.snapshot;

      if (!snapshot) {
        return errorJson(context, "Job not found", 404);
      }

      if (!snapshot.conversationId) {
        return errorJson(context, "Job is missing conversation context", 500);
      }

      const { userId } = await resolveUserId();
      const { interactor } = createConversationRouteServices();
      await interactor.get(snapshot.conversationId, userId);

      return successJson(context, {
        ok: true,
        job: snapshot,
        timeline: result.timeline,
        revision: result.revision,
        interaction: result,
      });
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return runRouteTemplate({
    route: "/api/chat/jobs/[jobId]",
    request,
    validationMessages: ["Invalid job action."],
    execute: async (context) => {
      const { jobId } = await params;
      const body = await request.json().catch(() => ({}));
      const action = parseAction((body as { action?: unknown }).action);

      if (!action) {
        throw new Error("Invalid job action.");
      }

      const interaction = await getPlatformInteractionFacade().getJobInteraction(jobId);
      const job = interaction?.job;
      if (!job) {
        return errorJson(context, "Job not found", 404);
      }

      const { userId } = await resolveUserId();
      const { interactor } = createConversationRouteServices();
      await interactor.get(job.conversationId, userId);

      try {
        const result = await getAgentPlatformFacade().reviseExecution({
          executionKind: "job",
          executionId: jobId,
          action,
          role: "AUTHENTICATED",
          userId,
        });

        return successJson(context, {
          ok: true,
          action,
          ...(result.payload as Record<string, unknown> | undefined),
        });
      } catch (error) {
        if (error instanceof RevisionActionError) {
          return errorJson(context, error.message, error.status);
        }

        throw error;
      }
    },
  });
}