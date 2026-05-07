# Phase 01c3bb: UI Surface Realignment Closeout

Status: Planned

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Perform final QA, evidence capture, route matrix updates, and regression cleanup
for the full UI surface realignment package.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/*.md`

## Current Code Grounding

Code anchors:

- `src/lib/shell/shell-navigation.ts`
- `src/components/governance/GovernanceSectionFrame.tsx`
- `src/components/SiteNav.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/AccountMenu.tsx`
- all canonical owner/public/admin page routes touched by phases
- all surface loaders touched by phases
- all phase docs `01c3aq` through `01c3ba`

## Verified Current State

- This phase runs only after `01c3aq` through `01c3ba` are implemented.
- The codebase should have clean canonical navigation zones.
- Donor routes should be hidden, redirected, or role-gated.
- Owner surfaces should use section brief + selector + selected detail.
- Placeholder intelligence should be limited and deterministic.

## Target Behavior

- Public: Home, Offers, About, Feed when public content exists.
- Owner: Conversations, Today, Studio, People, Offers, About, plus Knowledge
  Base if implemented.
- Account: My Account, Affiliate Dashboard, theme toggle, Sign out.
- Admin: Admin, Jobs, System.
- Base routes render briefs.
- Detail routes render one object.
- No fake live intelligence, private leaks, donor nav leaks, or owner raw
  diagnostics remain.

## Implementation Steps

1. Re-run all phase-required test suites.
2. Run route and nav static scans.
3. Inspect desktop/mobile for Home/Conversations, Today, Studio, People,
   Offers, About, Account, Referrals, Knowledge Base if present, System.
4. Fix any regression found.
5. Update `02-ui-surface-realignment/00-route-and-surface-inventory.md`.
6. Update phase docs with implementation evidence.
7. Capture final risks/deferred work.

## Positive Tests

- All canonical routes load for correct roles.
- Shell route sets match canonical IA.
- Each owner surface renders brief, selector, detail, and mobile back behavior.
- Admin diagnostics remain admin-only.
- Placeholder states show limitations.

## Negative Tests

- No donor routes in primary nav.
- No fake metrics/sample production claims.
- No private evidence on public routes.
- No raw job/log/provider details in owner UI.
- No duplicate account menu items.

## Edge Tests

- Anonymous, owner, staff, admin role matrix.
- Empty data state for each canonical surface.
- Direct detail route with missing id.
- Mobile list/detail direct load.
- Redirects from donor routes.

## Acceptance Criteria

- All phase test suites pass.
- Route matrix matches implemented behavior.
- UX contracts remain normative and accurate.
- Remaining deferred work is explicit, bounded, and documented.

## Non-Goals

- No new features beyond regression fixes.
- No broad visual redesign.
- No deletion of donor code unless a prior phase made it safe.

## Required Commands

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/AccountMenu.test.tsx src/components/governance/GovernanceSectionFrame.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/components/referrals/ReferralsWorkspace.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- [all touched source/test files]
```

## Static Scans

```bash
rg -n "My media|My conversations|My offers|My content|Activity|Operations|Factory|raw job|provider|payload|fake|sample|coming soon|Library|Journal|Blog" src/app src/components src/lib docs/_business/ux docs/_refactor/ordo/phases
rg -n "href=\"/(jobs|activity|operations|my/media|library|journal|blog)" src/app src/components
```

## Closeout Evidence Required

- Updated route decision matrix.
- Final route/nav static scan output.
- Desktop/mobile screenshot set for canonical surfaces.
- Full focused test output.
- Explicit remaining risks/deferred work list.
