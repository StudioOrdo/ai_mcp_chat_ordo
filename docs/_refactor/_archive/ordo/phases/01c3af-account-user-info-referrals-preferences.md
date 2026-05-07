# Phase 01c3af: Account User Info, Referrals, And Preferences

Status: Implemented

Supersession note:

- `01c3ap-account-menu-password-and-affiliate-route-alignment.md` corrects this
  phase's account/referral IA. Account now owns User info, Change password, and
  Preferences. Referral/QR access belongs to `/referrals`, not `/profile`.

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3ae-shared-governance-section-framework.md`
- `01c3ad-chat-first-shell-grid-and-mobile-menu.md`
- `docs/_refactor/planning/05-account-profile-referrals-preferences.md`

Blocks:

- `01c3ao-canonical-ux-regression-closeout.md`

## Goal

Convert `/profile` from a profile island into the canonical Account surface:

- second column sections: User info, My Referrals, Preferences,
- main pane shows the selected account section,
- mobile selection navigates to detail with a back-to-list control,
- account menu links map cleanly into this surface.

## Current Code Grounding

- `src/app/profile/page.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`
- `src/lib/profile/profile-service.ts`
- `src/components/AccountMenu.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/referrals/**`
- referral QR/link routes and API handlers

## Implementation Notes

- `/profile` now renders through `GovernanceSectionFrame` so Account follows
  the same shared selector/detail model as the other governance sections.
- The second column is the canonical Account selector:
  - User info,
  - My Referrals,
  - Preferences.
- Account section selection uses query routes:
  - `/profile`
  - `/profile?section=referrals`
  - `/profile?section=preferences`
- Mobile starts on the account selector for `/profile`, opens detail when a
  section is selected, and exposes a shared back-to-account-sections control.
- Referral code, referral link, and QR image come from the existing
  `UserProfileViewModel` loaded by `src/lib/profile/profile-service.ts`.
- Missing referral access renders a quiet chat-first next action instead of a
  broken or admin-only state.
- Preferences remains intentionally small: theme lives in the account menu
  header, and the page holds a clear in-development preferences surface plus
  existing browser notification controls.
- The shared selector row now hides decorative icon labels from accessible link
  names so the second column stays readable to assistive technology.
- `/api/profile` tests now assert that client-supplied user ids are ignored and
  updates are applied only to the signed-in account.

## Required Work

1. Rename visible route framing from Profile to Account/User info where
   appropriate.
2. Use the shared governance section layout.
3. Add second-column account sections:
   - User info,
   - My Referrals,
   - Preferences.
4. Collapse profile/preferences duplicate destinations.
5. Keep Preferences as a clear in-development placeholder if not fully built.
6. Render referral code/QR/link from existing referral code sources.
7. Add mobile drill-in and back control for account sections.
8. Preserve role/access boundaries and avoid showing admin/system controls in
   account UI.

## Tests

Positive:

- account menu opens Account/User info.
- My Referrals opens the referral section with QR/link.
- Preferences opens a placeholder or settings section.
- mobile selection opens detail and back returns to the second-column list.

Negative:

- account menu does not expose My media, My conversations, My offers,
  My content, or System.
- non-owner cannot edit another user's account section.

Edge:

- missing referral code shows a quiet create/share next action.
- preferences unavailable state does not look like broken UI.

## Non-Goals

- Do not implement a full preferences system.
- Do not build referral analytics here; People owns relationship performance.
- Do not move Studio media into Account.

## Closeout Evidence Required

- Account route screenshots or browser evidence.
- Mobile back behavior evidence.
- Account menu route mapping.
- Static scan for stale Profile/My Media labels in owner account UI.

## Closeout Evidence

- Evidence file:
  `docs/_refactor/ordo/evidence/phase-01c3af-account-user-info-referrals-preferences.md`
