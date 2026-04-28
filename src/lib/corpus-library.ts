/**
 * Corpus Content Library — Pure Facade over Core Use Cases.
 */

import type { Document } from "../core/entities/corpus";
import { ContentAccessDeniedError } from "../core/entities/errors";
import type { RoleName } from "../core/entities/user";
import { getCorpusRepository } from "../adapters/RepositoryFactory";
import { LibrarySearchInteractor } from "../core/use-cases/LibrarySearchInteractor";
import { PractitionerInteractor } from "../core/use-cases/PractitionerInteractor";
import { ChecklistInteractor } from "../core/use-cases/ChecklistInteractor";
import { CorpusSummaryInteractor } from "../core/use-cases/CorpusSummaryInteractor";
import type { CorpusIndexEntry } from "../core/use-cases/CorpusIndexInteractor";
import { CorpusIndexInteractor } from "../core/use-cases/CorpusIndexInteractor";

import { ConsoleLogger } from "../adapters/ConsoleLogger";
import { ErrorHandler } from "../core/services/ErrorHandler";
import { LoggingDecorator } from "../core/common/LoggingDecorator";
import { resolveCorpusRole, type CorpusAccessOptions } from "./corpus-access";
import {
  KnowledgeAccessService,
  toLegacyCorpusSearchResults,
  toLegacyCorpusSection,
  type LegacyCorpusSearchResult,
} from "@/core/platform/knowledge-access/KnowledgeAccessService";

const logger = new ConsoleLogger();
const errorHandler = new ErrorHandler(logger);
const corpusRepository = getCorpusRepository();

const searchInteractor = new LoggingDecorator(
  new LibrarySearchInteractor(corpusRepository),
  "SearchCorpus"
);
const practitionerInteractor = new LoggingDecorator(
  new PractitionerInteractor(corpusRepository),
  "GetContributors"
);
const checklistInteractor = new LoggingDecorator(
  new ChecklistInteractor(corpusRepository),
  "GetSupplements"
);
const summaryInteractor = new LoggingDecorator(
  new CorpusSummaryInteractor(corpusRepository),
  "GetCorpusSummaries"
);
const indexInteractor = new LoggingDecorator(
  new CorpusIndexInteractor(corpusRepository),
  "GetCorpusIndex"
);
const knowledgeAccessService = new KnowledgeAccessService(corpusRepository, undefined, {
  searchExecutor: searchInteractor,
  indexExecutor: indexInteractor,
});

// ── Error-handling wrapper (TD-B F4) ──

function withErrorFallback<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  fallback: TReturn,
  method: string,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ContentAccessDeniedError) {
        throw error;
      }

      errorHandler.handle(error, { method });
      return fallback;
    }
  };
}

function getCacheKey(role?: RoleName): string {
  return role ?? "__raw";
}

async function getVisibleDocumentSlugs(role: RoleName): Promise<Set<string>> {
  const summaries = await summaryInteractor.execute({ role });
  return new Set(summaries.map((summary) => summary.slug));
}

export type { CorpusIndexEntry as ChapterIndex };

export const getDocuments = withErrorFallback(
  async (options?: CorpusAccessOptions) => {
    const role = resolveCorpusRole(options);
    const documents = await corpusRepository.getAllDocuments();

    if (!role) {
      return documents;
    }

    const visibleDocumentSlugs = await getVisibleDocumentSlugs(role);
    return documents.filter((document) => visibleDocumentSlugs.has(document.slug));
  },
  [] as Document[],
  "getDocuments",
);

export type SearchResult = LegacyCorpusSearchResult;

let cachedIndex: CorpusIndexEntry[] | null = null;
const cachedIndexByRole = new Map<string, CorpusIndexEntry[]>();

export const getCorpusIndex = withErrorFallback(
  async (options?: CorpusAccessOptions) => {
    const role = resolveCorpusRole(options);

    if (!role) {
      if (cachedIndex) return cachedIndex;
      cachedIndex = await indexInteractor.execute(undefined);
      return cachedIndex;
    }

    const key = getCacheKey(role);
    const cached = cachedIndexByRole.get(key);
    if (cached) {
      return cached;
    }

    const result = await indexInteractor.execute({ role });
    cachedIndexByRole.set(key, result);
    return result;
  },
  [] as CorpusIndexEntry[],
  "getCorpusIndex",
);

export const searchCorpus = withErrorFallback(
  async (query: string, maxResults: number = 10, options?: CorpusAccessOptions) => {
    const role = resolveCorpusRole(options);
    const response = await knowledgeAccessService.searchKnowledge(
      { query, maxResults },
      role ? { role } : undefined,
    );
    return toLegacyCorpusSearchResults(response);
  },
  [] as SearchResult[],
  "searchCorpus",
);

export const getSectionFull = withErrorFallback(
  async (documentSlug: string, sectionSlug: string, options?: CorpusAccessOptions) => {
    const role = resolveCorpusRole(options);
    const result = await knowledgeAccessService.getSection(
      { documentSlug, sectionSlug },
      role ? { role } : undefined,
    );
    return toLegacyCorpusSection(result);
  },
  null as { title: string; content: string; document: string; book: string } | null,
  "getSectionFull",
);

export const getChecklists = withErrorFallback(
  async (documentSlug?: string, options?: CorpusAccessOptions) => {
    const role = resolveCorpusRole(options);
    const results = await checklistInteractor.execute({ bookSlug: documentSlug, role });
    return results.map((result) => ({
      document: result.bookTitle,
      section: result.chapterTitle,
      items: result.items,
      book: result.bookTitle,
      chapter: result.chapterTitle,
    }));
  },
  [] as { document: string; section: string; items: string[]; book: string; chapter: string }[],
  "getChecklists",
);

export const getPractitioners = withErrorFallback(
  async (query?: string, options?: CorpusAccessOptions) => {
    const role = resolveCorpusRole(options);
    const results = await practitionerInteractor.execute({ query, role });
    return results.map((result) => ({
      name: result.name,
      documents: result.books.map((book) => `${book.number}. ${book.title}`),
      sections: result.chapters.map((chapter) => chapter.title),
      books: result.books.map((book) => `${book.number}. ${book.title}`),
      chapters: result.chapters.map((chapter) => chapter.title),
    }));
  },
  [] as { name: string; documents: string[]; sections: string[]; books: string[]; chapters: string[] }[],
  "getPractitioners",
);

export const getCorpusSummaries = withErrorFallback(
  async (options?: CorpusAccessOptions) => {
    const role = resolveCorpusRole(options);
    return summaryInteractor.execute(role ? { role } : undefined);
  },
  [] as Awaited<ReturnType<typeof summaryInteractor.execute>>,
  "getCorpusSummaries",
);