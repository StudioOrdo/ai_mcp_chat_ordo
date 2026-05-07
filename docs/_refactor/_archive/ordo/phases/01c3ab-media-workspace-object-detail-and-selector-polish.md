# Phase 01c3ab: Media Workspace Object Detail And Selector Polish

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3u-shell-menu-and-account-surface-alignment.md`
- `01c3aa-menu-aesthetic-and-focus-polish.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_refactor/ordo/reports/2026-05-05-media-workspace-ui-problem-report.md`

Blocks:

- `01c4-admin-global-factory-navigation-rail.md`

## Goal

Refactor `/my/media` so it follows the same object-selection pattern as
People, Today, Studio, and System.

The media page should no longer feel like a dashboard with a large global
heading and metric cards. It should feel like a calm governed asset inspector:
the second column selects and filters media, and the main column explains the
selected media object.

The critical interaction rule is: the main content may show either the media
overview or one selected asset, but never both stacked together.

## Product Rule

Chat is the operating interface. UI surfaces are the governance layer.

For media:

- chat creates, modifies, and reasons about media;
- Studio owns media as a production object type;
- `/my/media` is an account-owned governed asset inspector;
- the second column is the media overview, selection, and filter surface;
- the main column is a stateful detail surface: Overview or one selected asset;
- owner UI must not expose raw job/provider/runtime details or
  implementation-phase language.

## Report Grounding

This phase resolves the findings in:

- `docs/_refactor/ordo/reports/2026-05-05-media-workspace-ui-problem-report.md`

The report identifies these concrete problems:

1. The global heading competes with the selector.
2. Summary totals are too large and occupy the wrong layer.
3. The second-column filter stack is too dense.
4. The selected media row visually overflows the column.
5. The selected media detail is too horizontal and compressed.
6. Storage budget copy is implementation-facing.
7. The page leaves too much footer-dominated empty space.
8. The route still reads as personal `My Media` instead of governed assets.
9. Global media totals currently appear above the selected asset, so the page
   reads as a stacked dashboard instead of a one-object detail surface.

## Current Code Grounding

- `src/app/my/media/page.tsx`
  - Loads signed-in user context and calls `loadUserMediaWorkspace`.
  - Metadata currently uses the `My Media` framing.
- `src/components/media/UserMediaWorkspace.tsx`
  - Owns the current second-column selector, inline filters, summary cards,
    storage budget card, selected asset detail, preview, and delete action.
  - Already uses `shell-governance-grid`, but the visual hierarchy is wrong.
- `src/components/media/UserMediaWorkspace.test.tsx`
  - Covers the media selector and detail behavior.
  - Must be updated to enforce the improved second-column/main-column split.
- `src/lib/media/user-media.ts`
  - Loads media items, filters, summary, quota, and attachment/deletion state.
  - Should remain the data source. Do not create a parallel media read model in
    this phase.
- `src/lib/media/user-media.test.ts`
  - Covers existing loader behavior and should remain valid.
- `tests/media-architecture-audit.test.ts`
  - Provides guardrails around governed media surfaces.
- `src/app/styles/shell.css`
  - Owns the shared governance grid. Avoid one-off shell geometry unless the
    shared primitive is insufficient.

## Required Work

### 1. Add a real Overview state

- Add an `Overview` pseudo-item at the top of the second-column media selector.
- Make `Overview` the default page state when no asset is selected.
- Selecting `Overview` renders global media state in the main column.
- Selecting an asset renders only that asset detail in the main column.
- Overview content and selected-asset content must never appear stacked in the
  main column.
- If practical, preserve the selected state with deterministic URL state such
  as `?view=overview` and `?asset=<assetId>`. If deferred, document the
  deep-linking risk in closeout evidence.

Second-column target:

```text
Media

Overview
1 asset · 1 attached · 0 safe delete · 0% quota

Search media... [filter]

Assets
d59a...86.mp3
```

Overview main-column target:

```text
Media overview
Storage healthy
1 governed asset
1 attached to conversations
0 safe deletion candidates

Recent assets
...
```

Asset main-column target:

```text
Selected media
d59a...86.mp3
Audio · Generated · Attached

[preview]

Facts
Created / Size / Duration / Used by

Governance
Attached media is locked.
```

### 2. Remove the repeated global heading from asset detail

- Remove the large `Governed assets for {userName}` heading from selected asset
  detail.
- Keep stable page identity in the second-column header.
- Use `Media overview` only for the Overview state.
- Use `Selected media` only for the asset state.
- The selected asset state should answer: "What asset am I inspecting?"

### 3. Move global totals into Overview and compact second-column status

- Remove the large main-column summary card grid from selected asset detail.
- Move compact global media state into the second column.
- Move fuller global media state into the Overview main-column state only.
- Never render global summary totals above selected asset detail.
- Include at minimum:
  - total assets;
  - attached assets;
  - unattached/safe-delete candidates;
  - quota percentage.
- Keep metrics visually subordinate to search and selection.

### 4. Collapse advanced filters

- Keep search visible.
- Move Type, Source, Retention, and Attachment state behind a compact filter
  icon/button.
- If using a form-only non-JS fallback, make the expanded advanced filters
  visually secondary and not permanently dominant.
- Show active filter chips only when filters are applied.
- Keep reset available, but do not let it visually compete with the primary
  selection surface.

Implementation constraint:

- Do not add client hydration risk by moving this server-form behavior into an
  unnecessary client component. `UserMediaWorkspace` is already client-side for
  selection; if interactive filter disclosure is added, keep it small and
  deterministic.

### 5. Make media rows compact and width-safe

- Treat each media item as a compact selectable row, not a large dashboard
  card.
- Add a type icon/avatar marker.
- Use a humanized row title when possible.
- If only a machine filename exists, shorten it safely for display while
  preserving the full filename in detail metadata.
- Ensure long filenames cannot cross the second-column boundary.
- Keep selected state subtle: thin indicator plus warm surface, not a large
  visual block.

### 6. Redesign selected media detail

- Make selected media the main hero.
- Keep preview, facts, provenance/usage, and governed actions in a clear
  hierarchy.
- Constrain the audio player and metadata rhythm so they feel intentional.
- Use selected-object facts instead of global dashboard bands.
- Keep deletion behavior governed:
  - attached media remains locked;
  - unattached media can use the existing deletion action;
  - no raw storage/provider/job internals appear in owner UI.

Target detail order:

```text
Selected media
[title]
[type/source/attachment badges]

[preview]

Facts
Created
Size
Duration
Used by

Governance
Attached media is locked.
[Open preview]
```

### 7. Rewrite quota/storage copy

- Remove implementation-phase copy such as `display only` and `in this phase`
  from owner UI.
- Replace with product language:
  - `Storage is healthy.`
  - `Uploads are still available.`
  - `Storage is close to the warning level.`
  - `Storage limit reached.`
- Keep deeper quota policy details for System/Admin, not regular owner media
  UI.

### 8. Reduce footer dominance on this workspace

- Ensure `/my/media` fills the authenticated workspace area better.
- If the global footer remains, the working surface should not feel like a
  small island above a large public footer.
- Prefer a stronger min-height or shell-level workspace treatment over local
  decorative filler.

### 9. Clarify route framing

- Keep `/my/media` as a compatibility/account route.
- Change visible copy from personal file-cabinet framing toward governed asset
  inspection.
- Consider updating metadata away from `My Media` if tests and route contracts
  allow it.
- Do not move route ownership in this phase; Studio remains the primary
  production surface for media as an object type.

## UX Acceptance Criteria

- The second column contains page identity, an `Overview` pseudo-item, visible
  search, compact media status, filter access, and the media selection list.
- The default main-column state is `Media overview`.
- Selecting an asset replaces overview content with exactly one selected asset
  detail.
- Overview totals and selected asset detail are never stacked in the main
  column.
- Advanced filters no longer permanently dominate the second column.
- The selected asset main column begins with selected media detail, not a large
  global page heading.
- Global totals do not appear as large dashboard cards above selected asset
  detail.
- Storage budget is compact and product-worded.
- Long media filenames do not overflow or visually cross into the main column.
- The selected media detail is readable and object-centered on desktop.
- Mobile list/detail drill-in still works.
- Attached media remains visibly locked.
- Owner UI contains no fake metrics, no raw job/provider/runtime details, and
  no implementation-phase language.

## Tests

Add or update tests proving:

- second-column media selector renders an `Overview` pseudo-item;
- default state renders `Media overview`;
- selecting an asset hides overview content and renders exactly that selected
  asset detail;
- selected asset detail does not render `Governed assets for`;
- overview summary and selected asset detail are mutually exclusive;
- second-column media selector renders compact media status metrics;
- main-column large global summary card grid is gone;
- selected media detail appears before global quota/storage copy;
- advanced filters are not all permanently exposed as the dominant visible
  second-column stack;
- long filenames are displayed with truncation/shortening in the selector and
  preserved in detail metadata;
- storage/quota copy avoids `display only`, `phase`, and implementation
  language in owner UI;
- attached media remains locked and unattached media deletion behavior remains
  governed;
- mobile list/detail behavior still works;
- `/my/media` still calls `loadUserMediaWorkspace` and preserves role/access
  boundaries;
- static scans show no raw job/provider/runtime terms in owner media UI.

Suggested anchors:

- `src/components/media/UserMediaWorkspace.test.tsx`
- `src/app/my/media/page.test.tsx`
- `src/lib/media/user-media.test.ts`
- `tests/media-architecture-audit.test.ts`
- `tests/browser-ui/media-capacity-quotas.spec.ts`

## Non-Goals

- Do not redesign Studio.
- Do not remove `/my/media`.
- Do not add a new media read model.
- Do not implement full provenance graph or media workflow history.
- Do not expose raw jobs, operations, logs, provider keys, or runtime details
  in owner media UI.
- Do not implement new storage quota enforcement policy.
- Do not change media deletion semantics beyond presentation/copy.

## QA Requirements

Run:

```bash
npm run test -- src/components/media/UserMediaWorkspace.test.tsx src/app/my/media/page.test.tsx src/lib/media/user-media.test.ts tests/media-architecture-audit.test.ts
```

Run:

```bash
npm run typecheck
```

Run focused lint on touched files:

```bash
npx eslint src/components/media/UserMediaWorkspace.tsx src/components/media/UserMediaWorkspace.test.tsx src/app/my/media/page.tsx src/app/my/media/page.test.tsx src/lib/media/user-media.ts src/lib/media/user-media.test.ts
```

Run static scans:

```bash
rg -n "raw job|provider log|runtime log|job_events|media_workflow_events|Writable volume capacity|display only|in this phase|phase" src/components/media src/app/my/media src/lib/media/user-media.ts
```

Run browser smoke if a dev server is available:

```bash
npx playwright test tests/browser-ui/media-capacity-quotas.spec.ts -g "my media route"
```

## Closeout Evidence Required

Create or update:

- `docs/_refactor/ordo/evidence/phase-01c3ab-media-workspace-object-detail-and-selector-polish.md`

Evidence must include:

- code files changed;
- visual hierarchy changes;
- copy changes;
- tests run;
- QA pass 1 findings and fixes;
- QA pass 2 findings and fixes;
- remaining risks or deferred work.

## Implementation Notes

- Start in `src/components/media/UserMediaWorkspace.tsx`.
- Keep changes scoped to the media workspace and route metadata/tests unless a
  shared shell primitive is clearly required.
- Prefer small helper components:
  - compact media metrics;
  - media type icon;
  - selector title formatting;
  - selected media object header;
  - product-safe storage status text.
- Preserve the existing loader and deletion action boundaries.
- Avoid making the page more complex than People/System; this should be a
  cleanup pass, not a new media management product.
