---
title: System overview
audience: staff
class: reference
---

Studio Ordo runs as a single Next.js application with a SQLite
database, a filesystem corpus under `docs/_corpus`, and a deferred-job
worker for long-running media and search work. Everything else —
capabilities, tools, lifecycle, coach, retrieval — is composed from
those four pieces.

Four seams matter when reasoning about the system.

1. **The corpus.** `docs/_corpus/<slug>/book.json` plus
   `docs/_corpus/<slug>/chapters/*.md`. Audience, class, and role
   persona are authored in frontmatter. `FileSystemCorpusRepository`
   reads them; `scripts/build-search-index.ts` turns them into
   chunked vectors.
2. **Retrieval.** `HybridSearchEngine` narrows candidates by
   `allowedAudiences`, `classes`, and `rolePersonas` before ranking.
   `LibrarySearchInteractor` keeps a post-retrieval
   `canUserAccessAudience` check as defense-in-depth.
3. **Capabilities.** `CAPABILITY_CATALOG` on the server and
   `CLIENT_CAPABILITY_CATALOG` on the client both register every
   tool. The registry is the source of truth for presentation,
   RBAC, and progress contracts.
4. **System envelopes.** Lifecycle and coach cards ride on
   `ChatMessage.metadata.lifecycle` and `ChatMessage.metadata.coach`,
   forwarded by `ChatPresenter.present()`. They are NOT registered
   in the catalog. This is the F7 contract.

If you need to reason about a runtime behavior, start at the
capability descriptor for the tool that produced it, then follow the
envelope back through the presenter to the renderer. That trail is
always complete.
