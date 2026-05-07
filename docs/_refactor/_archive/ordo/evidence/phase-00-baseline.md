# Phase 00 Baseline Evidence

Status: Complete
Date: 2026-05-04

## Scope

This evidence captures the current Ordo product, route, table, tool,
operation, content, media, referral, search, asset, eval, and config state
before the Ordo product-shape refactor starts.

This is a snapshot of a dirty worktree. Do not infer repository cleanliness
from this file. The goal is to ground future phases in current code, not to
certify unrelated pending edits.

## Commands Run

Representative commands used during this baseline:

```bash
sed -n '1,220p' docs/_refactor/ordo/phases/00-baseline-evidence.md
sed -n '1,260p' src/lib/shell/shell-navigation.ts
sed -n '1,260p' src/components/SiteNav.tsx
find src/app -type f \( -name 'page.tsx' -o -name 'route.ts' \) | sort
rg -n "CREATE TABLE IF NOT EXISTS|CREATE VIRTUAL TABLE|ALTER TABLE|CREATE INDEX IF NOT EXISTS" src/lib/db/tables.ts src/lib/db/migrations.ts
perl -ne 'print "$1\n" if /CREATE (?:VIRTUAL )?TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)/' src/lib/db/tables.ts src/lib/db/migrations.ts | sort -u
perl -ne 'print "$1\n" if /^  ([a-zA-Z0-9_]+):/' src/core/capability-catalog/families/*.ts | sort -u
npx tsx -e "import { CAPABILITY_CATALOG } from './src/core/capability-catalog/catalog'; console.log(Object.keys(CAPABILITY_CATALOG).length)"
npx tsx -e "import { getToolAvailabilityService } from './src/lib/tools/tool-availability-service'; const svc=getToolAvailabilityService(); const m=svc.getEffectiveManifestSync(); console.log(svc.summarizeByState(m))"
npx tsx -e "import { TOOL_BUNDLE_REGISTRY } from './src/lib/chat/tool-composition-root'; console.log(TOOL_BUNDLE_REGISTRY.map(b=>b.id))"
node -e "const pkg=require('./package.json'); console.log(JSON.stringify(pkg.scripts,null,2))"
find tests src -type f \( -name '*route*.test.ts' -o -name '*public*.test.ts' -o -name '*shell*.test.tsx' -o -name '*media*.test.ts' -o -name '*operation*.test.ts' -o -name '*eval*.test.ts' \) | sort
```

## Public Route Baseline

Current public/product routes found in `src/app`:

- `/` exists and renders `ChatSurface mode="embedded"` from `src/app/page.tsx`.
- `/about` exists.
- `/library` exists and has nested document/section routes.
- `/journal` exists and has `[slug]` detail routes.
- `/blog` exists and has `[slug]` detail routes.
- `/r/[code]` exists for referral entry.
- `/referrals` exists as a signed-in workspace route.
- `/jobs`, `/my/media`, `/workspace`, `/profile`, `/operations`, and
  `/operations/media` exist as signed-in or operational workspace routes.
- `/admin/**` exists for administrative surfaces.
- `/install`, `/login`, `/register`, `/signup`, and `/welcome` exist.

Target routes not present yet:

- `/feed`
- `/offers`

Shell navigation state:

- `SHELL_ROUTES` currently registers `home`, `corpus` (`/library`),
  `journal` (`/journal`), admin routes, workspace routes, referrals, jobs,
  media, login/register, and legacy book routes.
- `PRIMARY_NAV_ROUTE_IDS` is currently `["corpus", "journal"]`.
- `RAIL_MENU_ROUTE_IDS` is currently `["corpus", "journal"]`.
- `SHELL_FOOTER_GROUPS.information` currently routes to `corpus` and
  `journal`.
- `SiteNav` applies a special quiet tone for `/journal` routes.
- `/about` exists but is not currently registered as a shell route.
- `/feed` and `/offers` are not shell routes.

Baseline classification:

| Route | Current Classification | Target Direction |
| --- | --- | --- |
| `/` | canonical public chat homepage | keep canonical |
| `/about` | public page, not shell-nav canonical | add to public shell |
| `/library` | public primary shell route | make internal by default, optional public |
| `/journal` | public primary shell route | compatibility after `/feed` exists |
| `/blog` | public/legacy publishing route | compatibility or redirect after `/feed` |
| `/feed` | missing | new canonical public output route |
| `/offers` | missing | new canonical public business route |
| `/r/[code]` | public referral entry | keep core |
| `/referrals` | signed-in referral workspace | keep core |
| `/operations/**` | operation workspace/API | reuse for workflow truth |
| `/admin/**` | admin/staff surfaces | reuse and prune later |

## Database Table Baseline

Tables found in `src/lib/db/tables.ts` and `src/lib/db/migrations.ts`:

```text
backup_policy
backup_restore_audit_events
backup_snapshots
blog_assets
blog_post_artifacts
blog_post_revisions
blog_posts
bm25_stats
consultation_requests
conversation_events
conversation_purge_audits
conversations
deal_records
embedding_fts
embeddings
factory_checkpoints
factory_composition_assets
factory_events
factory_outputs
factory_production_dags
factory_stage_runs
factory_work_order_parents
factory_work_orders
identity_migration_events
job_events
job_requests
lead_records
materialization_records
media_workflow_events
media_workflow_steps
media_workflows
messages
operation_actions
operation_artifacts
operation_events
operation_steps
operations
prompt_bindings
prompt_provenance_records
push_subscriptions
referral_events
referrals
relationship_memory_records
restore_plans
roles
sessions
system_commands
system_prompts
training_path_records
user_files
user_preferences
user_roles
users
```

Grouped baseline:

- Identity/auth: `users`, `roles`, `user_roles`, `sessions`,
  `user_preferences`.
- Conversations/prompts: `conversations`, `messages`, `conversation_events`,
  `conversation_purge_audits`, `relationship_memory_records`,
  `prompt_provenance_records`, `prompt_bindings`, `system_prompts`.
- Business/admin records: `lead_records`, `consultation_requests`,
  `deal_records`, `training_path_records`.
- Search/RAG: `embeddings`, `bm25_stats`, `embedding_fts`.
- Assets/materialization: `user_files`, `materialization_records`.
- Referral/KPI donor system: `referrals`, `referral_events`.
- Content donor system: `blog_posts`, `blog_assets`,
  `blog_post_artifacts`, `blog_post_revisions`.
- Jobs/factory/media: `job_requests`, `job_events`, `factory_work_orders`,
  `factory_stage_runs`, `factory_outputs`, `factory_events`,
  `factory_checkpoints`, `factory_composition_assets`,
  `factory_production_dags`, `factory_work_order_parents`,
  `media_workflows`, `media_workflow_steps`, `media_workflow_events`.
- Backup/restore/appliance: `system_commands`, `backup_snapshots`,
  `backup_policy`, `backup_restore_audit_events`, `restore_plans`.
- Operations: `operations`, `operation_steps`, `operation_events`,
  `operation_actions`, `operation_artifacts`.

Missing target concepts as first-class tables:

- `feed_items`
- `offers`
- `business_profiles`
- `content_pillars`
- `research_bundles`
- `synthesis_briefs`
- `reviews`
- `workflow_templates`
- `workflow_versions`
- `workflow_runs`

Do not add all of these by default. Future phases should first adapt current
tables and add new storage only when current structures cannot safely model the
target concept.

## Tool And Capability Baseline

Current catalog count from `CAPABILITY_CATALOG`: 69 tools.

Tool bundles from `TOOL_BUNDLE_REGISTRY`:

- `admin`
- `affiliate`
- `blog`
- `calculator`
- `conversation`
- `corpus`
- `job`
- `media`
- `navigation`
- `profile`
- `theme`

Current catalog tools:

```text
adjust_ui
admin_prioritize_leads
admin_prioritize_offer
admin_search
admin_triage_routing_risk
admin_web_search
approve_journal_post
calculator
cancel_appliance_restore
compose_blog_article
compose_media
configure_backup_policy
configure_tool_availability
confirm_appliance_restore
create_appliance_backup
draft_content
execute_appliance_restore
generate_audio
generate_blog_image
generate_blog_image_prompt
generate_chart
generate_graph
get_admin_affiliate_summary
get_checklist
get_corpus_summary
get_current_page
get_deferred_job_status
get_journal_post
get_journal_workflow_summary
get_my_affiliate_summary
get_my_job_status
get_my_profile
get_my_referral_qr
get_section
inspect_runtime_context
inspect_runtime_logs
inspect_theme
list_admin_referral_exceptions
list_appliance_backups
list_available_pages
list_conversation_media_assets
list_deferred_jobs
list_journal_posts
list_journal_revisions
list_my_jobs
list_my_referral_activity
list_practitioners
navigate_to_page
prepare_appliance_restore
prepare_journal_post_for_publish
produce_blog_article
produce_product
publish_content
publish_journal_post
qa_blog_article
request_pre_restore_backup
resolve_blog_article_qa
restore_journal_revision
search_corpus
search_my_conversations
search_relationship_memory
select_journal_hero_image
set_preference
set_theme
submit_journal_review
update_journal_draft
update_journal_metadata
update_my_profile
validate_appliance_backup
```

Extension pack ownership:

- `publishing`: draft/publish content, journal management, blog article
  production, blog image generation, prepare journal publish.
- `media`: list conversation media assets, chart, graph, audio, compose media.
- `referrals`: personal and admin affiliate/referral summaries.
- `admin_intelligence`: admin web search, backup/restore, tool availability,
  factory product production, admin prioritization, runtime logs, admin search.

Current effective tool manifest:

- version: `a9a1b2c0f445428f`
- `enabled`: 66
- `provider_disabled`: 3
- warning: runtime tool settings unavailable and ignored.

Provider-disabled tools at baseline:

- `admin_web_search` -> provider slot `web_search`
- `generate_audio` -> provider slot `tts`
- `generate_blog_image` -> provider slot `image`

Baseline implication:

- The product plan must not assume web search, TTS, or image generation is
  always available.
- Phase 01 should not widen the prompt-visible tool surface.
- Later pruning should converge many feature-specific blog/media tools into
  fewer workflow-backed operations.

## Operation Baseline

Operation kinds from `src/core/entities/operation.ts`:

- `backup_create`
- `restore_execute`
- `media_workflow`
- `factory_work_order`
- `system_diagnostic`
- `tool_task`
- `content_publish`
- `onboarding_flow`
- `help_flow`

Operation statuses:

- `draft`
- `awaiting_confirmation`
- `queued`
- `running`
- `blocked`
- `succeeded`
- `failed`
- `cancelled`
- `expired`

Confirmation policies:

- `none`
- `single_click`
- `phrase`
- `admin_reauth`

Current operation implementation anchors:

- `src/core/use-cases/operations/OperationKindRegistry.ts`
- `src/core/use-cases/operations/OperationDraftFactory.ts`
- `src/core/use-cases/operations/OperationActionDispatch.ts`
- `src/lib/operations/operation-action-view-model.ts`
- `src/lib/operations/operation-prompt-grounding.ts`
- `src/frameworks/ui/operations/OperationActionButton.tsx`
- `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx`
- `src/app/api/operations/**`

Important baseline gap:

- `content_publish` currently creates a `Review Publish Plan` action, but
  `OperationDraftFactory` marks it disabled with:
  `Content publish operation execution is not registered in Phase 04.`
- `system_diagnostic` and generic `tool_task` currently expose no executable
  default action from `OperationDraftFactory`.

Baseline implication:

- Future workflow phases should reuse operations as the truth layer, but must
  not assume every operation kind has a completed executor.
- Publish, destructive restore, and reusable workflow actions should use
  operation buttons rather than prose-only chat instructions.

## Content And Feed Baseline

Content donor system:

- `src/core/entities/blog.ts` defines `BlogPost`.
- Current statuses: `draft`, `review`, `approved`, `published`.
- Current sections: `essay`, `briefing`.
- `src/lib/blog/blog-article-production-service.ts` owns compose, QA, revise,
  image prompt, image generation, draft creation, and artifact behavior.
- `src/components/journal/PublicJournalPages.tsx` renders public journal pages.
- `src/lib/admin/attribution/admin-attribution.ts` links published journal
  posts to conversations, leads, deals, and estimated revenue.

Target gap:

- No canonical `PublicFeedItem` model exists yet.
- `/feed` does not exist.
- Feed/RSS/content-negotiation behavior is not implemented yet.

Baseline implication:

- Phase 02 should adapt blog/journal first, not replace content storage
  immediately.
- Blog/journal routes should remain compatibility surfaces until `/feed` tests
  pass.

## Research, Search, Corpus, And Assets Baseline

Research anchors:

- `src/core/entities/research-packet.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/core/platform/discovery-search/DiscoverySearchService.ts`
- `src/lib/chat/search-pipeline.ts`
- `src/adapters/LocalEmbedder.ts`
- `src/adapters/SQLiteVectorStore.ts`
- `src/adapters/SQLiteBM25IndexStore.ts`
- `src/core/capability-catalog/families/corpus-capabilities.ts`
- `src/core/capability-catalog/families/conversation-capabilities.ts`

Current `ResearchPacket` already models:

- sources with URL, retrieval timestamp, and relevance score;
- claims with supporting source IDs and confidence;
- validation for missing sources and empty evidence.

Asset anchors:

- `src/core/entities/asset-catalog.ts`
- `src/core/entities/materialization.ts`
- `src/core/platform/asset-catalog/AssetCatalogReader.ts`
- `src/app/my/media/page.tsx`
- `src/components/media/UserMediaWorkspace.tsx`

Current `AssetCatalogEntry` merges:

- user file assets;
- blog assets;
- materialization metadata.

Target gap:

- No single public/product `Librarian` API exists for "what do we know/have
  about this topic?" across corpus, source refs, assets, workflow outputs, and
  feed items.

Baseline implication:

- Phase 04 should wrap current research/search/assets rather than add a new
  universal asset table first.

## Media Baseline

Media anchors:

- `src/core/capability-catalog/families/media-capabilities.ts`
- `src/lib/media/workflows/types.ts`
- `src/lib/media/workflows/orchestrator.ts`
- `src/lib/media/workflows/sqlite-media-workflow-repository.ts`
- `src/lib/media/workflows/media-workflow-operation-executor.ts`
- `src/lib/media/workflows/media-workflow-operation-reconciler.ts`
- `src/lib/media/ffmpeg/**`
- `src/lib/media/server/**`
- `src/lib/media/browser-runtime/**`
- `src/lib/jobs/generate-audio-deferred-job.ts`
- `src/lib/jobs/compose-media-deferred-job.ts`

Current media workflow deliverables:

- `video`
- `audio`
- `chart`
- `image`

Current media workflow step kinds:

- `generate_chart`
- `generate_audio`
- `generate_image`
- `compose_media`
- `reuse_asset`

Provider status:

- `generate_audio` is provider-disabled in the current manifest.
- `generate_blog_image` is provider-disabled in the current manifest.

Baseline implication:

- Phase 08 can keep charts, graphs, audio, and short video in scope, but must
  handle provider-disabled states and reusable assets.
- Rust media verification/transcription should remain optional until the
  TypeScript workflow proof exists.

## Referrals, Campaigns, And KPI Baseline

Referral anchors:

- `src/lib/db/tables.ts` tables `referrals` and `referral_events`.
- `src/app/referrals/page.tsx`
- `src/app/r/[code]/page.tsx`
- `src/app/api/referral/[code]/route.ts`
- `src/app/api/referral/visit/route.ts`
- `src/app/api/qr/[code]/route.ts`
- `src/lib/referrals/referral-origin.ts`
- `src/lib/referrals/campaign-presets.ts`
- `src/lib/referrals/campaign-queue.ts`
- `src/lib/admin/attribution/admin-attribution.ts`

Current campaign presets:

- `friends_and_family`
- `local_flyers`
- `lightweight_paid_outreach`

Current campaign coach note:

- Anonymous referral introduction still points users toward `/library`.

Baseline implication:

- QR/referral is a real current strength and should remain core.
- Phase 05 should connect campaigns, content pillars, feed items, and referral
  outcomes without losing existing referral ledger behavior.
- When `/library` becomes internal by default, referral coach actions must stop
  assuming public library access.

## Tests To Reuse

Public shell/routes:

- `tests/public-content-routes.test.ts`
- `tests/journal-public-route-convergence.test.ts`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-evals.test.tsx`
- `tests/shell-acceptance.test.tsx`
- `tests/shell-command-parity.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/seo-infrastructure.test.ts`

Tools/capability:

- `tests/tool-manifest-contract.test.ts`
- `tests/tool-registry.integration.test.ts`
- `tests/chat/tool-bundle-descriptors.test.ts`
- `tests/core/tool-policy-pipeline.test.ts`
- `src/core/capability-catalog/runtime-tool-binding.test.ts`
- `src/lib/tools/tool-availability-service.test.ts`
- `src/lib/tools/tool-provider-capability-policy.test.ts`

Operations:

- `src/core/entities/operation.test.ts`
- `src/core/use-cases/operations/OperationKindRegistry.test.ts`
- `src/core/use-cases/operations/OperationDraftFactory.test.ts`
- `src/core/use-cases/operations/OperationActionDispatch.test.ts`
- `src/core/use-cases/operations/OperationPromptGrounding.test.ts`
- `src/lib/operations/operation-action-view-model.test.ts`
- `src/lib/operations/operation-prompt-grounding.test.ts`
- `src/frameworks/ui/operations/OperationActionButton.test.tsx`
- `src/frameworks/ui/operations/OperationCard.test.tsx`
- `src/app/api/operations/[operationId]/actions/[actionId]/route.test.ts`

Content/blog/feed donor tests:

- `tests/blog-article-production-service.test.ts`
- `tests/blog-orchestration-qa.test.ts`
- `tests/blog-pipeline-integration.test.ts`
- `tests/blog-production-tool.test.ts`
- `tests/deferred-blog-job-flow.test.ts`
- `tests/deferred-blog-publish-flow.test.ts`
- `src/core/use-cases/tools/journal-query.tool.test.ts`
- `src/core/use-cases/tools/journal-write.tool.test.ts`
- `src/lib/journal/admin-journal.test.ts`
- `src/lib/journal/admin-journal-actions.test.ts`

Research/search/corpus/assets:

- `src/core/use-cases/tools/search-corpus.tool.test.ts`
- `src/core/use-cases/tools/search-my-conversations.tool.test.ts`
- `src/lib/corpus-access.test.ts`
- `src/lib/corpus-library.test.ts`
- `src/lib/capabilities/shared/librarian-tool.test.ts`
- `tests/search/hybrid-search-engine.test.ts`
- `tests/search/search-handler-chain.test.ts`
- `tests/search/tool-integration.test.ts`

Media:

- `src/core/use-cases/tools/compose-media.tool.test.ts`
- `src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts`
- `src/lib/media/workflows/media-workflow-contract.test.ts`
- `src/lib/media/workflows/media-workflow-orchestrator.test.ts`
- `src/lib/media/workflows/media-workflow-operation-executor.test.ts`
- `src/lib/media/workflows/media-workflow-operation-reconciler.test.ts`
- `src/lib/media/compose-media-preflight.test.ts`
- `src/lib/media/ffmpeg/media-composition-plan.test.ts`
- `src/lib/media/server/compose-media-worker-runtime.test.ts`
- `src/lib/jobs/generate-audio-deferred-job.test.ts`
- `src/lib/jobs/compose-media-deferred-job.test.ts`

Referrals/KPI:

- `tests/referral-tracking.test.ts`
- `tests/referral-governance-qa.test.ts`
- `src/lib/referrals/referral-ledger.test.ts`
- `src/lib/referrals/referral-origin.test.ts`
- `src/lib/referrals/admin-referral-analytics.test.ts`
- `src/core/use-cases/tools/affiliate-analytics.tool.test.ts`
- `src/app/api/campaign/context/route.test.ts`

Evals/artifacts:

- `tests/evals/tool-coverage-eval.test.ts`
- `tests/evals/tool-workflow-coverage-eval.test.ts`
- `tests/evals/eval-artifacts.test.ts`
- `tests/evals/eval-runner.test.ts`
- `tests/evals/eval-live-runner.test.ts`
- `tests/evals/eval-release-evidence.test.ts`

Appliance/Rust:

- `tests/appliance-lifecycle-smoke.test.ts`
- `tests/docker-appliance-lifecycle.contract.test.ts`
- `tests/docker-runtime-contract.test.ts`
- `tests/appliance-resource-contract.test.ts`
- `crates/ordo-backup/tests/governed_executor.rs`

## Package Scripts Relevant To Future Phases

From `package.json`:

- `npm run test`
- `npm run typecheck`
- `npm run lint:strict`
- `npm run quality`
- `npm run test:homepage-shell`
- `npm run test:homepage-evals`
- `npm run eval:live-tools`
- `npm run eval:live-tool-workflows`
- `npm run rust:test`
- `npm run rust:fmt`
- `npm run rust:clippy`
- `npm run appliance:smoke:local`
- `npm run appliance:smoke:docker`

## Cleanup Candidates And Dependencies

Do not delete until replacements pass:

- `/library` as public primary route: replace with internal-by-default config
  and update route/nav/SEO/referral coach tests first.
- `/journal` and `/blog` as canonical public output routes: keep as
  compatibility until `/feed` is implemented and tested.
- Blog-specific prompt tools such as `compose_blog_article`,
  `qa_blog_article`, `resolve_blog_article_qa`,
  `generate_blog_image_prompt`, and `produce_blog_article`: replace with
  workflow-backed content production only after parity.
- `campaign-queue` public-library action: update after `/feed` and `/offers`
  exist.
- Media helper duplication across browser/native/deferred paths: prune only
  after operation-backed media workflow tests pass.
- Tool pack duplication risk: `EXTENSION_PACK_TOOL_NAMES.media` currently adds
  `generate_chart` and `generate_graph` in addition to `MEDIA_CAPABILITIES`,
  creating duplicate entries in that pack list even though the catalog itself is
  unique.
- Operation gaps: `content_publish`, `system_diagnostic`, and `tool_task`
  should not be treated as fully executable until their action/executor paths
  are implemented.

## First Implementation Phase Risks

Phase 01 risks:

- `/feed` and `/offers` do not exist.
- `/about` exists but is not in shell navigation.
- Shell primary navigation currently points to `/library` and `/journal`.
- Existing public/mobile/SEO tests expect `/library` to be public.
- Referral campaign coach copy points anonymous users to `/library`.
- `SiteNav` has journal-specific visual behavior that may need to generalize
  for `/feed`.
- Shell command/navigation tests must be updated with exact route visibility
  rather than broad public assumptions.

Phase 02 risks:

- Public content currently splits between `/journal` and `/blog`.
- Blog production summaries and deferred-job tests mention `/blog` and
  `/journal` URLs.
- Feed content negotiation must not break existing blog/journal compatibility.

Phase 05 risks:

- QR/referral is core and should not be treated as an optional cleanup target.
- KPI linkage exists partially through attribution code, not a campaign/pillar
  model.

Phase 07/08 risks:

- `generate_audio` and `generate_blog_image` are provider-disabled in the
  current manifest.
- Media workflow tests should simulate completed assets where providers are
  disabled.

## Phase 00 Verdict

Phase 00 is complete as a baseline.

Future phases can cite this file for initial facts, but each implementation
phase must still refresh exact file/test anchors before editing code.

