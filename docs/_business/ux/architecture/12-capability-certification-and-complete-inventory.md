# Capability Certification And Complete Inventory

Status: Second-pass certification

Evidence date: 2026-05-05

## Certification Scope

This document certifies the capabilities discoverable in the current working
tree through mechanical inspection of source code and tests. It covers:

- catalog capabilities
- chat tool bundles and execution bindings
- public and authenticated route surfaces
- API endpoints
- durable database tables
- operation kinds and activity source kinds
- Ordo object kinds and detail lenses
- jobs, media workflows, factory work, and appliance/native runtime
- MCP exports and scripts
- tests and eval harnesses

It does not claim to cover deleted branches, external services not represented
in this repository, generated runtime state under `.data`, or manually edited
local files outside the working tree.

Within those boundaries, this is the source-of-truth capability inventory for
UX work.

The product interpretation of this inventory is governed by
`docs/_business/ux/08-product-kernel-contract.md`. This document says what the
system can do; the product kernel says how those capabilities should collapse
into a simple owner-facing product.

## Mechanical Coverage Criteria

The pass used these commands and source classes:

- `find src/app -type f -name page.tsx`
- `find src/app/api -type f -name route.ts`
- import-based `CAPABILITY_CATALOG` inspection through `npx tsx`
- `find src/core/capability-catalog src/core/use-cases/tools`
- `find src/lib src/core src/components src/frameworks src/hooks src/adapters`
- `rg "CREATE TABLE IF NOT EXISTS" src/lib/db/tables.ts src/lib/db/migrations.ts`
- `find crates -type f`
- `find mcp scripts src/lib/evals tests/evals tests/mcp`
- repository test inventory for `*.test.*` and `*.spec.*`

Counts from this pass:

| Source class | Count |
| --- | ---: |
| App page routes | 66 |
| API route handlers | 85 |
| Catalog capabilities | 69 |
| Durable DB tables | 53 |
| Test/spec files | 856 |
| Package scripts | 86 |

## Catalog Capabilities

These 69 names come from importing `CAPABILITY_CATALOG`, not from regex.

### Artifact And Media

- `compose_media`
- `generate_audio`
- `generate_chart`
- `generate_graph`
- `list_conversation_media_assets`

### Blog, Journal, And Content Production

- `approve_journal_post`
- `compose_blog_article`
- `draft_content`
- `generate_blog_image`
- `generate_blog_image_prompt`
- `get_journal_post`
- `get_journal_workflow_summary`
- `list_journal_posts`
- `list_journal_revisions`
- `prepare_journal_post_for_publish`
- `produce_blog_article`
- `publish_content`
- `publish_journal_post`
- `qa_blog_article`
- `resolve_blog_article_qa`
- `restore_journal_revision`
- `select_journal_hero_image`
- `submit_journal_review`
- `update_journal_draft`
- `update_journal_metadata`

### Account/Profile, People, And Referral

- `get_admin_affiliate_summary`
- `get_my_affiliate_summary`
- `get_my_profile`
- `get_my_referral_qr`
- `list_admin_referral_exceptions`
- `list_my_referral_activity`
- `update_my_profile`

### Conversation, Corpus, And Research

- `admin_search`
- `admin_web_search`
- `get_checklist`
- `get_corpus_summary`
- `get_section`
- `list_practitioners`
- `search_corpus`
- `search_my_conversations`
- `search_relationship_memory`

### Jobs, Navigation, Theme, And Runtime Context

- `adjust_ui`
- `calculator`
- `get_current_page`
- `get_deferred_job_status`
- `get_my_job_status`
- `inspect_runtime_context`
- `inspect_theme`
- `list_available_pages`
- `list_deferred_jobs`
- `list_my_jobs`
- `navigate_to_page`
- `set_preference`
- `set_theme`

### Admin, Appliance, Governance, And Diagnostics

- `admin_prioritize_leads`
- `admin_prioritize_offer`
- `admin_triage_routing_risk`
- `cancel_appliance_restore`
- `configure_backup_policy`
- `configure_tool_availability`
- `confirm_appliance_restore`
- `create_appliance_backup`
- `execute_appliance_restore`
- `inspect_runtime_logs`
- `list_appliance_backups`
- `prepare_appliance_restore`
- `produce_product`
- `request_pre_restore_backup`
- `validate_appliance_backup`

## Deferred, Browser, MCP, And Prompt Exposure Facets

Deferred/job-backed capabilities:

- `admin_web_search`
- `compose_blog_article`
- `compose_media`
- `draft_content`
- `generate_audio`
- `generate_blog_image`
- `generate_blog_image_prompt`
- `prepare_journal_post_for_publish`
- `produce_blog_article`
- `produce_product`
- `publish_content`
- `qa_blog_article`
- `resolve_blog_article_qa`

Browser-backed capabilities:

- `compose_media`
- `generate_chart`
- `generate_graph`

MCP-exported capabilities:

- `admin_prioritize_leads`
- `admin_prioritize_offer`
- `admin_search`
- `admin_triage_routing_risk`
- `admin_web_search`
- `inspect_runtime_logs`

Operator-only prompt exposure:

- `admin_prioritize_leads`
- `admin_search`
- `admin_web_search`
- `cancel_appliance_restore`
- `configure_backup_policy`
- `configure_tool_availability`
- `confirm_appliance_restore`
- `create_appliance_backup`
- `execute_appliance_restore`
- `inspect_runtime_logs`
- `list_appliance_backups`
- `prepare_appliance_restore`
- `request_pre_restore_backup`
- `validate_appliance_backup`

## Route Capability Surfaces

### App Routes

Observed route buckets:

| Bucket | Pages |
| --- | ---: |
| `/` | 1 |
| `/admin` | 26 |
| `/business` | 4 |
| `/studio` | 5 |
| `/operations` | 3 |
| `/library` | 4 |
| `/blog` | 2 |
| `/journal` | 2 |
| `/about` | 1 |
| `/access-denied` | 1 |
| `/activity` | 1 |
| `/feed` | 2 |
| `/e2e` | 1 |
| `/install` | 1 |
| `/jobs` | 1 |
| `/login` | 1 |
| `/my` | 1 |
| `/offers` | 2 |
| `/profile` | 1 |
| `/r` | 1 |
| `/referrals` | 1 |
| `/register` | 1 |
| `/signup` | 1 |
| `/welcome` | 1 |
| `/workspace` | 1 |

UX disposition:

- Keep public: home, offers, about, conditional feed, referral landing.
- Keep authenticated primary: dashboard, studio, business, profile.
- Reframe: jobs, activity, operations, my/media, referrals as donor surfaces.
- Hide from regular users: admin, diagnostics, raw system routes.
- Prune candidates after migration: old library-first public navigation and
  redundant job/media/referral surfaces that become object cards/details.
- New content governance surfaces include public `/feed/[slug]` plus
  owner-scoped `/studio/content/[contentId]` and
  `/studio/campaigns/[campaignId]`.

### API Routes

Observed route buckets:

| Bucket | Routes |
| --- | ---: |
| `admin` | 19 |
| `chat` | 8 |
| `conversations` | 7 |
| `operations` | 5 |
| `auth` | 5 |
| `jobs` | 4 |
| `activity` | 3 |
| `deals` | 3 |
| `install` | 3 |
| `consultation-requests` | 2 |
| `e2e` | 2 |
| `health` | 2 |
| `notifications` | 2 |
| `referral` | 2 |
| `training-paths` | 2 |
| `blog` | 1 |
| `campaign` | 1 |
| `diagnostics` | 1 |
| `hero` | 1 |
| `lifecycle` | 1 |
| `preferences` | 1 |
| `profile` | 1 |
| `tracked-links` | 1 |
| `tts` | 1 |
| `user-files` | 1 |
| `web-search` | 1 |
| `workspace` | 1 |

UX disposition:

- API route coverage confirms the app has mature operational capability.
- UX work should not invent new APIs until these route families are exhausted.
- Durable offer APIs now exist for owner draft creation, editing, publishing,
  archiving, and public read paths. Private proposal grants remain a follow-on
  gap.
- The first owner-facing People read model now exists as a derived projection
  over existing tables rather than a new route family.

## Durable Data Capability Map

Durable tables discovered:

- identity/auth: `roles`, `users`, `user_roles`, `sessions`
- conversations/chat: `conversations`, `messages`, `conversation_events`,
  `conversation_purge_audits`
- prompt/provenance: `prompt_provenance_records`, `prompt_bindings`,
  `materialization_records`
- people/business: `relationship_memory_records`, `lead_records`,
  `consultation_requests`, `deal_records`, `training_path_records`
- search/corpus: `embeddings`, `bm25_stats`
- files/media/content: `user_files`, `blog_posts`, `blog_assets`,
  `blog_post_artifacts`, `blog_post_revisions`
- referrals/attribution: `referrals`, `referral_events`
- offers: `offers`, `offer_events`
- preferences/settings: `user_preferences`, `system_prompts`
- jobs/factory: `job_requests`, `job_events`, `factory_work_orders`,
  `factory_work_order_parents`, `factory_production_dags`,
  `factory_stage_runs`, `factory_outputs`, `factory_composition_assets`,
  `factory_checkpoints`, `factory_events`
- activity/notifications: `push_subscriptions`, `activity_receipts`
- appliance/backup: `system_commands`, `backup_snapshots`,
  `backup_policy`, `backup_restore_audit_events`, `restore_plans`
- operations: `operations`, `operation_steps`, `operation_events`,
  `operation_actions`, `operation_artifacts`
- media workflows: `media_workflows`, `media_workflow_steps`,
  `media_workflow_events`
- install/migration: `identity_migration_events`

Major durable gaps after phase 01c3r:

- no private offer grant table
- no media/campaign-specific tracked-link target validators; published content
  and public offer validators now exist
- no durable campaign/content pillar table
- no durable reusable workflow template table
- no durable people merge/split operation table; current People identity is a
  derived read model from existing relationship evidence

## Operation Kinds

The operation kernel supports:

- `backup_create`
- `restore_execute`
- `media_workflow`
- `factory_work_order`
- `system_diagnostic`
- `tool_task`
- `content_publish`
- `onboarding_flow`
- `help_flow`

These are already strong enough to project complex work into object cards and
detail lenses instead of exposing raw job pages.

## Activity Source Kinds

The activity system supports:

- `job`
- `job_event`
- `media_workflow`
- `operation`
- `operation_event`
- `referral_milestone`
- `browser_push_delivery`
- `runtime_audit_log`
- `provider_log`
- `route_metric`
- `mcp_process_log`
- `admin_signal`

UX disposition:

- Regular users should see projectable work and referral milestones.
- Staff/admin can see diagnostic-only sources.
- Notification counts should become attention summaries in dashboard/rail
  surfaces, not floating mystery icons.

## Ordo Object Model

Object kinds:

- `media_asset`
- `content_item`
- `workflow_run`
- `operation`
- `person`
- `offer`
- `tracked_link`
- `campaign`
- `conversation`

Detail lenses:

- `overview`
- `provenance`
- `funnel`
- `performance`
- `actions`
- `history`
- `related`
- `activity`

This is the best UX convergence point found in the codebase. Future UX phases
should use this object model before creating new pages.

## Non-Catalog Capabilities Found

### Platform Read Models

- asset catalog projection/reader
- business workflow context projection/reader
- conversation restore/workspace projection/reader
- discovery search
- execution timelines
- operator transition and trust distribution
- relationship memory projection
- revision projection

These should be treated as product intelligence donors, not admin-only
internals.

### Chat Runtime

- stream route handling
- direct chat turns
- current page mementos
- retrieval envelopes
- runtime hooks
- tool prefiltering/routing
- job state stores
- browser capability runtime
- asset resolution indexes
- failed-send recovery
- stop generation
- transcript storage

These are the foundation for conversation-first UX and should be preserved.

### Media Runtime

- browser FFmpeg runtime
- server FFmpeg runtime
- media worker HTTP/client runtime
- graph/mermaid/SVG rasterization
- audio generation
- media composition planning/preflight/materialization
- subtitle timing and caption burning
- quota/storage accounting

This is a core product proof area.

### Factory Runtime

- production DAG planning
- stage executors: research, draft, asset generation, composition, QA,
  QA resolution, release
- QA check registry and remediation
- work order pause/resume/cancel/retry/revision controls
- factory-operation launcher/executor/reconciler

This is the strongest existing basis for the repeatable workflow vision.

### Appliance And Native Runtime

- Rust `ordo-backup` crate
- backup archive read/write/validation
- restore command execution
- command store/daemon/native contract
- runtime profile and worker supervision
- resource pressure checks
- Docker/release/hardening scripts

This should remain admin/appliance UX, but it proves the Rust boundary works.

### Provider And Capability Governance

- provider config/settings/validation/diagnostics
- provider capability availability
- tool availability service/settings
- execution targets and external adapters
- MCP sidecar/runtime inventory

These support the open-source appliance and local/remote capability strategy.

### Evals And QA

- live eval runner
- tool coverage evals
- tool workflow evals
- runtime integrity evidence
- release evidence
- staging canary
- sprint QA runners
- browser/UI smoke tests

These should become part of Ordo's own proof system, not just developer
scripts.

## UX Certification Findings

1. The codebase has more usable capability than the first UX pass exposed.
2. The product shape should not add many new tools yet. It should project
   existing jobs, operations, factory runs, media, people, referrals, and
   content into simpler object surfaces.
3. The current capability kernel is strong enough to support the solopreneur
   operating-loop UX.
4. Durable offers, the first derived People stage read model, and the first
   content-performance campaign read model now exist. The remaining missing
   business primitives are private proposal grants, durable campaign/pillar
   authoring, media/campaign tracked-link validators, workflow templates,
   workflow run review/edit surfaces, and governed people merge/split actions.
5. The highest cleanup value is navigation consolidation: move diagnostics and
   raw queues out of primary UX, make Conversations the operating entry, and make
   Today, Studio, People, Offers, About, Account, Admin, Jobs, and System the
   coherent authenticated surfaces.

## Certification Statement

As of 2026-05-05, after inventorying source routes, API handlers, catalog
imports, tool executors, chat bundles, DB tables, operation kinds, activity
sources, object contracts, scripts, MCP servers, Rust crates, and tests, there
are no additional code-defined capability families in the current working tree
that are outside this UX architecture package.

Future work should update this document whenever a new capability family,
route family, table family, MCP server, Rust crate, or product surface is added.
