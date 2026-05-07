import type { NextRequest } from "next/server";
import { getActivityReadModel } from "@/adapters/RepositoryFactory";
import { parseActivityId } from "@/lib/activity/activity-types";
import { isActivityReceiptAction } from "@/lib/activity/activity-read-model";
import { errorJson, runRouteTemplate, successJson } from "@/lib/chat/http-facade";
import { requireAuthenticatedUser } from "@/app/api/jobs/_lib";

interface ReceiptRouteContext {
  params: Promise<{ activityId: string }>;
}

async function readAction(request: NextRequest): Promise<string | null> {
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  return typeof body?.action === "string" ? body.action : null;
}

export async function PATCH(request: NextRequest, { params }: ReceiptRouteContext) {
  return runRouteTemplate({
    route: "/api/activity/[activityId]/receipt",
    request,
    validationMessages: [],
    execute: async (context) => {
      const user = await requireAuthenticatedUser(context);
      if (user instanceof Response) {
        return user;
      }

      const { activityId: encodedActivityId } = await params;
      const activityId = decodeURIComponent(encodedActivityId);
      if (!parseActivityId(activityId)) {
        return errorJson(context, "Unknown activity source kind", 400);
      }

      const action = await readAction(request);
      if (!action || !isActivityReceiptAction(action)) {
        return errorJson(context, "Unknown activity receipt action", 400);
      }

      const activity = await getActivityReadModel().applyReceiptAction(user.id, activityId, action);
      if (!activity) {
        return errorJson(context, "Activity item not found", 404);
      }

      return successJson(context, {
        ok: true,
        activity,
      });
    },
  });
}
