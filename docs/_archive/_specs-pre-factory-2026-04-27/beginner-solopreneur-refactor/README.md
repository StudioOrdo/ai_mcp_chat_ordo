# Beginner Solopreneur Refactor

Status: Active product refactor package
Date: 2026-04-22
Process: Follows `docs/operations/ai-phase-delivery-process.md`

This package is the single source of truth for refactoring ordoSite into a beginner-friendly solopreneur product. It supersedes all archived spec packages in `docs/_specs/_archive/`.

## Product intent

Refactor the current system into a product that a beginner solopreneur can understand, trust, and use without needing internal context.

The system already has strong technical foundations:

- hybrid search and retrieval
- RBAC and content audience control
- deferred job execution
- browser and server media runtimes
- referral and QR tracking
- theme and accessibility infrastructure
- MCP and tool composition infrastructure
- structured chat messages, capability cards, and a capability result envelope
- role-aware system prompts and admin prompt versioning
- a working 3-step install wizard

The refactor goal is not to remove those capabilities. The goal is to package them into a simpler operating model that feels like a real business assistant instead of a powerful internal platform.

## Target user

Primary user:

- a laid-off or independent white-collar solo founder
- not deeply technical
- trying to validate an offer, publish content, run lightweight campaigns, and manage a small pipeline alone

Secondary users:

- staff operators
- admins who install and maintain the system

Future knowledge-worker personas the product should be able to speak as:

- sales
- scheduling
- front desk / receptionist
- operator
- founder

These are represented as `rolePersona` values on corpus content, not as new RBAC roles.

## Core product shape

The product should feel like four simple surfaces, all reached through a chat-first conversation:

1. Founder workspace
   The daily home for tasks, prompts, campaigns, content, and business follow-up.

2. Business assistant
   A chat-first assistant that can search context, suggest next actions, help create assets, and explain what happened in plain language.

3. Growth funnel
   A beginner-friendly referral and QR system for friends-and-family distribution, local outreach, and lightweight paid campaigns.

4. Operations backplane
   Staff and admin tools, advanced media execution, capability routing, deferred jobs, and MCP surfaces that support the product without leaking complexity into the beginner experience.

## Required account model

Customer tiers (user-facing):

- `anonymous`
  A safe public entry path with clear limits and strong calls to continue.
- `account`
  Authenticated baseline workspace for saved chat, history, basic campaigns, and guided setup.
- `premium`
  Paid workspace with stronger assistant behavior, deeper memory and search, richer campaign analytics, and advanced media workflows.

Operating roles (internal):

- `staff`
- `admin`

`APPRENTICE` remains as a role but is treated as a learning variant within the authenticated experience. Apprentice-specific content is a subset of `class: training` tagged with the `apprentice` audience, not a separate content class.

The refactor must separate internal roles from customer packaging. Staff and admin are not customer tiers and must never be presented as purchase levels.

## Minimum premium contract

`premium` is a content-access tier, not a feature flag grab bag. Premium unlocks:

1. Retrieval access to corpus content tagged `audience: premium`.
2. Deeper assistant search behavior via `allowedAudiences` including `premium`.
3. Richer campaign analytics in referral and QR surfaces where data is honestly available.
4. Access to `class: manual` and `class: training` entries tagged for premium.

Premium does not mean:

- a separate code path or parallel UI
- an isolated chat surface
- undisclosed capability

All premium behavior must be explainable by citing the audience on the content being accessed.

## Content access and manual model

Content access is the backbone that unifies the library, the assistant, onboarding, coach mode, and admin training.

Content audience values (expanded from the current `public | member | staff | admin`):

- `public`
- `account`
- `premium`
- `apprentice`
- `staff`
- `admin`

Access mapping rules:

- `public` is visible to everyone
- `account` is visible to authenticated users and above
- `premium` is visible to premium and above
- `apprentice` is visible to apprentice and above
- `staff` is visible to staff and admin
- `admin` is visible to admin only

Orthogonal corpus metadata (optional, additive):

- `class`: `manual | guide | training | reference | article`
- `rolePersona`: `sales | scheduling | front_desk | operator | founder`

Rules:

1. All training and coach content lives in the corpus, not in hardcoded prompt strings.
2. The assistant retrieves only what the viewer audience allows.
3. The library and the assistant share one audience-aware content spine.
4. Customer tier and knowledge-worker persona are separate dimensions.

## Conversation-first design rules

Because this product is chat-first, every beginner-facing feature must be delivered as structured conversation, not as separate pages or a tour library.

Rules:

1. Onboarding, coach mode, install continuation, role promotion, tier upgrade, and capability unlocks must appear as typed messages and cards in the thread.
2. Any non-prose assistant output must be a typed `CapabilityResultEnvelope` routed through the capability card registry.
3. Interactive affordances must use `action-link` inline nodes so every button continues the conversation.
4. `role: "system"` messages must render through the `lifecycle` cardKind renderer (backed by `CapabilityCardShell` + `CapabilityTimeline`), not as plain chat bubbles. No separate `SystemEventCard` primitive is introduced; the `lifecycle` card is the system event surface.
5. Lifecycle moments are a new `cardKind` called `lifecycle` (in `CapabilityCardKind`) with `family: "system"` and variants: `installed`, `onboarded`, `role_changed`, `tier_upgraded`, `capability_unlocked`.
6. Honest disclosure is mandatory (see cross-cutting contract below).

## Honest disclosure contract

Honest disclosure is a contract, not a phase.

Any card, message, or response that depends on deferred, approximate, or fallback behavior must disclose it in its summary line or status line. This applies across every phase:

1. Deferred jobs must say they are deferred and show real progress, not a spinner labeled complete.
2. Fallback retrieval (general knowledge, cached, or partial) must say so.
3. Approximate answers must say so.
4. Server-backed execution must not be presented as browser-native success, and vice versa.
5. If the system cannot do something at the current tier, it must say that, not simulate success.

No phase is `[x]` if its surfaces violate this contract.

## Tier storage mechanism

Tier is stored using the existing `user_preferences` KV table, not a new schema:

- `user_preferences(user_id, key="account_tier", value="account" | "premium")`
- `SessionUser` gains an optional `tier?: "account" | "premium"` field resolved in `src/lib/auth.ts`
- `ANONYMOUS` has no tier; treat as below `account`
- Tier is orthogonal to `RoleName`. Staff and admin are not customer tiers.

No new billing, entitlement, or feature-flag system is introduced by this refactor.

## Install boundary

The existing 3-step install wizard (`src/app/install/InstallWizard.tsx`) is the bootstrap boundary.

1. Bootstrap steps (env check, provider keys, first admin) stay as a wizard.
2. Everything after `/welcome` is a conversation, delivered through lifecycle cards and coach mode.
3. No new install pages are created outside the wizard.

## Lifecycle coach mode

One mechanism covers install continuation, first-run onboarding, role promotion, and tier upgrade.

Lifecycle events:

- `system_installed`
- `user_onboarded`
- `role_promoted`
- `tier_upgraded`

Coach mode behavior:

1. A lifecycle event flips a bounded coach-mode flag on the session with a typed context object.
2. The assistant emits a typed `coach` envelope with `steps[]`, `currentStep`, and `actions[]`.
3. The UI renders a single coach card in the thread using existing capability primitives.
4. Coach content is drawn from corpus entries tagged `class: manual` or `class: training` and filtered by audience.
5. Coach mode exits when steps are acknowledged or the bounded window expires.

## Product principles

1. Beginner first. The first-run experience must make sense without internal vocabulary.
2. One obvious next action. Each major surface should make the next useful action obvious.
3. Honest capability disclosure. If work is deferred, approximate, or fallback-based, the UI must say so clearly.
4. Progress over breadth. Fewer visible options with stronger guidance is better than exposing all subsystem power.
5. Trust through clarity. Search, referrals, QR links, and assistant actions should explain what they are doing and why.
6. Chat is the surface. New features appear as messages and cards, not as new pages.

## Architecture anchors

The refactor binds to these concrete, verified surfaces. No other transport contracts are introduced.

Content access and corpus:
- `src/lib/access/content-access.ts` — `ContentAudience`, `canAccessAudience`, `isContentAudience`. Enum expands from `public | member | staff | admin` to `public | account | premium | apprentice | staff | admin`. Existing `member` values are mapped to `account` during Phase 0.
- `src/adapters/FileSystemCorpusRepository.ts` — `DocumentManifest` (`book.json`) and section frontmatter gain optional `class` and `rolePersona`. Defaults remain safe.
- `src/core/entities/corpus.ts` — `Section` and `Document` are the canonical shapes.

Retrieval:
- `src/core/search/ports/VectorStore.ts` — `VectorQuery` gains optional `allowedAudiences: ContentAudience[]` (backwards compatible).
- `src/core/search/ports/Chunker.ts` — `DocumentChunkMetadata` gains optional `audience`, `class`, `rolePersona`.
- `scripts/build-search-index.ts` — injects the new chunk metadata during indexing.
- `src/core/search/HybridSearchEngine.ts` — filters records by `allowedAudiences` before ranking.
- Interactor-level filtering in `src/core/use-cases/LibrarySearchInteractor.ts` and `src/core/use-cases/tools/CorpusTools.ts` remains as a defense-in-depth fallback.

Capability cards and chat transport:
- `src/core/entities/capability-presentation.ts` — `CapabilityCardKind` gains `lifecycle`; `CapabilityFamily` already includes `system`.
- `src/core/entities/capability-result.ts` — `CapabilityResultEnvelope<CoachPayload>` carries `{ steps, currentStep, actions }`. No new message part type and no new stream event type are introduced.
- `src/adapters/ChatPresenter.ts` — reuses existing `__suggestions__`, `__actions__`, and `__response_state__` markers. No new marker is introduced.
- `src/frameworks/ui/chat/registry/capability-presentation-registry.ts` and `default-tool-registry.ts` — register the new `lifecycle` renderer.
- `src/frameworks/ui/chat/primitives/CapabilityCardShell.tsx` and `CapabilityTimeline.tsx` — reused as-is for the lifecycle card.

Lifecycle and coach mode:
- New client hook `useLifecycleContext` parallels `src/hooks/chat/useReferralContext.ts`. It resolves from `GET /api/lifecycle/context` once before first assistant turn.
- Lifecycle events are emitted via the existing event recorder interface used by `ConversationInteractor.recordGenerationLifecycleEvent`. Emission points: install completion in `src/app/api/install/setup` and role promotion in `src/core/use-cases/UserAdminInteractor.ts`.
- `createInitialChatMessages` in `src/hooks/chat/chatState.ts` stays hero-only. Coach content is delivered as a `tool_result` envelope, not as a modified bootstrap message.

Prompt composition:
- `src/lib/chat/prompt-runtime.ts` section ordering is reused. A new `promptType = "coach"` value reuses the existing `system_prompts` table (no schema change).
- `src/core/entities/role-directive-assembler.ts` hardcoded role framing stays hardcoded. Coach content is corpus-sourced, not directive-sourced.

Tests treated as load-bearing regression boundaries (must not regress):
- `tests/error-standardization.test.ts` (ContentAccessDeniedError)
- `tests/prompt-control-plane.service.test.ts`, `tests/system-prompt.test.ts` (prompt versioning)
- `tests/users-and-roles.test.ts` (role updates)
- `tests/chat-presenter.test.tsx`, `src/adapters/ChatPresenter.test.ts` (marker parsing)
- `src/frameworks/ui/chat/registry/default-tool-registry.test.ts` and `src/frameworks/ui/chat/primitives/capability-card-primitives.test.tsx` (card rendering)
- `src/core/use-cases/LibraryInteractors.test.ts` (corpus loading)
- `src/hooks/chat/useReferralContext.test.tsx` (bootstrap hook pattern)
- `tests/stream-pipeline.test.ts` (stream event assembly)
- RBAC enforcement tests covering `RbacGuardMiddleware` and `ToolRegistry.canExecute`

## Known hotspots (non-goal for now)

These files are load-bearing and complex. They are explicitly not refactor targets for this package, but they must not silently grow during phase work. Any phase that touches them must state so in its `Carry-forward reality`.

- `src/lib/jobs/deferred-job-worker.ts`
  Orchestration-heavy; retry, lease, notification, audit, and progress logic are co-located. Treat as a stable boundary.
- `src/core/capability-catalog/runtime-tool-binding.ts`
  Large runtime binding registry. Do not add unrelated bindings during this refactor.
- `src/core/use-cases/tools/search-my-conversations.tool.ts`
  Uses a scan-and-filter pattern that does not scale; acceptable for now, but do not build new features on top of it.

Incidental refactors of these files are out of scope. If a phase requires changing them, the phase must be split or the change must be explicitly scoped.

## Non-goals

This refactor does not aim to:

- rewrite the entire technical architecture from scratch
- remove hybrid search, deferred jobs, media execution, MCP, or theme infrastructure
- collapse all internal roles into a public account model
- ship every advanced capability to anonymous users
- add scheduling or Google Calendar integration (only the `rolePersona: scheduling` slot is reserved)
- build a separate onboarding or tour subsystem outside the chat surface
- refactor the known hotspots listed above

## Success criteria

This refactor is successful when:

1. a beginner user can understand what the product is and what to do first without internal context
2. the anonymous, account, and premium boundaries are visible and coherent
3. staff and admin stay as internal operating roles and are not marketed as customer tiers
4. referral and QR flows can support simple real-world campaigns for friends-and-family and lightweight paid outreach
5. the assistant behaves like a practical business helper with honest capability disclosure
6. the library and the assistant share one audience-aware content spine
7. admins have a real surface to manage prompts, coach content, and content visibility
8. internal operational complexity stays behind staff and admin boundaries
9. the honest disclosure contract holds on every user-facing surface
10. the chat surface itself feels calm, consistent, and considerate across density, theme, motion, and viewport settings
