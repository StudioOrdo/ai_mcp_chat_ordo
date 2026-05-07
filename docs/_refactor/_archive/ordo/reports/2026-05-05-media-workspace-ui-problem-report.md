# Media Workspace UI Problem Report

Date: 2026-05-05

Surface: `/my/media`

Primary code anchor:

- `src/components/media/UserMediaWorkspace.tsx`

Related shell anchor:

- `src/app/styles/shell.css`

## Purpose

This report documents the visible UX problems in the current media workspace
screen and identifies the likely implementation causes. It is intentionally a
report, not an implementation phase. The goal is to make the next refactor
precise: the media page should follow the same calm, object-selection pattern
as People, Today, Studio, and System.

## Product Contract

The governing product rule remains:

- Chat is the operating interface.
- UI surfaces are the governance layer.
- The second column is the selection and inspection index.
- The main content column should explain the selected object or selected
  section, not compete with the selector.

The current media page has the right architectural direction, but the visual
execution is not yet good enough.

## Screenshot Findings

### 1. The global heading competes with the selector

The main heading, `Governed assets for Keith Williams`, is large and sits too
close to the second-column media list. In the screenshot, the main page reads as
if the heading is floating into the selector instead of living in a separate
main content zone.

Problem:

- The second column and main column do not feel like clean adjacent rails.
- The heading consumes too much first-screen weight for a utility surface.
- The page reads like a report page, not an object governance workspace.

Likely code cause:

- `UserMediaWorkspace` renders the heading in the main detail column above all
  summary and selected asset content.
- The main heading uses `theme-display text-3xl ... sm:text-4xl`, which is too
  dominant for a compact authenticated governance surface.

Recommended direction:

- Move the stable page identity into the second column header.
- Make the main content header contextual to the selected media item.
- Replace the large global heading with a smaller object/detail heading or a
  compact selected-state label.

### 2. Summary totals are too large and occupy the wrong layer

The four global totals, Stored media, Quota usage, Attached, and Unattached,
are rendered as full summary cards in the main canvas. They push the selected
media detail down and make the page feel like a dashboard.

Problem:

- These totals are global page state, not selected-object detail.
- They are visually heavier than the selected media asset.
- They create a large horizontal block that makes the page feel crowded at the
  top.

Likely code cause:

- `UserMediaWorkspace` renders the summary card grid in the main detail column:
  `sm:grid-cols-2 xl:grid-cols-4`.
- `StorageBudgetCard` is also rendered immediately after the summary grid, so
  global totals take two consecutive main-column bands before the asset detail.

Recommended direction:

- Move global totals into the second column as compact metrics or icon chips.
- Treat quota/storage as a collapsible or low-profile status block in the
  selector.
- Keep only selected-object facts in the main detail area.

Possible second-column treatment:

```text
Media
1 asset      1 attached
0 unattached 0% quota
```

Or:

```text
[asset icon] 1
[link icon] 1
[trash/safe-delete icon] 0
[storage ring] 0%
```

### 3. The second-column filter stack is too dense

The screenshot shows search, four selects, Apply filters, and Reset crowded
into the second column. The controls are visually equal to the media object
itself, which makes the actual selection less important.

Problem:

- The filter controls dominate the selector.
- Two-column select controls are too narrow and visually noisy.
- Reset appears as a competing action beside Apply filters.
- The user cannot quickly answer: "Which media item am I inspecting?"

Likely code cause:

- `MediaFilterForm` renders all advanced filters inline:
  `grid grid-cols-2`.
- Filter controls are always visible instead of being hidden behind a filter
  icon/sheet.

Recommended direction:

- Keep only search visible in the second column.
- Move Type, Source, Retention, and Attachment state into a filter popover or
  sheet.
- Use one compact filter icon button next to search, matching the People page
  spec.
- Show active filters as tiny removable chips only when filters are applied.

### 4. The selected media row overflows the column visually

The selected asset row appears to intrude into the main content boundary. The
long generated filename and badge treatment make the card feel wider than the
second column.

Problem:

- The selector violates the rail boundary.
- The active card draws attention away from the main detail panel.
- Long machine filenames are not being humanized enough for this UX.

Likely code cause:

- Media rows render `item.fileName` as the primary title.
- The row contains a long filename, badge, metadata line, date, and file size.
- The current row minimum height and padding make a single asset look like a
  large card rather than a row.

Recommended direction:

- Introduce a humanized asset title for the row, falling back to a shortened
  filename only when no title exists.
- Use an icon/avatar marker for media type, similar to People rows.
- Move raw filename to secondary detail, tooltip, or main detail metadata.
- Add hard width safety: ensure row internals use `min-w-0`, aggressive
  truncation, and no child can exceed the second-column content box.

### 5. The selected media detail is too horizontal and too compressed

The audio player stretches across almost the entire main content width. The
metadata and policy note become thin horizontal strips. This is not a strong
object detail layout.

Problem:

- The selected asset does not feel like the focus of the page.
- The audio player dominates width but not meaning.
- Metadata is spread across too much horizontal space.

Likely code cause:

- `SelectedMediaDetail` renders a wide single card with header, preview, two
  column metadata, and delete/policy area.
- The main content column has no inner max width or object-centered content
  rhythm.

Recommended direction:

- Use an object detail layout:
  - compact object header;
  - preview block;
  - provenance/usage facts;
  - governed actions.
- Consider a two-column detail only at large desktop widths:
  - main: preview and selected object narrative;
  - side: storage, attachment, retention, actions.
- Keep the audio player width constrained enough to feel intentional.

### 6. Storage budget copy is implementation-facing

The storage budget line says `display-only budget for governed media in this
phase`. That is phase/project language, not product language.

Problem:

- Regular owner UI should not expose implementation phase language.
- The user wants to know if they are safe, close to a limit, or blocked.

Likely code cause:

- `quotaMessage(quota)` returns implementation-oriented copy.
- `StorageBudgetCard` exposes quota policy details as a first-class card.

Recommended direction:

- Replace phase language with product language:
  - "Storage is healthy."
  - "Uploads are still available."
  - "Storage is close to the warning level."
- Move deeper policy details to System/Admin if needed.

### 7. The page has too much empty footer-dominated space

The main content ends high on the page, then the footer occupies a large block
of the viewport. This makes the media workspace feel unfinished and small.

Problem:

- The functional surface does not fill the working area.
- The footer competes with application workspace pages.

Likely code cause:

- The media workspace content is shorter than the available shell height.
- The global site footer still renders under authenticated workspace routes.

Recommended direction:

- Decide whether authenticated governance pages should show the large public
  footer at all.
- If footer stays, make the workspace min-height stronger so the working
  surface carries the viewport.
- Prefer a compact app footer or no footer on deep authenticated work surfaces.

### 8. The route title still says "My Media"

The screenshot and code show the surface is still framed as personal media,
while the product direction has moved toward Studio objects and governed work.

Problem:

- "My Media" reads like a personal file cabinet.
- The product story is that Ordo creates governed assets with provenance.

Likely code cause:

- `src/app/my/media/page.tsx` metadata still uses `title: "My Media"`.
- The page route still lives under `/my/media`.

Recommended direction:

- Treat `/my/media` as a compatibility/account route, not a primary product
  destination.
- In product navigation, media should live under Studio as an object type.
- If this page remains, title it as an account-owned archive or asset
  inspector, not a main Studio surface.

### 9. Global overview and selected asset are stacked together

The latest screenshot shows global governed-asset totals rendered above the
selected asset detail. This is the core structural problem: the page is trying
to be an overview dashboard and an asset-detail page at the same time.

Problem:

- A user selecting one asset should see one asset page, not a global report
  repeated above the asset.
- Global totals are useful, but they belong in a default Overview state and in
  compact second-column status.
- The main content lacks a clear state model, so every selected asset inherits
  the same global heading and totals.

Likely code cause:

- `UserMediaWorkspace` renders the main heading, summary cards, storage budget,
  and selected media detail in one stacked flow.
- The second column only lists assets and filters; it does not include a
  first-class `Overview` selector item.

Recommended direction:

- Add an `Overview` pseudo-item to the second column.
- Make Overview the default state for global media totals and storage health.
- When an asset is selected, replace Overview with exactly one selected asset
  detail.
- Enforce a hard rule: the main content shows either Overview or one asset, but
  never both stacked together.

## Proposed UI Shape

### Second column

The second column should become the media control surface:

```text
Media
Overview
1 asset · 1 attached · 0 safe delete · 0% quota

Search media... [filter icon]

Audio
d59a...86.mp3
Generated · Conversation
May 4 · 1.2 MB
```

Rules:

- Search is visible.
- Advanced filters are hidden behind a filter icon.
- Metrics are compact, not cards.
- The asset row uses icon + title + tiny metadata.
- Long filenames never define the visual width of the row.

### Main content: Overview state

When Overview is selected, the main content should show global media health:

```text
Media overview
Storage healthy
1 governed asset
1 attached to conversations
0 safe deletion candidates

Recent assets
...
```

### Main content: Selected asset state

The main content should focus on the selected media object:

```text
Selected media
d59a...86.mp3
Audio · Generated · Attached

[audio preview]

Facts
Created        May 4 at 7:10 AM
Size           1.2 MB
Duration       1:18
Used by        Conversation

Governance
Attached media is locked.
[Open preview]
```

Rules:

- No large global heading in selected asset state.
- No large global metric grid above selected asset detail.
- Overview and selected asset content are mutually exclusive.
- Selected asset is the hero.
- Storage quota is present but subordinate.

## Fix Priority

1. Add a real Overview state in the second column.
2. Make Overview and selected asset detail mutually exclusive in the main
   content.
3. Move global totals and storage budget out of selected asset detail into
   Overview and compact second-column status.
4. Replace inline advanced filters with a filter icon/panel.
5. Demote or remove the large global heading.
6. Make the selected object the main content focus.
7. Humanize and truncate long media names in rows.
8. Remove implementation-phase copy from owner UI.
9. Reconsider the large public footer on authenticated work pages.

## Acceptance Criteria For Next Refactor

- The second column contains an Overview item, search, filter access, compact
  totals, and the media selection list.
- The default main column is Media overview.
- Selecting an asset replaces overview content with one selected asset detail.
- Summary totals do not appear as large main-column cards above selected asset
  detail.
- Long filenames cannot overflow or visually cross the second-column boundary.
- Advanced filters do not permanently occupy second-column height.
- Owner UI does not mention implementation phase language.
- The selected media object remains readable on desktop and mobile.
- The page visually aligns with People, Today, Studio, and System.

## Recommended Phase Name

`01c3ab-media-workspace-object-detail-and-selector-polish.md`

This should follow the existing `01c3u` shell alignment work and focus only on
the media workspace UI cleanup.
