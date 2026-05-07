# Spec 01: Chat-First Shell And Mobile Menu

Status: Draft spec

Evidence date: 2026-05-05

## Problem

The current shell is close, but it still reads like a site with several
workspaces. Ordo should read as a chat-operated business system with governance
surfaces.

Specific issues:

- The owner rail starts with Today instead of Ordo Chat.
- Mobile navigation is not yet a clear hamburger-driven main menu.
- The account menu still includes `My media`, which belongs in Studio.
- The account menu mixes personal account concerns with business/system
  surfaces.
- Admin rail labels include `Factory`, which no longer matches the product
  vocabulary.
- The left rail, top rail, logo, and second column need one shared grid so they
  align cleanly.

## Current Code Anchors

- `src/components/SiteNav.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/AccountMenu.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/ShellNavDrawer.tsx`
- `src/components/shell/ShellBrand.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/app/styles/shell.css`

## Target Navigation Model

### Public Top Navigation

Desktop and mobile public top nav:

- Offers
- About
- Feed only when public feed content exists

No authenticated work surfaces appear in the public top nav.

### Owner Rail

Desktop left rail:

1. Ordo Chat
2. Today
3. Studio
4. People
5. Offers
6. About

Admin-only group:

1. Admin
2. Jobs
3. System

Rules:

- `Ordo Chat` is the first item because chat is the operating interface.
- `Today`, `Studio`, `People`, `Offers`, and `About` are governance surfaces.
- `Jobs` replaces user-visible `Factory`.
- Admin-only items remain role-gated.
- Counts belong as small rail badges and brief cards, not as competing nav.

### Mobile Menu

Mobile top bar:

- brand mark and Studio Ordo label,
- hamburger button for main navigation,
- account avatar/menu.

Mobile hamburger menu:

- Ordo Chat
- Today
- Studio
- People
- Offers
- About
- Admin-only section when authorized:
  - Admin
  - Jobs
  - System

Rules:

- Mobile should not require a persistent left rail.
- The hamburger menu is for business/system navigation.
- The avatar menu is for account identity and account-owned settings.

### Account Menu

Account menu should contain:

- User info
- My Referrals
- Preferences
- Sign out

Optional:

- Theme toggle in the menu header.

Rules:

- Remove My media.
- Do not show My conversations, My offers, or My content unless a later phase
  proves they are account-owned rather than business objects.
- System belongs in the admin rail, not the account menu.
- Preferences and profile share the same account route.

## Layout Contract

Desktop shell grid:

- top rail spans the viewport,
- left rail begins under the top rail,
- second column aligns with the content grid,
- logo sits cleanly in the top-left shell corner,
- no decorative shadow at the seam between top rail and left rail,
- grid measurements are shared across pages.

The brand region may span the left rail and second-column width visually, but
interactive navigation remains cleanly separated.

## Accessibility Requirements

- Hamburger button has `aria-label`.
- Hamburger menu traps focus when rendered as modal/sheet on mobile.
- Account menu remains keyboard accessible.
- Rail links have visible focus states.
- Icon-only controls have labels.
- The currently selected route uses `aria-current="page"`.

## Acceptance Criteria

- Ordo Chat appears first in authenticated main navigation.
- Today remains the first governance surface after Chat.
- `Factory` is not visible in the rail; user-facing label is `Jobs`.
- `My media` is absent from the account menu.
- Account menu shows account/profile, My Referrals, Preferences, and Sign out.
- System is visible only in admin/system-authorized navigation.
- Mobile uses hamburger navigation for the main rail and avatar for account.
- The top-left logo/rail/second-column seams align without shadow effects.

## Tests

Positive:

- authenticated owner sees Ordo Chat, Today, Studio, People, Offers, About.
- admin sees Admin, Jobs, System.
- public top nav shows Offers, About, and conditional Feed.
- account menu shows User info, My Referrals, Preferences, Sign out.

Negative:

- anonymous users do not see owner rail/admin rail.
- non-admin users do not see System/Admin/Jobs admin links.
- account menu does not show My media.
- public top nav does not show Jobs, Activity, Library, Referrals, Operations,
  Blog, Journal, or System.

Edge:

- mobile hamburger opens/closes by keyboard.
- route active state survives query params.
- rail badges do not shift layout.

