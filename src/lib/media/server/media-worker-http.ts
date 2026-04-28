import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { MediaCompositionPlanSchema } from "@/lib/media/ffmpeg/media-composition-plan";
import { executeComposeMediaRemotely } from "@/lib/media/server/compose-media-worker-runtime";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { ToolProgressUpdate } from "@/core/tool-registry/ToolExecutionContext";

export interface ComposeMediaWorkerRequest {
  plan: unknown;
  userId?: unknown;
  conversationId?: unknown;
  toolInvocationId?: unknown;
}

type ProgressEvent = {
  type: "progress";
  update: ToolProgressUpdate;
};

type ResultEvent = {
  type: "result";
  envelope: CapabilityResultEnvelope;
};

type ErrorEvent = {
  type: "error";
  error: string;
};

export type MediaWorkerStreamEvent = ProgressEvent | ResultEvent | ErrorEvent;

export interface MediaWorkerServerDeps {
  sharedSecret?: string;
  executeComposeMedia?: typeof executeComposeMediaRemotely;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function authorize(request: IncomingMessage, sharedSecret: string): boolean {
  if (!sharedSecret) {
    return true;
  }

  return request.headers.authorization === `Bearer ${sharedSecret}`;
}

function writeStreamEvent(response: ServerResponse, event: MediaWorkerStreamEvent): void {
  response.write(`${JSON.stringify(event)}\n`);
}

export function createMediaWorkerServer(deps: MediaWorkerServerDeps = {}): Server {
  const sharedSecret = deps.sharedSecret?.trim() ?? process.env.MEDIA_WORKER_SHARED_SECRET?.trim() ?? "";
  const executeComposeMedia = deps.executeComposeMedia ?? executeComposeMediaRemotely;

  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method !== "POST" || request.url !== "/compose-media") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    if (!authorize(request, sharedSecret)) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      const raw = await readJsonBody(request) as ComposeMediaWorkerRequest;
      const userId = typeof raw.userId === "string" && raw.userId.trim().length > 0 ? raw.userId.trim() : null;
      const conversationId = typeof raw.conversationId === "string" && raw.conversationId.trim().length > 0
        ? raw.conversationId.trim()
        : null;
      const toolInvocationId = typeof raw.toolInvocationId === "string" && raw.toolInvocationId.trim().length > 0
        ? raw.toolInvocationId.trim()
        : undefined;

      // Defensively overwrite any agent-hallucinated conversationId in the plan
      // with the authoritative one from the request root, preventing asset
      // readiness check failures caused by IDs like "conv_media_1".
      const rawPlan = raw.plan && typeof raw.plan === "object"
        ? { ...(raw.plan as Record<string, unknown>), ...(conversationId ? { conversationId } : {}) }
        : raw.plan;

      const plan = MediaCompositionPlanSchema.parse(rawPlan);


      if (!userId) {
        throw new Error("userId is required.");
      }

      response.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });

      const envelope = await executeComposeMedia({
        plan,
        userId,
        conversationId,
        toolInvocationId,
        onProgress: (update) => {
          writeStreamEvent(response, {
            type: "progress",
            update,
          });
        },
      });

      writeStreamEvent(response, {
        type: "result",
        envelope,
      });
      response.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Compose media worker failed.";

      if (response.headersSent) {
        writeStreamEvent(response, {
          type: "error",
          error: message,
        });
        response.end();
        return;
      }

      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: message }));
    }
  });
}