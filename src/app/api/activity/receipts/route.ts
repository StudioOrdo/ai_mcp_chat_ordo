import type { NextRequest } from "next/server";
import { getActivityReadModel } from "@/adapters/RepositoryFactory";
import { requireAuthenticatedUser } from "@/app/api/jobs/_lib";
import { errorJson, runRouteTemplate, successJson } from "@/lib/chat/http-facade";

async function readAction(request: NextRequest): Promise<string | null> {
  const body = await request.json().catch(() => null) as { action?: unknown; inbox?: unknown } | null;
  if (body?.inbox !== true) {
    return null;
  }

  return typeof body.action === "string" ? body.action : null;
}

export async function POST(request: NextRequest) {
  return runRouteTemplate({
    route: "/api/activity/receipts",
    request,
    validationMessages: [],
    execute: async (context) => {
      const user = await requireAuthenticatedUser(context);
      if (user instanceof Response) {
        return user;
      }

      const action = await readAction(request);
      if (action !== "mark_read") {
        return errorJson(context, "Only inbox mark_read is supported for bulk activity receipts", 400);
      }

      const result = await getActivityReadModel().applyReceiptActionToInbox(user.id, "mark_read");

      return successJson(context, {
        ok: true,
        updatedCount: result.updatedCount,
        activity: result.inbox.items,
        pageInfo: result.inbox.pageInfo,
        unreadCount: result.inbox.unreadCount,
      });
    },
  });
}
