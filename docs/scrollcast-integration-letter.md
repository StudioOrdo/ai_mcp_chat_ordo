# On Turning Ordo Into a Scrolly Site Operator

**To:** Future me, and anyone who picks up ordoSite after me
**From:** A deep read of ordoSite against the goal of producing Scrollcast sites as artifacts
**Date:** April 24, 2026
**Status:** Architectural recommendation, not a sprint doc

---

## Why this letter exists

The working plan is:

1. Ordo becomes the operator that produces scrolly sites from course content.
2. An MCP tool lets external clients (Claude Desktop, an LMS, another agent, a TA) ask ordo to build a site.
3. Before the MCP tool, we want a handful of hand-authored examples that render well in the Scrollcast engine.

That plan is right, but "wire up an MCP build tool" is not the first thing to do. Ordo already has most of the machinery this needs, some of the machinery is weaker than it looks, and the order of work matters more than the work itself.

This letter documents what I found when I read the code, what that means for the Scrollcast integration, and the sequence of changes I am recommending before any MCP surface is exposed.

---

## What ordoSite already has (and what that means)

### 1. The deferred job system is the correct primitive

The job subsystem (`job_requests`, `job_events`, `deferred-job-worker`, `deferred-job-runtime`) is the single best-architected part of ordoSite. It already supports everything a site-build workflow needs:

- Named, cataloged capabilities with explicit input schemas
- Lease-based worker claim with automatic recovery of expired leases
- Progress phases reported to the UI
- A first-class `JobArtifactPolicy` (`retain | open_artifact | open_or_download`)
- Retry policy, failure classification (`policy | transient | canceled | terminal`), and automatic retry for transient failures only
- Per-capability role gating: `initiatorRoles`, `ownerViewerRoles`, `ownerActionRoles`, `globalViewerRoles`, `globalActionRoles`
- Full event log with replay-from-checkpoint support

**Implication:** Building a scrolly site from a bundle is a catalog entry, not new infrastructure. We add one `JobCapabilityDefinition`, write one worker handler, and the existing Journal workspace surfaces it. That is the smallest honest version of "ordo can build scrolly sites."

### 2. Hybrid RAG is ready to *generate* bundles, not just retrieve

`HybridSearchEngine` already does vector + BM25 retrieval with reciprocal rank fusion, and — critically — applies audience/class/rolePersona filtering **before ranking** so retrieval cannot surface chunks the caller cannot see. Chunk metadata already carries `documentSlug / sectionSlug / bookSlug / chapterSlug` and audience. The prompt control plane is versioned, rollback-capable, and has provenance tooling.

**Implication:** Ordo-generated scrolly sites (query → outline → bundle → build → artifact) are within reach using existing primitives. We do not need to invent a retrieval layer or a prompt system. We need to add two prompts (outline, bundle) under the control plane and one capability that orchestrates them.

### 3. The capability catalog is the right center of gravity

`CAPABILITY_CATALOG` is already the single source of truth for tool availability across web, MCP, and job surfaces. Schemas, roles, retry policies, recovery modes, progress phases — all live there. New behavior means new catalog entries, not new modules with their own conventions.

**Implication:** Every Scrollcast-related capability we add must be a catalog entry, with the same shape as existing entries. If the temptation arises to put something outside the catalog "just for the scrolly work," that is the wrong answer.

### 4. The Journal is the right UX surface

The Journal workspace already has STAFF/ADMIN gating, revision tracking, artifact storage (`blog_post_artifacts`), and a lifecycle (draft → review → approved → published). A "Scrolls" tab in the Journal that lists built sites, their source bundles, their revisions, and who triggered each build is a small extension, not a new workspace. We should not create a parallel admin area for Scrollcast.

---

## What is weaker than it looks

### 1. MCP bypasses RBAC

This is the single most important finding in this letter. The MCP servers (`operations-server`, `admin-web-search-server`, `calculator-server`) do not authenticate callers. The capability catalog declares `roles: ["ADMIN"]` on sensitive tools, but nothing at the MCP boundary enforces those declarations. The web API enforces role checks because it calls `getSessionUser()` before dispatching; an MCP client is trusted by virtue of being able to connect over stdio.

Today that is acceptable because the only MCP callers are local developer tools. **It is not acceptable for a `scrollcast_build_site` tool exposed to external agents.** A site builder is a privileged operation — it consumes resources, produces artifacts bound to our domain, and in the `scrollcast_draft_from_query` variant reads from audience-filtered content that a caller may not be entitled to see.

**Required before MCP exposure:** an MCP auth layer that resolves caller identity (bearer token → user/role lookup), filters the `toolRegistry` per-caller in `ListTools`, and rejects unauthorized `CallTool` invocations. This is standard MCP practice; we have delayed it because there was no need. There is a need now.

### 2. Catalog has no runtime validation

The catalog is canonical, but nothing validates it at load time beyond TypeScript's structural checks. A malformed capability (missing input schema, impossible role set, invalid retry policy) would be discovered at runtime when the tool is invoked, sometimes in a worker, sometimes on a user request. As we add Scrollcast-related capabilities, we should add a catalog validator that runs at startup and at test time, with a golden test per capability covering load, list, and basic invocation.

### 3. Authorization decisions are not audited

Runtime audit logs exist (`runtime-audit-log.ts`) but are scoped to deferred jobs, native processes, remote services, and MCP processes — not to access-control decisions. Today we cannot answer "which users have been denied which content" from the logs. For a course product that will eventually face accreditation review, this is a gap worth closing before it becomes load-bearing.

### 4. Jobs poll; no subscription

The web UI polls `/api/jobs/{jobId}` at ~2s intervals. That is fine for builds that take seconds to a few minutes. When scrolly builds grow to include image generation, TTS, or deploy steps, polling will feel slow and will double our DB load. A Server-Sent Events stream over the existing `job_events` table would be a small, low-risk upgrade.

### 5. Embeddings can drift silently

The embedding model is pinned to `all-MiniLM-L6-v2@1.0` at build time. If it is ever updated, all stored embeddings become stale relative to new queries, and neither ingestion nor search raises an alarm. `rebuild_index` exists but must be invoked manually. A model-version check in `searchSimilar` that warns when query-embedding model and stored-embedding model diverge would prevent a hard-to-diagnose future bug.

### 6. The Journal conflates three things

`blog_posts`, `blog_post_revisions`, `blog_post_artifacts`, `job_requests`, `job_events` together implement (a) a blog editor, (b) a job execution log, and (c) an artifact store. The layering works today because the same people use all three. When Scrollcast enters, the artifact concept needs a slight cleanup: a scrolly site is not a blog post, even though it has revisions and artifacts. We should either generalize `blog_post_*` into a `publication_*` family or add a parallel `site_*` set of tables. I recommend the former.

---

## The changes I recommend, in order

I am writing these as phases, not sprints. Each phase is small enough to be one or two sprint docs under `docs/_specs/`. I am not prescribing implementation details — those belong in specs.

### Phase 0 — Groundwork (days, not weeks)

These are small, independent, and should land before any Scrollcast-specific work.

1. **Add a catalog validator.** Validate the `CAPABILITY_CATALOG` at startup and in tests. Fail loudly on malformed entries.
2. **Log authorization outcomes.** Add `access_granted` / `access_denied` entries to the runtime audit log from `canUserAccessAudience` and the route-level role checks. Keep the audience, role, tier, and resource identifier in the payload.
3. **Add an embedding-version check in search.** When a query is embedded with model version X and retrieved records have version Y, log a warning and emit a metric. Do not fail the query.

None of these require Scrollcast. All of them make the platform safer for everything that follows.

### Phase 1 — Publications table cleanup

Rename or generalize the Journal's `blog_post_*` tables into a `publication_*` family with a `publication_type` discriminator (`blog_post | scrolly_site | ...`). Keep revisions and artifacts attached. Migrate existing rows. This lets a scrolly site live alongside blog posts in the Journal without either one carrying special-case logic.

This is boring, schema-migration work. Do it before adding Scrollcast so we never have a moment where Scrollcast sites are second-class citizens.

### Phase 2 — `scrollcast_build_site` capability, web-triggered only

Add one capability:

- **Name:** `scrollcast_build_site`
- **Family:** `build`
- **Execution principal:** `system`
- **Initiator roles:** `["STAFF", "ADMIN"]`
- **Artifact policy:** `open_artifact`
- **Retry policy:** `manual_only`
- **Recovery mode:** none — builds are cheap, re-run from scratch

Input: a bundle reference (path to a directory of markdown + assets, or an inline bundle id). Output: artifact URL to the built `out/` tree served as a static site under our domain. Trigger: an admin form in the Journal workspace. No MCP exposure in this phase.

The worker delegates to Scrollcast's build entrypoint (imported from the Scrollcast package once it is extracted from the `testing/` repo). The worker does not deploy — it builds and serves. Deploy is a separate concern and should be a separate capability when we need it.

At the end of this phase, STAFF can drop a hand-authored Scrollcast bundle into the system and get back a URL. That is sufficient to render the four example sites we discussed (AI history era, corpus chapter, paper summary, design-system lifecycle) on real ordo infrastructure. No orphan repos.

### Phase 3 — MCP auth, finally

Before any MCP surface is exposed for Scrollcast:

1. Add a bearer-token mechanism to the MCP servers. Map tokens to users and roles.
2. In `operations-server.ts`, filter the `toolRegistry` per-caller in `ListTools`. Reject unauthorized `CallTool` invocations with a clear error.
3. Add audit log entries for every MCP tool invocation, whether permitted or denied.

This phase stands on its own. It is worth doing even if the Scrollcast plan is deferred, because every existing MCP tool is currently governed only by convention.

### Phase 4 — Expose `scrollcast_build_site` over MCP

With Phase 3 in place, add `mcpExport: true` to the capability and verify the MCP boundary honors the initiator roles. External agents can now queue builds with proper governance.

### Phase 5 — `scrollcast_draft_from_query`

This is the interesting capability. Input: a natural-language brief plus an audience and a source filter (book, chapter, era, etc.). Pipeline:

1. Hybrid search (audience-filtered) to retrieve relevant chunks.
2. Versioned outline prompt → structured outline document, stored for review.
3. Versioned bundle prompt → Scrollcast markdown DSL, stored as a draft publication.
4. Queued `scrollcast_build_site` invocation on the draft.

Output: an artifact URL plus the outline plus the draft bundle, all attached to a Journal publication. A human reviewer can edit the bundle and rebuild without regenerating — we store the generated bundle as a first-class artifact, not a throwaway.

This is the capability that makes the whole project worth the investment. Phase 2 alone is a nice admin tool. Phase 5 is a product.

### Phase 6 — Subscription and metrics (optional, when pain is real)

When polling becomes visibly slow or costly, add an SSE endpoint over `job_events`. Add metrics for queue depth, build duration, retry rates. Neither is urgent until we are running more than a handful of builds per day.

---

## What I would not do

Some ideas I considered and want to name explicitly as *not* recommended:

1. **A separate "Scrollcast workspace" in ordo.** Use the Journal. Generalize the tables if needed.
2. **A dedicated MCP server just for Scrollcast.** Use `operations-server`. The catalog already routes.
3. **A queue other than the existing SQLite-backed one.** Not until horizontal scale is a real, measured problem.
4. **A build cache keyed on content hash.** Premature. Revisit after Phase 5.
5. **A scrolly-specific embedding index.** The existing index already has the metadata needed to filter by source type, audience, and slug. Re-use.
6. **Exposing build to students in any form.** Not yet. STAFF initiators only until we have seen many builds succeed and know the attack surface.

---

## How this connects to scrolly and nextjs_ai_orchestration_*

The scrolly repo will continue to exist as a student-facing guide. Its `docs/guide/03-working-with-ai.md` is the pedagogy statement, and the research citations there make it the single best artifact I have for explaining *why* ordo is built the way it is. When Phase 5 lands, one of the first generated sites should be a scrolly rendering of `03-working-with-ai` driven by the ordoSite corpus chapters it derives from (`ch05-audit-to-sprint-loop`, `ch04-named-frameworks`, `ch06-12-factor`, `ch07-gof`, `ch08-observability`). That closes a loop: the guide cites the research, ordo renders the guide, the rendering is itself evidence that the method works.

The `nextjs_ai_orchestration_spec_sprint_process` repo is the executed-example course artifact. Its AI history museum content is the best candidate for the Phase 2 hand-authored example — the content is already structured, the audience value is highest, and it will stress the engine on the right axes (timeline, people, concepts). Once Phase 5 is real, the museum content should be re-ingested into ordo's corpus and re-rendered via the generator to prove the pipeline can match hand-authored quality.

---

## One standing instruction to future me

**Do not expose a scrolly builder over MCP before Phase 3.** Every other corner can be cut. That one cannot. If the plan slips, let it slip on Phase 5. Phase 3 is load-bearing for every MCP tool we already have, not just the new one.

---

*End of letter. If you disagree with any of this, the place to argue it is a feature spec under `docs/_specs/`, not a comment on this file.*
