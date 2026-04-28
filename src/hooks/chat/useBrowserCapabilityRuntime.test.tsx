// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import type { ChatMessage } from "@/core/entities/chat-message";
import { COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE } from "@/lib/media/compose-media-errors";

const {
  getBrowserRuntimeCandidatesMock,
  buildBrowserRuntimeJobStatusPartMock,
  planBrowserCapabilityRuntimeCycleMock,
  readPersistedBrowserRuntimeEntriesMock,
  removePersistedBrowserRuntimeEntryMock,
  upsertPersistedBrowserRuntimeEntryMock,
  executeComposeMediaMock,
  waitForPlayableVideoAssetMock,
  VideoPlaybackVerificationErrorMock,
} = vi.hoisted(() => ({
  getBrowserRuntimeCandidatesMock: vi.fn(),
  buildBrowserRuntimeJobStatusPartMock: vi.fn(),
  planBrowserCapabilityRuntimeCycleMock: vi.fn(),
  readPersistedBrowserRuntimeEntriesMock: vi.fn(),
  removePersistedBrowserRuntimeEntryMock: vi.fn(),
  upsertPersistedBrowserRuntimeEntryMock: vi.fn(),
  executeComposeMediaMock: vi.fn(),
  waitForPlayableVideoAssetMock: vi.fn(),
  VideoPlaybackVerificationErrorMock: class VideoPlaybackVerificationError extends Error {
    constructor(
      public readonly code: "playback_readiness_timeout" | "playback_verification_failed",
      message: string,
    ) {
      super(message);
      this.name = "VideoPlaybackVerificationError";
    }
  },
}));

vi.mock("@/lib/media/browser-runtime/job-snapshots", () => ({
  getBrowserRuntimeCandidates: getBrowserRuntimeCandidatesMock,
  buildBrowserRuntimeJobStatusPart: buildBrowserRuntimeJobStatusPartMock,
  withResolvedAudioAsset: (payload: unknown) => payload,
}));

vi.mock("@/lib/media/browser-runtime/browser-capability-runtime", () => ({
  planBrowserCapabilityRuntimeCycle: planBrowserCapabilityRuntimeCycleMock,
}));

vi.mock("@/lib/media/browser-runtime/browser-runtime-state", () => ({
  readPersistedBrowserRuntimeEntries: readPersistedBrowserRuntimeEntriesMock,
  removePersistedBrowserRuntimeEntry: removePersistedBrowserRuntimeEntryMock,
  upsertPersistedBrowserRuntimeEntry: upsertPersistedBrowserRuntimeEntryMock,
}));

vi.mock("@/lib/media/browser-runtime/ffmpeg-browser-executor", () => ({
  FfmpegBrowserExecutor: class MockFfmpegBrowserExecutor {
    execute = executeComposeMediaMock;
  },
}));

vi.mock("@/lib/media/browser-runtime/video-asset-readiness", () => ({
  waitForPlayableVideoAsset: waitForPlayableVideoAssetMock,
  VideoPlaybackVerificationError: VideoPlaybackVerificationErrorMock,
}));

import { useBrowserCapabilityRuntime } from "./useBrowserCapabilityRuntime";

function createMessage(parts: NonNullable<ChatMessage["parts"]>): ChatMessage {
  return {
    id: "msg_1",
    role: "assistant",
    content: "",
    timestamp: new Date("2026-04-27T02:00:00.000Z"),
    parts,
  };
}

describe("useBrowserCapabilityRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (init?.method === "HEAD" && url.includes("/api/user-files/")) {
        const isAudio = url.includes("audio");
        return new Response(null, {
          status: 200,
          headers: {
            "Content-Type": isAudio ? "audio/mpeg" : "image/png",
            "X-Asset-Kind": isAudio ? "audio" : "image",
            "X-Conversation-Id": "conv_1",
          },
        });
      }

      return new Response(null, { status: 404 });
    }));
    readPersistedBrowserRuntimeEntriesMock.mockReturnValue([]);
    planBrowserCapabilityRuntimeCycleMock.mockReturnValue({
      reconcile: [],
      queue: [],
      start: [],
      overflow: [],
      cleanupJobIds: [],
    });
    buildBrowserRuntimeJobStatusPartMock.mockImplementation((options: {
      candidate: { jobId: string; toolName: string };
      status: string;
      sequence: number;
      failureCode?: string | null;
      failureStage?: string | null;
    }) => ({
      type: "job_status",
      jobId: options.candidate.jobId,
      toolName: options.candidate.toolName,
      label: "Compose Media",
      status: options.status,
      sequence: options.sequence,
      failureCode: options.failureCode ?? null,
      failureStage: options.failureStage ?? null,
      lifecyclePhase: options.status === "failed" ? "compose_failed_terminal" : "compose_succeeded",
      updatedAt: "2026-04-27T02:00:00.000Z",
    }));
  });

  it("skips compose candidates when tool_result payload is already a terminal inline error string", async () => {
    const messages = [createMessage([
      { type: "tool_call", name: "compose_media", args: { plan: { id: "plan_1" } } },
      {
        type: "tool_result",
        name: "compose_media",
        result: "Visual clips must be image or video assets.",
      },
    ])];

    getBrowserRuntimeCandidatesMock.mockReturnValue([
      {
        jobId: "browser:msg_1:compose_media:1",
        messageId: "msg_1",
        toolName: "compose_media",
        args: { plan: { id: "plan_1" } },
        payload: "Visual clips must be image or video assets.",
        resultIndex: 1,
      },
    ]);

    const dispatch = vi.fn();

    renderHook(() => useBrowserCapabilityRuntime({
      conversationId: "conv_1",
      messages,
      dispatch,
    }));

    await waitFor(() => {
      expect(planBrowserCapabilityRuntimeCycleMock).toHaveBeenCalledWith(
        expect.objectContaining({ candidates: [] }),
      );
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("emits an invalid-plan terminal snapshot instead of crashing when compose candidate has no valid plan", async () => {
    const messages = [createMessage([
      { type: "tool_call", name: "compose_media", args: {} },
      {
        type: "tool_result",
        name: "compose_media",
        result: {},
      },
    ])];

    const candidate = {
      jobId: "browser:msg_1:compose_media:1",
      messageId: "msg_1",
      toolName: "compose_media",
      args: {},
      payload: {},
      resultIndex: 1,
    };

    getBrowserRuntimeCandidatesMock.mockReturnValue([candidate]);
    planBrowserCapabilityRuntimeCycleMock.mockReturnValue({
      reconcile: [],
      queue: [],
      start: [candidate],
      overflow: [],
      cleanupJobIds: [],
    });

    const dispatch = vi.fn();

    renderHook(() => useBrowserCapabilityRuntime({
      conversationId: "conv_1",
      messages,
      dispatch,
    }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "REWRITE_TOOL_RESULT_AS_BROWSER_JOB",
          messageId: "msg_1",
          resultIndex: 1,
          part: expect.objectContaining({
            status: "failed",
            failureCode: COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE,
            failureStage: "composition_preflight",
          }),
        }),
      );
    });
  });

  it("keeps a browser-composed video when playback verification times out after upload", async () => {
    const plan = {
      id: "plan_cheese_video_001",
      conversationId: "conv_1",
      profile: "still_image_narration_fast" as const,
      visualClips: [{ assetId: "asset_image_1", kind: "image" as const, duration: 27 }],
      audioClips: [{ assetId: "asset_audio_1", kind: "audio" as const }],
      subtitlePolicy: "none" as const,
      waveformPolicy: "none" as const,
      outputFormat: "mp4" as const,
      resolution: { width: 720, height: 1280 },
    };
    const candidate = {
      jobId: "browser:msg_1:compose_media:1",
      messageId: "msg_1",
      toolName: "compose_media",
      toolInvocationId: "toolu_compose_1",
      args: { plan },
      payload: { ...plan, generationStatus: "client_fetch_pending" },
      resultIndex: 1,
    };

    getBrowserRuntimeCandidatesMock.mockReturnValue([candidate]);
    planBrowserCapabilityRuntimeCycleMock.mockReturnValue({
      reconcile: [],
      queue: [],
      start: [candidate],
      overflow: [],
      cleanupJobIds: [],
    });
    executeComposeMediaMock.mockResolvedValue({
      status: "succeeded",
      envelope: {
        payload: {
          route: "browser_wasm",
          planId: plan.id,
          primaryAssetId: "uf_video_1",
          outputFormat: "mp4",
        },
        artifacts: [{ kind: "video", assetId: "uf_video_1", uri: "/api/user-files/uf_video_1" }],
      },
    });
    waitForPlayableVideoAssetMock.mockRejectedValue(
      new VideoPlaybackVerificationErrorMock(
        "playback_readiness_timeout",
        "Timed out waiting for video playback readiness.",
      ),
    );

    const dispatch = vi.fn();

    renderHook(() => useBrowserCapabilityRuntime({
      conversationId: "conv_1",
      messages: [createMessage([
        { type: "tool_call", name: "compose_media", args: { plan }, toolInvocationId: "toolu_compose_1" },
        { type: "tool_result", name: "compose_media", result: candidate.payload, toolInvocationId: "toolu_compose_1" },
      ])],
      dispatch,
    }));

    await waitFor(() => {
      expect(buildBrowserRuntimeJobStatusPartMock).toHaveBeenCalledWith(expect.objectContaining({
        status: "succeeded",
        sequence: 4,
        payload: expect.objectContaining({ primaryAssetId: "uf_video_1" }),
      }));
    });
    expect(buildBrowserRuntimeJobStatusPartMock).not.toHaveBeenCalledWith(expect.objectContaining({
      status: "failed",
      failureCode: "playback_readiness_timeout",
    }));
  });
});
