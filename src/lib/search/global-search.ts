import type { User as SessionUser } from "@/core/entities/user";
import type { DiscoverySearchResult, DiscoverySearchContext } from "@/core/platform/discovery-search/DiscoverySearchService";
import { getDiscoverySearchService } from "@/lib/platform/content-platform-root";

export type GlobalSearchResult = DiscoverySearchResult;

export type GlobalSearchAction = (formData: FormData) => Promise<GlobalSearchResult[]>;

interface GlobalSearchContext {
  id: string;
  roles: SessionUser["roles"];
}

export async function searchGlobalEntities(
  query: string,
  context: GlobalSearchContext,
): Promise<GlobalSearchResult[]> {
  const response = await getDiscoverySearchService().searchDiscovery({
    query,
    userId: context.id,
    roles: context.roles,
  });

  return [...response.results];
}