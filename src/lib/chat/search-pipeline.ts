import { localEmbedder } from "@/adapters/LocalEmbedder";
import { getVectorStore } from "@/adapters/RepositoryFactory";
import { QueryProcessor } from "@/core/search/QueryProcessor";
import { LowercaseStep } from "@/core/search/query-steps/LowercaseStep";
import { StopwordStep } from "@/core/search/query-steps/StopwordStep";
import { SynonymStep } from "@/core/search/query-steps/SynonymStep";
import { HybridSearchEngine } from "@/core/search/HybridSearchEngine";
import {
  HybridSearchHandler,
  BM25SearchHandler,
  EmptyResultHandler,
} from "@/core/search/SearchHandlerChain";
import type { SearchHandler } from "@/core/search/ports/SearchHandler";
import { STOPWORDS } from "@/core/search/data/stopwords";
import { SYNONYMS } from "@/core/search/data/synonyms";
import { corpusConfig } from "@/lib/corpus-vocabulary";

export function getSearchHandler(): SearchHandler {
  const vectorStore = getVectorStore();

  const vectorProcessor = new QueryProcessor([
    new LowercaseStep(),
    new StopwordStep(STOPWORDS),
  ]);
  const bm25Processor = new QueryProcessor([
    new LowercaseStep(),
    new StopwordStep(STOPWORDS),
    new SynonymStep(SYNONYMS),
  ]);

  const engine = new HybridSearchEngine(
    localEmbedder, vectorStore,
    vectorProcessor, bm25Processor,
    { vectorTopN: 50, bm25TopN: 50, rrfK: 60, maxResults: 10 },
  );

  const hybrid = new HybridSearchHandler(engine, localEmbedder, corpusConfig.sourceType);
  const bm25 = new BM25SearchHandler(vectorStore, bm25Processor, corpusConfig.sourceType);
  const empty = new EmptyResultHandler();

  hybrid.setNext(bm25);
  bm25.setNext(empty);

  return hybrid;
}
