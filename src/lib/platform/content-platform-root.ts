import { getCorpusRepository } from "@/adapters/RepositoryFactory";
import { DiscoverySearchService } from "@/core/platform/discovery-search/DiscoverySearchService";
import { KnowledgeAccessService } from "@/core/platform/knowledge-access/KnowledgeAccessService";

let discoverySearchService: DiscoverySearchService | null = null;
let knowledgeAccessService: KnowledgeAccessService | null = null;

export function getDiscoverySearchService(): DiscoverySearchService {
  if (!discoverySearchService) {
    discoverySearchService = new DiscoverySearchService();
  }

  return discoverySearchService;
}

export function getKnowledgeAccessService(): KnowledgeAccessService {
  if (!knowledgeAccessService) {
    knowledgeAccessService = new KnowledgeAccessService(getCorpusRepository());
  }

  return knowledgeAccessService;
}