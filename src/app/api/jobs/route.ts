import type { NextRequest } from "next/server";
import { getMediaWorkflowReadModel, getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import { runRouteTemplate, successJson } from "@/lib/chat/http-facade";
import { getActiveJobStatuses } from "@/lib/jobs/job-read-model";
import { loadUserJobsWorkspace } from "@/lib/jobs/load-user-jobs-workspace";
import { DEFAULT_JOBS_LIMIT, parsePositiveInteger, requireAuthenticatedUser } from "./_lib";

const WORK_INDEX_QUERY_KEYS = new Set(["status", "bucket", "sourceKind", "q", "page", "jobId", "sourceId"]);

function hasWorkIndexQuery(searchParams: URLSearchParams): boolean {
  for (const key of WORK_INDEX_QUERY_KEYS) {
    if (searchParams.has(key)) {
      return true;
    }
  }

  return false;
}

function toRawSearchParams(searchParams: URLSearchParams): Record<string, string | string[] | undefined> {
  const raw: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of searchParams.entries()) {
    const existing = raw[key];
    if (!existing) {
      raw[key] = value;
    } else if (Array.isArray(existing)) {
      raw[key] = [...existing, value];
    } else {
      raw[key] = [existing, value];
    }
  }

  return raw;
}

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
      if (hasWorkIndexQuery(request.nextUrl.searchParams)) {
        const workspace = await loadUserJobsWorkspace(user.id, toRawSearchParams(request.nextUrl.searchParams));
        return successJson(context, {
          ok: true,
          ...workspace,
        });
      }

      const interactions = await getPlatformInteractionFacade().listUserJobInteractions(user.id, {
        statuses: activeOnly ? getActiveJobStatuses() : undefined,
        limit,
      });
      const workflows = await getMediaWorkflowReadModel().listUserWorkflows(user.id, { limit });

      return successJson(context, {
        ok: true,
        jobs: interactions.map((result) => result.snapshot),
        workflows,
        interactions,
      });
    },
  });
}
