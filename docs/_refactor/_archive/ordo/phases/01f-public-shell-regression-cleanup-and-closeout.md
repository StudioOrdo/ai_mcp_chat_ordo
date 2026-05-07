# Phase 01f: Public Shell Regression, Cleanup, And Closeout

Status: Planned

Parent phase:

- `01-public-site-shell-and-navigation.md`

Depends on:

- `01a-public-shell-chat-and-ui-audit.md`
- `01b-route-access-and-public-surface-contract.md`
- `01c-public-navigation-footer-and-mobile-system.md`
- `01c6-navigation-regression-cleanup-and-closeout.md`
- `01d-conversational-homepage-composition.md`
- `01e-public-motion-scrollytelling-and-responsive-polish.md`

## Goal

Prove the 01x public shell is complete and remove stale public shell assumptions.

This phase is the guardrail against a polished homepage that still leaks
`/library`, `/journal`, `/blog`, old command IDs, stale eval fixtures, or old
homepage language.

## Blast Radius

Tests, eval fixtures, stale route references, public shell docs, and phase
closeout evidence.

Do not add new product behavior in this phase.

## Current Code To Research

- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/shell-command-parity.test.ts`
- `tests/shell-navigation-model.test.ts`
- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/homepage-shell-evals.test.tsx`
- `tests/first-message-flow.test.tsx`
- `tests/public-content-routes.test.ts`
- `tests/seo-infrastructure.test.ts`
- `tests/evals/eval-runner.test.ts`
- `src/frameworks/ui/RichContentRenderer.test.tsx`
- `src/components/SiteNav.test.tsx`
- `src/app/not-found.tsx`
- `src/components/AccountMenu.tsx`
- `src/app/sitemap.ts`
- `src/app/robots.ts`

## Required Work

- Run public shell test set from 01b-01e.
- Run targeted stale-reference scans for:
  - `/library`,
  - `/journal`,
  - `/blog`,
  - `Search my library`,
  - `Open library`,
  - `nav-corpus`,
  - `nav-journal`,
  - "sales agent mode",
  - "full library access".
- Keep internal donor-code references only when they are not public surface.
- Write closeout evidence summarizing implemented public routes, mobile/desktop
  navigation, homepage composition, and motion/responsive proof.

## Positive Tests

- Anonymous public shell route set passes.
- Homepage chat-first proof passes.
- Mobile public route visibility passes.
- Footer/bottom nav proof passes.
- Empty feed/offers proof passes.
- Authenticated/admin navigation rail proof from Phase 01c remains green.

## Negative Tests

- No anonymous public nav/command/footer/not-found/eval fixture points to
  `/library`, `/journal`, or `/blog`.
- No public sitemap/robots promotion of deleted routes.
- No admin/workspace route appears in anonymous public navigation.
- No test still encodes hidden drawer as the primary public navigation model.

## Edge Tests

- Referral visitor.
- Missing identity config.
- Empty feed.
- No offers.
- Reduced-motion browser path if Phase 01e added motion.

## Cleanup

- Delete stale tests that only assert the old public product shape.
- Rename remaining tests to describe the new public route contract.
- Update `01-public-site-shell-and-navigation.md` completion notes.
- Update package `qa-review.md` if Phase 01 changed known risks.

## Exit Criteria

- Phase 01 parent exit criteria pass.
- Closeout evidence exists.
- The public Ordo shell is smaller, clearer, and tested.
