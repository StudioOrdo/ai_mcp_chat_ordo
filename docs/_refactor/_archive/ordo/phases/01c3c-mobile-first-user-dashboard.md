# Phase 01c3c: Mobile-First User Dashboard

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3b-activity-read-model-and-receipts.md`

## Goal

Turn `/workspace` into the regular user's mobile-first dashboard.

The dashboard should make Ordo feel like an operating system for the
solopreneur: what needs attention, what is running, what was created, and what
business loop is moving.

## Product Rule

Dashboard first, ledger second.

The dashboard is for the next decision. The full activity page is for audit and
inspection.

## Current Code Grounding

- `src/app/workspace/page.tsx`
  - Currently renders `WorkspaceOverviewSurface`.
- `src/frameworks/ui/WorkspaceOverviewSurface.tsx`
  - Projects chat/product experience state from `useChatSurfaceState`.
  - Does not currently load durable user activity server-side.
- `src/frameworks/ui/ProductExperienceSummary.tsx`
  - Donor UI for current work cards, jobs summary, assets, workflow, memory,
    and transition sections.
- `src/frameworks/ui/product-experience-summary.ts`
  - Existing action targeting maps job/job event to `/jobs`, user files to
    `/my/media`, referrals to `/referrals`, journal items to `/feed`.
- `src/components/AuthenticatedWorkRail.tsx`
  - Current signed-in work rail links to Current Work, Jobs, My Media,
    Referrals, Media Ops, Profile.
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts`
  - Existing resolver for active/attention/completed work badge counts.
- `src/components/jobs/JobsWorkspace.tsx`
  - Current hero summary and two-column detail surface donor code.
- `src/app/styles/jobs.css`
  - Existing status cards, progress bars, and job surface styling donor code.

## Target Shape

`/workspace` becomes `Dashboard`.

Dashboard blocks:

- `Needs attention`
  - failed jobs,
  - blocked workflows,
  - failed notification delivery that matters,
  - pending operation confirmations.
- `Current work`
  - running jobs,
  - running media workflows,
  - queued operations.
- `Recent outputs`
  - latest user media/assets,
  - completed workflow outputs.
- `Business loop`
  - referral/KPI summary when available,
  - links to Referrals/Offers/Feed as appropriate.
- `System health for this user`
  - compact, role-safe status.
  - Full diagnostics stay staff/admin.

Mobile rules:

- Single column.
- No two-column inspector.
- Primary actions are visible on cards.
- The dashboard must remain useful at 360px width.
- Expensive details link to Activity or a detail route.

Desktop rules:

- May use responsive sections, but the core reading order remains one column.
- Avoid nested cards.
- Keep headings smaller than public hero type.

## Required Work

- [x] Add a server-side dashboard loader that consumes the activity read model.
- [x] Replace `WorkspaceOverviewSurface` or wrap it with a dashboard composition:
  - preserve useful product-experience summary sections,
  - remove dependency on active chat context as the only dashboard content.
- [x] Rename visible nav label from `Current Work` to `Dashboard` if tests and
  product copy agree.
- [x] Build reusable dashboard components:
  - `DashboardAttentionBlock`,
  - `DashboardCurrentWorkBlock`,
  - `DashboardRecentOutputsBlock`,
  - `DashboardBusinessLoopBlock`,
  - `DashboardSystemHealthBlock`.
- [x] Add empty states that are useful for a new solopreneur account.
- [x] Ensure dashboard action links route to:
  - `/activity` for full ledger,
  - `/jobs?jobId=...` for technical job details if needed,
  - `/my/media`,
  - `/referrals`,
  - conversation links.

## Implemented Artifacts

- `src/lib/dashboard/load-user-dashboard.ts`
  - Server-side dashboard loader over the 01c3b activity read model.
  - Loads attention, running work, completed output candidates, referral
    milestones, referral KPI overview, and role-safe system health.
  - Degrades to a limited empty dashboard when source reads fail.
- `src/components/dashboard/UserDashboard.tsx`
  - Mobile-first dashboard composition with:
    - needs-attention block,
    - current-work block,
    - recent-outputs block,
    - business-loop block,
    - system-health block.
  - Keeps phase-named block wrappers around the shared dashboard primitive:
    `DashboardAttentionBlock`, `DashboardCurrentWorkBlock`,
    `DashboardRecentOutputsBlock`, `DashboardBusinessLoopBlock`, and
    `DashboardSystemHealthBlock`.
  - Uses a single DOM reading order and avoids the two-column jobs inspector
    pattern.
- `src/components/activity/ActivityCard.tsx`
  - Shared activity card and empty state primitives used by dashboard and the
    minimal activity ledger route.
- `src/app/workspace/page.tsx`
  - `/workspace` now authenticates, loads durable dashboard state server-side,
    and renders `UserDashboard`.
  - Metadata title changed to `Dashboard`.
- `src/app/activity/page.tsx`
  - Minimal authenticated activity ledger so dashboard `View all` links do not
    point to a dead route before 01c3d expands the activity surface.
- `src/lib/shell/shell-navigation.ts`
  - Signed-in workspace label changed from `Current Work` to `Dashboard`.
- `src/lib/dashboard/load-user-dashboard.test.ts`
  - Loader coverage for activity grouping, recent output filtering, empty
    state, and source-read failure.
- `src/components/dashboard/UserDashboard.test.tsx`
  - Rendering coverage for mobile reading order, primary actions, empty state,
    diagnostic suppression, and limited-state messaging.
- `src/app/workspace/page.test.tsx`
  - Auth redirect and signed-in loader wiring coverage.
- `src/app/activity/page.test.tsx`
  - Auth, filter wiring, and empty ledger coverage.
- Updated shell tests:
  - `src/components/AuthenticatedWorkRail.test.tsx`
  - `src/lib/shell/shell-navigation.test.ts`
- `docs/_refactor/ordo/evidence/phase-01c3c-mobile-first-user-dashboard.md`
  - Implementation evidence and verification commands.

## Implementation Decisions

- `/workspace` is now the product dashboard. `WorkspaceOverviewSurface` remains
  donor code but is no longer the route surface.
- Dashboard data is loaded server-side from `ActivityReadModel`, not from the
  active chat surface state.
- Recent outputs intentionally filter completed activity to jobs, media
  workflows, and operations; referral milestones remain in the business-loop
  block.
- The dashboard links to `/activity?bucket=needs_attention`; this phase adds a
  minimal authenticated ledger route so the link works immediately. 01c3d still
  owns the richer activity workspace, durable inbox, receipt actions, and bell
  replacement.
- Diagnostics stay out of the regular user dashboard. The system health block
  is summary-only and role-safe.
- The dashboard keeps a one-column reading order on desktop. Later phases may
  add richer management surfaces, but the regular user's first workspace stays
  mobile-first.

## Positive Tests

- Authenticated mobile user sees dashboard blocks in a single column.
- Failed job appears in Needs attention with a clear action.
- Running media workflow appears in Current work.
- Completed media workflow output appears in Recent outputs.
- Referral milestone appears in Business loop when referral data exists.
- Empty new-user dashboard explains the next useful step without pretending
  work exists.

## Negative Tests

- Anonymous users are redirected from `/workspace`.
- Admin-only system diagnostics do not appear for regular authenticated users.
- Dismissed activity does not appear in Needs attention.
- Raw runtime log lines are not shown on the dashboard.

## Edge Tests

- User has jobs but no active conversation.
- User has workflows with missing linked job snapshots.
- User has many completed jobs and only one attention item.
- Activity API returns empty due to source read failure.
- Mobile safe-area with floating chat launcher present.

## Cleanup

- Retire dashboard copy that says "No active workspace snapshot yet" when
  durable activity exists.
- Remove duplicated job summary fragments once dashboard blocks own the
  summary.

## Exit Criteria

- [x] `/workspace` is the user's primary dashboard.
- [x] It is useful without opening chat first.
- [x] It is mobile-first and grounded in durable activity.
- [x] Targeted dashboard/activity/shell tests, ESLint, and TypeScript checks
  pass.
