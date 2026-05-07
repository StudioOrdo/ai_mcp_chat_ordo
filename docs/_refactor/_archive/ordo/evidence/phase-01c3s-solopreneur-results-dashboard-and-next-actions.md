# Phase 01c3s Evidence: Solopreneur Results Dashboard And Next Actions

Status: Implemented

Evidence date: 2026-05-05

## Product Contract

Governing contract:

- `docs/_business/ux/08-product-kernel-contract.md`

Invariant:

- Chat is the operating interface.
- UI surfaces are the governance layer.

This phase keeps `/workspace` as the compatible route but presents it as
Today: the owner cockpit for decisions, running work, measured results, weak
signals, and safe paths back to chat.

## Code Changes

Dashboard read model:

- `src/lib/dashboard/load-user-dashboard.ts`
- `src/lib/dashboard/load-user-dashboard.test.ts`

Dashboard UI:

- `src/components/dashboard/UserDashboard.tsx`
- `src/components/dashboard/UserDashboard.test.tsx`
- `src/app/workspace/page.test.tsx`

Docs:

- `docs/_refactor/ordo/phases/01c3s-solopreneur-results-dashboard-and-next-actions.md`
- `docs/_refactor/ordo/evidence/phase-01c3s-solopreneur-results-dashboard-and-next-actions.md`
- `docs/_business/ux/architecture/07-people-referrals-relationships-and-results.md`
- `docs/_business/ux/architecture/10-admin-observability-appliance-and-governance.md`

## Behavior Implemented

- Today now derives a results view from activity, referrals, people stages,
  durable offers, offer events, tracked links, and the content-performance
  campaign read model.
- Today shows Do Today, Making Progress, Ready To Inspect, Results, Not
  Working, Business Loop, Ask Ordo, and health in a mobile-first order.
- Result metrics are limited to durable evidence: visits/scans, tracked chats,
  offer choices, and simulated purchases.
- Weak-signal cards are only created from real objects: unpublished content,
  public content without links, links with visits but no chats, quiet QR links,
  and public offers without choices.
- Next-action cards are derived from draft/ready offers, follow-up people, and
  content awaiting review.
- Dashboard cards receive an Ask Ordo action payload so chat remains the
  operating path.
- Owner UI does not show raw provider logs, source prompts, revenue, ROI, or
  raw job ids as primary copy.

## QA Pass 1

Issue found:

- The first dashboard-card Ask Ordo link now belongs to a derived next-action
  card and correctly points to chat root instead of an existing conversation.

Fix:

- Updated the component test to assert that every card has Ask Ordo and that
  cards with existing conversation evidence still route to that conversation.

Issue found:

- Results copy mentioned `ROI`, which is not backed by durable revenue/order
  evidence.

Fix:

- Reworded owner UI copy to say revenue and return claims stay hidden until
  durable purchase evidence exists.

Focused rerun:

- `npx vitest run src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx`

Result:

- Passed. Focused rerun covered 3 files and 11 tests.

Issue found:

- The mobile reading-order component test exceeded the default 5 second test
  timeout when run inside the broader related suite.

Fix:

- Increased only that render-heavy test timeout to 10 seconds. The component
  behavior and assertion scope stayed unchanged.

Issue found:

- `npm run lint` found a phase-owned unused helper in the dashboard read model.

Fix:

- Removed the unused helper instead of wiring in dead aggregation behavior.

Focused related suite:

- `npx vitest run src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx src/lib/business/load-business-workspace.test.ts src/lib/content/content-campaign-read-model.test.ts src/lib/offers/offer-service.test.ts src/lib/tracked-links/tracked-link-service.test.ts`

Result:

- Passed. Focused related suite covered 7 files and 31 tests.

Typecheck:

- `npm run typecheck`

Result:

- Passed.

Lint:

- `npm run lint`

Result:

- Passed with existing repo warnings only: 0 errors, 213 warnings.

## QA Pass 2

Focused related suite:

- `npx vitest run src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx src/lib/business/load-business-workspace.test.ts src/lib/content/content-campaign-read-model.test.ts src/lib/offers/offer-service.test.ts src/lib/tracked-links/tracked-link-service.test.ts`

Result:

- Passed. Focused related suite covered 7 files and 31 tests.

Typecheck:

- `npm run typecheck`

Result:

- Passed.

Lint:

- `npm run lint`

Result:

- Passed with existing repo warnings only: 0 errors, 213 warnings.

Issue found:

- The static stale-surface scan found an old dashboard-limited-state fixture in
  `UserDashboard.test.tsx`.

Fix:

- Updated the test fixture to the current Today-limited-state message used by
  the dashboard read model.

Issue found:

- This evidence file still had the QA Pass 2 placeholder text.

Fix:

- Replaced the placeholder with the completed QA evidence.

Static scans:

- Stale placeholder/product scan over dashboard code and this evidence doc:
  no matches after fixes.
- Owner production surface leak scan over `src/components/dashboard`,
  `src/lib/dashboard`, and `src/app/workspace`: no matches for private provider
  logs, raw runtime payloads, raw job ids, secrets, revenue, ROI, or dollar
  claims outside tests.
