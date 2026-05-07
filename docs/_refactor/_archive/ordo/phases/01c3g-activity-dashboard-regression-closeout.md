# Phase 01c3g: Activity Dashboard Regression Closeout

Status: Planned

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3f-top-rail-brand-balance-and-mobile-work-controls.md`

## Goal

Close the 01c3x activity/dashboard/navigation refactor with evidence, stale
code cleanup, and regression coverage before the object-centered workspace UX
series begins.

This phase closes the event-first cleanup. It does not lock the final product
surface. The next phases (`01c3h` through `01c3m`) condense the workspace into
object cards, progressive disclosure, provenance lenses, funnel lenses, and a
CEO decision queue.

## Product Rule

The signed-in shell should now have a stable mental model:

- Dashboard: what matters now.
- Activity: what happened.
- Media: what was created.
- Referrals: business loop.
- Profile: user/account context.
- Admin/Operations: role-gated advanced control.

Jobs remain durable execution records, but they should not dominate the regular
user product language.

This is an intermediate model. The next model is object-centered:

- Dashboard: what needs the CEO's attention now.
- Studio: produced and in-progress work objects.
- Business: people, offers, QR links, referrals, and funnel outcomes.
- Activity: durable audit trail and provenance, mostly reached through object
  detail views.
- Admin/Operations: role-gated diagnostics and global control.

## Current Code To Recheck

- `src/components/SiteNav.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/NotificationFeed.tsx` or replacement `AttentionInbox`
- `src/frameworks/ui/jobs-rail/**`
- `src/components/jobs/**`
- `src/app/workspace/page.tsx`
- `src/app/activity/page.tsx`
- `src/app/jobs/page.tsx`
- `src/app/api/activity/**`
- `src/app/api/jobs/**`
- `src/app/api/notifications/**`
- `src/lib/activity/**`
- `src/lib/jobs/**`
- `src/lib/media/workflows/**`
- `src/lib/referrals/**`
- `src/app/styles/shell.css`
- `src/app/styles/jobs.css`
- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/shell-visual-system.test.tsx`
- `tests/homepage-shell-layout.test.tsx`
- relevant Playwright mobile shell tests.

## Required Work

- Run stale scans for:
  - `DEFAULT_NOTIFICATIONS`,
  - hardcoded platform update notifications,
  - `Use the right side for full history`,
  - two-column jobs-grid assumptions,
  - jobs/notification top-nav placement,
  - duplicate shell brand marks,
  - display/Fraunces shell wordmark usage.
- Update docs for:
  - activity taxonomy,
  - dashboard behavior,
  - activity page behavior,
  - inbox/bell behavior,
  - jobs route behavior.
- Update parent phase `01c3` closeout with new evidence.
- Update `01c4` only after the user dashboard/work model is stable.
- Capture screenshots or Playwright assertions for:
  - authenticated desktop dashboard,
  - authenticated mobile dashboard,
  - activity ledger,
  - attention inbox empty and non-empty,
  - single-column jobs/work index,
  - top rail brand balance.

## Positive Tests

- Dashboard renders for authenticated users.
- Activity page renders and filters.
- Attention inbox uses durable receipt state.
- Jobs/workflows render with consistent cards.
- Linked media jobs are navigable.
- Top rail has one brand mark and balanced links.
- Mobile work control is explicit.

## Negative Tests

- Anonymous users cannot see activity/dashboard private data.
- Admin-only system events do not leak to regular users.
- Runtime logs are not regular user activity.
- Browser push preference does not control in-app activity visibility.
- Feed/public nav state is not regressed.

## Edge Tests

- Empty new-user account.
- User with only completed activity.
- User with failed job and blocked workflow.
- User with many activity items.
- EventSource unavailable.
- Feed hidden and signed-in work rail visible.
- Very narrow mobile viewport.

## Cleanup

- Remove obsolete notification placeholder tests.
- Delete dead two-column jobs CSS if no longer used.
- Keep diagnostic/admin jobs table code separate from user work index.
- Keep reusable job timeline/action code if still used by detail routes.

## Exit Criteria

- The event-first activity/dashboard subset is fully closed out.
- Dashboard, Activity, jobs/work index, attention inbox, and top rail brand
  are aligned.
- 01c3h object-centered information architecture can start without inheriting
  the old jobs/notifications split.
