# MCP Naming Cleanup Plan

## Status Update

Phase 2, Phase 3, and Phase 4 are now applied in the live repo state.

- The composite server entrypoint is now `mcp/operations-server.ts`.
- `npm run mcp:operations` is the canonical command.
- The deprecated `mcp:embeddings` alias has been retired after transport-backed validation.
- Shared capability modules now live under `src/lib/capabilities/shared/`.
- `mcp/` is reserved for transport-facing entrypoints.

## Decision

Studio Ordo's official architecture story is: internal tool platform with MCP export.

- The Next.js application orchestrates tool use through the internal `ToolRegistry`.
- MCP exposes selected capabilities outside the app for operational use and interoperability.
- The current `mcp/` folder naming overstates MCP's role because it mixes transport entrypoints with shared capability modules.

This plan is a naming and layout clarification plan. It does not propose a move to MCP-native orchestration.

## Why Cleanup Is Needed

- `mcp/embedding-server.ts` is a composite MCP server for embeddings, corpus operations, prompt management, and analytics. Its name is too narrow for its real scope.
- The `mcp/` folder currently contains both protocol entrypoints and reusable modules that are imported directly by the Next.js app.
- The script name `mcp:embeddings` implies an embeddings-only server even though the endpoint exposes multiple capability groups.
- Catalog MCP export metadata exists, but the application's main chat path still executes through the internal registry rather than an MCP client.

## Naming Rules

1. Reserve `mcp` in names for protocol servers, transport adapters, and export-facing registrations.
2. Use `internal tool platform`, `ToolRegistry`, or `internal tool` when describing the product's primary orchestration path.
3. Name MCP servers by actual scope, not by one sub-capability.
4. Move reusable non-transport modules out of `mcp/` when they are imported directly by the Next.js runtime.

## Target State

### Server entrypoints

| Current | Proposed | Reason |
| --- | --- | --- |
| `mcp/calculator-server.ts` | keep | The name already matches the single exported tool. |
| `mcp/operations-server.ts` | keep | The server name now matches its multi-capability operational scope. |
| `npm run mcp:calculator` | keep | Script name is already accurate. |
| `npm run mcp:operations` | keep | Script name now reflects the server's real scope. |

### Shared capability modules

Recommended target directory: `src/lib/capabilities/shared/`

Candidate moves:

| Current | Recommended target |
| --- | --- |
| `src/lib/capabilities/shared/analytics-domain.ts` | keep |
| `src/lib/capabilities/shared/analytics-tool.ts` | keep |
| `src/lib/capabilities/shared/calculator-tool.ts` | keep |
| `src/lib/capabilities/shared/embedding-tool.ts` | keep |
| `src/lib/capabilities/shared/librarian-tool.ts` | keep |
| `src/lib/capabilities/shared/prompt-tool.ts` | keep |
| `src/lib/capabilities/shared/web-search-tool.ts` | keep |

The point of this move is not to hide MCP compatibility. The point is to keep reusable execution logic under `src/` and keep `mcp/` reserved for protocol-facing entrypoints.

## Rollout Plan

### Phase 1: Documentation alignment

- Update canonical docs to describe Studio Ordo as an internal tool platform with MCP export.
- Add this cleanup plan so the remaining naming debt is explicit.

### Phase 2: Server rename with compatibility alias

- Completed in current repo state.

- Renamed `mcp/embedding-server.ts` to `mcp/operations-server.ts`.
- Added `npm run mcp:operations`.
- Kept `npm run mcp:embeddings` as a temporary compatibility alias for one release window.

### Phase 3: Shared module extraction

- Completed in current repo state.

- Moved reusable non-transport modules from `mcp/` into `src/lib/capabilities/shared/`.
- Updated Next.js runtime imports and MCP server imports to use the new paths.
- Kept behavior identical; this was a boundary cleanup, not a logic rewrite.

### Phase 4: Final cleanup

- Removed the deprecated `mcp:embeddings` alias after downstream docs and scripts converged.
- Updated diagrams, architecture prose, and release automation references to the canonical command.
- Added real stdio seam tests around both shipped MCP server entrypoints to validate the transport boundary directly.

## Guardrails

- Do not describe the product as MCP-native unless the main application runtime actually orchestrates tool calls through an MCP client.
- Do not leave shared execution code in `mcp/` once it is consumed directly by `src/` and no longer depends on MCP transport concerns.
- Do not bundle more unrelated capabilities into the composite server without revisiting its name and scope.
