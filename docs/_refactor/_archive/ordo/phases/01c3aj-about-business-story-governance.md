# Phase 01c3aj: About Business Story Governance

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3ae-shared-governance-section-framework.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ux/02-message-and-tone.md`

Blocks:

- `01c3ao-canonical-ux-regression-closeout.md`

## Goal

Make About a governed business/story surface without turning it into a CMS
island.

Public About explains the business and Ordo mission. Authenticated About lets
the owner inspect or later revise the public story through the same section
brief/selector/detail pattern.

## Current Code Grounding

- `src/app/about/page.tsx`
  - Keeps one canonical `/about` route.
  - Anonymous users receive the public About surface.
  - Signed-in users receive the authenticated About governance workspace, with
    `searchParams` passed into the About read model for selector/detail state.
- `src/components/about/AboutSurfaces.tsx`
  - `PublicAboutSurface` renders anonymous-safe business story copy and public
    CTAs.
  - `OwnerAboutWorkspace` renders the shared
    `GovernanceSectionFrame` with a Business Story Brief, second-column story
    selector, and selected story-section detail.
- `src/lib/about/load-about-workspace.ts`
  - New About read model for public story sections, authenticated selector
    state, selected section detail, source refs, and missing-section fallback.
- `src/lib/shell/shell-navigation.ts`
  - About remains the owner rail item and public route; no shell route change
    was required.
- current business/profile/about configuration sources
  - `getInstanceIdentity` and `getInstanceServices` are used as donor sources
    for identity and offer-context copy.
  - No durable business-profile/about table exists yet, so this phase frames
    the current public copy and configuration as the inspectable owner story
    read model.
- public route tests and sitemap tests
  - Updated/extended to cover the public About route, public CTAs, sitemap
    continuity, and owner branch behavior.
- any About-related content or corpus docs used by the public page
  - No corpus/library source is exposed in the public or owner About UI. The
    phase intentionally avoids making About depend on corpus/library surfaces.

## Required Work

1. Public `/about` remains simple and anonymous-safe.
   **Done.**
2. Authenticated About uses the shared governance section layout when reached
   from owner navigation.
   **Done.**
3. Base authenticated About renders Business Story Brief:
   - what the public story currently says,
   - what is missing,
   - what should be revised next.
   **Done.**
4. Second column contains story sections such as:
   - Public story,
   - Mission,
   - Offers context,
   - Proof/results,
   - Open-source/appliance note.
   **Done.**
5. Selected section detail shows current copy, visibility, source refs, and
   future edit/revision actions.
   **Done.**
6. No private owner/account data leaks onto public About.
   **Done.**

## Tests

Positive:

- public About renders visitor-safe copy.
- authenticated About renders brief/selector/detail pattern.
- selected story section renders one section detail.

Negative:

- public About does not expose admin/system/account data.
- About owner UI does not show raw corpus/library implementation language.

Edge:

- missing story section renders an owner next action through Ordo Chat.
- public route works when authenticated owner nav state exists.

## Non-Goals

- Do not build a full page-builder/editor.
- Do not expose library/corpus as public navigation.
- Do not change offer copy management in this phase.

## Closeout Evidence Required

- Public/authenticated About screenshots or browser evidence.
- Visibility proof.
- Copy review against `docs/_business/ux/02-message-and-tone.md`.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3aj-about-business-story-governance.md`

## Implementation Notes

- Public About is now rendered by `PublicAboutSurface` and keeps the visitor
  story focused on what Ordo does for solo operators, how the chat-first
  operating model works, and where to go next.
- Authenticated About is rendered by `OwnerAboutWorkspace`, using the shared
  governance section frame:
  - base route: `Business Story Brief`;
  - second column: story-section overview, search, selector rows, and count;
  - selected route: exactly one story-section detail, with current copy,
    visibility, source refs, and a chat-first next action.
- The About read model intentionally uses product labels:
  - `Public story`;
  - `Mission`;
  - `Offers context`;
  - `Proof/results`;
  - `Open-source/appliance note`.
- `Proof/results` stays in owner review until durable evidence supports a
  public claim.
- Unknown selected story sections render an owner-safe missing-section detail
  with an Ordo Chat next action instead of failing or leaking internals.
- The public About route does not expose owner-only brief, story-governance,
  account, admin, corpus, or library language.

## QA Status

QA pass 1 checks:

- `npm test -- src/lib/about/load-about-workspace.test.ts src/components/about/AboutSurfaces.test.tsx src/app/about/page.test.tsx tests/public-content-routes.test.ts src/app/sitemap.test.ts src/lib/shell/shell-navigation.test.ts`
- `npm run typecheck`
- `npm run lint -- src/app/about/page.tsx src/app/about/page.test.tsx src/components/about/AboutSurfaces.tsx src/components/about/AboutSurfaces.test.tsx src/lib/about/load-about-workspace.ts src/lib/about/load-about-workspace.test.ts tests/public-content-routes.test.ts`

QA pass 1 found no code/test/type/lint failures.

QA pass 2 checks repeated the focused tests, typecheck, focused lint, and the
phase stale-surface scan. QA pass 2 found one stale owner-UI phrase,
`content library`, and replaced it with `production archive`. Final QA pass 2
results are recorded in the evidence document.
