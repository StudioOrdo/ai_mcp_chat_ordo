# Phase 01c3ax Evidence: Knowledge Base Surface

Date: 2026-05-07

Status: Implemented

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- Knowledge Base is an authenticated owner/admin source-evidence surface, not a
  public Library product route.
- The second column is a knowledge/document/section selector, not a dashboard.
- Base `/knowledge` renders a deterministic Knowledge Brief.
- Selected `/knowledge?document=...&section=...` renders one selected source
  detail and does not begin with global source totals.
- Visibility filtering happens in the read model before React renders rows.
- Admin visibility/training controls remain role-gated.
- No live retrieval usage metrics, ranking analytics, or fake intelligence are
  inferred.

## Code Files Changed

- `src/app/knowledge/page.tsx`
- `src/app/knowledge/page.test.tsx`
- `src/lib/knowledge/load-knowledge-base-workspace.ts`
- `src/lib/knowledge/load-knowledge-base-workspace.test.ts`
- `src/components/knowledge/KnowledgeBaseWorkspace.tsx`
- `src/components/knowledge/KnowledgeBaseWorkspace.test.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/shell-navigation.test.ts`
- `src/core/entities/ordo-object.ts`
- `src/core/entities/ordo-object.test.ts`
- `src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/lib/chat/retrieval-envelope.test.ts`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3ax-knowledge-base-surface.md`
- `docs/_refactor/ordo/evidence/phase-01c3ax-knowledge-base-surface.md`
- `docs/_refactor/ordo/prompts/next.md`
- `docs/_refactor/ordo/prompts/archive/01c3ay-system-sections-and-backup-restore-brief-parity.md`

## Route And Read Model Inventory

- `/knowledge` is the authenticated Knowledge Base owner/admin route.
- `/library`, `/library/[document]`, `/library/[document]/[section]`, and
  `/library/section/[slug]` remain hidden donor routes that call `notFound()`.
- `loadKnowledgeBaseWorkspace` reads from the existing corpus repository,
  filters documents/sections with `canUserAccessAudience`, and then produces a
  `GovernanceSectionFrame` model.
- The shell registry adds a dedicated `knowledge-base` route with
  `targetSurface: "knowledge_base"`.
- `Knowledge Base` appears in the authenticated owner rail and mobile drawer.
- `Knowledge Base` and `Library` do not appear in the public top nav.
- The account menu remains `My Account` and `Affiliate Dashboard` only.

## Visibility Matrix

| Viewer | `/knowledge` route | Visible source rows | Admin links |
| --- | --- | --- | --- |
| Anonymous | Redirects to `/login` | None | No |
| Authenticated owner | Public, member/account, and premium when tier allows | Yes, role-filtered | No |
| Staff | Public, account/member, premium, apprentice, and staff | Yes, role-filtered | No |
| Admin | All audiences including admin | Yes | Yes, content visibility and training donor links |

## Implementation Evidence

The Knowledge Base base route renders `Knowledge Brief` with explicit
limitations:

- no live usage/ranking/retrieval-performance metrics are inferred;
- the source index is role-filtered before render;
- chat remains the operating interface.

The selected detail route renders one document or one section with:

- type;
- visibility;
- source label;
- document identity;
- source preview;
- related source links;
- admin-only visibility/training links when the read model includes them.

The owner rail order is now:

1. Conversations
2. Today
3. Studio
4. People
5. Offers
6. About
7. Knowledge Base

## QA Pass 1

Commands run:

```bash
npx vitest run src/lib/knowledge/load-knowledge-base-workspace.test.ts src/components/knowledge/KnowledgeBaseWorkspace.test.tsx src/app/knowledge/page.test.tsx src/lib/shell/shell-navigation.test.ts src/core/entities/ordo-object.test.ts src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
npm run typecheck
npm run lint -- src/lib/knowledge/load-knowledge-base-workspace.ts src/components/knowledge/KnowledgeBaseWorkspace.tsx src/app/knowledge/page.tsx src/lib/shell/shell-navigation.ts src/core/entities/ordo-object.ts src/components/AuthenticatedWorkRail.tsx
```

Results:

- Focused implementation tests passed after one fix: 6 files, 43 tests.
- Typecheck passed.
- Focused lint passed.

Issues found and fixed:

- Knowledge search initially did not match section body preview text. The read
  model search haystack now includes `contentPreview`.

## Visual QA

The local dev server was reachable, but `/knowledge` returned a `307`
redirect to `/install` in this shell context. Authenticated screenshot evidence
was therefore blocked. DOM/render/route/static evidence was used instead.

## QA Pass 2

Commands run:

```bash
npx vitest run src/lib/access/content-access.test.ts src/core/platform/knowledge-access/KnowledgeAccessService.test.ts src/lib/chat/retrieval-envelope.test.ts src/app/admin/content-visibility/page.test.tsx src/lib/shell/shell-navigation.test.ts
npx vitest run src/lib/knowledge/load-knowledge-base-workspace.test.ts src/components/knowledge/KnowledgeBaseWorkspace.test.tsx src/app/knowledge/page.test.tsx src/core/entities/ordo-object.test.ts src/lib/product-kernel/solopreneur-operating-loop-closeout.test.ts
npm run typecheck
npm run lint:css
npm run lint -- src/lib/access/content-access.ts src/adapters/FileSystemCorpusRepository.ts src/core/platform/knowledge-access/KnowledgeAccessService.ts src/lib/chat/retrieval-envelope.ts src/lib/shell/shell-navigation.ts src/lib/knowledge/load-knowledge-base-workspace.ts src/components/knowledge/KnowledgeBaseWorkspace.tsx src/app/knowledge/page.tsx src/core/entities/ordo-object.ts src/components/AuthenticatedWorkRail.tsx
rg -n "library|Knowledge Base|corpus|training|content visibility|visibilityPolicy|public" src/app src/components src/lib src/core
```

Results:

- Required phase tests passed: 9 files, 70 tests.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.
- Static scans were reviewed. Broad scans include expected matches in hidden
  donor Library routes, admin content visibility, corpus access/readers, tests,
  styles, and the new Knowledge Base route/component. No public nav, account
  menu, or owner detail leak was found.
- Hydration-unsafe date/random scan returned no matches in the Knowledge Base
  route, read model, or component.

Issues found and fixed:

- No new QA pass 2 implementation issues were found.
- Phase/evidence docs were updated to match the final implementation and QA
  outcome.

## Prompt Handoff

The next phase prompt was written to:

- `docs/_refactor/ordo/prompts/next.md`
- `docs/_refactor/ordo/prompts/archive/01c3ay-system-sections-and-backup-restore-brief-parity.md`

Both files target:

- `docs/_refactor/ordo/phases/01c3ay-system-sections-and-backup-restore-brief-parity.md`
