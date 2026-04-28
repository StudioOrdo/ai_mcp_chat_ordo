import type { NextRequest } from "next/server";
import { getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import { RevisionActionError } from "@/core/platform/facade/AgentPlatformFacade";
import { errorJson, runRouteTemplate, successJson } from "@/lib/chat/http-facade";
import { getAgentPlatformFacade } from "@/lib/platform/agent-platform-facade-root";
import { ensureUserOwnsConversationJob, requireAuthenticatedUser } from "../_lib";

type RouteParams = {
  params: Promise<{ jobId: string }>;
};

function parseAction(value: unknown): "cancel" | "retry" | null {
  return value === "cancel" || value === "retry" ? value : null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return runRouteTemplate({
    route: "/api/jobs/[jobId]",
    request,
    validationMessages: [],
    execute: async (context) => {
      const user = await requireAuthenticatedUser(context);
      if (user instanceof Response) {
        return user;
      }

      const { jobId } = await params;
      const result = await getPlatformInteractionFacade().getJobInteraction(jobId);
      const snapshot = result?.snapshot;

      if (!snapshot) {
        return errorJson(context, "Job not found", 404);
      }

      if (!snapshot.conversationId) {
        return errorJson(context, "Job is missing conversation context", 500);
      }

      const unauthorized = await ensureUserOwnsConversationJob(user.id, snapshot.conversationId, context);
      if (unauthorized) {
        return unauthorized;
      }

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
    route: "/api/jobs/[jobId]",
    request,
    validationMessages: ["Invalid job action."],
    execute: async (context) => {
      const user = await requireAuthenticatedUser(context);
      if (user instanceof Response) {
        return user;
      }

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

      const unauthorized = await ensureUserOwnsConversationJob(user.id, job.conversationId, context);
      if (unauthorized) {
        return unauthorized;
      }

      try {
        const result = await getAgentPlatformFacade().reviseExecution({
          executionKind: "job",
          executionId: jobId,
          action,
          role: user.roles[0],
          userId: user.id,
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