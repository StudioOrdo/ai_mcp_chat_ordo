import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser, createJsonRequest } from "@/__test-utils__";

const {
  getSessionUserMock,
  generateStoredAudioArtifactMock,
  getInternalRuntimeServiceTokenMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  generateStoredAudioArtifactMock: vi.fn(),
  getInternalRuntimeServiceTokenMock: vi.fn(() => "local-dev-runtime-token"),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/config/env", () => ({
  getInternalRuntimeServiceToken: getInternalRuntimeServiceTokenMock,
}));



vi.mock("@/lib/audio/audio-generation-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audio/audio-generation-service")>("@/lib/audio/audio-generation-service");
  return {
    ...actual,
    generateStoredAudioArtifact: generateStoredAudioArtifactMock,
  };
});

import { POST } from "@/app/api/runtime/generate-audio/route";

describe("POST /api/runtime/generate-audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue(createAuthenticatedUser());
    generateStoredAudioArtifactMock.mockResolvedValue({
      assetId: "uf_audio_1",
      audioBuffer: Buffer.from([1, 2, 3]),
      provider: "openai-speech",
      cacheHit: false,
      estimatedDurationSeconds: 4,
    });
  });

  it("returns canonical generate_audio payloads for authenticated callers", async () => {
    const response = await POST(createJsonRequest("http://localhost/api/runtime/generate-audio", { title: "Greeting", text: "Hello world" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      action: "generate_audio",
      title: "Greeting",
      text: "Hello world",
      assetId: "uf_audio_1",
      generationStatus: "completed",
    });
  });

  it("accepts bridged execution context for internal runtime calls", async () => {
    const response = await POST(new Request("http://localhost/api/runtime/generate-audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ordo-runtime-token": "local-dev-runtime-token",
      },
      body: JSON.stringify({
        title: "Greeting",
        text: "Hello world",
        __executionContext: {
          userId: "usr_runtime",
          role: "AUTHENTICATED",
          conversationId: "conv_runtime_1",
          toolInvocationId: "toolu_audio_1",
        },
      }),
    }));

    expect(generateStoredAudioArtifactMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "usr_runtime",
      conversationId: "conv_runtime_1",
      toolInvocationId: "toolu_audio_1",
    }));
    await expect(response.json()).resolves.toMatchObject({
      toolInvocationId: "toolu_audio_1",
    });
    expect(response.status).toBe(200);
  });

  it("can short-circuit cached asset payloads without regeneration", async () => {
    const response = await POST(createJsonRequest("http://localhost/api/runtime/generate-audio", { title: "Greeting", text: "Hello world", assetId: "uf_cached_1" }));

    expect(generateStoredAudioArtifactMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      assetId: "uf_cached_1",
      generationStatus: "cached_asset",
    });
  });

  it("ignores non-canonical alias asset ids and resolves the stored audio artifact instead", async () => {
    const response = await POST(createJsonRequest("http://localhost/api/runtime/generate-audio", { title: "Greeting", text: "Hello world", assetId: "signal-stack-narration" }));

    expect(generateStoredAudioArtifactMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      assetId: "uf_audio_1",
      generationStatus: "completed",
    });
  });
});