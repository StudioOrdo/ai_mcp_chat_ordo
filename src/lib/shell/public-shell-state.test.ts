import { beforeEach, describe, expect, it, vi } from "vitest";

const { countPublishedMock } = vi.hoisted(() => ({
  countPublishedMock: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getBlogPostRepository: () => ({
    countPublished: countPublishedMock,
  }),
}));

import { loadPublicShellNavigationContext } from "@/lib/shell/public-shell-state";

describe("loadPublicShellNavigationContext", () => {
  beforeEach(() => {
    countPublishedMock.mockReset();
    countPublishedMock.mockResolvedValue(0);
  });

  it("hides feed discovery when no published content exists", async () => {
    await expect(loadPublicShellNavigationContext()).resolves.toEqual({
      hasPublicFeedItems: false,
    });
  });

  it("exposes feed discovery when published content exists", async () => {
    countPublishedMock.mockResolvedValue(1);

    await expect(loadPublicShellNavigationContext()).resolves.toEqual({
      hasPublicFeedItems: true,
    });
  });

  it("fails closed when feed state cannot be loaded", async () => {
    countPublishedMock.mockRejectedValue(new Error("database unavailable"));

    await expect(loadPublicShellNavigationContext()).resolves.toEqual({
      hasPublicFeedItems: false,
    });
  });
});
