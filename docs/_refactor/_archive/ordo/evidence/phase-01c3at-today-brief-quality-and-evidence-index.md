# Phase 01c3at Evidence: Today Brief Quality And Evidence Index

Date: 2026-05-06

Status: Implemented

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- Today is an owner daily brief and evidence index, not a jobs dashboard.
- Base `/workspace` renders the Today brief.
- Query-selected Today routes render one selected evidence item.
- The second column is the decision/evidence selector.
- Owner Today must not render raw job ids, payloads, providers, logs, queue
  internals, operation ids, or unsupported intelligence.
- Placeholders and limitations must be deterministic, explicit, and
  replaceable.

## Code Files Changed

- `src/lib/dashboard/today-brief-read-model.ts`
- `src/lib/dashboard/load-user-dashboard.ts`
- `src/components/dashboard/UserDashboard.tsx`
- `src/components/ordo-cards/OrdoCard.tsx`
- `src/lib/dashboard/today-brief-read-model.test.ts`
- `src/components/dashboard/UserDashboard.test.tsx`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3at-today-brief-quality-and-evidence-index.md`
- `docs/_refactor/ordo/evidence/phase-01c3at-today-brief-quality-and-evidence-index.md`

## Implementation Evidence

`TodayBriefReadModel` now carries `kindLabel` for evidence refs. Raw source
kinds remain available to the read model for source identity and searching, but
the owner UI renders owner-safe labels such as `Work record`, `Studio work`,
`Media record`, `Saved output`, and `Shared link`.

Today owner copy now sanitizes raw job ids, standalone job language,
queue/queued language, payload language, provider/log language, and operation
references before building item titles, summaries, and Ask Ordo prompts.

Watch/current-state copy now describes work as moving in the background instead
of telling the owner to manage a queue. The system-health summary uses the same
owner-safe language.

Selected Today details still render one object and now show the Ask Ordo prompt
when Ask Ordo is the recommended action, preserving the chat-first operating
path while keeping evidence/source links inspectable.

`OrdoCard` now renders `operation` cards as `Work` and maps `queued`/`running`
status chips to owner-safe status labels.

## QA Pass 1

Commands run:

```bash
npx vitest run src/lib/dashboard/today-brief-read-model.test.ts src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/components/ordo-cards/OrdoCard.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/lib/dashboard/today-brief-read-model.ts src/lib/dashboard/load-user-dashboard.ts src/components/dashboard/UserDashboard.tsx src/components/ordo-cards/OrdoCard.tsx
rg -n "job id|payload|provider|queue|raw log|fake|sample|coming soon|Activity|Operations" src/lib/dashboard src/components/dashboard src/components/ordo-cards
rg -n "Date\\.now\\(|Math\\.random\\(|toLocaleString\\(|toLocaleDateString\\(" src/lib/dashboard src/components/dashboard src/components/ordo-cards
curl -I --max-time 2 http://localhost:3000/workspace
```

Results:

- Required phase tests passed: 4 files, 20 tests.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.
- Date/hydration static scan returned no matches.
- Diagnostic static scan matches were reviewed. Remaining matches are
  non-rendered test fixtures, TypeScript type names, sanitizer patterns, and
  action metadata access; owner-facing Today render tests assert no provider,
  raw log, job ids, `/jobs`, or `/my/media` links appear.
- Local `/workspace` returned `307 Temporary Redirect` to `/install`, so
  authenticated visual screenshot capture was not available in this shell
  context.

Issues found and fixed:

- Evidence refs rendered raw source kinds such as `job`; added owner-safe
  `kindLabel` rendering.
- Watch copy referred to queue management; replaced it with background work
  language.
- Ask Ordo prompts were built from unsanitized card titles; prompts now use
  sanitized titles.
- Generic card status/kind labels could expose `operation`, `queued`, and
  `running` language; card labels now use owner-safe terms.

## Visual QA

The dev server is reachable, but `/workspace` redirects to `/install` without a
usable authenticated session in this shell context. Browser-use tooling also did
not expose the required Node REPL control surface in this session. Screenshot
capture was therefore deferred, and DOM/unit/static evidence was used.

## QA Pass 2

Commands run:

```bash
npx vitest run src/lib/dashboard/today-brief-read-model.test.ts src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/components/ordo-cards/OrdoCard.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/lib/dashboard/today-brief-read-model.ts src/lib/dashboard/load-user-dashboard.ts src/components/dashboard/UserDashboard.tsx src/components/ordo-cards/OrdoCard.tsx
rg -n "job id|payload|provider|queue|raw log|fake|sample|coming soon|Activity|Operations" src/lib/dashboard src/components/dashboard src/components/ordo-cards
rg -n "Date\\.now\\(|Math\\.random\\(|toLocaleString\\(|toLocaleDateString\\(" src/lib/dashboard src/components/dashboard src/components/ordo-cards
```

Results:

- Required phase tests passed again: 4 files, 20 tests.
- Typecheck passed again.
- CSS lint passed again.
- Focused lint passed again.
- Date/hydration static scan returned no matches again.
- Diagnostic static scan matches were reviewed again. Remaining matches are
  non-rendered test fixtures, TypeScript type names, sanitizer patterns, and
  action metadata access; owner-facing Today render tests assert no provider,
  raw log, job ids, `/jobs`, or `/my/media` links appear.

Issues found and fixed:

- None.
