# Review Disposition Index

Reviewed: 2026-05-01

This folder was pruned after the chat job/event hard cutover and audio job phases. The old review set came from earlier research and contained a mix of useful observations, duplicate proposals, and stale recommendations.

The active scope is system hardening: performance, reliability, canonical read models, and registry consistency. Product-tier work is intentionally out of scope unless it becomes necessary for these system objectives.

## Kept And Updated

| File | Disposition | Reason |
| --- | --- | --- |
| `02_user_storage_accounting.md` | Kept, rewritten | Storage/quota accounting can become hot, but the implementation should be an explicit projection, not hidden trigger JSON. |
| `04_search_index_execution_plan.md` | Kept, consolidated | Replaces the old separate vector and FTS findings with one search execution plan. |
| `07_unified_mcp_registry.md` | Kept, narrowed | `mcpExport` exists; the remaining work is removing manual MCP server registry duplication. |
| `08_work_order_hydration_flattening.md` | Kept, rewritten | The real fix is a list read model, not full aggregate hydration or an opaque JSON blob. |
| `09_server_side_asset_index.md` | Kept, rewritten | Asset Catalog is the right source of truth; avoid a separate `conversation_assets` authority. |
| `10_solopreneur-core-strength-weakness-gap-audit.md` | Kept, rewritten | Product audit updated after phases 09/10; transcript job-rendering risk is no longer the primary finding. |

## Implementation Phases

| Phase | Focus | Primary Objective |
| --- | --- | --- |
| `phases/01-server-asset-catalog-completion.md` | Asset Catalog | Make durable server asset catalog data the default media discovery path. |
| `phases/02-search-index-execution.md` | Search | Remove product-path full scans for vector and keyword retrieval. |
| `phases/03-unified-mcp-registry-cutover.md` | MCP | Eliminate manual MCP registry duplication for catalog-owned tools. |
| `phases/04-storage-accounting-projection.md` | Storage | Add explicit media usage projections for quota and workspace accounting. |
| `phases/05-work-order-summary-read-model.md` | Factory | Split list read models from full work-order aggregate hydration. |

## Deleted

| Old File | Disposition | Reason |
| --- | --- | --- |
| `01_admin_stats_materialization.md` | Deleted | Generic trigger-maintained system stats are premature and too broad. Use explicit domain read models when measured dashboard pressure appears. |
| `03_job_status_snapshotting.md` | Deleted | Would create a second persisted job truth beside canonical job snapshots. |
| `05_fts5_search_migration.md` | Deleted | Merged into `04_search_index_execution_plan.md`. |
| `06_prompt_directive_caching.md` | Deleted | Stale; fallback role directives are already assembled once at module load. |

## Greenfield Policy

- Prefer hard cutovers over compatibility layers.
- Prefer explicit domain read models over generic summary tables.
- Prefer canonical job, asset, and capability contracts over transcript-derived or manually duplicated state.
- Preserve only review findings that name current code, a concrete target architecture, and positive/negative/edge test coverage.
