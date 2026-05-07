# 02 UI Surface Realignment: Shared Surface Frame Contract

Status: Draft spec

## Goal

Define one shared surface frame contract for authenticated governance surfaces:
base routes render a section brief, the second column selects evidence or
objects, and selected routes render exactly one selected object detail.

## Current Code Grounding

Current anchors:

- `src/components/governance/GovernanceSectionFrame.tsx`
- `src/components/governance/GovernanceSectionFrame.test.tsx`
- `src/core/entities/brief.ts`
- `src/core/entities/ordo-object.ts`
- `src/components/dashboard/UserDashboard.tsx`
- `src/components/studio/StudioWorkspace.tsx`
- `src/components/business/BusinessWorkspace.tsx`
- `src/components/offers/OfferSurfaces.tsx`
- `src/components/about/AboutSurfaces.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`
- `src/components/admin/system/AdminSystemWorkspace.tsx`

## Verified Current State

- `GovernanceSectionFrame` already accepts a `GovernanceSectionModel`, selector
  config, brief renderer, detail renderer, empty states, hidden fields, filters,
  and mobile back labels.
- Today, Studio, Offers, About, and System already use
  `GovernanceSectionFrame`.
- People uses the same shared frame pattern through `BusinessWorkspace`.
- Account uses `GovernanceSectionFrame` through `ProfileSettingsPanel`.
- `/my/media` has a custom media selector/detail frame instead of the shared
  frame. It is a donor for Studio, not the canonical destination.
- Some surfaces still expose compact metric summaries in the main pane. This is
  acceptable only on base section briefs, not selected object details.

## Target Behavior

Every canonical owner/admin section follows this shape:

```text
Left rail | Second-column selector | Main pane
```

Base route:

- second column shows overview, search, filters, list, footer count;
- main pane renders an evidence-backed section brief;
- if no brief exists, show an honest deterministic placeholder with
  limitations.

Selected route:

- second column remains selectable;
- main pane renders one selected object detail;
- global metrics and section totals do not appear above the selected object;
- selected detail links to provenance, relationship trail, source detail,
  visibility, and actions where evidence exists.

Mobile:

- list and detail are separate states;
- detail includes a back-to-list control;
- second-column filters use sheet/popover semantics with accessible labels.

## Reuse / Move / Hide / Mock Decisions

- Reuse `GovernanceSectionFrame` as the default for Today, Studio, People,
  Offers, About, Account, System, and future Knowledge Base.
- Move `/my/media` selector behavior into Studio instead of preserving a second
  independent frame.
- Keep admin diagnostics inside System/Admin detail renderers.
- Mock only the `brief` or `overview` with deterministic empty placeholders
  when the real read model is missing.

## Positive Tests

- Each canonical section renders the shared frame root data attribute.
- Base route renders a brief panel or honest limited placeholder.
- Selected detail hides section-wide metric strips.
- Selector search, filters, selected row, and footer render for each section.
- Mobile detail state renders a back-to-list control.

## Negative Tests

- Owner selected details do not render raw job ids, provider ids, logs, payloads,
  command internals, or diagnostics as primary copy.
- Components do not derive product meaning directly from raw table/job/log
  internals.
- Custom layout forks are not introduced unless a phase documents why the
  shared frame cannot support the surface.

## Edge Tests

- Missing selected object renders the shared missing-detail state.
- Empty selector list renders an honest empty state.
- Filter-only query with no selected object still shows the section brief.
- Mobile first render for a selected object starts in detail state and exposes
  back navigation.
- Admin System can render diagnostics while owner surfaces remain scrubbed.

## Acceptance Criteria

- A new canonical owner surface can be created by supplying a read model and
  selector/detail renderers to `GovernanceSectionFrame`.
- Surface-specific components stay thin and render product read models.
- Shared frame CSS owns rail/second-column/main alignment.
- Selected object details never start with global totals.

## Non-Goals

- No replacement of `GovernanceSectionFrame`.
- No mandate that public marketing pages use the owner governance frame.
- No new brief executor work in this frame contract.

## Required Commands

```bash
npx vitest run src/components/governance/GovernanceSectionFrame.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx
npm run typecheck
npm run lint -- src/components/governance/GovernanceSectionFrame.tsx src/components/dashboard/UserDashboard.tsx src/components/studio/StudioWorkspace.tsx src/components/business/BusinessWorkspace.tsx src/components/offers/OfferSurfaces.tsx src/components/about/AboutSurfaces.tsx src/components/profile/ProfileSettingsPanel.tsx src/components/admin/system/AdminSystemWorkspace.tsx
rg -n "global|total|quota|stored media|jobs|operation|provider|payload|log" src/components
```

## Closeout Evidence Required

- Component inventory showing which canonical sections use the shared frame.
- Screenshot evidence for desktop and mobile list/detail for at least Today,
  Studio, People, and System.
- Static scan proving selected owner details do not show global totals first.
- Test output for all touched frame consumers.
