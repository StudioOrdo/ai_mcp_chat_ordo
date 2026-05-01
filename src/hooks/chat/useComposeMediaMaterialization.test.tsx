// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import type { ChatMessage } from "@/core/entities/chat-message";
import { COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE } from "@/lib/media/compose-media-errors";

const {
  renderMermaidChartToPngBlobMock,
  renderGraphToPngBlobMock,
  burnCaptionIntoImageBlobMock,
} = vi.hoisted(() => ({
  renderMermaidChartToPngBlobMock: vi.fn(),
  renderGraphToPngBlobMock: vi.fn(),
  burnCaptionIntoImageBlobMock: vi.fn(),
}));

vi.mock("@/lib/media/browser-runtime/mermaid-image-derivation", () => ({
  getMermaidNodeTruncationDiagnostic: () => null,
  renderMermaidChartToPngBlob: renderMermaidChartToPngBlobMock,
}));

vi.mock("@/lib/media/browser-runtime/graph-image-derivation", () => ({
  getGraphTableTruncationDiagnostic: () => null,
  renderGraphToPngBlob: renderGraphToPngBlobMock,
}));

vi.mock("@/lib/media/browser-runtime/browser-short-caption-burn", () => ({
  burnCaptionIntoImageBlob: burnCaptionIntoImageBlobMock,
  measureCaptionLineTruncation: () => null,
}));

import { buildAssetResolutionIndex } from "./useAssetResolutionIndex";
import {
  useComposeMediaMaterialization,
} from "./useComposeMediaMaterialization";

function buildMessages(): ChatMessage[] {
  return [
    {
      id: "msg-chart-1",
      role: "assistant",
      content: "",
      timestamp: new Date("2026-04-24T10:00:00.000Z"),
      parts: [
        { type: "tool_call", name: "generate_chart", args: { title: "Signal Stack Chart", downloadFileName: "signal-stack-chart" } },
        {
          type: "tool_result",
          name: "generate_chart",
          result: { code: "flowchart TD\nA-->B", title: "Signal Stack Chart", assetId: "uf_chart_1" },
        },
      ],
    },
  ];
}

describe("useComposeMediaMaterialization", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    renderMermaidChartToPngBlobMock.mockReset();
    renderGraphToPngBlobMock.mockReset();
    burnCaptionIntoImageBlobMock.mockReset();
    renderMermaidChartToPngBlobMock.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    renderGraphToPngBlobMock.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    burnCaptionIntoImageBlobMock.mockImplementation(async ({ imageBlob }: { imageBlob: Blob }) => imageBlob);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("canonicalizes placeholder asset references and surfaces repairs", () => {
    const assetResolutionIndex = buildAssetResolutionIndex(buildMessages());
    const { result } = renderHook(() => useComposeMediaMaterialization({
      conversationId: "conv-1",
      assetResolutionIndex,
    }));

    const resolved = result.current.resolvePlanFromCandidate({
      payload: {
        id: "plan-1",
        conversationId: "conv-1",
        visualClips: [{ assetId: "signal_stack_chart", kind: "chart" }],
        audioClips: [],
        subtitlePolicy: "none",
        outputFormat: "mp4",
      },
      args: {},
    }, "local_execution");

    expect(resolved.plan?.visualClips).toEqual([{ assetId: "uf_chart_1", kind: "chart" }]);
    expect(resolved.repairs).toEqual([expect.objectContaining({
      reference: "signal_stack_chart",
      resolvedAssetId: "uf_chart_1",
    })]);
  });

  it("overrides model placeholder conversation ids with the active conversation", () => {
    const { result } = renderHook(() => useComposeMediaMaterialization({
      conversationId: "conv-real",
      assetResolutionIndex: buildAssetResolutionIndex([]),
    }));

    const resolved = result.current.resolvePlanFromCandidate({
      payload: {
        id: "plan-current",
        conversationId: "current",
        visualClips: [{ assetId: "blogasset_ccc76fd8-d40c-421d-a878-e871dd0a32e7", kind: "image" }],
        audioClips: [{ assetId: "uf_5f4f5658-55ca-4d0e-9153-bc9f671a9e5a", kind: "audio" }],
        subtitlePolicy: "none",
        waveformPolicy: "none",
        outputFormat: "mp4",
      },
      args: {},
    }, "local_execution");

    expect(resolved.plan?.conversationId).toBe("conv-real");
  });

  it("fails chart materialization when governed storage rehydration is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("governed-unavailable", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useComposeMediaMaterialization({
      conversationId: "conv-1",
      assetResolutionIndex: buildAssetResolutionIndex(buildMessages()),
    }));

    await expect(result.current.materializePlan({
      id: "plan-1",
      conversationId: "conv-1",
      visualClips: [{ assetId: "uf_chart_1", kind: "chart" }],
      audioClips: [],
      subtitlePolicy: "none",
      waveformPolicy: "none",
      outputFormat: "mp4",
    }, new AbortController().signal)).rejects.toMatchObject({
      failureCode: "source_rehydration_failed",
    });

    expect(renderMermaidChartToPngBlobMock).not.toHaveBeenCalled();
  });

  it("rehydrates governed chart sources from storage before rasterization", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("flowchart TD\nA-->B", { status: 200, headers: { "Content-Type": "text/vnd.mermaid" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        attachments: [{ assetId: "uf_chart_png_2", mimeType: "image/png", assetKind: "image", source: "derived", retentionClass: "conversation" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useComposeMediaMaterialization({
      conversationId: "conv-1",
      assetResolutionIndex: buildAssetResolutionIndex([]),
    }));

    const materialized = await result.current.materializePlan({
      id: "plan-2",
      conversationId: "conv-1",
      visualClips: [{ assetId: "uf_chart_storage_1", kind: "chart" }],
      audioClips: [],
      subtitlePolicy: "none",
      waveformPolicy: "none",
      outputFormat: "mp4",
    }, new AbortController().signal);

    expect(renderMermaidChartToPngBlobMock).toHaveBeenCalledWith("flowchart TD\nA-->B");
    expect(materialized.visualClips).toEqual([{ assetId: "uf_chart_png_2", kind: "image", sourceAssetId: "uf_chart_storage_1" }]);
  });

  it("burns captions for browser_short_explainer image beats and preserves source lineage", async () => {
    const imageBytes = new Uint8Array([105, 109, 97, 103, 101]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(imageBytes, { status: 200, headers: { "Content-Type": "image/png" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        attachments: [{ assetId: "uf_image_burned_1", mimeType: "image/png", assetKind: "image", source: "derived", retentionClass: "conversation" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useComposeMediaMaterialization({
      conversationId: "conv-1",
      assetResolutionIndex: buildAssetResolutionIndex([]),
    }));

    const materialized = await result.current.materializePlan({
      id: "plan-3",
      conversationId: "conv-1",
      mode: "browser_short_explainer",
      visualClips: [{ assetId: "asset_image_1", kind: "image" }],
      audioClips: [],
      subtitlePolicy: "burned",
      waveformPolicy: "none",
      outputFormat: "mp4",
      resolution: { width: 720, height: 1280 },
      overrides: { title: "Short explainer title" },
    }, new AbortController().signal);

    expect(burnCaptionIntoImageBlobMock).toHaveBeenCalledTimes(1);
    expect(materialized.visualClips).toEqual([{ assetId: "uf_image_burned_1", kind: "image", sourceAssetId: "asset_image_1" }]);
  });

  it("preserves invalid_plan failure codes when deferred enqueue rejects the plan", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Invalid plan", errorCode: "INVALID_PLAN" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    ));

    const { result } = renderHook(() => useComposeMediaMaterialization({
      conversationId: "conv-1",
      assetResolutionIndex: buildAssetResolutionIndex([]),
    }));

    await expect(result.current.enqueueDeferredJob({
      id: "plan-4",
      conversationId: "conv-1",
      visualClips: [],
      audioClips: [],
      subtitlePolicy: "none",
      waveformPolicy: "none",
      outputFormat: "mp4",
    }, new AbortController().signal)).rejects.toMatchObject({
      failureCode: COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE,
    });
  });
});
