import type { ToolCommand } from "../ToolCommand";
import type { CorpusRepository } from "../CorpusRepository";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { SearchHandler } from "@/core/search/ports/SearchHandler";
import { corpusConfig } from "@/lib/corpus-vocabulary";
import {
  KnowledgeAccessService,
  type GetSectionPayload,
  type SearchCorpusPayload,
} from "@/core/platform/knowledge-access/KnowledgeAccessService";
import { ChecklistInteractor } from "../ChecklistInteractor";
import { PractitionerInteractor } from "../PractitionerInteractor";
import { CorpusSummaryInteractor } from "../CorpusSummaryInteractor";

export type { GetSectionPayload, SearchCorpusPayload } from "@/core/platform/knowledge-access/KnowledgeAccessService";

export class SearchCorpusCommand implements ToolCommand<{ query: string; max_results?: number }, unknown> {
  private readonly knowledgeAccess: KnowledgeAccessService;

  constructor(repo: CorpusRepository, searchHandler?: SearchHandler) {
    this.knowledgeAccess = new KnowledgeAccessService(repo, searchHandler);
  }

  async execute({ query, max_results = 5 }: { query: string; max_results?: number }, context?: ToolExecutionContext) {
    return this.knowledgeAccess.searchKnowledgePayload({
      query,
      maxResults: max_results,
    }, context);
  }
}

export class GetSectionCommand implements ToolCommand<{ document_slug: string; section_slug: string }, GetSectionPayload> {
  private readonly knowledgeAccess: KnowledgeAccessService;

  constructor(repo: CorpusRepository) {
    this.knowledgeAccess = new KnowledgeAccessService(repo);
  }

  async execute({ document_slug, section_slug }: { document_slug: string; section_slug: string }, context?: ToolExecutionContext) {
    return this.knowledgeAccess.getSection({
      documentSlug: document_slug,
      sectionSlug: section_slug,
    }, context);
  }
}

export class GetChecklistCommand implements ToolCommand<{ book_slug?: string }, string> {
  private readonly checklists: ChecklistInteractor;

  constructor(repo: CorpusRepository) {
    this.checklists = new ChecklistInteractor(repo);
  }

  async execute({ book_slug }: { book_slug?: string }, context?: ToolExecutionContext) {
    const results = await this.checklists.execute({ bookSlug: book_slug, role: context?.role });
    if (results.length === 0) return "No checklists found.";

    return results
      .map((checklist) => `## ${checklist.bookTitle} — ${checklist.chapterTitle}\n${checklist.items.map((item) => `- ${item}`).join("\n")}`)
      .join("\n\n");
  }
}

export class ListPractitionersCommand implements ToolCommand<{ query?: string }, string> {
  private readonly practitioners: PractitionerInteractor;

  constructor(repo: CorpusRepository) {
    this.practitioners = new PractitionerInteractor(repo);
  }

  async execute({ query }: { query?: string }, context?: ToolExecutionContext) {
    const results = await this.practitioners.execute({ query, role: context?.role });
    if (results.length === 0) return "No practitioners found.";

    return results
      .slice(0, 30)
      .map((practitioner) => `**${practitioner.name}** — appears in ${practitioner.books.map((book) => `${book.number}. ${book.title}`).join(", ")} (${practitioner.chapters.map((chapter) => chapter.title).join("; ")})`)
      .join("\n");
  }
}

export class GetCorpusSummaryCommand implements ToolCommand<Record<string, never>, string> {
  private readonly summaries: CorpusSummaryInteractor;

  constructor(repo: CorpusRepository) {
    this.summaries = new CorpusSummaryInteractor(repo);
  }

  async execute(_input: Record<string, never>, context?: ToolExecutionContext) {
    const results = await this.summaries.execute({ role: context?.role });
    return results.map((summary) => {
      const sections = summary.chapters ?? summary.sections;
      const sectionSlugs = summary.chapterSlugs ?? summary.sectionSlugs;
      const sectionList = sections.map((title, index) => {
        const slug = sectionSlugs?.[index];
        return slug ? `- ${title} (slug: \`${slug}\`)` : `- ${title}`;
      }).join("\n");
      const sectionCount = summary.chapterCount ?? summary.sectionCount;
      return `### ${corpusConfig.documentLabel} ${summary.number}: ${summary.title} (document_slug: \`${summary.slug}\`)\n${sectionCount} ${corpusConfig.sectionLabelPlural}:\n${sectionList}`;
    }).join("\n\n");
  }
}