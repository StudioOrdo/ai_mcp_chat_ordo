# Process and Concurrency Model

This document explains the runtime process shape of the application. For the human delivery workflow, read `agentic-delivery-playbook.md`. For a visual map, read `architecture-diagrams.md`.

## Process Types

- `web`: Next.js application process (`npm run dev`, `npm run start` via `scripts/start-server.mjs`)
- `admin`: one-off scripts under `scripts/` (env validation, secret scan, health diagnostics)
- `mcp`: standalone MCP tool processes such as `npm run mcp:calculator`, `npm run mcp:operations`, and `npm run mcp:admin-web-search`

## Why This Matters

Students working on MCP and agent orchestration need to understand that this repository does not collapse everything into one runtime. Different process types exist for different reasons:

- the web app handles requests, rendering, and streaming responses
- admin scripts provide deterministic operational checks
- MCP processes isolate protocol-facing tool execution from the main app runtime

## Stateless Requirements

- HTTP request processing must not rely on mutable module-level state.
- Request-specific context must remain in function scope.
- Long-running shared caches are prohibited unless explicitly externalized.

## Concurrency Notes

- Web process can be horizontally scaled behind a load balancer.
- Streaming endpoints must assume connection interruption and retry at client layer.
- Any future background processing should be added as explicit worker process type.

## MCP Isolation Notes

- MCP servers should stay thin and transport-focused.
- Tool logic should live in extracted modules that are testable outside the transport boundary.
- A failing MCP process should not be treated as an excuse to weaken validation or RBAC in the web app.

## Shutdown Contract

- `web` process handles `SIGTERM` and `SIGINT` by draining active connections.
- New requests receive `503` during drain window.
- Remaining sockets are force-closed after `SHUTDOWN_TIMEOUT_MS`.

## Operational Guidance

- Scale `web` replicas for throughput.
- Keep `admin` commands idempotent and non-interactive when possible.
- Keep MCP process isolated from web process for fault containment.
- Prefer explicit worker or process boundaries over hidden module-level background state.
