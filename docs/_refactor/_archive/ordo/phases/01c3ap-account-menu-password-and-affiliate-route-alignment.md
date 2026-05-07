# Phase 01c3ap: Account Menu, Password, And Affiliate Route Alignment

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3ad-chat-first-shell-grid-and-mobile-menu.md`
- `01c3ae-shared-governance-section-framework.md`
- `01c3af-account-user-info-referrals-preferences.md`
- `01c3al-cross-section-object-detail-provenance-actions.md`

Blocks:

- Final certification of `01c3ao-canonical-ux-regression-closeout.md`

## Goal

Correct the authenticated account surface after the first canonical shell pass:

- collapse the upper-right account menu to true account/session actions,
- remove referral/QR access from the account menu and account sidebar,
- make `/referrals` the canonical owner affiliate dashboard,
- add a first-class Change Password account section under My Account,
- preserve the chat-first/product-governance split.

The account menu should answer "who am I and how do I manage access?" It should
not become a shortcut drawer for business, affiliate, Studio, or System work.

## Product Rule

Chat is the operating interface. UI surfaces are the governance layer.

Account is identity, access, preferences, and session control. Affiliate and QR
activity are business-development evidence and belong in the referral/affiliate
dashboard, not buried in account settings.

## Current Code Grounding

Refresh these anchors before implementation:

- `src/lib/shell/shell-navigation.ts`
  - `ACCOUNT_MENU_ROUTE_IDS`
  - `SHELL_ROUTES` entries for `profile`, `preferences`, `my-qr-referral`,
    `referrals`, and `admin-affiliates`
- `src/components/AccountMenu.tsx`
  - local `ACCOUNT_ROUTE_IDS`
  - route icons
  - account menu grouping and active state
- `src/app/profile/page.tsx`
  - `ProfileSection` normalization
  - `/profile?section=referrals` behavior
- `src/components/profile/ProfileSettingsPanel.tsx`
  - `PROFILE_ACCOUNT_SECTIONS`
  - referral code/QR section
  - preferences section
  - mobile selector/detail behavior
- `src/app/api/profile/route.ts`
  - existing profile update API
- `src/lib/profile/profile-service.ts`
  - profile view model and update service
- `src/adapters/UserDataMapper.ts`
  - existing `updatePasswordHash`
  - password hash access patterns
- `src/core/use-cases/UserRepository.ts`
  - currently lacks password update API in the repository contract
- `src/core/use-cases/AuthenticateUserInteractor.ts`
  - current password verification behavior
- `src/adapters/BcryptHasher.ts`
  - password hashing/verification implementation
- `src/app/referrals/page.tsx`
- `src/components/referrals/ReferralsWorkspace.tsx`
- `src/lib/referrals/load-referrals-workspace.ts`
- `src/core/use-cases/tools/user-profile.tool.ts`
  - `get_my_referral_qr` already returns `manage_route: "/referrals"`
- `src/core/use-cases/tools/affiliate-analytics.tool.ts`
  - affiliate owner tools already return `manage_route: "/referrals"`
- `src/app/admin/affiliates/page.tsx`
  - admin/global affiliate dashboard
- `src/app/business/referrals/[referralCode]/page.tsx`
  - referral object detail route

## Verified Current State

The current implementation still exposes three residual account menu items:

- `User info`
- `My Referrals`
- `Preferences`

`My Referrals` currently routes to `/profile?section=referrals`, but the real
owner affiliate dashboard already exists at `/referrals`, and chat tools already
point referral/affiliate management there.

There is no first-class password-change route or API. Low-level password hash
update capability exists in `UserDataMapper`, but it is not exposed through a
safe account use case.

## Implementation Closeout

Date: 2026-05-06

This phase is implemented.

What changed:

- `src/lib/shell/shell-navigation.ts` now treats the shell route registry as
  the account-menu authority. `ACCOUNT_MENU_ROUTE_IDS` resolves `profile` and
  `referrals`.
- `profile` is now labeled `My Account` in the account menu and links to
  `/profile`.
- `change-password` remains an internal Account section route at
  `/profile?section=password`, but it is not a top-level account-menu item.
- `referrals` is labeled `Affiliate Dashboard` in the account menu and links to
  `/referrals`.
- `AccountMenu.tsx` renders the registry-provided account routes directly and
  no longer keeps a divergent account route allowlist.
- The account menu no longer renders duplicate My Account links, Change
  Password, My Referrals, Preferences, QR, System, My media, My conversations,
  My offers, or My content.
- `/profile` now exposes second-column sections for User info, Change password,
  and Preferences.
- `/profile?section=referrals` redirects to `/referrals`.
- Referral/QR UI has been removed from the Account page.
- `/referrals`, `/business/referrals/[referralCode]`, and
  `/admin/affiliates` remain the canonical affiliate/referral routes.
- `PATCH /api/profile/password` was added as an authenticated password-change
  endpoint.
- Password mutation now flows through `ChangeUserPasswordInteractor` and
  `profile-password-service`, not raw mutation from a React component.
- `UserDataMapper` now exposes a minimal password credential lookup by signed-in
  user id and continues to use the existing password-hash update boundary.
- Password validation covers current password, new password length, matching
  confirmation, unchanged password, missing password hashes, and anonymous API
  requests.
- Password responses return account-safe messages only. Password hashes are not
  rendered, returned, logged, or snapshotted by the touched account surfaces.
- The governing UX docs and superseded phase docs now describe Account as
  identity, password, preferences, theme, session control, and a single
  Affiliate Dashboard shortcut. Referral/QR management belongs to `/referrals`.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3ap-account-menu-password-and-affiliate-route-alignment.md`

## Required Work

### 1. Collapse The Account Menu

Update the upper-right authenticated account menu to contain only:

```text
My Account
Affiliate Dashboard
Sign out
```

The theme toggle remains in the account menu header.

Implementation rules:

- `profile` becomes visible as `My Account` and links to `/profile`.
- Add or preserve an internal Account section route id, likely
  `change-password`, linking to `/profile?section=password`.
- `ACCOUNT_MENU_ROUTE_IDS` should resolve `profile` and `referrals` for
  signed-in users. Do not put `change-password` in the upper-right account
  menu.
- `AccountMenu.tsx` should not keep a divergent local route allowlist unless it
  matches the route registry exactly.
- Remove `my-qr-referral` and `preferences` from the account menu.
- Do not expose System/Admin inside the account menu.

### 2. Move Referral/QR Out Of Account

Remove the referral/QR account section from `/profile`.

Implementation rules:

- `/profile` second column should expose:
  - User info,
  - Change password,
  - Preferences.
- `/profile?section=referrals` should redirect to `/referrals` or render a
  transitional server-side redirect. Prefer redirect so stale links converge.
- The account page should not display QR codes, referral links, referral
  performance, or affiliate funnel language.
- The `/referrals` page remains the canonical owner affiliate dashboard.
- `/admin/affiliates` remains the admin/global affiliate dashboard.
- `/business/referrals/[referralCode]` remains the object-detail/provenance
  route for referral evidence.

### 3. Add Change Password

Add a safe password-change section under Account.

Implementation rules:

- Route: `/profile?section=password`.
- UI fields:
  - current password,
  - new password,
  - confirm new password.
- The UI must not show or log password hashes.
- Use `autocomplete` values appropriate for password managers:
  - `current-password`,
  - `new-password`.
- Validate:
  - current password is present,
  - new password is 8-72 characters,
  - confirmation matches,
  - new password differs from current password where practical.
- Create a use case for password change rather than updating the mapper from
  the route handler directly.
- Verify the current password with the existing password hasher before writing
  a new hash.
- If an account has no password hash, return a clear account-safe error such as
  "Password login is not configured for this account." Do not silently set a
  password without an explicit reset/invite flow.
- Return only status/message payloads from the API.

Suggested API:

```text
PATCH /api/profile/password
```

### 4. Preserve Affiliate Route Semantics

Document and preserve the canonical affiliate routes:

```text
/referrals                         owner affiliate dashboard
/business/referrals/[referralCode] referral evidence detail
/admin/affiliates                  admin/global affiliate dashboard
```

Implementation rules:

- Account menu should link to `/referrals` once as `Affiliate Dashboard`.
- Affiliate/QR management should remain inside `/referrals`,
  business/People/referral contexts, chat tool cards, and future section
  selectors, not `/profile`.
- Existing tool result `manage_route: "/referrals"` should remain correct.

### 5. Update Canonical Docs

Update the UX and phase docs that still describe the old account menu:

- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ux/01-language-and-vocabulary.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/06-open-questions-and-next-research.md`
- `docs/_refactor/ordo/phases/01c3af-account-user-info-referrals-preferences.md`
- `docs/_refactor/ordo/phases/01c3ad-chat-first-shell-grid-and-mobile-menu.md`
- `docs/_refactor/ordo/phases/01c3ao-canonical-ux-regression-closeout.md`

Do not rewrite history in implemented phase closeout sections. Add correction
notes or supersession notes where needed.

## Tests

Positive:

- account menu shows `My Account`, `Affiliate Dashboard`, theme toggle, and
  Sign out for signed-in users.
- account menu does not show `Change Password`; password changes are reached
  from the `/profile` second-column rail.
- `My Account` routes to `/profile`.
- `Affiliate Dashboard` routes to `/referrals`.
- account menu renders exactly one `My Account` link.
- `/profile` second column shows User info, Change password, and Preferences.
- mobile Account section selection opens detail and back returns to the section
  list.
- password change succeeds with correct current password and valid new password.
- `/referrals` still renders the owner affiliate dashboard for signed-in users.
- affiliate tools still return `manage_route: "/referrals"`.

Negative:

- account menu does not show `My Referrals`, `Preferences`, QR, System, My
  media, My conversations, My offers, or My content.
- `/profile` does not render referral QR/link/performance.
- `/profile?section=referrals` does not keep a duplicate account referral page.
- password change rejects anonymous requests.
- password change rejects wrong current password.
- password change rejects weak or mismatched new passwords.
- password hash never appears in response payloads, rendered UI, logs, tests,
  or snapshots.
- non-admin users cannot access `/admin/affiliates`.

Edge:

- users without a password hash get a clear password-login-not-configured
  message.
- stale deep links to `/profile?section=referrals` converge to `/referrals`.
- password-change failures keep form inputs in a sane state while clearing
  password values as appropriate.
- role labels and account menu active state remain stable on query routes.

## Required Commands

Run at minimum:

```bash
npx vitest run src/components/AccountMenu.test.tsx src/lib/shell/shell-navigation.test.ts src/components/profile/ProfileSettingsPanel.test.tsx src/app/profile/page.test.tsx src/app/api/profile/route.test.ts src/app/referrals/page.test.tsx
npm run typecheck
npm run lint -- src/components/AccountMenu.tsx src/lib/shell/shell-navigation.ts src/components/profile/ProfileSettingsPanel.tsx src/app/profile/page.tsx src/app/api/profile/route.ts
npm run lint:css
```

Add new focused tests for password-change use case/API once the exact files are
created.

Run static scans:

```bash
rg -n "My Referrals|my-qr-referral|profile\\?section=referrals|Referral code|QR code" src/components/AccountMenu.tsx src/components/profile src/lib/shell src/app/profile tests
rg -n "password_hash|passwordHash" src/app/api/profile src/components/profile tests
rg -n "My media|My conversations|My offers|My content|System" src/components/AccountMenu.tsx tests src/lib/shell
```

## Acceptance Criteria

- Account menu is reduced to account/session controls.
- Account page owns identity, password, preferences, and nothing affiliate
  specific.
- `/referrals` is the single owner affiliate dashboard.
- Password change is safe, authenticated, validated, tested, and does not leak
  hashes.
- Stale account/referral docs are corrected or explicitly superseded.
- Mobile list/detail behavior remains canonical.
- All required tests pass twice.

## Non-Goals

- Do not redesign the full `/referrals` workspace in this phase.
- Do not implement password reset, email verification, magic links, or OAuth
  account linking.
- Do not move affiliate analytics into People yet.
- Do not add commission/payout UI.
- Do not remove donor routes unless redirects and tests are in place.

## Closeout Evidence Required

- Account menu before/after route list.
- Account page second-column screenshots or browser evidence.
- Password-change positive/negative test evidence.
- `/referrals` route evidence.
- Static scan evidence showing account menu/profile no longer contain referral
  QR/link UI.
- Updated docs list.
