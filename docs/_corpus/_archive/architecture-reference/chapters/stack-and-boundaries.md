---
title: Stack and boundaries
audience: staff
class: reference
---

The stack is deliberately small.

- **Runtime.** Next.js App Router with server actions and streamed
  chat responses. No separate backend service.
- **Storage.** SQLite for relational state (users, conversations,
  jobs, prompts, preferences). Filesystem corpus for editorial
  content. Object storage for user-uploaded media.
- **Vector search.** A local embedder plus `SQLiteVectorStore` or
  the in-memory store for tests. No external vector database.
- **Workers.** A single deferred-job worker polling the job queue
  table. Media and long-running tool work flows through it.
- **Clients.** Browser and server both share the same capability
  catalog projection, so a capability described on the server
  resolves to the same renderer on the client.

Boundaries to respect.

- **Hotspots are load-bearing.** `deferred-job-worker.ts`,
  `runtime-tool-binding.ts`, and `search-my-conversations.tool.ts`
  are explicitly out of scope for refactor. They move slowly and on
  purpose.
- **Tier writes go through one seam.** `setAccountTier` is the only
  path that writes the `account_tier` preference. The
  `set_preference` tool refuses the key.
- **Install has one boundary.** The 3-step wizard at `/install`
  redirects to `/welcome` on completion. Everything after that is a
  conversation, not a new page.
- **Content has one audience model.** `canUserAccessAudience`
  decides reads; vector-layer `allowedAudiences` narrows retrieval;
  `class` is zoning, never RBAC.

If a change would cross one of those boundaries, it is probably a
new phase, not a patch.
