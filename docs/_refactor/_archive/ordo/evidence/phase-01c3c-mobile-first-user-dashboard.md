# Phase 01c3c Mobile-First User Dashboard

Status: Implemented
Date: 2026-05-04

## Purpose

This evidence file records the implementation of `/workspace` as the regular
user's mobile-first dashboard.

The key decision is:

Dashboard state must come from durable activity, not from whether the user has
an active chat-context projection.

## Code Inspected

- `src/app/workspace/page.tsx`
  - Previous route rendered `WorkspaceOverviewSurface`.
- `src/frameworks/ui/WorkspaceOverviewSurface.tsx`
  - Previous chat-context-only workspace surface.
- `src/frameworks/ui/ProductExperienceSummary.tsx`
  - Donor patterns for compact work summaries.
- `src/lib/activity/activity-read-model.ts`
  - Durable activity source created by 01c3b.
- `src/lib/referrals/referral-analytics.ts`
  - Referral/KPI overview source for the business-loop block.
- `src/lib/shell/shell-navigation.ts`
  - Signed-in route label and account/work rail route model.
- `src/components/AuthenticatedWorkRail.tsx`
  - Signed-in work rail that exposes `/workspace`.

## Implemented Artifacts

- `src/lib/dashboard/load-user-dashboard.ts`
  - Server-side dashboard loader.
- `src/components/dashboard/UserDashboard.tsx`
  - Mobile-first dashboard UI.
- `src/components/activity/ActivityCard.tsx`
  - Shared activity card and empty-state primitives.
- `src/app/workspace/page.tsx`
  - Authenticated `/workspace` dashboard route.
- `src/app/activity/page.tsx`
  - Minimal authenticated activity ledger for dashboard view-all links.
- `src/lib/shell/shell-navigation.ts`
  - `workspace-overview` label changed to `Dashboard`.
- `src/lib/dashboard/load-user-dashboard.test.ts`
  - Loader tests.
- `src/components/dashboard/UserDashboard.test.tsx`
  - Rendering tests.
- `src/app/workspace/page.test.tsx`
  - Route/auth tests.
- `src/app/activity/page.test.tsx`
  - Minimal activity ledger route tests.
- `src/components/AuthenticatedWorkRail.test.tsx`
  - Work rail label update.

## Dashboard Blocks

- Needs attention:
  - Loads `bucket: needs_attention`.
  - Shows failed jobs, blocked workflows, and pending operation confirmations.
- Current work:
  - Loads `bucket: running`.
  - Shows queued/running jobs, workflows, and operations.
- Recent outputs:
  - Loads completed activity and filters to output-producing source kinds:
    `job`, `media_workflow`, and `operation`.
- Business loop:
  - Loads `sourceKind: referral_milestone`.
  - Adds referral overview metrics from `ReferralAnalyticsService.getOverview`.
- System health:
  - Uses aggregate dashboard state only.
  - Does not expose runtime logs, provider logs, or route metrics to regular
    users.

## Verification

Commands run:

```bash
npx vitest run src/lib/activity/activity-read-model.test.ts src/app/api/activity/route.test.ts 'src/app/api/activity/[activityId]/receipt/route.test.ts' src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx src/app/activity/page.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/lib/shell/shell-navigation.test.ts
npx eslint src/lib/dashboard/load-user-dashboard.ts src/lib/dashboard/load-user-dashboard.test.ts src/components/activity/ActivityCard.tsx src/components/dashboard/UserDashboard.tsx src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.tsx src/app/workspace/page.test.tsx src/app/activity/page.tsx src/app/activity/page.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/lib/shell/shell-navigation.ts src/lib/shell/shell-navigation.test.ts
npm run typecheck
```

Result:

- 47 targeted Vitest tests passed.
- ESLint passed.
- TypeScript passed with `tsc --noEmit`.

## QA Follow-Up

QA found two implementation polish gaps after the first implementation pass:

- The spec called out reusable named dashboard blocks. The UI now keeps the
  shared `DashboardBlock` primitive but wraps it with phase-named blocks:
  `DashboardAttentionBlock`, `DashboardCurrentWorkBlock`,
  `DashboardRecentOutputsBlock`, `DashboardBusinessLoopBlock`, and
  `DashboardSystemHealthBlock`.
- The new dashboard/activity UI used positive `tracking-*` classes and one
  invalid `hover:opacity-86` utility. The phase-owned UI now avoids new
  positive letter-spacing classes and uses a valid hover opacity utility.

Re-run after QA fixes:

```bash
npx vitest run src/lib/activity/activity-read-model.test.ts src/app/api/activity/route.test.ts 'src/app/api/activity/[activityId]/receipt/route.test.ts' src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.test.tsx src/app/activity/page.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/lib/shell/shell-navigation.test.ts
npx eslint src/lib/dashboard/load-user-dashboard.ts src/lib/dashboard/load-user-dashboard.test.ts src/components/activity/ActivityCard.tsx src/components/dashboard/UserDashboard.tsx src/components/dashboard/UserDashboard.test.tsx src/app/workspace/page.tsx src/app/workspace/page.test.tsx src/app/activity/page.tsx src/app/activity/page.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/lib/shell/shell-navigation.ts src/lib/shell/shell-navigation.test.ts
npm run typecheck
```

QA result:

- 47 targeted Vitest tests passed.
- ESLint passed.
- TypeScript passed with `tsc --noEmit`.

## Follow-On Boundaries

- 01c3d owns the richer `/activity` workspace and durable attention inbox.
- 01c3e owns `/jobs` convergence into a single-column work index.
- `WorkspaceOverviewSurface` remains donor code until later cleanup decides
  whether it is still useful for embedded chat-specific summaries.
