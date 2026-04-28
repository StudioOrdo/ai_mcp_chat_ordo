import { beforeEach, describe, expect, it, vi } from "vitest";

const { searchAdminEntitiesMock, resolveCommandRoutesMock } = vi.hoisted(() => ({
  searchAdminEntitiesMock: vi.fn(),
  resolveCommandRoutesMock: vi.fn(),
}));

const { getCorpusSummariesMock, searchCorpusMock } = vi.hoisted(() => ({
  getCorpusSummariesMock: vi.fn(),
  searchCorpusMock: vi.fn(),
}));

vi.mock("@/lib/admin/search/admin-search", () => ({
  searchAdminEntities: searchAdminEntitiesMock,
}));

vi.mock("@/lib/shell/shell-navigation", () => ({
  resolveCommandRoutes: resolveCommandRoutesMock,
}));

vi.mock("@/lib/corpus-library", () => ({
  getCorpusSummaries: getCorpusSummariesMock,
  searchCorpus: searchCorpusMock,
}));

import { DiscoverySearchService } from "./DiscoverySearchService";

describe("DiscoverySearchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveCommandRoutesMock.mockReturnValue([
      {
        id: "corpus",
        label: "Library",
        href: "/library",
        description: "Browse the library and structured reference material.",
      },
    ]);
    getCorpusSummariesMock.mockResolvedValue([
      {
        id: "doc_1",
        title: "Library Search",
        slug: "library-search",
        audience: "public",
        sectionCount: 2,
        sections: ["Search Overview", "Advanced Search"],
        sectionSlugs: ["overview", "advanced-search"],
        number: "01",
        chapterCount: 2,
        chapters: ["Search Overview", "Advanced Search"],
        chapterSlugs: ["overview", "advanced-search"],
      },
    ]);
    searchCorpusMock.mockResolvedValue([
      {
        document: "01. Library Search",
        documentId: "01",
        section: "Search Overview",
        sectionSlug: "overview",
        documentSlug: "library-search",
        matchContext: "search overview",
        relevance: "high",
        book: "01. Library Search",
        bookNumber: "01",
        chapter: "Search Overview",
        chapterSlug: "overview",
        bookSlug: "library-search",
      },
    ]);
    searchAdminEntitiesMock.mockResolvedValue([
      {
        entityType: "user",
        id: "usr_1",
        title: "Keith Williams",
        subtitle: "User — keith@example.com",
        href: "/admin/users/usr_1",
        matchField: "email",
        updatedAt: "2026-03-30T00:00:00.000Z",
      },
    ]);
  });

  it("preserves current role normalization for corpus discovery", async () => {
    const service = new DiscoverySearchService();

    await service.searchDiscovery({
      query: "lib",
      userId: "usr_staff",
      roles: ["STAFF", "ADMIN"],
    });

    expect(getCorpusSummariesMock).toHaveBeenCalledWith({ role: "STAFF" });
    expect(searchCorpusMock).toHaveBeenCalledWith("lib", 10, { role: "STAFF" });
  });

  it("returns the contract-shaped discovery response", async () => {
    const service = new DiscoverySearchService();

    const response = await service.searchDiscovery({
      query: "lib",
      userId: "usr_auth",
      roles: ["AUTHENTICATED"],
      maxResults: 5,
    });

    expect(response.query).toBe("lib");
    expect(response.results).toEqual([
      expect.objectContaining({ kind: "route", href: "/library", source: "shell" }),
      expect.objectContaining({ kind: "section", href: "/library/library-search/overview", source: "corpus" }),
      expect.objectContaining({ kind: "document", href: "/library/library-search", source: "corpus" }),
    ]);
  });

  it("keeps admin discovery restricted to admin roles", async () => {
    const service = new DiscoverySearchService();

    const authenticatedResults = await service.search("keith", {
      id: "usr_auth",
      roles: ["AUTHENTICATED"],
    });
    const adminResults = await service.search("keith", {
      id: "usr_admin",
      roles: ["ADMIN"],
    });

    expect(searchAdminEntitiesMock).toHaveBeenCalledTimes(1);
    expect(authenticatedResults.some((result) => result.kind === "admin-entity")).toBe(false);
    expect(adminResults.some((result) => result.kind === "admin-entity")).toBe(true);
  });
});