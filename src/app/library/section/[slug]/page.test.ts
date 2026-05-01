import { describe, expect, it, vi } from "vitest";

const {
  getCorpusIndexMock,
  getViewerRoleMock,
  handleLibraryAccessDeniedMock,
  redirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getCorpusIndexMock: vi.fn(),
  getViewerRoleMock: vi.fn(),
  handleLibraryAccessDeniedMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("@/lib/corpus-library", () => ({
  getCorpusIndex: getCorpusIndexMock,
}));

vi.mock("@/lib/corpus-access", () => ({
  getViewerRole: getViewerRoleMock,
  handleLibraryAccessDenied: handleLibraryAccessDeniedMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

import LibrarySectionResolverPage from "@/app/library/section/[slug]/page";

describe("library section resolver route", () => {
  it("redirects a chapter slug to the canonical library chapter route", async () => {
    getViewerRoleMock.mockResolvedValue("AUTHENTICATED");
    getCorpusIndexMock.mockResolvedValue([
      {
        bookSlug: "software-engineering",
        bookTitle: "Software Engineering",
        chapterSlug: "audit-to-sprint",
        chapterTitle: "Audit to Sprint",
      },
    ]);

    await expect(
      LibrarySectionResolverPage({
        params: Promise.resolve({ slug: "audit-to-sprint" }),
      }),
    ).rejects.toThrow("redirect:/library/software-engineering/audit-to-sprint");
  });

  it("redirects a book slug to the canonical library book route", async () => {
    getViewerRoleMock.mockResolvedValue("AUTHENTICATED");
    getCorpusIndexMock.mockResolvedValue([
      {
        bookSlug: "software-engineering",
        bookTitle: "Software Engineering",
        chapterSlug: "audit-to-sprint",
        chapterTitle: "Audit to Sprint",
      },
    ]);

    await expect(
      LibrarySectionResolverPage({
        params: Promise.resolve({ slug: "software-engineering" }),
      }),
    ).rejects.toThrow("redirect:/library/software-engineering");
  });

  it("returns notFound for unknown section slugs", async () => {
    getViewerRoleMock.mockResolvedValue("AUTHENTICATED");
    getCorpusIndexMock.mockResolvedValue([]);

    await expect(
      LibrarySectionResolverPage({ params: Promise.resolve({ slug: "missing-section" }) }),
    ).rejects.toThrow("notFound");
  });

  it("redirects shorthand chapter aliases to the canonical library chapter route", async () => {
    getViewerRoleMock.mockResolvedValue("AUTHENTICATED");
    getCorpusIndexMock.mockResolvedValue([
      {
        bookSlug: "archetype-atlas",
        bookTitle: "The Archetype Atlas",
        chapterSlug: "ch06-the-magician",
        chapterTitle: "The Magician: Transformation, Vision, Systems",
      },
    ]);

    await expect(
      LibrarySectionResolverPage({ params: Promise.resolve({ slug: "the-magician" }) }),
    ).rejects.toThrow("redirect:/library/archetype-atlas/ch06-the-magician");
  });

  it("redirects legacy corpus action aliases to the canonical chapter route", async () => {
    getViewerRoleMock.mockResolvedValue("AUTHENTICATED");
    getCorpusIndexMock.mockResolvedValue([
      {
        bookSlug: "field-guide",
        bookTitle: "The Field Guide",
        chapterSlug: "ch07-the-outlaw-sage",
        chapterTitle: "The Outlaw-Sage",
      },
    ]);

    await expect(
      LibrarySectionResolverPage({ params: Promise.resolve({ slug: "the-outlaw" }) }),
    ).rejects.toThrow("redirect:/library/field-guide/ch07-the-outlaw-sage");
  });
});