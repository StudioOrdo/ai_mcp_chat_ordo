import type { NextRequest } from "next/server";
import { getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import { runRouteTemplate, successJson } from "@/lib/chat/http-facade";
import { getActiveJobStatuses } from "@/lib/jobs/job-read-model";
import { DEFAULT_JOBS_LIMIT, parsePositiveInteger, requireAuthenticatedUser } from "./_lib";

export async function GET(request: NextRequest) {
  return runRouteTemplate({
    route: "/api/jobs",
    request,
    validationMessages: [],
    execute: async (context) => {
      const user = await requireAuthenticatedUser(context);
      if (user instanceof Response) {
        return user;
      }

      const activeOnly = request.nextUrl.searchParams.get("activeOnly") === "true";
      const limit = parsePositiveInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_JOBS_LIMIT);

      const interactions = await getPlatformInteractionFacade().listUserJobInteractions(user.id, {
        statuses: activeOnly ? getActiveJobStatuses() : undefined,
        limit,
      });

      return successJson(context, {
        ok: true,
        jobs: interactions.map((result) => result.snapshot),
        interactions,
      });
    },
  });
}