# Phase 01c3ag Evidence: Today Brief And Decision Evidence Index

Date: 2026-05-06

Status: Implemented

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- The Today base route is interpretation, not a raw dashboard stream.
- The second column is an evidence/object selector, not a dashboard.
- Selected Today details render one object and do not repeat global totals.
- Regular owner UI must not expose raw jobs, logs, providers, command payloads,
  restore paths, or fake metrics.

## Code Files Changed

- `src/app/workspace/page.test.tsx`
- `src/components/dashboard/UserDashboard.tsx`
- `src/components/dashboard/UserDashboard.test.tsx`
- `src/components/governance/GovernanceSectionFrame.tsx`
- `src/lib/dashboard/today-brief-read-model.ts`
- `src/lib/dashboard/today-brief-read-model.test.ts`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3ag-today-brief-and-decision-evidence-index.md`
- `docs/_refactor/ordo/evidence/phase-01c3ag-today-brief-and-decision-evidence-index.md`

## What Changed

- Added a deterministic Today read model with intent-based items:
  `decide`, `watch`, `inspect`, `learn`, and `fix`.
- Reworked `/workspace` so the base route renders `Today Brief` instead of
  stacked dashboard bucket blocks.
- Reworked the Today second column into a searchable/filterable evidence index
  powered by `GovernanceSectionFrame`.
- Reworked selected Today detail state into a single object detail with:
  - why this is on Today,
  - current state,
  - recommended action,
  - evidence references,
  - source links.
- Kept completed outputs out of the Decision bucket unless explicit owner
  judgment remains.
- Classified failed/blocked activity from durable activity source status before
  generic card status normalization.
- Sanitized raw `job_*`, log, and provider language from owner-facing Today
  copy.
- Sanitized owner-facing Today evidence/action routes so regular owner UI does
  not link to raw `/jobs`, `/admin`, `/factory`, `/operations`, or donor
  `/my/media` routes. Media donor links now route to Studio media details, and
  media workflow job routes now route to Studio workflow details.
- Added an accessible section label to `GovernanceSectionFrame` for the active
  governance surface.

## Today Read Model Contract

- `nextActionCards` -> `decide`
- failed, blocked, or critical attention items -> `fix`
- other attention items -> `decide`
- current work -> `watch`
- recent completed outputs -> `inspect`
- result cards and business-loop evidence -> `learn`
- weak signals -> `fix`

The deterministic brief chooses the first available recommended action in this
order:

1. `decide`
2. `fix`
3. first remaining item
4. first Ask Ordo prompt

## Route Evidence

- Before state: phase grounding and stale tests showed `/workspace` rendering
  full dashboard buckets such as `do-today`, `making-progress`,
  `ready-to-inspect`, `results`, `not-working`, and `business-loop`.
- After state: component and route tests verify the base route renders
  `Today Brief`, renders the Today evidence index, and no longer renders
  `[data-dashboard-block]` or `[data-ordo-card]` on the base route.
- Mobile/list-detail behavior is covered by `GovernanceSectionFrame` state
  attributes and the Today selected-detail back link.

## QA Pass 1

Commands run:

```bash
npm run test -- src/components/dashboard/UserDashboard.test.tsx src/lib/dashboard/today-brief-read-model.test.ts src/lib/dashboard/load-user-dashboard.test.ts src/app/workspace/page.test.tsx
npx eslint src/components/dashboard/UserDashboard.tsx src/components/dashboard/UserDashboard.test.tsx src/lib/dashboard/today-brief-read-model.ts src/lib/dashboard/today-brief-read-model.test.ts src/components/governance/GovernanceSectionFrame.tsx src/app/workspace/page.test.tsx
npm run typecheck
```

Results:

- Focused phase tests passed after fixes: 4 files, 16 tests.
- Focused lint passed.
- Typecheck initially failed, then passed after the hidden-field type fix.

Issues found and fixed:

- Failed or blocked activity could remain under `decide` after generic card
  normalization. Fixed the Today read model to classify failed/blocked source
  activity as `fix`.
- Owner-facing Today selected details could still inherit raw `/jobs` and donor
  `/my/media` links from underlying activity/card refs after copy was
  sanitized. Fixed the Today read model to project only owner-safe links before
  React renders evidence, source links, and recommended actions.
- Brief copy produced incorrect singular grammar (`1 item need`, `1 item look`).
  Fixed the read-model bullet grammar.
- Selected detail tests assumed unique source-link labels; the detail correctly
  exposes both recommended action and source-link buttons. Updated tests to
  assert the first matching action without weakening route checks.
- Typecheck could not narrow nullable hidden-field entries in
  `UserDashboard.tsx`. Fixed the helper with an explicit
  `Array<GovernanceHiddenField | null>` intermediate.

## QA Pass 2

Commands run:

```bash
npm run test -- src/components/dashboard/UserDashboard.test.tsx src/lib/dashboard/today-brief-read-model.test.ts src/lib/dashboard/load-user-dashboard.test.ts src/app/workspace/page.test.tsx
npm run typecheck
npx eslint src/components/dashboard/UserDashboard.tsx src/components/dashboard/UserDashboard.test.tsx src/lib/dashboard/today-brief-read-model.ts src/lib/dashboard/today-brief-read-model.test.ts src/components/governance/GovernanceSectionFrame.tsx src/app/workspace/page.test.tsx
rg -n -P "Good to see you|data-dashboard-block|making-progress|ready-to-inspect|not-working|business-loop|No active background work|No completed outputs|No measured result yet|No weak signals yet|Open job|raw job|raw log|Provider failed|job_(?!event\\b)[0-9A-Za-z-]+|ROI|\\$1,000" src/components/dashboard/UserDashboard.tsx src/app/workspace/page.tsx src/components/governance/GovernanceSectionFrame.tsx src/lib/dashboard/today-brief-read-model.ts
rg -n -P "href=\\\"/jobs|href=\\\"/my/media|/jobs\\?|/my/media\\?|Open job|Provider failed|raw log|job_(?!event\\b)[0-9A-Za-z-]+" src/components/dashboard/UserDashboard.tsx src/lib/dashboard/today-brief-read-model.ts src/app/workspace/page.tsx
```

Results:

- Focused phase tests passed: 4 files, 16 tests.
- Typecheck passed.
- Focused lint passed.
- Owner-facing Today/static stale-surface scan returned no matches.
- Raw route/static leakage scan returned no matches after excluding the internal
  `job_event` source-kind key from the raw job-id pattern.

Issues found and fixed:

- QA pass 2 found no new implementation issues.

## Remaining Risks

- This phase intentionally keeps Today Brief deterministic and in-memory. Durable
  brief storage and background reconciliation are deferred to `01c3am`.
- Browser screenshots were not newly captured in this pass; route evidence is
  covered by component/route tests and stale-surface scans.
