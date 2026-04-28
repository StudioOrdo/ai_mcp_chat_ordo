import type { NextRequest } from "next/server";
import { getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import { errorJson, runRouteTemplate, successJson } from "@/lib/chat/http-facade";
import {
  DEFAULT_BATCH_LIMIT,
  ensureUserOwnsConversationJob,
  parsePositiveInteger,
  requireAuthenticatedUser,
} from "../../_lib";

type RouteParams = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  return runRouteTemplate({
    route: "/api/jobs/[jobId]/events",
    request,
    validationMessages: [],
    execute: async (context) => {
      const user = await requireAuthenticatedUser(context);
      if (user instanceof Response) {
        return user;
      }

      const { jobId } = await params;
      const limit = parsePositiveInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_BATCH_LIMIT);
      const result = await getPlatformInteractionFacade().getUserJobHistoryInteraction(user.id, jobId, { limit });
      const job = result?.job;

      if (!job) {
        return errorJson(context, "Job not found", 404);
      }

      const unauthorized = await ensureUserOwnsConversationJob(user.id, job.conversationId, context);
      if (unauthorized) {
        return unauthorized;
      }

      return successJson(context, {
        ok: true,
        jobId: job.id,
        events: result.history,
        timeline: result.timeline,
        revision: result.revision,
        interaction: result,
      });
    },
  });
}