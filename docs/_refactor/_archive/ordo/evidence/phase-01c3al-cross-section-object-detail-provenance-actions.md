# Phase 01c3al Evidence: Cross-Section Object Detail, Provenance, And Actions

Date: 2026-05-06

## Scope

Implemented the shared object-detail governance contract across the existing
Ordo detail layer:

- object details now have shared badges, header facts, primary actions, source
  links, evidence links, lens sections, timelines, and admin diagnostic links;
- media and workflow detail projectors preserve provenance refs while keeping
  raw job diagnostics out of normal owner links/cards;
- offer details now project into the shared detail model with visibility,
  provenance, performance, related, and activity lenses;
- System sections now project into the shared detail model with admin
  diagnostics gated by caller permission;
- Studio loaders pass staff/admin diagnostic permission into detail projectors.

## Files Changed

- `src/core/entities/ordo-object.ts`
- `src/components/ordo-cards/OrdoCard.tsx`
- `src/components/studio/StudioWorkspace.tsx`
- `src/lib/dashboard/today-brief-read-model.ts`
- `src/components/ordo-details/OrdoDetailLensTabs.tsx`
- `src/components/ordo-details/OrdoDetailLayout.tsx`
- `src/components/ordo-details/OrdoDetailLayout.test.tsx`
- `src/lib/ordo-details/index.ts`
- `src/lib/ordo-details/ordo-detail-types.ts`
- `src/lib/ordo-details/ordo-detail-projectors.ts`
- `src/lib/ordo-details/ordo-detail-projectors.test.ts`
- `src/lib/ordo-details/load-studio-object-detail.ts`
- `src/lib/ordo-details/load-studio-object-detail.test.ts`
- `src/lib/offers/load-offers-workspace.ts`
- `docs/_refactor/ordo/phases/01c3al-cross-section-object-detail-provenance-actions.md`
- `docs/_refactor/ordo/evidence/phase-01c3al-cross-section-object-detail-provenance-actions.md`

## Shared Detail Contract Evidence

- `OrdoObjectDetailModel` now includes:
  - `badges`;
  - `headerFacts`;
  - `primaryActions`;
  - `sourceLinks`;
  - `provenanceLinks`;
  - `adminDiagnostic`.
- `OrdoDetailLayout` renders these fields as shared primitives instead of
  leaving each section to invent its own selected-object detail structure.
- `OrdoDetailLayout` no longer renders legacy `diagnosticHref` directly.
  Diagnostic links are visible only when `adminDiagnostic` is present.
- Facts and timeline source links sanitize job/operation/admin/API hrefs from
  regular owner rendering.

## Cross-Section Evidence

- Media details:
  - link to workflow/conversation provenance when available;
  - render missing provenance as an explicit limitation state;
  - do not show raw job cards in regular owner detail.
- Workflow details:
  - keep linked jobs available for authorized admin diagnostics;
  - expose final artifact and conversation facts in owner-safe detail.
- People details:
  - keep Relationship Trail and Open conversation source actions intact.
- Offers:
  - project visibility, source conversation, offer events, tracked links, and
    measured link performance into `OrdoObjectDetailModel`.
- System:
  - projects sections as `system` objects;
  - exposes admin diagnostic links only for authorized admin viewers.

## Role And Privacy Boundary Evidence

- Regular owner detail receives durable provenance refs but does not render
  raw job routes as primary links.
- `loadStudioMediaDetail` and `loadStudioWorkflowDetail` pass
  `canViewAdminDiagnostics` based on `STAFF`/`ADMIN` roles.
- System section diagnostics require an explicit `canViewAdminDiagnostics`
  flag before `adminDiagnostic` or admin source actions render.

## QA Pass 1

Commands:

```bash
npx vitest run src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/ordo-detail-projectors.test.ts src/core/entities/ordo-object.test.ts src/lib/offers/load-offers-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx
npx vitest run src/lib/ordo-details/load-studio-object-detail.test.ts src/lib/ordo-details/load-business-object-detail.test.ts src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/dashboard/today-brief-read-model.test.ts src/components/ordo-cards/OrdoCard.test.tsx
npm run typecheck
npx eslint src/core/entities/ordo-object.ts src/components/ordo-details/OrdoDetailLayout.tsx src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/ordo-detail-types.ts src/lib/ordo-details/ordo-detail-projectors.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/ordo-details/load-studio-object-detail.ts src/lib/ordo-details/load-studio-object-detail.test.ts src/lib/offers/load-offers-workspace.ts src/components/ordo-cards/OrdoCard.tsx src/components/studio/StudioWorkspace.tsx src/lib/dashboard/today-brief-read-model.ts
rg -n "detail\\.diagnosticHref" src/components src/lib --glob '!**/*.test.ts' --glob '!**/*.test.tsx'
rg -n "detail\\.diagnosticHref|/jobs\\?jobId|providerModel|raw provider|provider log|raw job|job id" src/components/ordo-details src/lib/ordo-details src/components/studio src/components/business src/components/offers src/lib/offers --glob '!**/*.test.ts' --glob '!**/*.test.tsx'
```

Result:

- 5 focused test files passed.
- 26 focused tests passed.
- 7 related test files passed.
- 42 related tests passed.
- Typecheck passed.
- Focused lint passed after cleanup.
- Direct `detail.diagnosticHref` render scan found no implementation matches.
- Raw job/provider scan found only durable source refs inside the projector;
  `OrdoDetailLayout` sanitizes these refs from owner link rendering.

Issues found and fixed:

- Layout test needed to use an all-text assertion because owner-safe
  “Producing work” appears in both evidence links and the provenance lens.
- Workflow admin diagnostic expectation was updated to the existing diagnostic
  jobs URL.
- Public offer source links were deduping against the owner offer source; the
  public offer source ref now has a distinct source id.
- Studio loader tests were updated for the new diagnostic permission argument.
- Focused lint found an unused helper; it was removed.

## QA Pass 2

Commands:

```bash
npx vitest run src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/ordo-detail-projectors.test.ts src/core/entities/ordo-object.test.ts src/lib/offers/load-offers-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx
npx vitest run src/lib/ordo-details/load-studio-object-detail.test.ts src/lib/ordo-details/load-business-object-detail.test.ts src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/dashboard/today-brief-read-model.test.ts src/components/ordo-cards/OrdoCard.test.tsx
npm run typecheck
npx eslint src/core/entities/ordo-object.ts src/components/ordo-details/OrdoDetailLayout.tsx src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/ordo-detail-types.ts src/lib/ordo-details/ordo-detail-projectors.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/ordo-details/load-studio-object-detail.ts src/lib/ordo-details/load-studio-object-detail.test.ts src/lib/offers/load-offers-workspace.ts src/components/ordo-cards/OrdoCard.tsx src/components/studio/StudioWorkspace.tsx src/lib/dashboard/today-brief-read-model.ts
rg -n "detail\\.diagnosticHref" src/components src/lib --glob '!**/*.test.ts' --glob '!**/*.test.tsx'
rg -n "detail\\.diagnosticHref|/jobs\\?jobId|providerModel|raw provider|provider log|raw job|job id" src/components/ordo-details src/lib/ordo-details src/components/studio src/components/business src/components/offers src/lib/offers --glob '!**/*.test.ts' --glob '!**/*.test.tsx'
```

Result:

- 5 focused test files passed.
- 26 focused tests passed.
- 7 related test files passed.
- 42 related tests passed.
- Typecheck passed.
- Focused lint passed.
- Direct `detail.diagnosticHref` render scan found no implementation matches.
- Raw job/provider scan found the same durable job refs inside
  `ordo-detail-projectors.ts`; these are intentionally retained as provenance
  refs and are sanitized by `OrdoDetailLayout` before owner link rendering.

Issues found and fixed:

- No new QA pass 2 issues were found.

## Remaining Risks

- Offer detail now has a shared read model, but the current offer page still
  uses its purpose-built UI. A later phase can swap the page to
  `OrdoDetailLayout` once the offer selector/detail UX is ready.
- System section details have a shared read model and tests, but the current
  System page still uses its custom admin detail rendering to preserve the
  richer backup/restore manager.
- Durable job refs still exist inside provenance refs for evidence continuity;
  the layout sanitizes them from normal owner links.
