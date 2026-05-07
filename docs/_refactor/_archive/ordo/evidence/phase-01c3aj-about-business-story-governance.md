# Phase 01c3aj Evidence: About Business Story Governance

Date: 2026-05-06

## Scope

Implemented the About business/story governance phase:

- anonymous `/about` remains a public, visitor-safe story page;
- authenticated `/about` renders a governed About workspace;
- the owner base route renders `Business Story Brief`;
- the second column selects story sections;
- selected story sections render one detail with current copy, visibility,
  source refs, and a chat-first next action.

## Files Changed

- `src/app/about/page.tsx`
- `src/app/about/page.test.tsx`
- `src/components/about/AboutSurfaces.tsx`
- `src/components/about/AboutSurfaces.test.tsx`
- `src/lib/about/load-about-workspace.ts`
- `src/lib/about/load-about-workspace.test.ts`
- `tests/public-content-routes.test.ts`
- `docs/_refactor/ordo/phases/01c3aj-about-business-story-governance.md`
- `docs/_refactor/ordo/evidence/phase-01c3aj-about-business-story-governance.md`

## Public Visibility Proof

- Anonymous route branching is covered by `src/app/about/page.test.tsx`.
- Public surface rendering is covered by
  `src/components/about/AboutSurfaces.test.tsx`.
- Public route contract is covered by `tests/public-content-routes.test.ts`.
- The public About surface keeps approved public CTAs:
  - `/register`;
  - `/offers`.
- Public rendering does not include:
  - `Business Story Brief`;
  - account/admin copy;
  - corpus/library language.

## Authenticated Governance Proof

- Signed-in route branching is covered by `src/app/about/page.test.tsx`.
- Authenticated workspace rendering is covered by
  `src/components/about/AboutSurfaces.test.tsx`.
- About read-model behavior is covered by
  `src/lib/about/load-about-workspace.test.ts`.
- Authenticated About follows the canonical governance pattern:
  - base route: `Business Story Brief`;
  - second column: story-section selector;
  - selected route: one selected story section;
  - missing selected section: owner-safe Ordo Chat next action.

## Copy Review

Reviewed against:

- `docs/_business/ux/02-message-and-tone.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`

Result:

- Public About copy is plain, human, and visitor-safe.
- Authenticated About copy frames UI as governance, not operation.
- Revision actions route to Ordo Chat.
- Raw corpus/library/provider/log/job language is not used as normal About UI
  copy.

## QA Pass 1

Commands:

```bash
npm test -- src/lib/about/load-about-workspace.test.ts src/components/about/AboutSurfaces.test.tsx src/app/about/page.test.tsx tests/public-content-routes.test.ts src/app/sitemap.test.ts src/lib/shell/shell-navigation.test.ts
npm run typecheck
npm run lint -- src/app/about/page.tsx src/app/about/page.test.tsx src/components/about/AboutSurfaces.tsx src/components/about/AboutSurfaces.test.tsx src/lib/about/load-about-workspace.ts src/lib/about/load-about-workspace.test.ts tests/public-content-routes.test.ts
```

Result:

- 6 test files passed.
- 43 tests passed.
- Typecheck passed.
- Focused lint passed.

Issues found and fixed:

- Updated the public content route source contract so About CTAs are checked in
  the public About surface after the route split.
- Added explicit route tests for anonymous and authenticated About branching.

## QA Pass 2

Commands:

```bash
npm test -- src/lib/about/load-about-workspace.test.ts src/components/about/AboutSurfaces.test.tsx src/app/about/page.test.tsx tests/public-content-routes.test.ts src/app/sitemap.test.ts src/lib/shell/shell-navigation.test.ts
npm run typecheck
npm run lint -- src/app/about/page.tsx src/app/about/page.test.tsx src/components/about/AboutSurfaces.tsx src/components/about/AboutSurfaces.test.tsx src/lib/about/load-about-workspace.ts src/lib/about/load-about-workspace.test.ts tests/public-content-routes.test.ts
rg -n "config/identity\\.json|MCP-native|Hybrid search|media jobs|provider|logs?|raw job|corpus|library|tracked_link_events|offer_events" src/app/about/page.tsx src/components/about/AboutSurfaces.tsx src/lib/about/load-about-workspace.ts
```

Result:

- 6 test files passed.
- 43 tests passed.
- Typecheck passed.
- Focused lint passed.
- Static scan passed with no matches after the language fix below.

Issues found and fixed:

- Static scan found `content library` in the owner About brief. Replaced it
  with `production archive` so the owner About UI does not inherit raw/stale
  library language.

## Static Scans

The final stale-surface scan found no instances of:

- `config/identity.json`
- `MCP-native`
- `Hybrid search`
- `media jobs`
- provider/log/raw job language
- corpus/library language
- raw event table names such as `tracked_link_events` or `offer_events`

## Local Route Check

Command:

```bash
curl -I --max-time 5 http://localhost:3000/about
```

Result:

- The running local server responded with `307 Temporary Redirect` to
  `/install`, which means this runtime is currently behind the install gate.
- Public/authenticated About rendering evidence for this phase is therefore
  captured by the route/component tests above rather than a live screenshot.

## Remaining Risks

- About story data is still a read-model projection over current public copy,
  identity, and service configuration. A durable business-story/profile table is
  intentionally deferred.
- No page-builder/editor is implemented in this phase.
