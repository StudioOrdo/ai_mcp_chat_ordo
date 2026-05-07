# Phase 01c3z Evidence: Relationship Settings And People Shell Closeout

Status: Implemented

Evidence date: 2026-05-05

## Governing Contract

Contract:

- `docs/_business/ux/08-product-kernel-contract.md`

Invariant:

- Chat is the operating interface.
- UI surfaces are the governance layer.

This phase closes the first People + shell implementation by keeping the
People detail focused on relationship evidence while adding a small subordinate
settings card.

## Code Changes

People surface:

- `src/components/business/BusinessWorkspace.tsx`
- `src/components/business/BusinessWorkspace.test.tsx`

Shell and account regression coverage:

- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/SiteNav.test.tsx`
- `src/components/AccountMenu.test.tsx`

Browser/mobile proof:

- `tests/browser-ui/business-workspace.spec.ts`

Docs:

- `docs/_refactor/ordo/phases/01c3z-relationship-settings-and-people-shell-closeout.md`
- `docs/_refactor/ordo/evidence/phase-01c3z-relationship-settings-and-people-shell-closeout.md`

## Behavior Implemented

- Added a Relationship settings card to the selected People detail.
- Settings sit beside Relationship Trail on wide viewports and move below the
  main relationship evidence stack on constrained/mobile viewports.
- Relationship role renders as a disabled selector.
- Affiliate renders as a disabled toggle.
- Controls reflect current derived state without creating an unsafe mutation
  path.
- The settings card links back to chat/conversation:
  - `Discuss in conversation` when the person has a primary conversation;
  - `Ask Ordo in chat` when the person does not.
- Regular owner People UI does not expose:
  - commission controls;
  - payment/checkout controls;
  - Jobs/Operations/Logs navigation;
  - raw job, operation, provider, or donor table labels.
- Mobile browser smoke now verifies:
  - People workspace loads for a signed-in owner;
  - mobile owner rail exposes Today, Studio, People, Offers, About;
  - mobile account menu opens and exposes user-owned surfaces.

## Grounding Decisions

- No role or affiliate write action was added.
- `relationshipRole` and `affiliate` are derived by
  `src/lib/business/people-read-model.ts`.
- Current affiliate mutation is account/admin scoped, so mutating it from a
  selected person would cross the current role/access boundary.
- This phase therefore treats settings as governance evidence and uses chat as
  the operating interface for changes.
- The People read model did not need a code change in this pass.

## QA Pass 1

Focused phase tests:

```bash
npx vitest run src/components/business/BusinessWorkspace.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/AccountMenu.test.tsx src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts 'src/app/business/people/[personId]/page.test.tsx'
```

Initial result:

- Failed, then passed after fix.

Issue found and fixed:

- The new Relationship settings card intentionally introduced a second
  `Relationship role` control. The existing filter test queried globally and
  now matched both the filter and the settings card.
  - Fix: scoped the filter assertions to the People filter sheet.

Focused rerun result:

- Passed. 7 files, 46 tests.

Related object/detail tests:

```bash
npx vitest run src/lib/ordo-details/ordo-detail-projectors.test.ts src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/load-business-object-detail.test.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/components/ordo-cards/OrdoCard.test.tsx
```

Result:

- Passed. 5 files, 44 tests.

Typecheck:

```bash
npm run typecheck
```

Result:

- Passed.

Focused lint:

```bash
npx eslint src/components/business/BusinessWorkspace.tsx src/components/business/BusinessWorkspace.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/AccountMenu.test.tsx tests/browser-ui/business-workspace.spec.ts
```

Result:

- Passed.

Browser/mobile smoke:

```bash
npx playwright test tests/browser-ui/business-workspace.spec.ts
```

Result:

- Passed. 1 test.

Build warnings observed during Playwright web server startup:

- Existing Turbopack broad file pattern warnings in `src/lib/user-files.ts`,
  `src/lib/appliance/native/native-binary-registry.ts`, and `next.config.ts`.
- These warnings pre-existed this phase and are unrelated to the People shell
  changes.

Static scans:

```bash
rg -n '"Jobs"|>Jobs<|"Operations"|>Operations<|"Logs"|>Logs<|commission|checkout|payment|job_events|operation_events|providerModel|provider logs' src/components/business src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!*.test.tsx'
```

Result:

- No hits.

```bash
rg -n '<script|Date\.now\(|Math\.random\(|toLocale|new Intl\.DateTimeFormat' src/components/business/BusinessWorkspace.tsx src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx src/components/AccountMenu.tsx
```

Result:

- No hits.

```bash
rg -n 'coming soon|Coming soon|commission|checkout|payment|job_|operation_|provider|raw log|diagnostic' src/components/business/BusinessWorkspace.tsx src/lib/business/people-read-model.ts -g '*.ts' -g '*.tsx'
```

Result:

- No hits.

## QA Pass 2

Focused phase tests rerun:

```bash
npx vitest run src/components/business/BusinessWorkspace.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/AccountMenu.test.tsx src/lib/business/people-read-model.test.ts src/lib/business/load-business-workspace.test.ts 'src/app/business/people/[personId]/page.test.tsx'
```

Result:

- Passed. 7 files, 46 tests.

Related object/detail tests rerun:

```bash
npx vitest run src/lib/ordo-details/ordo-detail-projectors.test.ts src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/load-business-object-detail.test.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/components/ordo-cards/OrdoCard.test.tsx
```

Result:

- Passed. 5 files, 44 tests.

Typecheck, lint, browser smoke, and static scans:

- Passed.

Typecheck:

```bash
npm run typecheck
```

Result:

- Passed.

Focused lint:

```bash
npx eslint src/components/business/BusinessWorkspace.tsx src/components/business/BusinessWorkspace.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/SiteNav.test.tsx src/components/AccountMenu.test.tsx tests/browser-ui/business-workspace.spec.ts
```

Result:

- Passed.

Browser/mobile smoke:

```bash
npx playwright test tests/browser-ui/business-workspace.spec.ts
```

Result:

- Passed. 1 test.
- Existing Turbopack broad file pattern warnings appeared again during web
  server startup; no new warning was introduced by this phase.

Static scans rerun:

```bash
rg -n '"Jobs"|>Jobs<|"Operations"|>Operations<|"Logs"|>Logs<|commission|checkout|payment|job_events|operation_events|providerModel|provider logs' src/components/business src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!*.test.tsx'
```

Result:

- No hits.

```bash
rg -n '<script|Date\.now\(|Math\.random\(|toLocale|new Intl\.DateTimeFormat' src/components/business/BusinessWorkspace.tsx src/components/AuthenticatedWorkRail.tsx src/components/SiteNav.tsx src/components/AccountMenu.tsx
```

Result:

- No hits.

```bash
rg -n 'coming soon|Coming soon|commission|checkout|payment|job_|operation_|provider|raw log|diagnostic' src/components/business/BusinessWorkspace.tsx src/lib/business/people-read-model.ts -g '*.ts' -g '*.tsx'
```

Result:

- No hits.

Issues found and fixed:

- None in QA pass 2.

## Deferred Work

- Add a durable person-level relationship settings model before enabling write
  controls for relationship role or affiliate status.
- Keep donor routes directly addressable until a later cleanup phase deletes or
  rehomes them.
