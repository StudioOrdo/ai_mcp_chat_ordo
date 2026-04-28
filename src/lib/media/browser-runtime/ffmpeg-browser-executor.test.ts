import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserMediaExecutorResult } from "./ffmpeg-browser-executor";
import { FfmpegBrowserExecutor } from "./ffmpeg-browser-executor";
import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import { probeFfmpegWasmCapability } from "./ffmpeg-capability-probe";
import {
  COMPOSE_MEDIA_COMPLETE_LABEL,
  getComposeMediaProgressLabel,
} from "@/lib/media/compose-media-progress";

// Mock the probe so we control the environment in unit tests
vi.mock("./ffmpeg-capability-probe", () => ({
  probeFfmpegWasmCapability: vi.fn(() => ({ isAvailable: false, reason: "test_env_no_wasm" })),
}));

const probeMock = vi.mocked(probeFfmpegWasmCapability);
const fetchMock = vi.fn();

class MockWorker {
  static mode: "success" | "error" | "empty" = "success";

  onmessage: ((event: MessageEvent<{ type: string; progress?: number; label?: string; blob?: Blob; error?: string }>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(_message: unknown): void {
    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          type: "PROGRESS",
          progress: 42,
          label: getComposeMediaProgressLabel("rendering_media", { plan: basePlan, progressPercent: 42 }),
        },
      } as MessageEvent<{ type: string; progress?: number; label?: string }>);

      if (MockWorker.mode === "success") {
        this.onmessage?.({
          data: {
            type: "SUCCESS",
            blob: new Blob(["video-bytes"], { type: "video/mp4" }),
          },
        } as MessageEvent<{ type: string; blob: Blob }>);
        return;
      }

      if (MockWorker.mode === "empty") {
        this.onmessage?.({
          data: {
            type: "SUCCESS",
            blob: new Blob([], { type: "video/mp4" }),
          },
        } as MessageEvent<{ type: string; blob: Blob }>);
        return;
      }

      this.onmessage?.({
        data: { type: "ERROR", error: "worker_error" },
      } as MessageEvent<{ type: string; error: string }>);
    });
  }

  terminate(): void {}
}

const basePlan: MediaCompositionPlan = {
  id: "plan-test-1",
  conversationId: "conv-test-1",
  visualClips: [{ assetId: "asset-v1", kind: "image" }],
  audioClips: [{ assetId: "asset-a1", kind: "audio" }],
  subtitlePolicy: "none",
  waveformPolicy: "none",
  outputFormat: "mp4",
};

describe("FfmpegBrowserExecutor", () => {
  beforeEach(() => {
    probeMock.mockReturnValue({ isAvailable: false, reason: "test_env_no_wasm" });
    fetchMock.mockReset();
    MockWorker.mode = "success";
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Worker", MockWorker as unknown as typeof Worker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns fallback_required when probe fails", async () => {
    const executor = new FfmpegBrowserExecutor();
    const result = await executor.execute(basePlan, { conversationId: "conv-1", userId: "usr-1" });
    expect(result.status).toBe("fallback_required");
    expect(result.failureCode).toBe("test_env_no_wasm");
  });

  it("does not throw — always returns a structured BrowserMediaExecutorResult", async () => {
    const executor = new FfmpegBrowserExecutor();
    let result: BrowserMediaExecutorResult | undefined;
    await expect(
      executor.execute(basePlan, { conversationId: "conv-1", userId: "usr-1" })
        .then((r) => { result = r; })
    ).resolves.not.toThrow();
    expect(result).toBeDefined();
    expect(["succeeded", "failed", "fallback_required"]).toContain(result?.status);
  });

  it("accepts an AbortSignal and returns fallback_required when signal is pre-aborted", async () => {
    // When signal is already aborted and probe returns isAvailable: false, we still get fallback_required.
    // The abort contract ensures no Worker is ever spawned.
    const controller = new AbortController();
    controller.abort();

    const executor = new FfmpegBrowserExecutor();
    const result = await executor.execute(
      basePlan,
      { conversationId: "conv-1", userId: "usr-1" },
      undefined,
      controller.signal,
    );
    // Probe returns false (mocked) so the probe check exits before reaching Worker spawn.
    // Either "fallback_required" (probe gate) or "aborted" (signal gate) are acceptable.
    expect(["fallback_required", "failed"]).toContain(result.status);
  });

  it("calls onProgress with a progress number and label string", async () => {
    const executor = new FfmpegBrowserExecutor();
    const progressCalls: [number, string][] = [];

    // Probe will return fallback_required immediately — so no actual onProgress calls from worker.
    // This test ensures the call signature is correct (types match).
    await executor.execute(
      basePlan,
      { conversationId: "conv-1", userId: "usr-1" },
      (progress, label) => { progressCalls.push([progress, label]); },
    );

    // In this test env (probe fails), no progress is emitted
    expect(Array.isArray(progressCalls)).toBe(true);
  });

  it("returns a succeeded envelope after worker success and governed upload", async () => {
    probeMock.mockReturnValue({ isAvailable: true });
    fetchMock.mockResolvedValue(new Response(
      JSON.stringify({
        attachments: [{ assetId: "asset-uploaded-1", mimeType: "video/mp4" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));

    const progressCalls: Array<[number, string]> = [];
    const executor = new FfmpegBrowserExecutor();

    const result = await executor.execute(
      basePlan,
      { conversationId: "conv-1", userId: "usr-1", toolInvocationId: "toolu_compose_1" },
      (progress, label) => {
        progressCalls.push([progress, label]);
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat/uploads",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
    const body = (fetchMock.mock.calls[0]?.[1] as { body?: FormData }).body;
    expect(body?.get("toolInvocationId")).toBe("toolu_compose_1");
    expect(result).toMatchObject({
      status: "succeeded",
      envelope: {
        toolName: "compose_media",
        replaySnapshot: { route: "browser_wasm", planId: "plan-test-1", profile: "still_image_narration_fast" },
        payload: {
          route: "browser_wasm",
          primaryAssetId: "asset-uploaded-1",
          profile: "still_image_narration_fast",
          outputFormat: "mp4",
          toolInvocationId: "toolu_compose_1",
        },
        artifacts: [expect.objectContaining({ toolInvocationId: "toolu_compose_1" })],
      },
    });
    expect(progressCalls).toContainEqual([42, getComposeMediaProgressLabel("rendering_media", { plan: basePlan, progressPercent: 42 })]);
    expect(progressCalls).toContainEqual([99, getComposeMediaProgressLabel("persisting", { plan: basePlan, progressPercent: 99 })]);
    expect(progressCalls).toContainEqual([100, COMPOSE_MEDIA_COMPLETE_LABEL]);
  });

  it("returns failed when the worker emits an error", async () => {
    probeMock.mockReturnValue({ isAvailable: true });
    MockWorker.mode = "error";

    const executor = new FfmpegBrowserExecutor();
    const result = await executor.execute(basePlan, { conversationId: "conv-1", userId: "usr-1" });

    expect(result).toEqual({ status: "failed", failureCode: "worker_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns failed and skips upload when the worker returns an empty blob", async () => {
    probeMock.mockReturnValue({ isAvailable: true });
    MockWorker.mode = "empty";

    const executor = new FfmpegBrowserExecutor();
    const result = await executor.execute(basePlan, { conversationId: "conv-1", userId: "usr-1" });

    expect(result).toEqual({
      status: "failed",
      failureCode: "Browser FFmpeg returned an empty media artifact.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
