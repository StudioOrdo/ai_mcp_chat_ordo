# Phase 01c3at: Today Brief Quality And Evidence Index

Status: Implemented

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Tighten Today into a CEO daily brief with a clean decision/evidence index,
icon-led decision rows, one obvious next action per item, and no diagnostic
leakage.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/04-owner-intelligence-brief-surfaces.md`

## Current Code Grounding

Code anchors:

- `src/app/workspace/page.tsx`
- `src/lib/dashboard/load-user-dashboard.ts`
- `src/lib/dashboard/today-brief-read-model.ts`
- `src/components/dashboard/UserDashboard.tsx`
- `src/components/ordo-cards/OrdoCard.tsx`
- `src/lib/activity/*`
- `src/lib/jobs/*`
- `src/lib/business/people-read-model.ts`
- `src/lib/studio/load-studio-workspace.ts`

## Verified Current State

- Today already uses `GovernanceSectionFrame`.
- `TodayBriefReadModel` already projects owner-safe Today items and scrubs raw
  job/provider/log language.
- Today items have intents: decide, watch, inspect, learn, fix.
- The second column already supports search and intent filter.
- Some card/action copy can still feel like a job dashboard instead of a brief.
- Implemented pass verified the remaining drift was concentrated in owner copy
  and evidence labels: queue/running/provider/job/source-kind language could
  still appear through Today projections or source ref metadata.

## Target Behavior

- Base `/workspace` renders a high-signal Today brief.
- Second column lists decisions and evidence items with meaningful icons.
- Each row has one obvious action or chat prompt.
- Selected item detail answers why it matters, current state, recommended
  action, evidence, and source links.
- No raw job/log/provider details appear in owner Today.

## Implementation Steps

1. Audit Today read model item construction for copy, icons, and links.
2. Improve icon labels/status labels where the source type is known.
3. Ensure each item has one primary recommended action.
4. Tighten brief bullets and limitations.
5. Add tests for no raw diagnostics and no fake metrics.
6. Update evidence docs.

Implemented:

1. Added owner-safe evidence kind labels to the Today read model so source
   kinds like `job` remain internal evidence metadata and render as labels such
   as `Work record`.
2. Tightened Today copy sanitization for job ids, standalone job language,
   queue/queued wording, provider/log/payload wording, and operation references.
3. Made Ask Ordo prompts use sanitized item titles.
4. Reframed Today current-state copy so watch items say they are moving in the
   background instead of exposing queue management language.
5. Rendered the selected item's recommended chat prompt when the recommended
   action is Ask Ordo.
6. Adjusted generic Ordo card labels so operation cards render as `Work`, and
   queued/running states render as owner-safe labels.

## Positive Tests

- Today base brief renders counts, bullets, limitations when needed, and
  recommended action.
- Second column rows show icon label, intent, title, summary, and updated date.
- Selected detail renders why/current state/recommended action/evidence/source
  links.
- Owner-safe source links point to People, Studio, Offers, or System/Admin only
  when authorized.

## Negative Tests

- Today owner UI does not show raw job ids, payloads, providers, logs, queue
  internals, or diagnostic nouns as primary copy.
- No fake metrics or unsupported claims render.
- Decision rows do not expose admin-only links to non-admin users.

## Edge Tests

- Empty dashboard renders a limited Today brief.
- One item selected on mobile renders detail with back link.
- Missing selected item renders shared missing state.
- Admin-only source link is omitted or translated for owner users.
- Stable dates do not trigger hydration mismatches.

## Acceptance Criteria

- Today is an owner brief, not an activity dashboard.
- Decision/evidence index is scannable and icon-led.
- Every Today claim links to evidence or states a limitation.

## Non-Goals

- No new scheduler.
- No new LLM brief executor wiring.
- No admin jobs redesign.

## Required Commands

```bash
npx vitest run src/lib/dashboard/today-brief-read-model.test.ts src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/components/ordo-cards/OrdoCard.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/lib/dashboard/today-brief-read-model.ts src/lib/dashboard/load-user-dashboard.ts src/components/dashboard/UserDashboard.tsx src/components/ordo-cards/OrdoCard.tsx
```

## Static Scans

```bash
rg -n "job id|payload|provider|queue|raw log|fake|sample|coming soon|Activity|Operations" src/lib/dashboard src/components/dashboard src/components/ordo-cards
```

## Closeout Evidence Required

- Today desktop and mobile screenshots.
- Test output proving owner-safe copy.
- Evidence notes for each changed Today item projector.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3at-today-brief-quality-and-evidence-index.md`
