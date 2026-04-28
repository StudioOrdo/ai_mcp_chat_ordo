# Phase 7 — Execution Target Abstraction And MCP Sidecars

> Status: In Progress
> Loop State: Real Docker-backed `mcp_container` parity is proven, native and remote adapter families are live through the planner, and MCP inventory is centralized, but generalized sidecar operations beyond the pilot still remain
> Goal: Introduce one host-owned execution-target contract so capabilities can move between host, browser, deferred-job, MCP, container, and native runtimes without changing policy, provenance, or canonical state ownership.
> Prerequisites: Phases 3, 5, and 6 complete

## Phase Intent

This phase is the architectural bridge from the current integrated app to the future host-plus-extensions model, but it is not starting from zero.

The current codebase already has catalog-owned runtime metadata in [../../../../src/core/capability-catalog/capability-definition.ts](../../../../src/core/capability-catalog/capability-definition.ts#L1), a mature in-process `ToolRegistry` surface in [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts#L1), catalog-derived deferred-job policy in [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts#L1), a real browser WASM execution path in [../../../../src/lib/media/browser-runtime/browser-capability-registry.ts](../../../../src/lib/media/browser-runtime/browser-capability-registry.ts#L1) plus [../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1), and a stable stdio MCP surface in [../../../../mcp/operations-server.ts](../../../../mcp/operations-server.ts#L1).

The missing layer is one host planner that can interpret those signals and route execution through target-specific adapters while keeping auth, RBAC, prompt/runtime context, conversation state, job state, artifact governance, and observability in the host.

## Source Anchors To Refresh

- [../../../../src/core/capability-catalog/capability-definition.ts](../../../../src/core/capability-catalog/capability-definition.ts#L1)
- [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts#L31)
- [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1)
- [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L1)
- [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts#L57)
- [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts#L1)
- [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L1)
- [../../../../src/core/capability-catalog/mcp-export.ts](../../../../src/core/capability-catalog/mcp-export.ts#L56)
- [../../../../mcp/operations-server.ts](../../../../mcp/operations-server.ts#L1)
- [../../../../src/lib/capabilities/execution-targets.ts](../../../../src/lib/capabilities/execution-targets.ts#L1)
- [../../../../src/lib/capabilities/executor-dispatch.ts](../../../../src/lib/capabilities/executor-dispatch.ts#L1)
- [../../../../src/lib/capabilities/mcp-process-runtime.ts](../../../../src/lib/capabilities/mcp-process-runtime.ts#L1)
- [../../../../src/lib/capabilities/mcp-stdio-adapter.ts](../../../../src/lib/capabilities/mcp-stdio-adapter.ts#L1)
- [../../../../src/lib/capabilities/mcp-sidecar-inventory.ts](../../../../src/lib/capabilities/mcp-sidecar-inventory.ts#L1)
- [../../../../src/lib/capabilities/external-target-adapters.ts](../../../../src/lib/capabilities/external-target-adapters.ts#L1)
- [../../../../src/lib/capabilities/execution-targets.test.ts](../../../../src/lib/capabilities/execution-targets.test.ts#L1)
- [../../../../src/lib/jobs/enqueue-deferred-tool-job.ts](../../../../src/lib/jobs/enqueue-deferred-tool-job.ts#L1)
- [../../../../src/lib/jobs/compose-media-deferred-job.ts](../../../../src/lib/jobs/compose-media-deferred-job.ts#L1)
- [../../../../mcp/admin-web-search-server.ts](../../../../mcp/admin-web-search-server.ts#L1)
- [../../../../compose.yaml](../../../../compose.yaml#L1)
- [../../../../src/lib/media/browser-runtime/browser-capability-registry.ts](../../../../src/lib/media/browser-runtime/browser-capability-registry.ts#L13)
- [../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1)
- [../../../../src/app/api/chat/jobs/route.ts](../../../../src/app/api/chat/jobs/route.ts#L1)
- [../../../../src/lib/media/ffmpeg/media-execution-router.ts](../../../../src/lib/media/ffmpeg/media-execution-router.ts#L1)
- [../../../../tests/mcp/transport/operations-mcp-stdio.test.ts](../../../../tests/mcp/transport/operations-mcp-stdio.test.ts#L1)
- [../../../../tests/mcp/transport/admin-web-search-mcp-stdio.test.ts](../../../../tests/mcp/transport/admin-web-search-mcp-stdio.test.ts#L1)
- [../subsystems/execution-targets.md](../subsystems/execution-targets.md#L1)

## Phase Decisions

- Use the existing catalog facets as the starting point for target planning. Phase 7 should not replace `runtime`, `job`, `browser`, `mcpExport`, `executorBinding`, or `validationBinding` blindly.
- Keep auth, RBAC, prompt/runtime context, conversation persistence, job persistence, artifact governance, and observability in the host. External runtimes execute work; they do not become the system of record.
- Use `admin_web_search` as the first sidecar pilot because it is already the only catalog capability with explicit `mcpExport` intent and a shared execution module.
- Treat `compose_media` as the clearest heavy-runtime externalization candidate, but defer that move to Phase 8 after the generic planner and adapter model is proven.
- Prefer long-lived family sidecars or utility containers over per-request `docker run` execution.

## Drift Traps

- Adding a new execution-target table that duplicates metadata already expressed in the catalog's job, browser, or MCP facets.
- Treating browser fallback or deferred-job routing as special cases outside the shared host planner.
- Starting with FFmpeg or another heavy-runtime move before the host can dispatch to any external target coherently.
- Treating catalog exportability as the same thing as host-side invocability.
- Letting containers or native processes own RBAC, provenance, or canonical state.

## Pre-Implementation QA Gate

- [x] Refresh current execution modes in source.
- [x] Refresh current catalog runtime-binding and validation surfaces.
- [x] Refresh current MCP export and server boundaries.
- [x] Refresh current browser runtime and server-fallback contracts.
- [x] Choose one pilot execution-target flow to prove the abstraction.

## Verified Current State

### Capability Model Already Carries Partial Execution Metadata

| Facet | Current shape | Evidence | Phase 7 implication |
| --- | --- | --- | --- |
| `runtime` | Tool-descriptor-level `executionMode` and deferred metadata already live in the catalog definition model | [../../../../src/core/capability-catalog/capability-definition.ts](../../../../src/core/capability-catalog/capability-definition.ts#L22), [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L180) | The planner should extend the existing runtime signal rather than replace it |
| `executorBinding` and `validationBinding` | Each catalog-bound tool already declares a bundle, executor id, execution surface, validator id, and parse or sanitize mode | [../../../../src/core/capability-catalog/capability-definition.ts](../../../../src/core/capability-catalog/capability-definition.ts#L75), [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1) | These bindings are the closest current equivalent to a host dispatch descriptor |
| `presentation.executionMode` | UI presentation already distinguishes `inline`, `deferred`, and `hybrid` surfaces | [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts#L95), [../../../../src/core/capability-catalog/families/media-capabilities.ts](../../../../src/core/capability-catalog/families/media-capabilities.ts#L84) | Target planning must not break the already-governed presentation contract |
| `job` | Deferred tools already carry execution principal, retry, recovery, retention, and visibility rules | [../../../../src/core/capability-catalog/families/media-capabilities.ts](../../../../src/core/capability-catalog/families/media-capabilities.ts#L88), [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts#L67) | Background execution already has strong policy metadata that the planner should reuse |
| `browser` | Browser-capable tools already declare runtime kind, module id, fallback policy, and isolation requirements | [../../../../src/core/capability-catalog/families/media-capabilities.ts](../../../../src/core/capability-catalog/families/media-capabilities.ts#L107), [../../../../src/lib/media/browser-runtime/browser-capability-registry.ts](../../../../src/lib/media/browser-runtime/browser-capability-registry.ts#L1) | Browser execution is already a first-class runtime candidate |
| `mcpExport` | Catalog export intent exists today, but only `admin_web_search` currently uses it | [../../../../src/core/capability-catalog/families/admin-capabilities.ts](../../../../src/core/capability-catalog/families/admin-capabilities.ts#L1), [../../../../src/core/capability-catalog/mcp-export.ts](../../../../src/core/capability-catalog/mcp-export.ts#L1) | Phase 7 can start with one real catalog-backed sidecar pilot instead of a hypothetical example |

### Execution Surface Inventory Today

| Execution style | Current owner | Evidence | Current limitation |
| --- | --- | --- | --- |
| In-process host TypeScript | `ToolRegistry` plus middleware, composed once per process in `getToolComposition()` | [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts#L71) | The main host path still assumes `registry.execute()` is the primary execution mechanism |
| Deferred internal job | `JOB_CAPABILITY_REGISTRY` plus `DeferredJobWorker` and named handlers | [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts#L67), [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L1) | Background execution is policy-rich but still resolved outside a shared planner |
| Browser WASM or hybrid | Browser registry, candidate detection, and `browser_wasm` versus `deferred_server` routing | [../../../../src/lib/media/browser-runtime/browser-capability-registry.ts](../../../../src/lib/media/browser-runtime/browser-capability-registry.ts#L1), [../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L221), [../../../../src/lib/media/ffmpeg/media-execution-router.ts](../../../../src/lib/media/ffmpeg/media-execution-router.ts#L17) | Runtime start conditions and fallback still live outside a shared host dispatcher |
| MCP stdio process | Catalog export projection plus the standalone operations MCP server | [../../../../src/core/capability-catalog/mcp-export.ts](../../../../src/core/capability-catalog/mcp-export.ts#L1), [../../../../mcp/operations-server.ts](../../../../mcp/operations-server.ts#L1), [../../../../tests/mcp/transport/operations-mcp-stdio.test.ts](../../../../tests/mcp/transport/operations-mcp-stdio.test.ts#L1) | The server exists, but the host has no generic MCP invocation target or sidecar supervisor |
| Containerized MCP | Compose-backed pilot exists through the managed sidecar pool, declared container targets, and a real Docker-backed parity proof | [../../../../src/lib/capabilities/mcp-process-runtime.ts](../../../../src/lib/capabilities/mcp-process-runtime.ts#L1), [../../../../src/lib/capabilities/mcp-stdio-adapter.ts](../../../../src/lib/capabilities/mcp-stdio-adapter.ts#L1), [../../../../compose.yaml](../../../../compose.yaml#L1), [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L620) | The pilot is still local to `admin_web_search`; broader sidecar inventory, health conventions, and non-pilot families remain pending |
| Native process or remote service | Generic planner-backed target overrides now execute through dedicated adapters | [../../../../src/lib/capabilities/external-target-adapters.ts](../../../../src/lib/capabilities/external-target-adapters.ts#L1), [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1), [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L1) | The contract exists, but no production family is yet owned by a native binary or remote service |

### Dispatch Seams Still Split Across Subsystems

| Zone | Current dispatch seam | Evidence | Needed change |
| --- | --- | --- | --- |
| Chat tool execution | `getToolComposition()` builds the registry, middleware stack, and executor once per process | [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts#L82) | Add a planner and target-adapter layer above the current executor bindings |
| Deferred job execution | Worker behavior is keyed by tool name and job capability metadata | [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L1), [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts#L67) | Let the planner resolve job-backed targets through the same contract as inline execution |
| Browser execution | The client hook discovers browser candidates and starts browser executors, while the media router chooses `browser_wasm` versus `deferred_server` | [../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L221), [../../../../src/lib/media/ffmpeg/media-execution-router.ts](../../../../src/lib/media/ffmpeg/media-execution-router.ts#L17) | Express browser eligibility and fallback as planner-recognized target data rather than isolated hook logic |
| MCP runtime | Host planner dispatch now reaches reusable stdio sidecars, a compose-backed `mcp_container` pilot, and centralized sidecar inventory declarations through the managed process pool | [../../../../src/lib/capabilities/mcp-process-runtime.ts](../../../../src/lib/capabilities/mcp-process-runtime.ts#L1), [../../../../src/lib/capabilities/mcp-stdio-adapter.ts](../../../../src/lib/capabilities/mcp-stdio-adapter.ts#L1), [../../../../src/lib/capabilities/mcp-sidecar-inventory.ts](../../../../src/lib/capabilities/mcp-sidecar-inventory.ts#L1), [../../../../compose.yaml](../../../../compose.yaml#L1) | Broaden sidecar health supervision and non-pilot container declarations beyond `admin_web_search` |

### Pilot Recommendation

`admin_web_search` is the first safe sidecar pilot.

Why this is the right Phase 7 proof:

- It is already the only catalog capability with explicit `mcpExport` intent.
- Its executor binding is `shared`, which matches the goal of proving a reusable shared-module or sidecar boundary.
- It uses sanitized typed input rather than deferred-job orchestration, governed artifact handles, or browser fallback.
- It does not require moving canonical conversation, job, or artifact state out of the host.

What to defer:

- `compose_media` is the clearest heavy-runtime externalization candidate, but it combines browser fallback, deferred-job state, FFmpeg packaging, and artifact retention. That is Phase 8 work after Phase 7 proves the generic planner and sidecar contract.

### Current Code Notes

- [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts#L31) already projects presentation, job, browser, prompt-hint, and MCP export facets from one catalog-owned definition set.
- [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L1) proves every catalog-bound descriptor already projects `executionMode`, `deferred`, `executorBinding`, `validationBinding`, and schema coverage.
- [../../../../src/lib/media/browser-runtime/browser-capability-registry.ts](../../../../src/lib/media/browser-runtime/browser-capability-registry.ts#L1) is fully catalog-derived for `generate_audio`, `generate_chart`, `generate_graph`, and `compose_media`.
- [../../../../mcp/operations-server.ts](../../../../mcp/operations-server.ts#L1) is a real, tested stdio surface, but it still manually owns its tool inventory and switch-based execution rather than participating in a host planner.
- [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts#L1) shows deferred execution already carries policy-rich metadata such as execution principal, retry, recovery, retention, and global visibility.
- [../../../../src/lib/capabilities/execution-targets.ts](../../../../src/lib/capabilities/execution-targets.ts#L1) now drafts the host planner seam in code: target kinds, planner context, target unions, and a catalog-derived `planCapabilityExecution()` helper.
- [../../../../src/lib/capabilities/executor-dispatch.ts](../../../../src/lib/capabilities/executor-dispatch.ts#L1) now drafts the target-adapter seam in code: dispatch request shape, adapter registry, adapter resolution, and a primary-target dispatch helper without yet rewiring the live chat runtime.
- [../../../../src/core/tool-registry/ToolExecutionContext.ts](../../../../src/core/tool-registry/ToolExecutionContext.ts#L1) now carries optional `executionPlanning` overrides so runtime callers can opt into target preferences without changing tool RBAC or prompt/runtime context.
- [../../../../src/lib/capabilities/mcp-process-runtime.ts](../../../../src/lib/capabilities/mcp-process-runtime.ts#L1) now owns a managed MCP sidecar session pool so the host can reuse long-lived process sessions instead of spawning a fresh stdio child for every external call, and each pooled target can run one-time launch preparation before its first session comes up.
- [../../../../src/lib/capabilities/mcp-stdio-adapter.ts](../../../../src/lib/capabilities/mcp-stdio-adapter.ts#L1) now projects both `mcp_stdio` and compose-backed `mcp_container` adapters through that managed pool while still preserving the parsed JSON payload contract, and the compose-backed launch path now forces `docker compose up -d --build --no-deps` so the sidecar runs the current workspace image instead of a stale published tag.
- [../../../../src/lib/capabilities/mcp-sidecar-inventory.ts](../../../../src/lib/capabilities/mcp-sidecar-inventory.ts#L1) now centralizes canonical MCP sidecar declarations from process metadata so runtime binding, inventory evidence, and sidecar-facing docs can reuse one capability-to-process map.
- [../../../../src/lib/capabilities/external-target-adapters.ts](../../../../src/lib/capabilities/external-target-adapters.ts#L1) now provides generic `native_process` and `remote_service` adapters so planner-backed capabilities can execute through process or HTTP-style targets without bypassing host policy or the shared dispatch contract.
- [../../../../mcp/admin-web-search-server.ts](../../../../mcp/admin-web-search-server.ts#L1) is the first dedicated sidecar pilot entrypoint: one-tool MCP inventory, shared payload contract, and deterministic fixture mode for transport parity tests.
- [../../../../compose.yaml](../../../../compose.yaml#L1) now declares the `admin-web-search-mcp` sidecar service so planner-declared container targets can reuse the same build context and runtime image as the host app while staying isolated at execution time.
- [../../../../src/lib/jobs/enqueue-deferred-tool-job.ts](../../../../src/lib/jobs/enqueue-deferred-tool-job.ts#L1) now owns the shared deferred enqueue contract for queue creation, dedupe reuse, renderable-event synthesis, and `deferred_job` payload shaping across planner and chat execution paths.
- [../../../../src/lib/jobs/compose-media-deferred-job.ts](../../../../src/lib/jobs/compose-media-deferred-job.ts#L1) now owns the canonical `compose_media` deferred enqueue contract, including validation, dedupe, queued-event creation, and `deferred_job` payload projection.
- [../../../../src/app/api/chat/jobs/route.ts](../../../../src/app/api/chat/jobs/route.ts#L1) now reuses that shared enqueue seam instead of keeping hybrid media deferral logic in a route-local branch.
- [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1) is now the first live integration point: MCP-exportable catalog capabilities route through `planCapabilityExecution()` before dispatch with real `host_ts`, `mcp_stdio`, and compose-backed `mcp_container` adapters, browser-prepared capabilities can route through the planner via a `browser_wasm` compatibility adapter, job-backed deferred capabilities now route through a planner-backed `deferred_job` adapter rather than a `compose_media`-only branch, and explicit `native_process` plus `remote_service` overrides now participate in the same runtime-binding seam.
- [../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1) now explicitly ignores `compose_media` tool results that the planner has already rerouted into deferred jobs, so the client browser runtime does not restart work the host has already queued.

### Current QA Notes

- Focused Phase 7 baseline bundle passed on 2026-04-13: 7 files and 65 tests.
- The bundle covered catalog runtime binding, MCP export projection, MCP catalog parity, MCP domain separation, operations stdio transport, browser capability registry derivation, and media route selection.
- Focused planner seam bundle passed on 2026-04-13: 1 file and 10 tests.
- The planner seam bundle covers target derivation and primary-target choice for `admin_web_search`, `generate_chart`, `compose_media`, and `draft_content`, plus adapter-registry and dispatch error handling.
- Focused planner integration bundle passed on 2026-04-13: 4 files and 34 tests.
- The integration bundle proves that `admin_web_search` now executes through both the default `host_ts` planner path and a real `mcp_stdio` sidecar path with equal payloads, that the dedicated `admin-web-search-server.ts` transport is stable, and that `generate_audio` now routes through the planner via a `browser_wasm` compatibility adapter while still preserving its existing payload shape.
- Focused deferred-media and managed-sidecar bundle passed on 2026-04-13: 6 files and 42 tests.
- The bundle covers the shared `compose_media` deferred enqueue service, `POST /api/chat/jobs`, planner-backed `compose_media` fallback when browser execution is unavailable, container-declared target planning, the managed MCP session pool, and the browser-runtime guard that skips already-deferred media results.
- Focused compose-container and deferred-family bundle passed on 2026-04-13: 4 files and 27 tests.
- The bundle covers the shared generic deferred enqueue helper, planner-backed deferred routing for editorial tools, one-time compose launch preparation for managed sidecar sessions, and the compose-backed `mcp_container` adapter contract for `admin_web_search`.
- Real Docker-backed container parity passed on 2026-04-13: [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L620) now proves `admin_web_search` payload parity between `host_ts` and `mcp_container` against a rebuilt compose sidecar image, not just a contract stub.
- Focused Phase 7 QA refresh passed on 2026-04-13: 10 files and 67 tests covering [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L1), [../../../../src/lib/capabilities/execution-targets.test.ts](../../../../src/lib/capabilities/execution-targets.test.ts#L1), [../../../../src/core/capability-catalog/mcp-boundary-canonicalization.test.ts](../../../../src/core/capability-catalog/mcp-boundary-canonicalization.test.ts#L1), all three repo MCP stdio transport suites, [../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts](../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts#L1), [../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx#L1), [../../../../src/lib/capabilities/mcp-process-runtime.test.ts](../../../../src/lib/capabilities/mcp-process-runtime.test.ts#L1), and [../../../../tests/evals/runtime-integrity-evidence.test.ts](../../../../tests/evals/runtime-integrity-evidence.test.ts#L1).
- Focused external-target and centralized-inventory bundle passed on 2026-04-13: 4 files and 40 tests covering [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L1), [../../../../src/lib/capabilities/execution-targets.test.ts](../../../../src/lib/capabilities/execution-targets.test.ts#L1), [../../../../src/lib/capabilities/external-target-adapters.test.ts](../../../../src/lib/capabilities/external-target-adapters.test.ts#L1), and [../../../../src/lib/capabilities/mcp-sidecar-inventory.test.ts](../../../../src/lib/capabilities/mcp-sidecar-inventory.test.ts#L1). That bundle proves `admin_web_search` can route through planner-selected `native_process` and `remote_service` overrides without falling back to the host executor, and that centralized sidecar inventory matches the canonical MCP metadata surface.
- Current MCP inventory is now canonicalized across all repo MCP servers: [../../../../mcp/calculator-server.ts](../../../../mcp/calculator-server.ts#L1), [../../../../mcp/operations-server.ts](../../../../mcp/operations-server.ts#L1), and [../../../../mcp/admin-web-search-server.ts](../../../../mcp/admin-web-search-server.ts#L1) all align with [../../../../src/core/capability-catalog/mcp-process-metadata.ts](../../../../src/core/capability-catalog/mcp-process-metadata.ts#L1), package scripts, runtime inventory generation, and transport-level tests.
- Fresh production builds now pass after the live Docker validation uncovered and cleared strict TypeScript issues in [../../../../src/lib/capabilities/execution-targets.ts](../../../../src/lib/capabilities/execution-targets.ts#L1), [../../../../src/lib/capabilities/executor-dispatch.ts](../../../../src/lib/capabilities/executor-dispatch.ts#L1), [../../../../src/lib/capabilities/mcp-stdio-adapter.ts](../../../../src/lib/capabilities/mcp-stdio-adapter.ts#L1), and [../../../../src/lib/capabilities/mcp-process-runtime.ts](../../../../src/lib/capabilities/mcp-process-runtime.ts#L1).
- Fresh production builds also pass after adding the new external-target adapter surface in [../../../../src/lib/capabilities/external-target-adapters.ts](../../../../src/lib/capabilities/external-target-adapters.ts#L1) and wiring centralized sidecar inventory through [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1).
- Targeted anchor eslint run produced no errors. Existing warnings are limited to non-null assertions in [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts#L81) and [../../../../src/lib/media/browser-runtime/browser-capability-registry.ts](../../../../src/lib/media/browser-runtime/browser-capability-registry.ts#L16); those are baseline cleanup items, not Phase 7 blockers.
- Focused lint across [../../../../src/lib/capabilities/execution-targets.ts](../../../../src/lib/capabilities/execution-targets.ts#L1), [../../../../src/lib/capabilities/executor-dispatch.ts](../../../../src/lib/capabilities/executor-dispatch.ts#L1), and [../../../../src/lib/capabilities/execution-targets.test.ts](../../../../src/lib/capabilities/execution-targets.test.ts#L1) produced no output.
- Focused lint across the planner integration files, including [../../../../src/core/tool-registry/ToolExecutionContext.ts](../../../../src/core/tool-registry/ToolExecutionContext.ts#L1), [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1), and [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L1), produced no output.
- Focused lint across the deferred enqueue and managed-sidecar files, including [../../../../src/lib/jobs/compose-media-deferred-job.ts](../../../../src/lib/jobs/compose-media-deferred-job.ts#L1), [../../../../src/app/api/chat/jobs/route.ts](../../../../src/app/api/chat/jobs/route.ts#L1), [../../../../src/lib/capabilities/mcp-process-runtime.ts](../../../../src/lib/capabilities/mcp-process-runtime.ts#L1), and [../../../../src/lib/capabilities/mcp-stdio-adapter.ts](../../../../src/lib/capabilities/mcp-stdio-adapter.ts#L1), produced no output.
- Focused lint across the compose-container and shared deferred enqueue files, including [../../../../src/lib/jobs/enqueue-deferred-tool-job.ts](../../../../src/lib/jobs/enqueue-deferred-tool-job.ts#L1), [../../../../src/lib/chat/stream-execution.ts](../../../../src/lib/chat/stream-execution.ts#L1), [../../../../src/lib/capabilities/mcp-process-runtime.ts](../../../../src/lib/capabilities/mcp-process-runtime.ts#L1), [../../../../src/lib/capabilities/mcp-stdio-adapter.ts](../../../../src/lib/capabilities/mcp-stdio-adapter.ts#L1), and [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1), produced no output.

```bash
npm exec vitest run src/core/capability-catalog/runtime-tool-binding.test.ts src/core/capability-catalog/mcp-export.test.ts src/core/capability-catalog/mcp-catalog-parity.test.ts src/core/capability-catalog/mcp-domain-separation.test.ts tests/mcp/transport/operations-mcp-stdio.test.ts src/lib/media/browser-runtime/browser-capability-registry.test.ts src/lib/media/ffmpeg/media-execution-router.test.ts
npm exec eslint src/core/capability-catalog/capability-definition.ts src/core/capability-catalog/catalog.ts src/core/capability-catalog/mcp-export.ts src/lib/chat/tool-composition-root.ts mcp/operations-server.ts src/lib/media/browser-runtime/browser-capability-registry.ts src/hooks/chat/useBrowserCapabilityRuntime.ts src/lib/media/ffmpeg/media-execution-router.ts src/lib/jobs/job-capability-registry.ts
npm exec vitest run src/lib/capabilities/execution-targets.test.ts
npm exec eslint src/lib/capabilities/execution-targets.ts src/lib/capabilities/executor-dispatch.ts src/lib/capabilities/execution-targets.test.ts
npm exec vitest run src/core/capability-catalog/runtime-tool-binding.test.ts src/lib/capabilities/execution-targets.test.ts tests/mcp/transport/admin-web-search-mcp-stdio.test.ts tests/mcp/transport/operations-mcp-stdio.test.ts
npm exec eslint src/core/tool-registry/ToolExecutionContext.ts src/core/capability-catalog/runtime-tool-binding.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/lib/capabilities/execution-targets.ts src/lib/capabilities/executor-dispatch.ts src/lib/capabilities/mcp-stdio-adapter.ts src/lib/capabilities/execution-targets.test.ts mcp/admin-web-search-server.ts tests/mcp/transport/stdio-harness.ts tests/mcp/transport/admin-web-search-mcp-stdio.test.ts
npm exec vitest run src/app/api/chat/jobs/route.test.ts src/lib/jobs/compose-media-deferred-job.test.ts src/lib/capabilities/mcp-process-runtime.test.ts src/lib/capabilities/execution-targets.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/hooks/chat/useBrowserCapabilityRuntime.test.tsx
npm exec eslint src/lib/jobs/compose-media-deferred-job.ts src/app/api/chat/jobs/route.ts src/app/api/chat/jobs/route.test.ts src/core/capability-catalog/runtime-tool-binding.ts src/lib/media/browser-runtime/job-snapshots.ts src/lib/capabilities/execution-targets.ts src/lib/capabilities/mcp-process-runtime.ts src/lib/capabilities/mcp-stdio-adapter.ts src/lib/jobs/compose-media-deferred-job.test.ts src/lib/capabilities/mcp-process-runtime.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/hooks/chat/useBrowserCapabilityRuntime.test.tsx src/lib/capabilities/execution-targets.test.ts
npm exec vitest run src/lib/jobs/enqueue-deferred-tool-job.test.ts src/lib/jobs/compose-media-deferred-job.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/lib/capabilities/mcp-process-runtime.test.ts
npm exec eslint src/lib/jobs/enqueue-deferred-tool-job.ts src/lib/jobs/enqueue-deferred-tool-job.test.ts src/lib/jobs/compose-media-deferred-job.ts src/lib/chat/stream-execution.ts src/lib/capabilities/mcp-process-runtime.ts src/lib/capabilities/mcp-stdio-adapter.ts src/lib/capabilities/mcp-process-runtime.test.ts src/core/capability-catalog/runtime-tool-binding.ts src/core/capability-catalog/runtime-tool-binding.test.ts
```

## Suggested Verification Commands

```bash
npm exec vitest run src/core/capability-catalog/runtime-tool-binding.test.ts src/core/capability-catalog/mcp-export.test.ts src/core/capability-catalog/mcp-catalog-parity.test.ts src/core/capability-catalog/mcp-domain-separation.test.ts tests/mcp/transport/operations-mcp-stdio.test.ts src/lib/media/browser-runtime/browser-capability-registry.test.ts src/lib/media/ffmpeg/media-execution-router.test.ts
npm exec eslint src/core/capability-catalog/capability-definition.ts src/core/capability-catalog/catalog.ts src/core/capability-catalog/mcp-export.ts src/lib/chat/tool-composition-root.ts mcp/operations-server.ts src/lib/media/browser-runtime/browser-capability-registry.ts src/hooks/chat/useBrowserCapabilityRuntime.ts src/lib/media/ffmpeg/media-execution-router.ts src/lib/jobs/job-capability-registry.ts
npm exec vitest run src/lib/capabilities/execution-targets.test.ts
npm exec eslint src/lib/capabilities/execution-targets.ts src/lib/capabilities/executor-dispatch.ts src/lib/capabilities/execution-targets.test.ts
npm exec vitest run src/core/capability-catalog/runtime-tool-binding.test.ts src/lib/capabilities/execution-targets.test.ts tests/mcp/transport/admin-web-search-mcp-stdio.test.ts tests/mcp/transport/operations-mcp-stdio.test.ts
npm exec eslint src/core/tool-registry/ToolExecutionContext.ts src/core/capability-catalog/runtime-tool-binding.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/lib/capabilities/execution-targets.ts src/lib/capabilities/executor-dispatch.ts src/lib/capabilities/mcp-stdio-adapter.ts src/lib/capabilities/execution-targets.test.ts mcp/admin-web-search-server.ts tests/mcp/transport/stdio-harness.ts tests/mcp/transport/admin-web-search-mcp-stdio.test.ts
npm exec vitest run src/app/api/chat/jobs/route.test.ts src/lib/jobs/compose-media-deferred-job.test.ts src/lib/capabilities/mcp-process-runtime.test.ts src/lib/capabilities/execution-targets.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/hooks/chat/useBrowserCapabilityRuntime.test.tsx
npm exec eslint src/lib/jobs/compose-media-deferred-job.ts src/app/api/chat/jobs/route.ts src/app/api/chat/jobs/route.test.ts src/core/capability-catalog/runtime-tool-binding.ts src/lib/media/browser-runtime/job-snapshots.ts src/lib/capabilities/execution-targets.ts src/lib/capabilities/mcp-process-runtime.ts src/lib/capabilities/mcp-stdio-adapter.ts src/lib/jobs/compose-media-deferred-job.test.ts src/lib/capabilities/mcp-process-runtime.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/hooks/chat/useBrowserCapabilityRuntime.test.tsx src/lib/capabilities/execution-targets.test.ts
npm exec vitest run src/lib/jobs/enqueue-deferred-tool-job.test.ts src/lib/jobs/compose-media-deferred-job.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/lib/capabilities/mcp-process-runtime.test.ts
npm exec eslint src/lib/jobs/enqueue-deferred-tool-job.ts src/lib/jobs/enqueue-deferred-tool-job.test.ts src/lib/jobs/compose-media-deferred-job.ts src/lib/chat/stream-execution.ts src/lib/capabilities/mcp-process-runtime.ts src/lib/capabilities/mcp-stdio-adapter.ts src/lib/capabilities/mcp-process-runtime.test.ts src/core/capability-catalog/runtime-tool-binding.ts src/core/capability-catalog/runtime-tool-binding.test.ts
```

## Expected Evidence Artifacts

- An execution-target matrix showing which capabilities are currently host, deferred-job, browser, MCP stdio, container-ready MCP, native-process-ready, or remote-service-ready.
- A dispatch seam map showing how the host planner resolves from catalog metadata to concrete target adapters.
- A parity proof for one low-coupling pilot capability that can be invoked through in-process and MCP-target execution without policy rewrites.
- A short operational note for long-lived sidecar lifecycle, health, and inventory discovery.
- A handoff note that keeps heavy-runtime externalization explicitly deferred to Phase 8.

## Detailed Implementation Plan

1. Normalize execution-target vocabulary around the surfaces that already exist.
   - Add planner-level target kinds for `host_ts`, `deferred_job`, `browser_wasm`, `mcp_stdio`, `mcp_container`, `native_process`, and `remote_service`.
   - Derive planner inputs from existing catalog facets instead of introducing another hand-maintained source of truth.
   - Keep `presentation.executionMode` and the existing job or browser policy facets intact.
2. Add a host-side planner and target-adapter interfaces.
   - Introduce a planning surface that accepts the capability definition plus request context and resolves a target plan.
   - Keep RBAC, prompt/runtime context, and provenance checks in the existing host middleware stack before target dispatch.
   - Provide adapters for in-process registry execution, deferred-job enqueue, browser handoff metadata, and MCP invocation.
3. Add local MCP execution infrastructure.
   - Separate MCP server inventory and transport concerns from host invocation concerns.
   - Define long-lived sidecar lifecycle, health, and tool inventory expectations.
   - Start with `mcp_stdio`; treat container transport as the same adapter family rather than a separate architecture.
4. Pilot `admin_web_search` through the planner.
   - Keep the current app behavior and response shape stable.
   - Route the capability through the new planner to either in-process shared execution or MCP sidecar invocation without policy rewrites.
   - Add parity tests proving the same capability definition can be invoked via both targets.
5. Hold heavy-runtime externalization for Phase 8.
   - Document `compose_media` and FFmpeg as the next pilot family after the planner and sidecar contract are proven.
   - Do not broaden this phase into media packaging, Dockerfile rewrites, or full extension-pack separation.

## Scope Guardrails

- Do not externalize FFmpeg or other heavy runtimes as the first proof.
- Do not create a second source of truth for execution policy outside the catalog and planner boundary.
- Do not move auth, RBAC, prompt assembly, conversation state, job state, or artifact governance into sidecars.
- Do not require networked MCP transport for the first pilot; stdio-backed sidecars are sufficient to prove the model.

## Packet Refresh Record

- Date: 2026-04-13
- Files updated: this phase packet, the Phase Status Board, and the roadmap entry.
- Summary of what changed: replaced the Phase 7 stub with a code-backed execution-surface inventory, a dispatch-seam map, a concrete pilot choice (`admin_web_search`), and a clear defer-until-Phase-8 ruling for heavy-runtime externalization.
- Deviations from the original stub: the packet now treats Phase 7 as unifying existing surfaces rather than adding entirely new metadata from scratch.

## Post-Implementation QA

- [x] Run the focused execution-target baseline bundle plus any new planner or adapter tests.
- [ ] Run changed-file diagnostics and anchor-file lint.
- [x] Prove one capability can move between in-process and MCP-target execution without RBAC or prompt/runtime rewrites.
- [ ] Confirm sidecar execution leaves conversation state, job state, and artifact ownership in the host.
- [x] Expand browser-WASM and sidecar execution-target coverage so each active target family has positive, negative, and end-to-end golden-path or edge-case evidence.
- [x] Record the Phase 8 handoff for heavy-runtime externalization once the pilot lands.

## Exit Criteria

- A host-owned execution-target contract exists and is derived from catalog/runtime metadata rather than ad hoc call sites.
- Host-side dispatch no longer assumes only `registry.execute()` or direct job-handler lookup.
- One low-coupling capability proves the sidecar target model without moving canonical state out of the host.
- The next phase can externalize heavy runtimes using the same planner and adapter model instead of a one-off container path.

## Handoff

- What the next phase should now assume: capability definitions already carry partial execution metadata, browser and deferred-job projections are already catalog-derived, the operations MCP server is a stable protocol surface, the host planner plus target-adapter seam exists in [../../../../src/lib/capabilities/execution-targets.ts](../../../../src/lib/capabilities/execution-targets.ts#L1) and [../../../../src/lib/capabilities/executor-dispatch.ts](../../../../src/lib/capabilities/executor-dispatch.ts#L1), `admin_web_search` now has real host-versus-MCP parity through a managed reusable sidecar runtime in [../../../../src/lib/capabilities/mcp-process-runtime.ts](../../../../src/lib/capabilities/mcp-process-runtime.ts#L1) plus [../../../../src/lib/capabilities/mcp-stdio-adapter.ts](../../../../src/lib/capabilities/mcp-stdio-adapter.ts#L1), browser-prepared capabilities already have a planner-backed `browser_wasm` compatibility path, and `compose_media` now has a planner-backed `deferred_job` compatibility path through the shared enqueue seam in [../../../../src/lib/jobs/compose-media-deferred-job.ts](../../../../src/lib/jobs/compose-media-deferred-job.ts#L1).
- What remains unresolved: sidecar supervision beyond the managed process pool plus static compose declarations, broader browser-WASM and sidecar end-to-end coverage for positive and negative paths, and the first production-owned native or remote execution family that proves those generic adapters against a non-test workload.
- What docs need updating: keep this packet, the Phase Status Board, the roadmap, and [../subsystems/execution-targets.md](../subsystems/execution-targets.md#L1) aligned once the planner type or the first sidecar adapter lands.
