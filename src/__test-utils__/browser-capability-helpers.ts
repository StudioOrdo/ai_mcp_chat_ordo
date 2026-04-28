/**
 * Browser capability runtime test helpers.
 *
 * Provides fixture builders, fetch mock helpers, and assertion utilities
 * for `useBrowserCapabilityRuntime.test.tsx`.
 */
import { expect } from "vitest";
import type { ChatMessage } from "@/core/entities/chat-message";

// ---------------------------------------------------------------------------
// Message fixture builders
// ---------------------------------------------------------------------------

/** Build a `generate_audio` message with `client_fetch_pending` status. */
export function buildAudioPendingMessage(
  id: string,
  overrides?: {
    conversationId?: string;
    title?: string;
    text?: string;
    timestamp?: Date;
    provider?: string;
    estimatedDurationSeconds?: number;
    estimatedGenerationSeconds?: number;
  },
): ChatMessage {
  const title = overrides?.title ?? "Greeting";
  const text = overrides?.text ?? "Hello world";
  return {
    id,
    role: "assistant",
    content: "",
    timestamp: overrides?.timestamp ?? new Date("2026-04-11T12:05:00.000Z"),
    parts: [
      { type: "tool_call", name: "generate_audio", args: { text, title } },
      {
        type: "tool_result",
        name: "generate_audio",
        result: {
          action: "generate_audio",
          title,
          text,
          assetId: null,
          provider: overrides?.provider ?? "openai-speech",
          generationStatus: "client_fetch_pending",
          ...(overrides?.estimatedDurationSeconds != null
            ? { estimatedDurationSeconds: overrides.estimatedDurationSeconds }
            : {}),
          ...(overrides?.estimatedGenerationSeconds != null
            ? { estimatedGenerationSeconds: overrides.estimatedGenerationSeconds }
            : {}),
        },
      },
    ],
  };
}

/** Build a `generate_chart` or `generate_graph` result message. */
export function buildVisualizationResultMessage(
  toolName: "generate_chart" | "generate_graph",
  id: string,
  overrides?: {
    code?: string;
    timestamp?: Date;
    /** Extra fields merged into tool_result.result (e.g. assetId, mimeType, title). */
    resultOverrides?: Record<string, unknown>;
    /** For graph: override the default graph shape. */
    graphResult?: Record<string, unknown>;
  },
): ChatMessage {
  const code = overrides?.code ?? "flowchart TD\nA-->B";
  const baseResult =
    toolName === "generate_chart"
      ? { code, ...(overrides?.resultOverrides ?? {}) }
      : {
          graph: overrides?.graphResult ?? { kind: "table", data: [{ label: "A", value: 1 }], columns: ["label", "value"] },
          title: "Sample Graph",
          ...(overrides?.resultOverrides ?? {}),
        };
  const args =
    toolName === "generate_chart" ? { code } : { type: "bar" };

  return {
    id,
    role: "assistant",
    content: "",
    timestamp: overrides?.timestamp ?? new Date("2026-04-11T12:00:00.000Z"),
    parts: [
      { type: "tool_call", name: toolName, args },
      { type: "tool_result", name: toolName, result: baseResult },
    ],
  };
}

interface ComposeMediaPlanInput {
  id: string;
  conversationId: string;
  visualClips?: Array<{ assetId: string; kind: string }>;
  audioClips?: Array<{ assetId: string; kind: string }>;
  subtitlePolicy?: string;
  outputFormat?: string;
  resolution?: { width: number; height: number };
  mode?: string;
  overrides?: Record<string, unknown>;
}

/**
 * Build a `compose_media` message with `client_fetch_pending` status.
 * The plan is placed in both `tool_call.args.plan` and `tool_result.result`.
 */
export function buildComposeMediaMessage(
  messageId: string,
  plan: ComposeMediaPlanInput,
): ChatMessage {
  const planPayload = {
    id: plan.id,
    conversationId: plan.conversationId,
    visualClips: plan.visualClips ?? [{ assetId: "asset_visual_1", kind: "image" }],
    audioClips: plan.audioClips ?? [{ assetId: "asset_audio_1", kind: "audio" }],
    subtitlePolicy: plan.subtitlePolicy ?? "none",
    outputFormat: plan.outputFormat ?? "mp4",
    ...(plan.resolution ? { resolution: plan.resolution } : {}),
    ...(plan.mode ? { mode: plan.mode } : {}),
    ...(plan.overrides ? { overrides: plan.overrides } : {}),
  };

  return {
    id: messageId,
    role: "assistant",
    content: "",
    timestamp: new Date("2026-04-11T12:13:00.000Z"),
    parts: [
      { type: "tool_call", name: "compose_media", args: { plan: planPayload } },
      {
        type: "tool_result",
        name: "compose_media",
        result: {
          action: "compose_media",
          planId: plan.id,
          ...planPayload,
          generationStatus: "client_fetch_pending",
        },
      },
    ],
  };
}

/**
 * Build a compose_media message whose tool_result already contains a running
 * job snapshot (used for stale-reconciliation tests).
 */
export function buildComposeMediaStaleMessage(
  messageId: string,
  plan: ComposeMediaPlanInput,
  jobSnapshot?: {
    status?: string;
    sequence?: number;
  },
): ChatMessage {
  const jobId = `browser:${messageId}:compose_media:1`;
  const planPayload = {
    id: plan.id,
    conversationId: plan.conversationId,
    visualClips: plan.visualClips ?? [{ assetId: "asset_visual_1", kind: "video" }],
    audioClips: plan.audioClips ?? [],
    subtitlePolicy: plan.subtitlePolicy ?? "none",
    outputFormat: plan.outputFormat ?? "mp4",
  };

  return {
    id: messageId,
    role: "assistant",
    content: "",
    timestamp: new Date("2026-04-11T12:05:00.000Z"),
    parts: [
      { type: "tool_call", name: "compose_media", args: { plan: planPayload } },
      {
        type: "tool_result",
        name: "compose_media",
        result: {
          job: {
            messageId,
            part: {
              type: "job_status",
              jobId,
              toolName: "compose_media",
              label: "Compose Media",
              status: jobSnapshot?.status ?? "running",
              sequence: jobSnapshot?.sequence ?? 1,
              resultPayload: planPayload,
            },
          },
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Session storage helpers
// ---------------------------------------------------------------------------

/** Seed browser runtime session storage with a stale job entry. */
export function seedStaleBrowserRuntimeEntry(
  jobId: string,
  toolName: string,
  conversationId: string,
  overrides?: { status?: string; updatedAt?: string },
): void {
  window.sessionStorage.setItem(
    "studioordo.browser-runtime.v1",
    JSON.stringify([{
      jobId,
      toolName,
      conversationId,
      status: overrides?.status ?? "running",
      updatedAt: overrides?.updatedAt ?? "2026-04-15T10:00:00.000Z",
    }]),
  );
}

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

/** Build a mock JSON Response. */
export function mockJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Build a mock JSON Response with custom headers (e.g. Retry-After). */
export function mockJsonResponseWithHeaders(
  data: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Build a HEAD response for asset resolution. */
export function mockAssetHeadResponse(
  mime: string,
  kind: string,
  conversationId: string,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "X-Asset-Kind": kind,
      "X-Conversation-Id": conversationId,
      ...extraHeaders,
    },
  });
}

type FetchRoute = {
  url: string;
  method?: string;
  response: Response | (() => Response);
};

/**
 * Configure `fetchMock.mockImplementation` with declarative route matching.
 * Each route is matched by URL substring and optional HTTP method.
 * Unmatched requests throw an error.
 */
export function mockFetchRouter(
  fetchMock: ReturnType<typeof import("vitest").vi.fn>,
  routes: FetchRoute[],
): void {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    for (const route of routes) {
      if (url === route.url && (!route.method || route.method === method)) {
        return typeof route.response === "function" ? route.response() : route.response;
      }
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
}

// ---------------------------------------------------------------------------
// Compose media execution result builders
// ---------------------------------------------------------------------------

/** Build a successful compose_media execution result envelope. */
export function buildComposeMediaSuccessEnvelope(
  planId: string,
  assetId: string,
): {
  status: "succeeded";
  envelope: {
    schemaVersion: 1;
    toolName: "compose_media";
    family: "artifact";
    cardKind: "artifact_viewer";
    executionMode: "hybrid";
    inputSnapshot: { planId: string };
    summary: { title: string; statusLine: string };
    progress: { percent: number; label: string };
    replaySnapshot: { route: string; planId: string };
    artifacts: Array<{ kind: "video"; label: string; assetId: string; uri: string }>;
    payload: { route: string; planId: string; primaryAssetId: string; outputFormat: string };
  };
} {
  return {
    status: "succeeded" as const,
    envelope: {
      schemaVersion: 1,
      toolName: "compose_media",
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "hybrid",
      inputSnapshot: { planId },
      summary: { title: "Media Composition", statusLine: "succeeded" },
      progress: { percent: 100, label: "Composition complete" },
      replaySnapshot: { route: "browser_wasm", planId },
      artifacts: [
        { kind: "video", label: "Composed Video", assetId, uri: `/api/user-files/${assetId}` },
      ],
      payload: {
        route: "browser_wasm",
        planId,
        primaryAssetId: assetId,
        outputFormat: "mp4",
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that `dispatchMock` was called with a REWRITE_TOOL_RESULT_AS_BROWSER_JOB
 * action matching the given shape.
 */
export function expectBrowserJobDispatch(
  dispatchMock: ReturnType<typeof import("vitest").vi.fn>,
  messageId: string,
  resultIndex: number,
  partMatcher: Record<string, unknown>,
): void {
  expect(dispatchMock).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "REWRITE_TOOL_RESULT_AS_BROWSER_JOB",
      messageId,
      resultIndex,
      part: expect.objectContaining(partMatcher),
    }),
  );
}

/**
 * Assert the *last* dispatch call matches a REWRITE_TOOL_RESULT_AS_BROWSER_JOB action
 * using `toMatchObject` semantics (exact part match, not objectContaining).
 */
export function expectLastBrowserJobDispatch(
  dispatchMock: ReturnType<typeof import("vitest").vi.fn>,
  messageId: string,
  resultIndex: number,
  partMatcher: Record<string, unknown>,
): void {
  const lastAction = dispatchMock.mock.calls.at(-1)?.[0];
  expect(lastAction).toMatchObject({
    type: "REWRITE_TOOL_RESULT_AS_BROWSER_JOB",
    messageId,
    resultIndex,
    part: partMatcher,
  });
}
