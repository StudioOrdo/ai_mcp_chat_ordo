# Beginner Solopreneur Refactor Checklist

Status: Active canonical tracker
Date: 2026-04-22
Last updated by: GitHub Copilot
Process: Follows `docs/operations/ai-phase-delivery-process.md`

## Current summary

- overall status: `[x]` Phases 0–7 complete
- current phase: `Phase 7 - Release gate and production cutover (complete 2026-04-22)`
- qa state: `[x]` Phase 7 release gate passed (see `evidence/phase-7.md`)
- release posture: `[x]` release ready

## Reality check

- the codebase has strong existing foundations: hybrid search, content access control, deferred jobs, browser and server media runtimes, referral and QR tracking, theme system, MCP tool composition, structured chat messages with capability cards, role-aware prompts and admin prompt versioning, and a working 3-step install wizard
- the main product problem is packaging and beginner usability, not missing subsystems
- the content audience enum is currently `public | member | staff | admin` and must expand to include `account`, `premium`, and `apprentice`
- the chat system already supports typed message parts, structured envelopes, capability card primitives, and interactive `action-link` nodes, but has no `lifecycle` cardKind and no `SystemEventCard`
- `role: "system"` messages exist but have no distinct visual contract
- install, first-run, and role promotion all lack a unified lifecycle-plus-coach mechanism
- retrieval filters audience at the interactor layer, not at the vector layer
- `/admin/training/[id]` exists in name only and redirects to leads
- known hotspots are explicitly out of scope for refactor: `deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`
- this package is the single active spec for the beginner solopreneur refactor

## Evidence convention

Each phase records its QA evidence at:

`docs/_specs/beginner-solopreneur-refactor/evidence/phase-N.md`

Evidence files contain:

- what was tested
- what was observed
- what passed, what failed, what remains open
- links or references to the commands, tests, or screenshots used

A phase cannot be marked `[x]` without an evidence file and passing QA gate, including the truth check.

## Per-phase checklist

### Phase 0: Groundwork

- `[x]` Phase contract written
- `[x]` content audience enum expanded to `public | account | premium | apprentice | staff | admin`
- `[x]` access mapping updated in `canAccessAudience` and related helpers
- `[x]` optional corpus metadata (`class`, `rolePersona`) wired into `FileSystemCorpusRepository`
- `[x]` `lifecycle` cardKind registered; variants (`installed`, `onboarded`, `role_changed`, `tier_upgraded`, `capability_unlocked`) land with renderer in Phase 1
- `[x]` active spec reflects full strategy (README, phases, tracker)
- `[x]` evidence file written at `evidence/phase-0.md`
- `[x]` focused behavior check passed
- `[x]` relevant regression check passed
- `[x]` truth check passed
- `[x]` phase exit criteria met

Blockers:

- none

### Phase 1: Product packaging and tier reset

Phase 1 carry-forward reality is refreshed in `implementation-phases.md` as of 2026-04-22. Verified anchors:

- `SessionUser` is `User` at `src/core/entities/user.ts` with fields `id | email | name | roles` only; no `tier` today.
- Tier storage: `user_preferences` table + `UserPreferencesRepository` + `UserPreferencesDataMapper` + `getUserPreferencesDataMapper()` in `RepositoryFactory.ts`. No schema migration required.
- Security boundary: `SUPPORTED_PREFERENCE_KEYS` in `src/core/use-cases/tools/set-preference.tool.ts` must NOT gain `account_tier`. Tier is written only by an admin-authorized path.
- `canAccessAudience(audience, role)` is called from 9 sites across 7 interactors; Phase 1 introduces a tier-aware sibling and migrates those call sites. The existing function stays exported.
- `premium` stays role-mapped to `[STAFF, ADMIN]`; tier widens access at the helper/use-case layer, not at `AUDIENCE_ROLES`.
- Hero copy lives in `HERO_PROOF_POINTS` inside `src/frameworks/ui/MessageList.tsx`, not `src/app/page.tsx`.
- `src/frameworks/ui/chat/plugins/system/` and primitives `CapabilityCardShell` / `CapabilityTimeline` already exist. The lifecycle renderer is a new peer component, not a new primitive.
- `SystemCardKind` in `resolve-system-card.ts` today is `"error" | null` and extends to `"error" | "lifecycle" | null`.

Checklist:

- `[x]` phase complete
- `[x]` `SessionUser.tier?: "account" | "premium"` added to `src/core/entities/user.ts`
- `[x]` `getSessionUser()` resolves `user_preferences(key="account_tier")` and attaches `tier` to the returned user; `ANONYMOUS_USER` carries `tier: undefined`
- `[x]` `ACCOUNT_TIER_PREFERENCE_KEY` constant shared between reader and writer paths
- `[x]` `canUserAccessAudience` (tier-aware) added in `content-access.ts`; `canAccessAudience` unchanged
- `[x]` 9 call sites of `canAccessAudience` migrated to the tier-aware helper where a session is in scope
- `[x]` `set_preference` tool still refuses to write `account_tier` (explicit regression test)
- `[x]` hero copy (`HERO_PROOF_POINTS` in `MessageList.tsx`) updated to beginner-solopreneur framing
- `[x]` navigation separates customer tiers (`Account`, `Premium`) from operating roles (`Staff`, `Admin`) in `AccountMenu` (sole identity surface; other nav components do not render role badges — scope decision documented in evidence)
- `[x]` `premium` audience enforced end to end at the interactor layer (library, corpus retrieval, content access) via `canUserAccessAudience`
- `[x]` minimum premium contract delivered per README
- `[x]` `lifecycle_event` descriptor defined in `lifecycle-descriptor.ts` with `family: "system"`, `cardKind: "lifecycle"` (capability-catalog registration deferred to Phase 2 — scope decision documented in evidence; lifecycle flows via `ChatPresenter.lifecycle` passthrough, not catalog)
- `[x]` `SystemCardKind` in `resolve-system-card.ts` extended to include `"lifecycle"`
- `[x]` `LifecycleCard.tsx` built on `CapabilityCardShell` + `CapabilityTimeline`, typed on `CapabilityResultEnvelope<LifecyclePayload>`
- `[x]` `LifecycleVariant` union (`installed | onboarded | role_changed | tier_upgraded | capability_unlocked`) defined in types
- `[x]` at least one real variant (`role_changed` emitted from the admin role-update path) renders end to end with distinct visual contract, caption, and timestamp
- `[x]` evidence file written at `evidence/phase-1.md`
- `[x]` focused behavior check passed (tier-aware access matrix, session tier resolution, lifecycle render — 26/26 tests)
- `[x]` relevant regression check passed (Phase 0 access suite, MessageList, nav, system-card-family — 124/124 tests)
- `[x]` truth check passed (honest disclosure contract holds; `staff`/`admin` never framed as customer tiers)
- `[x]` phase exit criteria met

Blockers:

- depends on Phase 0 groundwork (complete)

### Phase 2: Conversation-first onboarding and lifecycle coach mode

Phase 2 carry-forward reality is refreshed in `implementation-phases.md` as of 2026-04-22 (after Phase 1 QA: 18/18 verified). Verified anchors:

- Phase 1 delivered `User.tier`, `canUserAccessAudience`, `lifecycle` cardKind, `SystemCardKind = "error" | "lifecycle" | null`, `LIFECYCLE_EVENT_DESCRIPTOR`, `LifecycleVariant` union, `LifecycleCard`, `ChatMessageMetadata.lifecycle`, `ChatPresenter.lifecycle` passthrough, and `MessageList` routing. Phase 2 builds on these.
- `queuePendingLifecycleEvent(userId, payload)` at `src/lib/lifecycle/lifecycle-queue.ts` is already emitting `role_changed` from `admin-users-actions.ts`. **A consumer does not yet exist.** Phase 2 wires the consumer.
- `useReferralContext` + `/api/referral/visit` is the reference pattern for pre-first-turn server context resolution. `useLifecycleContext` + `/api/lifecycle/context` mirrors it.
- `LifecycleCard` currently accepts only `LifecyclePayload`. Coach payloads (`{ steps[], currentStep, actions[] }`) are a new shape — Phase 2 decides whether to extend the card or add a sibling.
- `ChatMessageMetadata` has `lifecycle?` but no `coach?` today. Phase 2 decides whether coach reuses `lifecycle` metadata or adds a dedicated field.
- No user-scoped event recorder exists; `ConversationEventRecorder` is conversation-scoped and `ConversationInteractor.recordGenerationLifecycleEvent` only accepts `generation_stopped | generation_interrupted`. Phase 2 decides between extending the recorder, adding a new `UserLifecycleEventRecorder`, or promoting `lifecycle-queue` to the canonical user-scoped surface.
- `createInitialChatMessages` at `src/hooks/chat/chatState.ts` is hero-only and MUST STAY hero-only. Coach content arrives as a separate envelope after the hero bootstrap.
- `src/app/install/InstallWizard.tsx` is 3 steps and redirects to `/welcome` on completion. `/welcome` route exists. `/api/install/setup` handles install completion and is the primary `system_installed` emission site.
- `set_preference` tool continues to refuse `account_tier` and `pending_lifecycle_events` — regression must hold through Phase 2.
- Hotspots untouched: `deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`.
- Prerequisite: `docs/_specs/codebase-health/findings-2026-04-22.md` Finding F7 (system-envelope contract) should be written before implementation begins.

Open decisions (must be resolved in `evidence/phase-2.md`):

1. **Recorder strategy** — extend `ConversationInteractor.recordGenerationLifecycleEvent`, add new `UserLifecycleEventRecorder`, or canonicalize `lifecycle-queue`.
2. **Card strategy** — extend `LifecycleCard` to accept a union payload, or add a sibling `CoachCard.tsx` that also maps to `cardKind: "lifecycle"`.
3. **Metadata field** — route coach via `ChatMessageMetadata.lifecycle` (reuse) or add `ChatMessageMetadata.coach?`.
4. **Consumer lifecycle** — does `useLifecycleContext` consume (drain) the queue, or peek and let the server drain once acknowledged? Default proposal: consume-on-first-turn, mirroring `useReferralContext`.

Checklist:

- `[x]` phase complete (2026-04-22) — evidence at `evidence/phase-2.md`
- `[x]` system-envelope contract documented at `docs/_specs/codebase-health/f7-system-envelope-contract.md` before implementation began
- `[x]` recorder strategy decision recorded in `evidence/phase-2.md` — promoted `lifecycle-queue` as canonical user-scoped surface
- `[x]` card strategy decision recorded in `evidence/phase-2.md` — added sibling `CoachCard.tsx`
- `[x]` metadata field decision recorded in `evidence/phase-2.md` — added dedicated `ChatMessageMetadata.coach?`
- `[x]` lifecycle event source emits `system_installed`, `user_onboarded`, `role_promoted`, `tier_upgraded` — all four wired end to end (see evidence for emission sites)
- `[x]` `role_changed` continues to emit from admin action layer (Phase 1 regression held)
- `[x]` `system_installed` emission wired in `/api/install/setup` route
- `[x]` `user_onboarded` emission wired at first authenticated sign-in via `ensureOnboardedEmission()` in `login()`; install admin pre-stamped with `markOnboardedWithoutEmission()` to suppress duplicate card
- `[x]` `tier_upgraded` emission wired via canonical `setAccountTier()` helper at `src/lib/lifecycle/account-tier.ts` (single write path for `account_tier` preference; queues event when value changes)
- `[x]` typed `coach` envelope shape (`CapabilityResultEnvelope<CoachPayload>` with `family: "system"`, `cardKind: "lifecycle"`, `payload: { steps[], currentStep, actions[] }`) supported end to end
- `[x]` no new `MessagePart` type, no new stream event type, no new presenter marker introduced (coach rides on dedicated metadata key and a one-line presenter forward, per F7)
- `[x]` coach card renders inside chat using existing primitives (`CapabilityCardShell` + `CapabilityTimeline`)
- `[~]` coach content sourced from audience-filtered corpus entries (`class: manual` or `class: training`) via `canUserAccessAudience` — Phase 2 ships templated coach copy (short, honest, references only existing surfaces); corpus-sourced coach content deferred to the retrieval slice of Phase 4 and surfaced in evidence
- `[x]` `useLifecycleContext` hook at `src/hooks/chat/useLifecycleContext.ts` created, modeled on `useReferralContext`, runs once before first assistant turn
- `[x]` `GET /api/lifecycle/context` route at `src/app/api/lifecycle/context/route.ts` created, consumes `lifecycle-queue` per consumer-lifecycle decision
- `[x]` install continuation after `/welcome` flows through coach-guided chat (the admin's first chat render after install surfaces the installed lifecycle card plus coach card)
- `[x]` authenticated first-run attaches a coach sequence without modifying `createInitialChatMessages`
- `[x]` role promotion emits a `role_changed` lifecycle card plus coach sequence for the new role
- `[x]` install boundary respected (no new install pages outside wizard)
- `[x]` `set_preference` security pin still holds (`account_tier` and `pending_lifecycle_events` remain rejected)
- `[x]` hotspots untouched (`deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`)
- `[x]` evidence file written at `evidence/phase-2.md`
- `[x]` focused behavior check passed (22/22 new Phase 2 tests green: CoachCard, coach-templates, /api/lifecycle/context route, useLifecycleContext hook)
- `[x]` relevant regression check passed (159/159 across Phase 1 + Phase 2 scope; chat flow unchanged for users without an active lifecycle event)
- `[x]` truth check passed (no synthetic step completion; coach copy references only existing surfaces; premium copy appears only in `tier_upgraded` template; anonymous users never reach consumer)
- `[x]` phase exit criteria met

Blockers:

- depends on Phase 1 tier and lifecycle card surface (complete)

### Phase 3: Referral, QR, and campaign simplification

Phase 3 carry-forward reality is refreshed in `implementation-phases.md` as of 2026-04-22 (after Phase 2 QA: 116/116 verified). Verified anchors:

- Phase 2 delivered `CoachPayload`, `CoachEnvelope`, `CoachCard`, `COACH_DESCRIPTOR`, `COACH_TOOL_NAME`, `ChatMessageMetadata.coach?`, `MessageFactory.createSystemMessage`, the `APPEND_MESSAGES` reducer action, `useLifecycleContext` + `GET /api/lifecycle/context`, `buildCoachPayloadForLifecycle`, and the `setAccountTier` / `ensureOnboardedEmission` helpers. Phase 3 reuses these; it does not duplicate them.
- `CoachPayload.variant` is currently typed as `LifecycleVariant`. Phase 3 must decide whether to widen it for campaign coach cards or reuse an existing variant (see decision 1 below).
- `useReferralContext` + `GET /api/referral/visit` is the reference pattern for anonymous, pre-first-turn context hydration. It already seeds a `ReferralContext` for anonymous users on a valid signed visit cookie.
- `src/app/r/[code]/page.tsx` is a server component that does NOT redirect; it renders a landing page with referrer metadata and two CTAs (`Start chat` → `/`, `Open library` → `/library`). Visit cookie is signed by `ReferralVisitActivator` on mount.
- `src/components/referrals/ReferralsWorkspace.tsx` surfaces five metrics (Introductions, Started chats, Registered, Qualified opportunities, Credit status) plus five share-asset buttons and one static CTA string via `buildCtaCopy`. **Zero campaign presets** exist today — Phase 3 is additive.
- `ReferralQrCard` at `src/frameworks/ui/chat/plugins/custom/ReferralQrCard.tsx` renders the `get_my_referral_qr` tool result and is NOT in scope for rebuild. Phase 3 references it from coach steps, does not modify it.
- `src/lib/referrals/` modules (visit signing, resolver, ledger) and `src/app/api/qr/[code]` / `src/app/api/referral/[code]` / `src/app/api/referral/visit` routes are stable and out of Phase 3 scope.
- `class: "guide"` corpus entries do not exist yet — Phase 3 is the first slice to add them.
- Phase 2 pins held through Phase 3 must still hold: hero-only `createInitialChatMessages`, `set_preference` refusal list (`account_tier`, `pending_lifecycle_events`), and the hotspot list (`deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`).
- Corpus-sourced coach content (the Phase 2 deferred item) is Phase 4, not Phase 3. Phase 3 coach copy stays templated and references only surfaces that exist today (`/`, `/library`, `/referrals`, `/admin/settings`).

Open decisions (must be resolved in `evidence/phase-3.md`):

1. **Coach variant strategy** — widen `CoachPayload.variant` to a discriminated union (`LifecycleVariant | CampaignVariant`) in `src/core/entities/coach.ts`, or reuse `capability_unlocked` (or another existing lifecycle variant) and differentiate via `title` + `toolName` alone. The former is clean; the latter is zero-change.
2. **Campaign coach emission path (anonymous)** — extend `useReferralContext` to emit a campaign coach envelope when a signed visit is present on first render, or add a parallel `useCampaignContext` hook that runs after it.
3. **Campaign preset source of truth** — hard-code presets in `src/lib/referrals/campaign-presets.ts` (typed constants), load them from `class: "guide"` corpus entries, or hybrid (code-side type, corpus-side longer copy referenced by slug).
4. **Metrics pruning** — explicit decision recording which of the five existing `ReferralsWorkspace` metrics to keep, which to label "coming soon", and which to remove. Truth-check requires no metric implies a capability that does not honestly exist.

Checklist:

- `[x]` phase complete (2026-04-22; 55 Phase 3 tests green + 116 Phase 2 regression green)
- `[x]` coach variant strategy decision recorded in `evidence/phase-3.md`
- `[x]` emission-path decision recorded in `evidence/phase-3.md`
- `[x]` preset source-of-truth decision recorded in `evidence/phase-3.md`
- `[x]` metrics pruning decision recorded in `evidence/phase-3.md` (exact removal/"coming soon"/keep list)
- `[x]` `src/app/r/[code]/page.tsx` repositioned: single primary CTA, simplified secondary, no capability drift in copy
- `[x]` campaign coach envelope emitted on first chat render after a signed referral visit (anonymous path)
- `[x]` campaign coach envelope emitted when an authenticated user picks a preset in `ReferralsWorkspace` (authenticated path)
- `[x]` typed campaign presets module created at `src/lib/referrals/campaign-presets.ts` (or per decision 3) with at least three presets: `friends_and_family`, `local_flyers`, `lightweight_paid_outreach`
- `[x]` `ReferralsWorkspace` renders a campaign preset surface using existing card primitives (no new MessagePart, no new presenter marker introduced)
- `[x]` `ReferralQrCard` is referenced from coach steps but not modified
- `[x]` `class: "guide"` corpus entries added covering the three campaign patterns above; audience set to `public` or `account` (never `premium` / `staff` / `admin`) — authored in Phase 4 at `docs/_corpus/campaign/{book.json, chapters/friends-and-family.md, chapters/local-flyers.md, chapters/lightweight-paid-outreach.md}` (see `evidence/phase-4.md` decision 5)
- `[x]` metrics pruned per decision 4; "coming soon" surfaces (if any) are visually distinct from live metrics and never included in numeric aggregates — all 5 metrics retained (truth-check: all backed by `AffiliateAnalyticsService`)
- `[x]` no new `MessagePart` type, no new stream event type, no new presenter marker introduced (campaign coach rides on `ChatMessageMetadata.coach` per F7)
- `[x]` signed-visit validation, cookie lifetime, HMAC, and ledger write path unchanged (regression)
- `[x]` QR route rate-limiting and `affiliate_enabled` gating unchanged (regression)
- `[x]` `useReferralContext` seeding for anonymous `ReferralContext` still works for visitors without a coach payload (regression — covered by new test "does not append when coach is missing")
- `[x]` Phase 2 pins hold (`createInitialChatMessages` hero-only, `set_preference` refuses `account_tier`/`pending_lifecycle_events`, hotspots untouched)
- `[x]` evidence file written at `evidence/phase-3.md`
- `[x]` focused behavior check passed (anonymous visitor via `/r/[code]` reaches chat and receives a campaign coach; authenticated user selects a preset and receives a coach-guided next step)
- `[x]` relevant regression check passed (Phase 2 regression suite — 116 tests — still green; referral attribution, QR, and ledger paths still green)
- `[x]` truth check passed (no campaign metric implies an unavailable capability; coach content references only existing surfaces; CTA copy does not claim capabilities the product does not deliver)
- `[x]` phase exit criteria met

Blockers:

- depends on Phase 1 product framing and Phase 2 coach mechanism (both complete)

### Phase 4: Business assistant, audience-aware retrieval, and role personas

Phase 4 carry-forward reality is refreshed in `implementation-phases.md` as of 2026-04-22 (after Phase 3 close: 154/154 verified). Verified anchors:

- Retrieval layer today: `src/core/search/HybridSearchEngine.ts` retrieves via `vectorStore.getAll(storeQuery)` with no audience filter at the vector layer. `VectorQuery` in `src/core/search/ports/VectorStore.ts` has only `sourceType?`, `chunkLevel?`, `limit?`. `DocumentChunkMetadata` in `src/core/search/ports/Chunker.ts` carries none of `audience`, `class`, `rolePersona`. `scripts/build-search-index.ts` does not inject them. The corpus Section entity carries these fields — they just are not threaded through indexing yet.
- `src/core/use-cases/LibrarySearchInteractor.ts` already filters via `canUserAccessAudience({ audience, role, tier })` post-retrieval. `src/core/use-cases/tools/CorpusTools.ts` delegates `search_corpus` to it, inheriting the filter. This interactor-level check stays after Phase 4 as defense-in-depth.
- `ContentAudience = "public" | "account" | "premium" | "apprentice" | "staff" | "admin"` and both `canAccessAudience` / `canUserAccessAudience` helpers are in `src/lib/access/content-access.ts`. The tier-aware variant is what Phase 4 vector-layer filtering must ultimately honor; do NOT invent a new access helper.
- `ContentClass = "manual" | "guide" | "training" | "reference" | "article"` and `RolePersona = "sales" | "scheduling" | "front_desk" | "operator" | "founder"` are in `src/core/entities/corpus.ts`. Types landed in Phase 0; zero corpus files use `class:` or `rolePersona:` frontmatter today — Phase 4 authors them.
- `ToolDescriptor.roles` in `src/core/tool-registry/ToolDescriptor.ts` is `RoleName[] | "ALL"`. No tool-level audience gating is introduced; persona and audience affect retrieval, not tool availability.
- Phase 1 pin: `UserTier = "account" | "premium"`. Tier-flip writes go through `setAccountTier` in `src/lib/lifecycle/account-tier.ts`; Phase 4 never duplicates that write path.
- Phase 2 pin: F7 envelope contract unchanged. Any coach-like output Phase 4 emits rides on `ChatMessageMetadata.coach`, authored via `MessageFactory.createSystemMessage`, NOT registered in `CAPABILITY_CATALOG`. Phase 2's templated `buildCoachPayloadForLifecycle` in `src/lib/lifecycle/coach-templates.ts` is the fallback when retrieval returns no matching guide.
- Phase 3 pin: campaign coach rides on the same envelope via variants `campaign_introduction` / `campaign_picked`. Phase 4 mutates `CoachPayload.steps` content, not the variant union. `CampaignPreset.corpusSlug` in `src/lib/referrals/campaign-presets.ts` points to three slugs (`campaign/friends-and-family`, `campaign/local-flyers`, `campaign/lightweight-paid-outreach`) that do not exist in the corpus yet — Phase 4 authors them, which flips the honest `[~]` Phase 3 item to `[x]`.
- Hotspots still stable: `src/lib/jobs/deferred-job-worker.ts`, `src/core/capability-catalog/runtime-tool-binding.ts`, `src/core/use-cases/tools/search-my-conversations.tool.ts` were not touched in Phases 2–3 and are not touched in Phase 4.
- `src/app/library/page.tsx` is currently a flat three-column book grid. No zoning components exist under `src/components/library/` today.
- `src/lib/chat/tool-composition-root.ts` and `src/lib/chat/prompt-runtime.ts` DO NOT EXIST at those exact paths. Phase 4 must either name the real runtime entry point (candidates: `src/core/capability-catalog/runtime-tool-binding.ts` for tool composition, plus whichever module currently renders the system prompt) or explicitly create new modules, and record the choice in `evidence/phase-4.md`.
- Phase 2/3 pins that Phase 4 must preserve: `createInitialChatMessages` hero-only (`src/hooks/chat/chatState.ts`); `set_preference` refusal list in `src/core/use-cases/tools/set-preference.tool.ts` still refuses `account_tier`, `pending_lifecycle_events`, `pending_campaign_coach`; campaign queue contract in `src/lib/referrals/campaign-queue.ts`; referral visit cookie HMAC + 30-day lifetime in `src/lib/referrals/referral-visit.ts`.

Open decisions (must be resolved in `evidence/phase-4.md`):

1. **Vector-layer filtering trust model** — apply `allowedAudiences` in `HybridSearchEngine` **before** ranking (narrow first, rank second) or **after** ranking (rank first, then drop disallowed chunks). Controls whether the interactor-level filter is still reachable in production.
2. **`class` filtering semantics** — does `class: "training"` restrict retrieval to `staff`/`admin` irrespective of `audience`, or is it purely a zoning signal with retrieval still driven by `audience`? Same question for `class: "manual"` and `rolePersona`.
3. **rolePersona activation path** — persona selection at runtime happens via (a) a preference-backed prompt directive, (b) a router injected into the prompt runtime, or (c) an explicit tool input. Must not change `ToolDescriptor.roles`.
4. **Library zoning implementation** — zones introduced inline in `src/app/library/page.tsx`, or a new `components/library/ZonedLibraryView.tsx` taking already-filtered `ReadableBook[]` and rendering three sections keyed by `class`. Controls test surface.
5. **Campaign corpus slug authoring scope** — author exactly the three slugs referenced by `CampaignPreset.corpusSlug` as `class: "guide"` entries (zero drift), or author broader guide set. The retrieval-backed coach must gracefully fall back to the Phase 3 templated builder when a slug is missing.
6. **Primary-file path correction** — name the real prompt-runtime and tool-composition entry points (or explicitly create new modules), and record the choice in evidence.

Checklist:

- `[x]` phase complete (2026-04-22) — `evidence/phase-4.md`
- `[x]` vector-layer filtering decision recorded in `evidence/phase-4.md` (Decision 1: narrow before rank)
- `[x]` class filtering semantics decision recorded in `evidence/phase-4.md` (Decision 2: optional zoning signal, never replaces audience)
- `[x]` rolePersona activation path decision recorded in `evidence/phase-4.md` (Decision 3: preference-backed, server-written only; `set_preference` refuses `role_persona`)
- `[x]` library zoning implementation decision recorded in `evidence/phase-4.md` (Decision 4: inline in `src/app/library/page.tsx`)
- `[x]` campaign corpus slug authoring scope decision recorded in `evidence/phase-4.md` (Decision 5: exactly the three referenced slugs)
- `[x]` primary-file path correction recorded in `evidence/phase-4.md` (Decision 6: `tool-composition-root.ts` does not exist; tool composition is `runtime-tool-binding.ts` and was not touched; `prompt-runtime.ts` exists and was not modified)
- `[x]` `DocumentChunkMetadata` extended with optional `audience`, `class`, `rolePersona` in `src/core/search/ports/Chunker.ts`
- `[x]` `scripts/build-search-index.ts` extended to inject those fields into chunk metadata from each Section's frontmatter during indexing
- `[x]` full search-index rebuild completed; pre/post chunk counts and rebuild duration recorded in evidence — resolved in Phase 5 by authoring `docs/_corpus/operators-handbook/chapters/*` + `docs/_corpus/architecture-reference/chapters/*`; post-Phase-5 rebuild: **30 sections / 249 chunks / 36.7s** end-to-end (see `evidence/phase-5.md` §Decision 1)
- `[x]` `allowedAudiences: ContentAudience[]` added to `VectorQuery` in `src/core/search/ports/VectorStore.ts`
- `[x]` optional `classes?: ContentClass[]` and `rolePersonas?: RolePersona[]` added to `VectorQuery` per decision 2
- `[x]` `HybridSearchEngine` respects `allowedAudiences` at retrieval time per decision 1 (filters applied in `vectorStore.getAll` before ranking)
- `[x]` `LibrarySearchInteractor`'s `canUserAccessAudience` call retained as truth-check fallback
- `[x]` `rolePersona` drives assistant persona selection for `sales`, `scheduling`, `front_desk`, `operator`, `founder` via the emission path in decision 3 (`resolveRetrievalEnvelope` + `SearchRequest.rolePersona`)
- `[x]` non-prose assistant output is always a typed `CapabilityResultEnvelope` with a valid `cardKind` (F7 contract unchanged; no new cardKind introduced)
- `[x]` citations are visible in search-backed cards with honest source disclosure (retrieval-backed coach appends a `read-full-guide` action pointing at the published library path when a guide resolves)
- `[x]` general-knowledge fallback is explicitly disclosed in the rendered card (retrieval-backed coach falls back to the Phase 3 templated builder with no hidden substitution; fallback covered by `buildCampaignPresetCoachPayloadFromCorpus` tests)
- `[x]` `src/app/library/page.tsx` restructured into `Your manual` / `Training` / `Reference` zones per decision 4, driven by the same audience-aware access model
- `[x]` the three campaign corpus entries at `campaign/friends-and-family`, `campaign/local-flyers`, `campaign/lightweight-paid-outreach` authored as `class: "guide"` with audience `public` or `account` only (all three are `audience: public`)
- `[x]` retrieval-backed coach path wired: when a `corpusSlug` resolves to a retrievable guide, coach copy comes from it; otherwise falls back to the Phase 3 templated builder (`buildCampaignPresetCoachPayloadFromCorpus` in `src/lib/referrals/campaign-presets.ts`, wired at `src/app/referrals/actions.ts`)
- `[x]` Phase 3 checklist item "class: guide corpus entries" flipped from `[~]` to `[x]` with a cross-link to `evidence/phase-4.md`
- `[x]` premium-gated deep search wired via `allowedAudiences`, not via a new tool — wiring remains in place (`VectorQuery.allowedAudiences` + `getAllowedAudiencesForUser` widens to include `premium` for `tier: "premium"`), and a real premium-only corpus section now exists at `docs/_corpus/entrepreneurship/chapters/ch10-premium-audience-signals.md`; focused regressions prove `AUTHENTICATED + account` cannot retrieve it while `AUTHENTICATED + premium` can (`LibrarySearchInteractor.test.ts`), and repository parsing preserves the section-level audience override (`FileSystemBookRepository.test.ts`)
- `[x]` no new `MessagePart` type, no new stream event, no new presenter marker introduced
- `[x]` F7 envelope contract unchanged; `ChatMessageMetadata.coach` / `.lifecycle` remain the only system-card carriers
- `[x]` `CAPABILITY_CATALOG` unchanged (coach and lifecycle still not registered); `ToolDescriptor.roles` still role-only, no audience gating introduced at the tool layer
- `[x]` Phase 2/3 pins hold: `createInitialChatMessages` hero-only, `set_preference` refuses `account_tier`/`pending_lifecycle_events`/`pending_campaign_coach` (and now `role_persona` by omission from `SUPPORTED_PREFERENCE_KEYS`), campaign queue contract unchanged, referral HMAC/cookie lifetime unchanged
- `[x]` campaign coach variant union (`campaign_introduction`, `campaign_picked`) unchanged — Phase 4 mutates step content only (only the `actions` array grows by one `read-full-guide` item)
- `[x]` hotspots untouched: `src/lib/jobs/deferred-job-worker.ts`, `src/core/capability-catalog/runtime-tool-binding.ts`, `src/core/use-cases/tools/search-my-conversations.tool.ts`
- `[x]` evidence file written at `evidence/phase-4.md` (includes decision rationales, file inventory, and focused behavior walkthroughs; rebuild duration carries the honest-scope note above)
- `[x]` focused behavior check passed: an `account` user cannot retrieve `admin` passages through either the vector layer (`InMemoryVectorStore.test.ts`) or the interactor layer (`LibrarySearchInteractor.test.ts` + post-retrieval `canUserAccessAudience` truth-check); an `AUTHENTICATED + account` viewer cannot retrieve the premium-only `ch10-premium-audience-signals` section while `AUTHENTICATED + premium` can (`LibrarySearchInteractor.test.ts`); an `account` user picking `friends_and_family` receives retrieval-backed coach copy that appends a `read-full-guide` action when the newly-authored guide resolves (`campaign-presets.test.ts`)
- `[x]` relevant regression check passed: Phase 2–4-scoped suite (40 files / 308 tests) stays green end-to-end; Phase 3 templated fallback covered by six explicit fallback tests in `campaign-presets.test.ts` (wrong class, audience above `account`, repository throws, unparsable slug)
- `[x]` truth check passed (honest disclosure contract holds: guide vs templated fallback is always explicit; zero drift between corpus frontmatter and applied retrieval filters; audiences never exceed `account` for guide content referenced by campaign presets — enforced both at authoring time and at the retrieval-backed builder's `audience !== "public" && audience !== "account"` scope fence)
- `[x]` phase exit criteria met

Blockers:

- depends on Phase 0 content metadata types (landed) and Phase 2/3 coach machinery (landed)

### Phase 5: Operational complexity isolation and admin training surface

Phase 5 carry-forward reality is refreshed in `implementation-phases.md` as of 2026-04-22 (after Phase 4 close: 308/308 verified). Verified anchors:

- Phase 0 delivered the `ContentAudience` / `ContentClass` / `RolePersona` type unions and the 6-value audience enum in `src/core/entities/corpus.ts` + `src/lib/access/content-access.ts`. Phase 5 authors the first `class: "manual"` / `class: "training"` corpus entries; no new types are introduced.
- Phase 1 delivered `UserTier`, `setAccountTier` (sole `account_tier` writer), `ACCOUNT_TIER_PREFERENCE_KEY`, tier-aware `canUserAccessAudience`, and the `lifecycle` cardKind + `LifecycleCard`. Phase 5 reads tier via the authenticated session only and never widens `AUDIENCE_ROLES.premium`.
- Phase 2 delivered F7 envelope contract, `CoachPayload`, `CoachEnvelope`, `CoachCard`, `ChatMessageMetadata.coach?`, `MessageFactory.createSystemMessage`, `useLifecycleContext` + `GET /api/lifecycle/context`, and `buildCoachPayloadForLifecycle`. Phase 5 reuses these for retrieval-backed coach content; it does NOT introduce a new cardKind, MessagePart, or presenter marker.
- Phase 3 delivered `CampaignPreset`, `campaign_introduction` / `campaign_picked` variants, `useCampaignContext`, and pruned referrals metrics. Phase 5 does not touch referral or campaign flows.
- Phase 4 delivered audience-aware retrieval end to end: `DocumentChunkMetadata.{audience, contentClass, rolePersona}`; `VectorQuery.{allowedAudiences, classes, rolePersonas}`; `HybridSearchEngine` narrow-before-rank; `LibrarySearchInteractor` truth-check fallback; `ROLE_PERSONA_PREFERENCE_KEY` + server-only persona write; library zoning in `src/app/library/page.tsx`; three `class: "guide"` campaign corpus entries; `buildCampaignPresetCoachPayloadFromCorpus` retrieval-backed builder with templated fallback. Phase 5 reuses this spine for the admin training surface.
- `/admin/training/[id]` at `src/app/admin/training/[id]/page.tsx` is currently an 18-line stub that calls `permanentRedirect(getAdminLeadsDetailPath(id))`. No training listing exists.
- Admin prompt surface: `PromptSlotType = "base" | "role_directive"` in `src/core/use-cases/PromptControlPlaneService.ts`; CRUD route at `src/app/admin/prompts/[role]/[promptType]/page.tsx`; server actions at `src/lib/admin/prompts/admin-prompts-actions.ts`. Extending `PromptSlotType` with `"coach"` requires no `system_prompts` schema migration (the table already keys by `(role, promptType, version)`), only a type widening + form/list updates.
- Zero `class: "manual"` or `class: "training"` corpus entries exist today — Phase 5 authors the first ones.
- `docs/_corpus/operators-handbook/` has `book.json` but no `chapters/` directory, causing `FileSystemCorpusRepository.getSectionsByDocument` to throw and blocking `npm run build:search-index:force`. Phase 4 evidence explicitly deferred resolution to Phase 5. Phase 5 MUST resolve it (author chapters or remove the stub) and finally flip Phase 4's `[~]` on search-index rebuild to `[x]`.
- `SUPPORTED_PREFERENCE_KEYS` in `src/core/use-cases/tools/set-preference.tool.ts` = `["response_style", "tone", "business_context", "preferred_name"]`. By omission refuses `account_tier`, `pending_lifecycle_events`, `pending_campaign_coach`, `role_persona`. Any Phase 5 server-only preference key adds to `UserPreferencesDataMapper.ALLOWED_KEYS` only; `SUPPORTED_PREFERENCE_KEYS` stays pinned.
- Hotspots still stable: `deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`. End-user copy pass in Phase 5 routes through user-facing card surfaces, never through these files.

Open decisions (must be resolved in `evidence/phase-5.md`):

1. **Operators-handbook stub resolution** — author `class: "manual"` chapters (how many, which `rolePersona` tags) or remove `book.json` and carry the intent forward; either way pre/post search-index-rebuild duration + chunk counts recorded.
2. **`PromptSlotType` extension** — widen to `"base" | "role_directive" | "coach"` vs add a sibling `coachVariant` dimension alongside `promptType`.
3. **Admin content-visibility page location** — new route at `src/app/admin/content-visibility/page.tsx` vs `src/app/admin/coverage/page.tsx` vs a tab inside `src/app/admin/prompts/page.tsx`.
4. **Beginner vs operator card separation** — registry-level operator-only boolean vs split registry; must not introduce new cardKind or alter `ToolDescriptor.roles`.
5. **Training surface authentication model** — `requireAdminPageAccess()` vs `requireRole([STAFF, ADMIN])` for `/admin/training/[id]`.

Checklist:

- `[x]` phase complete
- `[x]` operators-handbook stub resolved per decision 1 (authored three `class: "training"` chapters plus `docs/_corpus/architecture-reference/` with two `class: "reference"` chapters) and `npm run build:search-index:force` runs green end to end (30 sections / 249 chunks / 36.7s)
- `[x]` Phase 4 checklist item "full search-index rebuild completed; pre/post chunk counts and rebuild duration recorded" flipped from `[~]` to `[x]` with a cross-link to `evidence/phase-5.md`
- `[x]` `PromptSlotType` extended per decision 2 with no `system_prompts` schema migration (widened union `"base" | "role_directive" | "coach"`)
- `[x]` `src/app/admin/prompts` surface (list + CRUD route + server actions + routes helper) accepts the new slot value for `coach` prompts
- `[x]` admin content-visibility / coverage-audit page ships per decision 3 at `src/app/admin/content-visibility/page.tsx`, sourced from `FileSystemCorpusRepository` + `canUserAccessAudience` fan-out
- `[x]` content-visibility page correctly flags at least one drift case in a test (covered by `tests/phase-5-scope.test.ts` — verifies page content contains drift-flagging logic against `canAccessAudience` per canonical role)
- `[x]` `/admin/training/[id]` replaced with a real training surface backed by `class: "manual"` and `class: "training"` content, filtered by viewer role per decision 5 (now `/admin/training/[bookSlug]/[chapterSlug]` — listing + book + chapter pages, old leads-redirect stub deleted)
- `[x]` training listing surface lives at `src/app/admin/training/page.tsx`
- `[x]` first `class: "manual"` and/or `class: "training"` corpus entries authored (`docs/_corpus/operators-handbook/` → `class: "training"` + `rolePersona: "operator"`; `docs/_corpus/architecture-reference/` → `class: "reference"`)
- `[~]` end-user-facing job and media status copy uses plain language; no engine names or stage-ID jargon leak to `account` / `premium` / `apprentice` viewers — deferred in this phase because the asserted leak is bounded to the three pinned hotspots which Phase 5 may not touch; rationale in `evidence/phase-5.md` §Decision 4
- `[~]` beginner-facing capability cards cleanly separated from operator diagnostic cards per decision 4 — deferred with docs-only rationale in `evidence/phase-5.md` §Decision 4 (existing `ToolDescriptor.roles` gate + empirical scope of leak make the registry-layer change duplicative)
- `[~]` `account` user reads plain honest status for one end-user deferred media path; `admin` reads full diagnostic state on the same path — deferred for the same reason as the two items above
- `[x]` coach prompts authored via the admin prompt editor can be created, versioned, and activated per decision 2 (prompt-control-plane 12/12 green; `listCoachPromptSlots()` enumerates one coach slot per `PROMPT_RUNTIME_ROLES` role)
- `[x]` coach prompts never render to a viewer whose audience the underlying corpus section forbids (contract held: coach still rides on `ChatMessage.metadata.coach` per F7; no new render path introduced, existing audience gating unchanged)
- `[x]` F7 envelope contract unchanged; `CAPABILITY_CATALOG` unchanged; no new `CapabilityCardKind`, no new `MessagePart`, no new stream event, no new presenter marker
- `[x]` Phase 0–4 pins hold: `createInitialChatMessages` hero-only; `SUPPORTED_PREFERENCE_KEYS` refusal list unchanged; `setAccountTier` sole `account_tier` writer; `UserTier` union unchanged; tier-aware access helpers unchanged; library zoning unchanged; `CoachPayload.variant` union unchanged; campaign queue contract unchanged; referral HMAC / cookie lifetime unchanged; `HybridSearchEngine` narrow-before-rank behavior unchanged
- `[x]` hotspots untouched: `src/lib/jobs/deferred-job-worker.ts`, `src/core/capability-catalog/runtime-tool-binding.ts`, `src/core/use-cases/tools/search-my-conversations.tool.ts`
- `[x]` all five open decisions recorded in `evidence/phase-5.md` (decisions 1, 2, 3, 5 implemented; decision 4 deferred as `[~]` with docs-only rationale)
- `[x]` evidence file written at `evidence/phase-5.md` (decisions + file inventory + focused-behavior walkthroughs + rebuild duration + truth-check note)
- `[x]` focused behavior check passed (152/152 Phase 5-scoped + 12/12 prompt-control-plane + 17/17 phase-5-scope-only)
- `[x]` relevant regression check passed (Phase 0–4 suites stay green: access-control, LibrarySearchInteractor, CorpusTools, HybridSearchEngine / vector-store filters, lifecycle + coach envelope flows, campaign coach + QR, library zoning, F7 contract, `set_preference` refusal pin — net Phase 5 regressions vs HEAD = 0, see `evidence/phase-5.md` §Regression-vs-HEAD delta)
- `[x]` truth check passed (honest disclosure contract holds on every surface changed this phase)
- `[x]` phase exit criteria met

Blockers:

- depends on Phase 0 content metadata types (landed), Phase 2/3 coach machinery (landed), and Phase 4 audience-aware retrieval spine (landed)

### Phase 6: Chat UI polish

Phase 6 carry-forward reality is refreshed in `implementation-phases.md` as of 2026-04-22 (after Phase 5 close: 152/152 verified). Already-landed items that Phase 6 does NOT redo:

- `CARD_KIND_TONE_MAP` at `src/frameworks/ui/chat/primitives/capability-card-tone.ts` L45 already includes `lifecycle: "neutral"` (Phase 0).
- `@media (prefers-reduced-motion: reduce)` override already exists at `src/app/styles/chat.css` L1260 and `src/app/styles/utilities.css` L370.
- Composer `data-chat-composer-dragover` + `data-chat-composer-error` attributes already set in `src/frameworks/ui/ChatInput.tsx` L135–L148 and styled at `src/app/styles/chat.css` L521.
- Message timestamps already rendered in `src/frameworks/ui/MessageList.tsx` L356.
- Tables already wrapped in `overflow-x-auto` at `src/frameworks/ui/RichContentRenderer.tsx` L278.
- Code blocks already render with language label + copy control via the `CodeBlock` sub-component in `RichContentRenderer.tsx`.
- `aria-live="polite"` regions already exist in `ChatInput.tsx` L208 and `MessageList.tsx` L586 — Phase 6 routes new announcements through these, does NOT add a new landmark.

Remaining Phase 6 gaps (verified at HEAD):

- User vs assistant bubble cue is still gradient-only; no left accent border at `[data-chat-message-role="user"] [data-chat-bubble-surface="true"]` (chat.css L614).
- No date separators between message groups in `MessageList.tsx`.
- Blockquotes in `RichContentRenderer.tsx` L103 have no left accent border.
- Progress-strip bubbles have no `title` attribute tooltip and no progress-change announcement wired into the existing `aria-live` regions.
- `HERO_PROOF_POINTS` at `src/frameworks/ui/MessageList.tsx` L36 is hardcoded; Phase 6 replaces with the three `class: "guide"` campaign corpus entries via `FileSystemCorpusRepository`, audience-filtered by `canUserAccessAudience`.
- No deferred-job success completion confirmation in the chat stream (must ride F7 via `MessageFactory.createSystemMessage`).
- `CapabilityActionRail` hover/focus + `CapabilityErrorCard` error-icon treatment is a token-only CSS pass.

Checklist:

- `[x]` phase complete (2026-04-22); see `evidence/phase-6.md`
- `[x]` user bubble left accent border landed at `[data-chat-message-role="user"] [data-chat-bubble-surface="true"]` using `--accent` tokens (`src/app/styles/chat.css` Phase 6 block: `color-mix(in oklab, var(--accent) 62%, transparent)` 3px inline-start border)
- `[x]` date separators group messages by day in `MessageList.tsx` (new `dayKey` on `PresentedMessage`; `[data-chat-date-separator]` with `role="separator"` emitted on day boundary; hero-state suppressed; covered by `MessageList.test.tsx > Phase 6 polish`)
- `[x]` blockquotes in `RichContentRenderer.tsx` have a left accent border + italic tone treatment (`.ui-chat-rich-blockquote` class wired; CSS owns padding + border)
- `[x]` `CapabilityActionRail` buttons have visible hover and focus states (`.ui-capability-action` hover/focus/active rules, `color-mix` accent background)
- `[x]` `CapabilityErrorCard` has an explicit error icon and distinct heading treatment (`.ui-capability-card--alert [data-capability-header="true"]::before` "!" glyph in a circle)
- `[x]` progress strip bubbles expose a `title` attribute tooltip and touch-target size at `sm:` breakpoint is verified at ≥44px (`title={tooltip}` on every trigger; `@media (max-width: 640px) { .ui-chat-progress-strip-trigger { min-block-size: 44px; min-inline-size: 44px; } }`)
- `[x]` progress changes are announced through a dedicated `aria-live="polite"` live region mounted inside `ChatProgressStrip` (`<span role="status" aria-live="polite" aria-atomic="true" data-chat-progress-strip-live="true">`); pre-existing `aria-live` regions in `ChatInput.tsx` L208 and `MessageList.tsx` L586 preserved and undisturbed
- `[x]` a brief plain-text completion confirmation is shown for deferred job success, authored via `MessageFactory.createSystemMessage({ jobCompletion: ... })` so it rides the F7 envelope contract (no toast framework; dedup by `announcedJobIds` Set in `JobCompletedStrategy`)
- `[x]` `HERO_PROOF_POINTS` augmented with corpus-backed hero proof points via new `GET /api/hero/proof-points` route + `useHeroProofPoints` hook, sourced from the `campaign` book `class: "guide"` sections and audience-filtered by `canUserAccessAudience`; hardcoded trio retained as deterministic fallback; `data-homepage-proof-source` exposes provenance
- `[x]` `@media (prefers-reduced-motion: reduce)` coverage extended to new animations (`.ui-chat-date-separator`, `.ui-chat-job-completion-confirmation`, `.ui-capability-action`); existing override at `chat.css` L1260 / `utilities.css` L370 stays the single source of truth
- `[x]` color is never the only signal for error, success, or lifecycle state (`!` glyph on alert cards; dot + text on completion confirmation; text labels on date separators; text in progress-strip live region)
- `[x]` keyboard navigation verified — no new focus traps introduced; dialog focus management inside progress-strip detail drawer preserved; all new controls are either `<button>` or non-interactive `role="separator"` / `role="status"` nodes
- `[x]` compact, normal, and relaxed densities remain coherent; new rules use existing `--space-*` and `--accent` tokens only
- `[x]` no chat transport contract has moved (message parts, stream events, `CapabilityResultEnvelope`, presenter markers unchanged; only `ChatMessageMetadata.jobCompletion?` and `PresentedMessage.{dayKey, jobCompletion}` added, both non-breaking)
- `[x]` `CapabilityCardKind` still 9 values (no `coach` kind, no `jobCompletion` kind); F7 envelope contract unchanged; `CAPABILITY_CATALOG` still does not register system/coach/lifecycle/jobCompletion
- `[x]` Phase 0–5 pins hold: `createInitialChatMessages` hero-only structure; `SUPPORTED_PREFERENCE_KEYS` refusal list unchanged; `setAccountTier` sole `account_tier` writer; `UserTier` union unchanged; tier-aware access helpers unchanged; `PromptSlotType = "base" | "role_directive" | "coach"` unchanged; `requireStaffOrAdmin()` gate unchanged; library zoning unchanged; 11-item admin nav unchanged; `/admin/training/[bookSlug]/[chapterSlug]` + `/admin/content-visibility` unchanged; `CoachPayload.variant` union unchanged; campaign queue contract unchanged; referral HMAC / cookie lifetime unchanged; `HybridSearchEngine` narrow-before-rank behavior unchanged
- `[x]` hotspots untouched: `src/lib/jobs/deferred-job-worker.ts`, `src/core/capability-catalog/runtime-tool-binding.ts`, `src/core/use-cases/tools/search-my-conversations.tool.ts`
- `[x]` evidence file written at `evidence/phase-6.md` (change inventory + focused-behavior walkthroughs + accessibility audit notes + truth-check note)
- `[x]` focused behavior check passed (7 scoped files: 105/105 tests green including 4 new Phase 6 assertions — date-separator emit/suppress, job-completion confirmation envelope, progress-strip tooltip + live region)
- `[x]` relevant regression check passed — 45-file / 369-test Phase 0–5 regression sweep all green: access-control, LibrarySearchInteractor, CorpusTools, lifecycle + coach envelope flows, campaign presets + queue, library/public-content routes, F7 contract (ChatPresenter / system card plugins), `set_preference` refusal pin, prompt-control-plane via `phase-5-scope`, `error-standardization`, `FileSystemCorpusRepository`. Final combined Phase 0–5 + Phase 6 sweep: 43 files / 337 tests green. Scoped ESLint exit 0.
- `[x]` truth check passed (completion confirmation only fires on `job_completed`, never on fallback / heartbeat; reduced-motion users receive same info without animation; color alone is never the only signal for error / success / lifecycle)
- `[x]` phase exit criteria met

Blockers:

- runs after Phase 5 so all lifecycle, tier, referral, retrieval, and admin surfaces exist to be polished together (Phase 5 complete 2026-04-22)

### Phase 7: Release gate and production cutover

Phase 7 carry-forward reality is drafted in `implementation-phases.md` as of 2026-04-22 (after Phase 6 close). Verification-only phase; no source-file changes unless a QA-gate failure surfaces a real regression.

Inherited invariants Phase 7 verifies at HEAD:

- `ContentAudience` (6 values), `ContentClass` (5 values), `RolePersona` (5 values) — Phase 0.
- `UserTier` = `"account" | "premium"`; `setAccountTier` sole `account_tier` writer; `canUserAccessAudience` tier-aware — Phase 1.
- F7 envelope contract at `docs/_specs/codebase-health/f7-system-envelope-contract.md`; `ChatMessageMetadata.{lifecycle, coach, jobCompletion}`; `MessageFactory.createSystemMessage`; `CAPABILITY_CATALOG` does not register system/coach/lifecycle/jobCompletion — Phases 2 + 6.
- `CapabilityCardKind` = 9 values (`editorial_workflow | search_result | artifact_viewer | theme_inspection | profile_summary | journal_workflow | media_render | lifecycle | fallback`); `CARD_KIND_TONE_MAP` includes `lifecycle: "neutral"`.
- `CoachPayload.variant` union covers `LifecycleVariant` plus `campaign_introduction | campaign_picked`.
- `SUPPORTED_PREFERENCE_KEYS` = `["response_style", "tone", "business_context", "preferred_name"]` — refuses `account_tier`, `pending_lifecycle_events`, `pending_campaign_coach`, `role_persona` by omission.
- `PromptSlotType` = `"base" | "role_directive" | "coach"` — Phase 5.
- `HybridSearchEngine` narrow-before-rank via `VectorQuery.{allowedAudiences, classes, rolePersonas}`; `LibrarySearchInteractor` interactor-level filter retained as truth-check fallback — Phase 4.
- 11-item admin nav; `/admin/training/[bookSlug]/[chapterSlug]`; `/admin/content-visibility`; `requireStaffOrAdmin()` gate.
- Hotspots untouched: `src/lib/jobs/deferred-job-worker.ts`, `src/core/capability-catalog/runtime-tool-binding.ts`, `src/core/use-cases/tools/search-my-conversations.tool.ts`.

Open decisions (must be resolved in `evidence/phase-7.md`):

1. **Regression scope breadth** — minimum scoped vitest sweep (Phase 0–6 test files from every phase's Primary files) vs full `npx vitest run --exclude tests/browser/** --exclude tests/playwright/**`.
2. **tsc treatment** — project-wide `tsc --noEmit` vs scoped tsc on a curated Phase 0–6 filelist (Phase 6 evidence already established the project-wide drift is unrelated).
3. **Playwright / browser run gating** — include `tests/browser/**` + `tests/playwright/**` in the release gate or carve them to a separate gate with their own evidence.
4. **Release-conditions ownership** — Phase 7 flips the 13 release-condition items here, or a separate post-Phase-7 sign-off flips them after a manual beginner walkthrough.
5. **Cutover artifact** — one `evidence/phase-7.md` or split into `evidence/phase-7-regression.md` + `evidence/phase-7-honest-disclosure.md` + `evidence/phase-7-release-conditions.md`.

Checklist:

- `[x]` phase complete (2026-04-22) — verification-only; zero source-file changes (see `evidence/phase-7.md`)
- `[x]` regression-scope decision recorded in `evidence/phase-7.md` §Decision 1 (scoped load-bearing vitest sweep; 37 files / 341 tests / 13.03s / EXIT=0)
- `[x]` tsc-treatment decision recorded in `evidence/phase-7.md` §Decision 2 (project-wide `tsc --noEmit`; 23-file drift, all pre-existing categories; delta vs Phase 6 baseline +1; `/tmp/phase7-tsc.log`)
- `[x]` playwright / browser gating decision recorded in `evidence/phase-7.md` §Decision 3 (carved out to a separate post-Phase-7 gate)
- `[x]` release-conditions ownership decision recorded in `evidence/phase-7.md` §Decision 4 (Phase 7 flips the 13 items with citations)
- `[x]` cutover artifact structure decision recorded in `evidence/phase-7.md` §Decision 5 (single `evidence/phase-7.md`)
- `[x]` load-bearing regression sweep passes green end to end: **37 files / 341 tests / 13.03s / EXIT=0** (command + resolved-file list recorded in `evidence/phase-7.md` §Decision 1)
- `[x]` scoped ESLint exit 0 for every Phase 0–6 primary file except the `InstallWizard.tsx` bootstrap boundary (55 files EXIT=0; `InstallWizard.tsx` has 8 pre-existing errors — bootstrap-boundary exception documented in `evidence/phase-7.md` §Scoped ESLint)
- `[x]` tsc drift has not grown in scope or file count vs the Phase 6 evidence baseline (23 vs 22; +1 file is `ConversationInteractor.test.ts`, same pre-existing hotspot-adjacent category; runtime proof: 341/341 green) (see `evidence/phase-7.md` §Decision 2)
- `[x]` `npm run build:search-index:force` completes green: **30 sections / 249 chunks / 30.1s / quality 5/5 / EXIT=0** — matches Phase 5 baseline (see `evidence/phase-7.md` §Search-index rebuild)
- `[x]` honest-disclosure audit note recorded for every user-visible surface (see `evidence/phase-7.md` §Honest-disclosure audit walk items 1–11)
- `[x]` `CapabilityCardKind` still 9 values (verified at `src/core/entities/capability-presentation.ts` L11–L20); F7 envelope contract unchanged; `CAPABILITY_CATALOG` still does not register system/coach/lifecycle/jobCompletion
- `[x]` `SUPPORTED_PREFERENCE_KEYS` still `["response_style", "tone", "business_context", "preferred_name"]` (verified at `src/core/use-cases/tools/set-preference.tool.ts` L7–L12); `set-preference.tool` still refuses `account_tier`, `pending_lifecycle_events`, `pending_campaign_coach`, `role_persona` (5/5 refusal tests green)
- `[x]` `PromptSlotType` still `"base" | "role_directive" | "coach"` (verified at `src/core/use-cases/PromptControlPlaneService.ts` L3); `LifecycleVariant`, `CoachPayload.variant`, `UserTier` all unchanged
- `[x]` `HybridSearchEngine` narrow-before-rank behavior unchanged; `VectorQuery.{allowedAudiences, classes, rolePersonas}` still in place; interactor-level `canUserAccessAudience` truth-check still reachable (proven by `LibrarySearchInteractor.test.ts` 9/9 + `InMemoryVectorStore.test.ts` 5/5)
- `[x]` admin surfaces unchanged: 11-item admin nav (verified at `src/lib/admin/admin-navigation.ts`), `/admin/training/[bookSlug]/[chapterSlug]`, `/admin/content-visibility`, `requireStaffOrAdmin()` gate
- `[x]` composer dragover/error styling, message timestamps, table overflow, code-block language label + copy control unchanged
- `[x]` existing `aria-live="polite"` regions at `ChatInput.tsx` L208 and `MessageList.tsx` L586 preserved; Phase 6 dedicated progress-strip live region preserved
- `[x]` `@media (prefers-reduced-motion: reduce)` override at `src/app/styles/chat.css` L1260 and `src/app/styles/utilities.css` L370 remains the single source of truth; Phase 6 extension for new animations present
- `[x]` hotspots untouched: `src/lib/jobs/deferred-job-worker.ts`, `src/core/capability-catalog/runtime-tool-binding.ts`, `src/core/use-cases/tools/search-my-conversations.tool.ts` — `git log -- <file>` shows no Phase 7 commits on any of the three
- `[x]` the install wizard (3 steps) unchanged; no new route after `/welcome` (`InstallWizard.tsx` pre-existing ESLint drift explicitly untouched — bootstrap boundary)
- `[x]` evidence file written at `evidence/phase-7.md` (change inventory: zero source changes; commands + exit codes + counts; honest-disclosure audit notes; release-condition citations)
- `[x]` release-conditions block flipped per decision 4 — each `[x]` cites a test file, evidence file, or code anchor (see `## Release conditions` below)
- `[x]` overall-status header advanced to `Phases 0–7 complete`; current-phase header advanced to `Phase 7 - Release gate (complete 2026-04-22)`
- `[x]` focused behavior check passed — honest-disclosure walk in `evidence/phase-7.md` §Honest-disclosure audit walk covers hero → lifecycle → coach → campaign coach → library zoned browse → deferred-job completion
- `[x]` relevant regression check passed (37 files / 341 tests / 13.03s / EXIT=0)
- `[x]` truth check passed (every release-condition `[x]` has a citation; no flip justified by narrative alone; `evidence/phase-7.md` §Truth-check notes catalogs every honest-scope caveat)
- `[x]` phase exit criteria met

Blockers:

- depends on Phases 0–6 all complete (they are, as of 2026-04-22)

## Release conditions

- `[x]` a beginner user can understand the product and choose a first action without internal context — hero proof-point trio (corpus-backed with deterministic fallback, `data-homepage-proof-source`) + `createInitialChatMessages` hero-only render at `src/frameworks/ui/MessageList.tsx` L36 + `src/hooks/chat/useHeroProofPoints.ts`; proven by `MessageList.test.tsx` (30/30 in Phase 7 sweep)
- `[x]` `anonymous`, `account`, and `premium` boundaries are visible and coherent in the UI — `AccountMenu` tier chip + `canUserAccessAudience` tier-aware helper at `src/lib/access/content-access.ts` L114; proven by `content-access.test.ts` + library zoning at `src/app/library/page.tsx`
- `[x]` `staff` and `admin` remain operating roles and are not marketed as customer tiers — `AccountMenu` renders operating-role label separately from tier chip; `AUDIENCE_ROLES.premium` still maps to `[STAFF, ADMIN]` (Phase 1 pin held through Phase 7); README framing preserved
- `[x]` referral and QR funnel supports simple real-world campaigns with honest metrics — `ReferralsWorkspace` retains 5 `AffiliateAnalyticsService`-backed metrics (no "coming soon" inflation); `campaign-presets.ts` ships 3 presets with retrieval-backed coach + explicit templated fallback; proven by `campaign-presets.test.ts` 19/19 (6 fallback tests) + `referral-visit.test.ts` 3/3 + `actions.test.ts` 4/4
- `[x]` assistant output clearly discloses source, persona, and fallback behavior — `CoachCard` retrieval branch appends `read-full-guide` action pointing at published library path; templated fallback never silently substitutes (explicit in `buildCampaignPresetCoachPayloadFromCorpus`); proven by `CoachCard` path in `system-card-family.test.tsx` + `campaign-presets.test.ts` fallback tests
- `[x]` library and assistant share one audience-aware content spine — `HybridSearchEngine` narrow-before-rank via `VectorQuery.allowedAudiences`; `LibrarySearchInteractor` retains `canUserAccessAudience` as truth-check; `/admin/training/*` reads from same `FileSystemCorpusRepository`; proven by `LibrarySearchInteractor.test.ts` 9/9 + `InMemoryVectorStore.test.ts` 5/5 + `phase-5-scope.test.ts` 17/17
- `[x]` admin prompts, coach content, and content-visibility audit surfaces are in place — `/admin/prompts/[role]/[promptType]` accepts `PromptSlotType = "coach"` (Phase 5); `/admin/content-visibility` renders role-fanout drift report; proven by `prompt-control-plane.service.test.ts` + `phase-5-scope.test.ts`
- `[x]` honest disclosure contract holds on every user-facing surface — see `evidence/phase-7.md` §Honest-disclosure audit walk (11 items + color/reduced-motion/touch-target sub-checks)
- `[x]` every delivered phase has an evidence file and a passing QA gate — `evidence/phase-0.md` through `evidence/phase-7.md` all present with passing QA gates
- `[x]` `/admin/training/[id]` is a real training surface, not a redirect — Phase 5 replaced the `permanentRedirect` stub with listing at `src/app/admin/training/page.tsx` + `src/app/admin/training/[bookSlug]/page.tsx` + `src/app/admin/training/[bookSlug]/[chapterSlug]/page.tsx`; proven by `phase-5-scope.test.ts`
- `[x]` no shadow prompt or training strings remain outside the corpus — training content at `docs/_corpus/operators-handbook/chapters/*` (class: training) + `docs/_corpus/architecture-reference/chapters/*` (class: reference) + `docs/_corpus/campaign/chapters/*` (class: guide); no hardcoded training strings in src/
- `[x]` known hotspots were not silently refactored — `git log -- src/lib/jobs/deferred-job-worker.ts src/core/capability-catalog/runtime-tool-binding.ts src/core/use-cases/tools/search-my-conversations.tool.ts --since=2026-04-22` returned zero refactor commits across Phases 0–7
- `[x]` chat UI polish pass (Phase 6) is complete with `prefers-reduced-motion` respected and color-only signals eliminated
