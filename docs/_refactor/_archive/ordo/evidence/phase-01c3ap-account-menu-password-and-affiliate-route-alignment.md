# Phase 01c3ap Evidence: Account Menu, Password, And Affiliate Route Alignment

Date: 2026-05-06

Status: Implemented

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- Account owns identity, password, preferences, theme, and session controls.
- Referral, QR, and affiliate work belongs to the owner affiliate dashboard at
  `/referrals`, referral detail at `/business/referrals/[referralCode]`, and
  admin/global affiliate governance at `/admin/affiliates`.
- Regular owner UI must not expose raw jobs, logs, providers, diagnostics, or
  password hashes.

## Code Files Changed

- `src/lib/shell/shell-navigation.ts`
- `src/components/AccountMenu.tsx`
- `package.json`
- `src/app/profile/page.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`
- `src/adapters/UserDataMapper.ts`
- `src/core/use-cases/ChangeUserPasswordInteractor.ts`
- `src/lib/profile/profile-password-service.ts`
- `src/app/api/profile/password/route.ts`
- `src/lib/shell/shell-navigation.test.ts`
- `src/components/AccountMenu.test.tsx`
- `src/components/profile/ProfileSettingsPanel.test.tsx`
- `src/app/profile/page.test.tsx`
- `src/app/api/profile/route.test.ts`
- `src/app/referrals/page.test.tsx`
- `src/app/api/profile/password/route.test.ts`
- `src/core/use-cases/ChangeUserPasswordInteractor.test.ts`
- `src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts`
- `tests/admin-shell-and-concierge.test.tsx`
- `tests/shell-navigation-model.test.ts`
- `tests/shell-visual-system.test.tsx`
- `tests/browser-ui/business-workspace.spec.ts`
- `tests/browser-ui/mobile-workspace-admin-lists.spec.ts`
- `tests/referral-tracking.test.ts`

## Documentation Files Changed

- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ux/01-language-and-vocabulary.md`
- `docs/_business/ux/06-open-questions-and-next-research.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_refactor/ordo/phases/01c3ad-chat-first-shell-grid-and-mobile-menu.md`
- `docs/_refactor/ordo/phases/01c3af-account-user-info-referrals-preferences.md`
- `docs/_refactor/ordo/phases/01c3ao-canonical-ux-regression-closeout.md`
- `docs/_refactor/ordo/phases/01c3ap-account-menu-password-and-affiliate-route-alignment.md`
- `docs/_refactor/ordo/evidence/phase-01c3ap-account-menu-password-and-affiliate-route-alignment.md`

## Account Menu Before/After

Before this correction, the account menu exposed residual account items:

1. User info
2. My Referrals
3. Preferences

After this correction, the signed-in account menu resolves from the shell route
registry and exposes:

1. My Account -> `/profile`
2. Affiliate Dashboard -> `/referrals`
3. Theme toggle in the menu header
4. Sign out

Change Password remains available from the `/profile` second-column account
rail only. The account menu no longer exposes duplicate My Account links,
Change Password, My Referrals, Preferences, QR, System, My media,
My conversations, My offers, or My content. Affiliate Dashboard is the single
account-menu route to the user's affiliate page; QR and referral management stay
on `/referrals`, not `/profile`.

## Account Page Evidence

`/profile` now has a second-column account selector with:

1. User info
2. Change password
3. Preferences

The Account page no longer renders referral code, QR image, referral link,
affiliate performance, or referral funnel language.

Stale links to `/profile?section=referrals` converge to `/referrals` through a
server redirect in `src/app/profile/page.tsx`.

## Password Change Evidence

The password-change flow is:

1. `/profile?section=password` renders current password, new password, and
   confirm new password fields.
2. The client calls `PATCH /api/profile/password`.
3. The route authenticates with the signed-in session user.
4. `profile-password-service` invokes `ChangeUserPasswordInteractor`.
5. The interactor loads the password credential for the signed-in user, verifies
   the current password with `BcryptHasher`, hashes the new password, and writes
   through `UserDataMapper.updatePasswordHash`.

Validation covers:

- anonymous requests,
- missing current password,
- new password length below 8 or above 72,
- confirmation mismatch,
- unchanged password,
- wrong current password,
- accounts without a password hash.

Responses contain only status/message payloads. No touched route, component, or
test snapshots password hashes.

## Referral Route Evidence

The canonical referral routes remain:

```text
/referrals                         owner affiliate dashboard
/business/referrals/[referralCode] referral evidence detail
/admin/affiliates                  admin/global affiliate dashboard
```

The existing chat tools keep `manage_route: "/referrals"` as the owner
affiliate route.

## QA Pass 1

Commands run:

```bash
npx vitest run src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts src/components/profile/ProfileSettingsPanel.test.tsx src/app/profile/page.test.tsx src/app/api/profile/route.test.ts src/app/referrals/page.test.tsx src/core/use-cases/ChangeUserPasswordInteractor.test.ts src/app/api/profile/password/route.test.ts
npm run typecheck
npx vitest run tests/shell-navigation-model.test.ts tests/shell-visual-system.test.tsx tests/admin-shell-and-concierge.test.tsx src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
npm run lint -- src/components/AccountMenu.tsx src/lib/shell/shell-navigation.ts src/components/profile/ProfileSettingsPanel.tsx src/app/profile/page.tsx src/app/api/profile/route.ts src/app/api/profile/password/route.ts src/lib/profile/profile-password-service.ts src/core/use-cases/ChangeUserPasswordInteractor.ts src/core/use-cases/ChangeUserPasswordInteractor.test.ts src/app/api/profile/password/route.test.ts src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts src/components/profile/ProfileSettingsPanel.test.tsx src/app/profile/page.test.tsx src/app/api/profile/route.test.ts src/app/referrals/page.test.tsx tests/shell-navigation-model.test.ts tests/shell-visual-system.test.tsx tests/admin-shell-and-concierge.test.tsx src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
npm run lint:css
rg -n "My Referrals|my-qr-referral|profile\\?section=referrals|Referral code|QR code" src/components/AccountMenu.tsx src/components/profile src/lib/shell src/app/profile tests
rg -n "password_hash|passwordHash" src/app/api/profile src/components/profile tests
rg -n "System" src/components/AccountMenu.tsx
```

Results:

- Required phase tests passed: 8 files, 49 tests.
- Typecheck passed.
- Focused related shell/kernel tests passed: 4 files, 28 tests.
- Focused lint passed.
- CSS lint passed.
- Account/profile stale referral scan returned no matches.
- Account/profile/test password hash scan returned no matches.
- Account menu System scan returned no matches.

Issues found and fixed:

- The no-password-hash interactor test initially used a nullish-coalescing
  harness default that converted `null` into a fake stored hash. The harness now
  uses `hasOwnProperty` so the edge case is tested correctly.
- Account menu active state initially used only `usePathname()`, so query
  routes could mark the wrong account item active. A later user QA correction
  removed Change Password from the upper-right account menu entirely; the
  password section is now only in the `/profile` second-column rail.
- User QA found the account menu had no direct affiliate-page link and needed a
  single, non-duplicated My Account affordance. Added `Affiliate Dashboard`
  -> `/referrals` via the shell registry and asserted exactly one My Account
  link in account-menu tests.

## QA Pass 2

Commands run:

```bash
npx vitest run src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts src/components/profile/ProfileSettingsPanel.test.tsx src/app/profile/page.test.tsx src/app/api/profile/route.test.ts src/app/referrals/page.test.tsx src/core/use-cases/ChangeUserPasswordInteractor.test.ts src/app/api/profile/password/route.test.ts
npx vitest run tests/shell-navigation-model.test.ts tests/shell-visual-system.test.tsx tests/admin-shell-and-concierge.test.tsx src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts src/core/use-cases/tools/user-profile.tool.test.ts src/core/use-cases/tools/affiliate-analytics.tool.test.ts
npm run typecheck
npm run lint -- src/components/AccountMenu.tsx src/lib/shell/shell-navigation.ts src/components/profile/ProfileSettingsPanel.tsx src/app/profile/page.tsx src/app/api/profile/route.ts src/app/api/profile/password/route.ts src/lib/profile/profile-password-service.ts src/core/use-cases/ChangeUserPasswordInteractor.ts src/core/use-cases/ChangeUserPasswordInteractor.test.ts src/app/api/profile/password/route.test.ts src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts src/components/profile/ProfileSettingsPanel.test.tsx src/app/profile/page.test.tsx src/app/api/profile/route.test.ts src/app/referrals/page.test.tsx tests/shell-navigation-model.test.ts tests/shell-visual-system.test.tsx tests/admin-shell-and-concierge.test.tsx src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts src/core/use-cases/tools/user-profile.tool.test.ts src/core/use-cases/tools/affiliate-analytics.tool.test.ts tests/browser-ui/business-workspace.spec.ts tests/browser-ui/mobile-workspace-admin-lists.spec.ts tests/referral-tracking.test.ts
npm run lint:css
rg -n "My Referrals|my-qr-referral|profile\\?section=referrals|Referral code|QR code" src/components/AccountMenu.tsx src/components/profile src/lib/shell src/app/profile tests
rg -n "password_hash|passwordHash" src/app/api/profile src/components/profile tests
rg -n "raw job|raw log|provider|diagnostic|password_hash|passwordHash|My Referrals|my-qr-referral|Referral code|QR code|My media|My conversations|My offers|My content" src/components/AccountMenu.tsx src/components/profile src/app/profile src/app/api/profile/password
rg -n "My media|My conversations|My offers|My content|System" src/components/AccountMenu.tsx tests src/lib/shell
rg -n "Affiliate Dashboard|data-account-menu-icon=\"referrals\"|getAllByRole\\(\"link\", \\{ name: \"My Account\"" src/components/AccountMenu.tsx src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.ts src/lib/shell/shell-navigation.test.ts tests/shell-visual-system.test.tsx tests/browser-ui/business-workspace.spec.ts
```

Results:

- Required phase tests passed: 8 files, 50 tests.
- Focused related shell/kernel/referral tool tests passed: 6 files, 40 tests.
- Typecheck passed.
- Focused lint passed.
- CSS lint passed.
- Stale account/profile referral scan returned no matches.
- Account/profile/test password hash scan returned no matches.
- Owner account/profile drift scan returned no matches.
- The broad phase `System` scan matched legitimate admin/system source and
  test references, not `AccountMenu.tsx`; the narrowed AccountMenu scan
  returned no matches.
- Affiliate Dashboard and single-My-Account assertions are present in source
  and tests.

Issues found and fixed:

- User QA found there was no direct affiliate-page link in the account menu and
  called out duplicate My Account affordance risk. Fixed by adding a single
  `Affiliate Dashboard` account-menu route to `/referrals` via the shell route
  registry and adding exact-one My Account assertions.
- User QA then found Change Password was duplicated between the account menu and
  the Account second-column rail. Fixed by removing `change-password` from
  `ACCOUNT_MENU_ROUTE_IDS` and asserting the account menu does not render it.
- QA pass 2 found an unused `change-password` icon branch still present inside
  `AccountMenu.tsx`. Removed the stale branch so the account menu source has no
  Change Password rendering path.
- Browser QA for `tests/browser-ui/business-workspace.spec.ts` now verifies the
  account menu has one My Account link, one Affiliate Dashboard link, no Change
  Password link, and the `/profile` second-column rail still exposes Change
  password.
- `npm run lint:css` was missing after the broader package-script
  reorganization in the dirty worktree. Restored the script and split
  `npm run lint -- <files>` back to ESLint-only so the phase-required lint
  command no longer passes TypeScript files to stylelint.
- A transient typecheck run reported an unrelated stale `OUTPUT_ZIP_FILE`
  symbol in `scripts/llm-export.ts`; immediate inspection showed the symbol had
  already been removed in the current file, and the rerun passed.

## Remaining Risks

- This phase does not add password reset, email verification, magic links, or
  OAuth account linking.
- Preferences remains an in-development account section.
- `/referrals` is preserved as the affiliate dashboard but is not redesigned in
  this phase.
