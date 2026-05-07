import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import type { ToolProgressUpdate } from "@/core/tool-registry/ToolExecutionContext";
import type { MediaWorkerStreamEvent } from "./media-worker-http";

export interface MediaWorkerClientConfig {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  sharedSecret?: string;
}

export interface MediaWorkerHealthResult {
  ok: boolean;
  statusCode: number | null;
  error: string | null;
}

export interface ExecuteComposeMediaJobRequest {
  plan: MediaCompositionPlan;
  userId: string;
  conversationId: string | null;
  toolInvocationId?: string;
  jobId?: string;
  materializationKey?: string;
}

async function parseNdjsonResponse(
  response: Response,
  onProgress?: (update: ToolProgressUpdate) => void | Promise<void>,
): Promise<CapabilityResultEnvelope> {
  if (!response.body) {
    throw new Error("Media worker stream ended before returning a result.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalEnvelope: CapabilityResultEnvelope | null = null;

  const processLine = async (line: string) => {
    if (!line.trim()) {
      return;
    }

    let event: MediaWorkerStreamEvent;
    try {
      event = JSON.parse(line) as MediaWorkerStreamEvent;
    } catch (error) {
      throw new Error(`Media worker returned malformed NDJSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (event.type === "progress") {
      await onProgress?.(event.update);
      return;
    }

    if (event.type === "error") {
      throw new Error(event.error);
    }

    finalEnvelope = event.envelope;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      await processLine(line);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    await processLine(buffer);
  }

  if (!finalEnvelope) {
    throw new Error("Media worker stream ended without a final result.");
  }

  return finalEnvelope;
}

function resolveBaseUrl(): string {
  const configured = process.env.MEDIA_WORKER_URL?.trim();
  return configured && configured.length > 0 ? configured : "http://127.0.0.1:3101";
}

export class MediaWorkerClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly sharedSecret?: string;

  constructor(config: MediaWorkerClientConfig = {}) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.baseUrl = config.baseUrl ?? resolveBaseUrl();
    this.sharedSecret = config.sharedSecret ?? process.env.MEDIA_WORKER_SHARED_SECRET;
  }

  async executeComposeMediaJob(
    request: ExecuteComposeMediaJobRequest,
    onProgress?: (update: ToolProgressUpdate) => void | Promise<void>,
  ): Promise<CapabilityResultEnvelope> {
    const response = await this.fetchImpl(`${this.baseUrl}/compose-media`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.sharedSecret ? { authorization: `Bearer ${this.sharedSecret}` } : {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Media worker request failed with ${response.status}: ${await response.text()}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-ndjson")) {
      return await parseNdjsonResponse(response, onProgress);
    }

    return await response.json() as CapabilityResultEnvelope;
  }

  async checkHealth(options: { timeoutMs?: number } = {}): Promise<MediaWorkerHealthResult> {
    const timeoutMs = options.timeoutMs ?? 750;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/health`, {
        method: "GET",
        headers: {
          ...(this.sharedSecret ? { authorization: `Bearer ${this.sharedSecret}` } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          statusCode: response.status,
          error: `Media worker health request failed with ${response.status}.`,
        };
      }

      const body = await response.json() as { ok?: unknown };
      const ok = body.ok === true;
      return {
        ok,
        statusCode: response.status,
        error: ok ? null : "Media worker health response did not report ok.",
      };
    } catch (error) {
      return {
        ok: false,
        statusCode: null,
        error: error instanceof Error ? error.message : "Media worker health request failed.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
