# Beginner Solopreneur Refactor Phases

Status: Active phase plan
Date: 2026-04-21
Process: Follows `docs/operations/ai-phase-delivery-process.md`

Phases run in order. Each phase must be refreshed with `Carry-forward reality` immediately before execution. A phase is never `[x]` until its QA gate passes, including the truth check.

---

## Phase 0: Groundwork (spec, access model, design rules)

Goal:
- make Phase 1 executable by fixing the shared foundations everything else depends on

Carry-forward reality:
- the current content audience enum is `public | member | staff | admin` in `src/lib/access/content-access.ts` and must be expanded before tier work begins; existing `member` values in `book.json` and section frontmatter must be migrated to `account` or aliased during the transition
- the corpus loader in `src/adapters/FileSystemCorpusRepository.ts` already supports per-document and per-section audience metadata but has no `class` or `rolePersona` fields
- `DocumentChunkMetadata` in `src/core/search/ports/Chunker.ts` does not currently carry `audience`, `class`, or `rolePersona`; pushing retrieval-layer filtering into the vector layer is Phase 4 work and depends on fields added here
- the chat message system already supports typed parts, capability envelopes, and card primitives, but `CapabilityCardKind` has no `lifecycle` value yet; no `SystemEventCard` primitive exists and none will be created — the `lifecycle` renderer is the system event surface
- the existing install wizard and role-based bootstrap messages work and must not regress during groundwork
- a preliminary sweep of `docs/_corpus/**/book.json` and section frontmatter may find zero `audience: member` strings; Phase 0 begins with that sweep and records the result in the evidence file, so the migration scope is concrete
- `CARD_KIND_TONE_MAP` in `src/frameworks/ui/chat/primitives/capability-card-tone.ts` is not exhaustive today; adding the `lifecycle` cardKind requires either an explicit tone entry or a verified fallback

This phase changes:
- content audience enum and access mapping in `src/lib/access/content-access.ts` (`public | account | premium | apprentice | staff | admin`); update `AUDIENCE_ROLES`, `isContentAudience`, and `DENIED_AUDIENCE_PRIORITY`; migrate any existing `member` values in `docs/_corpus` to `account`
- optional corpus metadata (`class`, `rolePersona`) in `DocumentManifest` and `Section`, plus loader validation in `FileSystemCorpusRepository.ts`
- capability presentation registry: add `lifecycle` value to `CapabilityCardKind` in `src/core/entities/capability-presentation.ts`, register a descriptor in the capability catalog with `family: "system"`, and add a `lifecycle` entry to `CARD_KIND_TONE_MAP` (or confirm a safe fallback tone)
- active spec text: add conversation-first design rules and lifecycle-coach rules into the README
- refreshed `Carry-forward reality` for Phases 1 to 5 right before each phase begins

This phase does not change:
- any user-facing UI
- tool RBAC behavior
- corpus file content
- the install wizard

Primary files:
- src/lib/access/content-access.ts
- src/adapters/FileSystemCorpusRepository.ts
- src/core/entities/capability-presentation.ts
- src/frameworks/ui/chat/registry/capability-presentation-registry.ts
- docs/_specs/beginner-solopreneur-refactor/README.md
- docs/_specs/beginner-solopreneur-refactor/implementation-phases.md
- docs/_specs/beginner-solopreneur-refactor/production-readiness-checklist.md

QA gate:
- focused behavior check: audience enum expansion passes all existing access-control tests
- relevant regression check: existing corpus documents and sections continue to load and render in the current library route
- truth check: no UI-visible claim of completion; groundwork only

Exit criteria:
- expanded audience enum is in place and enforced by `canAccessAudience`
- `class` and `rolePersona` are optional, validated, and default-safe
- `lifecycle` cardKind is registered with variants `installed`, `onboarded`, `role_changed`, `tier_upgraded`, `capability_unlocked`
- active spec reflects the full strategy
- QA gate passed

---

## Phase 1: Product packaging and tier reset

Goal:
- the product reads as an anonymous, account, and premium customer product with staff and admin clearly framed as internal operating roles

Carry-forward reality (verified 2026-04-22):
- Phase 0 shipped the expanded audience enum `public | account | premium | apprentice | staff | admin`. `premium` is currently mapped to `[STAFF, ADMIN]` only at the role layer in `src/lib/access/content-access.ts`; Phase 1 adds tier-aware access **without** widening that role mapping.
- Phase 0 registered `"lifecycle"` in `CapabilityCardKind` and added `lifecycle: "neutral"` in `CARD_KIND_TONE_MAP`. No descriptor, renderer, or tone override exists yet. Variants (`installed`, `onboarded`, `role_changed`, `tier_upgraded`, `capability_unlocked`) are not yet represented anywhere in code.
- `SessionUser` is `User` from `src/core/entities/user.ts` and has exactly four fields today: `id`, `email`, `name`, `roles: RoleName[]`. There is no `tier` field. `src/lib/auth.ts` re-exports `User as SessionUser` and is the single seam to extend.
- `getSessionUser()` in `src/lib/auth.ts` already returns a `SessionUser` from `ValidateSessionInteractor.execute`. The `ANONYMOUS_USER` constant is declared inline at `src/lib/auth.ts` and will need to carry `tier: undefined` explicitly.
- Tier storage: the `user_preferences` table is already wired end to end. `UserPreferencesRepository` lives at `src/core/ports/UserPreferencesRepository.ts` with `get/set/getAll/delete(userId, key, value?)`; `UserPreferencesDataMapper` at `src/adapters/UserPreferencesDataMapper.ts` is the concrete SQLite adapter; `getUserPreferencesDataMapper()` in `src/adapters/RepositoryFactory.ts` is the composition seam. No schema migration is required.
- Security boundary for tier writes: `SUPPORTED_PREFERENCE_KEYS` in `src/core/use-cases/tools/set-preference.tool.ts` currently lists `response_style`, `tone`, `business_context`, `preferred_name`. **`account_tier` must NOT be added to that list.** Tier is written only by an admin-authorized path (new admin action or existing `UserAdminInteractor`-adjacent surface) so users cannot self-promote via the chat tool.
- `canAccessAudience(audience, role)` is called from 9 sites: `LibrarySearchInteractor` (x3), `GetChapterInteractor`, `CorpusIndexInteractor`, `CorpusSummaryInteractor`, `ChecklistInteractor`, `PractitionerInteractor`, `CorpusTools` (x2). All currently pass `RoleName` only. Phase 1 introduces a sibling helper that accepts tier and migrates these call sites; the existing function stays for backward compatibility.
- `role: "system"` messages are already created by 5+ surfaces (`SummarizationInteractor`, `ChatNotificationChannel`, `admin-conversations-actions`, conversation retention worker) and persist in the transcript. `MessageList.tsx` does not branch on `message.role === "system"` today; they render as regular bubbles. The `lifecycle` renderer is the single new visual contract for this role.
- `src/frameworks/ui/chat/plugins/system/` already exists with `JobStatusFallbackCard`, `CapabilityErrorCard`, `ErrorCard`, `ProgressStripBubble`, `SystemJobCard`, `CapabilityDetailDrawer`. The resolver `resolve-system-card.ts` defines `SystemCardKind = "error" | null`. Phase 1 extends this to `"error" | "lifecycle" | null` and adds a `LifecycleCard` peer.
- Primitives `CapabilityCardShell` and `CapabilityTimeline` live at `src/frameworks/ui/chat/primitives/` and are the required building blocks. No new primitive is introduced.
- Entry route `src/app/page.tsx` is a thin redirect gate (install check + shell home resolution) that renders `<ChatSurface mode="embedded" />`. The homepage hero copy (`One compact system`, `Background AI workflows`, `Governed by default`) is hardcoded in `HERO_PROOF_POINTS` inside `src/frameworks/ui/MessageList.tsx` — that constant is the surface to update for beginner-solopreneur framing.
- Navigation composition lives in `src/components/SiteNav.tsx`, `src/components/AccountMenu.tsx`, `src/components/ShellWorkspaceMenu.tsx`, `src/components/ShellNavDrawer.tsx`, `src/components/AppShell.tsx`; `src/lib/shell/shell-navigation.ts` owns `SHELL_ROUTES` and the route resolvers used by all of them. Tier vs role separation lands here.
- Presenter, chat transport, deferred-job runtime, and install wizard are **not** touched.

This phase changes:
- public-facing copy and primary entry framing: update `HERO_PROOF_POINTS` in `src/frameworks/ui/MessageList.tsx` and any directly affected hero strings so the product reads as a beginner-solopreneur product. No new hero component is introduced.
- navigation and IA separation of customer tiers from operating roles in `src/components/SiteNav.tsx`, `src/components/AccountMenu.tsx`, `src/components/ShellWorkspaceMenu.tsx`, `src/components/ShellNavDrawer.tsx`, and `src/lib/shell/shell-navigation.ts` as needed. Tier badges (`Account`, `Premium`) are distinct from role badges (`Staff`, `Admin`).
- tier attachment on session:
  - extend `User` in `src/core/entities/user.ts` with optional `tier?: "account" | "premium"`.
  - extend `getSessionUser()` in `src/lib/auth.ts` to resolve the `account_tier` preference via `getUserPreferencesDataMapper().get(userId, "account_tier")` after a real session validates, and attach `tier` to the returned user. Anonymous and mock-role paths leave `tier` undefined.
  - add a tier-key constant (e.g. `ACCOUNT_TIER_PREFERENCE_KEY = "account_tier"`) in a shared access/tier module so writer and reader share the string.
- tier-aware access in `src/lib/access/content-access.ts`:
  - add `canUserAccessAudience({ audience, role, tier? })` (or equivalent signature) that returns true when `canAccessAudience(audience, role)` is true OR when `audience === "premium"` and `tier === "premium"`.
  - keep `canAccessAudience(audience, role)` exported and unchanged for callers that truly only have a role.
  - add `getPremiumGatedAudience(audience, role, tier)` or equivalent for the `getDeniedAudienceForRole`-style UI prompts, so denied-state copy can distinguish “needs account” from “needs premium”.
- migrate the 9 call sites listed above to the tier-aware helper, threading `SessionUser.tier` through interactor inputs where a session is already in scope. Interactors that currently accept `role: RoleName` gain an optional `tier` sibling parameter; defaulting is safe.
- minimum premium contract per `README.md`:
  - retrieval access to `audience: premium` content via the new helper.
  - library and corpus entries gated at the interactor layer (vector-layer filtering is explicitly Phase 4).
  - a visible premium badge / framing somewhere in the shell for `tier === "premium"` sessions.
- `lifecycle` cardKind descriptor and renderer:
  - register a `lifecycle_event` capability descriptor in the capability catalog with `family: "system"`, `cardKind: "lifecycle"`, `executionMode: "inline"`, `progressMode: "none"`, `defaultSurface: "conversation"`, `supportsRetry: "none"`, `historyMode: "payload_snapshot"`, `artifactKinds: []`. This exists purely so presenter and registry can resolve a descriptor for the card; no tool is executable by the model.
  - extend `SystemCardKind` in `src/frameworks/ui/chat/plugins/system/resolve-system-card.ts` to include `"lifecycle"` and update `resolve-system-card.test.ts`.
  - add `LifecycleCard.tsx` under `src/frameworks/ui/chat/plugins/system/` built on `CapabilityCardShell` + `CapabilityTimeline`. It accepts a typed `CapabilityResultEnvelope<LifecyclePayload>` where `LifecyclePayload = { variant, occurredAt, actor?, detail? }` and renders a visually distinct, non-bubble card with caption and timestamp.
  - define `LifecyclePayload` and a `LifecycleVariant` string-literal union covering the five variants (`installed | onboarded | role_changed | tier_upgraded | capability_unlocked`). Variants land in types; variant-specific copy and corpus-backed content are Phase 2.
  - wire at least one real trigger so a single variant renders end to end. Recommended minimum: emit a `role_changed` lifecycle card from the existing role-update path in `src/app/admin/users/[id]` (or its server action) so QA can observe a non-mocked render. The emitter attaches the envelope to a new `role: "system"` message; it does not touch the recorder contract (user-scoped recording is a Phase 2 decision).
- tests:
  - add tier-aware access unit tests for `canUserAccessAudience` covering the full cross product of `{public, account, premium, apprentice, staff, admin}` × `{ANONYMOUS, AUTHENTICATED, APPRENTICE, STAFF, ADMIN}` × `{undefined, "account", "premium"}`.
  - add a `LifecycleCard` render test (variant `role_changed`) and extend `resolve-system-card.test.ts` for the new branch.
  - snapshot or text-assertion test that the updated hero copy no longer reads as a platform product.
  - session test that asserts `getSessionUser()` exposes `tier` when the `account_tier` preference is set and omits it otherwise.

This phase does not change:
- tool RBAC rules or the `set_preference` tool surface; `account_tier` is never a user-writable preference key.
- deferred job, search, or media internals.
- staff and admin operational power or `requireRole` semantics.
- the known hotspots listed in the README (`deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`).
- the presenter, chat transport, or stream event vocabulary.
- `createInitialChatMessages` content (Phase 2 handles coach content).
- vector-layer audience filtering (Phase 4).
- the install wizard (Phase 2 handles install continuation).
- corpus content files under `docs/_corpus/**`.

Primary files:
- `src/core/entities/user.ts` — add optional `tier`
- `src/lib/auth.ts` — resolve `account_tier` preference into `SessionUser`; update `ANONYMOUS_USER`
- `src/lib/access/content-access.ts` — add tier-aware helper and premium-gating constant; keep `canAccessAudience` intact
- `src/core/use-cases/LibrarySearchInteractor.ts`, `GetChapterInteractor.ts`, `CorpusIndexInteractor.ts`, `CorpusSummaryInteractor.ts`, `ChecklistInteractor.ts`, `PractitionerInteractor.ts`, `tools/CorpusTools.ts` — thread tier through access decisions
- `src/core/capability-catalog/families/` — register the `lifecycle_event` descriptor (system family)
- `src/frameworks/ui/chat/plugins/system/resolve-system-card.ts` — extend `SystemCardKind`
- `src/frameworks/ui/chat/plugins/system/LifecycleCard.tsx` — new component
- `src/frameworks/ui/MessageList.tsx` — update `HERO_PROOF_POINTS`; route `role: "system"` + lifecycle envelopes through `LifecycleCard`
- `src/components/SiteNav.tsx`, `AccountMenu.tsx`, `ShellWorkspaceMenu.tsx`, `ShellNavDrawer.tsx`, `AppShell.tsx` — tier vs role IA
- `src/lib/shell/shell-navigation.ts` — route surface adjustments if required
- `src/app/admin/users/[id]` — emit a `role_changed` lifecycle message on role update

QA gate:
- focused behavior check: tier-aware access tests pass for the full cross product; `LibrarySearchInteractor.test.ts` still passes after the tier parameter threading; session test confirms `getSessionUser().tier` reads the preference correctly; the lifecycle renderer shows a non-bubble card with timestamp for at least one real variant in a test.
- relevant regression check: access-control suite from Phase 0 re-runs green; `MessageList.test.tsx`, `SiteNav.test.tsx`, `AccountMenu.test.tsx`, and `system-card-family.test.tsx` still pass; admin and staff routes still protect correctly under `requireRole`.
- truth check: no UI surface markets `staff` or `admin` as a customer tier; no user-facing copy claims capabilities the tier does not actually unlock; the premium badge only appears when `tier === "premium"` is actually resolved; `set_preference` tool still refuses to write `account_tier`.

Exit criteria:
- `SessionUser.tier` is optional, resolved from `user_preferences(key="account_tier")`, and typed across the app.
- `canUserAccessAudience` exists and the 9 call sites use it where a session is in scope; `canAccessAudience` unchanged.
- `premium` audience is reachable by `tier === "premium"` sessions without widening `AUDIENCE_ROLES.premium`.
- hero copy and primary navigation read as a beginner-solopreneur product; `staff`/`admin` framed as operating roles only.
- `lifecycle_event` descriptor is registered; `LifecycleCard` renders a real `role_changed` event with distinct visual contract, caption, and timestamp; system resolver routes it.
- evidence file written at `evidence/phase-1.md` covering tier resolution, tier-aware access matrix results, hero/navigation changes, lifecycle card live-render evidence, and hotspot-avoidance confirmation.
- QA gate passed, including truth check.

---

## Phase 2: Conversation-first onboarding and lifecycle coach mode

Goal:
- install continuation, first-run onboarding, role promotion, and tier upgrade all flow through a single lifecycle-plus-coach mechanism inside chat

Carry-forward reality (refreshed 2026-04-22 after Phase 1 QA):

Phase 1 left the following concrete anchors in place. Phase 2 binds to these and does not reinvent them.

- `User.tier?: UserTier` is attached in `getSessionUser()` via `resolveUserTier()` in [src/lib/auth.ts](src/lib/auth.ts). `ANONYMOUS_USER.tier = undefined`. There is no separate `SessionUser` type; `User` is the session user.
- `ACCOUNT_TIER_PREFERENCE_KEY` is shared by reader (auth) and writer (admin) paths, defined in [src/lib/access/content-access.ts](src/lib/access/content-access.ts).
- `canUserAccessAudience({ audience, role, tier })` at [src/lib/access/content-access.ts](src/lib/access/content-access.ts) is the tier-aware access helper. The legacy `canAccessAudience(audience, role)` is unchanged and internal-only; no production call site still uses the 2-arg form.
- `CapabilityCardKind` in [src/core/entities/capability-presentation.ts](src/core/entities/capability-presentation.ts) includes `"lifecycle"`. `CapabilityFamily` already includes `"system"`.
- `SystemCardKind` in [src/frameworks/ui/chat/plugins/system/resolve-system-card.ts](src/frameworks/ui/chat/plugins/system/resolve-system-card.ts) is `"error" | "lifecycle" | null`, with lifecycle priority in `resolveSystemCardKind`.
- `LIFECYCLE_EVENT_DESCRIPTOR` in [src/frameworks/ui/chat/plugins/system/lifecycle-descriptor.ts](src/frameworks/ui/chat/plugins/system/lifecycle-descriptor.ts) carries `family: "system"`, `cardKind: "lifecycle"`, `executionMode: "inline"`, `historyMode: "payload_snapshot"`. **It is not registered in `CAPABILITY_CATALOG` or `CLIENT_CAPABILITY_CATALOG`** because lifecycle events are not LLM-tool-invocable capabilities; they are system-authored envelopes rendered via presenter passthrough. Phase 2 inherits this model for `coach` unless a deliberate reversal is documented in `evidence/phase-2.md`.
- `LifecycleVariant` in [src/core/entities/lifecycle.ts](src/core/entities/lifecycle.ts) is `installed | onboarded | role_changed | tier_upgraded | capability_unlocked`. `LifecycleEnvelope = CapabilityResultEnvelope<LifecyclePayload>`. `LifecyclePayload` is `{ variant, occurredAt, actor?, detail? }` — narrow.
- `LifecycleCard.tsx` is typed on `LifecycleEnvelope` and only handles `LifecyclePayload` today. **Coach envelopes require either extending the card to accept a union payload or introducing a sibling component that also maps to `cardKind: "lifecycle"`.** Phase 2 decides between those two options in `evidence/phase-2.md`.
- `ChatMessageMetadata.lifecycle?: LifecycleEnvelope` is present at [src/core/entities/chat-message.ts](src/core/entities/chat-message.ts). No `coach` field exists; Phase 2 decides whether coach envelopes travel as `metadata.lifecycle` (reusing the passthrough) or as a distinct `metadata.coach?` key.
- [src/adapters/ChatPresenter.ts](src/adapters/ChatPresenter.ts) forwards `message.metadata?.lifecycle` to `PresentedMessage.lifecycle`. Its existing markers `__suggestions__`, `__actions__`, `__response_state__` and `action-link` inline nodes are unchanged and already support interactive affordances.
- `MessageList.tsx` renders `<LifecycleCard>` when `message.role === "system" && message.lifecycle`, wrapped in `ErrorBoundary`. No other system-card routing exists.
- `HERO_PROOF_POINTS` in `MessageList.tsx` is already rewritten to beginner-solopreneur framing (conversation-first / governed / lifecycle-aware). Coach content does not modify this.

Existing surfaces Phase 2 binds to but does not change:

- `src/app/install/InstallWizard.tsx` is exactly 3 steps (`environment | providers | admin`) and redirects to `/welcome` on completion ([InstallWizard.tsx](src/app/install/InstallWizard.tsx)). No new install pages outside the wizard.
- `src/app/welcome/page.tsx` exists and is the post-install landing.
- `src/app/api/install/setup/route.ts` handles install completion and is the primary emission point for `system_installed`.
- `src/hooks/chat/chatState.ts` `createInitialChatMessages(role, prompts?, referralContext?)` returns hero messages only. Phase 2 does NOT modify this function. Coach content arrives as a separate envelope after the hero bootstrap.
- `src/hooks/chat/useBootstrapMessages.ts` is the role-differentiated hero dispatcher.
- `src/hooks/chat/useReferralContext.ts` is the reference pattern for pre-first-turn context: fetches `GET /api/referral/visit` once for anonymous sessions and seeds state. `useLifecycleContext` mirrors this exactly.
- `CapabilityResultEnvelope<TPayload = unknown>` in [src/core/entities/capability-result.ts](src/core/entities/capability-result.ts) is generic and carries the coach payload without new transport.

Event recorder reality:

- `ConversationEventRecorder` at [src/core/use-cases/ConversationEventRecorder.ts](src/core/use-cases/ConversationEventRecorder.ts) is conversation-scoped (requires `conversationId`).
- `ConversationInteractor.recordGenerationLifecycleEvent(conversationId, eventType, metadata)` at [src/core/use-cases/ConversationInteractor.ts](src/core/use-cases/ConversationInteractor.ts) accepts only `"generation_stopped" | "generation_interrupted"` today — **not** a general lifecycle event source.
- No user-scoped event recorder exists. Phase 1 bridged the gap for the `role_changed` variant by using `queuePendingLifecycleEvent(userId, payload)` at [src/lib/lifecycle/lifecycle-queue.ts](src/lib/lifecycle/lifecycle-queue.ts), which persists a bounded queue (cap 8) under `user_preferences(key=pending_lifecycle_events)`. **Phase 2 must decide** between (a) extending `ConversationInteractor.recordGenerationLifecycleEvent` to accept the five product lifecycle variants, (b) introducing a narrow `UserLifecycleEventRecorder`, or (c) promoting the `lifecycle-queue` helper into the canonical user-scoped recorder. The decision and rationale are recorded in `evidence/phase-2.md`.

Phase 1 emission and queue, already in place:

- `updateRoleAction` and `bulkRoleChangeAction` in [src/lib/admin/users/admin-users-actions.ts](src/lib/admin/users/admin-users-actions.ts) call `queuePendingLifecycleEvent(userId, { variant: "role_changed", ... })` after a successful role update. **Emission is live; a consumer is not.** Phase 2 wires the consumer.
- `queuePendingLifecycleEvent` skips `userId === "usr_anonymous"` and swallows errors (best-effort).

Consumer-side gap (Phase 2 scope):

- `src/hooks/chat/useLifecycleContext.ts` — **does not exist**; Phase 2 creates it.
- `src/app/api/lifecycle/context/route.ts` — **does not exist**; Phase 2 creates it. It reads and consumes from `lifecycle-queue` and returns a `LifecycleContext` object parallel to `ReferralContext`.
- `CoachPayload` type — **does not exist**; Phase 2 defines it in a new `src/core/entities/coach.ts` or as an extension of `src/core/entities/lifecycle.ts`.
- No consumer drains `pending_lifecycle_events` today; queued events sit in `user_preferences` until Phase 2.

`UserPreferencesDataMapper` already allows the two Phase-1 server-only keys (`account_tier`, `pending_lifecycle_events`) in `ALLOWED_KEYS`. The `set_preference` tool still refuses both keys; this security pin must hold through Phase 2.

Load-bearing hotspots (unchanged boundaries, do not modify):

- [src/lib/jobs/deferred-job-worker.ts](src/lib/jobs/deferred-job-worker.ts)
- [src/core/capability-catalog/runtime-tool-binding.ts](src/core/capability-catalog/runtime-tool-binding.ts)
- [src/core/use-cases/tools/search-my-conversations.tool.ts](src/core/use-cases/tools/search-my-conversations.tool.ts)

Prerequisite documentation (from `docs/_specs/codebase-health/findings-2026-04-22.md`):

- Finding F7 (system-envelope contract) should be written before Phase 2 implementation begins so coach envelopes inherit the same routing rule Phase 1 used for lifecycle. The contract is:
  1. System envelopes travel as `CapabilityResultEnvelope<TPayload>` with `family: "system"` and a registered `cardKind`.
  2. Persisted on `role: "system"` chat messages via `ChatMessage.metadata.<kind>?`.
  3. Forwarded by `ChatPresenter.present()` via a matching `PresentedMessage.<kind>?` field.
  4. Rendered by `MessageList` when the presenter field is truthy, wrapped in `ErrorBoundary`.

This phase changes:
- a single user-scoped lifecycle event source covering `system_installed`, `user_onboarded`, `role_promoted`, `tier_upgraded`, decided per above (extend `recordGenerationLifecycleEvent`, new recorder, or promote `lifecycle-queue`)
- emission points: install completion in [/api/install/setup](src/app/api/install/setup/route.ts), and role promotion via [admin-users-actions.ts](src/lib/admin/users/admin-users-actions.ts) (already emits `role_changed`; extended to also mark post-completion coach mode)
- coach envelope implemented as `CapabilityResultEnvelope<CoachPayload>` with `family: "system"`, `cardKind: "lifecycle"`, and `payload: { steps[], currentStep, actions[] }`; no new `MessagePart` type, no new stream event type, no new presenter marker
- decision on `LifecycleCard` extension vs new `CoachCard` (both map to `cardKind: "lifecycle"`); outcome documented in `evidence/phase-2.md`
- decision on `ChatMessageMetadata.coach?` vs reusing `metadata.lifecycle`; outcome documented in `evidence/phase-2.md`
- new client hook [src/hooks/chat/useLifecycleContext.ts](src/hooks/chat/useLifecycleContext.ts) modeled on `useReferralContext`, fetching `GET /api/lifecycle/context` once before first assistant turn and setting a bounded coach-mode flag in chat state
- new route [src/app/api/lifecycle/context/route.ts](src/app/api/lifecycle/context/route.ts) that reads, validates, and consumes the user's pending lifecycle queue
- coach card rendering via the chosen component path (extension of `LifecycleCard` or a new sibling), both using `CapabilityCardShell` + `CapabilityTimeline`
- coach content sourced from audience-filtered corpus entries tagged `class: manual` or `class: training`, retrieved through existing interactors and gated by `canUserAccessAudience`
- install continuation after `/welcome` becomes a coach-guided conversation for identity, services, first assistant test, and referral enablement
- authenticated first-run hero bootstrap is unchanged; the coach sequence arrives as a separate envelope driven by lifecycle context, not by modifying `createInitialChatMessages`
- role promotion continues to emit `role_changed` (already live) and additionally enters coach mode for the new role

This phase does not change:
- the initial 3 install wizard steps themselves
- `createInitialChatMessages` in `src/hooks/chat/chatState.ts` (hero-only, Phase 2 pin)
- the base prompt composition contract
- tool registry composition
- `set_preference` tool writability of `account_tier` or `pending_lifecycle_events` (both remain rejected)
- the legacy `canAccessAudience` export or `AUDIENCE_ROLES.premium`
- hotspots (`deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`)

Primary files:
- src/core/entities/coach.ts (new, or extension of src/core/entities/lifecycle.ts)
- src/core/entities/chat-message.ts (optional `metadata.coach?` addition)
- src/adapters/ChatPresenter.ts (optional passthrough for coach metadata)
- src/frameworks/ui/chat/plugins/system/LifecycleCard.tsx or new CoachCard.tsx
- src/frameworks/ui/chat/plugins/system/resolve-system-card.ts (no change; lifecycle already routes)
- src/hooks/chat/useLifecycleContext.ts (new)
- src/hooks/chat/chatState.ts (state flag for coach mode; no change to createInitialChatMessages)
- src/app/api/lifecycle/context/route.ts (new)
- src/app/api/install/setup/route.ts (emit `system_installed`)
- src/app/admin/users/[id] action layer (emit `user_onboarded` / coach trigger on first authenticated turn)
- src/lib/lifecycle/lifecycle-queue.ts (producers unchanged; add consumer path)
- src/core/use-cases/UserAdminInteractor.ts (no change unless Phase 2 decision relocates emission)
- src/core/use-cases/ConversationInteractor.ts (only if extending `recordGenerationLifecycleEvent` per the recorder decision)
- src/app/welcome/page.tsx (coach hand-off trigger)

QA gate:
- focused behavior check: a new authenticated user receives a lifecycle card and a working coach sequence with `action-link` next actions
- relevant regression check: chat flow is unchanged for users without an active lifecycle event; Phase 1 regression suite (access, library, corpus, presentation, error-standardization, public-content-routes — 124 tests) still passes; `set_preference` security pin still passes
- truth check: coach steps are only marked complete after the user actually performs them; coach content is never drawn from material the viewer audience cannot access; honest disclosure contract holds

Exit criteria:
- install continuation, first-run onboarding, and role promotion all use the same lifecycle-plus-coach path
- coach content is audience-filtered corpus content
- decisions on recorder strategy, card strategy, and metadata field are documented in `evidence/phase-2.md`
- QA gate passed

---

## Phase 3: Referral, QR, and campaign simplification

Goal:
- the growth funnel is usable by a beginner without needing to understand the platform

Carry-forward reality (refreshed 2026-04-22 after Phase 2 close):
- the referral foundation is technically strong and verified intact:
  - signed visits via `src/lib/referrals/referral-visit.ts` (`createReferralVisitCookieValue`, `resolveValidatedReferralVisit`, `REFERRAL_VISIT_COOKIE_NAME`, 30-day cookie via `REFERRAL_VISIT_MAX_AGE_SECONDS`)
  - snapshot lookup in `src/lib/referrals/referral-resolver.ts` (`getActiveReferralSnapshot(code)`)
  - ledger in `src/lib/referrals/referral-ledger.ts` (`recordValidatedVisit`)
  - QR generation at `src/app/api/qr/[code]/route.ts` (rate-limited, gated on `affiliate_enabled = 1` on `users` table)
  - visit POST at `src/app/api/referral/[code]/route.ts`; anonymous visit peek at `GET /api/referral/visit/route.ts`
  - admin affiliate toggle at `src/app/admin/users/[id]/page.tsx`
- `src/app/r/[code]/page.tsx` is a server component that does **not** redirect. It renders a trustworthy landing page with the referrer's name/credential and two CTAs ("Start chat" → `/`, "Open library" → `/library`); visit cookie is signed by the `ReferralVisitActivator` client component on mount. Inactive codes fall through to `PublicStatusPage`.
- `src/components/referrals/ReferralsWorkspace.tsx` today exposes only metrics (Introductions, Started chats, Registered, Qualified opportunities, Credit status, timeseries chart, funnel chart) plus five share-asset buttons and a single static CTA string produced by `buildCtaCopy(referralUrl)`. There are **zero campaign presets** and no campaign guidance copy. Phase 3 is additive, not refactor-heavy.
- `ReferralQrCard` already exists in the chat surface at `src/frameworks/ui/chat/plugins/custom/ReferralQrCard.tsx`, registered in `src/frameworks/ui/chat/registry/default-tool-registry.ts` as the renderer for `get_my_referral_qr` (tool defined in `src/core/use-cases/tools/user-profile.tool.ts`). It uses the standard `CapabilityCardShell` + `CapabilityContextPanel` primitives. No changes to the QR tool itself are in scope; Phase 3 wraps it with guidance, it does not rebuild it.
- Phase 2 primitives that Phase 3 reuses (verified in `evidence/phase-2.md`):
  - `useReferralContext` + `GET /api/referral/visit` at `src/hooks/chat/useReferralContext.ts` — the reference pattern for anonymous context hydration. Phase 3's post-landing coach emission rides on the **same** hook, extending it to attach a campaign-driven coach envelope when a signed referral visit is detected (authenticated path goes through `useLifecycleContext` with a new emission variant; see decisions).
  - `CoachPayload`, `CoachEnvelope`, `CoachAction`, `CoachStep`, `COACH_TOOL_NAME = "coach_sequence"` at `src/core/entities/coach.ts`. Note: `CoachPayload.variant` is currently typed as `LifecycleVariant` (`installed | onboarded | role_changed | tier_upgraded | capability_unlocked`). Phase 3 must decide whether to widen this union or reuse an existing variant for campaign-scoped coach cards; see open decisions.
  - `CoachCard` at `src/frameworks/ui/chat/plugins/system/CoachCard.tsx` and `COACH_DESCRIPTOR` at `src/frameworks/ui/chat/plugins/system/coach-descriptor.ts` (family `"system"`, cardKind `"lifecycle"`, NOT registered in `CAPABILITY_CATALOG`).
  - `ChatMessageMetadata.coach?` in `src/core/entities/chat-message.ts` is payload-agnostic — Phase 3 can attach a campaign coach envelope without inventing a new metadata key.
  - `MessageFactory.createSystemMessage(metadata)` and the `APPEND_MESSAGES` reducer action at `src/hooks/chat/chatState.ts` are the canonical authoring path for system-scope coach messages.
  - `buildCoachPayloadForLifecycle(event)` at `src/lib/lifecycle/coach-templates.ts` is the template-per-variant pattern Phase 3 mirrors for campaign templates.
  - F7 system-envelope contract at `docs/_specs/codebase-health/f7-system-envelope-contract.md` still governs any new envelope.
- `class: "guide"` corpus entries do not yet exist. Phase 3 is the first slice to add them. The `class` field on `DocumentManifest` and `Section` landed in Phase 0.
- Phase 2 pins still hold and must survive Phase 3:
  - `createInitialChatMessages` stays hero-only
  - `set_preference` still refuses `account_tier` and `pending_lifecycle_events`
  - Hotspots untouched: `deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`
- Phase 2 explicitly deferred corpus-sourced coach content to the retrieval slice of Phase 4. Phase 3 coach templates continue to reference only surfaces that exist today (`/`, `/library`, `/referrals`, `/admin/settings`) — no synthetic capabilities, no aspirational copy. Corpus-sourced campaign coach content is a Phase 4 follow-up.

Open decisions (must be resolved in `evidence/phase-3.md`):
1. **Coach variant strategy for non-lifecycle coach.** Either widen `CoachPayload.variant` to a discriminated union (`LifecycleVariant | CampaignVariant`) or reuse an existing lifecycle variant (e.g. `capability_unlocked`) for the campaign coach and differentiate via `title`/`toolName`. The former is cleaner but touches the Phase 2 type surface; the latter is a zero-change path.
2. **Campaign coach emission path for anonymous visitors.** Either extend `useReferralContext` to dispatch a second `APPEND_MESSAGES` carrying the campaign coach when a signed visit is present, or add a parallel `useCampaignContext` hook that runs after it. The former shares one fetch; the latter keeps the two concerns separable.
3. **Campaign preset source of truth.** Either hard-code presets in `src/lib/referrals/campaign-presets.ts` (typed constants), or load them from `class: "guide"` corpus entries. Phase 3 likely needs both: code-side type for the preset shape, corpus-side copy for the longer guidance body, with the code referencing the corpus slug — but this must be explicitly chosen.
4. **Metrics pruning.** `ReferralsWorkspace` surfaces five metrics today. Some (e.g. "Qualified opportunities", "Credit status") can imply capabilities the product does not honestly deliver for a beginner. Phase 3 must decide which metrics to keep, which to label as "coming soon", and which to remove — decision recorded with the exact removal list.

This phase changes:
- `src/app/r/[code]/page.tsx` — reposition landing copy/CTAs so the beginner visitor's next step is obvious; "Start chat" becomes the single primary action, secondary actions simplified
- `src/hooks/chat/useReferralContext.ts` (or a new `useCampaignContext.ts`, per decision 2) — attach a campaign coach envelope when a signed referral visit is detected
- `src/components/referrals/ReferralsWorkspace.tsx` — add campaign preset cards and QR usage guidance; prune metrics per decision 4
- new `src/lib/referrals/campaign-presets.ts` — typed preset list (e.g. `friends_and_family`, `local_flyers`, `lightweight_paid_outreach`)
- new coach-template module for campaign variants (colocated with presets or in `src/lib/lifecycle/coach-templates.ts`, per decision 1)
- `docs/_corpus/**` — small set of `class: "guide"` entries covering the above campaign patterns
- simple, plain-language campaign metrics only where the product can honestly deliver them

This phase does not change:
- signed visit validation, cookie lifetime, or HMAC
- low-level analytics storage design unless strictly required for simplification
- unrelated admin analytics surfaces
- the QR route, QR rate limiter, or `affiliate_enabled` toggle semantics
- `ReferralQrCard` itself — Phase 3 wraps it, does not rebuild it
- Phase 2 pins (hero-only init, `set_preference` refusal list, hotspot list)

Primary files:
- src/app/referrals/page.tsx
- src/components/referrals/ReferralsWorkspace.tsx
- src/app/api/qr/[code]/route.ts (read-only for Phase 3)
- src/app/r/[code]/page.tsx
- src/hooks/chat/useReferralContext.ts (or new useCampaignContext.ts)
- src/lib/referrals (adds `campaign-presets.ts` + campaign-coach template)
- src/core/entities/coach.ts (only if decision 1 widens variant)
- docs/_corpus (new `class: guide` campaign content)

QA gate:
- focused behavior check: a beginner `account` user can land on `/r/[code]`, click "Start chat", and receive a campaign-scoped coach card in chat without seeing any lifecycle-specific eyebrow or copy drift; an authenticated user who opens `/referrals` can pick a campaign preset, get a QR asset, and receive a coach-guided next step
- relevant regression check: referral attribution, visit signing, ledger recording, QR rate-limiting, `affiliate_enabled` gating, and existing `useReferralContext` seeding all remain intact; Phase 2 regression (116/116) stays green
- truth check: campaign metrics and CTA copy do not imply capabilities the product does not yet deliver; campaign presets reference only surfaces that exist; no premium-gated copy leaks into the anonymous/account landing; corpus `class: "guide"` entries are tagged with an honest audience (defaults to `public` or `account`) and never draw from non-viewable material

Exit criteria:
- campaign creation and QR usage are explainable by a non-technical user
- referral and QR flows are powered by cards and coach guidance end to end
- four open decisions recorded in `evidence/phase-3.md`
- QA gate passed

---

## Phase 4: Business assistant, audience-aware retrieval, and role personas

Goal:
- the assistant behaves like a practical business helper, its knowledge is filtered honestly at the retrieval layer, and it can speak from a specific role manual

Carry-forward reality (refreshed 2026-04-22 after Phase 3 close; all claims verified against current code):

Retrieval layer, current state:
- `src/core/search/HybridSearchEngine.ts` currently retrieves chunks via `vectorStore.getAll(storeQuery)` and does **not** filter by audience at the vector layer; filtering happens post-retrieval in the interactor
- `VectorQuery` in `src/core/search/ports/VectorStore.ts` has only `sourceType?`, `chunkLevel?`, `limit?` — no audience, class, or rolePersona fields
- `DocumentChunkMetadata` in `src/core/search/ports/Chunker.ts` does not carry `audience`, `class`, or `rolePersona` today
- `scripts/build-search-index.ts` does not inject `audience`/`class`/`rolePersona` into chunk metadata during indexing. The underlying corpus Section entity carries these fields; the indexer must be extended before vector-layer filtering can be trusted
- `src/core/use-cases/LibrarySearchInteractor.ts` already filters sections via `canUserAccessAudience({ audience, role, tier })` as defense-in-depth; that check stays after Phase 4
- `src/core/use-cases/tools/CorpusTools.ts` delegates `search_corpus` execution to `LibrarySearchInteractor.execute`, which inherits the same audience filter

Phase 0 inheritance (types landed, corpus unused):
- `ContentClass = "manual" | "guide" | "training" | "reference" | "article"` and `RolePersona = "sales" | "scheduling" | "front_desk" | "operator" | "founder"` are defined in `src/core/entities/corpus.ts`
- Zero corpus files currently use `class:` or `rolePersona:` frontmatter keys. Phase 4 is the first slice to author them
- `ContentAudience = "public" | "account" | "premium" | "apprentice" | "staff" | "admin"` is defined in `src/lib/access/content-access.ts` (note: includes `apprentice`; Phase 4 audience filtering must preserve the full six-value union)
- `canAccessAudience(audience, role)` and `canUserAccessAudience({ audience, role, tier })` are the only access helpers; Phase 4 filtering must call the tier-aware variant

Phase 1 inheritance:
- `UserTier = "account" | "premium"` is the canonical tier union (`src/core/entities/user.ts`). The tier-flip write path is `setAccountTier` in `src/lib/lifecycle/account-tier.ts`; Phase 4 does not duplicate it. Any tier-gated retrieval decision reads the tier via the authenticated session, never from a client payload
- `ToolDescriptor.roles` in `src/core/tool-registry/ToolDescriptor.ts` gates by role only (`RoleName[] | "ALL"`). Phase 4 introduces no tool-level audience gating — persona and audience affect retrieval, not tool availability

Phase 2 inheritance:
- F7 envelope contract unchanged: `family: "system"` cards ride on `ChatMessageMetadata.coach` / `ChatMessageMetadata.lifecycle`, are authored via `MessageFactory.createSystemMessage`, and are NOT registered in `CAPABILITY_CATALOG`. Phase 4 must treat any coach-like output it adds the same way
- Coach content is templated today via `buildCoachPayloadForLifecycle` in `src/lib/lifecycle/coach-templates.ts`; corpus-sourced coach content was explicitly deferred from Phase 2 to this phase. Phase 4 replaces (or augments) the templated path with retrieval-backed coach copy sourced from `class: "guide" | "manual" | "training"` entries filtered by audience and tier

Phase 3 inheritance:
- Campaign coach rides on the same F7 envelope via `ChatMessageMetadata.coach` and variants `campaign_introduction` / `campaign_picked` (`src/core/entities/campaign.ts`). Phase 4 does not introduce new coach variants; if retrieval-backed copy replaces templated copy, it mutates `CoachPayload.steps` content, not the variant union
- `CampaignPreset` in `src/lib/referrals/campaign-presets.ts` carries a `corpusSlug` forward hint on each of the three presets (`campaign/friends-and-family`, `campaign/local-flyers`, `campaign/lightweight-paid-outreach`). Zero corpus entries exist at those slugs today. Phase 4 authors them under `class: "guide"` and wires the retrieval-backed coach path to use them when present, with a fallback to the Phase 3 templated builder
- `pending_lifecycle_events` and `pending_campaign_coach` remain server-only preference keys. `set_preference` refusal list in `src/core/use-cases/tools/set-preference.tool.ts` continues to refuse them (Phase 4 does not relax this)

Hotspot contract (unchanged since Phase 2):
- `src/lib/jobs/deferred-job-worker.ts`, `src/core/capability-catalog/runtime-tool-binding.ts`, and `src/core/use-cases/tools/search-my-conversations.tool.ts` remain load-bearing and untouched through Phase 3; Phase 4 continues to treat them as stable boundaries

Indexing reality:
- `scripts/build-search-index.ts` has no incremental path today. Phase 4 requires a full rebuild after the new chunk metadata fields land, and the evidence file records the build duration plus the chunk count before and after

Open decisions (must be resolved in `evidence/phase-4.md`):

1. **Vector-layer filtering trust model** — should `HybridSearchEngine` apply `allowedAudiences` **before** ranking (narrow first, rank second) or **after** ranking (rank first, then drop disallowed chunks)? Pre-rank is cheaper and honest; post-rank preserves ranking invariants from today. Decision controls whether the interactor-level filter is still reachable in production.
2. **`class` filtering semantics** — does `class: "training"` restrict retrieval to `staff`/`admin` irrespective of `audience`, or is it purely a zoning signal with retrieval still driven by `audience`? Same question for `class: "manual"` and `rolePersona`.
3. **rolePersona activation path** — persona selection at runtime happens via (a) a new prompt directive read from preferences, (b) a router injected into `prompt-runtime`, or (c) an explicit tool input. Decision controls where persona is wired without changing `ToolDescriptor.roles`.
4. **Library zoning implementation** — zones introduced inline in `src/app/library/page.tsx` (currently a flat book grid), or a new `components/library/ZonedLibraryView.tsx` that takes the already-filtered `ReadableBook[]` and renders three sections keyed by `class`. Decision controls test surface.
5. **Campaign corpus slug authoring** — author exactly the three slugs referenced by `CampaignPreset.corpusSlug` as `class: "guide"` entries (zero drift), or broader guide authoring this phase. Phase 3 only promises the three; the retrieval-backed coach must gracefully fall back to the templated Phase 3 builder when a slug is missing.
6. **Primary-file path correction** — the earlier draft referenced `src/lib/chat/tool-composition-root.ts` and `src/lib/chat/prompt-runtime.ts`; neither exists. Phase 4 must name the real prompt-runtime and tool-composition entry points (candidates: `src/lib/chat/promptRuntime.ts` or `src/core/prompt-runtime/*`, `src/core/capability-catalog/runtime-tool-binding.ts`) or explicitly create new modules, and record the choice in evidence.

This phase changes:
- extend `DocumentChunkMetadata` in `src/core/search/ports/Chunker.ts` with optional `audience`, `class`, `rolePersona`
- extend `scripts/build-search-index.ts` to inject those fields into chunk metadata from each Section's frontmatter during indexing; record full-rebuild duration in evidence
- add optional `allowedAudiences: ContentAudience[]` (and, per decision 2, optional `classes?: ContentClass[]` and `rolePersonas?: RolePersona[]`) to `VectorQuery` in `src/core/search/ports/VectorStore.ts` and respect it in `HybridSearchEngine` per decision 1
- keep `LibrarySearchInteractor`'s `canUserAccessAudience` call as a truth-check fallback
- use `rolePersona` to let the assistant speak as `sales`, `scheduling`, `front_desk`, `operator`, or `founder` backed by the corresponding manual, via the emission path decided in decision 3
- require non-prose assistant output to be a typed `CapabilityResultEnvelope` with a valid `cardKind` (contract unchanged from F7; Phase 4 just tightens enforcement at the prompt-runtime boundary)
- make citations visible in search-backed cards, and disclose when the assistant is falling back to general knowledge
- restructure the library at `src/app/library/page.tsx` into three zones: `Your manual`, `Training`, and `Reference`, per decision 4, all driven by the same audience-aware access model
- author the three `class: "guide"` campaign corpus entries referenced by `CampaignPreset.corpusSlug`, and wire the retrieval-backed coach path to use them when present with a templated fallback
- optionally gate a deep-search behavior to `premium` via `allowedAudiences`, not via a new tool

This phase does not change:
- core hybrid retrieval algorithms unless a trust or performance issue requires it
- deferred worker orchestration unless it blocks user-visible behavior
- staff-only operator tools
- the F7 envelope contract, `CAPABILITY_CATALOG`, `ChatMessageMetadata` shape, or `MessageFactory.createSystemMessage`
- the hotspot list (`deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`)
- Phase 2/3 pins: `createInitialChatMessages` hero-only, `set_preference` refusal list (`account_tier`, `pending_lifecycle_events`, `pending_campaign_coach`), campaign queue contract, referral HMAC / cookie lifetime
- Phase 3 `CampaignPreset.variant` union (`campaign_introduction`, `campaign_picked`); Phase 4 mutates step content, never the variant

Primary files (to be refined per decision 6 during implementation):
- src/core/search/ports/VectorStore.ts
- src/core/search/ports/Chunker.ts
- src/core/search/HybridSearchEngine.ts
- scripts/build-search-index.ts
- src/core/use-cases/LibrarySearchInteractor.ts
- src/core/use-cases/tools/CorpusTools.ts
- src/core/entities/corpus.ts (if new filter helpers land here)
- src/lib/access/content-access.ts (if tier-aware class/persona helpers are added)
- src/app/library/page.tsx
- src/components/library/ (new zoned view per decision 4)
- docs/_corpus/**/*.md (authoring the three `class: "guide"` campaign entries and the first `rolePersona`-tagged manuals)

QA gate:
- focused behavior check: an `account` user cannot retrieve `admin` passages through either the vector layer or the interactor layer; an `account` user picking the `friends_and_family` preset sees retrieval-backed coach copy sourced from the newly-authored `campaign/friends-and-family` guide
- relevant regression check: existing `admin` and `staff` retrievals still return their expected content; Phase 3 templated fallback still works for slugs that have no corpus entry; Phase 2/3 tests stay green
- truth check: assistant output clearly marks whether an answer came from the viewer's manual, from general reference, or from unattributed knowledge; zero drift between corpus audience/class/rolePersona and the filters applied in `HybridSearchEngine`

Exit criteria:
- retrieval is audience-aware end to end (vector layer + interactor fallback)
- `rolePersona` backs working assistant personas via the emission path in decision 3
- library is zoned by `Your manual`, `Training`, and `Reference` per decision 4
- the three campaign `class: "guide"` corpus entries are authored and the retrieval-backed coach path uses them (Phase 3's honest `[~]` item flips to `[x]`)
- all six open decisions are resolved in `evidence/phase-4.md`
- QA gate passed

---

## Phase 5: Operational complexity isolation and admin training surface

Goal:
- advanced capability power stays, but stops leaking into the beginner-facing product, and staff and admin get a real training and runbook surface

Carry-forward reality (refreshed 2026-04-22 after Phase 4 close; all claims verified against current code):

Phase 0–4 inheritance that Phase 5 binds to but does not duplicate:

- `ContentAudience = "public" | "account" | "premium" | "apprentice" | "staff" | "admin"`, `ContentClass = "manual" | "guide" | "training" | "reference" | "article"`, and `RolePersona = "sales" | "scheduling" | "front_desk" | "operator" | "founder"` all landed in Phase 0 (`src/core/entities/corpus.ts`, `src/lib/access/content-access.ts`).
- `canUserAccessAudience({ audience, role, tier })` and `getAllowedAudiencesForUser({ role, tier })` in [src/lib/access/content-access.ts](src/lib/access/content-access.ts) are the only access helpers Phase 5 calls. Legacy 2-arg `canAccessAudience(audience, role)` stays exported; no production call site still uses it.
- `UserTier = "account" | "premium"` attached on `User` via `getSessionUser()` + `resolveUserTier()` in [src/lib/auth.ts](src/lib/auth.ts). `setAccountTier` in [src/lib/lifecycle/account-tier.ts](src/lib/lifecycle/account-tier.ts) remains the single write path for `account_tier`; Phase 5 never duplicates it.
- F7 system-envelope contract at [docs/_specs/codebase-health/f7-system-envelope-contract.md](docs/_specs/codebase-health/f7-system-envelope-contract.md) is unchanged: system envelopes ride on `ChatMessage.metadata.<kind>?`, are authored via `MessageFactory.createSystemMessage`, forwarded by `ChatPresenter.present()`, and NOT registered in `CAPABILITY_CATALOG`. Any new coach-prompt rendering Phase 5 adds must obey this contract.
- `CapabilityCardKind` in [src/core/entities/capability-presentation.ts](src/core/entities/capability-presentation.ts) = `editorial_workflow | search_result | artifact_viewer | theme_inspection | profile_summary | journal_workflow | media_render | lifecycle | fallback`. No `coach` cardKind exists; coach cards map to `lifecycle`. Phase 5 does NOT add new cardKinds.
- `CoachPayload`, `CoachEnvelope`, `CoachAction`, `CoachStep`, `COACH_TOOL_NAME` in [src/core/entities/coach.ts](src/core/entities/coach.ts); `CoachCard` in [src/frameworks/ui/chat/plugins/system/CoachCard.tsx](src/frameworks/ui/chat/plugins/system/CoachCard.tsx); `CoachPayload.variant = LifecycleVariant | CampaignVariant`. Phase 5 mutates step content and authorship source, not the variant union.
- Templated coach builders exist at [src/lib/lifecycle/coach-templates.ts](src/lib/lifecycle/coach-templates.ts) (`buildCoachPayloadForLifecycle`) and [src/lib/referrals/campaign-presets.ts](src/lib/referrals/campaign-presets.ts) (`buildCampaignPresetCoachPayload` templated + `buildCampaignPresetCoachPayloadFromCorpus` retrieval-backed with templated fallback). Phase 5 generalizes the retrieval-backed pattern to lifecycle coach content.
- Retrieval is audience-aware end to end: `DocumentChunkMetadata` carries `audience | contentClass | rolePersona`; `VectorQuery` carries `allowedAudiences | classes | rolePersonas`; `HybridSearchEngine` narrows before ranking; `LibrarySearchInteractor` keeps the post-retrieval truth-check. Phase 5 reuses this spine for any admin-facing retrieval.
- Library zoning landed inline at [src/app/library/page.tsx](src/app/library/page.tsx) with `LibraryZoneKey = "your_manual" | "training" | "reference"` and `ZONE_DEFINITIONS` mapping `manual → your_manual`, `training|guide → training`, `reference|article|default → reference`. Phase 5's admin training surface reuses the access model, not the zoning component.
- `set_preference` refusal list in [src/core/use-cases/tools/set-preference.tool.ts](src/core/use-cases/tools/set-preference.tool.ts) `SUPPORTED_PREFERENCE_KEYS` is exactly `["response_style", "tone", "business_context", "preferred_name"]`. By omission it refuses `account_tier`, `pending_lifecycle_events`, `pending_campaign_coach`, `role_persona`. Phase 5 may add a new server-only preference key (e.g. for persona-scoped admin training progress); it MUST NOT add any to `SUPPORTED_PREFERENCE_KEYS`.

Current Phase 5 gaps (verified 2026-04-22):

- [src/app/admin/training/[id]/page.tsx](src/app/admin/training/[id]/page.tsx) is an 18-line stub that calls `permanentRedirect(getAdminLeadsDetailPath(id))`. No training content, no listing. Phase 5 builds the real surface.
- `PromptSlotType = "base" | "role_directive"` in [src/core/use-cases/PromptControlPlaneService.ts](src/core/use-cases/PromptControlPlaneService.ts). No `"coach"` value yet. Admin prompts route at [src/app/admin/prompts/[role]/[promptType]/page.tsx](src/app/admin/prompts/[role]/[promptType]/page.tsx) drives the admin CRUD surface. Phase 5 widens the union (no schema change — `system_prompts` table already keys by `(role, promptType, version)`).
- Zero `class: "manual"` or `class: "training"` corpus entries exist today. Four `class: "guide"` entries exist (three Phase 4 campaign guides + the campaign book manifest). The `/admin/training/[id]` backing content has to be authored.
- No admin content-visibility / coverage-audit page exists under `src/app/admin/`. Existing admin routes are `affiliates/`, `conversations/`, `deals/`, `jobs/`, `journal/`, `leads/`, `prompts/`, `system/`, `training/`, `users/`. Phase 5 adds one (naming recorded in decision 3).
- Pre-existing search-index rebuild blocker: [docs/_corpus/operators-handbook/](docs/_corpus/operators-handbook/) has `book.json` but no `chapters/` directory, causing `FileSystemCorpusRepository.getSectionsByDocument` to throw `ResourceNotFoundError`. Phase 4 evidence explicitly deferred resolution to Phase 5. Phase 5 either authors the missing chapters under `class: "manual"` / `class: "training"`, or removes the stub `book.json` with a rationale recorded in evidence. Either decision unblocks `npm run build:search-index:force`.
- End-user deferred media and job surfaces currently expose runtime jargon in some fallback strings. The scope of "plain-language honest status" in Phase 5 is bounded to user-facing copy only — it MUST NOT restructure the hotspots ([src/lib/jobs/deferred-job-worker.ts](src/lib/jobs/deferred-job-worker.ts), [src/core/capability-catalog/runtime-tool-binding.ts](src/core/capability-catalog/runtime-tool-binding.ts), [src/core/use-cases/tools/search-my-conversations.tool.ts](src/core/use-cases/tools/search-my-conversations.tool.ts)).

Open decisions (must be resolved in `evidence/phase-5.md`):

1. **Operators-handbook stub resolution** — author `class: "manual"` chapters under `docs/_corpus/operators-handbook/chapters/` (how many, which `rolePersona` tags), or remove `book.json` and carry the intent forward to a later slice. Either way records pre/post `npm run build:search-index:force` duration and chunk counts in evidence, finally flipping Phase 4's `[~]` on search-index rebuild.
2. **`PromptSlotType` extension for coach variants** — widen `PromptSlotType` to `"base" | "role_directive" | "coach"`, or introduce a sibling key (`coachVariant`) alongside `promptType`. The former touches the existing admin CRUD route shape (one more URL segment value) but reuses the versioning surface. The latter keeps `promptType` stable at the cost of a second prompt dimension.
3. **Admin content-visibility page location** — new route at `src/app/admin/content-visibility/page.tsx` vs `src/app/admin/coverage/page.tsx` vs a tab inside `src/app/admin/prompts/page.tsx`. Decision recorded with rationale; page lists documents and sections with their visible audiences and flags drift (e.g. a document tagged `audience: "public"` with zero visible sections at `public`).
4. **Beginner vs operator card separation strategy** — tag existing capability descriptors with an operator-only boolean at the registry layer, or split the capability catalog into two registry maps keyed by audience. Must not introduce a new cardKind (F7 contract) and must not alter `ToolDescriptor.roles` semantics.
5. **Training surface authentication model** — `/admin/training/[id]` gated at `requireAdminPageAccess()` (current admin pattern) vs `requireRole([STAFF, ADMIN])`. The former is strict; the latter matches the "staff and admin get a real training and runbook surface" goal. Decision affects which roles actually see the new surface.

This phase changes:
- end-user-facing job and media status copy in existing capability cards / progress strips uses plain language (no engine names, no stage-ID jargon), without touching the hotspots
- [src/core/use-cases/PromptControlPlaneService.ts](src/core/use-cases/PromptControlPlaneService.ts) extends `PromptSlotType` per decision 2; [src/app/admin/prompts/](src/app/admin/prompts) surface handles the new value in URL params, forms, and list rendering; no `system_prompts` schema migration
- [src/app/admin/training/[id]/page.tsx](src/app/admin/training/[id]/page.tsx) replaces `permanentRedirect` with a real page backed by `class: "manual"` / `class: "training"` corpus content, filtered by viewer role per decision 5; a sibling listing at `src/app/admin/training/page.tsx` is added if a navigation entry is needed
- one new admin page (per decision 3) showing document/section audience coverage with drift warnings; data sourced from `FileSystemCorpusRepository` + `canUserAccessAudience` fan-out
- new `docs/_corpus/**` entries under `class: "manual"` and/or `class: "training"` frontmatter to back the admin training surface and resolve the operators-handbook stub per decision 1
- registry-level signal per decision 4 so beginner-facing MessageList rendering never surfaces operator diagnostic cards to `account` / `premium` / `apprentice` sessions
- evidence file at `evidence/phase-5.md` recording all five decisions, file inventory, focused-behavior walkthroughs, truth-check note, and the finally-resolved search-index rebuild duration

This phase does not change:
- the existence of advanced runtimes or integrations
- core operational capabilities required by staff and admin
- internal-only observability tools unless a boundary issue requires it
- the F7 envelope contract, `CAPABILITY_CATALOG`, `ChatMessageMetadata` shape, or `MessageFactory.createSystemMessage`
- the hotspot list (`deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`) — copy changes route through user-facing surfaces, never through these files
- Phase 0–4 pins: `createInitialChatMessages` hero-only; `SUPPORTED_PREFERENCE_KEYS` refusal list; `setAccountTier` as the sole `account_tier` writer; `UserTier` union; tier-aware access helpers; library zoning; F7 envelope contract; `CoachPayload.variant` union; campaign queue contract; referral HMAC / cookie lifetime; search chunk metadata shape; `HybridSearchEngine` narrow-before-rank behavior
- persona activation path (Phase 4 decision 3); `role_persona` remains server-written only

Primary files (refined per decisions during implementation):
- [src/core/use-cases/PromptControlPlaneService.ts](src/core/use-cases/PromptControlPlaneService.ts) — widen `PromptSlotType` per decision 2
- [src/app/admin/prompts/page.tsx](src/app/admin/prompts/page.tsx), [src/app/admin/prompts/[role]/[promptType]/page.tsx](src/app/admin/prompts/[role]/[promptType]/page.tsx), [src/lib/admin/prompts/admin-prompts-actions.ts](src/lib/admin/prompts/admin-prompts-actions.ts), [src/lib/admin/prompts/admin-prompts-routes.ts](src/lib/admin/prompts/admin-prompts-routes.ts) — accept the new slot value
- [src/app/admin/training/[id]/page.tsx](src/app/admin/training/[id]/page.tsx) — rebuild as real training surface
- `src/app/admin/content-visibility/` or equivalent per decision 3 — new coverage-audit page
- [src/core/capability-catalog/](src/core/capability-catalog) — operator-vs-beginner registry signal per decision 4
- [src/frameworks/ui/MessageList.tsx](src/frameworks/ui/MessageList.tsx) and capability-card plugins under `src/frameworks/ui/chat/plugins/` — user-facing copy pass; operator-card filter
- [docs/_corpus/operators-handbook/](docs/_corpus/operators-handbook) — resolve stub per decision 1
- `docs/_corpus/**` — new `class: "manual"` / `class: "training"` entries
- [src/core/use-cases/tools/set-preference.tool.ts](src/core/use-cases/tools/set-preference.tool.ts) — remains unchanged (any new server-only preference key adds to `UserPreferencesDataMapper.ALLOWED_KEYS` only)

QA gate:
- focused behavior check: (a) one end-user deferred media path shows plain honest state to an `account` user and full diagnostic state to an `admin`; (b) a staff user navigating to `/admin/training/<id>` reads real `class: "manual"` / `class: "training"` content filtered by role per decision 5; (c) the new content-visibility page correctly flags at least one drift case (e.g. a document whose only visible sections require `staff` despite `audience: "public"` on the manifest); (d) admin prompt editor can create, version, and activate a `coach` prompt per decision 2; (e) `npm run build:search-index:force` completes end to end with the operators-handbook stub resolved per decision 1
- relevant regression check: Phases 0–4 regression suites stay green (access-control, LibrarySearchInteractor, CorpusTools, HybridSearchEngine / vector-store filters, lifecycle + coach envelope flows, campaign coach + QR, library zoning, F7 contract, `set_preference` refusal pin, hotspot untouched pin); admin prompt base/role-directive flows keep working unchanged for existing `PromptSlotType` values
- truth check: beginner-facing copy never exposes hotspot-internal jargon; admin content-visibility page never reports a capability the product does not deliver; `/admin/training/[id]` surfaces only content the viewer's role actually grants via `canUserAccessAudience`; coach prompts never render to a viewer whose audience the underlying corpus section forbids; no new cardKind, no new MessagePart, no new presenter marker, no new stream event

Exit criteria:
- beginner-facing surfaces stay simple and plain-language honest
- advanced capability power is intact behind the boundary (staff/admin operational tools unchanged)
- admins have real prompt (including `coach`), coach content, and content-visibility surfaces
- `/admin/training/[id]` is a real training surface backed by `class: "manual"` and `class: "training"` content, not a redirect
- Phase 4's `[~]` search-index rebuild item flips to `[x]` with pre/post duration and chunk counts in evidence
- all five open decisions are resolved in `evidence/phase-5.md`
- QA gate passed, including truth check

---

## Phase 6: Chat UI polish

Goal:
- the chat surface a beginner actually uses every day feels calm, consistent, and considerate, without rewriting the underlying architecture

Carry-forward reality (refreshed 2026-04-22 after Phase 5 close; all claims verified against current code):

Phase 0–5 inheritance that Phase 6 polishes on top of but does not duplicate:

- `ContentAudience = "public" | "account" | "premium" | "apprentice" | "staff" | "admin"`, `ContentClass = "manual" | "guide" | "training" | "reference" | "article"`, `RolePersona = "sales" | "scheduling" | "front_desk" | "operator" | "founder"` are all stable.
- `CapabilityCardKind` in [src/core/entities/capability-presentation.ts](src/core/entities/capability-presentation.ts) = `editorial_workflow | search_result | artifact_viewer | theme_inspection | profile_summary | journal_workflow | media_render | lifecycle | fallback` (9 values). Phase 6 does NOT add any kind.
- F7 envelope contract at [docs/_specs/codebase-health/f7-system-envelope-contract.md](docs/_specs/codebase-health/f7-system-envelope-contract.md) unchanged: system envelopes ride on `ChatMessage.metadata.<kind>?`, authored via `MessageFactory.createSystemMessage`, forwarded by `ChatPresenter.present()`, NOT registered in `CAPABILITY_CATALOG`.
- `CoachPayload`, `CoachEnvelope`, `CoachCard` (Phase 2) + `LifecycleCard` (Phase 1) + `CampaignPreset` surfaces (Phase 3) + `class:"guide"` corpus entries (Phase 4) + `PromptSlotType = "base" | "role_directive" | "coach"` (Phase 5) + `/admin/training/[bookSlug]/[chapterSlug]` + `/admin/content-visibility` + 11-item admin nav (Phase 5) are all in place and not restructured by Phase 6.
- Library zoning inline at [src/app/library/page.tsx](src/app/library/page.tsx) + `class:"training"` operators-handbook + `class:"reference"` architecture-reference corpus entries (Phase 5) are stable.
- `SUPPORTED_PREFERENCE_KEYS` pin in [src/core/use-cases/tools/set-preference.tool.ts](src/core/use-cases/tools/set-preference.tool.ts) = `["response_style", "tone", "business_context", "preferred_name"]` (unchanged since Phase 1).
- Hotspot pin still holds: [src/lib/jobs/deferred-job-worker.ts](src/lib/jobs/deferred-job-worker.ts), [src/core/capability-catalog/runtime-tool-binding.ts](src/core/capability-catalog/runtime-tool-binding.ts), [src/core/use-cases/tools/search-my-conversations.tool.ts](src/core/use-cases/tools/search-my-conversations.tool.ts) — not touched in Phase 5, must not be touched in Phase 6.

Chat-surface architecture that Phase 6 polishes:

- `ChatSurface` (embedded or floating) mounts `ChatSurfaceHeader` + `ChatContentSurface`; `ChatContentSurface` mounts `ChatMessageViewport`, `ChatProgressStrip`, and `ChatInput`. Message rendering flows through [src/frameworks/ui/MessageList.tsx](src/frameworks/ui/MessageList.tsx) → `RichContentRenderer` → the capability card registry.
- All six capability primitives exist under [src/frameworks/ui/chat/primitives/](src/frameworks/ui/chat/primitives): `CapabilityCardShell`, `CapabilityCardHeader`, `CapabilityActionRail`, `CapabilityTimeline`, `CapabilityDisclosure`, `CapabilityMetricStrip`.
- Design tokens (spacing ladder, typography tiers, oklch color system, glass layer) are mature and density-aware.

What already landed in earlier phases (do NOT re-do in Phase 6):

- `prefers-reduced-motion` override **already present** at [src/app/styles/chat.css](src/app/styles/chat.css) L1260 and [src/app/styles/utilities.css](src/app/styles/utilities.css) L370. Phase 6 only needs an audit pass across newly-animated surfaces, not a net-new override.
- `CARD_KIND_TONE_MAP` at [src/frameworks/ui/chat/primitives/capability-card-tone.ts](src/frameworks/ui/chat/primitives/capability-card-tone.ts) L45 **already has `lifecycle: "neutral"`** (landed in Phase 0). Phase 6 does not re-add it.
- Composer **already sets** `data-chat-composer-dragover` + `data-chat-composer-error` in [src/frameworks/ui/ChatInput.tsx](src/frameworks/ui/ChatInput.tsx) L135–L148, and [src/app/styles/chat.css](src/app/styles/chat.css) L521 **already styles both states** with accent/danger tokens. Phase 6 verifies contrast + keyboard visibility, no net-new attributes or rules unless a concrete gap is found.
- Message timestamps **already rendered** in [src/frameworks/ui/MessageList.tsx](src/frameworks/ui/MessageList.tsx) L356. Phase 6 audits positioning and density, not re-adds.
- Tables **already wrapped** in an `overflow-x-auto` container at [src/frameworks/ui/RichContentRenderer.tsx](src/frameworks/ui/RichContentRenderer.tsx) L278.
- Code blocks **already render** with a language label + copy control via the `CodeBlock` sub-component in `RichContentRenderer`. Syntax highlighting remains explicitly out of scope.
- `aria-live="polite"` regions **already exist** in [src/frameworks/ui/ChatInput.tsx](src/frameworks/ui/ChatInput.tsx) L208 and [src/frameworks/ui/MessageList.tsx](src/frameworks/ui/MessageList.tsx) L586. Phase 6 wires progress-strip announcements INTO these existing regions; it does NOT add a new live-region landmark.

Remaining Phase 6 gaps (verified 2026-04-22):

- User vs assistant bubbles still differ only by gradient/surface tint. [src/app/styles/chat.css](src/app/styles/chat.css) L614–L620 sets `background: var(--fva-shell-user-surface)` on `[data-chat-message-role="user"] [data-chat-bubble-surface="true"]` but NO left accent border, NO role-axis edge cue. Phase 6 adds the explicit visual distinction.
- NO date separators exist between message groups today — `MessageList.tsx` renders messages as a flat list; Phase 6 introduces a grouping-by-day separator row.
- Blockquotes in [src/frameworks/ui/RichContentRenderer.tsx](src/frameworks/ui/RichContentRenderer.tsx) L103 have NO left accent border treatment today.
- [src/frameworks/ui/chat/plugins/system/ChatProgressStrip.tsx](src/frameworks/ui/chat/plugins/system/ChatProgressStrip.tsx) and `ProgressStripBubble.tsx` have NO `title` attribute / hover tooltip on individual bubbles (the only `title` in the file is the detail-panel heading, not a tooltip), and NO progress-strip `aria-live` announcement wiring. Phase 6 adds both.
- Touch-target size on progress-strip bubbles at the `sm:` breakpoint is NOT asserted by any existing test; Phase 6 verifies and adjusts if a concrete gap is found.
- Hero zero-state proof points are hardcoded in the `HERO_PROOF_POINTS` constant at [src/frameworks/ui/MessageList.tsx](src/frameworks/ui/MessageList.tsx) L36 — not sourced from corpus. Phase 6 replaces them with a small honest set of suggestion chips sourced from the three `class:"guide"` corpus entries that already exist (`campaign/friends-and-family`, `campaign/local-flyers`, `campaign/lightweight-paid-outreach`).
- Deferred-job success confirmation copy surface: progress-strip bubbles update state, but there is no brief completion-confirmation text in the chat stream today. Phase 6 adds plain-text confirmation (not a toast framework) routed through `MessageFactory.createSystemMessage` so it rides the F7 envelope contract.
- `CapabilityActionRail` button hover/focus styling + explicit `CapabilityErrorCard` error-icon treatment remain a token-only CSS pass.

This phase changes:
- message rendering contract: a clear user-vs-assistant visual cue beyond the existing gradient tint (left accent border on user bubbles using `--accent` on `[data-chat-message-role="user"] [data-chat-bubble-surface="true"]`), and date separators between message groups in `MessageList.tsx`. Existing message-timestamp rendering stays as-is.
- rich content polish (scoped pass): add a left accent border + italic tone treatment to blockquotes in `RichContentRenderer.tsx`. Existing table `overflow-x-auto` wrapping and code-block language label + copy control remain unchanged. Syntax highlighting is out of scope for this phase unless it lands via a token-only CSS pass.
- capability card polish: hover and focus styling on `CapabilityActionRail` buttons; explicit error icon + distinct heading treatment on `CapabilityErrorCard`; verify (and only adjust if a concrete gap) the minimum 44px touch target for progress-strip bubbles on `sm:` breakpoints
- streaming and status affordances: add a `title` attribute tooltip to progress-strip bubbles; route progress change announcements through the existing `aria-live="polite"` regions in `ChatInput.tsx` and `MessageList.tsx` (no net-new live-region landmark); introduce a brief, plain-text completion confirmation for deferred job success, authored via `MessageFactory.createSystemMessage` so it rides the F7 envelope contract
- accessibility audit (not re-implementation): the global `@media (prefers-reduced-motion: reduce)` override already exists at `src/app/styles/chat.css` L1260 and `src/app/styles/utilities.css` L370; Phase 6 extends it only to any newly introduced animations (date separators, completion confirmation fade, etc.). Composer dragover/error styling already lives at `chat.css` L521; Phase 6 only verifies keyboard visibility and contrast and adjusts if a concrete gap is found. Ensure composer error state is never conveyed by color alone; verify keyboard navigation across header, composer, progress strip, and message list
- theme and density audit: verify compact, normal, and relaxed densities still feel coherent across hero state, messages, composer, and cards; adjust density-specific chat tokens only where a concrete gap is identified
- hero and empty states: the hero surface stays. The hardcoded `HERO_PROOF_POINTS` array in `MessageList.tsx` is replaced with a small honest set of suggestion chips sourced from the three `class: "guide"` corpus entries authored in Phase 4 (`campaign/friends-and-family`, `campaign/local-flyers`, `campaign/lightweight-paid-outreach`) via `FileSystemCorpusRepository` — audience-filtered by `canUserAccessAudience` so anonymous viewers see only `audience: "public"` guides

This phase does not change:
- the chat transport contracts (message parts, stream events, `CapabilityResultEnvelope`, presenter markers)
- capability card plugin routing or the registry shape
- `CapabilityCardKind` (still 9 values; no `coach` kind — coach rides on `ChatMessage.metadata.coach` per F7)
- prompt composition or role-directive assembly; `PromptSlotType` stays at `"base" | "role_directive" | "coach"` (Phase 5)
- the install wizard, lifecycle event emission, or coach envelope contract
- search retrieval, tool RBAC, or deferred job orchestration
- `SUPPORTED_PREFERENCE_KEYS` refusal list in `set-preference.tool.ts`
- `setAccountTier` as the sole `account_tier` writer, `UserTier` union, tier-aware access helpers, `canUserAccessAudience`
- admin navigation shape (11 live items), admin training surface at `/admin/training/[bookSlug]/[chapterSlug]`, admin content-visibility page, `requireStaffOrAdmin()` gate
- library zoning, corpus `class` / `rolePersona` / `audience` frontmatter, `class: "guide"` / `"training"` / `"reference"` corpus entries authored in Phases 4–5
- F7 envelope contract (`ChatMessage.metadata.<kind>?` carriers, `MessageFactory.createSystemMessage`, `CAPABILITY_CATALOG` does NOT register system/coach/lifecycle)
- existing `@media (prefers-reduced-motion: reduce)` override at `chat.css` L1260 / `utilities.css` L370 (Phase 6 extends to newly introduced animations only)
- existing composer dragover/error styling at `chat.css` L521
- existing message-timestamp render, table overflow wrapping, code-block language label + copy control
- existing `aria-live="polite"` regions in `ChatInput.tsx` L208 and `MessageList.tsx` L586 (Phase 6 routes new announcements through them)
- any known hotspot (`deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`)

Primary files:
- src/app/styles/chat.css
- src/app/styles/foundation.css
- src/frameworks/ui/ChatSurface.tsx
- src/frameworks/ui/ChatMessageViewport.tsx
- src/frameworks/ui/MessageList.tsx
- src/frameworks/ui/RichContentRenderer.tsx
- src/frameworks/ui/ChatInput.tsx
- src/frameworks/ui/ComposerSendControl.tsx
- src/frameworks/ui/ComposerFilePills.tsx
- src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx
- src/frameworks/ui/chat/primitives/CapabilityCardShell.tsx
- src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx
- src/frameworks/ui/chat/plugins/system/ChatProgressStrip.tsx
- src/frameworks/ui/chat/plugins/system/ProgressStripBubble.tsx

QA gate:
- focused behavior check: on a narrow viewport, (a) the composer shows a visible drag-over state when a file is dragged in and a visible error state when sending fails, (b) at least one long assistant message shows a timestamp, (c) one message group shows a date separator, and (d) one wide table scrolls horizontally without breaking the message column
- relevant regression check: existing chat tests pass, capability card rendering tests pass, streaming and job status flows are unchanged, and no transport contract (parts, events, envelope, markers) has moved
- truth check: no visual polish is hiding honest status. Progress bubbles still disclose failure and fallback states; the completion confirmation never fires for jobs that silently failed; reduced-motion users receive the same information without animation; color alone is never the only signal for error, success, or lifecycle state

Exit criteria:
- composer, message list, rich content, capability cards, and progress strip all pass the focused behavior check
- `prefers-reduced-motion` is respected across chat animations
- visible contrast, touch targets, and keyboard navigation are verified on desktop and mobile viewports
- the honest disclosure contract holds across every polished surface
- QA gate passed

---

## Phase 7: Release gate and production cutover

Goal:
- close the refactor with a verifiable, honest, reproducible release gate that proves every Phase 0–6 invariant still holds at HEAD, every user-facing surface satisfies the honest-disclosure contract, every load-bearing test suite stays green, and no hotspot was silently restructured

Carry-forward reality (drafted 2026-04-22 after Phase 6 close; all claims verified against current code):

Phase 0–6 inheritance that Phase 7 verifies rather than re-implements:

- Phase 0: `ContentAudience = "public" | "account" | "premium" | "apprentice" | "staff" | "admin"`; `ContentClass = "manual" | "guide" | "training" | "reference" | "article"`; `RolePersona = "sales" | "scheduling" | "front_desk" | "operator" | "founder"`. `CapabilityCardKind` in [src/core/entities/capability-presentation.ts](src/core/entities/capability-presentation.ts) = 9 values including `lifecycle`. `CARD_KIND_TONE_MAP` at [src/frameworks/ui/chat/primitives/capability-card-tone.ts](src/frameworks/ui/chat/primitives/capability-card-tone.ts) L45 includes `lifecycle: "neutral"`.
- Phase 1: `UserTier = "account" | "premium"`, `ACCOUNT_TIER_PREFERENCE_KEY`, `setAccountTier` sole `account_tier` writer, `canUserAccessAudience` tier-aware helper, `LifecycleCard` + `LifecycleVariant` union, `ChatMessageMetadata.lifecycle?`, `ChatPresenter.lifecycle` passthrough, `SystemCardKind = "error" | "lifecycle" | null`. Nav identity is `AccountMenu` only.
- Phase 2: F7 envelope contract at [docs/_specs/codebase-health/f7-system-envelope-contract.md](docs/_specs/codebase-health/f7-system-envelope-contract.md); `CoachPayload`, `CoachEnvelope`, `CoachCard`, `COACH_DESCRIPTOR`, `COACH_TOOL_NAME`, `ChatMessageMetadata.coach?`, `MessageFactory.createSystemMessage`, `APPEND_MESSAGES` reducer, `useLifecycleContext` + `GET /api/lifecycle/context`, `buildCoachPayloadForLifecycle`, `setAccountTier` + `ensureOnboardedEmission` helpers. Four lifecycle emissions wired: `system_installed` in `/api/install/setup`, `user_onboarded` at first authenticated sign-in, `role_promoted` from admin role-update path, `tier_upgraded` from `setAccountTier()`.
- Phase 3: `CampaignPreset` (three presets: `friends_and_family`, `local_flyers`, `lightweight_paid_outreach`), `campaign_introduction` + `campaign_picked` variants, `useCampaignContext`, referral metrics pruned per truth-check. `/r/[code]` landing page simplified. `ReferralQrCard` unchanged.
- Phase 4: Vector-layer filtering via `VectorQuery.{allowedAudiences, classes, rolePersonas}`; `HybridSearchEngine` narrow-before-rank; `DocumentChunkMetadata.{audience, contentClass, rolePersona}`; `scripts/build-search-index.ts` injects the new fields; `LibrarySearchInteractor` interactor-level filter retained as defense-in-depth; `ROLE_PERSONA_PREFERENCE_KEY` + server-only persona write path; library zoning inline in [src/app/library/page.tsx](src/app/library/page.tsx); three `class: "guide"` campaign corpus entries under `docs/_corpus/campaign/`; `buildCampaignPresetCoachPayloadFromCorpus` retrieval-backed builder with explicit templated fallback.
- Phase 5: `docs/_corpus/operators-handbook/` authored with three `class: "training"` chapters + `docs/_corpus/architecture-reference/` with two `class: "reference"` chapters; full search-index rebuild clean (30 sections / 249 chunks / 36.7s); `PromptSlotType = "base" | "role_directive" | "coach"`; `/admin/training/[bookSlug]/[chapterSlug]` as a real training surface; `/admin/content-visibility` coverage audit page; 11-item admin nav; `requireStaffOrAdmin()` gate on training + content-visibility.
- Phase 6: User-bubble accent + blockquote accent + date separators + `.ui-capability-action` hover/focus + `!` glyph on alert cards + job-completion confirmation (F7, `ChatMessageMetadata.jobCompletion?`, dedup via `announcedJobIds` in `JobCompletedStrategy`) + progress-strip `title` tooltip + dedicated `aria-live="polite"` region inside the strip + 44px touch target at `sm:` + `prefers-reduced-motion` extension for new animations + corpus-backed hero proof points via `GET /api/hero/proof-points` + `useHeroProofPoints` hook with deterministic fallback.

Load-bearing regression surfaces that Phase 7 runs without fail:

- access + retrieval: `src/lib/access/content-access.test.ts`, `src/core/use-cases/LibrarySearchInteractor.test.ts`, `src/core/use-cases/GetChapterInteractor.test.ts`, `src/core/use-cases/CorpusIndexInteractor.test.ts`, `src/core/use-cases/CorpusSummaryInteractor.test.ts`, `src/core/use-cases/tools/CorpusTools.test.ts`, `src/adapters/InMemoryVectorStore.test.ts`, `src/lib/chat/retrieval-envelope.test.ts`, `src/adapters/FileSystemCorpusRepository.test.ts`.
- tier + preferences: `src/core/use-cases/tools/set-preference.tool.test.ts` (refusal pin: `account_tier`, `pending_lifecycle_events`, `pending_campaign_coach`, `role_persona`), `src/lib/lifecycle/account-tier.test.ts`, `src/lib/lifecycle/onboarded.test.ts`.
- lifecycle + coach: `src/lib/lifecycle/lifecycle-queue.test.ts`, `src/lib/lifecycle/coach-templates.test.ts`, `src/frameworks/ui/chat/plugins/system/LifecycleCard.test.tsx`, `src/frameworks/ui/chat/plugins/system/CoachCard.test.tsx`, `src/frameworks/ui/chat/plugins/system/resolve-system-card.test.ts`, `src/app/api/lifecycle/context/route.test.ts`, `src/hooks/chat/useLifecycleContext.test.tsx`.
- referral + campaign: `src/lib/referrals/campaign-presets.test.ts` (retrieval + fallback), `src/lib/referrals/campaign-queue.test.ts`, `src/lib/referrals/referral-visit.test.ts`, `src/app/referrals/actions.test.ts`, `src/app/api/campaign/context/route.test.ts`, `src/app/api/referral/visit/route.test.ts`, `src/app/api/referral/[code]/route.test.ts`, `src/hooks/chat/useReferralContext.test.tsx`, `src/hooks/chat/useCampaignContext.test.tsx`.
- chat transport + system cards: `src/adapters/ChatPresenter.test.ts`, `src/frameworks/ui/MessageList.test.tsx`, `src/frameworks/ui/chat/plugins/system/ChatProgressStrip.test.tsx`, `src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts`, `src/frameworks/ui/chat/plugins/system/system-card-family.test.tsx`, `src/frameworks/ui/chat/registry/capability-presentation-registry.test.ts`, `src/frameworks/ui/chat/primitives/capability-card-tone.test.ts`, `src/lib/chat/StreamStrategy.test.ts`, `src/hooks/chat/chatStreamProcessor.test.ts`, `src/hooks/chat/useChatJobEvents.test.ts`.
- public + admin + error standardization: `tests/error-standardization.test.ts`, `tests/public-content-routes.test.ts`, `tests/phase-5-scope.test.ts`.
- prompt control plane: `tests/prompt-control-plane.service.test.ts`, `tests/prompt-control-plane-equivalence.test.ts`, `tests/system-prompt.test.ts`.

Honest-disclosure audit surfaces that Phase 7 re-walks:

- hero (`src/frameworks/ui/MessageList.tsx` `BrandHeader`): `data-homepage-proof-source` reveals `corpus` vs `fallback`; fallback is deterministic, not an empty state masquerading as success.
- lifecycle card (`LifecycleCard.tsx`): variant, caption, timestamp; never a "complete" label for a deferred action.
- coach card (`CoachCard.tsx`): retrieval-backed vs templated — retrieval-backed appends a `read-full-guide` action pointing at the published library path; templated never invents a source.
- campaign coach (`buildCampaignPresetCoachPayloadFromCorpus` + campaign preset fallback path): if a slug fails to resolve, fallback is explicit in both code path and test coverage (`campaign-presets.test.ts` fallback tests).
- library retrieval (`LibrarySearchInteractor` + `HybridSearchEngine`): `allowedAudiences` narrow-before-rank at the vector layer; interactor truth-check fallback still returns denials as `ContentAccessDeniedError`, not silent drops.
- progress strip (`ChatProgressStrip.tsx`): failed bubble renders `Action needed`, not a success label; dedicated `role="status" aria-live="polite"` region announces the highest-priority item honestly.
- deferred-job completion confirmation (`JobCompletedStrategy` + `MessageList` `jobCompletion` branch): only fires on `job_completed`, never on heartbeat / fallback; dedup guarantees it never echoes on reconnect, which cannot mask a failure because failed jobs take `JobFailedStrategy`.
- `/admin/training/[bookSlug]/[chapterSlug]`: never a redirect stub; renders real `class: "training"` chapters. `/admin/content-visibility` flags drift honestly (verified by `tests/phase-5-scope.test.ts`).

Non-scope reconfirmation:

- hotspots still untouched: [src/lib/jobs/deferred-job-worker.ts](src/lib/jobs/deferred-job-worker.ts), [src/core/capability-catalog/runtime-tool-binding.ts](src/core/capability-catalog/runtime-tool-binding.ts), [src/core/use-cases/tools/search-my-conversations.tool.ts](src/core/use-cases/tools/search-my-conversations.tool.ts). Phase 7 is verification-only; no hotspot edits are permitted by this phase either.
- pre-existing project-wide TypeScript drift in media / runtime-tool-binding / prompt-control-plane hook types is out of scope. Phase 7 records the scoped tsc result for every Phase 0–6 surface file and documents the remaining unrelated drift without fixing it.
- no new Next.js route, no new tool, no new MessagePart, no new stream event, no new presenter marker, no new `CapabilityCardKind`, no new `PromptSlotType`, no new `CoachPayload.variant`, no new `LifecycleVariant`, no new preference key.

Open decisions (must be resolved in `evidence/phase-7.md`):

1. **Regression scope breadth** — minimum scoped vitest sweep listed above, or full `npx vitest run --exclude tests/browser/** --exclude tests/playwright/**`. The first is deterministic and fast; the second is exhaustive but may surface pre-existing drift unrelated to the refactor. Record the chosen scope and actual pass/fail counts in evidence.
2. **tsc treatment** — project-wide `tsc --noEmit` or scoped `tsc --noEmit` on a curated filelist covering only Phase 0–6-touched files. Phase 6 evidence already established that project-wide TSC has pre-existing drift in 22 files unrelated to the refactor. Record the chosen approach and the exact file list.
3. **Playwright / browser run gating** — run `tests/browser/**` and `tests/playwright/**` as part of the release gate, or carve them out as a separate gate with their own evidence. These tests have historically been flaky in the managed-webserver path (see [memory notes](/memories/repo/playwright-baseurl-managed-webserver-contract.md)); record the decision.
4. **Release-conditions ownership** — Phase 7 flips the 13 release-condition items in `production-readiness-checklist.md`, or a separate post-Phase-7 sign-off flips them after a manual beginner walkthrough. Either way, each `[x]` must cite evidence.
5. **Cutover artifact** — ship a single `evidence/phase-7.md` with the commands, counts, and honest-disclosure audit notes, or split into `evidence/phase-7-regression.md` + `evidence/phase-7-honest-disclosure.md` + `evidence/phase-7-release-conditions.md`. Record the chosen structure.

This phase changes:
- only documentation: `evidence/phase-7.md` (plus optional sibling evidence files per decision 5), the release-conditions block in `production-readiness-checklist.md`, and the overall-status / current-phase header.
- zero source-file changes unless a QA-gate failure surfaces a real regression. Any fix required to pass the gate is scoped to the minimum surface that restores green; the evidence file records the fix verbatim.

This phase does not change:
- any chat transport contract (message parts, stream events, `CapabilityResultEnvelope`, presenter markers, F7 envelope contract)
- `CapabilityCardKind` (still 9 values); `PromptSlotType` (still `"base" | "role_directive" | "coach"`); `LifecycleVariant`; `CoachPayload.variant`; `UserTier`
- `SUPPORTED_PREFERENCE_KEYS` refusal list
- `setAccountTier` sole-writer contract, tier-aware access helpers, `HybridSearchEngine` narrow-before-rank
- admin navigation shape (11 live items), `/admin/training/[bookSlug]/[chapterSlug]`, `/admin/content-visibility`, `requireStaffOrAdmin()` gate
- library zoning, corpus `class` / `rolePersona` / `audience` frontmatter, `class: "guide"` / `"training"` / `"reference"` corpus entries
- referral HMAC / cookie lifetime / signed-visit path, QR rate-limit + `affiliate_enabled` gate, affiliate ledger writes
- composer dragover / error styling, message timestamps, table overflow, code-block language label + copy control, existing `aria-live` regions at `ChatInput.tsx` L208 and `MessageList.tsx` L586, Phase 6 progress-strip live region
- hotspots (`deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`)
- the install wizard (3 steps, bootstrap boundary)

Primary files:
- docs/_specs/beginner-solopreneur-refactor/evidence/phase-7.md (new)
- docs/_specs/beginner-solopreneur-refactor/production-readiness-checklist.md (release-conditions + header only)
- docs/_specs/beginner-solopreneur-refactor/implementation-phases.md (Phase 7 section, this file)

QA gate:
- focused behavior check: a beginner walkthrough touches hero → first turn → lifecycle card → coach card → campaign coach → library zoned browse → one deferred job completion, and every surface passes the honest-disclosure audit note recorded in `evidence/phase-7.md`
- relevant regression check: the chosen regression scope (per decision 1) passes green end to end; the pre-existing TSC drift recorded in Phase 6 evidence has not grown in scope or file count; Phase 0–6 scoped ESLint exits 0 for every file named in any Phase 0–6 primary-files list
- truth check: every release-condition `[x]` flip in `production-readiness-checklist.md` cites either a test file, an evidence file, or a code anchor (file + line) that proves the claim; no flip is justified by narrative alone; every `[ ]` that remains open is documented with the reason it cannot be honestly flipped yet

Exit criteria:
- `evidence/phase-7.md` written with decisions 1–5 recorded and the chosen regression + tsc + playwright + release-condition + artifact strategy locked in
- the chosen regression scope passes; exit codes captured verbatim; test-file and test counts recorded
- scoped ESLint exit 0 for every Phase 0–6 primary file
- honest-disclosure audit walk notes recorded for every surface listed above
- release-conditions block in `production-readiness-checklist.md` flipped per the decision-4 policy
- overall-status + current-phase header advanced to `Phases 0–7 complete` / `Phase 7 - Release gate (complete YYYY-MM-DD)`
- QA gate passed

---

## Cross-cutting rules

1. Each phase begins with a `Carry-forward reality` refresh before any implementation.
2. `[x]` requires a passed QA gate including the truth check.
3. New user-facing capability must be delivered as a message or card inside the conversation unless access control requires its own route.
4. Training, manual, and coach content must be corpus content tagged with `audience`, `class`, and `rolePersona` where relevant. No shadow prompt files.
5. Customer tier and operating role are separate dimensions. Customer tier and knowledge-worker persona are separate dimensions.
6. Scheduling integration stays out of scope. Only the `rolePersona: scheduling` slot is reserved.
7. Honest disclosure is a contract, not a phase. Any card, message, or response that depends on deferred, approximate, or fallback behavior must disclose it in its summary or status line. No phase is `[x]` if its surfaces violate this contract.
8. Every phase must produce an evidence file at `docs/_specs/beginner-solopreneur-refactor/evidence/phase-N.md` before it is marked `[x]`.
9. Known hotspots (`src/lib/jobs/deferred-job-worker.ts`, `src/core/capability-catalog/runtime-tool-binding.ts`, `src/core/use-cases/tools/search-my-conversations.tool.ts`) are out of scope for this refactor and must not be silently restructured during phase work.
10. The existing 3-step install wizard is the bootstrap boundary. Nothing after `/welcome` is a new page; it is a conversation.
11. The test set in the README Architecture anchors list is load-bearing regression surface. No phase is `[x]` if any of those tests regress.
