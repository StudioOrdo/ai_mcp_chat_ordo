import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadPublicShellNavigationContextMock } = vi.hoisted(() => ({
  loadPublicShellNavigationContextMock: vi.fn(),
}));

vi.mock("@/lib/config/instance", () => ({
  getInstanceIdentity: () => ({
    domain: "studioordo.com",
  }),
}));

vi.mock("@/lib/shell/public-shell-state", () => ({
  loadPublicShellNavigationContext: loadPublicShellNavigationContextMock,
}));

import sitemap from "@/app/sitemap";

describe("/app/sitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadPublicShellNavigationContextMock.mockResolvedValue({
      hasPublicFeedItems: false,
    });
  });

  it("emits only the public site shell routes for an empty feed", async () => {
    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toEqual([
      "https://studioordo.com",
      "https://studioordo.com/offers",
      "https://studioordo.com/about",
    ]);
    expect(urls).not.toContain("https://studioordo.com/feed");
    expect(urls).not.toContain("https://studioordo.com/library");
    expect(urls).not.toContain("https://studioordo.com/journal");
    expect(urls).not.toContain("https://studioordo.com/blog");
  });

  it("includes feed when public feed content exists", async () => {
    loadPublicShellNavigationContextMock.mockResolvedValue({
      hasPublicFeedItems: true,
    });

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toEqual([
      "https://studioordo.com",
      "https://studioordo.com/feed",
      "https://studioordo.com/offers",
      "https://studioordo.com/about",
    ]);
  });
});
