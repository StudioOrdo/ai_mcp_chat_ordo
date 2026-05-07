# Solopreneur Core Audit

Date: 2026-05-01

## Status
- **Disposition**: Keep, rewritten after chat-job phases 09a-09d and audio phases 10a-10c.
- **Purpose**: Product/architecture gap map, not a mandate to preserve legacy compatibility.

## Executive Summary

Studio Ordo has a strong systems core: durable jobs, canonical job snapshots, media materialization, prompt governance, role-aware access, referral/lead infrastructure, and broad automated tests.

The previous audit overstated the active risk around transcript-derived job rendering. That risk has been materially addressed:
- default chat consumes `CanonicalJobSnapshot[]` separately from messages
- audio generation is routed through deferred jobs
- direct audio transcript payloads are not product asset authority
- `/api/chat/jobs`, job event streams, and restore paths now carry canonical job state

The biggest remaining risks are now product-scope gaps, not the job state model:
- founder escalation and scheduling are still thin
- channel publishing/distribution is not first-class
- podcast and lecture-to-curriculum workflows are not explicit product paths
- search/index execution still has scalability work before large corpus growth

## Current Strengths

### Durable Job And Media Core
- `src/lib/jobs/job-read-model.ts` defines `CanonicalJobSnapshot`.
- `src/app/api/chat/jobs/route.ts` handles canonical chat job enqueue/read surfaces.
- `src/lib/jobs/generate-audio-deferred-job.ts` and `src/lib/audio/audio-generation-service.ts` route audio through deferred job materialization.
- `src/core/platform/asset-catalog/AssetCatalogReader.ts` gives media composition a server-side asset catalog foundation.

Assessment: strong. This is now a real product spine, not just infrastructure.

### Conversation Restore And Presentation
- `src/hooks/usePresentedChatMessages.tsx` composes message presentation with canonical job snapshots.
- `src/hooks/chat/useChatJobEvents.tsx` and job event APIs reconcile durable job state.
- `src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx` renders audio from canonical job/result state.

Assessment: strong after phases 09/10. Keep cutting any remaining transcript-derived product authority.

### Referral, Leads, And Admin Operations
- Referral ledger, admin lead triage, consultation requests, deals, and training-path records are implemented.
- Admin pages already surface operational queues and routing review.

Assessment: strong domain backbone, but escalation and scheduling still need explicit product workflows.

### Governance And Capability Catalog
- Capability catalog owns runtime projection, prompt hints, and MCP export facets.
- Prompt directives are assembled at module load into `ROLE_DIRECTIVES` and covered by catalog/prompt tests.
- MCP export is partially catalog-driven.

Assessment: strong direction, with a remaining MCP composition-root cleanup.

## Findings To Act On

### 1. Search Index Scalability
Status: valid.

Current `HybridSearchEngine` still fetches matching embeddings into Node and scores vector/BM25 in JavaScript. This is acceptable for small fixtures but not for a growing corpus or heavy conversation search.

Action: implement [Search Index Execution Plan](/Users/kwilliams/Projects/ordoSite/docs/_specs/solopreneur-core-hardening/04_search_index_execution_plan.md).

### 2. Storage Accounting Projection
Status: valid but should be implemented as a domain projection, not hidden triggers.

`UserFileDataMapper` aggregate queries are correct but will become quota-path load as media usage grows.

Action: implement [User Storage Accounting Projection](/Users/kwilliams/Projects/ordoSite/docs/_specs/solopreneur-core-hardening/02_user_storage_accounting.md) when media volume or hard quota pressure justifies it.

### 3. MCP Registry Final Cutover
Status: partially implemented.

`mcpExport` exists and is tested, but `mcp/operations-server.ts` still manually wires schema factories and handlers.

Action: implement [Unified MCP Capability Registry](/Users/kwilliams/Projects/ordoSite/docs/_specs/solopreneur-core-hardening/07_unified_mcp_registry.md).

### 4. Factory Work Order List Read Model
Status: valid.

Full work-order hydration is correct for detail/actions, but list surfaces should not hydrate full aggregates row by row.

Action: implement [Work Order Read Model Flattening](/Users/kwilliams/Projects/ordoSite/docs/_specs/solopreneur-core-hardening/08_work_order_hydration_flattening.md) if factory list usage becomes product-critical.

### 5. Server Asset Catalog Completion
Status: valid, partially solved.

The Asset Catalog exists and should become the default media discovery path. Browser transcript scans should remain only narrow bridges for client-generated chart/graph payloads.

Action: implement [Server-Side Conversation Asset Index](/Users/kwilliams/Projects/ordoSite/docs/_specs/solopreneur-core-hardening/09_server_side_asset_index.md).

### 6. Founder Scheduling And Escalation
Status: real product gap.

Consultation state exists, but there is no full availability model, calendar adapter, escalation policy, email/SMS/voice adapter stack, or founder routing policy engine.

Greenfield direction:
- Create explicit `availability_slots`, `booking_holds`, and `booking_confirmations` contracts.
- Add escalation policy rules as data, not ad hoc route logic.
- Implement email first, SMS second, voice as an adapter boundary.
- Keep all channel actions as jobs with durable events and audit metadata.

### 7. Channel Publishing
Status: real product gap.

Journal/blog publishing exists; YouTube, podcast feeds, and channel-level distribution are not first-class product paths.

Greenfield direction:
- Model channel outputs as durable artifacts with source lineage.
- Add jobs for YouTube ingest/publish, podcast episode/feed publish, and distribution metadata sync.
- Reuse audio/media materialization and Asset Catalog rather than building channel-specific storage.

## Findings Deleted From This Review Set

The following old findings were removed because they would push the system in the wrong direction or duplicate better plans:

- `01_admin_stats_materialization.md`: rejected. A generic `system_statistics` trigger table is not the best architecture. Prefer explicit domain read models when a concrete dashboard query becomes hot.
- `03_job_status_snapshotting.md`: rejected. Persisting `last_publication_snapshot_json` on `job_requests` would reintroduce a second job truth. Keep `CanonicalJobSnapshot` as the read-model DTO built from job rows/events/materializations unless performance data proves a projection is needed.
- `05_fts5_search_migration.md`: merged into the consolidated search execution plan.
- `06_prompt_directive_caching.md`: resolved/stale. `ROLE_DIRECTIVES` are already assembled at module load from `assembleRoleDirective(...)`; no database cache is needed for the current prompt path.

## Bottom Line

The job/audio reliability problem that motivated phases 09 and 10 is now addressed at the architecture level. The next high-leverage work is not more compatibility cleanup; it is hard-cut product execution around search scalability, asset catalog completion, founder scheduling/escalation, and channel publishing.
