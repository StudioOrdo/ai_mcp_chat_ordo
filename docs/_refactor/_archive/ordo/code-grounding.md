# Code Grounding

Status: Initial inventory from current worktree on 2026-05-04.

This file records the code a future implementer should inspect before changing
the product shape. It is intentionally practical: preserve what is already good,
adapt feature islands, and remove old surfaces only after replacements pass.

## Public Routes And Shell

Current anchors:

- `src/app/page.tsx` - homepage currently resolves shell home and renders
  `ChatSurface`.
- `src/components/SiteNav.tsx` - public nav/account rail. It currently treats
  journal routes specially.
- `src/lib/shell/shell-navigation.ts` - route registry includes Home, Library,
  Journal, Referrals, My Media, Jobs, Admin, and internal surfaces.
- `src/app/about/page.tsx` - public about page already exists.
- `src/app/journal/page.tsx`, `src/app/journal/[slug]/page.tsx` - public
  journal route backed by blog posts.
- `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx` - legacy/public blog
  route.
- `src/app/library/**` - public corpus routes today.

Direction:

- Keep chat homepage.
- Add `/feed` as canonical public output route.
- Add `/offers`.
- Remove `/library` from the anonymous public product surface. Treat useful
  corpus behavior as internal, role-gated donor code.
- Replace `/journal` and `/blog` with `/feed`; there is no legacy user base
  requiring old public route preservation.

## Identity, Offers, And Configuration

Current anchors:

- `src/lib/config/defaults.ts` defines `InstanceIdentity`,
  `InstanceServices`, and `ServiceOffering`.
- `src/lib/config/instance.ts` loads `identity.json`, `prompts.json`,
  `services.json`, and `tools.json`.
- `src/lib/config/ConfigurationService.ts` resolves env first, then SQLite
  `system_settings`.
- `src/lib/config/instance.schema.ts` validates installed configuration.
- `src/app/install/*` and `src/app/api/install/*` handle first boot setup.

Direction:

- Use existing identity and services config for initial `/offers`.
- Avoid a new offer store until admin editing and metrics require it.
- Plan a future SQLite-backed `offers` table only when config files become
  insufficient.

## Access Control And Roles

Current anchors:

- `src/core/entities/user.ts` defines `ANONYMOUS`, `AUTHENTICATED`,
  `APPRENTICE`, `STAFF`, `ADMIN`.
- `src/lib/access/content-access.ts` defines content audiences and role access.
- `src/core/capability-catalog/*` defines tool roles, ownership, prompt hints,
  execution surfaces, and extension packs.
- `src/lib/tools/tool-availability-service.ts` gates effective tool
  availability.

Direction:

- Reuse current role/audience model for feed, internal corpus/knowledge,
  offers, agent views, and admin controls.
- Public agent views must never expose private tools, prompts, logs, workflow
  runs, or admin operations.

## Operations And Custom Action Buttons

Current anchors:

- `src/core/entities/operation.ts` defines operation state, steps, actions,
  events, artifacts, risks, visibility, and confirm policies.
- `src/core/use-cases/operations/*` owns operation state/policy.
- `src/lib/operations/*` owns intent, action dispatch, prompt grounding, and
  presentation.
- `src/frameworks/ui/operations/*` and
  `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx` render operation
  buttons.
- `src/app/api/operations/**` exposes operation APIs.

Direction:

- New complex work should become operation-backed workflow runs, not raw chat
  text or direct tool sequences.
- Confirmation buttons should be the default for publish, destructive, or
  irreversible steps.

## Content And Feed Donor Code

Current anchors:

- `src/core/entities/blog.ts` defines `BlogPost` with statuses
  `draft`, `review`, `approved`, `published`.
- `src/core/use-cases/BlogPostRepository.ts` defines current blog repository.
- `src/lib/blog/blog-article-production-service.ts` already implements compose,
  QA, revise, image prompt, image generation, draft, and artifacts.
- `src/core/capability-catalog/families/blog-capabilities.ts` defines blog and
  journal tools.
- `src/components/journal/PublicJournalPages.tsx` renders public journal pages.
- `src/lib/admin/attribution/admin-attribution.ts` links published journal
  posts to conversations, leads, deals, and estimated revenue.

Direction:

- Treat current blog/journal as a donor system for public feed and editorial
  workflow.
- Preserve draft/review/approved/published governance.
- Replace prompt-facing blog vocabulary with generic content/publication
  vocabulary once the feed path passes.

## Research, Corpus, And Search

Current anchors:

- `src/core/entities/research-packet.ts` defines structured sources and claims.
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts` provides
  corpus grounding.
- `src/core/platform/discovery-search/DiscoverySearchService.ts` searches
  shell routes, corpus, and admin entities.
- `src/lib/chat/search-pipeline.ts` wires hybrid search.
- `src/adapters/LocalEmbedder.ts`, `src/adapters/SQLiteVectorStore.ts`, and
  `src/adapters/SQLiteBM25IndexStore.ts` back the current local RAG stack.
- `docs/_refactor/rust_projects/rag_architecture_spec.md` describes the future
  Rust `ordo-search` strategy.
- `src/core/capability-catalog/families/corpus-capabilities.ts` and
  `src/core/capability-catalog/families/conversation-capabilities.ts` expose
  corpus and conversation recall.
- `src/core/capability-catalog/families/admin-capabilities.ts` exposes
  `admin_web_search`.

Direction:

- Build `ResearchBundle` by adapting `ResearchPacket`, corpus search,
  conversation recall, discovery, and web search.
- Do not hardwire the first workflow to a specific search tool.
- Keep Rust search as a planned backend swap, not a prerequisite for product
  proof.

## Assets And Materialization

Current anchors:

- `src/core/entities/asset-catalog.ts` defines logical asset entries.
- `src/core/platform/asset-catalog/AssetCatalogReader.ts` merges user files,
  materialization records, and blog assets.
- `src/core/entities/materialization.ts` records reusable tool outputs and
  evidence refs.
- `src/lib/db/tables.ts` includes `user_files`, `blog_assets`, and
  `materialization_records`.
- `src/app/my/media/page.tsx` and `src/components/media/UserMediaWorkspace.tsx`
  expose personal media.

Direction:

- Build a logical internal `Librarian` service over existing asset sources
  before creating a universal physical asset table.
- The agent should be able to ask one service what assets, sources, feed items,
  and workflow outputs exist for a topic.

## Media

Current anchors:

- `src/core/capability-catalog/families/media-capabilities.ts` defines
  `generate_chart`, `generate_graph`, `generate_audio`, `compose_media`, and
  asset discovery.
- `src/lib/media/workflows/*` owns media workflow state, repository, operation
  migration, reconciler, and factory helpers.
- `src/lib/media/ffmpeg/*`, `src/lib/media/server/*`, and
  `src/lib/media/browser-runtime/*` handle composition, rendering, and runtime
  fallback.
- `tests/evals/tool-workflow-coverage-eval.test.ts` and
  `src/lib/evals/tool-workflow-coverage.ts` already exercise media sequences.

Direction:

- Keep audio, charts, graphs, and short video as proof features.
- Wrap them as workflow steps and assets rather than exposing every internal
  helper as a prompt command.
- Use Rust later for deterministic media inspection/transcription/verification,
  not for orchestration policy.

## Referrals, Campaigns, And KPI Loop

Current anchors:

- `src/lib/db/tables.ts` includes `referrals` and `referral_events`.
- `src/app/referrals/*`, `src/app/r/[code]/*`, `src/app/api/referral/*`, and
  `src/app/api/qr/[code]/route.ts` implement QR/referral flows.
- `src/lib/referrals/campaign-presets.ts` defines starter campaign presets.
- `src/lib/referrals/campaign-queue.ts` queues campaign coach cards.
- `src/lib/admin/attribution/admin-attribution.ts` links journal content to
  conversations, leads, deals, and revenue.
- `src/core/entities/trust-distribution.ts` includes campaign refs.

Direction:

- Keep QR/referral as core because it proves solopreneur marketing value.
- Promote campaign presets into a durable campaign/pillar/KPI model when the
  feed and workflow output need attribution.

## Jobs, Factory, And Workflow Runs

Current anchors:

- `src/lib/db/tables.ts` includes `job_requests`, `job_events`,
  `factory_work_orders`, `factory_stage_runs`, `factory_outputs`, and
  `media_workflows`.
- `src/lib/factory/production-orchestrator.ts` runs stage-based factory work.
- `src/lib/factory/*operation*` projects factory work through operations.
- `src/lib/media/workflows/*operation*` projects media work through operations.
- `src/components/jobs/*` and `src/app/jobs/page.tsx` expose job state.
- `src/components/operations/*` and `src/app/operations/**` expose operation
  state.

Direction:

- Use operation truth as the top-level user-facing run model.
- Add workflow templates/versions/runs only where operation kinds and existing
  factory/media records cannot represent reusable product workflows cleanly.

## Evals And Evidence

Current anchors:

- `src/lib/evals/tool-coverage.ts` tests individual tool usage.
- `src/lib/evals/tool-workflow-coverage.ts` tests multi-tool workflows.
- `src/lib/evals/eval-artifacts.ts` writes durable eval artifacts.
- `tests/evals/*` covers scoring, reporting, workspace, artifacts, and live
  runner behavior.

Direction:

- Every migration phase should add deterministic tests and, when useful, live
  eval scenarios that leave inspectable artifacts.
- Do not accept a new workflow if the final conversation artifact cannot be
  inspected after the run.

## Cleanup Candidates

Do not delete these until replacement paths pass:

- prompt-facing blog step tools: `compose_blog_article`, `qa_blog_article`,
  `resolve_blog_article_qa`, `generate_blog_image_prompt`;
- public `/journal` and `/blog` as canonical names after `/feed` is stable;
- public `/library` exposure;
- feature-specific campaign coach queues if durable campaign records replace
  them;
- duplicated media/browser/native execution paths if the operation-backed media
  path fully owns workflow truth.
