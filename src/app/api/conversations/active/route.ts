import type { NextRequest } from "next/server";
import {
  runRouteTemplate,
  successJson,
} from "@/lib/chat/http-facade";
import { createConversationRouteServices } from "@/lib/chat/conversation-root";
import { resolveUserId } from "@/lib/chat/resolve-user";

export async function GET(request: NextRequest) {
  return runRouteTemplate({
    route: "/api/conversations/active",
    request,
    validationMessages: [],
    execute: async (context) => {
      const { userId } = await resolveUserId();
      const { interactor } = createConversationRouteServices();
      const result = await interactor.getActiveForUser(userId);

      if (!result) {
        return new Response(null, { status: 204 });
      }

      return successJson(context, {
        conversation: result.conversation,
        messages: result.messages,
      });
    },
  });
}
