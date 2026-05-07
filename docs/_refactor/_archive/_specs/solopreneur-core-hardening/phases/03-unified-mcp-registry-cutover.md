# Phase 03 - Unified MCP Registry Cutover

## Objective
Eliminate manual MCP schema/handler duplication for catalog-owned tools. `CAPABILITY_CATALOG` plus `mcpExport` should own MCP listing and handler resolution.

## Current Code Grounding
- `src/core/capability-catalog/capability-definition.ts` includes `mcpExport`.
- `src/core/capability-catalog/mcp-export.ts` projects MCP registrations from `CapabilityRuntime`.
- `src/lib/capabilities/mcp-export-adapter-registry.ts` resolves catalog MCP
  exports through shared-module adapters and fails fast for missing adapters.
- `mcp/operations-server.ts` lists catalog-owned tools from
  `getAllMcpExportableTools()` and binds them through
  `createCatalogMcpToolEntries(...)`.
- `mcp/operations-server.ts` still keeps embedding, corpus, prompt, analytics,
  and librarian compatibility aliases explicit because those are transport-only
  operations tools, not catalog-owned MCP exports.
- Existing tests guard catalog/MCP parity, adapter resolution, operations stdio
  inventory, and elite-ops evidence drift.

## Current QA Status
| Area | Evidence | Status |
| --- | --- | --- |
| Catalog-owned MCP listing | Operations sidecar includes all `getAllMcpExportableTools()` entries through `createCatalogMcpToolEntries(...)`. | Complete. |
| Catalog-owned handler resolution | `CATALOG_MCP_ADAPTERS` maps `web-search-tool` and `admin-intelligence-tool` shared modules to handlers. | Complete. |
| Missing adapter failure | `mcp-export-adapter-registry.test.ts` asserts missing shared-module exports throw deterministic startup/test errors. | Complete. |
| Manual admin MCP duplication | `operations-server.ts` no longer imports `getAdminIntelligenceToolSchemas` or manually registers admin handlers. | Pruned. |
| Transport-only operations tools | Embedding, corpus, prompt, analytics, and librarian aliases remain explicit in `operations-server.ts`. | Intentional. |
| Evidence drift | `elite-ops-evidence.ts` derives expected catalog-owned operations inventory from `getAllMcpExportableTools()`. | Complete. |

## Architecture
- Factory pattern: MCP handler factories are resolved by catalog export metadata.
- Adapter registry: each exportable shared module maps to a handler adapter.
- Single source of truth: catalog-owned MCP tools are listed from `getAllMcpExportableTools()`.
- Policy boundary: MCP calls use the same capability/RBAC policy shape as chat tools where applicable.
- Facade: operations MCP remains a thin transport facade over shared capability
  handlers; it does not own catalog schemas for exported capabilities.
- Open/Closed: new catalog MCP exports require a catalog `mcpExport` facet and a
  shared-module adapter, not edits to the operations transport switchboard.

## Hard Cutover Rules
1. Do not manually add catalog-owned tool schemas to `mcp/operations-server.ts`.
2. Do not manually add catalog-owned handlers to the operations sidecar registry.
3. Do not reintroduce `getAdminIntelligenceToolSchemas()` into
   `mcp/operations-server.ts`.
4. Do not add catalog export support by branching on tool names in transport
   request handlers.
5. Keep transport-only operations tools explicit only while they remain outside
   `CAPABILITY_CATALOG.mcpExport`.

## Implementation Steps
1. Introduce an MCP adapter registry keyed by `mcpExport.sharedModule` or a stable adapter key.
2. Replace manual catalog-owned schema listing in `operations-server.ts` with iteration over `getAllMcpExportableTools()`.
3. Resolve handlers through the adapter registry and fail fast when an exported capability lacks an adapter.
4. Keep truly transport-only corpus tools explicit only if they remain outside the catalog.
5. Add startup/test guardrails that block new manual registry entries for catalog-owned tools.

## Cleanup
- Removed duplicated schema factory calls for catalog-owned admin tools.
- Removed parallel handler registration for catalog-owned admin tools.
- Kept transport-only operations tools explicit and documented as intentionally
  outside catalog MCP export ownership.
- Kept compatibility librarian aliases explicit until they are intentionally
  promoted or deleted as a separate hard-cut decision.

## Tests
- Positive: every `mcpExport` catalog entry is listed by MCP.
- Positive: every listed catalog-owned tool resolves exactly one handler.
- Negative: missing adapter fails tests/startup.
- Negative: unknown MCP tool returns deterministic error.
- Negative: denied role/policy returns the shared policy failure shape.
- Edge: transport-only corpus tools remain listed until explicitly promoted.
- Guardrail: operations transport does not import the old admin schema factory.
- Evidence: elite-ops architecture drift derives operations catalog exports from
  the catalog projection.

## Done Criteria
- No manual MCP registry duplication for catalog-owned capabilities.
- Catalog/MCP parity tests are green.
- Operations MCP stdio tests are green.
- Typecheck and full suite pass.

## Implementation Notes
- Added `src/lib/capabilities/mcp-export-adapter-registry.ts` as the catalog
  MCP adapter registry keyed by `mcpExport.sharedModule`.
- `mcp/operations-server.ts` now keeps only transport-owned embedding, corpus,
  prompt, and analytics schemas explicit. Catalog-owned exports are projected
  from `getAllMcpExportableTools()` and bound through
  `createCatalogMcpToolEntries(...)`.
- Catalog-owned operations tools now include `admin_web_search`,
  `admin_search`, `admin_prioritize_leads`, `admin_prioritize_offer`,
  `admin_triage_routing_risk`, and `inspect_runtime_logs`.
- Missing shared-module adapters and mismatched adapter schemas now fail fast
  through the adapter registry.
- `tests/mcp/transport/operations-tool-inventory.json` was updated to include
  the catalog-owned operations exports now listed by the sidecar.
- Operations stdio tests now round-trip catalog-owned `admin_web_search` and
  `inspect_runtime_logs` through the adapter registry, not just inventory
  listing.
- Architecture/evidence checks now derive expected catalog-owned operations MCP
  inventory from `getAllMcpExportableTools()`, not the old admin schema factory.

## Implementation Validation
- Focused Phase 03 suite: `6 files passed`, `97 tests passed`.
- Typecheck: passed.
- Full suite: `656 files passed`, `4,791 tests passed`, `2 skipped`.
