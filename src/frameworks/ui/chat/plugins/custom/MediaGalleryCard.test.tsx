// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ToolRenderEntry } from "@/adapters/ChatPresenter";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import { MediaGalleryCard } from "./MediaGalleryCard";

vi.mock("./captureFirstFrame", () => ({
  captureFirstFrame: vi.fn(),
}));

async function getCaptureFirstFrameMock() {
  const captureFirstFrameModule = await import("./captureFirstFrame");
  return vi.mocked(captureFirstFrameModule.captureFirstFrame);
}

function makeEntry(assetId: string): Extract<ToolRenderEntry, { kind: "tool-call" }> & {
  resultEnvelope: CapabilityResultEnvelope;
} {
  return {
    kind: "tool-call",
    name: "compose_media",
    args: { planId: `plan-${assetId}` },
    result: { ok: true },
    resultEnvelope: {
      schemaVersion: 1,
      toolName: "compose_media",
      family: "artifact",
      cardKind: "media_render",
      executionMode: "hybrid",
      inputSnapshot: { planId: `plan-${assetId}` },
      summary: { title: "Media Composition", statusLine: "succeeded" },
      payload: {
        route: "browser_wasm",
        planId: `plan-${assetId}`,
        primaryAssetId: assetId,
        outputFormat: "mp4",
      },
      artifacts: [
        {
          kind: "video",
          label: `Video ${assetId}`,
          mimeType: "video/mp4",
          assetId,
          uri: `/api/user-files/${assetId}`,
          retentionClass: "conversation",
          source: "generated",
        },
      ],
    },
  };
}

describe("MediaGalleryCard", () => {
  it("uses captured poster frames for thumbnails and the selected preview", async () => {
    const captureFirstFrame = await getCaptureFirstFrameMock();
    captureFirstFrame.mockResolvedValue("data:image/png;base64,poster-frame");

    const { container } = render(<MediaGalleryCard entries={[makeEntry("asset-1"), makeEntry("asset-2")]} />);

    await waitFor(() => {
      expect(container.querySelector('img[src="data:image/png;base64,poster-frame"]')).not.toBeNull();
    });

    expect(container.querySelector("video")?.getAttribute("poster")).toBe("data:image/png;base64,poster-frame");
  });

  it("falls back to the built-in placeholder when no poster can be captured", async () => {
    const captureFirstFrame = await getCaptureFirstFrameMock();
    captureFirstFrame.mockResolvedValue(null);

    render(<MediaGalleryCard entries={[makeEntry("asset-1"), makeEntry("asset-2")]} />);

    await waitFor(() => {
      expect(screen.getAllByText("Media").length).toBeGreaterThan(0);
    });
  });
});