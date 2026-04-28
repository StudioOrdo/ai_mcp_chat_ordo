# Phase 3 Evidence — Referral, QR, and Campaign Simplification

**Status:** Complete (2026-04-22)
**Result:** All exit criteria met; 55 Phase 3 tests green + 116 Phase 2 regression tests green; lint clean across 19 touched files.

## Decisions resolved

### Decision 1 — Coach variant strategy: WIDEN

`CoachPayload.variant` was widened from `LifecycleVariant` to a
discriminated union `CoachVariant = LifecycleVariant | CampaignVariant`.

- New `src/core/entities/campaign.ts` exports
  `CampaignVariant = "campaign_introduction" | "campaign_picked"` plus
  `CAMPAIGN_VARIANTS` and `isCampaignVariant` helpers.
- `src/core/entities/coach.ts` imports `CampaignVariant`, re-exports
  `CoachVariant`, and the `CoachPayload.variant` field now accepts
  either.
- The `LifecycleEvent.variant` type is untouched — lifecycle queue,
  lifecycle route, and `buildCoachPayloadForLifecycle` remain
  lifecycle-only by construction.

Rationale: reusing `capability_unlocked` (the "zero-change" option) was
semantically wrong — the campaign coach is not tied to a role flip and
would have forced filtering on `title`/`toolName` at every call site.
Widening keeps each variant honest and type-safe; lifecycle consumers
never observe campaign variants because lifecycle events are never
queued with them.

### Decision 2 — Campaign coach emission path: PARALLEL HOOK + EXTEND VISIT ROUTE

Two cleanly separated emission paths:

- **Authenticated path:** new
  `queuePendingCampaignCoach` / `peekPendingCampaignCoach` /
  `consumePendingCampaignCoach` at
  `src/lib/referrals/campaign-queue.ts` store full `CoachPayload` JSON
  at the `pending_campaign_coach` preference key. New
  `GET /api/campaign/context` at
  `src/app/api/campaign/context/route.ts` drains the queue and wraps
  each payload in a `CoachEnvelope`. New
  `useCampaignContext` at `src/hooks/chat/useCampaignContext.ts`
  mirrors `useLifecycleContext`, runs once before the first
  assistant turn, dispatches `APPEND_MESSAGES` with
  `MessageFactory.createSystemMessage({ coach })`. Mounted in
  `src/hooks/useGlobalChat.tsx` right after `useLifecycleContext`.
- **Anonymous path:** `GET /api/referral/visit` now additionally
  returns a `coach` field built via
  `buildReferralIntroductionCoachPayload(visit.referrer.name)`.
  `useReferralContext` was extended: after the existing
  `REPLACE_ALL` dispatch that re-seeds the greeting, it appends a
  single `APPEND_MESSAGES` carrying the campaign-introduction coach.
  The `ReferralContext` seeding for visitors without a coach payload
  is preserved (the coach field is optional).

Rationale: folding the anonymous campaign coach into the referral
visit fetch avoids a second network round-trip on the cold anonymous
render. For authenticated users, the queue/route/hook trio mirrors
the lifecycle pattern 1:1 so reviewers can reason by analogy.

### Decision 3 — Campaign preset source of truth: CODE-SIDE WITH CORPUS-SLUG FORWARD HINT

Typed, code-side presets ship in `src/lib/referrals/campaign-presets.ts`
with a forward-looking `corpusSlug` field (e.g.
`campaign/friends-and-family`) that the Phase 4 retrieval slice can
pick up without changing the `CampaignPreset` type.

Three honest presets:

- `friends_and_family` — "The warmest, lowest-friction start"
- `local_flyers` — "Print your QR where your neighbors already look"
- `lightweight_paid_outreach` — "A small test budget to see which
  channel earns trust fastest"

Each preset has exactly three coach steps referencing only surfaces
that exist today (`/referrals`, `/library`, physical share actions).
Two builders live alongside:

- `buildCampaignPresetCoachPayload(preset)` → `variant: "campaign_picked"`,
  step 0 active, rest pending, action `kind: "navigate"` href `/referrals`.
- `buildReferralIntroductionCoachPayload(referrerName)` →
  `variant: "campaign_introduction"`, title personalized when name
  provided, action href `/library`.

Rationale: corpus-sourced longer narrative is a retrieval concern;
Phase 3 must not block on retrieval infrastructure. The code-side
type is the presenter contract; the corpus slug is a pointer for
Phase 4 to follow.

### Decision 4 — Metrics pruning: KEEP ALL FIVE

All five existing `ReferralsWorkspace` metrics (Introductions,
Started chats, Registered, Qualified opportunities, Credit status)
are retained unchanged. Truth-check: all five are computed by
`AffiliateAnalyticsService` from real ledger/attribution data. No
metric implies a capability that does not exist.

Rationale: the pruning bar was "remove anything that implies an
unavailable capability." None of the five metrics cross that line.

## Scope fences held

- `ReferralQrCard` at `src/frameworks/ui/chat/plugins/custom/ReferralQrCard.tsx` was not rebuilt.
- `src/app/api/qr/[code]`, `src/app/api/referral/[code]`, and the
  referral ledger write path were not touched.
- HMAC secret handling, cookie lifetime, and legacy cookie cleanup in
  `src/lib/referrals/referral-visit.ts` are unchanged.
- No new `MessagePart` type, no new stream event type, no new presenter
  marker — the campaign coach rides on `ChatMessageMetadata.coach`
  exactly per the F7 envelope contract.
- Phase 2 pins all hold: `createInitialChatMessages` is hero-only,
  `set_preference` still refuses `account_tier` and
  `pending_lifecycle_events`, and the hotspot files
  (`deferred-job-worker.ts`, `runtime-tool-binding.ts`,
  `search-my-conversations.tool.ts`) were not touched.

## F7 envelope contract compliance (campaign variants)

For both `campaign_introduction` and `campaign_picked`:

- `schemaVersion: 1`
- `toolName: "coach_sequence"` (shared with lifecycle)
- `family: "system"` (NOT registered in `CAPABILITY_CATALOG`)
- `cardKind: "lifecycle"` (reuses the existing `CoachCard` renderer,
  which already null-guards `envelope.payload`)
- `executionMode: "inline"`
- `inputSnapshot: {}`
- `summary: { title }`
- `payload: CoachPayload` (non-null for these variants; the existing
  renderer's null-guard is still in force)

The campaign coach is carried on `role: "system"` messages authored
by `MessageFactory.createSystemMessage({ coach })` and forwarded as
the named `coach` field on `PresentedMessage`. Rendering is wrapped
in the existing `ErrorBoundary` in `MessageList`.

## File inventory

**New files (10):**

- `src/core/entities/campaign.ts`
- `src/lib/referrals/campaign-presets.ts`
- `src/lib/referrals/campaign-presets.test.ts`
- `src/lib/referrals/campaign-queue.ts`
- `src/lib/referrals/campaign-queue.test.ts`
- `src/app/api/campaign/context/route.ts`
- `src/app/api/campaign/context/route.test.ts`
- `src/hooks/chat/useCampaignContext.ts`
- `src/hooks/chat/useCampaignContext.test.tsx`
- `src/app/referrals/actions.ts`
- `src/app/referrals/actions.test.ts`

**Modified files (6):**

- `src/core/entities/coach.ts` — widened `CoachPayload.variant` to
  `CoachVariant`.
- `src/app/api/referral/visit/route.ts` — added `coach` field to
  valid-visit response.
- `src/app/api/referral/visit/route.test.ts` — assertion updated for
  the new `coach` field.
- `src/hooks/chat/useReferralContext.ts` — dispatches
  `APPEND_MESSAGES` after `REPLACE_ALL` when the visit response
  ships a coach.
- `src/hooks/chat/useReferralContext.test.tsx` — two new tests
  (coach append + no-append-when-missing).
- `src/components/referrals/ReferralsWorkspace.tsx` — inserted
  campaign preset picker section between the metrics strip and the
  share-tools grid; calls the new server action via `useTransition`.
- `src/app/r/[code]/page.tsx` — secondary CTA simplified from
  `btn-secondary "Open library"` button to a subtler text link
  "Or browse the library first →".
- `src/hooks/useGlobalChat.tsx` — mounts `useCampaignContext` after
  `useLifecycleContext`.

## Test results

### Phase 3 focused sweep (all new + modified)

```
 ✓ src/lib/referrals/campaign-presets.test.ts (9 tests)
 ✓ src/lib/referrals/campaign-queue.test.ts (5 tests)
 ✓ src/app/api/campaign/context/route.test.ts (4 tests)
 ✓ src/hooks/chat/useCampaignContext.test.tsx (6 tests)
 ✓ src/app/referrals/actions.test.ts (4 tests)
 ✓ src/app/api/referral/visit/route.test.ts (2 tests)
 ✓ src/hooks/chat/useReferralContext.test.tsx (8 tests)
 ✓ src/hooks/chat/useLifecycleContext.test.tsx (7 tests)
 ✓ src/lib/lifecycle/onboarded.test.ts (5 tests)
 ✓ src/lib/lifecycle/account-tier.test.ts (5 tests)

 Test Files  10 passed (10)
      Tests  55 passed (55)
```

### Phase 2 regression (F7 + lifecycle surface)

```
 ✓ src/lib/lifecycle/account-tier.test.ts (5 tests)
 ✓ src/lib/lifecycle/onboarded.test.ts (5 tests)
 ✓ src/hooks/chat/useLifecycleContext.test.tsx (7 tests)
 ✓ src/app/api/lifecycle/context/route.test.ts (4 tests)
 ✓ src/frameworks/ui/chat/plugins/system/CoachCard.test.tsx (5 tests)
 ✓ src/frameworks/ui/chat/plugins/system/LifecycleCard.test.tsx (4 tests)
 ✓ src/adapters/ChatPresenter.test.ts (50 tests)
 ✓ src/lib/lifecycle/coach-templates.test.ts (6 tests)
 ✓ src/lib/lifecycle/lifecycle-queue.test.ts (4 tests)
 ✓ src/core/use-cases/tools/set-preference.tool.test.ts (5 tests)
 ✓ src/frameworks/ui/chat/registry/capability-presentation-registry.test.ts (4 tests)
 ✓ src/lib/access/content-access.test.ts (9 tests)
 ✓ src/frameworks/ui/chat/plugins/system/resolve-system-card.test.ts (4 tests)
 ✓ src/frameworks/ui/chat/primitives/capability-card-tone.test.ts (4 tests)

 Test Files  14 passed (14)
      Tests  116 passed (116)
```

### Lint

ESLint on all 19 touched files — exit 0, zero errors, zero warnings.

## Emission path coverage

| Surface                                        | Variant                  | Emitter                                       | Consumer                  |
| ---------------------------------------------- | ------------------------ | --------------------------------------------- | ------------------------- |
| `/r/[code]` landing → chat (anonymous)         | `campaign_introduction`  | `GET /api/referral/visit` response            | `useReferralContext`      |
| Authenticated preset pick in `/referrals`      | `campaign_picked`        | `selectCampaignPresetAction` → campaign queue | `useCampaignContext`      |

## Deferred items (honestly called out)

- **`class: "guide"` corpus entries** for the three campaign patterns
  are deferred to Phase 4's retrieval slice. The
  `CampaignPreset.corpusSlug` field is the forward reference — when
  Phase 4 lands the retrieval pipeline with `class: "guide"` support,
  it can resolve these slugs without changing the Phase 3 contract.
  The single checklist line for this item is kept `[~]` rather than
  falsely `[x]`.

## Truth check

- No campaign metric implies an unavailable capability. All five
  `ReferralsWorkspace` metrics map to real `AffiliateAnalyticsService`
  computations.
- Coach step copy references only surfaces that exist today:
  `/referrals` (share tools + QR download), `/library` (public
  library), and physical share actions (copy link, download QR,
  message people directly).
- The `campaign-presets.test.ts` `never promises premium-only
  surfaces` test asserts "premium", "admin", and "staff" never
  appear in the introduction coach serialization.
- The `selectCampaignPresetAction` server action refuses anonymous
  users (`error: "anonymous"`) and unknown preset keys
  (`error: "unknown_preset"`) before touching the queue.
- CTA copy on `/r/[code]` is unchanged in substance — the primary
  CTA still reads "Start chat" and the secondary still points to
  `/library`; only the secondary's visual weight was reduced.

## Exit criteria

All Phase 3 checklist items in
`production-readiness-checklist.md` are `[x]`, except the one
deferred-to-Phase-4 corpus-entries line which is honestly `[~]`.
Phase 3 is **complete**.
