# Phase 05: Asset Catalog And Reusable Outputs

## Objective

Create a canonical asset-catalog query surface for conversation restore,
compose, and later memory/search phases so the system can answer asset
questions without scattering that logic across `user_files`, `blog_assets`,
materialization lookups, tool-specific projections, and transcript-era alias
heuristics.

The brutal current truth is:

- binary persistence already exists and works through `user_files`
- generated reuse identity now exists through the Phase 04 materialization
  registry
- restore can already project conversation-scoped materialized assets into the
  workspace
- blog images are durable assets, but they still live in a separate store and
  are manually merged into reusable-media results
- asset discovery rules are duplicated across restore, tooling, and
  composition-specific helper code
- there is still no single asset catalog query that owns "what reusable assets
  exist, why do they exist, what produced them, what are they derived from, and
  which ones should be shown first?"

Phase 05 is therefore not a storage rewrite. It is the phase that must promote
asset identity and lineage into a clean read model so higher layers stop doing
table-by-table assembly and stop depending on tool-specific projection helpers
for canonical answers.

## Source Specs

- [../jobs-assets-materialization-spec.md](../jobs-assets-materialization-spec.md)
- [../domain-model-spec.md](../domain-model-spec.md)
- [../target-architecture.md](../target-architecture.md)
- [../validation-strategy.md](../validation-strategy.md)
- [../test-infrastructure-and-evidence.md](../test-infrastructure-and-evidence.md)
- [phase-01-canonical-domain-contracts.md](phase-01-canonical-domain-contracts.md)
- [phase-02-workspace-snapshot-projection.md](phase-02-workspace-snapshot-projection.md)
- [phase-03-restore-read-model-and-idempotent-homepage.md](phase-03-restore-read-model-and-idempotent-homepage.md)
- [phase-04-job-ledger-and-materialization-registry.md](phase-04-job-ledger-and-materialization-registry.md)

## Phase 04 Handoff

Phase 04 established two durable truths that Phase 05 must preserve:

- job lifecycle belongs to the job ledger, not to asset rows
- reusable completed outputs belong to the materialization registry, not to
  transcript scans or browser runtime caches

Phase 05 must build on those truths rather than collapsing them back together.

That means:

- `user_files` remains the durable file record and binary-storage pointer for
  user-owned assets
- `blog_assets` remains the durable record for blog-image assets until a later
  migration explicitly changes that storage model
- `materialization_records` remains the authority for reusable-success lineage
  and produced-by-job linkage
- the new asset catalog becomes a read/query surface over those authorities,
  not a replacement for them

## Future Platform Substrate

Phase 05 is the first conversation-package phase that clearly feeds the broader
platform work recorded later in Phase 12.

The asset catalog should therefore be designed as a reusable substrate, not as a
chat-only convenience layer.

Later platform packages may introduce broader abstractions such as:

- nodes or other governed content/work identities
- structured mixed-media documents
- workflow composition and template packs
- audience-specific projections and business templates

Phase 05 should support those future abstractions by establishing stable asset
identity, lineage, reuse, and query seams now.

Phase 05 should not try to introduce those broader abstractions directly.

Explicit rule: this phase makes assets ready to be consumed by future node,
document, workflow, template, and projection models, but it does not define
those models.

Out of scope for Phase 05:

- a shared `Node` kernel
- a publishable `DocumentRevision` or document AST beyond current asset-facing
  contracts
- generalized workflow composition
- prompt-driven business templates
- operational scheduling or work-order models

Those belong to the next batch planned in Phase 11 and researched in Phase 12.

## Current Codebase Grounding

The codebase already contains the raw ingredients of an asset catalog, but they
are split across unrelated layers.

### Durable Asset State That Already Exists

| Surface | Current behavior | Phase 05 implication |
| --- | --- | --- |
| `src/adapters/UserFileDataMapper.ts` | `user_files` stores uploaded and generated file records with `status`, `fileType`, `metadata_json`, `conversation_id`, and user ownership. | Keep this as the durable file-record authority for `uf_*` assets. Do not replace it with a catalog table that duplicates binary storage metadata. |
| `src/lib/user-files.ts` | `UserFileSystem` owns file-system writes, content hashing, pending allocation, quota-aware batch create, and unattached cleanup. | Binary storage concerns stay here. Phase 05 must not turn the asset catalog into a storage service. |
| `src/app/api/chat/uploads/route.ts` | Uploads classify files, extract metadata, persist through `UserFileSystem`, and return attachment descriptors. | Upload flow already creates durable asset rows. Phase 05 should route those rows into canonical catalog queries, not reimplement upload persistence. |
| `src/adapters/BlogAssetDataMapper.ts` | `blog_assets` stores durable `blogasset_*` hero images with visibility and selection metadata. | Blog assets already participate in durable output identity and must be queryable through the same catalog surface even if they remain in a separate table initially. |
| `src/adapters/MaterializationDataMapper.ts` | Materialization records now store reusable outputs, output refs, conversation-scoped aliases, and produced-by-job lineage. | Phase 05 should consume this registry as lineage authority instead of bolting reuse details onto `user_files.metadata`. |

### Read Models And Tooling That Already Touch Assets

| Surface | Current behavior | Phase 05 implication |
| --- | --- | --- |
| `src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts` | Restore loads `user_files`, unions in files referenced by conversation-scoped materializations, and looks up materializations by asset id. | This proves the catalog query can be built without transcript scans, but the reader is still doing asset-assembly work inline. |
| `src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.ts` | Projects `importantAssetRefs` by converting `UserFile` rows into asset refs and enriching them with materialization lineage. | Good projector pattern. Phase 05 should extend this style into a dedicated asset catalog reader/projector rather than keeping restore-specific asset assembly in the workspace reader. |
| `src/core/use-cases/tools/list-conversation-media-assets.tool.ts` | Lists reusable media by calling `userFileRepository.listByConversation(...)`, then separately calls `blogAssetRepository.listByUser(...)`, manually projects both, merges, dedupes, sorts, and limits. | This is the clearest sign the catalog is missing. The tool is acting like an application-service/query layer and a cross-store merger at the same time. |
| `src/lib/media/media-asset-projection.ts` | Contains user-file projection helpers that infer asset kind, source, retention class, and conversation media candidates. | Keep narrow pure projection helpers, but stop letting them double as the canonical asset-discovery API. |
| `src/lib/media/media-composition-asset-identity.ts` | Builds compose-media canonicalization options from user files and also from chat messages plus alias heuristics. | Phase 05 must reduce this helper to catalog-backed identity resolution. Transcript-derived alias fallback is transitional glue and should not remain completion-grade architecture. |

### Evidence Of The Remaining Gap

The existing Phase 00 evidence already calls this out directly:

- `src/lib/evals/conversation-refactor-evidence.ts` marks asset storage and
  lineage as only partially covered
- restore can project durable assets, but reusable asset visibility is still
  not owned by one canonical query surface
- compose and tool surfaces still rely on direct repository fan-out and helper
  duplication instead of one asset catalog boundary

## Source Authority Matrix

| Concern | Current authority | Forbidden authority | Phase 05 rule |
| --- | --- | --- | --- |
| Binary file persistence | `user_files` plus `UserFileSystem` | asset catalog rows pretending to own file-system writes | Keep storage writes in the existing file layer. |
| Blog-image persistence | `blog_assets` | transcript tool cards or browser memory | Keep blog asset durability where it already lives until an explicit migration says otherwise. |
| Generated-output reuse lineage | `materialization_records` | `metadata_json` guesses, transcript scans, browser runtime envelopes | Read produced-by-job, reuse visibility, and output lineage from materialization records. |
| Workspace asset visibility | workspace read model fed by durable asset and materialization queries | transcript message parts | Move workspace asset collection behind catalog-backed query seams. |
| Reusable asset shelf and compose preflight | asset catalog query surface | tool-local merges of `user_files` and `blog_assets` | One catalog query must answer reusable-asset discovery. |
| Asset aliasing and canonical compose inputs | catalog-backed identity candidates plus materialization lineage | transcript-only alias reconstruction | Chat history may help with UX, but it cannot remain the durable authority for canonical asset discovery. |

## Phase 05 Decision

Grounded in the current code, the right first Phase 05 implementation is not a
brand-new storage table. It is a canonical read/query model over the durable
stores we already have.

Default decision:

1. Keep `user_files`, `blog_assets`, and `materialization_records` as the write
   authorities for their current concerns.
2. Introduce a dedicated `AssetCatalog` domain surface and query boundary that
   projects catalog entries from those existing authorities.
3. Route restore, reusable-media tools, and compose asset identity through that
   query boundary instead of letting each surface compose its own view.
4. Treat lineage fields such as `producedByJobId`, `materializationKey`,
   `derivativeOfAssetId`, `sourceKind`, and `outputRefs` as first-class catalog
   data, not optional metadata trivia.
5. Keep the first implementation conversation- and user-scoped. Global/public
   catalog behavior can wait until later phases explicitly need it.

Rejected approaches:

- creating a giant new asset table that duplicates file metadata and blog-asset
  metadata just to satisfy "catalog" naming
- leaving canonical asset discovery distributed across restore readers,
  tool commands, upload routes, and composition helpers
- keeping lineage only in `user_files.metadata_json`
- requiring transcript scans to discover reusable generated outputs
- treating blog assets as a permanent special case that must always be merged
  by hand outside the catalog
- letting route handlers or hooks perform cross-store asset-merging logic
  directly
- smuggling future node/document/workflow/template abstractions into this phase
  before the next package defines them intentionally

## Target Architecture

Phase 05 should introduce a clean read-model slice with the same style used by
the execution timeline and workspace restore work.

### Core Types

Add a dedicated entity for catalog results, for example:

```typescript
export interface AssetCatalogEntry {
  assetId: string;
  assetKind: WorkspaceAssetKind | "document";
  ownerUserId: string;
  conversationId: string | null;
  sourceType: "user_file" | "blog_asset";
  status: "pending" | "ready" | "failed" | "superseded" | "deleted";
  mimeType: string;
  fileName: string;
  label: string;
  retentionClass: string | null;
  producedByJobId: string | null;
  materializationKey: string | null;
  derivativeOfAssetId: string | null;
  sourceRefs: readonly ContinuitySourceRef[];
  outputRefs: readonly MaterializationOutputRef[];
  createdAt: string;
  updatedAt: string;
}
```

The exact shape can vary, but the rule should not: the catalog entry is the
canonical answer to "what is this asset and why is it reusable?"

### Ports

Introduce narrow ports instead of teaching every consumer how to join three
stores.

Recommended ports:

- `AssetCatalogReader`
- `AssetCatalogQuery`
- `AssetCatalogLineageReader` if lineage queries need their own use case

Recommended first queries:

- `listByConversation(conversationId, options)`
- `listReusableForConversation(conversationId, userId, options)`
- `findByAssetId(assetId, userId)`
- `findCanonicalComposeCandidate(candidate, context)` or an equivalent query
  dedicated to composition resolution

### Adapters And Projectors

Use a projector-based composition pattern instead of embedding decision logic in
route handlers or tools.

Recommended split:

- data readers that load `user_files`, `blog_assets`, and relevant
  `materialization_records`
- a pure `AssetCatalogProjector` that maps those records into catalog entries
- an application-facing query service that enforces scope, filtering, and sort
  policy

This keeps responsibilities clean:

- repositories read durable state
- projectors translate durable state into catalog entries
- query services express use-case policy
- routes and tools simply call the query service

## Specific Architectural Patterns Required

This phase should explicitly use these patterns.

### Repository Pattern

Consumers should depend on `AssetCatalogReader` or `AssetCatalogQuery`, not on
`UserFileRepository`, `BlogAssetRepository`, and `MaterializationRepository`
all at once.

### Projector Pattern

Keep the mapping from durable records to catalog entries pure and testable.
`WorkspaceSnapshotProjector` is the existing local example to copy.

### Facade / Application Service Pattern

Expose one small use-case surface for reusable asset lookup and compose asset
resolution. The tool layer and restore layer should not orchestrate three
repositories directly.

### Strategy Pattern

Asset ranking, reusable-eligibility policy, and compose-candidate matching
should be swappable policies, not hard-coded sort chains repeated in multiple
files.

Good first strategies:

- ready-only visibility strategy
- reusable-first ranking strategy
- conversation-scope versus user-scope lookup strategy

### Anti-Corruption Layer

`blog_assets` has its own schema and semantics. Do not leak that shape upward.
Normalize it at the catalog boundary so the rest of the system speaks one asset
language.

## What Phase 05 Must Remove

Phase 05 is not complete until the codebase removes the main sources of asset
query drift.

### Remove Direct Cross-Store Merging In Tool Commands

`src/core/use-cases/tools/list-conversation-media-assets.tool.ts` should stop
calling `userFileRepository` and `blogAssetRepository` directly and stop owning
manual merge, dedupe, and sort logic. It should depend on the asset catalog
query boundary.

### Remove Restore-Specific Asset Assembly From The Workspace Reader

`src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts` should
stop being the place where asset rows are manually unioned from direct files and
conversation-scoped materialization aliases. That logic belongs in the catalog
reader/query layer so restore consumes a ready-to-project asset view.

### Remove Tool-Specific Canonical Asset Discovery Logic

`src/lib/media/media-composition-asset-identity.ts` should stop treating direct
`UserFile[]` scans and transcript-derived alias reconstruction as the canonical
asset-identity mechanism. Composition can still use aliases for UX, but the
durable candidate set should come from the asset catalog.

### Remove Permanent Blog-Asset Special Cases Above The Catalog

Helper code such as `projectBlogAssetToMediaCandidate(...)` should either move
behind the asset catalog projector or disappear entirely. Blog assets cannot
remain a forever-exception that every consumer remembers to merge.

### Remove Metadata-Only Lineage Assumptions

Asset lineage such as produced-by job, materialization key, and reusable
status must not continue to be inferred from `user_files.metadata_json` alone
when a materialization record exists.

## Implementation Sequence

1. Add asset-catalog core entities and query ports.
2. Implement a reader that loads user-file assets, blog assets, and relevant
   materialization records for a conversation and user scope.
3. Implement a pure projector that converts those durable records into canonical
   catalog entries with lineage fields.
4. Update workspace restore to consume the catalog query instead of manually
   assembling asset rows.
5. Update `list_conversation_media_assets` to consume the same query.
6. Update compose asset-identity resolution to use catalog candidates as its
   durable source of truth.
7. Add repair or backfill logic only where current rows are missing lineage that
   the new projector requires.

## Spec QA

Positive cases:

- uploaded image or document appears in the catalog without transcript help
- generated audio, chart, graph, image, or video appears with
  `producedByJobId` and `materializationKey` when available
- exact reuse aliased into a new conversation remains visible through the asset
  catalog after reload
- blog image assets appear through the same catalog query as `uf_*` assets
- derived assets preserve `derivativeOfAssetId`

Negative cases:

- pending or failed assets do not appear as ready reusable outputs
- superseded or deleted assets are filtered or labeled intentionally
- another user cannot list assets outside their allowed scope
- compose does not need transcript scans to discover canonical reusable assets

Edge cases:

- anonymous-to-authenticated migration preserves catalog visibility
- conversation-scoped alias materializations surface the underlying durable
  asset without moving it off the source conversation
- a blog asset with no matching user-file row still appears correctly
- a user-file row with no materialization record still projects as an asset,
  just with lineage fields left intentionally null

## Implementation QA

Required validation:

- unit tests for asset catalog projection and ranking policy
- integration tests covering user-file assets, blog assets, and materialized
  outputs in one catalog query
- restore tests proving `importantAssetRefs` are fed by the catalog query rather
  than workspace-local asset assembly
- tool tests proving `list_conversation_media_assets` no longer performs direct
  repository fan-out
- compose identity tests proving canonical candidates come from the catalog
  rather than transcript-only discovery
- migration or repair evidence for existing asset rows that lack required
  lineage

Suggested architecture canaries:

- forbid `list-conversation-media-assets.tool.ts` from importing
  `BlogAssetRepository` directly once the catalog query exists
- forbid new transcript scans for reusable-asset discovery in compose preflight
- forbid restore readers from merging raw `user_files` and materialization alias
  rows outside the asset catalog boundary

## Update

After completion, update Phase 06, Phase 07, and Phase 08 so memory, search,
and prompt-binding work all depend on the asset catalog for reusable asset
identity and lineage instead of re-deriving those concepts independently.

Also update Phase 12 so the broader platform-vision research treats the asset
catalog as an established substrate rather than a speculative future concept.
