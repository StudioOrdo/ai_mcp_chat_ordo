# Phase 01c4: Admin Global And Factory Navigation Rail

Status: Planned

Parent phase:

- `01c-public-navigation-footer-and-mobile-system.md`

Depends on:

- `01c3z-relationship-settings-and-people-shell-closeout.md`

## Goal

Give staff/admin users a clear operating rail for global and factory work.

This phase makes admin navigation feel like part of Ordo's operating system
rather than a long list inside a drawer.

Do not start 01c4 until the 01c3 extension series is complete through
`01c3z`. Admin/global navigation should build on the settled user-shell model
rather than inherit the temporary jobs/notification split, feature-specific
page sprawl, or unfinished People shell.

01c3z closeout should complete the regular-user owner shell and People baseline.
01c4 should then build admin/global/factory navigation on top of:

- Today -> `/workspace`,
- Studio -> `/studio`,
- People -> `/business`,
- Offers -> `/offers`,
- About -> owner business/about governance route,
- Media Ops -> `/operations/media` for staff/admin.

Jobs, Activity, My Media, and Referrals remain donor/diagnostic routes and
should not be re-promoted as regular-user primary navigation.

## Product Rule

Admin users need two concepts:

- Factory: work production and operational pipelines.
- Global: instance administration and system control.

The current `admin-navigation.ts` groups are useful donor code, but the shell
needs to expose them as first-class navigation.

## Current Code To Research

- `src/lib/admin/admin-navigation.ts`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/users/**`
- `src/app/admin/conversations/**`
- `src/app/admin/leads/**`
- `src/app/admin/affiliates/**`
- `src/app/admin/prompts/**`
- `src/app/admin/system/**`
- `src/app/admin/system/backups/**`
- `src/app/operations/**`
- `tests/admin-*`
- `tests/shell-acceptance.test.tsx`

## Required Work

- Define admin rail groups:
  - Overview,
  - Factory,
  - Global/Admin,
  - Platform.
- Rename public-facing "Journal" language toward content/feed operations where
  safe, while preserving donor implementation names until the feed phase
  replaces the model.
- Add backup/system destinations where already implemented.
- Preserve current workspace-context links for leads, conversations,
  affiliates, and journal/content.
- Ensure admin rail is hidden from anonymous and non-admin users.
- Ensure staff routes are visible to staff where policy allows.

## Positive Tests

- Admin desktop shell shows global/admin route groups.
- Admin mobile shell exposes the same groups.
- Staff sees only staff-allowed operations.
- Current admin workspace context still resolves.

## Negative Tests

- Anonymous users do not see admin/global groups.
- Authenticated non-admin users do not see admin/global groups.
- Admin routes are not mixed into public footer/nav.
- Old drawer is not the only admin discovery path.

## Edge Tests

- Admin on `/admin/conversations?view=themes`.
- Admin on `/admin/affiliates?view=exceptions`.
- Admin on `/admin/system/backups`.
- Staff on `/operations/media`.

## Cleanup

- Consolidate duplicate admin navigation labels.
- Remove stale admin drawer copy that says navigation is from "the same mobile
  surface" if that is no longer true.

## Exit Criteria

- Staff/admin users have a visible operating rail.
- Factory/global distinctions are understandable.
- Admin navigation remains role-safe and test-covered.
