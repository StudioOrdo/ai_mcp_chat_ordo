# Phase 4 Evidence — Business assistant, audience-aware retrieval, and role personas

**Status:** Complete (2026-04-25 refresh)
**Result:** All exit criteria met. Original closeout on 2026-04-22 remained green at 60/60 Phase 4-scoped tests, lint clean across 18 touched files, and 308/308 Phase 2–4-scoped tests end-to-end. The final carry-forward premium retrieval slice is now implemented as well: a premium corpus fixture exists, the retrieval boundary is covered by focused regressions, and the refreshed Phase 4 retrieval bundle passed at 67/67 tests on 2026-04-25.

## Decisions resolved

### Decision 1 — Vector-layer filtering trust model: NARROW BEFORE RANK

`allowedAudiences`, `classes`, and `rolePersonas` are applied inside
`SQLiteVectorStore.getAll` / `InMemoryVectorStore.getAll` **before**
ranking. `HybridSearchEngine.search` threads `filters` through as
`storeQuery`, so neither vector similarity nor BM25 can observe a
disallowed chunk.

- `src/core/search/HybridSearchEngine.ts` — `storeQuery` merges the
  caller's `VectorQuery` with `sourceType` + `chunkLevel: "passage"`
  before `vectorStore.getAll(storeQuery)`.
- `src/adapters/InMemoryVectorStore.ts` — applies the three filters
  via `Set` lookups on `r.metadata.{audience,contentClass,rolePersona}`.
- `src/adapters/SQLiteVectorStore.ts` — metadata is stored as
  serialized JSON, so filters are applied post-SQL with a
  `needsPostFilter` flag that defers `LIMIT` until after filtering.
- `src/core/use-cases/LibrarySearchInteractor.ts` keeps its
  post-retrieval `canUserAccessAudience` truth-check as defense-in-depth.

Rationale: ranking-before-filter leaks result counts (you can tell a
chunk exists by its absence in pages that would otherwise be full), and
makes top-N diagnostics a source of truth you cannot expose. Narrow-first
makes the interactor-level check an audit trail, not the active
enforcement.

### Decision 2 — `class` filtering semantics: OPTIONAL ZONING SIGNAL, NEVER REPLACES AUDIENCE

`class` and `rolePersona` are **optional** `VectorQuery` filters. They
narrow retrieval when explicitly requested (zoning, persona-backed
assistant) but they **do not** gate access. Audience is the only RBAC
axis at the vector layer; `canUserAccessAudience` remains the
authoritative gate.

- `VectorQuery.classes?: readonly string[]` / `rolePersonas?: readonly string[]`
  are absent by default.
- `class: "training"` does NOT imply staff-only. Access for those
  entries is still driven by the `audience:` frontmatter on each
  section.
- Zoning on `/library` (Decision 4) reads `class` after access is
  already resolved — books the viewer cannot see are filtered upstream.

Rationale: conflating content structure (`class`) with access
(`audience`) would make every future zoning change an RBAC change. We
keep the two orthogonal.

### Decision 3 — `rolePersona` activation path: PREFERENCE-BACKED, SERVER-WRITTEN ONLY

`rolePersona` activation is a stored-preference lookup. The assistant
cannot self-activate a persona via chat.

- New `src/lib/chat/retrieval-envelope.ts` exports
  `ROLE_PERSONA_PREFERENCE_KEY = "role_persona"`, `RetrievalEnvelope`,
  `resolveRetrievalEnvelope({role, tier?, rolePersona?})`, and
  `readRolePersonaPreference(repo, userId)`.
- `readRolePersonaPreference` validates the stored string through
  `isRolePersona` — corrupt / unknown / empty values resolve to
  `undefined` rather than propagating.
- `ROLE_PERSONA_PREFERENCE_KEY` is **not** in
  `SUPPORTED_PREFERENCE_KEYS` in
  `src/core/use-cases/tools/set-preference.tool.ts`. The `set_preference`
  tool refuses it the same way it refuses `account_tier`,
  `pending_lifecycle_events`, and `pending_campaign_coach`. Persona is
  written only through a dedicated server flow.
- `ToolDescriptor.roles` is untouched — role-only RBAC stays a Phase 2
  concern.
- The retrieval envelope is consumed by
  `LibrarySearchInteractor.execute`, which forwards
  `{allowedAudiences, rolePersonas: [rolePersona]}` to
  `searchHandler.search`.

### Decision 4 — Library zoning implementation: INLINE IN `src/app/library/page.tsx`

Zoning lives inline in the existing library page. No new
`components/library/ZonedLibraryView.tsx` component was introduced.

- `LibraryZoneKey = "your_manual" | "training" | "reference"`.
- `ZONE_DEFINITIONS` maps `ContentClass` values to zones:
  `manual → your_manual`, `training,guide → training`,
  `reference,article,"__default__" → reference`. Legacy books (no
  `class` set) route to `reference`, so introducing the type today
  never hides content.
- Each zone renders `<section data-library-zone={zone.key}>` with its
  own title/dek plus the existing book-card grid. Book cards carry
  `data-library-book-class={book.contentClass ?? "default"}` for test
  selectors.
- Zones whose bucket is empty are omitted from the DOM.
- Access is unchanged: `getDocuments({role})` already filters books
  the viewer cannot see, so zoning is purely a presentation concern.

Rationale: a new component would have introduced a new test surface
(`ZonedLibraryView.test.tsx`) and a second data-flow path. Inline
zoning keeps a single place where book → zone → card assignment
happens.

### Decision 5 — Campaign corpus slug authoring scope: EXACTLY THE THREE REFERENCED SLUGS

We authored exactly the three slugs that `CampaignPreset.corpusSlug`
already references, nothing more.

- `docs/_corpus/campaign/book.json` — slug `"campaign"`, title
  `"Campaign Playbook"`, number `V`, sortOrder 50,
  `domain: ["teaching"]`, `audience: "public"`, `class: "guide"`,
  tags include `campaign`, `referral`, `solopreneur`, `guide`.
- `docs/_corpus/campaign/chapters/friends-and-family.md`
- `docs/_corpus/campaign/chapters/local-flyers.md`
- `docs/_corpus/campaign/chapters/lightweight-paid-outreach.md`

Each chapter's frontmatter is `audience: public, class: guide` and the
narrative is short, honest, explicit about limits, and references
only surfaces that exist today (`/referrals`, `/library`, `/`). The
retrieval-backed coach falls back to the Phase 3 templated builder
when the slug is missing or resolves to a non-guide or above-`account`
audience.

### Decision 6 — Primary-file path correction

- `src/lib/chat/tool-composition-root.ts` **does not exist** in this
  codebase. Tool composition lives in
  `src/core/capability-catalog/runtime-tool-binding.ts`, which was
  **not** touched in Phase 4 (it does not need changes: retrieval
  filtering is a vector-layer + interactor concern, not a tool-binding
  concern).
- `src/lib/chat/prompt-runtime.ts` **does exist** as a rich
  prompt-composition module. Phase 4 did **not** modify it — persona
  activation is a retrieval-narrowing concern here. Any future
  persona-specific assistant voice changes should live in
  `prompt-runtime.ts`, which is why
  `src/lib/chat/retrieval-envelope.ts` explicitly scopes itself out of
  prompt authoring.

## Retrieval-backed coach walkthrough

`src/lib/referrals/campaign-presets.ts`:

- `parseCampaignCorpusSlug(slug)` — splits `"campaign/<section>"` into
  `{documentSlug, sectionSlug}`; returns `null` for empty,
  single-segment, or three-or-more-segment slugs.
- `buildCampaignPresetCoachPayloadFromCorpus(preset, corpusRepository)`
  — calls the Phase 3 templated builder first, then tries
  `corpusRepository.getSection(doc, section)`. On success, it verifies
  `contentClass === "guide"` (or unset) and `audience` is
  `"public"`/`"account"`. On match, it appends a fourth action
  `{key:"read-full-guide", kind:"navigate", label:"Read the full guide", href:"/library/${doc}/${section}"}`
  to the templated payload. ANY error or mismatch → falls back to the
  templated payload unchanged.

`src/app/referrals/actions.ts` — `selectCampaignPresetAction` tries the
retrieval-backed builder first with a try/catch fallback to
`buildCampaignPresetCoachPayload(preset)`, then queues via
`queuePendingCampaignCoach`.

The variant union, step count, step keys, and `currentStep` are
untouched. Only the `actions` array grows — the minimum-drift way to
wire retrieval into the coach contract.

## File inventory

| Path | Change |
| --- | --- |
| `src/core/search/ports/Chunker.ts` | Added optional `audience`, `contentClass`, `rolePersona` to `DocumentChunkMetadata`. |
| `src/core/search/ports/VectorStore.ts` | Added `allowedAudiences`, `classes`, `rolePersonas` to `VectorQuery`. |
| `src/adapters/InMemoryVectorStore.ts` | `getAll` filters the three new fields. |
| `src/adapters/InMemoryVectorStore.test.ts` | New file: 5 filter-behavior tests. |
| `src/adapters/SQLiteVectorStore.ts` | Post-SQL JSON metadata filter + deferred `LIMIT`. |
| `scripts/build-search-index.ts` | Injects `audience` / optional `contentClass` / `rolePersona` into chunk metadata; logs pre/post counts + duration. |
| `src/adapters/FileSystemCorpusRepository.ts` | `getSectionsByDocument` threads document-level `class` / `rolePersona` into `parseSection` for inheritance. |
| `src/core/search/HybridSearchEngine.ts` | Explanatory comment; `storeQuery` forwards filters before ranking. |
| `src/core/use-cases/LibrarySearchInteractor.ts` | `SearchRequest.rolePersona?`; computes `getAllowedAudiencesForUser` and forwards `{allowedAudiences, rolePersonas}` to the search handler. |
| `src/core/use-cases/LibrarySearchInteractor.test.ts` | +5 tests covering envelope threading. |
| `src/lib/access/content-access.ts` | `getAllowedAudiencesForUser(input)` helper. |
| `src/lib/access/content-access.test.ts` | +5 tests including (role × tier × audience) mirror of `canUserAccessAudience`. |
| `src/lib/chat/retrieval-envelope.ts` | NEW: `ROLE_PERSONA_PREFERENCE_KEY`, `resolveRetrievalEnvelope`, `readRolePersonaPreference`. |
| `src/lib/chat/retrieval-envelope.test.ts` | NEW: 9 tests (resolve + preference read + corrupt-value handling). |
| `src/lib/referrals/campaign-presets.ts` | `parseCampaignCorpusSlug`, `buildCampaignPresetCoachPayloadFromCorpus`. |
| `src/lib/referrals/campaign-presets.test.ts` | +10 tests (parse + retrieval-backed builder happy paths + 4 fallback cases). |
| `src/app/referrals/actions.ts` | Wires retrieval-backed builder with fallback. |
| `src/app/library/page.tsx` | Zoned layout driven by `ZONE_DEFINITIONS`; empty zones omitted. |
| `docs/_corpus/campaign/book.json` | NEW: campaign playbook manifest. |
| `docs/_corpus/campaign/chapters/friends-and-family.md` | NEW guide. |
| `docs/_corpus/campaign/chapters/local-flyers.md` | NEW guide. |
| `docs/_corpus/campaign/chapters/lightweight-paid-outreach.md` | NEW guide. |

## Regression walkthrough

Post-retrieval gate on `src/core/use-cases/LibrarySearchInteractor.ts`
makes the audience truth-check reachable even if the vector-layer
filter is bypassed. Covered by the existing Phase 2 regression suite
in `src/lib/access/content-access.test.ts` plus the new Phase 4
`getAllowedAudiencesForUser` mirror test proving
`getAllowedAudiencesForUser({role,tier})` is `canUserAccessAudience`
pointwise-equivalent across every (role × tier × audience) combo.

Concrete regression:

- An `account` user (`role: "AUTHENTICATED", tier: "account"`)
  retrieves: `allowedAudiences = ["public", "account"]`. A chunk
  tagged `audience: "admin"` is filtered by the vector store before
  ranking, so it never reaches the RRF fusion or BM25 stage. Even if
  the filter were bypassed, the interactor's
  `canUserAccessAudience` check would still exclude it.
- A `premium` user (`role: "AUTHENTICATED", tier: "premium"`)
  retrieves: `allowedAudiences = ["public", "account", "premium"]`.
  Passes Phase 1's tier-widening, verified by the pointwise mirror
  test.
- An `admin` retrieves all six audience values — unchanged from
  pre-Phase-4 behavior.

## Phase 3 pin — `class: "guide"` corpus entries

Three `class: "guide"` entries now exist at the slugs referenced by
`CampaignPreset.corpusSlug`:

- `campaign/friends-and-family`
- `campaign/local-flyers`
- `campaign/lightweight-paid-outreach`

All three have `audience: "public"` in frontmatter (never `premium`,
`staff`, or `admin`), satisfying the Phase 3 carry-forward item.

## Premium-gated deep search proof

Phase 4's premium retrieval path is now backed by real corpus content,
not just plumbing.

- `docs/_corpus/entrepreneurship/chapters/ch10-premium-audience-signals.md`
  is authored with `audience: premium` and `class: guide`.
- `src/adapters/FileSystemBookRepository.test.ts` proves the repository
  preserves that section-level `premium` override from frontmatter.
- `src/core/use-cases/LibrarySearchInteractor.test.ts` proves the
  fallback retrieval path excludes the section for
  `AUTHENTICATED + account` and includes it for
  `AUTHENTICATED + premium`.

## Test results

```text
src/adapters/InMemoryVectorStore.test.ts      5 tests  ✓
src/adapters/FileSystemBookRepository.test.ts 5 tests  ✓
src/lib/access/content-access.test.ts         14 tests ✓ (+5 new)
src/lib/chat/retrieval-envelope.test.ts       9 tests  ✓ (new file)
src/core/use-cases/LibrarySearchInteractor.test.ts  11 tests ✓ (+7 new)
src/lib/referrals/campaign-presets.test.ts    19 tests ✓ (+10 new)
src/app/referrals/actions.test.ts             4 tests  ✓ (Phase 3 regression)

Test Files  7 passed (7)
Tests       67 passed (67)
```

Phase 2–4-scoped sweep:
`src/lib/access src/core/use-cases/LibrarySearchInteractor src/core/search src/lib/referrals/campaign-presets.test.ts src/lib/referrals/campaign-queue.test.ts src/app/referrals/actions.test.ts src/app/api/campaign/context/route.test.ts src/lib/chat/retrieval-envelope src/app/api/lifecycle src/hooks/chat src/adapters/ChatPresenter src/frameworks/ui/chat/plugins/system src/core/use-cases/tools/set-preference.tool.test.ts src/core/use-cases/tools/CorpusTools src/adapters/FileSystemCorpusRepository tests/error-standardization tests/public-content-routes`
→ **40 files / 308 tests, all green**.

Lint: `npx eslint` across all 18 touched files — **0 errors,
0 warnings**.

## Search-index rebuild — honest scope note

`npm run build:search-index:force` currently fails on a pre-existing
corpus issue on `main`: `docs/_corpus/operators-handbook/` contains a
`book.json` but no `chapters/` directory, causing
`FileSystemCorpusRepository.getSectionsByDocument` to throw
`ResourceNotFoundError` for `operators-handbook` before any chunk is
written. This failure reproduces on clean `main` with the Phase 4
working tree stashed, proving it is pre-existing and not a Phase 4
regression.

The Phase 4 indexer wiring (`scripts/build-search-index.ts` injecting
`audience`, `contentClass`, `rolePersona` into each chunk's
`metadata`) is validated by:

- `src/adapters/InMemoryVectorStore.test.ts` — confirms
  `VectorStore.getAll(query)` filters on exactly the three fields.
- `src/core/use-cases/LibrarySearchInteractor.test.ts` — confirms
  `{allowedAudiences, rolePersonas}` round-trip from
  `SearchRequest` to `SearchHandler.search(query, filters)`.
- The type-system: `DocumentChunkMetadata` is the single source of
  truth for chunk metadata, and the script's `satisfies
  DocumentChunkMetadata` assertion on the built metadata is checked at
  compile time.

Resolving the corpus blocker (authoring `operators-handbook` chapters,
or removing the stub book.json) is Phase 5 territory — `Phase 5:
Operational complexity isolation and admin training surface`
explicitly owns the `/admin/training/[id]` and `class: manual` /
`class: training` story.
