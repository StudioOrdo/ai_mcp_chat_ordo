# Phase 01c3z: Relationship Settings And People Shell Closeout

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3y-relationship-trail-and-source-linking.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c4-admin-global-factory-navigation-rail.md`
- `01c5-command-seo-and-route-state-parity.md`

## Goal

Close out the first polished People + shell implementation with minimal
relationship settings, mobile proof, and regression coverage.

The finished pass should match the first-screen target: public top nav,
business left rail, search-first People column, person detail, Relationship
Brief, Relationship Trail, and subordinate Relationship settings.

## Product Rule

The owner commands Ordo through chat and governs relationships through People.

Settings are subordinate. They should not dominate the relationship evidence or
pretend to be a full CRM admin console.

## Current Code Grounding

- `src/components/business/BusinessWorkspace.tsx`
  - People workspace.
  - Now renders a subordinate read-only Relationship settings card beside the
    Relationship Trail on wide viewports and below the relationship evidence
    stack on constrained/mobile viewports.
- `src/app/business/people/[personId]/page.tsx`
  - Person detail route.
- `src/lib/business/people-read-model.ts`
  - Derived person state and role/affiliate donors where available.
  - No durable person-level relationship settings write path exists yet.
- `src/core/entities/user.ts`
  - User roles and affiliate state donor.
- `src/lib/auth`
  - Current session/role boundary.
- `src/components/AuthenticatedWorkRail.tsx`
  - Owner/admin shell rail.
- `src/components/SiteNav.tsx`
  - Public nav and avatar menu region.
- `src/app/styles/shell.css`
  - Responsive shell behavior.

## Implementation Summary

Implemented the closeout pass as a governance layer, not a new CRM subsystem.

- Added Relationship settings to the selected People detail.
- Relationship role is shown as a disabled selector because the current code
  only derives role from durable evidence.
- Affiliate state is shown as a disabled toggle because the only mutation path
  found is account/admin affiliate enablement, not person-level relationship
  mutation.
- The settings card includes a chat/conversation-oriented action:
  - `Discuss in conversation` when a source conversation exists;
  - `Ask Ordo in chat` when no source conversation exists.
- Commission, payment, checkout, raw job, operation, log, provider, and
  diagnostic language remain absent from regular owner People UI.
- Public nav, owner rail, account menu, mobile dock, and mobile account sheet
  regression coverage were expanded.

## Grounding Decision

No write action was added in this phase.

Reason:

- Person relationship role and affiliate status are currently projected by the
  People read model from conversations, referrals, leads, deals, and offer
  evidence.
- Existing affiliate mutation is account/admin scoped, not a safe current-owner
  person relationship mutation.
- The product kernel says chat is the operating interface and UI surfaces are
  governance. The truthful first pass is therefore read-only governance with a
  chat/conversation action.

Future mutation work should add an explicit durable relationship setting model
before these controls become editable.

## UX Target

Relationship settings:

- Relationship role:
  - Prospect
  - Customer
  - Affiliate
  - Collaborator
  - Staff
- Affiliate:
  - on/off

Rules:

- do not show commission details in this pass;
- do not show a large "coming soon" placeholder;
- settings card moves below main content when width is constrained;
- controls respect permission boundaries;
- stage remains evidence-derived unless a later explicit override model exists.

## Required Work

- Add minimal Relationship settings card.
- Add role selector when a durable setting/write path exists; otherwise render
  read-only state with a chat-oriented action.
- Add affiliate toggle only when the existing account/affiliate capability
  supports safe mutation for the current viewer.
- Keep commission/payment details out of normal People UI.
- Verify responsive desktop and mobile layouts.
- Add closeout scans for stale nav, raw diagnostics, fake metrics, and
  hydration-prone date formatting.

## Tests

Add or update tests proving:

- relationship role control respects permissions;
- affiliate toggle respects permissions and existing capability state;
- regular owner UI does not show commission controls;
- mobile People list/detail remain usable;
- avatar menu opens on mobile;
- filter sheet is keyboard/screen-reader usable;
- bottom nav exposes Today, Studio, People, Offers, About;
- public nav remains About, Offers, conditional Feed;
- no raw Jobs/Operations/Logs appear in owner People UX;
- no locale-dependent timestamp formatting remains in hydrated People surfaces.

Suggested anchors:

- `src/components/business/BusinessWorkspace.test.tsx`
- `src/app/business/people/[personId]/page.test.tsx`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/SiteNav.test.tsx`
- browser/mobile specs for `/business`
- static scans using `rg`

## Non-Goals

- Do not implement commission rate UI.
- Do not implement checkout or payment UI.
- Do not implement raw jobs or operations pages in owner UX.
- Do not implement complex system mobile admin workflows.
- Do not delete donor routes during this pass.

## Closeout Evidence Required

Document:

- shell/nav files changed;
- people read model files changed;
- person detail files changed;
- mobile screenshots or browser evidence;
- static scans for banned owner UX terms;
- all tests run;
- any deferred donor-route cleanup.

## Closeout Evidence

- Evidence file:
  - `docs/_refactor/ordo/evidence/phase-01c3z-relationship-settings-and-people-shell-closeout.md`

Implemented files:

- `src/components/business/BusinessWorkspace.tsx`
- `src/components/business/BusinessWorkspace.test.tsx`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/SiteNav.test.tsx`
- `src/components/AccountMenu.test.tsx`
- `tests/browser-ui/business-workspace.spec.ts`

No people read-model mutation was needed because the phase uses the existing
derived `relationshipRole` and `affiliate` fields.

Deferred cleanup:

- Donor routes such as `/jobs`, `/operations`, `/activity`, `/referrals`, and
  admin diagnostics remain addressable because this pass explicitly did not
  delete donor routes.
- Editable relationship settings need a future durable person-level setting
  model and permission boundary.
