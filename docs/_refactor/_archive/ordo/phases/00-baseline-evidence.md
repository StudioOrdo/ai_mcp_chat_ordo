# Phase 00: Baseline Evidence

Status: Complete

## Goal

Capture current product, route, tool, operation, content, media, referral,
search, asset, eval, and config state before implementation.

## Current Code Grounding

Start with:

- `../code-grounding.md`
- `src/app/page.tsx`
- `src/components/SiteNav.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`
- `src/core/capability-catalog/families/*`
- `src/core/entities/operation.ts`
- `src/core/entities/blog.ts`
- `src/core/entities/research-packet.ts`
- `src/core/entities/asset-catalog.ts`
- `src/lib/referrals/*`
- `src/lib/media/workflows/*`
- `src/lib/evals/*`

## Tasks

- Record current public routes and whether each is canonical, internal,
  compatibility, or optional.
- Record current table inventory for content, jobs, referrals, assets, media,
  factory, operations, backups, and search.
- Record current prompt-visible tool inventory and extension pack ownership.
- Record current tests that should be reused.
- Record cleanup candidates and dependencies.

## Evidence Commands

```bash
rg --files src/app src/components src/lib src/core tests
rg "CREATE TABLE IF NOT EXISTS" src/lib/db/tables.ts src/lib/db/migrations.ts
rg "CAPABILITIES|compose_media|produce_blog_article|admin_web_search|search_corpus" src/core src/lib tests
rg "feed|journal|blog|library|offers|referrals|campaign|asset|operation" src tests
```

## Positive Use Cases

- Future phases can cite the evidence without rediscovering baseline facts.
- Existing systems to reuse are clearly separated from cleanup candidates.

## Negative Use Cases

- Evidence must not assume current docs are current if code says otherwise.
- Evidence must not claim a feature exists just because there is a route name.

## Edge Use Cases

- Dirty worktree with ongoing untracked phase work.
- Empty database.
- Disabled optional providers.
- Public library disabled after current code assumes it is public.

## Exit Criteria

- `../evidence/phase-00-baseline.md` exists.
- Evidence lists exact code/test anchors.
- Evidence includes first implementation phase risks.

## Completion Notes

Completed: 2026-05-04

Evidence:

- `../evidence/phase-00-baseline.md`

Baseline findings:

- `/feed` and `/offers` do not exist yet.
- `/library` and `/journal` are the current primary public shell routes.
- `/about` exists but is not registered in shell navigation.
- The capability catalog currently contains 69 tools; the effective manifest
  reports 66 enabled and 3 provider-disabled tools.
- `admin_web_search`, `generate_audio`, and `generate_blog_image` are
  provider-disabled in the current baseline.
- Operations are the correct truth layer for future workflows, but
  `content_publish`, `system_diagnostic`, and generic `tool_task` should not be
  treated as fully executable yet.
- Existing blog/journal, referral, media, search, and eval systems are donor
  systems for later phases, not cleanup targets until replacement paths pass.
