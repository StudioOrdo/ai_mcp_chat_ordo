# Initial Code Inventory

Status: Initial research snapshot
Date: 2026-05-04

This evidence file summarizes the code areas inspected while creating the Ordo
product-shape package.

## Commands Used

- `rg --files src`
- `find src -maxdepth 2 -type d`
- `find tests -maxdepth 2 -type f`
- `find crates -maxdepth 3 -type f`
- `find docs/_refactor -maxdepth 3 -type f`
- targeted `sed` reads of route, DB, operation, media, referral, config,
  capability, and eval files.

## Source Area Inventory

Top-level current source areas that matter to this plan:

- `src/app` - public routes, auth routes, admin routes, operations, jobs,
  library, journal, blog, referrals, install, profile, workspace.
- `src/components` - public reading components, admin surfaces, jobs,
  operations, media workspace, referrals, shell, profile.
- `src/core` - entities, capability catalog, ports, platform services,
  tool registry, use cases.
- `src/frameworks/ui` - chat primitives, operation UI, product experience
  facade, jobs rail.
- `src/hooks/chat` - chat runtime, stream handling, bootstrap, send policy.
- `src/lib` - access, admin, AI, analytics, appliance, audio, blog, chat,
  config, DB, diagnostics, evals, factory, graphs, health, jobs, journal,
  lifecycle, media, observability, operations, referrals, search, security,
  shell, storage, tools, web search.
- `src/adapters` - concrete persistence/search/provider adapters.

Current Rust area:

- `crates/ordo-backup` - archive, backup, restore, command store, native
  contract, daemon, and governed executor tests.

## Test Area Inventory

Test families already available for this work:

- public/content routes: `tests/public-content-routes.test.ts`,
  `tests/journal-public-route-convergence.test.ts`,
  `tests/seo-infrastructure.test.ts`;
- shell/homepage: `tests/homepage-shell-*.test.tsx`,
  `tests/browser-ui/home-shell-header.spec.ts`;
- chat/tools: `tests/chat/**`, `tests/core/tool-policy-pipeline.test.ts`,
  `tests/registry-executor-unification.test.ts`;
- operations/jobs: `tests/job-*.test.ts`, `tests/jobs/**`,
  `src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts`;
- blog/content: `tests/blog-*.test.ts`, `tests/deferred-blog-*.test.ts`;
- media: `tests/browser-graph-*.test.tsx`,
  `tests/browser-ui/media-*.spec.ts`, `tests/media-architecture-audit.test.ts`;
- referrals/attribution: `tests/admin-attribution*.test.ts`,
  `tests/admin-affiliates-page.test.tsx`, `tests/admin-leads-pipeline.test.tsx`;
- evals: `tests/evals/**`;
- appliance/rust/image: `tests/appliance-*.test.ts`,
  `tests/docker-*.test.ts`, `tests/image-*.test.ts`,
  `crates/ordo-backup/tests/governed_executor.rs`.

## Public Site And Shell

Inspected:

- `src/app/page.tsx`
- `src/components/SiteNav.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/app/about/page.tsx`
- `src/app/journal/page.tsx`
- `src/app/blog/page.tsx`
- `src/app/library/**`

Finding:

The chat homepage already exists. Public content is split across blog, journal,
and library routes. The product plan should introduce `/feed` as canonical and
keep compatibility routes until tests prove replacement behavior.

## Configuration And Offers

Inspected:

- `src/lib/config/defaults.ts`
- `src/lib/config/instance.ts`
- `src/lib/config/ConfigurationService.ts`
- `src/lib/config/instance.schema.ts`
- `src/app/install/**`

Finding:

Instance identity and services already model the first version of business
profile and offers. New offer storage should wait until admin editing and
metrics make file/config-backed offers insufficient.

## Roles And Access Control

Inspected:

- `src/core/entities/user.ts`
- `src/lib/access/content-access.ts`
- `src/core/capability-catalog/**`
- `src/lib/tools/tool-availability-service.ts`

Finding:

The current role/audience model is enough for public, authenticated, staff, and
admin help/content gates. Agent-readable public views need a strict allow-list
instead of reusing internal discovery output directly.

## Operations And Buttons

Inspected:

- `src/core/entities/operation.ts`
- `src/core/use-cases/operations/**`
- `src/lib/operations/**`
- `src/frameworks/ui/operations/**`
- `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx`
- `src/app/api/operations/**`

Finding:

Operations are the correct source of truth for complex work. Custom message
buttons already exist and should become the normal interaction for confirmation,
publish, restore, and workflow-run actions.

## Content And Publishing

Inspected:

- `src/core/entities/blog.ts`
- `src/core/use-cases/BlogPostRepository.ts`
- `src/lib/blog/blog-article-production-service.ts`
- `src/core/capability-catalog/families/blog-capabilities.ts`
- `src/components/journal/PublicJournalPages.tsx`
- `src/lib/admin/attribution/admin-attribution.ts`

Finding:

Blog/journal code is the donor system for feed publishing and editorial review.
The target should keep status governance but replace feature-specific prompt
vocabulary with generic content/publication concepts.

## Research And Search

Inspected:

- `src/core/entities/research-packet.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/core/platform/discovery-search/DiscoverySearchService.ts`
- `src/lib/chat/search-pipeline.ts`
- `src/adapters/LocalEmbedder.ts`
- `src/adapters/SQLiteVectorStore.ts`
- `src/adapters/SQLiteBM25IndexStore.ts`
- `docs/_refactor/rust_projects/rag_architecture_spec.md`

Finding:

ResearchBundle can be built by composing existing research packets, corpus
search, discovery search, conversation recall, and web research. Rust search is
a future backend boundary, not a prerequisite for the product proof.

## Assets And Media

Inspected:

- `src/core/entities/asset-catalog.ts`
- `src/core/platform/asset-catalog/AssetCatalogReader.ts`
- `src/core/entities/materialization.ts`
- `src/core/capability-catalog/families/media-capabilities.ts`
- `src/lib/media/workflows/**`
- `src/lib/media/ffmpeg/**`
- `src/app/my/media/page.tsx`
- `src/components/media/UserMediaWorkspace.tsx`

Finding:

Existing asset and media systems can support charts, graphs, audio, and shorts
as workflow outputs. The plan should avoid creating another media island.

## Referrals And KPI Loop

Inspected:

- `src/lib/db/tables.ts`
- `src/app/referrals/**`
- `src/app/r/[code]/**`
- `src/app/api/referral/**`
- `src/app/api/qr/[code]/route.ts`
- `src/lib/referrals/campaign-presets.ts`
- `src/lib/referrals/campaign-queue.ts`
- `src/lib/admin/attribution/admin-attribution.ts`

Finding:

QR/referrals already exist and should remain core. The product plan should
connect referrals to campaign pillars, feed items, and business outcomes.

## Jobs, Factory, Workflows, And Evals

Inspected:

- `src/lib/factory/production-orchestrator.ts`
- `src/lib/factory/**`
- `src/components/jobs/**`
- `src/app/jobs/page.tsx`
- `src/lib/evals/tool-coverage.ts`
- `src/lib/evals/tool-workflow-coverage.ts`
- `src/lib/evals/eval-artifacts.ts`
- `tests/evals/**`

Finding:

Factory/media/job systems provide reusable execution ideas, but workflow
templates and inspectable runs need a product-level abstraction on top of
operations. Evals already support durable artifacts and should be expanded for
the flagship workflow.
