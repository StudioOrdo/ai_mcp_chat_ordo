# Phase 01c3ad: Chat-First Shell Grid And Mobile Menu

Status: Implemented

Supersession note:

- `01c3ap-account-menu-password-and-affiliate-route-alignment.md` corrects the
  account menu route set after this shell phase. The menu now contains My
  Account, Change Password, the header theme toggle, and Sign out only.

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3ac-canonical-ux-governance-baseline.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`

Blocks:

- `01c3ae-shared-governance-section-framework.md`

## Goal

Make the global shell match the canonical product contract:

- Ordo Chat first in authenticated navigation,
- clean desktop left rail and top rail geometry,
- mobile hamburger main menu,
- upper-right account menu for account-owned settings only,
- admin-only Admin, Jobs, and System navigation,
- no right drawer or top-right job/bell clutter for core navigation.

## Product Rule

Chat is the operating interface. UI surfaces are the governance layer.

The shell must make that visible before any section-specific work continues.

## Current Code Grounding

- `src/components/SiteNav.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/AccountMenu.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/ShellNavDrawer.tsx`
- `src/components/shell/ShellBrand.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/public-shell-state.ts`
- `src/app/styles/shell.css`
- `src/components/AppShell.tsx`

## Required Work

1. Add Ordo Chat as the first authenticated owner navigation item.
2. Preserve Today, Studio, People, Offers, and About after Ordo Chat.
3. Rename visible admin `Factory` navigation to `Jobs` while preserving internal
   diagnostics and routes where needed.
4. Keep Admin, Jobs, and System role-gated.
5. Keep public nav to Offers, About, and conditional Feed.
6. Remove My media, My conversations, My offers, My content, and System from
   account menu.
7. Account menu contains:
   - User info,
   - My Referrals,
   - Preferences,
   - Sign out,
   - compact theme toggle in the header.
8. Replace mobile bottom-nav assumptions with hamburger main navigation.
9. Align top rail, left rail, brand, and global second-column geometry through
   shared shell tokens.
10. Remove right-drawer usage for core navigation.

## Tests

Positive:

- owner sees Ordo Chat first, then Today, Studio, People, Offers, About.
- admin sees Admin, Jobs, and System.
- account menu shows User info, My Referrals, Preferences, Sign out, and theme
  header toggle.
- mobile hamburger opens/closes and contains owner/admin routes by permission.

Negative:

- public nav does not show Jobs, Activity, Library, Referrals, Operations,
  Blog, Journal, Admin, or System.
- account menu does not show My media, My conversations, My offers, My content,
  or System.
- non-admin users do not see admin routes.

Edge:

- active state survives query params.
- badges do not shift rail layout.
- hamburger and account menu are keyboard accessible.

Suggested tests:

```bash
npm run test -- src/components/AccountMenu.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/lib/shell/shell-navigation.test.ts
```

## Non-Goals

- Do not implement section briefs.
- Do not migrate Today/Studio/System internals yet.
- Do not delete donor routes.

## Closeout Evidence Required

- Shell route contract.
- Mobile menu screenshots or browser evidence.
- Account menu route evidence.
- Static scan results for stale shell labels.

## Implementation Evidence

Evidence file:

- `docs/_refactor/ordo/evidence/phase-01c3ad-chat-first-shell-grid-and-mobile-menu.md`

Implemented changes:

- Added `Ordo Chat` as the first authenticated owner route in
  `src/lib/shell/shell-navigation.ts`.
- Kept authenticated owner rail order as `Ordo Chat`, `Today`, `Studio`,
  `People`, `Offers`, `About`.
- Replaced visible admin rail `Factory` with role-gated `Jobs`; diagnostic
  media/factory route definitions remain donor/internal.
- Reduced the authenticated account menu to `User info`, `My Referrals`,
  `Preferences`, header theme toggle, and `Sign out`.
- Added `src/components/shell/ShellMobileMainMenu.tsx` and mounted it from
  `src/components/SiteNav.tsx` for authenticated mobile main navigation.
- Hid the authenticated desktop rail on mobile in `src/app/styles/shell.css`
  instead of using the old bottom-dock assumption.
- Aligned shell grid and authenticated rail/second-column geometry through
  shared shell tokens in `src/app/styles/shell.css`.

QA status:

- QA pass 1 complete.
- QA pass 2 complete.
