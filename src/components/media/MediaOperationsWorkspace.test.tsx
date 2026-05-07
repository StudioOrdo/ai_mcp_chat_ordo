// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MediaOperationsWorkspace } from "@/components/media/MediaOperationsWorkspace";

describe("MediaOperationsWorkspace", () => {
  it("renders the operator inventory workspace with admin conversation links", () => {
    render(
      <MediaOperationsWorkspace
        userName="Staff Analyst"
        filters={{ search: "hero", userId: "usr_1", fileType: null, source: null, retentionClass: null, attached: null }}
        items={[
          {
            id: "uf_1",
            userId: "usr_1",
            fileName: "hero.png",
            mimeType: "image/png",
            fileType: "image",
            fileSize: 4096,
            createdAt: "2026-04-15T12:00:00.000Z",
            previewUrl: "/api/user-files/uf_1",
            conversationId: "conv_1",
            conversationHref: "/admin/conversations/conv_1",
            source: "uploaded",
            retentionClass: "durable",
            width: 1200,
            height: 800,
            durationSeconds: null,
          },
        ]}
        totalCount={1}
        page={1}
        pageSize={50}
        hasPrevPage={false}
        hasNextPage={false}
        hostCapacity={{
          status: "available",
          checkedAt: "2026-04-15T12:00:00.000Z",
          rootPath: "/app/.data",
          totalBytes: 102400,
          freeBytes: 51200,
          usedBytes: 51200,
          percentUsed: 50,
        }}
        fleetAccount={{
          summary: {
            totalFiles: 1,
            totalBytes: 4096,
            totalUsers: 1,
            attachedFiles: 1,
            attachedBytes: 4096,
            unattachedFiles: 0,
            unattachedBytes: 0,
            byType: {
              audio: { files: 0, bytes: 0 },
              chart: { files: 0, bytes: 0 },
              document: { files: 0, bytes: 0 },
              graph: { files: 0, bytes: 0 },
              image: { files: 1, bytes: 4096 },
              video: { files: 0, bytes: 0 },
              subtitle: { files: 0, bytes: 0 },
              waveform: { files: 0, bytes: 0 },
            },
            byRetentionClass: {
              ephemeral: { files: 0, bytes: 0 },
              conversation: { files: 0, bytes: 0 },
              durable: { files: 1, bytes: 4096 },
            },
            bySource: {
              uploaded: { files: 1, bytes: 4096 },
              generated: { files: 0, bytes: 0 },
              derived: { files: 0, bytes: 0 },
            },
          },
          topUsers: [{ userId: "usr_1", totalFiles: 1, totalBytes: 4096 }],
          topFileTypes: [{ fileType: "image", files: 1, bytes: 4096 }],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: /Media inventory for Staff Analyst/i })).toBeInTheDocument();
    expect(screen.getAllByText("hero.png")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Open conversation detail/i })).toHaveAttribute("href", "/admin/conversations/conv_1");
    expect(screen.getByText(/Global storage leaders/i)).toBeInTheDocument();
    expect(screen.getByText(/Storage volume capacity/i)).toBeInTheDocument();
    expect(screen.getByText(/50% of the writable volume is consumed/i)).toBeInTheDocument();
  });

  it("preserves active filters in pagination links", () => {
    render(
      <MediaOperationsWorkspace
        userName="Staff Analyst"
        filters={{
          search: "batch-match",
          userId: "usr_1",
          fileType: "image",
          source: "uploaded",
          retentionClass: "durable",
          attached: true,
        }}
        items={[
          {
            id: "uf_2",
            userId: "usr_1",
            fileName: "batch-match-002.png",
            mimeType: "image/png",
            fileType: "image",
            fileSize: 4096,
            createdAt: "2026-04-15T12:00:01.000Z",
            previewUrl: "/api/user-files/uf_2",
            conversationId: "conv_2",
            conversationHref: null,
            source: "uploaded",
            retentionClass: "durable",
            width: 1200,
            height: 800,
            durationSeconds: null,
          },
        ]}
        totalCount={52}
        page={2}
        pageSize={50}
        hasPrevPage={true}
        hasNextPage={true}
        hostCapacity={{
          status: "unavailable",
          checkedAt: "2026-04-15T12:00:00.000Z",
          rootPath: "/app/.data",
          reason: "statfs unavailable",
        }}
        fleetAccount={{
          summary: {
            totalFiles: 52,
            totalBytes: 212992,
            totalUsers: 1,
            attachedFiles: 52,
            attachedBytes: 212992,
            unattachedFiles: 0,
            unattachedBytes: 0,
            byType: {
              audio: { files: 0, bytes: 0 },
              chart: { files: 0, bytes: 0 },
              document: { files: 0, bytes: 0 },
              graph: { files: 0, bytes: 0 },
              image: { files: 52, bytes: 212992 },
              video: { files: 0, bytes: 0 },
              subtitle: { files: 0, bytes: 0 },
              waveform: { files: 0, bytes: 0 },
            },
            byRetentionClass: {
              ephemeral: { files: 0, bytes: 0 },
              conversation: { files: 0, bytes: 0 },
              durable: { files: 52, bytes: 212992 },
            },
            bySource: {
              uploaded: { files: 52, bytes: 212992 },
              generated: { files: 0, bytes: 0 },
              derived: { files: 0, bytes: 0 },
            },
          },
          topUsers: [{ userId: "usr_1", totalFiles: 52, totalBytes: 212992 }],
          topFileTypes: [{ fileType: "image", files: 52, bytes: 212992 }],
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/operations/media?q=batch-match&userId=usr_1&type=image&source=uploaded&retention=durable&attached=attached",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/operations/media?q=batch-match&userId=usr_1&type=image&source=uploaded&retention=durable&attached=attached&page=3",
    );
    expect(screen.getByText(/52 matching assets/i)).toBeInTheDocument();
    expect(screen.getByText(/Capacity probe unavailable right now/i)).toBeInTheDocument();
  });
});
