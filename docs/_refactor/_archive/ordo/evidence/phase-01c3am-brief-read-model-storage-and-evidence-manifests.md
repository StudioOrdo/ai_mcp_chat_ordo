# Phase 01c3am Evidence: Brief Read Model, Storage, And Evidence Manifests

Date: 2026-05-06

Status: Implemented

## Governing Contracts

- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`

Core invariant preserved:

> Chat is the operating interface. UI surfaces are the governance layer.

## Code Grounding

Confirmed current anchors before editing:

- `src/components/governance/GovernanceSectionFrame.tsx`
  - Existing base/detail section frame was reusable.
  - Briefs were component-local and rendered prose without durable manifest or
    limitation/evidence rendering.
- `src/lib/dashboard/today-brief-read-model.ts`,
  `src/lib/studio/load-studio-workspace.ts`,
  `src/lib/offers/load-offers-workspace.ts`,
  `src/lib/about/load-about-workspace.ts`, and
  `src/lib/admin/system/load-admin-system-workspace.ts`
  - Existing loaders already produce deterministic section briefs.
  - This phase kept those deterministic loaders and added a durable storage seam
    for the same brief contract.
- `src/adapters/BackupSystemCommandDataMapper.ts`,
  `src/adapters/BackupSnapshotDataMapper.ts`,
  `src/adapters/BackupRestoreAuditDataMapper.ts`, and
  `src/adapters/RestorePlanDataMapper.ts`
  - Existing backup/restore adapters model durable request/result/audit access.
  - Brief storage now follows the same durable snapshot/history direction
    without adding background execution yet.

## Implementation

Files changed:

- `src/core/entities/brief.ts`
- `src/core/entities/brief.test.ts`
- `src/adapters/BriefReadModelDataMapper.ts`
- `src/adapters/BriefReadModelDataMapper.test.ts`
- `src/adapters/RepositoryFactory.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`
- `src/components/governance/GovernanceSectionFrame.tsx`
- `src/components/governance/GovernanceSectionFrame.test.tsx`
- `docs/_refactor/ordo/phases/01c3am-brief-read-model-storage-and-evidence-manifests.md`
- `docs/_refactor/ordo/evidence/phase-01c3am-brief-read-model-storage-and-evidence-manifests.md`

Implemented behavior:

- Added shared `SectionBrief`, `BriefEvidenceManifest`,
  `StoredSectionBrief`, and `BriefReadModelEvent` contracts.
- Added evidence manifest validation:
  - every claim must have evidence or an explicit limitation;
  - public-safe briefs cannot include owner/private/admin evidence;
  - owner briefs cannot include admin-only evidence;
  - regular owner/public-safe brief copy cannot expose raw job ids, providers,
    logs, command table names, or payload fields.
- Added `brief_read_models` and `brief_events` tables plus indexes for current
  scope lookup, history lookup, and event lookup.
- Added `BriefReadModelDataMapper`:
  - saves validated brief snapshots;
  - reads current section briefs;
  - lists history for a scope;
  - lists brief events;
  - keeps the previous current brief when a stale or failed update arrives.
- Added repository factory access through `getBriefReadModelDataMapper()`.
- Updated the shared governance brief panel to render status, as-of value,
  evidence links, and limitations without exposing raw internals.

## Manifest Example

```ts
createBriefEvidenceManifest({
  brief,
  generatedAt: "2026-05-06T12:00:00.000Z",
  generatedBy: "deterministic:test",
  ownerUserId: "usr_1",
  visibilityPolicy: "owner",
});
```

The resulting manifest stores schema version, brief id/version, generator,
owner scope, visibility policy, included/excluded source refs, claims,
limitations, executor metadata, and warnings.

## QA Pass 1

Commands:

```bash
npx vitest run src/core/entities/brief.test.ts src/adapters/BriefReadModelDataMapper.test.ts src/components/governance/GovernanceSectionFrame.test.tsx
npx vitest run src/core/entities/brief.test.ts src/adapters/BriefReadModelDataMapper.test.ts src/components/governance/GovernanceSectionFrame.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/dashboard/today-brief-read-model.test.ts src/lib/studio/load-studio-workspace.test.ts src/lib/offers/load-offers-workspace.test.ts src/lib/about/load-about-workspace.test.ts src/lib/admin/system/load-admin-system-workspace.test.ts
npm run typecheck
npm run lint -- src/core/entities/brief.ts src/core/entities/brief.test.ts src/adapters/BriefReadModelDataMapper.ts src/adapters/BriefReadModelDataMapper.test.ts src/adapters/RepositoryFactory.ts src/components/governance/GovernanceSectionFrame.tsx src/components/governance/GovernanceSectionFrame.test.tsx src/components/offers/OfferSurfaces.test.tsx src/lib/db/tables.ts src/lib/db/migrations.ts
```

Results:

- Initial focused phase tests passed: 3 files, 20 tests.
- Full focused brief/consumer suite initially found one offer surface assertion
  issue, then passed after the test fix: 12 files, 60 tests.
- Typecheck initially failed, then passed after the mapper event payload fix.
- Focused lint initially passed with one warning, then passed cleanly after the
  test warning fix.

Issues found and fixed:

- The governance frame test only checked selector links, not brief evidence
  rendering. Added explicit assertions for as-of rendering, brief evidence
  links, stale state, and limitations.
- The owner Offers base-route test assumed an offer title appeared only once.
  Evidence-backed brief rendering correctly adds the offer as a source link, so
  the assertion now scopes title checks to the selector column.
- `BriefReadModelDataMapper` passed extra durable fields to an event writer that
  only needs id, section, object, and owner. Narrowed the event input to the
  exact event contract.
- `GovernanceSectionFrame.test.tsx` used a non-null assertion in the stale brief
  test. Replaced it with an explicit test invariant so focused lint is clean.

## QA Pass 2

Commands:

```bash
npx vitest run src/core/entities/brief.test.ts src/adapters/BriefReadModelDataMapper.test.ts src/components/governance/GovernanceSectionFrame.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/dashboard/today-brief-read-model.test.ts src/lib/studio/load-studio-workspace.test.ts src/lib/offers/load-offers-workspace.test.ts src/lib/about/load-about-workspace.test.ts src/lib/admin/system/load-admin-system-workspace.test.ts
npm run typecheck
npm run lint -- src/core/entities/brief.ts src/core/entities/brief.test.ts src/adapters/BriefReadModelDataMapper.ts src/adapters/BriefReadModelDataMapper.test.ts src/adapters/RepositoryFactory.ts src/components/governance/GovernanceSectionFrame.tsx src/components/governance/GovernanceSectionFrame.test.tsx src/components/offers/OfferSurfaces.test.tsx src/lib/db/tables.ts src/lib/db/migrations.ts
rg -n -P "job_(?!event\b)[0-9A-Za-z-]+|\b(raw job|raw log|provider|logs?|payload_json|system_commands|fake metrics|diagnostic)\b" src/components/governance/GovernanceSectionFrame.tsx src/components/dashboard/UserDashboard.tsx src/components/offers/OfferSurfaces.tsx src/components/about/AboutSurfaces.tsx src/lib/dashboard/today-brief-read-model.ts src/lib/studio/load-studio-workspace.ts src/lib/offers/load-offers-workspace.ts src/lib/about/load-about-workspace.ts
rg -n "brief_read_models|brief_events|BriefReadModelDataMapper|getBriefReadModelDataMapper|BriefEvidenceManifest|SectionBrief" src/core/entities/brief.ts src/adapters/BriefReadModelDataMapper.ts src/adapters/RepositoryFactory.ts src/lib/db/tables.ts src/lib/db/migrations.ts src/components/governance/GovernanceSectionFrame.tsx
rg -n -P "Every claim has evidence|Private/admin evidence|Failed/stale briefs|Brief schema/read-model|Status: Implemented" docs/_refactor/ordo/phases/01c3am-brief-read-model-storage-and-evidence-manifests.md docs/_refactor/ordo/evidence/phase-01c3am-brief-read-model-storage-and-evidence-manifests.md
```

Results:

- Full focused brief/consumer suite passed: 12 files, 60 tests.
- Typecheck passed.
- Focused lint passed.
- Owner/public UI raw leakage scan returned no matches after excluding the
  internal `job_event` source-kind key from the raw job-id pattern.
- Brief storage/static anchor scan confirmed the new entity, mapper, schema,
  repository factory, and panel contract are present.
- Phase/evidence doc scan confirmed required implementation rules and closeout
  status are documented.

Issues found and fixed:

- No new QA pass 2 issues were found.

## Remaining Risks / Deferred Work

- Background brief execution is intentionally deferred to
  `01c3an-brief-executor-command-result-reconcile.md`.
- Existing deterministic section loaders are not all migrated to persist briefs
  on read. This phase establishes the durable contract and adapter seam the
  next executor/reconcile phase will use.
