import type { ContentAudience } from "@/lib/access/content-access";
import type { SearchChunkMetadata } from "@/core/search/ports/Chunker";

export interface Document {
  slug: string;
  title: string;
  id?: string;
  number: string;
  audience: ContentAudience;
  class?: string;
  rolePersona?: string;
}

export class Section {
  constructor(
    public readonly documentSlug: string,
    public readonly sectionSlug: string,
    public readonly title: string,
    public readonly content: string,
    public readonly contributors: string[],
    public readonly supplements: string[],
    public readonly headings: string[],
    public readonly audience: ContentAudience = "public",
    public readonly contentClass?: string,
    public readonly rolePersona?: string,
  ) {}

  get bookSlug(): string {
    return this.documentSlug;
  }

  get chapterSlug(): string {
    return this.sectionSlug;
  }

  get practitioners(): string[] {
    return this.contributors;
  }

  get checklistItems(): string[] {
    return this.supplements;
  }

  public calculateSearchScore(
    queryLower: string,
    queryTerms: string[],
  ): { score: number; matchContext: string } {
    let score = 0;
    let matchContext = "";
    const contentLower = this.content.toLowerCase();

    if (contentLower.includes(queryLower)) {
      score += 10;
      matchContext = this.extractContext(this.content, queryLower);
    }

    for (const term of queryTerms) {
      if (this.title.toLowerCase().includes(term)) score += 5;
      if (this.contributors.some((contributor) => contributor.toLowerCase().includes(term))) {
        score += 4;
      }
      if (this.supplements.some((supplement) => supplement.toLowerCase().includes(term))) {
        score += 3;
      }
      if (contentLower.includes(term)) score += 1;
    }

    return {
      score,
      matchContext:
        matchContext || this.content.slice(0, 200).replace(/\\n/g, " ").trim(),
    };
  }

  private extractContext(content: string, query: string): string {
    const lowerContent = content.toLowerCase();
    const idx = lowerContent.indexOf(query.toLowerCase());
    if (idx === -1) return content.slice(0, 200);

    const start = Math.max(0, idx - 100);
    const end = Math.min(content.length, idx + query.length + 200);
    const snippet = content.slice(start, end).replace(/\\n/g, " ").trim();
    return start > 0 ? `...${snippet}...` : `${snippet}...`;
  }
}

export interface CorpusSearchResult {
  documentTitle?: string;
  documentId?: string;
  documentSlug?: string;
  sectionTitle?: string;
  sectionSlug?: string;
  matchContext: string;
  relevance: "high" | "medium" | "low";
  score: number;
  matchPassage?: string;
  matchSection?: string | null;
  matchHighlight?: string;
  rrfScore?: number;
  vectorRank?: number | null;
  bm25Rank?: number | null;
  passageOffset?: { start: number; end: number };
  chunkMetadata?: SearchChunkMetadata | null;
  bookTitle?: string;
  bookNumber?: string;
  bookSlug?: string;
  chapterTitle?: string;
  chapterSlug?: string;
}

export interface Contributor {
  name: string;
  documents: { slug: string; title: string; id: string }[];
  sections: { slug: string; title: string }[];
}

export interface Supplement {
  documentTitle: string;
  sectionTitle: string;
  items: string[];
}