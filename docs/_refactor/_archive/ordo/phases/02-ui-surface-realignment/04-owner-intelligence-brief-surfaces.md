# 02 UI Surface Realignment: Owner Intelligence Brief Surfaces

Status: Draft spec

## Goal

Make each owner surface open with an evidence-backed brief that answers what
matters now, what changed, what needs the owner, and what to ask Ordo next. The
brief is a staff report, not a decorative dashboard.

## Current Code Grounding

Current anchors:

- `src/core/entities/brief.ts`
- `src/core/entities/brief-execution.ts`
- `src/lib/briefs/brief-update-executor.ts`
- `src/lib/briefs/brief-update-reconciler.ts`
- `src/lib/dashboard/today-brief-read-model.ts`
- `src/lib/dashboard/load-user-dashboard.ts`
- `src/components/dashboard/UserDashboard.tsx`
- `src/lib/studio/load-studio-workspace.ts`
- `src/components/studio/StudioWorkspace.tsx`
- `src/lib/business/load-business-workspace.ts`
- `src/components/business/BusinessWorkspace.tsx`
- `src/lib/offers/load-offers-workspace.ts`
- `src/components/offers/OfferSurfaces.tsx`
- `src/lib/about/load-about-workspace.ts`
- `src/components/about/AboutSurfaces.tsx`

## Verified Current State

- `SectionBrief` includes status, summary, bullets, recommended action,
  evidence refs, limitations, version, and prior brief id.
- `BriefUpdateExecutor` claims durable requests, gathers evidence, stages a
  result, and reconciles through `BriefUpdateReconciler`.
- The deterministic draft generator creates limited briefs when evidence is
  missing.
- Today has a `TodayBriefReadModel` and selector/detail behavior.
- About and System already create `SectionBrief` values.
- Offers uses a brief panel with owner workspace data.
- Studio currently has strong object/read-model projection but its base summary
  still behaves more like a metric workspace than a durable staff brief.
- People has relationship detail and evidence, but the base People brief needs
  stricter section-brief semantics.

## Target Behavior

Canonical owner briefs:

| Surface | Brief answer |
| --- | --- |
| Conversations | Which conversation needs attention and what Ordo is ready to do next. |
| Today | What needs a decision, what is moving, what is ready, and what to ask Ordo. |
| Studio | What Ordo produced or is producing, what is blocked, and which output needs review. |
| People | Which relationships moved, which need follow-up, and what evidence changed. |
| Offers | Which offers are public, private, draft, accepted, or missing price/visibility decisions. |
| About | What public/business story sections are current, missing, or ready to revise. |
| Account | What account settings matter now without business-performance claims. |
| System | Admin-only health, backups, jobs, and diagnostic readiness. |

Brief rules:

- Briefs must expose limitations when data is missing.
- Brief claims must link to evidence refs.
- Briefs must not invent metrics.
- Briefs must not leak private evidence into public or lower-role views.
- Owner briefs must not expose raw jobs/logs/provider details.

## Reuse / Move / Hide / Mock Decisions

- Reuse `SectionBrief` for all section briefs.
- Reuse deterministic brief drafts as placeholders only when evidence is absent.
- Reuse backup/restore command-result-reconcile semantics for future LLM brief
  updates.
- Move raw job/operation facts into evidence refs and owner-safe projections.
- Hide diagnostics behind System/Admin links.

## Positive Tests

- Each base owner section renders a brief or honest limited placeholder.
- Brief recommended actions link to chat or a canonical owner/admin surface.
- Evidence refs are present for non-empty briefs.
- Limited briefs show limitations.
- Owner-safe scrubber removes raw job/provider/log terms from owner briefs.

## Negative Tests

- Briefs do not include fabricated totals, fake trends, or unsupported claims.
- Owner briefs do not include raw job ids, provider keys, model config, payloads,
  logs, or queue internals.
- Public pages do not receive owner/admin briefs.
- Failed brief generation does not overwrite prior brief history.

## Edge Tests

- No evidence produces a limited brief with a limitation.
- Partial evidence produces a fresh or limited brief with scoped claims only.
- Visibility policy excludes private/admin evidence from lower-role briefs.
- Prior brief is linked when a new version is reconciled.
- Selected object detail uses object detail, not the section brief.

## Acceptance Criteria

- Every canonical owner base route has a defined brief read model path.
- Each brief has id/scope/as-of/status/summary/bullets/action/evidence/limits.
- Missing intelligence is explicit and not disguised as live insight.
- Background brief generation can be added without changing component contracts.

## Non-Goals

- No new LLM provider integration.
- No automatic scheduler implementation.
- No replacement of existing deterministic read models.

## Required Commands

```bash
npx vitest run src/core/entities/brief.test.ts src/lib/briefs/brief-update-executor.test.ts src/lib/briefs/brief-update-reconciler.test.ts src/lib/dashboard/today-brief-read-model.test.ts src/components/dashboard/UserDashboard.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx
npm run typecheck
npm run lint -- src/core/entities/brief.ts src/lib/briefs/brief-update-executor.ts src/lib/briefs/brief-update-reconciler.ts src/lib/dashboard/today-brief-read-model.ts src/components/dashboard/UserDashboard.tsx src/components/studio/StudioWorkspace.tsx src/components/business/BusinessWorkspace.tsx src/components/offers/OfferSurfaces.tsx src/components/about/AboutSurfaces.tsx
rg -n "job id|provider|payload|raw log|fake|simulated metric|TODO live" src/core src/lib src/components
```

## Closeout Evidence Required

- Brief inventory by surface.
- Test output proving brief limitations/evidence behavior.
- Static scan showing owner brief copy does not expose diagnostics.
- Screenshots of base brief and selected object detail for affected surfaces.
