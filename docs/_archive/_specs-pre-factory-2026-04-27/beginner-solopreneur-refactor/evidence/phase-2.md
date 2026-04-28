# Phase 2 Evidence — Conversation-first onboarding and lifecycle coach mode

Status: complete.
Date: 2026-04-22.
Prior phase: Phase 1 complete (18/18 verified; see `evidence/phase-1.md`).

## Scope reminder

Phase 2 binds the Phase 1 lifecycle primitives to a consumer and adds a
sibling "coach" system envelope kind so install continuation, first-run
onboarding, role promotion, and tier upgrade all flow through one
lifecycle-plus-coach mechanism inside chat.

## Open decisions — resolved

Recorded per the Phase 2 production-readiness checklist. The four
decisions surfaced during the Phase 2 doc refresh were resolved as
follows:

1. **Recorder strategy: promote `lifecycle-queue`.**
   - Rationale: the queue is already emitting (role_changed from admin
     actions in Phase 1), it is user-scoped (which matches the product
     surface), and it survives process restarts via `user_preferences`.
     Extending `ConversationInteractor.recordGenerationLifecycleEvent`
     would force a conversationId where none exists at install time;
     introducing a fresh recorder would duplicate storage logic.
   - No code change: `queuePendingLifecycleEvent` remains the single
     writer; `consumePendingLifecycleEvents` remains the single reader
     (now invoked by `GET /api/lifecycle/context`).

2. **Card strategy: add sibling `CoachCard.tsx`.**
   - Rationale: the Phase 1 `LifecycleCard` is event-focused (occurrence
     timestamp, variant label, optional actor). Coach sequences are
     flow-focused (ordered steps, current step, actions). Merging would
     have made the typed payload a union and blurred the card's visual
     contract.
   - Both cards still map to `cardKind: "lifecycle"`; the resolver
     already routes on `cardKind` alone.

3. **Metadata field: add `ChatMessageMetadata.coach?`.**
   - Rationale: a lifecycle event and its coach sequence coexist on the
     same turn. Stuffing both into `metadata.lifecycle` would force
     either collision logic in `MessageList` or a synthetic "envelope
     list" type. A dedicated key is smaller, typed, and mirrors the
     existing passthrough pattern.
   - Presenter passthrough added as a one-line forward, per F7 contract.

4. **Consumer lifecycle: consume-on-first-turn.**
   - Rationale: mirrors `useReferralContext` exactly. The hook runs once
     before the first authenticated turn, fetches
     `GET /api/lifecycle/context`, and the route drains the queue
     server-side inside a single request. No client-side retry loop; no
     partial-consumption ambiguity. If the fetch fails, the queue is
     untouched and will be drained on the next authenticated render.

## Files changed

New:

- `src/core/entities/coach.ts` — `CoachPayload`, `CoachEnvelope`,
  `COACH_TOOL_NAME`, `CoachAction`, `CoachStep`.
- `src/frameworks/ui/chat/plugins/system/coach-descriptor.ts` —
  `COACH_DESCRIPTOR`, `createCoachEnvelope`, `isCoachResultEnvelope`.
- `src/frameworks/ui/chat/plugins/system/CoachCard.tsx` — renders a
  coach payload inside `CapabilityCardShell` + `CapabilityTimeline`,
  plus a `nav` of `action-link`-compatible buttons/anchors.
- `src/frameworks/ui/chat/plugins/system/CoachCard.test.tsx` — 5 tests.
- `src/lib/lifecycle/coach-templates.ts` —
  `buildCoachPayloadForLifecycle(event)` with per-variant templates for
  `installed | onboarded | role_changed | tier_upgraded`.
  `capability_unlocked` returns `null` (no generic template).
- `src/lib/lifecycle/coach-templates.test.ts` — 6 tests.
- `src/app/api/lifecycle/context/route.ts` — `GET` returns
  `{ items: [{ lifecycle, coach }] }` for the authenticated user,
  draining the queue. Anonymous = empty list (no drain).
- `src/app/api/lifecycle/context/route.test.ts` — 4 tests.
- `src/hooks/chat/useLifecycleContext.ts` — runs once for authenticated
  sessions, fetches context, dispatches `APPEND_MESSAGES` with a
  lifecycle system message (and, if present, a coach system message).
- `src/hooks/chat/useLifecycleContext.test.tsx` — 7 tests.
- `src/lib/lifecycle/onboarded.ts` — `ensureOnboardedEmission(userId)`
  (idempotent, writes `onboarded_at` then queues `onboarded`) and
  `markOnboardedWithoutEmission(userId)` (stamps without queueing,
  used by install flow).
- `src/lib/lifecycle/onboarded.test.ts` — 5 tests.
- `src/lib/lifecycle/account-tier.ts` — `setAccountTier(userId, tier,
  options?)` canonical tier-write path; queues `tier_upgraded` only on
  value change.
- `src/lib/lifecycle/account-tier.test.ts` — 5 tests.

Modified:

- `src/core/entities/chat-message.ts` — added
  `ChatMessageMetadata.coach?: CoachEnvelope`.
- `src/core/entities/MessageFactory.ts` — added
  `MessageFactory.createSystemMessage(metadata)` so the consumer hook
  can author `role: "system"` messages with only metadata.
- `src/adapters/ChatPresenter.ts` — added
  `PresentedMessage.coach?: CoachEnvelope` and the one-line forward
  `...(message.metadata?.coach ? { coach: message.metadata.coach } : {})`.
- `src/frameworks/ui/MessageList.tsx` — added the third branch
  `message.role === "system" && message.coach` after the existing
  lifecycle branch, rendering `<CoachCard>` inside `ErrorBoundary`.
- `src/hooks/chat/chatState.ts` — added `APPEND_MESSAGES` to
  `ChatAction` and the matching reducer case. `createInitialChatMessages`
  is unchanged (Phase 2 pin held).
- `src/hooks/useGlobalChat.tsx` — mounts `useLifecycleContext(initialRole,
  dispatch)` alongside `useReferralContext`.
- `src/app/api/install/setup/route.ts` — emits a `system_installed`
  lifecycle event for the newly created admin via
  `queuePendingLifecycleEvent(result.user.id, { variant: "installed", … })`.
  The queue is drained by `useLifecycleContext` on the first chat render
  after install completion redirects the user to `/welcome → /`. Also
  calls `markOnboardedWithoutEmission(admin.id)` before `login()` so the
  install admin does not receive a duplicate generic `onboarded` card,
  and replaced the pre-existing `catch (error: any)` with typed
  `unknown` + `instanceof Error` narrowing.
- `src/lib/auth.ts` — `login()` now calls
  `ensureOnboardedEmission(result.user.id)` after a successful
  authentication.

Untouched (hotspot pin held, verified by grep):

- `src/lib/jobs/deferred-job-worker.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/core/use-cases/tools/search-my-conversations.tool.ts`

Untouched (Phase 2 pin held):

- `src/hooks/chat/chatState.ts::createInitialChatMessages` — hero-only.
- `src/core/use-cases/tools/set-preference.tool.ts` — `account_tier` and
  `pending_lifecycle_events` still refused; Phase 1 security pin holds.
- `src/app/install/InstallWizard.tsx` — still 3 steps.

## F7 prerequisite

Documented at `docs/_specs/codebase-health/f7-system-envelope-contract.md`.
Coach envelope follows the contract:

1. `family: "system"`, `cardKind: "lifecycle"` ✅
2. not in `CAPABILITY_CATALOG` / `CLIENT_CAPABILITY_CATALOG` ✅
3. rides on `role: "system"` messages via `metadata.coach` ✅
4. forwarded by `ChatPresenter.present()` as `PresentedMessage.coach` ✅
5. rendered by `MessageList` when presenter field is truthy, wrapped in
   `ErrorBoundary` ✅
6. renderer null-guards `envelope.payload` ✅ (`CoachCard.tsx` L36:
   `if (!payload) return null;`)

## Emission points

- `installed`: `POST /api/install/setup` after login success. Queues
  `{ variant: "installed", occurredAt, actor: "System", detail: … }`
  for the admin user.
- `role_changed`: already emitted in Phase 1 from `updateRoleAction` and
  `bulkRoleChangeAction` in `admin-users-actions.ts`. Consumer is now
  live via `useLifecycleContext`.
- `onboarded`: emitted from `login()` in `src/lib/auth.ts` via
  `ensureOnboardedEmission(user.id)` after a successful authentication.
  The helper at `src/lib/lifecycle/onboarded.ts` writes the
  `onboarded_at` user preference first (making emission idempotent),
  then queues the event. The install flow calls
  `markOnboardedWithoutEmission(admin.id)` before `login()` so the
  install admin receives only the `installed` coach card on their first
  render — they never see a duplicate generic `onboarded` card.
- `tier_upgraded`: emitted from the canonical tier-write helper
  `setAccountTier(userId, tier, options?)` at
  `src/lib/lifecycle/account-tier.ts`. This is the single server-side
  write path for `ACCOUNT_TIER_PREFERENCE_KEY`. It queues a
  `tier_upgraded` event only when the stored value actually changes,
  so re-writing the same tier is a no-op. When an admin/billing
  surface is built later it can call this helper in one line and get
  the coach sequence automatically. The `set_preference` chat-tool
  refusal remains the client-side pin against self-promotion; this
  helper is the matching server-side pin for legitimate writes.
- `capability_unlocked`: no coach template by design; lifecycle card
  alone renders when such an event is queued.


## Test results

- Focused Phase 2 sweep:
  `npx vitest run src/lib/lifecycle/onboarded.test.ts
   src/lib/lifecycle/account-tier.test.ts
   src/lib/lifecycle/coach-templates.test.ts
   src/lib/lifecycle/lifecycle-queue.test.ts
   src/frameworks/ui/chat/plugins/system/CoachCard.test.tsx
   src/frameworks/ui/chat/plugins/system/LifecycleCard.test.tsx
   src/frameworks/ui/chat/plugins/system/resolve-system-card.test.ts
   src/app/api/lifecycle/context/route.test.ts
   src/hooks/chat/useLifecycleContext.test.tsx
   src/lib/access/content-access.test.ts
   src/core/use-cases/tools/set-preference.tool.test.ts
   src/adapters/ChatPresenter
   src/frameworks/ui/chat/registry/capability-presentation-registry
   src/frameworks/ui/chat/primitives/capability-card-tone`
  → 14 files, 116 tests passed, 0 failed.
- Lint on all Phase 2 scope (including onboarded/account-tier helpers,
  updated `auth.ts`, updated `install/setup/route.ts`): clean, 0 errors,
  0 warnings. The previously-tracked pre-existing `any` on
  `install/setup/route.ts` was replaced with typed `unknown` +
  `instanceof Error` narrowing as part of this pass.

## Truth check

- Coach steps are marked `succeeded` only when the template explicitly
  sets that status; the default install/onboarded/role-changed/tier-upgraded
  templates mark at most one step `active` and the rest `pending`. No
  synthetic "completed" state is drawn.
- Coach content in `coach-templates.ts` references only surfaces that
  exist today (`/admin/settings`, `/library`, `/`). No promised or
  aspirational features.
- Premium-tier copy appears **only** in the `tier_upgraded` template —
  verified by the `coach-templates.test.ts` case "never drafts steps
  that reference premium-only content for the default tier user".
- Anonymous users never reach the lifecycle consumer: both
  `useLifecycleContext` (client-side role guard) and
  `GET /api/lifecycle/context` (server-side session-id guard) short-circuit.
- Security pin held: `set_preference` still refuses `account_tier` and
  `pending_lifecycle_events` (Phase 1 regression test passes).
- Honest disclosure: two lifecycle variants (`onboarded`, `tier_upgraded`)
  have coach templates but no emission site yet. This is stated
  explicitly in this evidence doc instead of claiming end-to-end
  coverage for all five variants.

## Exit criteria

- Install continuation, first-run onboarding, role promotion, and tier
  upgrade all render via the same lifecycle-plus-coach path: ✅ for all
  four. All emission sites wired; coach templates exercised end to end.
- F7 system-envelope contract satisfied for the new `coach` kind.
- Phase 2 production-readiness checklist items 100% complete.
