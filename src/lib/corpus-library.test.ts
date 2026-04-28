import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Document } from "@/core/entities/corpus";
import { Section } from "@/core/entities/corpus";

const { getCorpusRepositoryMock } = vi.hoisted(() => ({
  getCorpusRepositoryMock: vi.fn(),
}));

vi.mock("../adapters/RepositoryFactory", () => ({
  getCorpusRepository: getCorpusRepositoryMock,
}));

function createRepository(sections: Section[], documents: Document[] = [
  { slug: "archetype-atlas", title: "The Archetype Atlas", number: "3", audience: "public" },
]) {
  return {
    getAllDocuments: vi.fn().mockResolvedValue(documents),
    getAllSections: vi.fn().mockResolvedValue(sections),
    getSectionsByDocument: vi.fn(async (documentSlug: string) =>
      sections.filter((section) => section.documentSlug === documentSlug),
    ),
    getSection: vi.fn(async (documentSlug: string, sectionSlug: string) => {
      const section = sections.find(
        (candidate) => candidate.documentSlug === documentSlug && candidate.sectionSlug === sectionSlug,
      );

      if (!section) {
        throw new Error(`Missing section: ${documentSlug}/${sectionSlug}`);
      }

      return section;
    }),
    getDocument: vi.fn(async (slug: string) => documents.find((document) => document.slug === slug) ?? null),
  };
}

describe("corpus-library", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("adapts canonical knowledge-access search results without rebuilding links", async () => {
    const sections = [
      new Section(
        "archetype-atlas",
        "ch04-the-sage",
        "The Sage: Clarity, Method, Evidence",
        "The Sage values method, clarity, rigor, and evidence in judgment.",
        [],
        ["evidence"],
        ["clarity", "method"],
      ),
    ];

    getCorpusRepositoryMock.mockReturnValue(createRepository(sections));

    const { searchCorpus } = await import("./corpus-library");
    const results = await searchCorpus("clarity method evidence", 5, { role: "AUTHENTICATED" });

    expect(results[0]).toMatchObject({
      canonicalPath: "/library/archetype-atlas/ch04-the-sage",
      resolverPath: "/library/section/ch04-the-sage",
      documentSlug: "archetype-atlas",
      sectionSlug: "ch04-the-sage",
    });
  });

  it("reuses service-normalized section content in the legacy facade", async () => {
    const sections = [
      new Section(
        "archetype-atlas",
        "ch04-the-sage",
        "The Sage: Clarity, Method, Evidence",
        "# The Sage: Clarity, Method, Evidence\n\nThe Sage values method, clarity, rigor, and evidence in judgment.",
        [],
        ["evidence"],
        ["clarity", "method"],
      ),
      new Section(
        "archetype-atlas",
        "ch05-the-magician",
        "The Magician: Method In Practice",
        "Method and clarity become transformation when they are deployed repeatedly in practice.",
        [],
        ["method"],
        ["clarity", "deployment"],
      ),
    ];

    getCorpusRepositoryMock.mockReturnValue(createRepository(sections));

    const { getSectionFull } = await import("./corpus-library");
    const section = await getSectionFull("archetype-atlas", "ch04-the-sage", { role: "AUTHENTICATED" });

    expect(section).toEqual({
      title: "The Sage: Clarity, Method, Evidence",
      content: "The Sage values method, clarity, rigor, and evidence in judgment.",
      document: "3. The Archetype Atlas",
      book: "3. The Archetype Atlas",
    });
  });
});