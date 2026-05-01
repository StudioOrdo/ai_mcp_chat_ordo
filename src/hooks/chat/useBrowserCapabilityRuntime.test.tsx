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
        expect.objectContaining({ candidates: [expect.objectContaining({ toolName: "compose_media" })] }),
      );
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("fails compose candidates without executing when the plan is invalid", async () => {
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
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: "REWRITE_TOOL_RESULT_AS_BROWSER_JOB",
        part: expect.objectContaining({
          status: "failed",
          failureCode: COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE,
        }),
      }));
    });

    expect(executeComposeMediaMock).not.toHaveBeenCalled();
  });

  it("ignores browser-runtime candidates discovered only in restored historical messages", async () => {
    const messages = [createMessage([
      { type: "tool_call", name: "compose_media", args: { plan: { id: "plan_restore" } } },
      {
        type: "tool_result",
        name: "compose_media",
        result: { plan: { id: "plan_restore" } },
      },
    ])];

    getBrowserRuntimeCandidatesMock.mockReturnValue([
      {
        jobId: "browser:msg_1:compose_media:1",
        messageId: "msg_1",
        toolName: "compose_media",
        args: { plan: { id: "plan_restore" } },
        payload: { plan: { id: "plan_restore" } },
        resultIndex: 1,
      },
    ]);

    const dispatch = vi.fn();

    renderHook(() => useBrowserCapabilityRuntime({
      conversationId: "conv_1",
      messages,
      dispatch,
      nonExecutableMessageIds: new Set(["msg_1"]),
    }));

    await waitFor(() => {
      expect(planBrowserCapabilityRuntimeCycleMock).toHaveBeenCalledWith(
        expect.objectContaining({ candidates: [] }),
      );
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("starts browser compose execution for current pending compose_media state", async () => {
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
      expect(executeComposeMediaMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: plan.id }),
        expect.objectContaining({ conversationId: "conv_1", toolInvocationId: "toolu_compose_1" }),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
    expect(waitForPlayableVideoAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "/api/user-files/uf_video_1" }),
    );
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: "REWRITE_TOOL_RESULT_AS_BROWSER_JOB",
      part: expect.objectContaining({ status: "succeeded" }),
    }));
  });

  it("canonicalizes browser compose plans with restored reusable media assets before execution", async () => {
    const plan = {
      id: "plan_restored_catalog_aliases",
      conversationId: "conv_1",
      profile: "still_image_narration_fast" as const,
      visualClips: [{ assetId: "Hero Image", kind: "image" as const, duration: 12 }],
      audioClips: [{ assetId: "Narration Track", kind: "audio" as const }],
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
      payload: { action: "compose_media", generationStatus: "client_fetch_pending" },
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
    waitForPlayableVideoAssetMock.mockResolvedValue(undefined);

    renderHook(() => useBrowserCapabilityRuntime({
      conversationId: "conv_1",
      messages: [createMessage([
        { type: "tool_call", name: "compose_media", args: { plan }, toolInvocationId: "toolu_compose_1" },
        { type: "tool_result", name: "compose_media", result: candidate.payload, toolInvocationId: "toolu_compose_1" },
      ])],
      dispatch: vi.fn(),
      reusableMediaAssets: [
        {
          assetId: "uf_image_1",
          assetKind: "image",
          label: "Hero Image",
          fileName: "hero-image.png",
          mimeType: "image/png",
          source: "generated",
          retentionClass: "conversation",
          createdAt: "2026-04-30T03:13:00.000Z",
          conversationId: "conv_1",
        },
        {
          assetId: "uf_audio_1",
          assetKind: "audio",
          label: "Narration Track",
          fileName: "narration-track.mp3",
          mimeType: "audio/mpeg",
          source: "generated",
          retentionClass: "conversation",
          createdAt: "2026-04-30T03:13:01.000Z",
          conversationId: "conv_1",
        },
      ],
    }));

    await waitFor(() => {
      expect(executeComposeMediaMock).toHaveBeenCalledWith(
        expect.objectContaining({
          visualClips: [expect.objectContaining({ assetId: "uf_image_1" })],
          audioClips: [expect.objectContaining({ assetId: "uf_audio_1" })],
        }),
        expect.any(Object),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
  });

  it("keeps persisted compose runtime ownership available to the browser planner", async () => {
    readPersistedBrowserRuntimeEntriesMock.mockReturnValue([
      {
        jobId: "browser:msg_old:compose_media:1",
        toolName: "compose_media",
        conversationId: "conv_1",
        status: "running",
        updatedAt: "2026-04-30T03:13:00.000Z",
      },
      {
        jobId: "browser:msg_newer:compose_media:1",
        toolName: "compose_media",
        conversationId: "conv_1",
        status: "running",
        updatedAt: "2026-04-30T03:13:00.000Z",
      },
    ]);
    getBrowserRuntimeCandidatesMock.mockReturnValue([]);

    renderHook(() => useBrowserCapabilityRuntime({
      conversationId: "conv_1",
      messages: [],
      dispatch: vi.fn(),
    }));

    await waitFor(() => {
      expect(planBrowserCapabilityRuntimeCycleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          persistedEntries: [
            expect.objectContaining({ jobId: "browser:msg_old:compose_media:1" }),
            expect.objectContaining({ jobId: "browser:msg_newer:compose_media:1" }),
          ],
        }),
      );
    });
    expect(removePersistedBrowserRuntimeEntryMock).not.toHaveBeenCalled();
  });
});
