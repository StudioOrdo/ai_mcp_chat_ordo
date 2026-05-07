# Phase 01c3av Evidence: People, Referrals, And Affiliate Evidence Alignment

Date: 2026-05-07

Status: Implemented

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- People is relationship intelligence, not an affiliate dashboard.
- Referral/QR evidence may appear in People as source and trail evidence.
- Referral link, QR assets, and owner affiliate controls belong to `/referrals`.
- `/business/referrals/[referralCode]` remains the referral evidence detail
  route.
- `/admin/affiliates` remains the admin/global affiliate dashboard.
- `/profile` remains identity, password, and preferences only.
- Account menu may link to Affiliate Dashboard once; it must not contain QR,
  My Referrals, or duplicate referral entries.

## Code Files Changed

- `src/components/referrals/ReferralsWorkspace.tsx`
- `src/lib/business/people-read-model.test.ts`
- `src/lib/business/load-business-workspace.test.ts`
- `src/components/business/BusinessWorkspace.test.tsx`
- `src/lib/referrals/load-referrals-workspace.test.ts`
- `src/components/referrals/ReferralsWorkspace.test.tsx`
- `src/app/referrals/page.test.tsx`
- `src/components/AccountMenu.test.tsx`
- `src/components/profile/ProfileSettingsPanel.test.tsx`
- `src/app/business/referrals/[referralCode]/page.test.tsx`
- `src/app/admin/affiliates/page.test.tsx`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3av-people-referrals-and-affiliate-evidence-alignment.md`
- `docs/_refactor/ordo/evidence/phase-01c3av-people-referrals-and-affiliate-evidence-alignment.md`

## Implementation Evidence

People read-model tests now prove QR/referral source trail events carry
`/business/referrals/[referralCode]` evidence links. Business workspace tests
prove the selected person facts and Relationship Trail can show `QR code ·
Referral link`, `QR / referral source`, and `Open referral` without rendering a
referral dashboard inside People.

Business workspace loader tests now prove the People selector can search by
referral source label and referral code, keeping referral evidence findable
without turning People into the affiliate dashboard.

`/referrals` now presents itself as the owner Affiliate Dashboard. Enabled
accounts render the canonical referral link, QR asset, share tools, and
milestone activity. Disabled accounts render an explicit no-access state without
QR or referral controls.

Profile tests now prove `/profile` does not render Affiliate Dashboard, QR,
referral code, referral link, My Referrals, or raw referral asset URLs even when
the underlying profile read model includes those fields.

Account menu tests now prove the menu has exactly one My Account entry and
exactly one Affiliate Dashboard entry. Change Password remains in the account
second column, not the top-level account menu.

Referral evidence detail tests now prove anonymous users redirect to `/login`
before referral detail loading. Admin affiliate tests prove `/admin/affiliates`
delegates to the admin gate before loading global affiliate data.

## QA Pass 1

Commands run:

```bash
npx vitest run src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/referrals/load-referrals-workspace.test.ts src/components/referrals/ReferralsWorkspace.test.tsx src/components/AccountMenu.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/app/profile/page.test.tsx src/app/referrals/page.test.tsx 'src/app/business/referrals/[referralCode]/page.test.tsx' src/app/admin/affiliates/page.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/lib/business/people-read-model.ts src/lib/business/load-business-workspace.ts src/components/business/BusinessWorkspace.tsx src/lib/referrals/load-referrals-workspace.ts src/components/referrals/ReferralsWorkspace.tsx src/components/AccountMenu.tsx src/components/profile/ProfileSettingsPanel.tsx src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/referrals/load-referrals-workspace.test.ts src/components/referrals/ReferralsWorkspace.test.tsx src/components/AccountMenu.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/app/referrals/page.test.tsx 'src/app/business/referrals/[referralCode]/page.test.tsx' src/app/admin/affiliates/page.test.tsx
```

Results:

- Focused tests passed after fix: 11 files, 58 tests.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.

Issues found and fixed:

- `ReferralsWorkspace` copy/download test passed but emitted a React `act`
  warning because the async copied notice was not awaited. The test now waits
  for `Referral link copied.` before asserting the QR download path.

## Visual QA

The local app was reachable, but `/business`, `/referrals`, and `/profile`
returned `307 Temporary Redirect` to `/install` in this shell context. No
authenticated browser screenshot could be captured here. Closeout uses DOM,
route, unit, lint, and static evidence.

## QA Pass 2

Commands run:

```bash
npx vitest run src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/referrals/load-referrals-workspace.test.ts src/components/referrals/ReferralsWorkspace.test.tsx src/components/AccountMenu.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/app/profile/page.test.tsx src/app/referrals/page.test.tsx 'src/app/business/referrals/[referralCode]/page.test.tsx' src/app/admin/affiliates/page.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/lib/business/people-read-model.ts src/lib/business/load-business-workspace.ts src/components/business/BusinessWorkspace.tsx src/lib/referrals/load-referrals-workspace.ts src/components/referrals/ReferralsWorkspace.tsx src/components/AccountMenu.tsx src/components/profile/ProfileSettingsPanel.tsx src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/referrals/load-referrals-workspace.test.ts src/components/referrals/ReferralsWorkspace.test.tsx src/components/AccountMenu.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/app/referrals/page.test.tsx 'src/app/business/referrals/[referralCode]/page.test.tsx' src/app/admin/affiliates/page.test.tsx
rg -n "QR|referral|Affiliate|My Referrals|profile\\?section=referrals|admin/affiliates" src/app src/components src/lib/shell
rg -n "QR|referral|Affiliate|My Referrals|profile\\?section=referrals|admin/affiliates" src/components/profile src/app/profile src/components/AccountMenu.tsx src/lib/shell/shell-navigation.ts
rg -n "My Referrals" src/app src/components src/lib/shell
rg -n "Download QR|Referral code|Referral link|Open QR|Affiliate Dashboard|QR" src/components/profile src/app/profile
rg -n "admin/affiliates" src/components/AccountMenu.tsx src/lib/shell/shell-navigation.ts src/components/profile src/app/profile src/components/referrals/ReferralsWorkspace.tsx src/components/business/BusinessWorkspace.tsx
curl -I --max-time 2 http://localhost:3000/business
curl -I --max-time 2 http://localhost:3000/referrals
curl -I --max-time 2 http://localhost:3000/profile
```

Results:

- Focused tests passed again: 11 files, 58 tests.
- Typecheck passed again.
- CSS lint passed again.
- Focused lint passed again.
- Broad static scan returned expected matches in People, Referrals, admin,
  public referral routes, tests, and shell registry.
- Focused profile/account scan showed no QR/referral controls in
  `ProfileSettingsPanel.tsx`; remaining `/profile` matches are the stale
  referral redirect and tests proving absence.
- `My Referrals` appears only in negative tests.
- `admin/affiliates` appears only in the shell registry among the focused
  account/profile/referrals/business surfaces.
- Route reachability checks confirmed the local install redirect blocker.

Issues found and fixed:

- None.
