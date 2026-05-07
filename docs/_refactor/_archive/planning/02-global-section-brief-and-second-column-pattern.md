# Spec 02: Global Section Brief And Second-Column Pattern

Status: Draft spec

Evidence date: 2026-05-05

## Problem

People has the right mental model. Other surfaces still mix overview metrics,
object lists, and selected details in inconsistent ways.

The current Studio/media examples show the problem clearly:

- global governed asset metrics appear above a selected asset,
- selected object detail is forced to compete with section-level totals,
- the second column sometimes contains filters and sometimes contains
  categories,
- Today now has a second-column selector, but the main pane still repeats
  dashboard categories instead of interpreting them as a brief,
- System has a partial selector on `/admin` but not throughout deeper system
  routes.

## Current Code Anchors

Best current pattern:

- `src/components/business/BusinessWorkspace.tsx`
- `src/lib/business/load-business-workspace.ts`

Partial adopters:

- `src/components/studio/StudioWorkspace.tsx`
- `src/app/admin/page.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`

Pages needing convergence:

- `src/components/dashboard/UserDashboard.tsx`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/app/admin/system/page.tsx`
- `src/app/admin/system/backups/BackupSelfServiceManager.tsx`
- `src/components/offers/OfferSurfaces.tsx`

## Target Pattern

Every authenticated major section uses this model:

```text
Left rail | Second column selector | Main pane
```

Base section route:

```text
/studio
/workspace
/business
/offers
/admin
/admin/system
```

shows:

- section brief in main pane,
- second column overview card at top,
- search/filter/list below.

Selected object route:

```text
/studio?object=...
/business?person=...
/offers?offer=...
/workspace?object=...
/admin/system?section=backups&backup=...
```

shows:

- one selected object detail in the main pane,
- second column remains selector and context,
- section-wide totals move into second-column overview or a compact main-pane
  secondary area only on the base route.

## Section Brief Contract

A section brief is the default page for a section.

It answers:

1. What matters in this section right now?
2. What changed recently?
3. What needs the owner's decision?
4. What is moving?
5. What is worth inspecting?
6. What should Ordo do next?

Briefs must be evidence-backed.

Briefs must not invent metrics. If data is missing, say it is not measured yet.

## Second Column Contract

Second column includes:

- compact section label and one-sentence guidance,
- optional overview tile summarizing counts/status,
- search field,
- filter icon or filter sheet,
- object list,
- footer count/pagination.

Second column must not become a dashboard.

It is a selector and evidence index.

## Main Pane Contract

Main pane shows either:

- section brief, or
- selected object detail.

Selected object detail must avoid repeating section-wide overview metrics.

Detail panes should include:

- title and type,
- status/stage/visibility,
- one primary action,
- factual summary,
- evidence/provenance/relationship trail,
- related objects,
- owner-safe next actions.

## Mobile Contract

Mobile behavior:

- hamburger opens main navigation,
- second-column list is the section list screen,
- selecting an item opens the detail screen,
- detail screen has a mobile back button to return to the list,
- base route shows the section brief first or lets the user quickly switch to
  list depending on section.

Do not squeeze left rail, second column, and detail into one mobile screen.

## Section-Specific Mapping

Today:

- second column lists all Today items with explicit intent:
  - Decide,
  - Watch,
  - Inspect,
  - Learn,
  - Fix.
- main pane base route shows the Today Brief.
- selected item shows one object with:
  - why it is on Today,
  - what evidence put it there,
  - what Ordo recommends,
  - one primary owner action,
  - source links to People, Studio, Offers, or System.
- completed/succeeded work is not a `Decision` unless the owner still needs to
  approve, publish, inspect, send, retry, or choose something.
- raw job, backup, restore, provider, and log details stay in System; Today
  only shows owner-safe translations such as `Backup failed`, `Restore needs
  confirmation`, or `Output ready to inspect`.

Studio:

- second column lists all work/media/content/campaign objects.
- main pane base route shows Production Brief.
- selected media shows one media asset with player/preview and provenance.
- selected workflow/job shows work detail and related outputs.

People:

- keep current pattern.
- continue improving mobile drill-in and relationship detail.

Offers:

- second column lists public, private, draft, sent, purchased offers.
- main pane base route shows Offer Brief.
- selected offer shows price, visibility, audience, performance, and actions.

System:

- second column lists Overview, Health, Providers, Capabilities, Backups,
  Restore Plans, Visibility, Tools, Jobs, Operations.
- main pane base route shows System Brief.
- selected section shows a compact page-specific panel or table.

Account:

- second column lists User info, My Referrals, Preferences.
- main pane shows selected account section.
- mobile selection opens detail with back button.

## Acceptance Criteria

- Every major authenticated surface uses the same left rail, second column, and
  main pane layout.
- Base route shows a section brief, not a selected item by accident.
- Selecting an item shows one object detail without global totals at the top.
- Mobile supports list-to-detail navigation with a clear back control.
- Search/filter affordances are consistent across People, Studio, Today,
  Offers, System, and Account.
- A base-route main pane never repeats every second-column bucket as stacked
  dashboard blocks.
- A selected object detail never starts with section-wide totals.
- Today default copy uses brief language, not greeting-first dashboard copy.
- Today item labels describe the decision intent, not raw status alone.

## Tests

Positive:

- base route renders brief state.
- query-selected route renders selected detail state.
- second column shows search/filter/list.
- mobile selected detail renders a back-to-list control.

Negative:

- selected detail does not render section-wide metric cards as the top visual.
- owner UI does not expose raw job ids, provider keys, raw logs, or diagnostic
  terms unless inside admin/system.

Edge:

- empty section renders an empty brief and empty list.
- a selected item missing or unauthorized falls back to the brief with a quiet
  message.
- query params preserve filters when selecting an object.
