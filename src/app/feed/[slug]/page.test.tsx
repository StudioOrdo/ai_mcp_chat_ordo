import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loadPublicFeedItemBySlugMock,
  notFoundMock,
} = vi.hoisted(() => ({
  loadPublicFeedItemBySlugMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("@/lib/config/instance", () => ({
  getInstanceIdentity: () => ({ name: "Studio Ordo" }),
}));

vi.mock("@/lib/content/content-campaign-read-model", () => ({
  loadPublicFeedItemBySlug: loadPublicFeedItemBySlugMock,
  publicFeedHeroHref: (item: { heroAsset?: { id: string } | null }) => (
    item.heroAsset ? `/api/blog/assets/${item.heroAsset.id}` : null
  ),
}));

vi.mock("@/components/MarkdownProse", () => ({
  MarkdownProse: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

import FeedItemPage from "./page";

describe("FeedItemPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadPublicFeedItemBySlugMock.mockResolvedValue({
      post: {
        id: "blogpost_1",
        slug: "launch-note",
        title: "Launch Note",
        description: "A public launch update.",
        content: "## Launch",
      },
      heroAsset: { id: "blogasset_1", altText: "Launch hero" },
      publicHref: "/feed/launch-note",
    });
  });

  it("renders a published feed item and preserves tracked chat handoff", async () => {
    render(await FeedItemPage({
      params: Promise.resolve({ slug: "launch-note" }),
      searchParams: Promise.resolve({ tl: "CONTENT1" }),
    }));

    expect(loadPublicFeedItemBySlugMock).toHaveBeenCalledWith("launch-note");
    expect(screen.getByRole("heading", { name: "Launch Note" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start chat" })).toHaveAttribute("href", "/?tl=CONTENT1");
    expect(screen.getByTestId("markdown")).toHaveTextContent("## Launch");
    expect(document.body.textContent).not.toContain("providerModel");
    expect(document.body.textContent).not.toContain("tracked_link_events");
  });

  it("404s draft or missing content", async () => {
    loadPublicFeedItemBySlugMock.mockResolvedValue(null);

    await expect(FeedItemPage({
      params: Promise.resolve({ slug: "draft-note" }),
    })).rejects.toThrow("not-found");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
