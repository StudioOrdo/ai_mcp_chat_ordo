// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MediaAssetDetail } from "@/components/media/MediaAssetDetail";
import type { UserMediaItem } from "@/lib/media/user-media";

function item(overrides: Partial<UserMediaItem> = {}): UserMediaItem {
  return {
    id: "uf_1",
    fileName: "asset.bin",
    mimeType: "application/octet-stream",
    fileType: "subtitle",
    fileSize: 1024,
    createdAt: "2026-05-04T12:00:00.000Z",
    previewUrl: "/api/user-files/uf_1",
    conversationId: null,
    source: "generated",
    retentionClass: "durable",
    width: null,
    height: null,
    durationSeconds: null,
    canDelete: true,
    ...overrides,
  };
}

describe("MediaAssetDetail", () => {
  it("renders unsupported media with an open-preview fallback", () => {
    render(<MediaAssetDetail item={item()} />);

    expect(screen.getByRole("heading", { name: "asset.bin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open asset preview" })).toHaveAttribute("href", "/api/user-files/uf_1");
    expect(screen.getByRole("button", { name: "Delete asset" })).toBeInTheDocument();
  });

  it("keeps attached media locked while preserving related links", () => {
    render(
      <MediaAssetDetail
        item={item({
          fileName: "voice.mp3",
          mimeType: "audio/mpeg",
          fileType: "audio",
          conversationId: "conv_1",
          durationSeconds: 63,
          canDelete: false,
        })}
        relatedLinks={[{ id: "conversation:conv_1", label: "Source conversation", href: "/business/conversations/conv_1" }]}
      />,
    );

    expect(document.querySelector("audio")).not.toBeNull();
    expect(screen.getByText("1:03")).toBeInTheDocument();
    expect(screen.getByText("Attached media is locked.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete asset" })).toBeNull();
    expect(screen.getByRole("link", { name: "Source conversation" })).toHaveAttribute("href", "/business/conversations/conv_1");
  });
});
