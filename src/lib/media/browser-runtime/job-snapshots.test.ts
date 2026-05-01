import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/core/entities/chat-message";

import {
  buildBrowserRuntimeJobStatusPart,
  createBrowserRuntimeJobId,
  getBrowserRuntimeCandidates,
  replaceToolResultWithJobSnapshot,
} from "./job-snapshots";

describe("browser runtime job snapshots", () => {
  it("finds browser-runtime media tool results in assistant messages", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg_1",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-11T10:00:00.000Z"),
        parts: [
          { type: "tool_call", name: "generate_chart", args: { code: "flowchart TD\nA-->B" }, toolInvocationId: "toolu_chart_1" },
          { type: "tool_result", name: "generate_chart", result: { code: "flowchart TD\nA-->B" }, toolInvocationId: "toolu_chart_1" },
        ],
      },
    ];

    expect(getBrowserRuntimeCandidates(messages)).toEqual([
      expect.objectContaining({
        jobId: "browser:msg_1:generate_chart:1",
        messageId: "msg_1",
        toolInvocationId: "toolu_chart_1",
        toolName: "generate_chart",
        resultIndex: 1,
      }),
    ]);
  });

  it("creates browser compose candidates only for executable compose_media payloads", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg_compose",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-30T03:13:00.000Z"),
        parts: [
          {
            type: "tool_call",
            name: "compose_media",
            args: {
              plan: {
                id: "compose-training-flesh-001",
                conversationId: "conv_1",
                visualClips: [{ assetId: "blogasset_image_1", kind: "image" }],
                audioClips: [{ assetId: "uf_audio_1", kind: "audio" }],
                subtitlePolicy: "none",
                waveformPolicy: "none",
                outputFormat: "mp4",
              },
            },
            toolInvocationId: "toolu_compose_1",
          },
          {
            type: "tool_result",
            name: "compose_media",
            result: {
              ok: false,
              action: "media_asset_discovery_required",
              error: "Call list_conversation_media_assets before compose_media, then pass the returned assetId values exactly into the composition plan.",
            },
            toolInvocationId: "toolu_compose_1",
          },
          {
            type: "tool_call",
            name: "compose_media",
            args: {
              plan: {
                id: "compose-training-flesh-001",
                conversationId: "conv_1",
                visualClips: [{ assetId: "blogasset_image_1", kind: "image" }],
                audioClips: [{ assetId: "uf_audio_1", kind: "audio" }],
                subtitlePolicy: "none",
                waveformPolicy: "none",
                outputFormat: "mp4",
              },
            },
            toolInvocationId: "toolu_compose_2",
          },
          {
            type: "tool_result",
            name: "compose_media",
            result: {
              action: "compose_media",
              planId: "compose-training-flesh-001",
              generationStatus: "client_fetch_pending",
            },
            toolInvocationId: "toolu_compose_2",
          },
        ],
      },
    ];

    expect(getBrowserRuntimeCandidates(messages)).toEqual([
      expect.objectContaining({
        jobId: "browser:msg_compose:compose_media:3",
        messageId: "msg_compose",
        toolInvocationId: "toolu_compose_2",
        toolName: "compose_media",
        resultIndex: 3,
      }),
    ]);
  });

  it("does not create transcript-derived generate_audio runtime candidates", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg_audio",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-30T03:13:00.000Z"),
        parts: [
          { type: "tool_call", name: "generate_audio", args: { text: "Hello", title: "Greeting" }, toolInvocationId: "toolu_audio_1" },
          {
            type: "tool_result",
            name: "generate_audio",
            result: {
              action: "generate_audio",
              title: "Greeting",
              text: "Hello",
              assetId: "uf_audio_1",
              provider: "openai-speech",
              generationStatus: "cached_asset",
              estimatedDurationSeconds: 4,
              estimatedGenerationSeconds: 2,
            },
            toolInvocationId: "toolu_audio_1",
          },
        ],
      },
    ];

    expect(getBrowserRuntimeCandidates(messages)).toEqual([]);
  });

  it("marks reroute-required compose failures with canonical recovery metadata", () => {
    const part = buildBrowserRuntimeJobStatusPart({
      candidate: {
        jobId: createBrowserRuntimeJobId("msg_2", "compose_media", 1),
        messageId: "msg_2",
        toolName: "compose_media",
        args: {
          plan: {
            id: "plan_2",
            visualClips: [],
            audioClips: [],
            subtitlePolicy: "none",
            waveformPolicy: "none",
            outputFormat: "mp4",
          },
        },
      },
      payload: {
        action: "compose_media",
        id: "plan_2",
        visualClips: [],
        audioClips: [],
        subtitlePolicy: "none",
        waveformPolicy: "none",
        outputFormat: "mp4",
      },
      status: "failed",
      browserExecutionStatus: "fallback_required",
      sequence: 2,
      error: "wasm_unavailable",
      failureCode: "wasm_unavailable",
      failureStage: "local_execution",
      conversationId: "conv_1",
    });

    expect(part).toMatchObject({
      lifecyclePhase: "compose_fallback_required",
      failureCode: "wasm_unavailable",
      failureStage: "local_execution",
      failureClass: "transient",
      recoveryMode: "rerun",
    });
  });

  it("canonicalizes failed compose_media snapshots with durable videos to succeeded", () => {
    const part = buildBrowserRuntimeJobStatusPart({
      candidate: {
        jobId: createBrowserRuntimeJobId("msg_4", "compose_media", 1),
        messageId: "msg_4",
        toolName: "compose_media",
        toolInvocationId: "toolu_compose_1",
        args: { plan: { id: "plan_1" } },
      },
      payload: {
        route: "browser_wasm",
        planId: "plan_1",
        primaryAssetId: "uf_video_1",
        outputFormat: "mp4",
      },
      status: "failed",
      browserExecutionStatus: "failed",
      sequence: 4,
      error: "Timed out waiting for video playback readiness.",
      failureCode: "playback_readiness_timeout",
      failureStage: "playback_verification",
      conversationId: "conv_1",
    });

    expect(part).toMatchObject({
      status: "succeeded",
      toolInvocationId: "toolu_compose_1",
      failureCode: null,
      failureStage: null,
      resultPayload: expect.objectContaining({ primaryAssetId: "uf_video_1" }),
    });
    expect(part.error).toBeUndefined();
    expect(part.resultEnvelope?.artifacts).toEqual([
      expect.objectContaining({ kind: "video", assetId: "uf_video_1" }),
    ]);
  });

  it("rewrites tool results into embedded job snapshots without losing the tool call", () => {
    const part = buildBrowserRuntimeJobStatusPart({
      candidate: {
        jobId: createBrowserRuntimeJobId("msg_1", "generate_chart", 1),
        messageId: "msg_1",
        toolName: "generate_chart",
        args: { code: "flowchart TD\nA-->B" },
      },
      payload: { code: "flowchart TD\nA-->B" },
      status: "succeeded",
      sequence: 1,
      conversationId: "conv_1",
    });

    const updated = replaceToolResultWithJobSnapshot([
      { type: "tool_call", name: "generate_chart", args: { code: "flowchart TD\nA-->B" } },
      { type: "tool_result", name: "generate_chart", result: { code: "flowchart TD\nA-->B" } },
    ], "msg_1", 1, part);

    expect(updated[0]).toMatchObject({ type: "tool_call", name: "generate_chart" });
    expect(updated[1]).toMatchObject({
      type: "tool_result",
      result: {
        job: {
          part: expect.objectContaining({ jobId: part.jobId, status: "succeeded" }),
        },
      },
    });
  });

  it("projects stored chart assets into browser-runtime artifact refs", () => {
    const part = buildBrowserRuntimeJobStatusPart({
      candidate: {
        jobId: createBrowserRuntimeJobId("msg_1", "generate_chart", 1),
        messageId: "msg_1",
        toolName: "generate_chart",
        args: { code: "flowchart TD\nA-->B", title: "Launch Flow" },
      },
      payload: {
        code: "flowchart TD\nA-->B",
        title: "Launch Flow",
        assetId: "uf_chart_1",
        mimeType: "text/vnd.mermaid",
        source: "derived",
        retentionClass: "conversation",
      },
      status: "succeeded",
      sequence: 2,
      conversationId: "conv_1",
    });

    expect(part.resultEnvelope?.artifacts).toEqual([
      expect.objectContaining({
        kind: "chart",
        assetId: "uf_chart_1",
        uri: "/api/user-files/uf_chart_1",
        source: "derived",
      }),
    ]);
  });
});
