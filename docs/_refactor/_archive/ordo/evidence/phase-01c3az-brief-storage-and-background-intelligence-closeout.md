# Phase 01c3az Evidence: Brief Storage And Background Intelligence Closeout

Date: 2026-05-07

Status: Implemented

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- Briefs are durable staff reports or honest deterministic fallbacks.
- Background brief work follows durable request/result/reconcile semantics
  modeled on backup/restore.
- Failed brief updates do not overwrite the current stored brief.
- Evidence manifests attach claims to source refs or explicit limitations.
- Owner/public briefs must not expose raw jobs, providers, payloads, logs, or
  unsupported live intelligence.

## Code Files Changed

- `src/lib/briefs/section-brief-resolver.ts`
- `src/lib/briefs/section-brief-resolver.test.ts`
- `src/lib/briefs/brief-update-executor.ts`
- `src/lib/briefs/brief-update-executor.test.ts`
- `src/lib/briefs/brief-update-reconciler.ts`
- `src/lib/briefs/brief-update-reconciler.test.ts`
- `src/lib/offers/load-offers-workspace.ts`
- `src/lib/offers/load-offers-workspace.test.ts`
- `src/lib/knowledge/load-knowledge-base-workspace.ts`
- `src/lib/about/load-about-workspace.ts`
- `src/lib/admin/system/load-admin-system-workspace.ts`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3az-brief-storage-and-background-intelligence-closeout.md`
- `docs/_refactor/ordo/evidence/phase-01c3az-brief-storage-and-background-intelligence-closeout.md`
- `docs/_refactor/ordo/prompts/next.md`
- `docs/_refactor/ordo/prompts/archive/01c3ba-canonical-ui-surface-realignment-closeout.md`

## Verified Current State

- `SectionBrief`, `StoredSectionBrief`, and `BriefEvidenceManifest` already
  existed.
- Brief read models and update requests already had SQLite-backed mappers.
- `BriefUpdateExecutor` already claimed durable requests, gathered evidence,
  generated a staged result, and reconciled successful results.
- Failed executor results already staged as failed and did not reconcile over
  the current stored brief.
- `BriefUpdateReconciler` existed but had no direct required test file.
- Offers, About, Knowledge Base, and System already exposed `SectionBrief`.
- Today, Studio, People, Conversations, and Account still use deterministic
  read models or custom panel projection and are recorded in the inventory for
  later full stored-brief adoption.

## Implementation Evidence

- Added `resolveSectionBrief`, which prefers a stored current brief when a
  brief store is provided and otherwise returns a deterministic fallback.
- Added a mapper-unavailable fallback path that keeps sections usable and marks
  otherwise fresh fallbacks as limited with an explicit limitation.
- Added a canonical brief inventory for Conversations, Today, Studio, People,
  Offers, About, Knowledge Base, Account, and System.
- Wired stored-brief preference into Offers, Knowledge Base, About, and System
  loaders through dependency injection.
- Added stale-lease recovery before `BriefUpdateExecutor` claims the next
  pending request.
- Added request/result validation inside `BriefUpdateReconciler`.
- Added direct reconciler tests for success, failed-result preservation, and
  invalid non-failed result rejection.

## Evidence Manifest Examples

The tests cover both evidence-backed and limited manifests:

- `brief-update-executor.test.ts` verifies a successful Today brief manifest
  includes `offer:offer_1`.
- `brief-update-executor.test.ts` verifies missing evidence creates a limited
  brief whose claim has no evidence refs and includes the limitation
  `No source evidence was available in the selected window.`
- `brief-update-executor.test.ts` verifies private evidence is redacted from
  public-safe briefs and appears in `excludedSourceRefs`.
- `brief-update-reconciler.test.ts` verifies reconciled stored briefs preserve
  manifest claim refs such as `person:person_1`.
- `section-brief-resolver.test.ts` verifies a stored current brief with
  `priorBriefId` wins over deterministic fallback.

## Surface Brief Inventory

| Surface | Section id | Current path | Closeout state |
| --- | --- | --- | --- |
| Conversations | `conversations` | Chat surface state | Inventory only; deterministic selector remains. |
| Today | `today` | `today-brief-read-model` | Inventory only; deterministic daily brief remains. |
| Studio | `studio` | Studio workspace projector | Inventory only; deterministic production brief remains. |
| People | `people` | People relationship read model | Inventory only; deterministic relationship brief remains. |
| Offers | `offers` | Offer loader + resolver | Stored-current preferred, deterministic fallback. |
| About | `about` | About loader + resolver | Stored-current preferred, deterministic fallback. |
| Knowledge Base | `knowledge-base` | Knowledge loader + resolver | Stored-current preferred, deterministic fallback. |
| Account | `account` | Profile settings panel | Inventory only; deterministic account panel remains. |
| System | `admin-system` | System loader + resolver | Stored-current preferred, deterministic admin fallback. |

## QA Pass 1

Commands run:

```bash
npx vitest run src/core/entities/brief.test.ts src/core/entities/brief-execution.test.ts src/lib/briefs/brief-update-executor.test.ts src/lib/briefs/brief-update-reconciler.test.ts src/lib/briefs/section-brief-resolver.test.ts src/lib/offers/load-offers-workspace.test.ts src/lib/appliance/backup/backup-command-service.test.ts src/components/governance/GovernanceSectionFrame.test.tsx
npx vitest run src/lib/about/load-about-workspace.test.ts src/lib/knowledge/load-knowledge-base-workspace.test.ts src/lib/admin/system/load-admin-system-workspace.test.ts src/components/admin/system/AdminSystemWorkspace.test.tsx src/components/about/AboutSurfaces.test.tsx src/components/knowledge/KnowledgeBaseWorkspace.test.tsx src/components/offers/OfferSurfaces.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/core/entities/brief.ts src/core/entities/brief-execution.ts src/lib/briefs/brief-update-executor.ts src/lib/briefs/brief-update-reconciler.ts src/lib/briefs/section-brief-resolver.ts src/lib/appliance/backup/backup-command-service.ts src/lib/offers/load-offers-workspace.ts src/lib/knowledge/load-knowledge-base-workspace.ts src/lib/about/load-about-workspace.ts src/lib/admin/system/load-admin-system-workspace.ts
```

Results:

- Required and focused brief tests passed: 8 files, 44 tests.
- Focused touched-loader/component tests passed: 7 files, 31 tests.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.

Issues found and fixed:

- Required phase command referenced a missing reconciler test file. Added the
  file and direct reconciler coverage.
- Loader code had no shared stored-brief-preferred boundary. Added
  `resolveSectionBrief` and wired it into existing `SectionBrief` loaders.

## QA Pass 2

Commands run:

```bash
npx vitest run src/core/entities/brief.test.ts src/core/entities/brief-execution.test.ts src/lib/briefs/brief-update-executor.test.ts src/lib/briefs/brief-update-reconciler.test.ts src/lib/appliance/backup/backup-command-service.test.ts src/components/governance/GovernanceSectionFrame.test.tsx
npx vitest run src/lib/briefs/section-brief-resolver.test.ts src/lib/offers/load-offers-workspace.test.ts src/lib/about/load-about-workspace.test.ts src/lib/knowledge/load-knowledge-base-workspace.test.ts src/lib/admin/system/load-admin-system-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx src/components/knowledge/KnowledgeBaseWorkspace.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/core/entities/brief.ts src/core/entities/brief-execution.ts src/lib/briefs/brief-update-executor.ts src/lib/briefs/brief-update-reconciler.ts src/lib/briefs/section-brief-resolver.ts src/lib/appliance/backup/backup-command-service.ts src/lib/offers/load-offers-workspace.ts src/lib/knowledge/load-knowledge-base-workspace.ts src/lib/about/load-about-workspace.ts src/lib/admin/system/load-admin-system-workspace.ts
rg -n "fake|sample|coming soon|provider|payload|raw log|job id|visibilityPolicy|manifest|priorBrief" src/core src/lib src/components
rg -n "Date\\.now\\(|Math\\.random\\(|toLocaleString\\(|toLocaleDateString\\(" src/core/entities src/lib/briefs src/components/governance
```

Results:

- Required phase suite passed after fixes.
- Focused touched-loader/component suite passed after fixes.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.
- Static scans were reviewed. Remaining matches are expected type names,
  validation strings, tests, admin/system implementation metadata, or explicit
  fixture coverage. No regular owner/public brief copy was introduced with fake
  intelligence or raw diagnostic leakage.

Issues found and fixed:

- None after QA pass 1 fixes.

## Visual QA

Authenticated local route screenshots were blocked because the local app
redirects authenticated surfaces to `/install` in this shell context. This
phase primarily touches server-side brief contracts and loader boundaries, so
DOM/render tests, mapper tests, and static scans are the closeout evidence.

## Prompt Handoff

Next prompt files written:

- `docs/_refactor/ordo/prompts/next.md`
- `docs/_refactor/ordo/prompts/archive/01c3ba-canonical-ui-surface-realignment-closeout.md`

Both target:

- `docs/_refactor/ordo/phases/01c3ba-canonical-ui-surface-realignment-closeout.md`
