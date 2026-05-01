import type { NextRequest } from "next/server";

import { getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import { NotFoundError } from "@/core/use-cases/ConversationInteractor";
import type { BrowserDiagnosticsSnapshot } from "@/frameworks/ui/diagnostics/browser-diagnostics-recorder";
import { getSessionUser } from "@/lib/auth";
import { createConversationRouteServices } from "@/lib/chat/conversation-root";
import { errorJson, runRouteTemplate, successText } from "@/lib/chat/http-facade";
import { redactDiagnostics } from "@/lib/diagnostics/redaction";
import type { RuntimeAuditCategory } from "@/lib/observability/runtime-audit-log";
import { executeInspectRuntimeLogs } from "@/core/use-cases/tools/inspect-runtime-logs.tool";

interface DiagnosticBundleRequest {
  browserDiagnostics?: BrowserDiagnosticsSnapshot;
  includeRuntimeLogs?: boolean;
  includeConversationExport?: boolean;
  includeJobTimelines?: boolean;
}

type RouteParams = {
  params: Promise<{ conversationId: string }>;
};

const RUNTIME_LOG_CATEGORIES: RuntimeAuditCategory[] = [
  "deferred_job",
  "mcp_process",
  "native_process",
  "remote_service",
];

function isBrowserDiagnosticsSnapshot(value: unknown): value is BrowserDiagnosticsSnapshot {
  return typeof value === "object"
    && value !== null
    && typeof (value as { capturedAt?: unknown }).capturedAt === "string"
    && Array.isArray((value as { records?: unknown }).records)
    && typeof (value as { droppedCount?: unknown }).droppedCount === "number";
}

async function parseBody(request: NextRequest): Promise<DiagnosticBundleRequest> {
  const body = await request.json().catch(() => ({}));
  if (typeof body !== "object" || body === null) {
    return {};
  }

  const raw = body as Record<string, unknown>;
  return {
    browserDiagnostics: isBrowserDiagnosticsSnapshot(raw.browserDiagnostics)
      ? raw.browserDiagnostics
      : undefined,
    includeRuntimeLogs: raw.includeRuntimeLogs !== false,
    includeConversationExport: raw.includeConversationExport !== false,
    includeJobTimelines: raw.includeJobTimelines !== false,
  };
}

async function readRuntimeLogs(includeRuntimeLogs: boolean) {
  if (!includeRuntimeLogs) {
    return {};
  }

  const entries = await Promise.all(
    RUNTIME_LOG_CATEGORIES.map(async (category) => {
      const result = await executeInspectRuntimeLogs({ log_file: category, limit: 50 });
      return [category, result.lines] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return runRouteTemplate({
    route: "/api/diagnostics/conversations/[conversationId]",
    request,
    validationMessages: [],
    execute: async (context) => {
      const user = await getSessionUser();
      if (user.roles.includes("ANONYMOUS")) {
        return errorJson(context, "Authentication required", 401);
      }

      const { conversationId } = await params;
      const body = await parseBody(request);
      const { interactor } = createConversationRouteServices();

      try {
        await interactor.get(conversationId, user.id);
      } catch (error) {
        if (error instanceof NotFoundError) {
          return errorJson(context, "Conversation not found", 404);
        }
        throw error;
      }

      const conversationExport = body.includeConversationExport
        ? await interactor.exportConversation(conversationId, user.id)
        : null;
      const interactions = body.includeJobTimelines
        ? await getPlatformInteractionFacade().listConversationJobInteractions(conversationId, { limit: 50 })
        : [];
      const runtimeLogs = await readRuntimeLogs(body.includeRuntimeLogs ?? true);

      const bundle = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        conversationId,
        requestId: context.requestId,
        app: {
          route: request.headers.get("referer"),
          userAgent: request.headers.get("user-agent"),
        },
        conversationExport,
        jobs: {
          snapshots: interactions.map((interaction) => interaction.snapshot),
          interactions,
          events: interactions.flatMap((interaction) => interaction.history),
        },
        runtimeLogs,
        browserDiagnostics: body.browserDiagnostics ?? null,
        redactions: {
          applied: true,
          fields: [] as string[],
        },
      };

      const redacted = redactDiagnostics(bundle);
      const payload = {
        ...(redacted.value as typeof bundle),
        redactions: {
          applied: true,
          fields: redacted.fields,
        },
      };
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      return successText(
        context,
        `${JSON.stringify(payload, null, 2)}\n`,
        {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="ordo-diagnostic-bundle-${conversationId}-${timestamp}.json"`,
          "Cache-Control": "no-store",
        },
      );
    },
  });
}
