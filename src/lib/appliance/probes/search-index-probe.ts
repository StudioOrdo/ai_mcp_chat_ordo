import {
  createProbeResult,
  type ApplianceHealthProbe,
} from "@/lib/appliance/health-types";

export interface SearchIndexHealthStats {
  sourceType: string;
  embeddingCount: number;
  bm25DocCount: number;
  bm25Stale: boolean;
}

export interface SearchIndexHealthReader {
  getStats(): SearchIndexHealthStats | null | Promise<SearchIndexHealthStats | null>;
}

export interface SearchIndexProbeOptions {
  reader?: SearchIndexHealthReader;
}

export function createSearchIndexProbe(options: SearchIndexProbeOptions = {}): ApplianceHealthProbe {
  return {
    component: "search",
    async run(context) {
      if (!options.reader) {
        return createProbeResult({
          component: "search",
          impact: "optional",
          status: "unknown",
          checkedAt: context.generatedAt,
          summary: "Search index health reader is not configured.",
          remediation: "Wire a SearchIndexHealthReader around vector/BM25 stats when search health should be reported.",
          metadata: {},
        });
      }

      const stats = await options.reader.getStats();
      if (!stats) {
        return createProbeResult({
          component: "search",
          impact: "optional",
          status: "unknown",
          checkedAt: context.generatedAt,
          summary: "Search index stats are unavailable.",
          remediation: "Verify vector and BM25 stores are initialized.",
          metadata: {},
        });
      }

      const degraded = stats.embeddingCount === 0 || stats.bm25Stale;
      return createProbeResult({
        component: "search",
        impact: "optional",
        status: degraded ? "degraded" : "healthy",
        checkedAt: context.generatedAt,
        summary: degraded
          ? "Search index stats indicate stale or empty indexes."
          : "Search index stats are available.",
        remediation: degraded ? "Run the search index rebuild process." : null,
        metadata: { ...stats },
        warnings: degraded ? ["Search index is stale or empty."] : [],
      });
    },
  };
}
