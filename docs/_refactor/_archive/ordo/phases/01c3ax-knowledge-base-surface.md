# Phase 01c3ax: Knowledge Base Surface

Status: Implemented

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Introduce Knowledge Base as the owner/admin business brain surface by reusing
existing corpus, content access, training, and retrieval infrastructure without
turning Library into a public product route.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/05-knowledge-base-surface.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/07-placeholder-read-model-policy.md`

## Current Code Grounding

Code anchors:

- `src/app/library/page.tsx`
- `src/app/library/[document]/page.tsx`
- `src/app/library/[document]/[section]/page.tsx`
- `src/app/library/section/[slug]/page.tsx`
- `src/app/admin/training/page.tsx`
- `src/app/admin/content-visibility/page.tsx`
- `src/lib/access/content-access.ts`
- `src/adapters/FileSystemCorpusRepository.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/lib/chat/retrieval-envelope.ts`
- `src/lib/shell/shell-navigation.ts`

## Verified Current State

- Corpus/content visibility rules already exist.
- Library routes exist and are currently hidden `notFound()` donor routes,
  which prevents public Library leakage while Knowledge Base becomes the
  authenticated surface.
- Admin training and content visibility routes are donor/admin anchors.
- Owner rail now includes Knowledge Base after the authenticated route and
  role-filtered read model were implemented.
- Object surface contracts now include a dedicated `knowledge_base` target
  surface so the shell route is not overloaded onto public, business, or
  Studio.

## Target Behavior

- Knowledge Base has a base brief, second-column selector, search/filter, and
  selected document/section detail.
- Visibility filtering happens in the read model before rendering.
- Public nav does not include Library or Knowledge Base.
- Admin visibility controls remain linked from Knowledge Base for authorized
  users.
- Owner rail includes Knowledge Base only after the route/read model is real.

## Implementation Steps

1. Defined `/knowledge` and `loadKnowledgeBaseWorkspace`.
2. Reused corpus repository and content access helpers for visibility
   filtering before render.
3. Built a deterministic Knowledge Brief with honest limitations.
4. Built second-column document/section selector rows for accessible sources.
5. Rendered selected detail with source, visibility, preview, related source
   links, and role-gated admin visibility links.
6. Added shell route after route/read model/component tests passed.
7. Preserved `/library/*` donor routes as hidden `notFound()` surfaces.
8. Updated docs/evidence and the next-prompt handoff files.

## Positive Tests

- Owner can access Knowledge Base and see only permitted documents.
- Admin can inspect admin-only knowledge and visibility links.
- Search matches document, section, title, and source labels.
- Base route renders Knowledge Brief.
- Selected detail shows source and visibility metadata.

## Negative Tests

- Anonymous users cannot access private Knowledge Base.
- Public nav does not show Library or Knowledge Base.
- Owner cannot see staff/admin-only documents.
- Placeholder content does not claim live usage intelligence.

## Edge Tests

- Empty corpus renders limited Knowledge Brief.
- Missing document renders shared missing-detail state.
- Document with no sections renders inspectable empty detail.
- Role changes update visible knowledge rows.
- Existing library routes do not leak private content.

## Acceptance Criteria

- Knowledge Base is a canonical owner/admin surface with role-safe read model.
- Library/training/corpus donors are reused, not exposed as public IA.
- Visibility is enforced before render.
- Owner rail includes Knowledge Base; public nav and account menu do not.
- Selected Knowledge Base detail renders one object and does not begin with
  global source totals.

## Non-Goals

- No public Library launch.
- No new vector store.
- No prompt/retrieval tuning UI.
- No fake knowledge usage analytics.

## Required Commands

```bash
npx vitest run src/lib/access/content-access.test.ts src/core/platform/knowledge-access/KnowledgeAccessService.test.ts src/lib/chat/retrieval-envelope.test.ts src/app/admin/content-visibility/page.test.tsx src/lib/shell/shell-navigation.test.ts
npm run typecheck
npm run lint:css
npm run lint -- src/lib/access/content-access.ts src/adapters/FileSystemCorpusRepository.ts src/core/platform/knowledge-access/KnowledgeAccessService.ts src/lib/chat/retrieval-envelope.ts src/lib/shell/shell-navigation.ts
```

## Static Scans

```bash
rg -n "library|Knowledge Base|corpus|training|content visibility|visibilityPolicy|public" src/app src/components src/lib src/core
```

## Closeout Evidence Required

- Knowledge Base route/read model inventory.
- Role visibility matrix.
- Desktop/mobile screenshots for base and selected detail.
- Tests proving access filtering.

## Closeout Evidence

See
`docs/_refactor/ordo/evidence/phase-01c3ax-knowledge-base-surface.md`.
