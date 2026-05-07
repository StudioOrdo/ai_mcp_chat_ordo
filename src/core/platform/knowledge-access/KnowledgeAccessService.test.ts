import { describe, expect, it, vi } from "vitest";

import type { Document } from "@/core/entities/corpus";
import { Section } from "@/core/entities/corpus";
import type { SearchHandler } from "@/core/search/ports/SearchHandler";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";

import {
  KnowledgeAccessService,
  toLegacyCorpusSearchResults,
  toSearchCorpusPayload,
} from "./KnowledgeAccessService";

function createRepository(sections: Section[], documents: Document[] = [
  { slug: "archetype-atlas", title: "The Archetype Atlas", number: "3", audience: "public" },
]): CorpusRepository {
  return {
    getAllDocuments: vi.fn().mockResolvedValue(documents),
    getAllSections: vi.fn().mockResolvedValue(sections),
    getSectionsByDocument: vi.fn().mockResolvedValue(sections),
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

describe("KnowledgeAccessService", () => {
  it("returns the canonical knowledge-access response for a strong signed-in search", async () => {
    const documents: Document[] = [
      { slug: "archetype-atlas", title: "The Archetype Atlas", number: "3", audience: "public" },
      { slug: "second-renaissance", title: "The Second Renaissance", number: "1", audience: "public" },
    ];
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
      new Section(
        "archetype-atlas",
        "ch05-the-magician",
        "The Magician: Method In Practice",
        "Method and clarity become transformation when they are deployed repeatedly in practice.",
        [],
        ["method"],
        ["clarity", "deployment"],
      ),
      new Section(
        "second-renaissance",
        "ch02-signal-and-proof",
        "Signal And Proof",
        "Visible proof depends on evidence, clarity, and repeated method.",
        [],
        ["proof"],
        ["evidence", "clarity"],
      ),
    ];

    const service = new KnowledgeAccessService(createRepository(sections, documents));
    const result = await service.searchKnowledge(
      { query: "clarity method evidence" },
      { role: "AUTHENTICATED" },
    );

    expect(result.followUp).toBe("inspect_prefetched_sections");
    expect(result.retrievalQuality).toBe("strong");
    expect(result.prefetchedSections[0]).toMatchObject({
      found: true,
      canonicalPath: "/library/archetype-atlas/ch04-the-sage",
    });
    expect(result.citations[0]).toMatchObject({
      canonicalPath: "/library/archetype-atlas/ch04-the-sage",
      resolverPath: "/library/section/ch04-the-sage",
    });
    expect(result.evidence[0]).toMatchObject({
      canonicalPath: "/library/archetype-atlas/ch04-the-sage",
      resolverPath: "/library/section/ch04-the-sage",
    });
    expect(toLegacyCorpusSearchResults(result)[0]).toMatchObject({
      canonicalPath: "/library/archetype-atlas/ch04-the-sage",
      resolverPath: "/library/section/ch04-the-sage",
    });
  });

  it("maps the canonical response back to the existing tool payload", async () => {
    const sections = [
      new Section(
        "second-renaissance",
        "ch01-why-now",
        "Why Now: The Printing Press Analogy",
        "The printing press analogy explains why this transition compounds.",
        [],
        [],
        [],
      ),
    ];
    const searchHandler: SearchHandler = {
      canHandle: () => true,
      setNext: vi.fn().mockReturnThis(),
      search: vi.fn().mockResolvedValue([
        {
          documentTitle: "The Second Renaissance",
          documentId: "I",
          documentSlug: "second-renaissance",
          sectionTitle: "Why Now: The Printing Press Analogy",
          sectionSlug: "ch01-why-now",
          bookTitle: "The Second Renaissance",
          bookNumber: "I",
          bookSlug: "second-renaissance",
          chapterTitle: "Why Now: The Printing Press Analogy",
          chapterSlug: "ch01-why-now",
          relevance: "high",
          rrfScore: 0.87,
          vectorRank: 1,
          bm25Rank: 2,
          matchPassage: "The printing press analogy explains why this transition compounds.",
          matchSection: "Why Now",
          matchHighlight: "printing press analogy",
          passageOffset: { start: 12, end: 84 },
          chunkMetadata: {
            chunkId: "second-renaissance/ch01-why-now#passage:0",
            chunkLevel: "passage",
            localChunkIndex: 0,
            localChunkCount: 2,
            parentChunkId: "second-renaissance/ch01-why-now#section:0",
            previousChunkId: null,
            nextChunkId: "second-renaissance/ch01-why-now#section:1",
            boundarySource: "h2_heading",
            conceptKeywords: ["printing", "press", "analogy"],
          },
        },
      ]),
    };

    const service = new KnowledgeAccessService(createRepository(sections), searchHandler);
    const response = await service.searchKnowledge(
      { query: "printing press analogy" },
      { role: "ANONYMOUS" },
    );
    const payload = toSearchCorpusPayload(response);

    expect(response.followUp).toBe("cite_results");
    expect(response.prefetchedSections).toEqual([]);
    expect(payload.groundingState).toBe("search_only");
    expect(payload.followUp).toBe("call_get_section_before_detailed_claims");
    expect(payload.prefetchedSection).toBeNull();
    expect(payload.results[0]).toMatchObject({
      canonicalPath: "/library/second-renaissance/ch01-why-now",
      rrfScore: 0.87,
      vectorRank: 1,
      bm25Rank: 2,
    });
  });

  it("preserves anonymous no-prefetch search behavior through the compatibility adapter", async () => {
    const sections = [
      new Section(
        "second-renaissance",
        "ch01-why-now",
        "Why Now: The Printing Press Analogy",
        "The printing press analogy explains why this transition compounds.",
        [],
        [],
        [],
      ),
    ];
    const searchHandler: SearchHandler = {
      canHandle: () => true,
      setNext: vi.fn().mockReturnThis(),
      search: vi.fn().mockResolvedValue([
        {
          documentTitle: "The Second Renaissance",
          documentId: "I",
          documentSlug: "second-renaissance",
          sectionTitle: "Why Now: The Printing Press Analogy",
          sectionSlug: "ch01-why-now",
          bookTitle: "The Second Renaissance",
          bookNumber: "I",
          bookSlug: "second-renaissance",
          chapterTitle: "Why Now: The Printing Press Analogy",
          chapterSlug: "ch01-why-now",
          relevance: "high",
          rrfScore: 0.87,
          vectorRank: 1,
          bm25Rank: 2,
          matchPassage: "The printing press analogy explains why this transition compounds.",
          matchSection: "Why Now",
          matchHighlight: "printing press analogy",
          passageOffset: { start: 12, end: 84 },
          chunkMetadata: {
            chunkId: "second-renaissance/ch01-why-now#passage:0",
            chunkLevel: "passage",
            localChunkIndex: 0,
            localChunkCount: 2,
            parentChunkId: "second-renaissance/ch01-why-now#section:0",
            previousChunkId: null,
            nextChunkId: "second-renaissance/ch01-why-now#section:1",
            boundarySource: "h2_heading",
            conceptKeywords: ["printing", "press", "analogy"],
          },
        },
      ]),
    };

    const service = new KnowledgeAccessService(createRepository(sections), searchHandler);
    const result = await service.searchKnowledgePayload(
      { query: "printing press analogy" },
      { role: "ANONYMOUS" },
    );

    expect(result.groundingState).toBe("search_only");
    expect(result.followUp).toBe("call_get_section_before_detailed_claims");
    expect(result.prefetchedSection).toBeNull();
    expect(result.results[0]).toMatchObject({
      canonicalPath: "/library/second-renaissance/ch01-why-now",
      rrfScore: 0.87,
      vectorRank: 1,
      bm25Rank: 2,
    });
  });

  it("keeps role-gated system-doc sections out of anonymous search", async () => {
    const documents: Document[] = [
      { slug: "system-docs", title: "Studio Ordo System Handbook", number: "00", audience: "public" },
    ];
    const sections = [
      new Section(
        "system-docs",
        "00-public-chief-of-staff",
        "Public Chief of Staff",
        "Public visitors can ask bounded product questions.",
        [],
        [],
        [],
        "public",
      ),
      new Section(
        "system-docs",
        "06-admin-appliance-operations",
        "Admin Appliance Operations",
        "Admin restore safety, provider controls, backups, and tools.",
        [],
        [],
        [],
        "admin",
      ),
    ];
    const service = new KnowledgeAccessService(createRepository(sections, documents));

    const anonymous = await service.searchKnowledge({ query: "restore provider controls" }, { role: "ANONYMOUS" });
    const admin = await service.searchKnowledge({ query: "restore provider controls" }, { role: "ADMIN" });

    expect(anonymous.evidence).toEqual([]);
    expect(admin.evidence[0]).toMatchObject({
      documentSlug: "system-docs",
      sectionSlug: "06-admin-appliance-operations",
    });
  });
});
