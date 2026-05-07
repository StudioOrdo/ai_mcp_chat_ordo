# Corpus, Research, Search, And Visibility

## UX Intent

Ordo should act like a librarian for the operator. It should find the right
context, respect access control, and use research to produce better work.

The public should not see "Library" as a default destination. Public content
belongs in Feed. Corpus/help/research belongs behind the agent, Studio, admin
training, or role-gated surfaces.

## Existing Code Evidence

Content access:

- `src/lib/access/content-access.ts`
- `src/core/entities/corpus.ts`
- `src/adapters/FileSystemCorpusRepository.ts`
- `src/app/admin/content-visibility/page.tsx`

Knowledge access and search:

- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/core/search/**`
- `src/adapters/SQLiteVectorStore.ts`
- `src/adapters/InMemoryVectorStore.ts`
- `src/adapters/SQLiteBM25IndexStore.ts`
- `src/adapters/InMemoryBM25IndexStore.ts`
- `src/lib/chat/retrieval-envelope.ts`
- `src/lib/corpus-library.ts`
- `src/lib/corpus-reference.ts`
- `src/lib/corpus-access.ts`

Corpus tools:

- `src/core/capability-catalog/families/corpus-capabilities.ts`
- `src/core/use-cases/tools/search-corpus.tool.ts`
- `src/core/use-cases/tools/get-section.tool.ts`
- `src/core/use-cases/tools/get-corpus-summary.tool.ts`
- `src/core/use-cases/tools/get-checklist.tool.ts`
- `src/core/use-cases/tools/list-practitioners.tool.ts`

Routes:

- `src/app/library/page.tsx`
- `src/app/library/[document]/page.tsx`
- `src/app/library/[document]/[section]/page.tsx`
- `src/app/admin/training/page.tsx`
- `src/app/admin/training/[bookSlug]/page.tsx`

Tests:

- `src/lib/access/content-access.test.ts`
- `src/lib/corpus-access.test.ts`
- `src/lib/corpus-library.test.ts`
- `src/lib/corpus-reference.test.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.test.ts`
- `src/adapters/InMemoryVectorStore.test.ts`
- `src/core/search/**.test.ts`
- `src/core/use-cases/tools/search-corpus.tool.test.ts`
- `src/core/use-cases/tools/get-section.tool.test.ts`

## Current Functionality

Content audience model:

- `public`
- `member`
- `account`
- `premium`
- `apprentice`
- `staff`
- `admin`

Access logic supports:

- role-based audience checks
- tier-aware premium access
- denied-audience reporting
- allowed-audience lists for retrieval
- corpus document and section audience labels
- vector search filtering by audience
- admin content visibility auditing

Search supports:

- markdown chunking
- conversation chunking
- embeddings
- BM25
- hybrid search
- reciprocal rank fusion
- query processing
- corpus indexing
- knowledge access service lookups

## UX Mapping

| Existing system | UX meaning | Surface |
| --- | --- | --- |
| Corpus tools | Librarian/research support | Chat/Studio |
| Public corpus content | Public help/source context | Chat/public only if intentionally linked |
| Account/premium/staff/admin corpus | Private or role-gated help | Chat/Admin training |
| Library routes | Corpus donor | Hide from public nav |
| Search/vector stores | Research engine | Hidden infrastructure |
| `ContentAudience` | Visibility model | Settings/details/admin |

## Product Requirements

1. Public Feed is not the corpus Library.
2. Chat retrieval must never include inaccessible audience content.
3. Role-gated help and developer docs should use `ContentAudience`.
4. Research outputs should preserve source packets or citations where possible.
5. Owner-safe web research should be added separately from admin web search.
6. Private content should reuse `ContentAudience` where role-based visibility is
   enough.
7. Person/account-specific private content may require explicit grants beyond
   `ContentAudience`.

## Gaps

- Public Library remains a route donor that should not be primary nav.
- Owner-safe web research is not fully shaped as a product workflow.
- Source pack/research packet objects exist as concepts but need a product read
  model.
- Private person/account content grants are not solved by role audience alone.

## Tests To Preserve Or Add

Existing:

- content access matrix tests
- retrieval envelope allowed-audience tests
- vector store audience filtering tests
- knowledge access denied section tests
- corpus search/get-section tests

Add:

- public visitor cannot retrieve account/premium/staff/admin content
- premium tier can retrieve premium content without gaining staff/admin content
- private content with role visibility is absent from Feed
- source packet links to resulting article/script/media provenance
- owner-safe web research stores source pack evidence
