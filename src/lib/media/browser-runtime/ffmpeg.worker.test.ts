import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaCompositionPlan } from "@/core/entities/media-composition";

import { MAX_FFMPEG_ASSET_BYTES } from "./ffmpeg-worker-limits";

const {
  deleteFileMock,
  execMock,
  ffmpegInstances,
  loadMock,
  onMock,
  readFileMock,
  writeFileMock,
} = vi.hoisted(() => ({
  deleteFileMock: vi.fn(async () => undefined),
  execMock: vi.fn(async () => 0),
  ffmpegInstances: [] as unknown[],
  loadMock: vi.fn(async () => undefined),
  onMock: vi.fn(),
  readFileMock: vi.fn(async () => new Uint8Array([1, 2, 3])),
  writeFileMock: vi.fn(async () => undefined),
}));

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class MockFFmpeg {
    constructor() {
      ffmpegInstances.push(this);
    }

    load = loadMock;
    on = onMock;
    writeFile = writeFileMock;
    deleteFile = deleteFileMock;
    exec = execMock;
    readFile = readFileMock;
  },
}));

const postMessageMock = vi.fn();
const fetchMock = vi.fn();

function emitFfmpegLogs(count: number): void {
  const logHandler = onMock.mock.calls.find(([eventName]) => eventName === "log")?.[1] as
    | ((payload: { message: string }) => void)
    | undefined;
  if (!logHandler) {
    return;
  }

  for (let index = 0; index < count; index += 1) {
    logHandler({ message: `log-${index + 1}` });
  }
}

const basePlan: MediaCompositionPlan = {
  id: "plan_worker_1",
  conversationId: "conv_worker_1",
  visualClips: [{ assetId: "uf_image_1", kind: "image" }],
  audioClips: [],
  subtitlePolicy: "none",
  outputFormat: "mp4",
};

function responseWithBytes(bytes: number, headers: Record<string, string> = {}): Response {
  return new Response(new Uint8Array(bytes), { status: 200, headers });
}

describe("ffmpeg.worker hardening", () => {
  beforeEach(() => {
    deleteFileMock.mockClear();
    execMock.mockClear();
    ffmpegInstances.length = 0;
    loadMock.mockClear();
    onMock.mockClear();
    postMessageMock.mockClear();
    readFileMock.mockClear();
    writeFileMock.mockReset().mockResolvedValue(undefined);
    fetchMock.mockReset().mockResolvedValue(responseWithBytes(16));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("postMessage", postMessageMock);
  });

  it("rejects oversized Content-Length before buffering", async () => {
    const { __ffmpegWorkerTestables, FfmpegAssetTooLargeError } = await import("./ffmpeg.worker");
    const arrayBufferMock = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => name.toLowerCase() === "content-length" ? String(MAX_FFMPEG_ASSET_BYTES + 1) : null },
      arrayBuffer: arrayBufferMock,
    });

    await expect(__ffmpegWorkerTestables.fetchAssetBytes("/api/user-files/huge"))
      .rejects.toBeInstanceOf(FfmpegAssetTooLargeError);
    expect(arrayBufferMock).not.toHaveBeenCalled();
  });

  it("rejects oversized buffered assets when Content-Length is missing", async () => {
    const { __ffmpegWorkerTestables, FfmpegAssetTooLargeError } = await import("./ffmpeg.worker");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: vi.fn(async () => ({ byteLength: MAX_FFMPEG_ASSET_BYTES + 1 } as ArrayBuffer)),
    });

    await expect(__ffmpegWorkerTestables.fetchAssetBytes("/api/user-files/huge"))
      .rejects.toBeInstanceOf(FfmpegAssetTooLargeError);
  });

  it("allows an asset whose declared Content-Length is exactly the cap", async () => {
    const { __ffmpegWorkerTestables } = await import("./ffmpeg.worker");
    const arrayBufferMock = vi.fn(async () => new ArrayBuffer(8));
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => name.toLowerCase() === "content-length" ? String(MAX_FFMPEG_ASSET_BYTES) : null },
      arrayBuffer: arrayBufferMock,
    });

    await expect(__ffmpegWorkerTestables.fetchAssetBytes("/api/user-files/at-cap"))
      .resolves.toBeInstanceOf(Uint8Array);
    expect(arrayBufferMock).toHaveBeenCalledTimes(1);
  });

  it("stages normal assets, writes output, and cleans all files on success", async () => {
    execMock.mockImplementationOnce(async () => {
      emitFfmpegLogs(10);
      return 0;
    });
    await import("./ffmpeg.worker");
    const handler = self.onmessage as unknown as (event: MessageEvent<unknown>) => Promise<void>;

    await handler({
      data: {
        type: "START_COMPOSITION",
        plan: basePlan,
        visualAssetUrls: { uf_image_1: "/api/user-files/uf_image_1" },
        audioAssetUrls: {},
      },
    } as MessageEvent<unknown>);

    expect(writeFileMock).toHaveBeenCalledWith("in_v_0.png", expect.any(Uint8Array));
    expect(deleteFileMock).toHaveBeenCalledWith("in_v_0.png");
    expect(deleteFileMock).toHaveBeenCalledWith("output.mp4");
    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "SUCCESS",
      logs: {
        head: Array.from({ length: 10 }, (_, index) => `log-${index + 1}`),
        tail: [],
        totalLines: 10,
        truncated: false,
      },
    }));
  });

  it("cleans staged files and posts asset_too_large on oversized asset failure", async () => {
    await import("./ffmpeg.worker");
    const handler = self.onmessage as unknown as (event: MessageEvent<unknown>) => Promise<void>;
    fetchMock
      .mockResolvedValueOnce(responseWithBytes(16))
      .mockResolvedValueOnce(responseWithBytes(1, { "content-length": String(MAX_FFMPEG_ASSET_BYTES + 1) }));

    await handler({
      data: {
        type: "START_COMPOSITION",
        plan: {
          ...basePlan,
          visualClips: [
            { assetId: "uf_image_1", kind: "image" },
            { assetId: "uf_image_2", kind: "image" },
          ],
        },
        visualAssetUrls: {
          uf_image_1: "/api/user-files/uf_image_1",
          uf_image_2: "/api/user-files/uf_image_2",
        },
        audioAssetUrls: {},
      },
    } as MessageEvent<unknown>);

    expect(deleteFileMock).toHaveBeenCalledWith("in_v_0.png");
    expect(deleteFileMock).not.toHaveBeenCalledWith("in_v_1.png");
    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "ERROR",
      failureCode: "asset_too_large",
    }));
  });

  it("preserves the original error when cleanup deletion also fails", async () => {
    await import("./ffmpeg.worker");
    const handler = self.onmessage as unknown as (event: MessageEvent<unknown>) => Promise<void>;
    execMock.mockImplementationOnce(async () => {
      emitFfmpegLogs(30);
      throw new Error("render failed");
    });
    deleteFileMock.mockRejectedValue(new Error("cleanup failed"));

    await handler({
      data: {
        type: "START_COMPOSITION",
        plan: basePlan,
        visualAssetUrls: { uf_image_1: "/api/user-files/uf_image_1" },
        audioAssetUrls: {},
      },
    } as MessageEvent<unknown>);

    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "ERROR",
      error: "render failed",
      logs: expect.objectContaining({
        head: Array.from({ length: 30 }, (_, index) => `log-${index + 1}`),
        tail: [],
        totalLines: 30,
        truncated: false,
      }),
    }));
  });

  it("captures head and tail FFmpeg logs when output exceeds the buffer", async () => {
    execMock.mockImplementationOnce(async () => {
      emitFfmpegLogs(200);
      return 0;
    });
    await import("./ffmpeg.worker");
    const handler = self.onmessage as unknown as (event: MessageEvent<unknown>) => Promise<void>;

    await handler({
      data: {
        type: "START_COMPOSITION",
        plan: basePlan,
        visualAssetUrls: { uf_image_1: "/api/user-files/uf_image_1" },
        audioAssetUrls: {},
      },
    } as MessageEvent<unknown>);

    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "SUCCESS",
      logs: {
        head: Array.from({ length: 40 }, (_, index) => `log-${index + 1}`),
        tail: Array.from({ length: 40 }, (_, index) => `log-${161 + index}`),
        totalLines: 200,
        truncated: true,
      },
    }));
  });

  it("creates a fresh FFmpeg instance after an error reset", async () => {
    await import("./ffmpeg.worker");
    const handler = self.onmessage as unknown as (event: MessageEvent<unknown>) => Promise<void>;
    fetchMock.mockResolvedValueOnce(responseWithBytes(1, { "content-length": String(MAX_FFMPEG_ASSET_BYTES + 1) }));

    await handler({
      data: {
        type: "START_COMPOSITION",
        plan: basePlan,
        visualAssetUrls: { uf_image_1: "/api/user-files/uf_image_1" },
        audioAssetUrls: {},
      },
    } as MessageEvent<unknown>);

    const instancesAfterError = ffmpegInstances.length;
    fetchMock.mockResolvedValue(responseWithBytes(16));

    await handler({
      data: {
        type: "START_COMPOSITION",
        plan: basePlan,
        visualAssetUrls: { uf_image_1: "/api/user-files/uf_image_1" },
        audioAssetUrls: {},
      },
    } as MessageEvent<unknown>);

    expect(ffmpegInstances.length).toBeGreaterThan(instancesAfterError);
    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "SUCCESS" }));
  });
});
