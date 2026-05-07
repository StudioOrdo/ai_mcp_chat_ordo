import type { NextRequest } from "next/server";
import { getActivityReadModel } from "@/adapters/RepositoryFactory";
import { errorJson, runRouteTemplate, successJson } from "@/lib/chat/http-facade";
import { isActivitySourceKind, type ActivityBucket, type ActivitySourceKind } from "@/lib/activity/activity-taxonomy";
import { parsePositiveInteger, requireAuthenticatedUser } from "@/app/api/jobs/_lib";

const DEFAULT_ACTIVITY_LIMIT = 25;
const ACTIVITY_BUCKETS = new Set<ActivityBucket>([
  "needs_attention",
  "running",
  "completed",
  "history",
  "diagnostic",
]);

function parseBucket(value: string | null): ActivityBucket | undefined {
  if (!value) {
    return undefined;
  }

  return ACTIVITY_BUCKETS.has(value as ActivityBucket) ? value as ActivityBucket : undefined;
}

function parseSourceKind(value: string | null): ActivitySourceKind | undefined {
  if (!value) {
    return undefined;
  }

  return isActivitySourceKind(value) ? value : undefined;
}

export async function GET(request: NextRequest) {
  return runRouteTemplate({
    route: "/api/activity",
    request,
    validationMessages: [],
    execute: async (context) => {
      const user = await requireAuthenticatedUser(context);
      if (user instanceof Response) {
        return user;
      }

      const bucket = parseBucket(request.nextUrl.searchParams.get("bucket"));
      if (request.nextUrl.searchParams.has("bucket") && !bucket) {
        return errorJson(context, "Unknown activity bucket", 400);
      }

      const sourceKind = parseSourceKind(request.nextUrl.searchParams.get("sourceKind"));
      if (request.nextUrl.searchParams.has("sourceKind") && !sourceKind) {
        return errorJson(context, "Unknown activity source kind", 400);
      }

      const query = {
        bucket,
        sourceKind,
        sourceId: request.nextUrl.searchParams.get("sourceId") ?? undefined,
        status: request.nextUrl.searchParams.get("status") ?? undefined,
        q: request.nextUrl.searchParams.get("q") ?? undefined,
        limit: parsePositiveInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_ACTIVITY_LIMIT),
        page: parsePositiveInteger(request.nextUrl.searchParams.get("page"), 1),
        includeDismissed: request.nextUrl.searchParams.get("includeDismissed") === "true",
        unreadOnly: request.nextUrl.searchParams.get("unreadOnly") === "true",
      };
      const inbox = request.nextUrl.searchParams.get("inbox") === "true";
      const activityReadModel = getActivityReadModel();
      const result = inbox
        ? await activityReadModel.listUserInboxActivity(user.id, query)
        : await activityReadModel.listUserActivity(user.id, query);

      return successJson(context, {
        ok: true,
        inbox,
        activity: result.items,
        pageInfo: result.pageInfo,
        unreadCount: "unreadCount" in result ? result.unreadCount : undefined,
      });
    },
  });
}
