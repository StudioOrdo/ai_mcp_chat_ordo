# 02 UI Surface Realignment: Knowledge Base Surface

Status: Draft spec

## Goal

Define Knowledge Base as the owner/admin-accessible business brain, not a public
Library. It should reuse existing corpus, training, content visibility, and
retrieval infrastructure while respecting role visibility and progressive
disclosure.

## Current Code Grounding

Current anchors:

- `src/app/library/page.tsx`
- `src/app/library/[document]/page.tsx`
- `src/app/library/[document]/[section]/page.tsx`
- `src/app/library/section/[slug]/page.tsx`
- `src/app/admin/training/page.tsx`
- `src/app/admin/training/[bookSlug]/page.tsx`
- `src/app/admin/training/[bookSlug]/[chapterSlug]/page.tsx`
- `src/app/admin/content-visibility/page.tsx`
- `src/lib/access/content-access.ts`
- `src/adapters/FileSystemCorpusRepository.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/lib/chat/retrieval-envelope.ts`
- `src/core/entities/ordo-object.ts`

## Verified Current State

- Public/role visibility exists for content and corpus access.
- Library routes exist but are not canonical public surfaces.
- Admin training routes expose training/corpus style content.
- Content visibility admin exists and should be the diagnostic/admin control
  for visibility.
- The shell owner rail does not include Knowledge Base yet.
- The current object-centered surface enum does not have a dedicated
  `knowledge_base` target surface.

## Target Behavior

Knowledge Base should be a canonical owner surface only after it has:

- a read model;
- a second-column selector for sources, documents, sections, and notes;
- a base Knowledge Brief;
- selected document/section detail;
- role-aware visibility;
- source/evidence links back into chat retrieval and content visibility.

Second column:

- compact overview;
- search knowledge;
- filters by source, visibility, role, recency, and usage;
- document/section rows.

Main pane:

- base route renders Knowledge Brief;
- selected detail renders one document, section, source, or note;
- admin diagnostics link to content visibility and corpus tooling.

## Reuse / Move / Hide / Mock Decisions

- Reuse corpus repository, content access, and knowledge access services.
- Move library route value into Knowledge Base rather than public nav.
- Hide public Library until there is an intentional public content product.
- Mock only empty Knowledge Brief and deterministic document rows from existing
  local corpus metadata.
- Add a dedicated surface kind later if needed instead of overloading `public`.

## Positive Tests

- Owner Knowledge Base route filters by role visibility.
- Public users cannot access private/member/admin knowledge.
- Second column search matches document, section, title, and source labels.
- Selected detail shows source, visibility, and evidence refs.
- Admin users can navigate to visibility controls from Knowledge Base detail.

## Negative Tests

- Public top nav does not show Library or Knowledge Base.
- Knowledge Base does not expose admin-only content to owners.
- Search results do not include documents outside the user's visibility.
- Placeholder rows do not claim live usage intelligence.

## Edge Tests

- Empty corpus renders a limited Knowledge Brief.
- A document with no sections renders an inspectable empty detail.
- Missing document id renders shared missing-detail state.
- Admin-only document displays for admin and hides for owner.
- Existing `/library/*` routes redirect or render donor placeholders until
  migration is complete.

## Acceptance Criteria

- Knowledge Base has a clear route decision and is not public Library.
- Read model owns visibility filtering before React renders rows.
- No public route leaks private corpus/content.
- Admin content visibility remains the authority for visibility changes.

## Non-Goals

- No public Library launch.
- No new vector database.
- No prompt editing or retrieval tuning in this phase package.
- No fake usage analytics.

## Required Commands

```bash
npx vitest run src/lib/access/content-access.test.ts src/core/platform/knowledge-access/KnowledgeAccessService.test.ts src/lib/chat/retrieval-envelope.test.ts src/app/admin/content-visibility/page.test.tsx
npm run typecheck
npm run lint -- src/lib/access/content-access.ts src/adapters/FileSystemCorpusRepository.ts src/core/platform/knowledge-access/KnowledgeAccessService.ts src/lib/chat/retrieval-envelope.ts
rg -n "library|corpus|training|content visibility|Knowledge Base" src/app src/components src/lib src/core
```

## Closeout Evidence Required

- Inventory of donor routes reused for Knowledge Base.
- Visibility matrix for anonymous, owner, staff, and admin.
- Test output proving role-filtered access.
- Screenshot of Knowledge Base base brief and selected detail when implemented.
