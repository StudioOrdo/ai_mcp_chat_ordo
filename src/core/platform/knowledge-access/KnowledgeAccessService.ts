import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { SearchHandler } from "@/core/search/ports/SearchHandler";
import type { LibrarySearchResult } from "@/core/entities/library";
import { ContentAccessDeniedError } from "@/core/entities/errors";
import type { RoleName } from "@/core/entities/user";
import type { SearchChunkMetadata } from "@/core/search/ports/Chunker";
import { canAccessAudience } from "@/lib/access/content-access";
import { resolveCanonicalCorpusReference } from "@/lib/corpus-reference";
import { stripLeadingMarkdownTitle } from "@/lib/markdown/strip-leading-markdown-title";
import { LibrarySearchInteractor } from "@/core/use-cases/LibrarySearchInteractor";
import { CorpusIndexInteractor, type CorpusIndexEntry } from "@/core/use-cases/CorpusIndexInteractor";

const MAX_PREFETCH_SECTION_CHARS = 4000;
const MIN_RELATED_SECTION_COUNT = 2;
const MAX_RELATED_SECTION_COUNT = 3;
const RELATED_SECTION_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "between",
  "chapter",
  "could",
  "does",
  "from",
  "into",
  "just",
  "more",
  "most",
  "other",
  "over",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "under",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
]);

export type CorpusLinkPayload = {
  title: string;
  document: string;
  documentId: string;
  documentSlug: string | null;
  sectionSlug: string | null;
  canonicalPath: string | null;
  resolverPath: string | null;
  fallbackSearchPath: string | null;
  fallbackSearchQuery: string | null;
};

export type SearchCorpusResultItem = {
  document: string;
  documentId: string;
  section: string;
  sectionSlug: string;
  documentSlug: string;
  matchContext: string;
  relevance: "high" | "medium" | "low";
  normalizedScore?: number;
  book: string;
  bookNumber: string;
  chapter: string;
  chapterSlug: string;
  bookSlug: string;
  canonicalPath: string | null;
  resolverPath: string | null;
  fallbackSearchPath: string | null;
  fallbackSearchQuery: string | null;
  matchPassage?: string;
  matchSection?: string | null;
  matchHighlight?: string;
  rrfScore?: number;
  vectorRank?: number | null;
  bm25Rank?: number | null;
  passageOffset?: { start: number; end: number };
  chunkMetadata?: SearchChunkMetadata | null;
};

export type GetSectionPayload = {
  found: boolean;
  requestedDocumentSlug: string;
  requestedSectionSlug: string;
  title: string | null;
  document: string | null;
  documentId: string | null;
  documentSlug: string | null;
  sectionSlug: string | null;
  canonicalPath: string | null;
  resolverPath: string | null;
  fallbackSearchPath: string | null;
  fallbackSearchQuery: string | null;
  content: string | null;
  contentTruncated: boolean;
  resolvedFromAlias: boolean;
  navigation: {
    previous: CorpusLinkPayload | null;
    next: CorpusLinkPayload | null;
  };
  relatedSections: CorpusLinkPayload[];
};

export type SearchCorpusPayload = {
  query: string;
  groundingState: "no_results" | "search_only" | "prefetched_section";
  followUp: "refine_query" | "call_get_section_before_detailed_claims" | "cite_canonical_paths";
  retrievalQuality: "strong" | "partial" | "none";
  results: SearchCorpusResultItem[];
  prefetchedSection: GetSectionPayload | null;
};

export type CitationRecord = CorpusLinkPayload;

export type KnowledgeEvidenceRecord = SearchCorpusResultItem;

export type PrefetchedSection = GetSectionPayload;

export type KnowledgeAccessFollowUp = "refine_query" | "cite_results" | "inspect_prefetched_sections";

export interface KnowledgeAccessResponse {
  query: string;
  retrievalQuality: "strong" | "partial" | "none";
  citations: readonly CitationRecord[];
  evidence: readonly KnowledgeEvidenceRecord[];
  prefetchedSections: readonly PrefetchedSection[];
  followUp: KnowledgeAccessFollowUp;
}

export type LegacyCorpusSearchResult = {
  document: string;
  documentId: string;
  section: string;
  sectionSlug: string;
  documentSlug: string;
  matchContext: string;
  relevance: "high" | "medium" | "low";
  book: string;
  bookNumber: string;
  chapter: string;
  chapterSlug: string;
  bookSlug: string;
  canonicalPath: string;
  resolverPath: string;
};

export type LegacyCorpusSection = {
  title: string;
  content: string;
  document: string;
  book: string;
};

export interface SearchKnowledgeInput {
  query: string;
  maxResults?: number;
}

export interface GetKnowledgeSectionInput {
  documentSlug: string;
  sectionSlug: string;
}

interface SearchExecutor {
  execute(input: { query: string; maxResults?: number; role?: RoleName }): Promise<LibrarySearchResult[]>;
}

interface IndexExecutor {
  execute(input?: { role: RoleName } | undefined): Promise<CorpusIndexEntry[]>;
}

export interface KnowledgeAccessServiceDeps {
  searchExecutor?: SearchExecutor;
  indexExecutor?: IndexExecutor;
}

function formatDocumentLabel(documentId: string, documentTitle: string): string {
  return `${documentId}. ${documentTitle}`.trim();
}

function extractChapterSequence(slug: string): number | null {
  const match = slug.match(/^ch(\d{1,3})-/i);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function tokenizeRelatedText(values: string[]): Set<string> {
  return new Set(
    values
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((value) => value.trim())
      .filter((value) => value.length >= 4 && !RELATED_SECTION_STOP_WORDS.has(value)),
  );
}

function buildCorpusLinkPayload(
  entry: {
    documentTitle: string;
    documentId: string;
    documentSlug: string;
    sectionTitle: string;
    sectionSlug: string;
  },
  index: CorpusIndexEntry[],
): CorpusLinkPayload {
  const reference = resolveCanonicalCorpusReference(index, entry.documentSlug, entry.sectionSlug);

  return {
    title: entry.sectionTitle,
    document: formatDocumentLabel(entry.documentId, entry.documentTitle),
    documentId: entry.documentId,
    documentSlug: reference.documentSlug ?? entry.documentSlug,
    sectionSlug: reference.sectionSlug ?? entry.sectionSlug,
    canonicalPath: reference.canonicalPath,
    resolverPath: reference.resolverPath,
    fallbackSearchPath: reference.fallbackSearchPath,
    fallbackSearchQuery: reference.fallbackSearchQuery,
  };
}

function scoreRelatedSection(
  currentTokens: Set<string>,
  currentDocumentSlug: string,
  candidate: CorpusIndexEntry,
): number {
  const candidateTokens = tokenizeRelatedText([
    candidate.sectionTitle,
    candidate.contentPreview,
    ...candidate.headings,
    ...candidate.supplements,
  ]);

  let overlap = 0;
  for (const token of currentTokens) {
    if (candidateTokens.has(token)) {
      overlap += 1;
    }
  }

  if (overlap === 0) {
    return 0;
  }

  return overlap + (candidate.documentSlug !== currentDocumentSlug ? 2 : 0.5);
}

function buildRelatedSections(
  index: CorpusIndexEntry[],
  currentEntry: CorpusIndexEntry,
): CorpusLinkPayload[] {
  const currentTokens = tokenizeRelatedText([
    currentEntry.sectionTitle,
    currentEntry.contentPreview,
    ...currentEntry.headings,
    ...currentEntry.supplements,
  ]);

  const ranked = index
    .filter(
      (candidate) =>
        !(candidate.documentSlug === currentEntry.documentSlug && candidate.sectionSlug === currentEntry.sectionSlug),
    )
    .map((candidate) => ({
      candidate,
      score: scoreRelatedSection(currentTokens, currentEntry.documentSlug, candidate),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.candidate.documentSlug.localeCompare(right.candidate.documentSlug));

  const selected = ranked.slice(0, MAX_RELATED_SECTION_COUNT).map(({ candidate }) => buildCorpusLinkPayload({
    documentTitle: candidate.documentTitle,
    documentId: candidate.documentId,
    documentSlug: candidate.documentSlug,
    sectionTitle: candidate.sectionTitle,
    sectionSlug: candidate.sectionSlug,
  }, index));

  if (selected.length >= MIN_RELATED_SECTION_COUNT) {
    return selected;
  }

  const currentChapterSequence = extractChapterSequence(currentEntry.sectionSlug);
  const sameDocumentFallback = index
    .filter(
      (candidate) =>
        candidate.documentSlug === currentEntry.documentSlug
        && candidate.sectionSlug !== currentEntry.sectionSlug
        && !selected.some((entry) => entry.documentSlug === candidate.documentSlug && entry.sectionSlug === candidate.sectionSlug),
    )
    .sort((left, right) => {
      const leftSequence = extractChapterSequence(left.sectionSlug);
      const rightSequence = extractChapterSequence(right.sectionSlug);

      if (currentChapterSequence == null || leftSequence == null || rightSequence == null) {
        return left.sectionSlug.localeCompare(right.sectionSlug);
      }

      return Math.abs(leftSequence - currentChapterSequence) - Math.abs(rightSequence - currentChapterSequence);
    })
    .slice(0, MAX_RELATED_SECTION_COUNT - selected.length)
    .map((candidate) => buildCorpusLinkPayload({
      documentTitle: candidate.documentTitle,
      documentId: candidate.documentId,
      documentSlug: candidate.documentSlug,
      sectionTitle: candidate.sectionTitle,
      sectionSlug: candidate.sectionSlug,
    }, index));

  return [...selected, ...sameDocumentFallback].slice(0, MAX_RELATED_SECTION_COUNT);
}

function createMissingSectionPayload(
  requestedDocumentSlug: string,
  requestedSectionSlug: string,
  fallbackSearchPath: string | null,
  fallbackSearchQuery: string | null,
): GetSectionPayload {
  return {
    found: false,
    requestedDocumentSlug,
    requestedSectionSlug,
    title: null,
    document: null,
    documentId: null,
    documentSlug: null,
    sectionSlug: null,
    canonicalPath: null,
    resolverPath: null,
    fallbackSearchPath,
    fallbackSearchQuery,
    content: null,
    contentTruncated: false,
    resolvedFromAlias: false,
    navigation: {
      previous: null,
      next: null,
    },
    relatedSections: [],
  };
}

function buildSearchCorpusResultItem(
  result: LibrarySearchResult,
  index: CorpusIndexEntry[],
): SearchCorpusResultItem {
  const documentId = result.bookNumber ?? result.documentId ?? "Unknown";
  const documentTitle = result.bookTitle ?? result.documentTitle ?? "Unknown document";
  const chapterTitle = result.chapterTitle ?? result.sectionTitle ?? "Unknown section";
  const rawDocumentSlug = result.bookSlug ?? result.documentSlug ?? "unknown-document";
  const rawSectionSlug = result.chapterSlug ?? result.sectionSlug ?? "unknown-section";
  const reference = resolveCanonicalCorpusReference(index, rawDocumentSlug, rawSectionSlug);
  const documentSlug = reference.documentSlug ?? rawDocumentSlug;
  const sectionSlug = reference.sectionSlug ?? rawSectionSlug;

  return {
    document: formatDocumentLabel(documentId, documentTitle),
    documentId,
    section: chapterTitle,
    sectionSlug,
    documentSlug,
    matchContext: result.matchContext,
    relevance: result.relevance,
    normalizedScore: result.score,
    book: formatDocumentLabel(documentId, documentTitle),
    bookNumber: documentId,
    chapter: chapterTitle,
    chapterSlug: sectionSlug,
    bookSlug: documentSlug,
    canonicalPath: reference.canonicalPath,
    resolverPath: reference.resolverPath,
    fallbackSearchPath: reference.fallbackSearchPath,
    fallbackSearchQuery: reference.fallbackSearchQuery,
    ...(result.matchPassage !== undefined && {
      matchPassage: result.matchPassage,
      matchSection: result.matchSection,
      matchHighlight: result.matchHighlight,
      rrfScore: result.rrfScore,
      vectorRank: result.vectorRank,
      bm25Rank: result.bm25Rank,
      passageOffset: result.passageOffset,
      chunkMetadata: result.chunkMetadata ?? null,
    }),
  };
}

function buildCitationRecord(result: SearchCorpusResultItem): CitationRecord {
  return {
    title: result.section,
    document: result.document,
    documentId: result.documentId,
    documentSlug: result.documentSlug,
    sectionSlug: result.sectionSlug,
    canonicalPath: result.canonicalPath,
    resolverPath: result.resolverPath,
    fallbackSearchPath: result.fallbackSearchPath,
    fallbackSearchQuery: result.fallbackSearchQuery,
  };
}

export function toKnowledgeAccessResponse(payload: SearchCorpusPayload): KnowledgeAccessResponse {
  return {
    query: payload.query,
    retrievalQuality: payload.retrievalQuality,
    citations: payload.results.map(buildCitationRecord),
    evidence: payload.results,
    prefetchedSections: payload.prefetchedSection ? [payload.prefetchedSection] : [],
    followUp:
      payload.groundingState === "prefetched_section"
        ? "inspect_prefetched_sections"
        : payload.groundingState === "no_results"
          ? "refine_query"
          : "cite_results",
  };
}

export function toSearchCorpusPayload(response: KnowledgeAccessResponse): SearchCorpusPayload {
  return {
    query: response.query,
    groundingState:
      response.prefetchedSections.length > 0
        ? "prefetched_section"
        : response.evidence.length > 0
          ? "search_only"
          : "no_results",
    followUp:
      response.followUp === "inspect_prefetched_sections"
        ? "cite_canonical_paths"
        : response.followUp === "cite_results"
          ? "call_get_section_before_detailed_claims"
          : "refine_query",
    retrievalQuality: response.retrievalQuality,
    results: [...response.evidence],
    prefetchedSection: response.prefetchedSections[0] ?? null,
  };
}

export function toLegacyCorpusSearchResults(
  response: KnowledgeAccessResponse,
): LegacyCorpusSearchResult[] {
  return response.evidence.map((result) => ({
    document: result.document,
    documentId: result.documentId,
    section: result.section,
    sectionSlug: result.sectionSlug,
    documentSlug: result.documentSlug,
    matchContext: result.matchContext,
    relevance: result.relevance,
    book: result.book,
    bookNumber: result.bookNumber,
    chapter: result.chapter,
    chapterSlug: result.chapterSlug,
    bookSlug: result.bookSlug,
    canonicalPath: result.canonicalPath ?? "",
    resolverPath: result.resolverPath ?? "",
  }));
}

export function toLegacyCorpusSection(section: GetSectionPayload): LegacyCorpusSection | null {
  if (!section.found || section.title === null || section.content === null || section.document === null) {
    return null;
  }

  return {
    title: section.title,
    content: section.content,
    document: section.document,
    book: section.document,
  };
}

function shouldPrefetchTopSection(results: LibrarySearchResult[]): boolean {
  const top = results[0];
  const second = results[1];

  if (!top?.bookSlug || !top.chapterSlug) {
    return false;
  }

  if (top.relevance !== "high") {
    return false;
  }

  if (!second) {
    return true;
  }

  if (second.relevance !== "high") {
    return true;
  }

  if (typeof top.score !== "number" || typeof second.score !== "number") {
    return false;
  }

  if (top.score > 1 || second.score > 1) {
    return top.score - second.score >= 5;
  }

  return top.score - second.score >= 0.15;
}

function truncateSectionContent(content: string): { content: string; contentTruncated: boolean } {
  if (content.length <= MAX_PREFETCH_SECTION_CHARS) {
    return { content, contentTruncated: false };
  }

  return {
    content: `${content.slice(0, MAX_PREFETCH_SECTION_CHARS)}\n\n[... truncated ...]`,
    contentTruncated: true,
  };
}

export class KnowledgeAccessService {
  private readonly search: LibrarySearchInteractor;
  private readonly index: CorpusIndexInteractor;

  constructor(
    private readonly repo: CorpusRepository,
    searchHandler?: SearchHandler,
    deps: KnowledgeAccessServiceDeps = {},
  ) {
    this.search = (deps.searchExecutor ?? new LibrarySearchInteractor(repo, searchHandler)) as LibrarySearchInteractor;
    this.index = (deps.indexExecutor ?? new CorpusIndexInteractor(repo)) as CorpusIndexInteractor;
  }

  async getSection(
    input: GetKnowledgeSectionInput,
    context?: Pick<ToolExecutionContext, "role">,
  ): Promise<GetSectionPayload> {
    const index = await this.index.execute(context?.role ? { role: context.role } : undefined);
    return this.loadStructuredSectionPayload(index, {
      documentSlug: input.documentSlug,
      sectionSlug: input.sectionSlug,
      role: context?.role,
    });
  }

  async searchKnowledge(
    input: SearchKnowledgeInput,
    context?: Pick<ToolExecutionContext, "role">,
  ): Promise<KnowledgeAccessResponse> {
    return toKnowledgeAccessResponse(await this.searchKnowledgePayload(input, context));
  }

  async searchKnowledgePayload(
    input: SearchKnowledgeInput,
    context?: Pick<ToolExecutionContext, "role">,
  ): Promise<SearchCorpusPayload> {
    const results = await this.search.execute({
      query: input.query,
      maxResults: Math.min(input.maxResults ?? 5, 15),
      role: context?.role,
    });
    const index = await this.index.execute(context?.role ? { role: context.role } : undefined);

    if (results.length === 0) {
      return {
        query: input.query,
        groundingState: "no_results",
        followUp: "refine_query",
        retrievalQuality: "none",
        results: [],
        prefetchedSection: null,
      };
    }

    const mappedResults = results.map((result) => buildSearchCorpusResultItem(result, index));
    const canPrefetch = context?.role && context.role !== "ANONYMOUS" && shouldPrefetchTopSection(results);

    if (!canPrefetch) {
      return {
        query: input.query,
        groundingState: "search_only",
        followUp: "call_get_section_before_detailed_claims",
        retrievalQuality: results[0]?.relevance === "high" ? "strong" : "partial",
        results: mappedResults,
        prefetchedSection: null,
      };
    }

    const top = mappedResults[0];
    const topBookSlug = top?.documentSlug;
    const topChapterSlug = top?.sectionSlug;

    if (!topBookSlug || !topChapterSlug) {
      return {
        query: input.query,
        groundingState: "search_only",
        followUp: "call_get_section_before_detailed_claims",
        retrievalQuality: results[0]?.relevance === "high" ? "strong" : "partial",
        results: mappedResults,
        prefetchedSection: null,
      };
    }

    const prefetchedSection = await this.loadStructuredSectionPayload(index, {
      documentSlug: topBookSlug,
      sectionSlug: topChapterSlug,
      role: context?.role,
    });

    if (!prefetchedSection.found) {
      return {
        query: input.query,
        groundingState: "search_only",
        followUp: "call_get_section_before_detailed_claims",
        retrievalQuality: results[0]?.relevance === "high" ? "strong" : "partial",
        results: mappedResults,
        prefetchedSection: null,
      };
    }

    return {
      query: input.query,
      groundingState: "prefetched_section",
      followUp: "cite_canonical_paths",
      retrievalQuality: results[0]?.relevance === "high" ? "strong" : "partial",
      results: mappedResults,
      prefetchedSection,
    };
  }

  private async loadStructuredSectionPayload(
    index: CorpusIndexEntry[],
    input: { documentSlug: string; sectionSlug: string; role?: RoleName },
  ): Promise<GetSectionPayload> {
    const reference = resolveCanonicalCorpusReference(index, input.documentSlug, input.sectionSlug);

    if (!reference.resolved || !reference.documentSlug || !reference.sectionSlug) {
      return createMissingSectionPayload(
        input.documentSlug,
        input.sectionSlug,
        reference.fallbackSearchPath,
        reference.fallbackSearchQuery,
      );
    }

    let section;
    try {
      section = await this.repo.getSection(reference.documentSlug, reference.sectionSlug);
    } catch (error) {
      void error;
      return createMissingSectionPayload(
        input.documentSlug,
        input.sectionSlug,
        reference.fallbackSearchPath,
        reference.fallbackSearchQuery,
      );
    }

    if (input.role && !canAccessAudience(section.audience, input.role)) {
      throw new ContentAccessDeniedError(
        `Access denied for section ${reference.documentSlug}/${reference.sectionSlug}`,
        section.audience,
      );
    }

    const [documents, sectionsByDocument] = await Promise.all([
      this.repo.getAllDocuments(),
      this.repo.getSectionsByDocument(reference.documentSlug),
    ]);
    const document = documents.find((candidate) => candidate.slug === reference.documentSlug);
    const accessibleSections = sectionsByDocument.filter(
      (candidate) => !input.role || canAccessAudience(candidate.audience, input.role),
    );
    const currentIndex = accessibleSections.findIndex(
      (candidate) => candidate.sectionSlug === reference.sectionSlug,
    );
    const previousSection = currentIndex > 0 ? accessibleSections[currentIndex - 1] : null;
    const nextSection = currentIndex >= 0 && currentIndex < accessibleSections.length - 1
      ? accessibleSections[currentIndex + 1]
      : null;
    const currentIndexEntry = index.find(
      (candidate) => candidate.documentSlug === reference.documentSlug && candidate.sectionSlug === reference.sectionSlug,
    );

    const documentId = document?.number ?? currentIndexEntry?.documentId ?? "";
    const documentTitle = document?.title ?? currentIndexEntry?.documentTitle ?? reference.documentSlug;
    const content = stripLeadingMarkdownTitle(section.title, section.content);
    const truncatedContent = truncateSectionContent(content);

    const navigation = {
      previous: previousSection
        ? buildCorpusLinkPayload({
          documentTitle,
          documentId,
          documentSlug: reference.documentSlug,
          sectionTitle: previousSection.title,
          sectionSlug: previousSection.sectionSlug,
        }, index)
        : null,
      next: nextSection
        ? buildCorpusLinkPayload({
          documentTitle,
          documentId,
          documentSlug: reference.documentSlug,
          sectionTitle: nextSection.title,
          sectionSlug: nextSection.sectionSlug,
        }, index)
        : null,
    };

    return {
      found: true,
      requestedDocumentSlug: input.documentSlug,
      requestedSectionSlug: input.sectionSlug,
      title: section.title,
      document: formatDocumentLabel(documentId, documentTitle),
      documentId,
      documentSlug: reference.documentSlug,
      sectionSlug: reference.sectionSlug,
      canonicalPath: reference.canonicalPath,
      resolverPath: reference.resolverPath,
      fallbackSearchPath: null,
      fallbackSearchQuery: null,
      content: truncatedContent.content,
      contentTruncated: truncatedContent.contentTruncated,
      resolvedFromAlias: reference.resolvedFromAlias,
      navigation,
      relatedSections: currentIndexEntry ? buildRelatedSections(index, currentIndexEntry) : [],
    };
  }
}