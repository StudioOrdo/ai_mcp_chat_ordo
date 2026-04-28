# Phase 1 — Product packaging and tier reset: Evidence

## Summary

Phase 1 introduces customer-tier awareness (`account` / `premium`) as a
SessionUser attribute sourced from `user_preferences`, a tier-aware audience
helper at the interactor layer, a lifecycle system card rendered inline in
chat, a first lifecycle variant emitted from the admin role-update path, and
tier/role separation in the account dropdown. Security pins (tier cannot be
written by `set_preference`; `premium` audience is not widened at
`AUDIENCE_ROLES`; hotspots untouched) are preserved.

## Carry-forward reality (verified)

- `User` at [src/core/entities/user.ts](src/core/entities/user.ts) had
  `id | email | name | roles` only. Extended with optional `tier` of type
  `UserTier = "account" | "premium"`.
- `user_preferences` storage path (`UserPreferencesRepository`,
  `UserPreferencesDataMapper`, `getUserPreferencesDataMapper()` in
  [RepositoryFactory.ts](src/adapters/RepositoryFactory.ts)) is unchanged;
  no schema migration.
- `ACCOUNT_TIER_PREFERENCE_KEY = "account_tier"` was added to the allow-list
  in [UserPreferencesDataMapper.ts](src/adapters/UserPreferencesDataMapper.ts)
  alongside `"pending_lifecycle_events"` (both server-only; neither is
  exposed to the client via `set_preference`).
- `SUPPORTED_PREFERENCE_KEYS` in
  [src/core/use-cases/tools/set-preference.tool.ts](src/core/use-cases/tools/set-preference.tool.ts)
  is unchanged; a regression test asserts this.
- 9 call sites of `canAccessAudience` migrated to the tier-aware sibling
  `canUserAccessAudience` across `LibrarySearchInteractor`,
  `GetChapterInteractor`, `CorpusIndexInteractor`, `CorpusSummaryInteractor`,
  `ChecklistInteractor`, `PractitionerInteractor`, and `CorpusTools`. The
  legacy `canAccessAudience` remains exported and unchanged.
- `AUDIENCE_ROLES.premium` is still `[STAFF, ADMIN]`. Tier widening happens
  only in `canUserAccessAudience` when `tier === "premium"` AND the role is
  not `ANONYMOUS`.
- `SystemCardKind` expanded from `"error" | null` to
  `"error" | "lifecycle" | null` in
  [src/frameworks/ui/chat/plugins/system/resolve-system-card.ts](src/frameworks/ui/chat/plugins/system/resolve-system-card.ts).
- Hotspots untouched: `deferred-job-worker.ts`, `runtime-tool-binding.ts`,
  `search-my-conversations.tool.ts`.

## Changes

### Core entities & access

- [src/core/entities/user.ts](src/core/entities/user.ts): added `UserTier`
  union and optional `tier` on `User`.
- [src/core/entities/lifecycle.ts](src/core/entities/lifecycle.ts) (new):
  `LifecycleVariant` union (`installed | onboarded | role_changed |
  tier_upgraded | capability_unlocked`), `LifecyclePayload`,
  `LifecycleEnvelope = CapabilityResultEnvelope<LifecyclePayload>`,
  `LIFECYCLE_EVENT_TOOL_NAME = "lifecycle_event"`.
- [src/lib/access/content-access.ts](src/lib/access/content-access.ts):
  exported `ACCOUNT_TIER_PREFERENCE_KEY` and added `canUserAccessAudience({
  audience, role, tier })` which delegates to `canAccessAudience` first,
  widens `premium` only when `tier === "premium"` AND `role !== "ANONYMOUS"`,
  otherwise denies. `getDeniedAudienceForUser` is the tier-aware sibling of
  `getDeniedAudience`.
- [src/lib/auth.ts](src/lib/auth.ts): `resolveUserTier(userId)` reads
  `user_preferences(key=account_tier)` and returns `"premium" | "account" |
  undefined`. `getSessionUser()` spreads `tier` onto the returned session.
  `ANONYMOUS_USER` carries `tier: undefined`.

### Tier plumbing

- [src/core/tool-registry/ToolExecutionContext.ts](src/core/tool-registry/ToolExecutionContext.ts):
  added optional `tier?: UserTier`.
- [src/lib/chat/chat-turn.ts](src/lib/chat/chat-turn.ts) and
  [src/lib/chat/stream-route-handler.ts](src/lib/chat/stream-route-handler.ts):
  build `ToolExecutionContext` with `tier: user.tier`.
- [src/core/use-cases/tools/CorpusTools.ts](src/core/use-cases/tools/CorpusTools.ts):
  all 6 tool command classes thread `context?.tier` into interactor requests
  and into `loadStructuredSectionPayload`.
- `LibrarySearchInteractor`, `GetChapterInteractor`, `CorpusIndexInteractor`,
  `CorpusSummaryInteractor`, `ChecklistInteractor`, `PractitionerInteractor`
  request types gained optional `tier?: UserTier`; all call sites migrated
  from `canAccessAudience(audience, role)` to
  `canUserAccessAudience({ audience, role, tier })`.

### Lifecycle emission

- [src/lib/lifecycle/lifecycle-queue.ts](src/lib/lifecycle/lifecycle-queue.ts)
  (new): `queuePendingLifecycleEvent`, `peekPendingLifecycleEvents`,
  `consumePendingLifecycleEvents`. Best-effort, skips
  `userId === "usr_anonymous"`, capped at `MAX_QUEUE_LENGTH = 8`, stored in
  `user_preferences(key=pending_lifecycle_events)` as JSON.
- [src/lib/admin/users/admin-users-actions.ts](src/lib/admin/users/admin-users-actions.ts):
  `updateRoleAction` and `bulkRoleChangeAction` call
  `queuePendingLifecycleEvent(userId, { variant: "role_changed", ... })`
  after a successful interactor update.

### Lifecycle rendering

- [src/core/entities/chat-message.ts](src/core/entities/chat-message.ts):
  `ChatMessageMetadata.lifecycle?: LifecycleEnvelope`.
- [src/adapters/ChatPresenter.ts](src/adapters/ChatPresenter.ts):
  `PresentedMessage.lifecycle?: LifecycleEnvelope`; `present()` forwards
  `message.metadata?.lifecycle`.
- [src/frameworks/ui/chat/plugins/system/resolve-system-card.ts](src/frameworks/ui/chat/plugins/system/resolve-system-card.ts):
  `SystemCardKind` expanded; `isLifecycleEnvelope` guard added; lifecycle
  branch takes priority over media/error in `resolveSystemCardKind`.
- [src/frameworks/ui/chat/plugins/system/lifecycle-descriptor.ts](src/frameworks/ui/chat/plugins/system/lifecycle-descriptor.ts)
  (new): `LIFECYCLE_EVENT_DESCRIPTOR` (`family: "system"`, `cardKind:
  "lifecycle"`, inline, `historyMode: "payload_snapshot"`,
  `defaultSurface: "conversation"`), `VARIANT_LABELS`,
  `createLifecycleEnvelope`, `isLifecycleResultEnvelope`.
- [src/frameworks/ui/chat/plugins/system/LifecycleCard.tsx](src/frameworks/ui/chat/plugins/system/LifecycleCard.tsx)
  (new): client component built on `CapabilityCardShell` +
  `CapabilityTimeline`. Emits `data-capability-kind="lifecycle"`,
  `data-capability-state="succeeded"`, `data-lifecycle-variant`,
  `data-lifecycle-title`, `data-lifecycle-caption`,
  `data-lifecycle-occurred-at`.
- [src/frameworks/ui/MessageList.tsx](src/frameworks/ui/MessageList.tsx):
  renders `LifecycleCard` when `message.role === "system" &&
  message.lifecycle`, wrapped in `ErrorBoundary`. `HERO_PROOF_POINTS` copy
  rewritten to beginner-solopreneur framing (conversation-first, governed
  for solopreneurs, lifecycle-aware).

### Navigation

- [src/components/AccountMenu.tsx](src/components/AccountMenu.tsx): dropdown
  header now shows a tier badge (`data-shell-tier-badge={user.tier ??
  "account"}` — "Premium" or "Account") and a role badge
  (`data-shell-role-badge={user.roles[0]}`) only when authenticated. Staff
  and Admin render as operating-role badges, never as customer tiers.

## Tier flow

```
user_preferences(key=account_tier)
     ↓
resolveUserTier() in src/lib/auth.ts
     ↓
getSessionUser() → SessionUser.tier
     ↓
chat-turn / stream-route-handler → ToolExecutionContext.tier
     ↓
CorpusTools → interactor.request.tier
     ↓
canUserAccessAudience({ audience, role, tier })
```

Write path (admin only):

```
admin-users-actions.updateRoleAction
     ↓
queuePendingLifecycleEvent(userId, { variant: "role_changed", ... })
     ↓
user_preferences(key=pending_lifecycle_events) JSON array
```

## Security pins (verified)

- `set_preference` tool **cannot** write `account_tier` or
  `pending_lifecycle_events`. Asserted in
  [src/core/use-cases/tools/set-preference.tool.test.ts](src/core/use-cases/tools/set-preference.tool.test.ts).
- `AUDIENCE_ROLES.premium` stayed `[STAFF, ADMIN]`; widening is purely at
  the helper layer.
- Anonymous sessions cannot reach premium even with a spoofed tier (role
  guard in `canUserAccessAudience`). Asserted in
  [src/lib/access/content-access.test.ts](src/lib/access/content-access.test.ts).
- Hotspots untouched: `deferred-job-worker.ts`, `runtime-tool-binding.ts`,
  `search-my-conversations.tool.ts`.

## Scope decisions

- **`lifecycle_event` not registered in `CAPABILITY_CATALOG` /
  `CLIENT_CAPABILITY_CATALOG`.** The descriptor lives in
  `lifecycle-descriptor.ts` and is consumed directly by `LifecycleCard`.
  Lifecycle envelopes flow via `ChatPresenter.lifecycle` passthrough on
  system messages, not via LLM tool calls; no catalog entry is required
  for rendering. Phase 2 will register the descriptor if and when a
  capability-catalog-aware surface (e.g., a lifecycle feed) needs it.
- **Navigation tier/role separation scoped to AccountMenu.** `SiteNav`,
  `ShellWorkspaceMenu`, `ShellNavDrawer`, and `AppShell` receive
  `SessionUser` but do not render role badges today; no counterpart tier
  badges are needed there. AccountMenu is the sole identity surface and
  satisfies the Phase 1 deliverable.

## QA results

### Focused behavior (Phase 1 new tests — 26/26 passing)

```
npx vitest run \
  src/lib/access/content-access.test.ts \
  src/core/use-cases/tools/set-preference.tool.test.ts \
  src/lib/lifecycle/lifecycle-queue.test.ts \
  src/frameworks/ui/chat/plugins/system/LifecycleCard.test.tsx \
  src/frameworks/ui/chat/plugins/system/resolve-system-card.test.ts

 Test Files  5 passed (5)
      Tests  26 passed (26)
```

Coverage:

- `canUserAccessAudience` tier-aware matrix (9 tests) including the
  anonymous+premium bypass-denial case.
- `set_preference` tool refuses `account_tier` and
  `pending_lifecycle_events` (5 tests) — security pin.
- `lifecycle-queue` FIFO, cap, anonymous skip (4 tests).
- `LifecycleCard` renders shell, timeline, caption, variant, timestamp,
  and routes through `resolveSystemCardKind` (4 tests).
- `resolve-system-card` lifecycle priority ordering (4 tests).

### Regression sweep (Phase 0 contract — 124/124 passing)

```
npx vitest run \
  src/lib/access src/core/use-cases/LibrarySearchInteractor \
  src/core/use-cases/LibraryInteractors \
  src/core/use-cases/tools/search-corpus.tool \
  src/core/search/corpus-indexing src/lib/corpus-vocabulary \
  src/lib/corpus-reference src/lib/library-chapter-display \
  src/frameworks/ui/chat/primitives/capability-card-tone \
  src/frameworks/ui/chat/registry/capability-presentation-registry \
  tests/error-standardization tests/public-content-routes

 Test Files  12 passed (12)
      Tests  124 passed (124)
```

### Lint (scope clean)

```
npx eslint <28 Phase 1 files>
EXIT=0
```

### TypeScript (scope clean)

```
npx tsc --noEmit
TSC_EXIT=1 (pre-existing 51-line baseline)
Phase 1 scope grep: 0 matches
```

All 51 `tsc` errors are pre-existing baseline in unrelated subsystems
(`next.config.ts` eslint key, media pipeline mocks, deferred-job test mock
types, `runtime-tool-binding.test.ts` mock types,
`ConversationInteractor.test.ts` mock shape,
`job-capability-registry.ts` generic variance). Zero errors touch any file
in Phase 1 scope.

### Truth check

- No honest-disclosure contract changes. Staff/Admin are never framed as
  customer tiers; they are operating roles, rendered with a distinct
  role badge.
- Tier cannot be self-claimed — `set_preference` rejects `account_tier` (5
  tests). Only the admin role-update path queues the lifecycle event.
- Hotspots not touched.

## Exit criteria met

- Phase 1 goals delivered.
- All QA gates passed.
- Scope decisions (catalog registration, nav scope) documented above.
- Ready for Phase 2 (conversation-first onboarding and lifecycle coach mode).
