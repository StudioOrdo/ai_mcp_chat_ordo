import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";
import type { SearchHandler } from "@/core/search/ports/SearchHandler";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

export const CORPUS_BUNDLE = createCatalogBoundToolBundle(
  "corpus",
  "Corpus Tools",
);

export function registerCorpusTools(
  registry: ToolRegistry,
  deps: { corpusRepo: CorpusRepository; handler?: SearchHandler },
): void {
  const { corpusRepo, handler } = deps;
  registerCatalogBoundToolBundle(registry, "corpus", {
    corpusRepo,
    searchHandler: handler,
  }, (toolName, bundleDeps) => {
    if (toolName === "search_corpus") {
      return {
        corpusRepo: bundleDeps.corpusRepo,
        searchHandler: bundleDeps.searchHandler,
      };
    }

    return { corpusRepo: bundleDeps.corpusRepo };
  });
}
