# Phase 01c3t Evidence: Solopreneur Operating Loop Closeout

Status: Implemented

Evidence date: 2026-05-05

## Product Contract

Governing contract:

- `docs/_business/ux/08-product-kernel-contract.md`

Invariant:

- Chat is the operating interface.
- UI surfaces are the governance layer.

This closeout certifies the owner-facing product kernel: Today, Studio, People,
Offers, and Profile govern work that is initiated in chat. Jobs, activity,
notifications, operations, logs, and raw provider details remain provenance,
diagnostics, or admin concerns.

## Code Changes

Object and route contracts:

- `src/core/entities/ordo-object.ts`
- `src/core/entities/ordo-object.test.ts`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/shell-navigation.test.ts`

Product-kernel closeout gate:

- `src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts`

Docs:

- `docs/_refactor/ordo/phases/01c3t-solopreneur-operating-loop-closeout.md`
- `docs/_refactor/ordo/evidence/phase-01c3t-solopreneur-operating-loop-closeout.md`

## Behavior Implemented

- Offers are now a first-class object-centered owner surface in the shared
  taxonomy and shell route model.
- People remains focused on relationships, referrals, tracked links, campaigns,
  and conversations.
- Owner navigation is proven to be Today, Studio, People, Offers, Profile.
- Public discovery remains Home, Offers, About, with Feed appearing only when
  public feed content exists.
- Jobs, Activity, My Media, Referrals, and Media Ops remain donor/diagnostic
  routes and are not regular-owner primary navigation.
- The closeout gate proves durable or derived backing for offers, offer events,
  tracked links, tracked-link events, people stages, content performance, and
  Today results.
- The closeout gate proves production shell files do not mount the stale right
  drawer or top-right job/notification donor components.

## QA Pass 1

Focused phase and related tests:

- `npx vitest run src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts src/core/entities/ordo-object.test.ts src/lib/shell/shell-navigation.test.ts src/components/AuthenticatedWorkRail.test.tsx src/lib/offers/offer-service.test.ts src/core/use-cases/tools/offer-management.tool.test.ts src/lib/business/people-read-model.test.ts src/lib/tracked-links/tracked-link-service.test.ts src/lib/content/content-campaign-read-model.test.ts src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/ordo-details/load-business-object-detail.test.ts`

Initial result:

- Failed in the new closeout gate. Related implementation tests passed.

Issues found and fixed:

- The closeout gate looked for an older tracked-link method name
  `recordEvent`; the real backing contract is repository `appendEvent` behind
  service `appendLinkEvent`.
  - Fix: updated the closeout assertion to prove the current durable append
    path.
- The closeout gate looked for `sourceRefs`/`provenanceRefs` in the
  `load-business-object-detail` wrapper instead of the actual detail projector.
  - Fix: updated the assertion to verify the wrapper calls detail projectors
    and the projector file carries refs.
- The closeout gate used a line-sensitive `scenario tests` assertion for phase
  docs.
  - Fix: updated the assertion to allow line wrapping while still requiring
    scenario-test coverage.

Focused rerun:

- Passed. 13 files, 92 tests.

Typecheck:

- `npm run typecheck`
- Passed.

Lint:

- `npm run lint`
- Passed with existing repo warnings only: 0 errors, 213 warnings.

Static scans:

- Product Kernel scan:
  - `rg -n "Product Kernel Contract|Kernel Alignment|Scenario" docs/_refactor/ordo/phases/01c3{n,o,p,q,r,s,t}-*.md`
  - Classification: phase package is grounded in the Product Kernel Contract.
    The new closeout test enforces status, kernel object coverage, scenario
    tests, donor grounding, and visibility language across every phase file.
- Stale owner-surface scan:
  - `rg -n "ShellWorkspaceMenu|JobsRail|AttentionInbox|/jobs|/activity|/my/media|/referrals|operations/media" src/components src/lib/shell tests`
  - Classification: hits are donor/diagnostic routes, utility badge donors,
    tests, or compatibility direct links. Production `AppShell` and `SiteNav`
    do not mount `ShellWorkspaceMenu`, `JobsRail`, `AttentionInbox`, or
    `NotificationFeed`.
- Schema/read-model scan:
  - `rg -n "offers|offer_events|tracked_links|tracked_link_events|customer_stage|purchased_simulated" src tests`
  - Classification: `offers`, `offer_events`, `tracked_links`, and
    `tracked_link_events` are durable tables/read-models. There is no
    `customer_stage` table; stages are intentionally derived in
    `people-read-model.ts`, including `purchased_simulated`.
- Card/detail scan:
  - `rg -n "kind: \"offer\"|kind: \"person\"|kind: \"tracked_link\"|defaultLens|provenanceRefs|sourceRefs" src/lib/ordo-cards src/lib/ordo-details tests`
  - Classification: offer, person, and tracked-link cards/details carry
    default lenses and source/provenance references.

## QA Pass 2

Focused phase and related tests:

- `npx vitest run src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts src/core/entities/ordo-object.test.ts src/lib/shell/shell-navigation.test.ts src/components/AuthenticatedWorkRail.test.tsx src/lib/offers/offer-service.test.ts src/core/use-cases/tools/offer-management.tool.test.ts src/lib/business/people-read-model.test.ts src/lib/tracked-links/tracked-link-service.test.ts src/lib/content/content-campaign-read-model.test.ts src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/ordo-details/load-business-object-detail.test.ts`

Result:

- Passed. 13 files, 92 tests.

Typecheck:

- `npm run typecheck`
- Passed.

Lint:

- `npm run lint`
- Passed with existing repo warnings only: 0 errors, 213 warnings.

Static scans rerun:

- Product Kernel scan: passed with expected phase-package hits.
- Stale owner-surface scan: expected donor/diagnostic/test hits only.
- Schema/read-model scan: durable offers/tracked-link tables and derived people
  stages remain present.
- Card/detail scan: card/detail refs and lenses remain present.

Owner UI leak check:

- `rg -n "provider log|runtime log|raw log|inputSnapshot|ROI|fake revenue|raw job id|job_[A-Za-z0-9_-]+|asset_[A-Za-z0-9_-]+|tracked_link_events|offer_events" src/components/dashboard src/components/business src/components/offers src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx src/components/AppShell.tsx src/lib/dashboard src/lib/business src/lib/offers src/lib/ordo-cards src/lib/ordo-details`

Classification:

- Raw job ids, `inputSnapshot`, and provider-log text appear only in tests,
  internal source refs, detail provenance, or explicit negative assertions.
- `offer_events` and `tracked_link_events` appear in mappers/read models/tests,
  not public or regular-owner display copy.
- No fake ROI/revenue claim was found in regular owner UI.
- Public offer tests still assert private provenance/schema names do not leak.

No QA Pass 2 code changes were required.
