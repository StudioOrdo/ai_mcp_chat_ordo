import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { lookupMock, storeMock, readFileMock, emitProviderEventMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
  storeMock: vi.fn(),
  readFileMock: vi.fn(),
  emitProviderEventMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { readFile: readFileMock },
  readFile: readFileMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getUserFileDataMapper: vi.fn(() => ({})),
}));

vi.mock("@/lib/config/env", () => ({
  getOpenaiApiKey: vi.fn(() => "test-key"),
  getTtsFetchTimeoutMs: vi.fn(() => 1000),
}));

vi.mock("@/lib/user-files", () => ({
  UserFileSystem: vi.fn(function MockUserFileSystem() {
    return {
      lookup: lookupMock,
      store: storeMock,
    };
  }),
}));

vi.mock("@/lib/chat/provider-policy", () => ({
  emitProviderEvent: emitProviderEventMock,
}));

import type { AudioGenerationError } from "@/lib/audio/audio-generation-errors";
import {
  buildGenerateAudioRuntimePayload,
  generateStoredAudioArtifact,
  TTS_MAX_RESPONSE_BYTES,
} from "@/lib/audio/audio-generation-service";

describe("audio-generation-service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: "test-key",
      TTS_PROVIDER: "openai",
    };
    vi.useRealTimers();
    lookupMock.mockReset();
    storeMock.mockReset();
    readFileMock.mockReset();
    emitProviderEventMock.mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns cached generated audio without calling the provider", async () => {
    process.env.TTS_PROVIDER = "disabled";
    lookupMock.mockResolvedValue({
      file: { id: "uf_cached_audio_1" },
      diskPath: "/tmp/audio.mp3",
    });
    readFileMock.mockResolvedValue(Buffer.from([1, 2, 3]));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStoredAudioArtifact({
      userId: "usr_1",
      conversationId: "conv_1",
      text: "Hello world",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      assetId: "uf_cached_audio_1",
      provider: "user-file-cache",
      cacheHit: true,
    });
  });

  it("fails before provider fetch on cache miss when TTS provider is disabled", async () => {
    process.env.TTS_PROVIDER = "disabled";
    lookupMock.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateStoredAudioArtifact({
      userId: "usr_1",
      conversationId: "conv_1",
      text: "Hello world",
    })).rejects.toMatchObject({
      name: "ProviderCapabilityUnavailableError",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(storeMock).not.toHaveBeenCalled();
  });

  it("regenerates audio when a cache row exists but the mp3 is missing on disk", async () => {
    lookupMock.mockResolvedValue({
      file: { id: "uf_stale_audio_1" },
      diskPath: "/tmp/missing-audio.mp3",
    });
    readFileMock.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    storeMock.mockResolvedValue({ id: "uf_audio_regenerated_1" });
    const fetchMock = vi.fn(async () => new Response(
      Buffer.from([4, 5, 6]),
      { status: 200, headers: { "Content-Type": "audio/mpeg" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStoredAudioArtifact({
      userId: "usr_1",
      conversationId: "conv_1",
      text: "Hello world",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storeMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      assetId: "uf_audio_regenerated_1",
      provider: "openai-speech",
      cacheHit: false,
    });
  });

  it("classifies transient provider status failures", async () => {
    lookupMock.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("busy", { status: 503 })));

    await expect(generateStoredAudioArtifact({
      userId: "usr_1",
      conversationId: "conv_1",
      text: "Hello world",
    })).rejects.toMatchObject({
      name: "AudioGenerationError",
      failureClass: "transient",
      statusCode: 503,
    } satisfies Partial<AudioGenerationError>);
  });

  it("classifies non-retryable provider status failures as terminal", async () => {
    lookupMock.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: { message: "Input is too long. Maximum input length is 4096 characters." },
    }), { status: 400 })));

    await expect(generateStoredAudioArtifact({
      userId: "usr_1",
      conversationId: "conv_1",
      text: "Hello world",
    })).rejects.toMatchObject({
      name: "AudioGenerationError",
      failureClass: "terminal",
      statusCode: 400,
    } satisfies Partial<AudioGenerationError>);
    await expect(generateStoredAudioArtifact({
      userId: "usr_1",
      conversationId: "conv_1",
      text: "Hello world",
    })).rejects.toThrow("Input is too long");
  });

  it("classifies provider timeouts as transient failures", async () => {
    vi.useFakeTimers();
    lookupMock.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn((_url, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    })));

    const generation = generateStoredAudioArtifact({
      userId: "usr_1",
      conversationId: "conv_1",
      text: "Hello world",
    });
    const assertion = expect(generation).rejects.toMatchObject({
      name: "AudioGenerationError",
      failureClass: "transient",
    } satisfies Partial<AudioGenerationError>);

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    vi.useRealTimers();
  });

  it("classifies oversized provider responses as terminal failures", async () => {
    lookupMock.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      new Uint8Array(TTS_MAX_RESPONSE_BYTES + 1),
      { status: 200, headers: { "Content-Type": "audio/mpeg" } },
    )));

    await expect(generateStoredAudioArtifact({
      userId: "usr_1",
      conversationId: "conv_1",
      text: "Hello world",
    })).rejects.toMatchObject({
      name: "AudioGenerationError",
      failureClass: "terminal",
    } satisfies Partial<AudioGenerationError>);
    expect(storeMock).not.toHaveBeenCalled();
  });

  it("stores successful mp3 bytes with generated audio metadata", async () => {
    lookupMock.mockResolvedValue(null);
    storeMock.mockResolvedValue({ id: "uf_audio_1" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      Buffer.from([1, 2, 3]),
      { status: 200, headers: { "Content-Type": "audio/mpeg" } },
    )));

    const result = await generateStoredAudioArtifact({
      userId: "usr_1",
      conversationId: "conv_1",
      text: "Hello world",
      voice: "alloy",
      format: "mp3",
      toolInvocationId: "toolu_audio_1",
    });

    expect(storeMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "usr_1",
      conversationId: "conv_1",
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      metadata: expect.objectContaining({
        assetKind: "audio",
        source: "generated",
        retentionClass: "conversation",
        toolName: "generate_audio",
        toolInvocationId: "toolu_audio_1",
      }),
    }));
    expect(result).toMatchObject({
      assetId: "uf_audio_1",
      provider: "openai-speech",
      cacheHit: false,
    });
  });

  it("builds canonical runtime payloads for worker result envelopes", () => {
    expect(buildGenerateAudioRuntimePayload(
      { title: "Greeting", text: "Hello world" },
      {
        assetId: "uf_audio_1",
        provider: "openai-speech",
        cacheHit: false,
        estimatedDurationSeconds: 4,
      },
    )).toMatchObject({
      action: "generate_audio",
      title: "Greeting",
      text: "Hello world",
      assetId: "uf_audio_1",
      assetKind: "audio",
      mimeType: "audio/mpeg",
      assetSource: "generated",
      generationStatus: "completed",
    });
  });
});
