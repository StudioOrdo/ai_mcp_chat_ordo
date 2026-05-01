import type { NextRequest } from "next/server";

import { getWorkspaceRestoreReader } from "@/adapters/RepositoryFactory";
import { errorJson, runRouteTemplate, successJson } from "@/lib/chat/http-facade";
import { resolveUserId } from "@/lib/chat/resolve-user";
import type { WorkspaceRestorePayload } from "@/core/platform/conversation-restore/WorkspaceRestore";

function isEmptyActiveWorkspace(payload: WorkspaceRestorePayload | null | undefined): boolean {
  if (!payload) {
    return true;
  }

  return (
    payload.workspace == null
    && payload.activeJobs.length === 0
    && payload.attentionNeededJobs.length === 0
    && payload.assets.length === 0
    && (payload.reusableMediaAssets?.length ?? 0) === 0
    && payload.workflow == null
    && payload.operatorTransition == null
    && payload.trustDistribution == null
    && payload.memory == null
    && payload.recentTranscript.length === 0
    && payload.migration == null
  );
}

export async function GET(request: NextRequest) {
  return runRouteTemplate({
    route: "/api/workspace/restore",
    request,
    validationMessages: [],
    execute: async (context) => {
      const { userId } = await resolveUserId();
      const conversationId = request.nextUrl.searchParams.get("conversationId");
      const reader = getWorkspaceRestoreReader();

      if (conversationId) {
        const payload = await reader.findByConversationId(userId, conversationId);
        if (!payload) {
          return errorJson(context, "Workspace not found", 404);
        }

        return successJson(context, {
          ok: true,
          ...payload,
        });
      }

      const payload = await reader.findActiveByUser(userId);
      if (isEmptyActiveWorkspace(payload)) {
        return new Response(null, { status: 204 });
      }

      return successJson(context, {
        ok: true,
        ...payload,
      });
    },
  });
}
