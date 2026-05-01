# Unified MCP Capability Registry

## Status
- **Disposition**: Keep, narrowed to the remaining gap.
- **Priority**: Medium.
- **Layer**: Integration / MCP / Capability Catalog.
- **Reviewed**: 2026-05-01.

## Current Code Grounding
- `src/core/capability-catalog/capability-definition.ts` already includes `mcpExport`.
- `src/core/capability-catalog/mcp-export.ts` projects MCP registrations from `CapabilityRuntime`.
- `src/core/capability-catalog/mcp-export.test.ts`, `mcp-catalog-parity.test.ts`, and `mcp-domain-separation.test.ts` guard catalog/MCP parity.
- `mcp/operations-server.ts` is catalog-aware, but it still manually wires schema factories and handlers into `toolSchemas` and `toolRegistry`.

## Verdict
The old finding is partially implemented. The remaining issue is not schema awareness; it is that `operations-server.ts` is still a handwritten composition root with parallel arrays and explicit handler registration.

## Target Architecture
- Keep `mcpExport` as the single catalog opt-in facet.
- Introduce an MCP adapter registry that maps `sharedModule` or a stable adapter key to a handler factory.
- Make `operations-server.ts` register tools by iterating `getAllMcpExportableTools()` and resolving each handler through that adapter registry.
- Keep corpus-only MCP tools explicit only if they are intentionally outside `CAPABILITY_CATALOG`. Otherwise promote them into the catalog.
- Centralize authorization through the capability runtime/RBAC policy used by chat tools.

## Greenfield Cutoff
- Remove manual `toolSchemas` and `toolRegistry` duplication for catalog-owned tools.
- Do not allow new MCP tools to bypass `CAPABILITY_CATALOG` unless they are explicitly documented as transport-only infrastructure.

## Required Tests
- Positive: every `mcpExport` catalog entry is listed by the MCP server.
- Positive: every listed catalog-owned MCP tool resolves to exactly one handler.
- Negative: missing adapter for an exported capability fails startup/test, not first user call.
- Negative: role-denied MCP calls return the same policy failure shape as chat/tool execution.
- Edge: corpus transport-only tools remain explicitly allowlisted until promoted.
