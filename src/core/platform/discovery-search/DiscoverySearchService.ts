import type { User as SessionUser } from "@/core/entities/user";
import type { ContentAudience } from "@/lib/access/content-access";
import { searchAdminEntities, type AdminSearchResult } from "@/lib/admin/search/admin-search";
import { getCorpusSummaries, searchCorpus } from "@/lib/corpus-library";
import type { CorpusSummary } from "@/core/use-cases/CorpusSummaryInteractor";
import { resolveCommandRoutes, type ShellRouteDefinition } from "@/lib/shell/shell-navigation";

export interface DiscoverySearchResult {
  kind: "route" | "document" | "section" | "admin-entity";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  audience: ContentAudience | "route";
  source: "shell" | "corpus" | "admin";
  updatedAt?: string;
  entityType?: AdminSearchResult["entityType"];
}

export interface DiscoverySearchContext {
  id: string;
  roles: SessionUser["roles"];
}

export interface DiscoverySearchRequest {
  query: string;
  userId?: string;
  roles: SessionUser["roles"];
  maxResults?: number;
}

export interface DiscoverySearchResponse {
  query: string;
  results: readonly DiscoverySearchResult[];
}

function mapRouteResult(route: ShellRouteDefinition): DiscoverySearchResult {
  return {
    kind: "route",
    id: route.id,
    title: route.label,
    subtitle: route.description ?? route.href,
    href: route.href,
    audience: "route",
    source: "shell",
  };
}

function mapAdminResult(result: AdminSearchResult): DiscoverySearchResult {
  return {
    kind: "admin-entity",
    id: `${result.entityType}:${result.id}`,
    title: result.title,
    subtitle: result.subtitle,
    href: result.href,
    audience: "admin",
    source: "admin",
    updatedAt: result.updatedAt,
    entityType: result.entityType,
  };
}

function mapCorpusDocumentResult(summary: CorpusSummary): DiscoverySearchResult {
  return {
    kind: "document",
    id: summary.id,
    title: summary.title,
    subtitle: summary.number ? `${summary.number} · ${summary.sectionCount} sections` : `${summary.sectionCount} sections`,
    href: `/library/${summary.slug}`,
    audience: summary.audience,
    source: "corpus",
  };
}

function mapCorpusSectionResult(result: Awaited<ReturnType<typeof searchCorpus>>[number]): DiscoverySearchResult {
  return {
    kind: "section",
    id: `${result.documentSlug}/${result.sectionSlug}`,
    title: result.section,
    subtitle: `${result.document} · ${result.matchContext}`,
    href: `/library/${result.documentSlug}/${result.sectionSlug}`,
    audience: "public",
    source: "corpus",
  };
}

function getResultRank(result: DiscoverySearchResult, loweredQuery: string): number {
  const title = result.title.toLowerCase();
  const subtitle = result.subtitle.toLowerCase();
  const href = result.href.toLowerCase();

  if (result.kind === "route") {
    if (title === loweredQuery || href === loweredQuery) return 0;
    if (title.startsWith(loweredQuery) || href.includes(loweredQuery)) return 1;
    return 2;
  }

  if (result.kind === "section") {
    if (title === loweredQuery) return 10;
    if (title.startsWith(loweredQuery)) return 11;
    if (subtitle.includes(loweredQuery)) return 12;
    return 13;
  }

  if (result.kind === "document") {
    if (title === loweredQuery) return 20;
    if (title.startsWith(loweredQuery)) return 21;
    if (subtitle.includes(loweredQuery)) return 22;
    return 23;
  }

  if (title === loweredQuery) return 30;
  if (title.startsWith(loweredQuery)) return 31;
  if (subtitle.includes(loweredQuery)) return 32;
  return 33;
}

export class DiscoverySearchService {
  async searchDiscovery(request: DiscoverySearchRequest): Promise<DiscoverySearchResponse> {
    const trimmed = request.query.trim();
    if (trimmed.length < 2) {
      return {
        query: request.query,
        results: [],
      };
    }

    const lowered = trimmed.toLowerCase();
    const shellRoutes = resolveCommandRoutes({ roles: [...request.roles] as SessionUser["roles"] })
      .filter(
        (route) =>
          route.label.toLowerCase().includes(lowered)
          || route.href.toLowerCase().includes(lowered)
          || route.description?.toLowerCase().includes(lowered),
      )
      .map(mapRouteResult);

    const corpusOptions = { role: request.roles[0] ?? "ANONYMOUS" };
    const [corpusDocuments, corpusSections] = await Promise.all([
      getCorpusSummaries(corpusOptions),
      searchCorpus(trimmed, 10, corpusOptions),
    ]);

    const corpusDocumentResults = corpusDocuments
      .filter(
        (summary) =>
          summary.title.toLowerCase().includes(lowered)
          || summary.slug.toLowerCase().includes(lowered)
          || summary.sections.some((section) => section.toLowerCase().includes(lowered)),
      )
      .map(mapCorpusDocumentResult);

    const corpusSectionResults = corpusSections.map(mapCorpusSectionResult);

    const adminResults = request.roles.includes("ADMIN")
      ? (await searchAdminEntities(trimmed, { limit: 10 })).map(mapAdminResult)
      : [];

    const rankedResults = [...shellRoutes, ...corpusDocumentResults, ...corpusSectionResults, ...adminResults]
      .map((result) => ({ result, rank: getResultRank(result, lowered) }))
      .sort((left, right) => left.rank - right.rank);

    const deduped = new Map<string, DiscoverySearchResult>();
    for (const { result } of rankedResults) {
      deduped.set(`${result.kind}:${result.href}`, result);
    }

    return {
      query: request.query,
      results: Array.from(deduped.values()).slice(0, request.maxResults ?? 20),
    };
  }

  async search(query: string, context: DiscoverySearchContext): Promise<DiscoverySearchResult[]> {
    const response = await this.searchDiscovery({
      query,
      userId: context.id,
      roles: context.roles,
    });

    return [...response.results];
  }
}