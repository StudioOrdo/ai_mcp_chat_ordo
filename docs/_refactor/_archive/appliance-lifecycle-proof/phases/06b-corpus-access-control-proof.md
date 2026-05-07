# Phase 06B - Corpus Access Control Proof

Status: Planned

## Goal

Prove that role-gated documentation is enforced across every way content can be
discovered or read.

This phase is the first serious test of Ordo content access controls as product
infrastructure.

## Current Code Grounding

- `src/lib/access/content-access.ts`
  - maps audiences to roles.
- `src/lib/corpus-access.ts`
  - resolves viewer role for library routes and handles denied access.
- `src/lib/corpus-library.ts`
  - passes role into corpus summaries, search, index, and section retrieval.
- `src/core/use-cases/LibrarySearchInteractor.ts`
  - filters search results by visible sections.
- `src/core/use-cases/CorpusIndexInteractor.ts`
  - filters index entries by visible sections.
- `src/core/use-cases/CorpusSummaryInteractor.ts`
  - hides documents with no visible sections.
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
  - filters search, section fetch, and related sections.
- `src/app/library/[document]/[section]/page.tsx`
  - uses viewer role and handles `ContentAccessDeniedError`.
- `src/app/library/section/[slug]/page.tsx`
  - checks the role-filtered index before falling back to raw index for deny
    vs not-found resolution.
- `src/adapters/InMemoryVectorStore.ts` and `src/adapters/SQLiteVectorStore.ts`
  - support audience metadata filtering for vector records.

## Required Proof

The same hidden content must be unavailable through:

- `/library`
- `/library/[document]`
- `/library/[document]/[section]`
- `/library/section/[slug]`
- `get_corpus_summary`
- `search_corpus`
- `get_section`
- related sections returned by `get_section`
- search/vector results
- assistant citations and action links

## SOLID/Clean/GOF Notes

- Keep access policy in `content-access`.
- Keep corpus retrieval policy in corpus interactors and
  `KnowledgeAccessService`.
- Do not duplicate audience checks in render components except for defensive UI
  hiding.
- Route handlers and tools should be adapters around the same policy.

## Positive Use Cases

- Admin can search and open admin lifecycle runbooks.
- Staff can search and open staff support docs.
- Authenticated user can search owner-facing help.
- Anonymous user can search public docs.

## Negative Use Cases

- Anonymous direct link to an admin section redirects or denies.
- Authenticated non-admin cannot retrieve an admin section through `get_section`.
- Search does not return snippets from inaccessible chapters.
- Related sections do not include inaccessible chapters.

## Edge Use Cases

- Vector index contains stale chunks for content that later becomes admin-only.
- A public book contains hidden admin chapters.
- A hidden book has no visible chapters for a role.
- A role is simulated or downgraded in a session.

## Exit Criteria

- Tests cover route, tool, summary, search, section, and vector filtering.
- No lower-role test can discover protected title, snippet, slug, or citation.
- Denied direct routes do not reveal whether protected content exists beyond
  the current intended redirect/not-found behavior.
