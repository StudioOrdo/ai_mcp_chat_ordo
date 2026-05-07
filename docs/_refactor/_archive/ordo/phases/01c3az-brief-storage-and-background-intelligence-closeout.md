# Phase 01c3az: Brief Storage And Background Intelligence Closeout

Status: Implemented

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Wire missing owner/admin section briefs to durable request/result/reconcile
semantics where needed and close the gap between deterministic read models and
future background intelligence.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/04-owner-intelligence-brief-surfaces.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/08-studio-jobs-and-background-briefs.md`

## Current Code Grounding

Code anchors:

- `src/core/entities/brief.ts`
- `src/core/entities/brief-execution.ts`
- `src/lib/briefs/brief-update-executor.ts`
- `src/lib/briefs/brief-update-reconciler.ts`
- `src/adapters/BriefReadModelDataMapper*`
- `src/adapters/BriefUpdateRequestDataMapper*`
- `src/lib/appliance/backup/backup-command-service.ts`
- section loaders under `src/lib/**/load-*.ts`

## Verified Current State

- Durable brief entity and evidence manifest contracts exist.
- Brief update executor claims requests, gathers evidence, stages results, and
  reconciles through a service boundary.
- Failed brief updates do not reconcile over current briefs.
- Deterministic brief draft generation exists.
- Some surfaces still use local deterministic brief-like summaries rather than
  durable stored/current briefs.

## Target Behavior

- Every canonical base section can consume a `SectionBrief`.
- Brief generation/update uses durable request/result/reconcile semantics when
  background processing is required.
- Evidence manifests attach claims to source refs.
- Visibility policies exclude private/admin evidence from lower-role briefs.
- Failed brief updates preserve prior current brief.

## Implementation Steps

1. Inventory which surfaces have durable briefs versus deterministic local
   briefs.
2. Define missing mapper/service boundaries for brief storage only where needed.
3. Wire section loaders to prefer current stored brief and fall back to
   deterministic limited brief.
4. Add tests for manifest evidence, visibility filtering, and failed update
   behavior.
5. Add stale-surface scans for fake intelligence and raw diagnostics.
6. Update docs/evidence.

## Positive Tests

- Brief executor succeeds and reconciles with evidence manifest.
- Brief executor failure stages failed result without overwriting current brief.
- Section loader renders stored current brief when available.
- Deterministic fallback renders limited brief when no stored brief exists.
- Visibility policy excludes restricted evidence.

## Negative Tests

- Briefs do not include fake metrics or unsupported claims.
- Owner briefs do not include raw job/provider/log/payload internals.
- Failed brief result cannot reconcile without brief and manifest.
- Public users cannot receive owner/admin brief evidence.

## Edge Tests

- No evidence produces limited brief.
- Partial evidence excludes restricted refs and records warnings.
- Prior brief id/version is preserved on update.
- Mapper unavailable produces safe limited state instead of crashing section.
- Admin-only evidence remains visible only in admin brief.

## Acceptance Criteria

- Brief storage/update behavior is durable and failure-safe.
- Section briefs have evidence manifests or explicit limitations.
- Components continue rendering read models, not raw tables.
- Background intelligence can be scheduled later without changing UI contracts.

## Non-Goals

- No scheduler implementation.
- No new LLM provider integration.
- No automatic recurring jobs unless already available.
- No prompt tuning UI.

## Required Commands

```bash
npx vitest run src/core/entities/brief.test.ts src/core/entities/brief-execution.test.ts src/lib/briefs/brief-update-executor.test.ts src/lib/briefs/brief-update-reconciler.test.ts src/lib/appliance/backup/backup-command-service.test.ts src/components/governance/GovernanceSectionFrame.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/core/entities/brief.ts src/core/entities/brief-execution.ts src/lib/briefs/brief-update-executor.ts src/lib/briefs/brief-update-reconciler.ts src/lib/appliance/backup/backup-command-service.ts
```

## Static Scans

```bash
rg -n "fake|sample|coming soon|provider|payload|raw log|job id|visibilityPolicy|manifest|priorBrief" src/core src/lib src/components
```

## Closeout Evidence Required

- Surface brief inventory.
- Tests for executor/reconciler success and failure.
- Evidence manifest examples.
- Static scan results for fake intelligence and diagnostics.

## Implementation Evidence

Implemented on 2026-05-07.

Code changed:

- `src/lib/briefs/section-brief-resolver.ts`
  - Added the shared resolver that prefers a current stored brief and falls
    back to deterministic section evidence.
  - Added the canonical section brief inventory for Conversations, Today,
    Studio, People, Offers, About, Knowledge Base, Account, and System.
- `src/lib/briefs/brief-update-executor.ts`
  - Recovers expired running brief update leases before claiming the next
    pending request.
- `src/lib/briefs/brief-update-reconciler.ts`
  - Validates staged results against the request before reconciling.
  - Failed results still return without overwriting the current brief.
- `src/lib/offers/load-offers-workspace.ts`
  - Uses the shared resolver so stored current offer briefs win over the
    deterministic Offer Brief when a brief store is provided.
- `src/lib/knowledge/load-knowledge-base-workspace.ts`
  - Uses the shared resolver for stored Knowledge Briefs with deterministic
    source-inventory fallback.
- `src/lib/about/load-about-workspace.ts`
  - Uses the shared resolver for stored About/Business Story briefs with
    deterministic public-story fallback.
- `src/lib/admin/system/load-admin-system-workspace.ts`
  - Uses the shared resolver for admin System Briefs with deterministic admin
    diagnostics fallback.

Tests added or updated:

- `src/lib/briefs/section-brief-resolver.test.ts`
- `src/lib/briefs/brief-update-reconciler.test.ts`
- `src/lib/briefs/brief-update-executor.test.ts`
- `src/lib/offers/load-offers-workspace.test.ts`

Surface brief inventory:

| Surface | Section id | Durable stored brief path | Deterministic fallback |
| --- | --- | --- | --- |
| Conversations | `conversations` | Future stored section brief | Chat/conversation selector state |
| Today | `today` | Future stored section brief | `today-brief-read-model` |
| Studio | `studio` | Future stored section brief | Studio workspace projector |
| People | `people` | Future stored section/object brief | People relationship read model |
| Offers | `offers` | `resolveSectionBrief` through loader dependency | Offer workspace read model |
| About | `about` | `resolveSectionBrief` through loader dependency | About public story read model |
| Knowledge Base | `knowledge-base` | `resolveSectionBrief` through loader dependency | Role-filtered source inventory |
| Account | `account` | Future stored section brief | Profile/account settings panel |
| System | `admin-system` | `resolveSectionBrief` through loader dependency | Admin system diagnostics read model |

QA pass 1:

- Required brief/entity/executor/reconciler/backup/frame suite passed.
- Added resolver and Offers focused tests passed.
- Focused About, Knowledge Base, System, and Offers component/loader tests
  passed.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.

Issues found and fixed:

- Required command referenced `src/lib/briefs/brief-update-reconciler.test.ts`;
  the reconciler existed but the test file was missing. Added direct reconciler
  success, failure-preservation, and invalid-result tests.
- Loader code had no shared stored-brief-preferred boundary. Added
  `resolveSectionBrief` and wired it into loaders that already expose
  `SectionBrief`.

QA pass 2:

- Re-ran required tests and focused tests after fixes.
- Re-ran typecheck, CSS lint, focused lint, and static scans.
- Static scan matches were reviewed as expected test fixtures, type names,
  validation terms, admin/system diagnostics, or implementation metadata.
- Prompt handoff files were written for the next phase target.

Visual QA:

- Authenticated local routes still redirect to `/install` in this shell
  context, so browser screenshots were blocked. DOM/render tests and static
  scans were used for closeout evidence.
