import { describe, expect, it, vi } from "vitest";

import type { JobRequest } from "@/core/entities/job";
import type { AudioGenerationProvider } from "@/lib/audio/audio-generation-provider";
import { createGenerateAudioDeferredJobHandler } from "./deferred-job-handler-factories";

function createAudioJob(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_audio_1",
    conversationId: "conv_audio_1",
    userId: "usr_audio_1",
    toolName: "generate_audio",
    status: "running",
    priority: 5,
    dedupeKey: "generate_audio:key_1",
    initiatorType: "user",
    requestPayload: {
      title: "Founder memo",
      text: "This is the founder memo for the weekly review.",
      materializationKey: "generate_audio:key_1",
      voice: "alloy",
      format: "mp3",
    },
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 1,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: "rerun",
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-04-30T12:00:00.000Z",
    startedAt: "2026-04-30T12:00:01.000Z",
    completedAt: null,
    updatedAt: "2026-04-30T12:00:01.000Z",
    ...overrides,
  };
}

describe("deferred job handler factories", () => {
  it("builds generate_audio envelopes through the injected audio provider", async () => {
    const provider: AudioGenerationProvider = {
      generate: vi.fn(async () => ({
        assetId: "uf_audio_1",
        audioBuffer: Buffer.from([1, 2, 3]),
        provider: "test-provider",
        cacheHit: false,
        estimatedDurationSeconds: 7,
      })),
    };
    const reportProgress = vi.fn(async () => undefined);

    const handler = createGenerateAudioDeferredJobHandler({ audioGenerationProvider: provider });
    const result = await handler(createAudioJob({ toolInvocationId: "toolu_audio_1" }), {
      reportProgress,
      abortSignal: new AbortController().signal,
    });

    expect(provider.generate).toHaveBeenCalledWith(expect.objectContaining({
      userId: "usr_audio_1",
      conversationId: "conv_audio_1",
      text: "This is the founder memo for the weekly review.",
      voice: "alloy",
      format: "mp3",
      toolInvocationId: "toolu_audio_1",
    }));
    expect(reportProgress).toHaveBeenCalledWith(expect.objectContaining({
      progressPercent: 10,
      progressLabel: "Preparing audio generation",
    }));
    expect(reportProgress).toHaveBeenCalledWith(expect.objectContaining({
      progressPercent: 100,
      resultEnvelope: expect.objectContaining({
        toolName: "generate_audio",
        executionMode: "deferred",
        artifacts: [
          expect.objectContaining({
            kind: "audio",
            assetId: "uf_audio_1",
            uri: "/api/user-files/uf_audio_1",
            mimeType: "audio/mpeg",
            retentionClass: "conversation",
            durationSeconds: 7,
          }),
        ],
      }),
    }));
    expect(result).toMatchObject({
      schemaVersion: 1,
      toolName: "generate_audio",
      family: "artifact",
      executionMode: "deferred",
      payload: {
        action: "generate_audio",
        assetId: "uf_audio_1",
        provider: "test-provider",
        generationStatus: "completed",
      },
    });
  });

  it("rejects unsupported audio options before provider execution", async () => {
    const provider: AudioGenerationProvider = {
      generate: vi.fn(),
    };

    const handler = createGenerateAudioDeferredJobHandler({ audioGenerationProvider: provider });

    await expect(handler(createAudioJob({
      requestPayload: {
        title: "Founder memo",
        text: "This is the founder memo.",
        voice: "unsupported",
      },
    }), {
      reportProgress: vi.fn(async () => undefined),
      abortSignal: new AbortController().signal,
    })).rejects.toThrow("generate_audio currently supports only the alloy voice.");

    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("does not publish a completed result envelope when canceled after provider generation", async () => {
    const abortController = new AbortController();
    const provider: AudioGenerationProvider = {
      generate: vi.fn(async () => {
        abortController.abort("deferred_job_canceled");
        return {
          assetId: "uf_audio_canceled_1",
          audioBuffer: Buffer.from([1, 2, 3]),
          provider: "test-provider",
          cacheHit: false,
          estimatedDurationSeconds: 7,
        };
      }),
    };
    const reportProgress = vi.fn(async () => undefined);
    const handler = createGenerateAudioDeferredJobHandler({ audioGenerationProvider: provider });

    await expect(handler(createAudioJob(), {
      reportProgress,
      abortSignal: abortController.signal,
    })).rejects.toMatchObject({ name: "AbortError" });

    expect(reportProgress).toHaveBeenCalledTimes(1);
    expect(reportProgress).toHaveBeenCalledWith(expect.objectContaining({
      progressPercent: 10,
      progressLabel: "Preparing audio generation",
    }));
  });
});
