# Phase 01c3ar: Shared Frame Compliance Sweep

Status: Implemented

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Ensure every canonical owner/admin governance surface follows the shared
selector, section brief, selected detail, and mobile list/detail contract.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/02-shared-surface-frame-contract.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/07-placeholder-read-model-policy.md`

## Current Code Grounding

Code anchors:

- `src/components/governance/GovernanceSectionFrame.tsx`
- `src/components/dashboard/UserDashboard.tsx`
- `src/components/studio/StudioWorkspace.tsx`
- `src/components/business/BusinessWorkspace.tsx`
- `src/components/offers/OfferSurfaces.tsx`
- `src/components/about/AboutSurfaces.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`
- `src/components/admin/system/AdminSystemWorkspace.tsx`
- `src/components/media/UserMediaWorkspace.tsx`

## Verified Current State

- `GovernanceSectionFrame` already provides the core layout contract.
- Today, Studio, Offers, About, Account, and System already used the shared
  frame.
- People used a compatible-looking custom frame, but it duplicated selector,
  filter, mobile back, and missing-detail behavior instead of using
  `GovernanceSectionFrame`.
- Studio used the shared frame, but an unknown selected object id fell back to
  the base brief instead of the shared missing-detail state.
- `/my/media` remains a custom donor frame and should not become the model for
  future surfaces.
- Some base views show metric summaries. These are acceptable on section briefs
  only, not on selected object details.

## Target Behavior

- Base section route renders a section brief or honest limited placeholder.
- Second column remains a selector/evidence index, not a dashboard.
- Selected object route renders exactly one object detail.
- Selected object details never start with global totals.
- Mobile list/detail state is consistent across canonical surfaces.

## Implementation Steps

1. Audit each canonical frame consumer for base route, selected route, selector,
   missing detail, and mobile back behavior.
2. Add a reusable compliance test helper if it reduces duplication.
3. Move or remove any selected-detail global totals from affected surfaces.
4. Ensure empty/limited states follow placeholder policy.
5. Leave `/my/media` as donor until Studio consolidation phase.
6. Update evidence notes in this phase.

## Positive Tests

- Each canonical surface renders `GovernanceSectionFrame` or an explicitly
  documented compatible frame.
- Base routes render section brief content.
- Selected object routes render detail content and keep selector available.
- Mobile selected detail renders back-to-list control.
- Missing selected object renders shared missing-detail state.

## Negative Tests

- Selected object detail does not render global total/summary strips first.
- Owner selected details do not show raw jobs, provider details, payloads, logs,
  or operation internals.
- No new custom frame fork is introduced without documentation.

## Edge Tests

- Empty selector list renders honest empty copy.
- Filtered view with no selected object still renders section brief.
- Selected object id not found renders missing detail.
- Admin System may show diagnostics only inside admin route.
- Mobile direct-load selected route starts in detail state.

## Acceptance Criteria

- Canonical owner/admin surfaces share the same mental model.
- Tests enforce base brief versus selected detail separation.
- Custom donor frames are identified and scheduled for convergence or redirect.

## Non-Goals

- No `/my/media` retirement in this phase.
- No Knowledge Base route.
- No new brief storage.
- No broad CSS redesign beyond frame compliance fixes.

## Required Commands

```bash
npx vitest run src/components/governance/GovernanceSectionFrame.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/components/governance/GovernanceSectionFrame.tsx src/components/dashboard/UserDashboard.tsx src/components/studio/StudioWorkspace.tsx src/components/business/BusinessWorkspace.tsx src/components/offers/OfferSurfaces.tsx src/components/about/AboutSurfaces.tsx src/components/profile/ProfileSettingsPanel.tsx src/components/admin/system/AdminSystemWorkspace.tsx
```

## Static Scans

```bash
rg -n "global total|Stored media|Quota usage|Jobs health|Provider|payload|raw log|operation id" src/components src/lib
rg -n "data-governance|data-dashboard|data-studio|data-business|data-offers|data-about|data-profile|data-admin-system" src/components
```

## Closeout Evidence Required

- Surface compliance checklist.
- Test output for all shared frame consumers.
- Screenshots for at least Today, Studio, People, and System desktop/mobile
  list-detail behavior.
- Notes on any intentionally deferred donor frame.

## Implementation Evidence

Implemented on 2026-05-06.

Code changes:

- `src/components/business/BusinessWorkspace.tsx`
  - Replaced the custom People frame with `GovernanceSectionFrame`.
  - Kept the existing People read model, filters, relationship facts,
    relationship trail, and read-only relationship settings.
  - Added a base People brief at `/business`.
  - Routed selected People detail through `detailRequested={Boolean(query.personId)}`.
  - Added the shared missing-detail state for unknown `person` query values.
- `src/components/studio/StudioWorkspace.tsx`
  - Changed selected-object detection so an unknown `object` query uses the
    shared missing-detail state instead of falling back to `Production Brief`.
- `src/components/business/BusinessWorkspace.test.tsx`
  - Added assertions for shared frame selector/main attributes.
  - Added base-route brief coverage.
  - Added missing selected person coverage.
- `src/components/studio/StudioWorkspace.test.tsx`
  - Updated the unknown selected object case to require shared missing-detail
    behavior.

Surface compliance checklist:

| Surface | Base route | Selected/detail route | Selector/evidence index | Missing detail | Mobile list/detail | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Today | Section brief | One selected Today object | Shared frame selector | Shared frame state | Shared frame state | Compliant |
| Studio | Production brief | One selected work/media object | Shared frame selector | Fixed in this phase | Shared frame state | Compliant |
| People | Relationship brief | One selected person | Migrated to shared frame | Added in this phase | Shared frame state | Compliant |
| Offers | Offer brief | One selected offer | Shared frame selector | Shared frame state | Shared frame state | Compliant |
| About | Business story brief | One selected story section | Shared frame selector | Shared frame state | Shared frame state | Compliant |
| Account | Account section brief/detail | One selected account section | Shared frame selector | Shared frame state | Shared frame state | Compliant |
| Admin/System | System brief | One selected admin section | Shared frame selector | Shared frame state | Shared frame state | Compliant, admin-gated |
| `/my/media` | Custom donor frame | Custom media detail | Custom selector | Custom state | Custom state | Deferred donor, not canonical |

QA pass 1:

- `npx vitest run src/components/business/BusinessWorkspace.test.tsx src/components/studio/StudioWorkspace.test.tsx`
  - Passed: 18 tests.
- `npx vitest run src/components/governance/GovernanceSectionFrame.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx`
  - Passed: 53 tests.
- `npm run typecheck`
  - Passed.
- `npm run lint:css`
  - Passed.
- `npm run lint -- src/components/governance/GovernanceSectionFrame.tsx src/components/dashboard/UserDashboard.tsx src/components/studio/StudioWorkspace.tsx src/components/business/BusinessWorkspace.tsx src/components/offers/OfferSurfaces.tsx src/components/about/AboutSurfaces.tsx src/components/profile/ProfileSettingsPanel.tsx src/components/admin/system/AdminSystemWorkspace.tsx`
  - Passed.

Static scan review:

- `rg -n "global total|Stored media|Quota usage|Jobs health|Provider|payload|raw log|operation id" src/components src/lib`
  - Reviewed. Matches are concentrated in job/admin/tool/library internals,
    tests, and the account component's HTTP response variable named `payload`.
    No touched owner selected-detail surface starts with global totals or exposes
    raw provider/job/log/payload detail.
- `rg -n "data-governance|data-dashboard|data-studio|data-business|data-offers|data-about|data-profile|data-admin-system" src/components`
  - Reviewed. Canonical surfaces expose shared frame attributes; `/my/media`
    remains the only documented custom donor frame in this sweep.

Visual QA:

- Browser screenshot capture was not useful from the CLI because the local dev
  server responds to unauthenticated requests with `307 /install`.
- Desktop/mobile list-detail evidence is covered by shared-frame DOM attributes
  and focused component tests for Today, Studio, People, Account, and System.

QA pass 2:

- `npx vitest run src/components/governance/GovernanceSectionFrame.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx`
  - Passed: 53 tests.
- `npm run typecheck`
  - Passed.
- `npm run lint:css`
  - Passed.
- `npm run lint -- src/components/governance/GovernanceSectionFrame.tsx src/components/dashboard/UserDashboard.tsx src/components/studio/StudioWorkspace.tsx src/components/business/BusinessWorkspace.tsx src/components/offers/OfferSurfaces.tsx src/components/about/AboutSurfaces.tsx src/components/profile/ProfileSettingsPanel.tsx src/components/admin/system/AdminSystemWorkspace.tsx`
  - Passed.
- Static scans rerun and reviewed.
  - Expected matches remain in tests, admin/system diagnostics, jobs, tools,
    backup/restore, and provider internals.
  - No touched owner selected-detail surface starts with global totals or exposes
    raw job/provider/log/payload details.
