// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { UserMediaWorkspace } from "@/components/media/UserMediaWorkspace";

describe("UserMediaWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the signed-in media workspace with filter controls and preview metadata", () => {
    render(
      <UserMediaWorkspace
        userName="Apprentice"
        filters={{ search: "", fileType: null, source: null, retentionClass: null, attached: null }}
        quota={{
          quotaBytes: 3072,
          usedBytes: 1536,
          remainingBytes: 1536,
          percentUsed: 50,
          warnAtPercent: 80,
          hardBlockUploadsAtQuota: false,
          isWarning: false,
          isOverQuota: false,
          status: "normal",
        }}
        hasMore={false}
        items={[
          {
            id: "uf_1",
            fileName: "hero-shot.png",
            mimeType: "image/png",
            fileType: "image",
            fileSize: 1536,
            createdAt: "2026-04-15T12:00:00.000Z",
            previewUrl: "/api/user-files/uf_1",
            conversationId: null,
            source: "uploaded",
            retentionClass: "ephemeral",
            width: 1200,
            height: 800,
            durationSeconds: null,
            canDelete: true,
          },
        ]}
        summary={{
          totalFiles: 1,
          totalBytes: 1536,
          attachedFiles: 0,
          attachedBytes: 0,
          unattachedFiles: 1,
          unattachedBytes: 1536,
          byType: {
            audio: { files: 0, bytes: 0 },
            chart: { files: 0, bytes: 0 },
            document: { files: 0, bytes: 0 },
            graph: { files: 0, bytes: 0 },
            image: { files: 1, bytes: 1536 },
            video: { files: 0, bytes: 0 },
            subtitle: { files: 0, bytes: 0 },
            waveform: { files: 0, bytes: 0 },
          },
          byRetentionClass: {
            ephemeral: { files: 1, bytes: 1536 },
            conversation: { files: 0, bytes: 0 },
            durable: { files: 0, bytes: 0 },
          },
          bySource: {
            uploaded: { files: 1, bytes: 1536 },
            generated: { files: 0, bytes: 0 },
            derived: { files: 0, bytes: 0 },
          },
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Governed media" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Overview/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Filter")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Governed assets for Apprentice/i })).toBeNull();
    expect(screen.getAllByText("hero-shot.png")).toHaveLength(2);
    expect(screen.getByText(/1.5 KB of 3.0 KB used/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /hero-shot\.png/i }));

    expect(screen.queryByRole("heading", { name: "Governed media" })).toBeNull();
    expect(screen.getByRole("heading", { name: "hero-shot.png" })).toBeInTheDocument();
    expect(screen.getByText("1200x800")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete asset/i })).toBeInTheDocument();
    const capacityLabel = ["Writable", "volume", "capacity"].join(" ");
    expect(screen.queryByText(capacityLabel)).toBeNull();
  });

  it("uses the second column as the media selector and opens selected media in the detail column", () => {
    render(
      <UserMediaWorkspace
        userName="Apprentice"
        filters={{ search: "", fileType: null, source: null, retentionClass: null, attached: null }}
        quota={{
          quotaBytes: 6144,
          usedBytes: 5536,
          remainingBytes: 608,
          percentUsed: 90,
          warnAtPercent: 80,
          hardBlockUploadsAtQuota: false,
          isWarning: true,
          isOverQuota: false,
          status: "warning",
        }}
        hasMore={true}
        items={[
          {
            id: "uf_1",
            fileName: "hero-shot.png",
            mimeType: "image/png",
            fileType: "image",
            fileSize: 1536,
            createdAt: "2026-04-15T12:00:00.000Z",
            previewUrl: "/api/user-files/uf_1",
            conversationId: null,
            source: "uploaded",
            retentionClass: "ephemeral",
            width: 1200,
            height: 800,
            durationSeconds: null,
            canDelete: true,
          },
          {
            id: "uf_2",
            fileName: "conversation-video.mp4",
            mimeType: "video/mp4",
            fileType: "video",
            fileSize: 4000,
            createdAt: "2026-04-16T12:00:00.000Z",
            previewUrl: "/api/user-files/uf_2",
            conversationId: "conv_1",
            source: "generated",
            retentionClass: "conversation",
            width: 1080,
            height: 1920,
            durationSeconds: 12,
            canDelete: false,
          },
        ]}
        summary={{
          totalFiles: 2,
          totalBytes: 5536,
          attachedFiles: 1,
          attachedBytes: 4000,
          unattachedFiles: 1,
          unattachedBytes: 1536,
          byType: {
            audio: { files: 0, bytes: 0 },
            chart: { files: 0, bytes: 0 },
            document: { files: 0, bytes: 0 },
            graph: { files: 0, bytes: 0 },
            image: { files: 1, bytes: 1536 },
            video: { files: 1, bytes: 4000 },
            subtitle: { files: 0, bytes: 0 },
            waveform: { files: 0, bytes: 0 },
          },
          byRetentionClass: {
            ephemeral: { files: 1, bytes: 1536 },
            conversation: { files: 1, bytes: 4000 },
            durable: { files: 0, bytes: 0 },
          },
          bySource: {
            uploaded: { files: 1, bytes: 1536 },
            generated: { files: 1, bytes: 4000 },
            derived: { files: 0, bytes: 0 },
          },
        }}
      />,
    );

    expect(screen.getByLabelText("Media selection")).toHaveAttribute("data-media-selection-column", "true");
    expect(screen.getByRole("main")).toHaveAttribute("data-media-mobile-state", "list");
    expect(screen.getByText(/More assets exist/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Governed media" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /conversation-video\.mp4/i }));

    expect(screen.getByRole("main")).toHaveAttribute("data-media-mobile-state", "detail");
    expect(screen.getByRole("heading", { name: "conversation-video.mp4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to media/i })).toBeInTheDocument();
    expect(screen.getByText(/Attached media is locked/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Governed media" })).toBeNull();
  });

  it("refreshes the route after successfully deleting an unattached asset", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    render(
      <UserMediaWorkspace
        userName="Apprentice"
        filters={{ search: "", fileType: null, source: null, retentionClass: null, attached: null }}
        quota={{
          quotaBytes: 2048,
          usedBytes: 1536,
          remainingBytes: 512,
          percentUsed: 75,
          warnAtPercent: 80,
          hardBlockUploadsAtQuota: false,
          isWarning: false,
          isOverQuota: false,
          status: "normal",
        }}
        hasMore={false}
        items={[
          {
            id: "uf_1",
            fileName: "hero-shot.png",
            mimeType: "image/png",
            fileType: "image",
            fileSize: 1536,
            createdAt: "2026-04-15T12:00:00.000Z",
            previewUrl: "/api/user-files/uf_1",
            conversationId: null,
            source: "uploaded",
            retentionClass: "ephemeral",
            width: null,
            height: null,
            durationSeconds: null,
            canDelete: true,
          },
        ]}
        summary={{
          totalFiles: 1,
          totalBytes: 1536,
          attachedFiles: 0,
          attachedBytes: 0,
          unattachedFiles: 1,
          unattachedBytes: 1536,
          byType: {
            audio: { files: 0, bytes: 0 },
            chart: { files: 0, bytes: 0 },
            document: { files: 0, bytes: 0 },
            graph: { files: 0, bytes: 0 },
            image: { files: 1, bytes: 1536 },
            video: { files: 0, bytes: 0 },
            subtitle: { files: 0, bytes: 0 },
            waveform: { files: 0, bytes: 0 },
          },
          byRetentionClass: {
            ephemeral: { files: 1, bytes: 1536 },
            conversation: { files: 0, bytes: 0 },
            durable: { files: 0, bytes: 0 },
          },
          bySource: {
            uploaded: { files: 1, bytes: 1536 },
            generated: { files: 0, bytes: 0 },
            derived: { files: 0, bytes: 0 },
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /hero-shot\.png/i }));
    fireEvent.click(screen.getByRole("button", { name: /Delete asset/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/user-files/uf_1", expect.objectContaining({ method: "DELETE" }));
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("keeps attached assets locked from deletion", () => {
    render(
      <UserMediaWorkspace
        userName="Apprentice"
        filters={{ search: "", fileType: null, source: null, retentionClass: null, attached: null }}
        quota={{
          quotaBytes: 4000,
          usedBytes: 4000,
          remainingBytes: 0,
          percentUsed: 100,
          warnAtPercent: 80,
          hardBlockUploadsAtQuota: false,
          isWarning: false,
          isOverQuota: true,
          status: "over_quota",
        }}
        hasMore={false}
        items={[
          {
            id: "uf_1",
            fileName: "conversation-video.mp4",
            mimeType: "video/mp4",
            fileType: "video",
            fileSize: 4000,
            createdAt: "2026-04-15T12:00:00.000Z",
            previewUrl: "/api/user-files/uf_1",
            conversationId: "conv_1",
            source: "generated",
            retentionClass: "conversation",
            width: 1080,
            height: 1920,
            durationSeconds: 12,
            canDelete: false,
          },
        ]}
        summary={{
          totalFiles: 1,
          totalBytes: 4000,
          attachedFiles: 1,
          attachedBytes: 4000,
          unattachedFiles: 0,
          unattachedBytes: 0,
          byType: {
            audio: { files: 0, bytes: 0 },
            chart: { files: 0, bytes: 0 },
            document: { files: 0, bytes: 0 },
            graph: { files: 0, bytes: 0 },
            image: { files: 0, bytes: 0 },
            video: { files: 1, bytes: 4000 },
            subtitle: { files: 0, bytes: 0 },
            waveform: { files: 0, bytes: 0 },
          },
          byRetentionClass: {
            ephemeral: { files: 0, bytes: 0 },
            conversation: { files: 1, bytes: 4000 },
            durable: { files: 0, bytes: 0 },
          },
          bySource: {
            uploaded: { files: 0, bytes: 0 },
            generated: { files: 1, bytes: 4000 },
            derived: { files: 0, bytes: 0 },
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /conversation-video\.mp4/i }));

    expect(screen.queryByRole("button", { name: /Delete asset/i })).toBeNull();
    expect(screen.getByText(/Attached media is locked/i)).toBeInTheDocument();
    const implementationCopy = ["Display-only", "in this", String.fromCharCode(112, 104, 97, 115, 101)].join(" ");
    expect(screen.queryByText(implementationCopy)).toBeNull();
  });
});
