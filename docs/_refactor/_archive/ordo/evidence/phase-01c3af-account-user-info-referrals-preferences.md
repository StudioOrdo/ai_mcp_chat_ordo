# Phase 01c3af Evidence: Account User Info, Referrals, And Preferences

Date: 2026-05-06

Status: Implemented

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- Account is the user-owned governance surface for identity, referrals, and
  preferences.
- The second column is a selector, not a dashboard.
- Regular owner UI must not expose raw jobs, logs, providers, or admin/system
  controls.

## Code Files Changed

- `src/components/governance/GovernanceSectionFrame.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`
- `src/components/profile/ProfileSettingsPanel.test.tsx`
- `src/app/api/profile/route.test.ts`
- `tests/browser-ui/business-workspace.spec.ts`
- `tests/browser-ui/mobile-workspace-admin-lists.spec.ts`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3af-account-user-info-referrals-preferences.md`
- `docs/_refactor/ordo/evidence/phase-01c3af-account-user-info-referrals-preferences.md`

## What Changed

- `/profile` now uses `GovernanceSectionFrame`.
- Account second-column sections are `User info`, `My Referrals`, and
  `Preferences`.
- `/profile` renders User info by default.
- `/profile?section=referrals` renders the account-level referral code, public
  link, QR image, and full referrals workspace entry when referral access
  exists.
- Missing referral access renders a quiet `Discuss referrals in chat` action.
- `/profile?section=preferences` renders an in-development preferences surface
  and the existing browser notification controls with owner-safe background
  work copy.
- Mobile section selection opens the detail state and the shared back control
  returns to the account selector.
- The shared governance selector icon is decorative for accessibility, so row
  names are not prefixed by icon letters.
- The profile API test suite now verifies that profile updates always use the
  signed-in user id and ignore client-supplied user ids.

## Account Menu Evidence

The account menu mapping remains constrained by the shell navigation resolver:

1. `User info` -> `/profile`
2. `My Referrals` -> `/profile?section=referrals`
3. `Preferences` -> `/profile?section=preferences`

The account menu does not expose `My media`, `My conversations`, `My offers`,
`My content`, or `System`; those remain outside the regular account menu.

## QA Pass 1

Commands run:

```bash
npm run test -- src/components/profile/ProfileSettingsPanel.test.tsx src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts src/app/profile/page.test.tsx src/app/api/profile/route.test.ts src/components/governance/GovernanceSectionFrame.test.tsx
npm run test -- src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/components/AppShell.test.tsx tests/shell-visual-system.test.tsx
npm run typecheck
npm run lint -- src/components/governance/GovernanceSectionFrame.tsx src/components/governance/GovernanceSectionFrame.test.tsx src/components/profile/ProfileSettingsPanel.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/components/AccountMenu.tsx src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.ts src/lib/shell/shell-navigation.test.ts src/app/profile/page.tsx src/app/profile/page.test.tsx src/app/api/profile/route.test.ts tests/browser-ui/business-workspace.spec.ts tests/browser-ui/mobile-workspace-admin-lists.spec.ts
rg -n "My media|My conversations|My offers|My content|System|Deferred job|job alerts|job completion|raw job|raw log|provider|diagnostic|Profile updated|Profile details|Save profile|update your profile|My Media" src/components/AccountMenu.tsx src/components/profile/ProfileSettingsPanel.tsx src/app/profile/page.tsx
npx playwright test tests/browser-ui/business-workspace.spec.ts -g "renders the signed-in People object surface"
npx playwright test tests/browser-ui/mobile-workspace-admin-lists.spec.ts -g "workspace routes keep the first task surface"
```

Results:

- Phase tests passed: 6 files, 43 tests.
- Focused related shell tests passed: 5 files, 35 tests.
- Typecheck passed.
- Focused lint passed.
- Browser People/account-menu regression passed: 1 test.
- Browser mobile account drill-in regression passed: 1 test.

Issues found and fixed:

- The shared governance selector used visible icon letters as part of link
  accessible names. Fixed `ObjectSelectorRow` so selector icons are
  `aria-hidden`.
- Static scan found two remaining visible profile-language strings in Account:
  `Save profile` and `Unable to update your profile right now`. Reworded them
  to account-language.
- Browser QA found stale expectations for removed account-menu entries and the
  old mobile shell navigation shape. Updated those tests to assert the current
  account menu contract, mobile main menu, and Account list/detail back link.

## QA Pass 2

Commands run:

```bash
npm run test -- src/components/profile/ProfileSettingsPanel.test.tsx src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts src/app/profile/page.test.tsx src/app/api/profile/route.test.ts src/components/governance/GovernanceSectionFrame.test.tsx
npm run test -- src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/components/AppShell.test.tsx tests/shell-visual-system.test.tsx
npm run typecheck
npm run lint -- src/components/governance/GovernanceSectionFrame.tsx src/components/governance/GovernanceSectionFrame.test.tsx src/components/profile/ProfileSettingsPanel.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/components/AccountMenu.tsx src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.ts src/lib/shell/shell-navigation.test.ts src/app/profile/page.tsx src/app/profile/page.test.tsx src/app/api/profile/route.test.ts tests/browser-ui/business-workspace.spec.ts tests/browser-ui/mobile-workspace-admin-lists.spec.ts
rg -n "My media|My conversations|My offers|My content|System|Deferred job|job alerts|job completion|raw job|raw log|provider|diagnostic|Profile updated|Profile details|Save profile|update your profile|My Media" src/components/AccountMenu.tsx src/components/profile/ProfileSettingsPanel.tsx src/app/profile/page.tsx
rg -n "My media|My conversations|My offers|My content|System" src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts src/lib/shell/shell-navigation.ts tests/browser-ui/business-workspace.spec.ts tests/browser-ui/mobile-workspace-admin-lists.spec.ts
```

Results:

- Phase tests passed: 6 files, 43 tests.
- Focused related shell tests passed: 5 files, 35 tests.
- Typecheck passed.
- Focused lint passed.
- Owner-facing account UI scan returned no matches.
- Broader donor/test scan matched only hidden donor route metadata and
  negative assertions proving those entries stay out of the account menu.

Issues found and fixed:

- QA pass 2 found no new implementation issues.

## Remaining Risks

- Preferences is intentionally an in-development placeholder. A future
  preferences phase should replace the placeholder with durable user settings.
- The full referrals analytics workspace remains outside Account by design.
