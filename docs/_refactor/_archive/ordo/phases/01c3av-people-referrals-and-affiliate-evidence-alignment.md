# Phase 01c3av: People, Referrals, And Affiliate Evidence Alignment

Status: Implemented

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Align People, Referrals, and Affiliate Dashboard so QR/referral evidence appears
where it belongs without burying referral controls in Account or exposing admin
affiliate tools to owners.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/00-route-and-surface-inventory.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/06-accepted-offers-lifecycle-surface.md`

## Current Code Grounding

Code anchors:

- `src/app/business/page.tsx`
- `src/lib/business/load-business-workspace.ts`
- `src/lib/business/people-read-model.ts`
- `src/components/business/BusinessWorkspace.tsx`
- `src/app/referrals/page.tsx`
- `src/lib/referrals/load-referrals-workspace.ts`
- `src/components/referrals/ReferralsWorkspace.tsx`
- `src/app/business/referrals/[referralCode]/page.tsx`
- `src/app/admin/affiliates/page.tsx`
- `src/components/AccountMenu.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`

## Verified Current State

- `/business` is People and already uses a relationship evidence model.
- `/referrals` is the owner affiliate/referral dashboard.
- `/business/referrals/[referralCode]` is referral evidence detail.
- `/admin/affiliates` is admin/global affiliate dashboard.
- `/profile?section=referrals` redirects to `/referrals`.
- Account menu includes Affiliate Dashboard as the correct user shortcut.

## Target Behavior

- People surfaces relationship stage, source, referral, QR, offer, and follow-up
  evidence.
- `/referrals` owns the user's referral link, QR code, and affiliate dashboard.
- `/business/referrals/[referralCode]` remains evidence detail.
- `/admin/affiliates` remains admin/global.
- Account contains My Account only plus Affiliate Dashboard shortcut; no QR UI
  in `/profile`.

## Implementation Steps

1. Audit People source/referral projection against referral workspace data.
2. Ensure People relationship trail includes referral/QR events when evidence
   exists.
3. Ensure `/referrals` has owner-safe copy and no profile-sidebar duplication.
4. Ensure account menu and profile sidebar do not contain referral/QR controls.
5. Add tests for route separation and referral evidence linking.
6. Update docs/evidence.

## Positive Tests

- People row/detail can surface referral source when evidence exists.
- Relationship trail links to referral evidence detail.
- `/referrals` shows owner affiliate dashboard or disabled state.
- Account menu links to Affiliate Dashboard once.
- `/profile?section=referrals` redirects to `/referrals`.

## Negative Tests

- `/profile` does not render QR/referral controls.
- Account menu does not show QR, My Referrals, or duplicate affiliate links.
- Owner users cannot access `/admin/affiliates`.
- Public users cannot inspect private referral evidence.

## Edge Tests

- Affiliate access disabled renders honest disabled dashboard.
- Person has referral source but no registered account; People still shows
  Visitor/Conversation stage based on evidence.
- Missing referral code detail renders safe not-found/empty state.
- Admin user sees admin affiliate dashboard separately from owner dashboard.

## Acceptance Criteria

- Referral identity and QR sharing live in `/referrals`.
- Relationship evidence appears in People.
- Admin affiliate tools stay admin-only.
- Account remains identity/session, not business work.

## Non-Goals

- No commission UI.
- No affiliate payout accounting.
- No referral merge/split tooling.
- No QR generation redesign.

## Required Commands

```bash
npx vitest run src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/lib/referrals/load-referrals-workspace.test.ts src/components/referrals/ReferralsWorkspace.test.tsx src/components/AccountMenu.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/app/profile/page.test.tsx src/app/referrals/page.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/lib/business/people-read-model.ts src/lib/business/load-business-workspace.ts src/components/business/BusinessWorkspace.tsx src/lib/referrals/load-referrals-workspace.ts src/components/referrals/ReferralsWorkspace.tsx src/components/AccountMenu.tsx src/components/profile/ProfileSettingsPanel.tsx
```

## Static Scans

```bash
rg -n "QR|referral|Affiliate|My Referrals|profile\\?section=referrals|admin/affiliates" src/app src/components src/lib/shell
```

## Closeout Evidence Required

- Screenshots of People referral evidence, `/referrals`, and Account menu.
- Test output proving route separation.
- Static scan showing no QR/referral controls in `/profile`.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3av-people-referrals-and-affiliate-evidence-alignment.md`

Implemented changes:

- People relationship tests now prove QR/referral source trail events link to
  `/business/referrals/[referralCode]` and that search can find people by
  referral source labels and referral code.
- `/referrals` copy now presents the surface as the owner Affiliate Dashboard,
  keeps referral link/QR controls there, and renders an explicit enabled or
  disabled state.
- `/profile` tests now prove account pages do not render Affiliate Dashboard,
  QR, referral link, referral code, or My Referrals controls even when the
  profile read model includes referral fields.
- Account menu tests now prove My Account and Affiliate Dashboard each render at
  most once, Change Password remains inside the account second column, and old
  My Referrals/My media/My conversations/My offers/My content shortcuts do not
  return.
- Referral evidence detail tests now prove anonymous users redirect before
  loading referral evidence.
- Admin affiliate page tests now prove `/admin/affiliates` delegates to the
  admin gate before loading global affiliate data.

QA summary:

- QA pass 1 found one React test hygiene issue: the `/referrals` copy action
  test did not wait for async notice state. The test now waits for the copied
  notice before continuing.
- QA pass 2 repeated focused tests, typecheck, CSS lint, focused lint, static
  scans, and route reachability checks. No additional implementation issues
  were found.
- Visual browser QA could not be captured because local authenticated routes
  redirect to `/install` in this shell context. DOM, route, unit, lint, and
  static evidence were used for closeout.
