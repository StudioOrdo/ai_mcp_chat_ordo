# Refactor Roadmap

Date: 2026-04-12

## Goal

Move the system from a powerful app-centric AI operations platform toward a solopreneur host core with a smaller standard tool surface, MCP-based extension packs, and explicit execution targets for browser, container, and native runtimes.

## Principles

1. Refactor the highest-churn seams first.
2. Prefer contract tightening before storage or framework migration.
3. Preserve working domain models and event models where they already add clarity.
4. Do not migrate persistence technology early unless runtime boundaries force it.
5. Every phase should produce a measurable reduction in drift or concentration risk.
6. Keep the host as the system of record and treat external runtimes as execution engines, not owners of canonical state.

## Recommended Order

Detailed execution packets for these phases live under [phases/README.md](./phases/README.md).

| Phase | Goal | Primary files | Exit criteria | Rough effort |
| --- | --- | --- | --- | --- |
| 0 | Establish guardrails and parity tests | `src/lib/chat/*`, `src/lib/jobs/*`, `tests/*` | parity and startup validation tests exist for provider, prompt, and job-handler contracts | 1 week |
| 1 | Split chat orchestration into explicit stages | [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L383), [../../../src/app/api/chat/stream/route.ts](../../../src/app/api/chat/stream/route.ts#L19) | route becomes a thin composition layer; pipeline no longer owns all phases directly | 2 weeks |
| 2 | Unify provider behavior across stream and direct-turn paths | [../../../src/lib/chat/orchestrator.ts](../../../src/lib/chat/orchestrator.ts#L6), `src/lib/chat/anthropic-stream.ts`, `src/lib/chat/chat-turn.ts` | same policy and retry behavior for stream and direct-turn | 1 week |
| 3 | Decompose capability metadata and tool registration | [../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts#L31), [../../../src/lib/chat/tool-composition-root.ts](../../../src/lib/chat/tool-composition-root.ts#L57) | catalog split by family or facet; registration is startup-validated and less manual | 2 weeks |
| 4 | Tighten prompt-runtime contracts and invalidation | [../../../src/lib/chat/prompt-runtime.ts](../../../src/lib/chat/prompt-runtime.ts#L199), [../../../src/lib/prompts/prompt-control-plane-service.ts](../../../src/lib/prompts/prompt-control-plane-service.ts#L140) | prompt assembly has explicit inputs, invalidation rules, and parity tests across surfaces | 1 week |
| 5 | Separate job-state convergence from chat-state convergence | [../../../src/lib/jobs/deferred-job-worker.ts](../../../src/lib/jobs/deferred-job-worker.ts#L322), `src/app/api/chat/events/route.ts`, [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L896) | ordered event contracts exist and client reconciliation has one clear source per event family | 1 week |
| 6 | Clean up platform delivery seams | [../../../src/adapters/RepositoryFactory.ts](../../../src/adapters/RepositoryFactory.ts#L45), [../../../src/app/layout.tsx](../../../src/app/layout.tsx#L73), [../../../src/components/AppShell.tsx](../../../src/components/AppShell.tsx#L15), [../../../src/app/admin/page.tsx](../../../src/app/admin/page.tsx#L45) | dependency assembly rules, route-validation rules, and admin feature colocation rules are explicit | 2 weeks |
| 7 | Introduce execution-target abstraction and container-ready extension runtime support | [../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts#L31), [../../../src/lib/chat/tool-composition-root.ts](../../../src/lib/chat/tool-composition-root.ts#L57), [../../../mcp/operations-server.ts](../../../mcp/operations-server.ts#L1) | capabilities can declare host, browser, MCP, container, and native execution targets explicitly | 2 weeks |
| 8 | Separate the solopreneur core from extension packs and externalize heavy runtimes | [../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts](../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts#L1), [../../../compose.yaml](../../../compose.yaml#L1), [../../../Dockerfile](../../../Dockerfile#L1) | core tools are clearly identified, heavy runtimes no longer live in the main app container, and extension packs have an explicit ownership model | 2 weeks |

## Phase 0: Guardrails First

### Phase 0 Work

| Task | Why | Target files |
| --- | --- | --- |
| Add or tighten provider-parity tests for stream and direct-turn execution | Prevent silent divergence between runtime paths | `tests/chat/chat-route.test.ts`, `tests/chat/chat-stream-route.test.ts`, [../../../src/lib/chat/orchestrator.ts](../../../src/lib/chat/orchestrator.ts#L6), `src/lib/chat/anthropic-stream.ts` |
| Keep capability-to-handler validation live and resolve registry policy drift | Catch catalog-derived job-policy drift before runtime | [../../../src/lib/jobs/job-capability-registry.test.ts](../../../src/lib/jobs/job-capability-registry.test.ts#L1), `src/lib/jobs/deferred-job-handlers.ts`, [../../../src/lib/jobs/job-capability-registry.ts](../../../src/lib/jobs/job-capability-registry.ts#L1) |
| Add prompt-surface parity tests | Ensure `chat_stream`, direct turn, and eval surfaces cannot drift accidentally | [../../../tests/prompt-runtime.test.ts](../../../tests/prompt-runtime.test.ts#L1), [../../../tests/stream-pipeline.prompt-runtime-seam.test.ts](../../../tests/stream-pipeline.prompt-runtime-seam.test.ts#L1), [../../../src/lib/chat/prompt-runtime.ts](../../../src/lib/chat/prompt-runtime.ts#L199) |
| Freeze current diagnostics and quarantine any reintroduced blocking errors | Restore baseline repo hygiene before structural work | [../../../src/lib/chat/orchestrator.ts](../../../src/lib/chat/orchestrator.ts#L1), [../../../src/app/api/chat/stream/route.ts](../../../src/app/api/chat/stream/route.ts#L1), [../../../src/lib/chat/prompt-runtime.ts](../../../src/lib/chat/prompt-runtime.ts#L199), [../../../src/lib/jobs/job-capability-registry.ts](../../../src/lib/jobs/job-capability-registry.ts#L1), [../../../src/lib/jobs/deferred-job-handlers.ts](../../../src/lib/jobs/deferred-job-handlers.ts#L1), [../../../tests/chat-performance-a11y.test.tsx](../../../tests/chat-performance-a11y.test.tsx#L163) |

### Phase 0 Exit Criteria

1. Stream and direct-turn provider behavior has a parity test.
2. Deferred-job capability to handler coverage is validated in CI.
3. Prompt-runtime parity across supported surfaces is validated in CI.
4. Blocking diagnostics in the phase anchors are resolved or formally quarantined.

## Phase 1: Break Up The Stream Pipeline

### Phase 1 Problem

[../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L383) currently owns too many phases.

### Phase 1 Target Shape

Create explicit services for:

1. request parsing and validation
2. conversation and attachment preparation
3. context and prompt preparation
4. tool-executor preparation
5. SSE response orchestration
6. turn finalization and lifecycle persistence

### Phase 1 Work

| Task | Target files |
| --- | --- |
| Extract request normalization and validation service | `src/lib/chat/request-parsing.ts`, [../../../src/app/api/chat/stream/route.ts](../../../src/app/api/chat/stream/route.ts#L19) |
| Extract conversation prep service | `src/lib/chat/conversation-preparation.ts`, [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L485) |
| Extract context/prompt prep service | `src/lib/chat/context-preparation.ts`, [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L548) |
| Extract stream finalizer | `src/lib/chat/stream-finalizer.ts`, [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L896) |

### Phase 1 Exit Criteria

The route in [../../../src/app/api/chat/stream/route.ts](../../../src/app/api/chat/stream/route.ts#L19) reads as composition, not orchestration.

## Phase 2: Unify Provider Behavior

### Phase 2 Problem

The stream path and direct-turn path are operationally related but structurally separate.

### Phase 2 Work

| Task | Target files |
| --- | --- |
| Introduce a shared provider execution policy abstraction | `src/lib/chat/provider-runtime.ts`, `src/lib/chat/provider-policy.ts` |
| Reuse the same retry, timeout, and model-fallback policy in stream and direct-turn paths | `src/lib/chat/anthropic-stream.ts`, [../../../src/lib/chat/orchestrator.ts](../../../src/lib/chat/orchestrator.ts#L6), `src/lib/chat/chat-turn.ts` |
| Make provider policy testable without full stream mocks | `tests/chat/provider-runtime.test.ts` |

### Phase 2 Exit Criteria

The system has one provider policy model and two transport adapters, not two independent provider paths.

Status on 2026-04-12: complete. `provider-runtime.ts` is now adopted by both [../../../src/lib/chat/anthropic-client.ts](../../../src/lib/chat/anthropic-client.ts) and [../../../src/lib/chat/anthropic-stream.ts](../../../src/lib/chat/anthropic-stream.ts), and the dedicated seam test in [../../../tests/chat/provider-runtime.test.ts](../../../tests/chat/provider-runtime.test.ts) is green as part of the focused 8-file, 90-test Phase 2 bundle plus changed-file eslint.

## Phase 3: Decompose Capability Metadata And Registration

### Phase 3 Problem

[../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts#L31) is doing the right job in the wrong shape.

### Phase 3 Work

| Task | Target files |
| --- | --- |
| Split catalog by family or facet | `src/core/capability-catalog/catalog/*.ts` or `src/core/capability-catalog/families/*.ts` |
| Keep a composed export as the public API | `src/core/capability-catalog/index.ts` |
| Reduce manual registration in [../../../src/lib/chat/tool-composition-root.ts](../../../src/lib/chat/tool-composition-root.ts#L44) and [../../../src/lib/chat/tool-composition-root.ts](../../../src/lib/chat/tool-composition-root.ts#L46) | [../../../src/lib/chat/tool-composition-root.ts](../../../src/lib/chat/tool-composition-root.ts#L57) |
| Add startup validation that registered tools, capability definitions, presentation descriptors, browser descriptors, and job capabilities stay aligned | `tests/tools/catalog-sync.test.ts` |

### Phase 3 Exit Criteria

Capability metadata is still centralized, but no single source file carries the whole tool universe.

Status on 2026-04-12: complete. [../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts) still exposes the 55-entry public catalog and the projection helpers, and all raw capability definitions now live in [../../../src/core/capability-catalog/families](../../../src/core/capability-catalog/families), including affiliate and job. Presentation, browser, job, and runtime registration surfaces now all derive from catalog-owned binding metadata and catalog-owned schema plus bundle-local dependency wiring, [../../../src/lib/chat/tool-composition-root.ts](../../../src/lib/chat/tool-composition-root.ts) still drives bundle sequencing through one ordered registrar table, and [../../../src/lib/chat/tool-bundles/bundle-registration.ts](../../../src/lib/chat/tool-bundles/bundle-registration.ts) still lets all 11 bundles derive `toolNames` and registration order from one source. The focused Phase 3 verification bundle now passes 11 of 11 files and 156 of 156 tests, and the broader catalog regression bundle passes 13 of 13 files and 188 of 188 tests.

## Phase 4: Tighten Prompt Runtime Contracts

### Phase 4 Problem

Prompt assembly is powerful but diffuse. It pulls from DB slots, config, and request overlays with limited cross-surface invariants.

### Phase 4 Work

| Task | Target files |
| --- | --- |
| Introduce explicit prompt input contracts and cache keys | [../../../src/lib/chat/prompt-runtime.ts](../../../src/lib/chat/prompt-runtime.ts#L199) |
| Define invalidation rules when prompt-control-plane changes land | [../../../src/lib/prompts/prompt-control-plane-service.ts](../../../src/lib/prompts/prompt-control-plane-service.ts#L175), [../../../src/lib/prompts/prompt-control-plane-service.ts](../../../src/lib/prompts/prompt-control-plane-service.ts#L204) |
| Reduce config-owned prompt text where possible | `config/prompts.json`, `src/lib/config/defaults.ts`, [../../../src/lib/chat/prompt-runtime.ts](../../../src/lib/chat/prompt-runtime.ts#L218) |

### Phase 4 Exit Criteria

Prompt provenance can explain not just slot lineage, but the effective prompt assembly contract.

Status on 2026-04-12: complete. [../../../src/lib/chat/prompt-runtime.ts](../../../src/lib/chat/prompt-runtime.ts) now defines the explicit prompt request/result seam for `chat_stream`, `direct_turn`, and `live_eval`, while [../../../src/lib/chat/policy.ts](../../../src/lib/chat/policy.ts) is now a compatibility wrapper over that runtime. Governed mutable slots are limited to `ALL/base` plus per-role `role_directive` entries in [../../../src/lib/prompts/prompt-role-inventory.ts](../../../src/lib/prompts/prompt-role-inventory.ts), [../../../src/lib/prompts/prompt-control-plane-service.ts](../../../src/lib/prompts/prompt-control-plane-service.ts) revalidates `/admin/prompts` plus the slot detail path and records `prompt_version_changed` events for affected active conversations, and [../../../src/lib/prompts/prompt-provenance-service.ts](../../../src/lib/prompts/prompt-provenance-service.ts) now records replayable effective prompt provenance instead of only slot lineage. The final broader Phase 4 confidence bundle now passes 22 of 22 files and 226 of 226 tests, covering prompt runtime, read parity, provenance replay, prompt manifest assembly, anonymous RBAC expectations, prompt-tool and inspect-runtime-context surfaces, admin conversation prompt provenance views, stream-route integration, direct-turn integration, and live-eval integration.

## Phase 5: Separate Event Convergence Responsibilities

### Phase 5 Problem

Chat state and job state currently overlap too much in the same runtime flow.

### Phase 5 Work

| Task | Target files |
| --- | --- |
| Define one ordered contract for assistant stream events | [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L896), `src/core/entities/chat-stream.ts` |
| Define one ordered contract for job progress and job result events | [../../../src/lib/jobs/deferred-job-worker.ts](../../../src/lib/jobs/deferred-job-worker.ts#L322), `src/app/api/chat/events/route.ts` |
| Remove ambiguous duplication between stream-time tool results and job-event replay where practical | [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L828), `src/lib/jobs/job-status-snapshots.ts` |

### Phase 5 Exit Criteria

There is a clear answer to where any given piece of runtime state comes from.

Status on 2026-04-12: complete. [../../../src/core/entities/chat-stream.ts](../../../src/core/entities/chat-stream.ts) still defines one typed event union, but assistant lifecycle and deferred-job lifecycle are now separated by event family, transport, and reducer ownership. [../../../src/app/api/chat/events/route.ts](../../../src/app/api/chat/events/route.ts) and [../../../src/app/api/jobs/events/route.ts](../../../src/app/api/jobs/events/route.ts) both delegate to [../../../src/lib/jobs/job-event-stream.ts](../../../src/lib/jobs/job-event-stream.ts), while [../../../src/lib/jobs/job-publication.ts](../../../src/lib/jobs/job-publication.ts), [../../../src/lib/jobs/job-read-model.ts](../../../src/lib/jobs/job-read-model.ts), and [../../../src/lib/jobs/job-status-snapshots.ts](../../../src/lib/jobs/job-status-snapshots.ts) ensure backlog replay and snapshot hydration emit canonical `job_*` state instead of leaking audit-only worker events into the UI. On the client, [../../../src/hooks/chat/useChatStreamRuntime.ts](../../../src/hooks/chat/useChatStreamRuntime.ts) owns the active assistant stream lifecycle, [../../../src/hooks/chat/useChatJobEvents.ts](../../../src/hooks/chat/useChatJobEvents.ts) owns durable conversation job-state convergence, [../../../src/hooks/useGlobalChat.tsx](../../../src/hooks/useGlobalChat.tsx) wires those paths separately, and [../../../src/lib/chat/StreamStrategy.ts](../../../src/lib/chat/StreamStrategy.ts) routes `generation_*` to terminal-state updates and `job_*` to job-status upserts. The broader Phase 5 verification surface now passes 30 of 30 unit files and 181 of 181 tests, `npm run build` completes cleanly, and the targeted browser proof passes 3 Playwright specs and 7 browser tests covering stop-generation recovery, deferred-job chat flows, and the signed-in jobs page.

## Phase 6: Platform And Delivery Cleanup

### Phase 6 Problem

The platform side is not broken, but its rules are implicit.

### Phase 6 Work

| Task | Target files |
| --- | --- |
| Define where service-locator access is allowed and where composition roots are required | [../../../src/adapters/RepositoryFactory.ts](../../../src/adapters/RepositoryFactory.ts#L45), [../../../src/lib/chat/conversation-root.ts](../../../src/lib/chat/conversation-root.ts#L92) |
| Standardize request validation rules for route handlers | [../../../src/app/api/chat/route.ts](../../../src/app/api/chat/route.ts#L13), [../../../src/app/api/chat/stream/route.ts](../../../src/app/api/chat/stream/route.ts#L26) |
| Reduce pathname-driven shell branching and clarify route-surface ownership | [../../../src/components/AppShell.tsx](../../../src/components/AppShell.tsx#L15) |
| Colocate admin feature loaders, actions, and client tables more aggressively | [../../../src/app/admin/page.tsx](../../../src/app/admin/page.tsx#L48), `src/lib/admin/*`, `src/lib/operator/*` |

### Phase 6 Exit Criteria

Platform rules are written down in code structure, not just in comments.

Status on 2026-04-13: complete. [../../../src/adapters/RepositoryFactory.ts](../../../src/adapters/RepositoryFactory.ts) documents the accepted RSC service-locator exception and process-cached singleton lifetime, while [../../../src/lib/chat/conversation-root.ts](../../../src/lib/chat/conversation-root.ts) defines the request-scoped composition-root exception for grouped chat and workflow persistence. [../../../src/lib/chat/direct-turn-intake.ts](../../../src/lib/chat/direct-turn-intake.ts) gives `/api/chat` an explicit schema-backed intake stage, [../../../src/components/AppShell.tsx](../../../src/components/AppShell.tsx) now reduces document-flow rendering to one shared branch, [../../../src/lib/admin/leads/admin-leads-attention.ts](../../../src/lib/admin/leads/admin-leads-attention.ts) owns the single-feature leads attention loaders, and [../../../src/lib/admin/pipeline/admin-pipeline-attention.ts](../../../src/lib/admin/pipeline/admin-pipeline-attention.ts) owns the cross-feature overdue follow-up summary behind operator compatibility re-exports. The focused implementation bundle still passes 6 files and 119 tests, the closeout bundle passes 4 files and 63 tests, the targeted overdue ownership source-assertion rerun is green, and the touched files are lint-clean with clean editor diagnostics.

## Phase 7: Introduce Execution Targets

### Phase 7 Problem

The system already has multiple execution styles, but they are scattered and implicit rather than governed through one host contract.

### Phase 7 Work

| Task | Target files |
| --- | --- |
| add an execution-target facet to the capability model | [../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts#L31), `src/core/capability-catalog/capability-definition.ts` |
| define target kinds for host TypeScript, deferred jobs, browser WASM, MCP stdio, MCP containers, native processes, and remote services | `src/core/capability-catalog/*`, [../../../src/lib/chat/tool-composition-root.ts](../../../src/lib/chat/tool-composition-root.ts#L57) |
| add host-side runtime planning that resolves a capability to a target-specific executor | `src/lib/capabilities/execution-targets.ts`, `src/lib/capabilities/executor-dispatch.ts` |
| add a pilot MCP sidecar execution path for one tool family | [../../../mcp/operations-server.ts](../../../mcp/operations-server.ts#L1), [../../../compose.yaml](../../../compose.yaml#L1) |

### Phase 7 Exit Criteria

One capability can be described and dispatched without changing host policy logic when its executor moves between host TypeScript, browser WASM, MCP, or containerized MCP.

Status on 2026-04-13: the Phase 7 packet is refreshed and the planner now covers real sidecar parity, a compose-backed `mcp_container` pilot, centralized sidecar inventory, generic `native_process` plus `remote_service` adapters, and shared deferred-job routing for job-backed families. [../../../src/core/tool-registry/ToolExecutionContext.ts](../../../src/core/tool-registry/ToolExecutionContext.ts) carries execution-planning overrides, [../../../src/lib/capabilities/execution-targets.ts](../../../src/lib/capabilities/execution-targets.ts), [../../../src/lib/capabilities/executor-dispatch.ts](../../../src/lib/capabilities/executor-dispatch.ts), [../../../src/lib/capabilities/mcp-process-runtime.ts](../../../src/lib/capabilities/mcp-process-runtime.ts), [../../../src/lib/capabilities/mcp-stdio-adapter.ts](../../../src/lib/capabilities/mcp-stdio-adapter.ts), [../../../src/lib/capabilities/mcp-sidecar-inventory.ts](../../../src/lib/capabilities/mcp-sidecar-inventory.ts), and [../../../src/lib/capabilities/external-target-adapters.ts](../../../src/lib/capabilities/external-target-adapters.ts) now define the planner plus managed sidecar seam, [../../../mcp/admin-web-search-server.ts](../../../mcp/admin-web-search-server.ts) plus [../../../compose.yaml](../../../compose.yaml#L1) still provide the first compose-managed MCP sidecar pilot, and [../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../src/core/capability-catalog/runtime-tool-binding.ts) now routes MCP-exportable capabilities through that seam while also giving browser-prepared capabilities a planner-backed `browser_wasm` path, job-backed deferred capabilities a shared planner-backed `deferred_job` path through [../../../src/lib/jobs/enqueue-deferred-tool-job.ts](../../../src/lib/jobs/enqueue-deferred-tool-job.ts#L1), and explicit native or remote target overrides through the same runtime-binding contract. Real Docker-backed `mcp_container` parity is now proven against a rebuilt compose image rather than a contract stub, `npm run build` is green again after the strict planner and sidecar typing fixes uncovered during that validation, and the focused external-target plus centralized-inventory bundle now passes 40 tests across 4 files. `compose_media` remains the strongest Phase 8 heavy-runtime externalization candidate, but Phase 7's remaining work is now operational rather than structural: broaden sidecar supervision beyond the pilot, expand browser-WASM plus target-family positive and negative coverage, and choose the first production-owned native or remote family.

## Phase 8: Split Core From Extension Packs

### Phase 8 Problem

The current system still feels like one large integrated app rather than a smaller durable host core plus optional packs.

Status on 2026-04-14: in progress. [../../../src/core/capability-catalog/capability-ownership.ts](../../../src/core/capability-catalog/capability-ownership.ts#L1) now defines the first explicit core-versus-pack ownership cut, compatibility-only surfaces such as the legacy `navigate` presentation alias, transcript compatibility snapshot routing, legacy web-search rich-content block, deprecated `API__*` env aliases, and the old `blog`/`book`/`books`/`corpus` route families are removed, and [../../../src/lib/jobs/deferred-job-handlers.ts](../../../src/lib/jobs/deferred-job-handlers.ts#L1) now routes `compose_media` to the dedicated media worker runtime implemented by [../../../src/lib/media/server/media-worker-client.ts](../../../src/lib/media/server/media-worker-client.ts#L1), [../../../src/lib/media/server/compose-media-worker-runtime.ts](../../../src/lib/media/server/compose-media-worker-runtime.ts#L1), [../../../scripts/media-worker-server.ts](../../../scripts/media-worker-server.ts#L1), [../../../Dockerfile.media](../../../Dockerfile.media#L1), and the `media-worker` service in [../../../compose.yaml](../../../compose.yaml#L1). The exported admin-intelligence tools now also prefer sidecar execution by default through [../../../mcp/operations-server.ts](../../../mcp/operations-server.ts#L1) and [../../../src/lib/capabilities/shared/admin-intelligence-tool.ts](../../../src/lib/capabilities/shared/admin-intelligence-tool.ts#L1), with runtime context bridged through [../../../src/lib/capabilities/mcp-stdio-adapter.ts](../../../src/lib/capabilities/mcp-stdio-adapter.ts#L1), [../../../src/lib/capabilities/external-target-adapters.ts](../../../src/lib/capabilities/external-target-adapters.ts#L1), and the first local external-target inventory in [../../../src/lib/capabilities/local-external-target-inventory.ts](../../../src/lib/capabilities/local-external-target-inventory.ts#L1). That sidecar-first admin-intelligence surface now includes `admin_search`, the deferred-job registry, handler assembly, and startup validation now derive their canonical tool list from [../../../src/lib/jobs/job-capability-registry.ts](../../../src/lib/jobs/job-capability-registry.ts#L1) and catalog job facets instead of separate handwritten tables, and `compose_media` now has a planner-owned local `native_process` pilot via [../../../scripts/compose-media-native-target.ts](../../../scripts/compose-media-native-target.ts#L1) before governed deferred fallback. The remaining executor-specific wiring is now isolated behind [../../../src/lib/jobs/deferred-job-handler-factories.ts](../../../src/lib/jobs/deferred-job-handler-factories.ts#L1) and reduced to intentional custom cases, while [../../../src/core/capability-catalog/capability-ownership.ts](../../../src/core/capability-catalog/capability-ownership.ts#L1) now also names explicit runtime ownership for each extension pack and marks the media pack as the next concrete runtime promotion after the first admin-intelligence wave.

### Phase 8 Work

| Task | Target files |
| --- | --- |
| define the first-party standard tool set and mark non-core tool families as extension packs | [../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts#L31), `docs/_refactor/system-state-2026-04-12/target-state.md` |
| move heavy media execution out of the main app container | [../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts](../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts#L1), [../../../Dockerfile](../../../Dockerfile#L1), [../../../compose.yaml](../../../compose.yaml#L1) |
| define the first native-executor pilot, with Rust preferred for backend-heavy workloads | `src/lib/capabilities/native-executors.ts`, `services/` or sidecar runtime definitions |
| document which packs stay in-process and which become MCP or native executors | [../../../docs/_refactor/system-state-2026-04-12/subsystems/execution-targets.md](../../../docs/_refactor/system-state-2026-04-12/subsystems/execution-targets.md) |

### Phase 8 Exit Criteria

The system has a clearly defined solopreneur core, a separate extension-pack model, and an agreed path for moving hot or heavy runtimes out of the main Next.js host.

Status on 2026-04-14: the Phase 8 packet is now refreshed beyond the initial ownership cut. The current 55-capability surface has a proposed core-versus-pack ownership map, the greenfield-unnecessary compatibility surface is explicitly classified into delete-now versus replace-before-delete work, `compose_media` no longer depends only on governed deferred dispatch when browser execution is unavailable, and the first local `native_process` media pilot is now live through the shared planner contract. The execution-target layer from Phase 7 has been sufficient for this move; the next work is broadening media runtime ownership and choosing the next non-host workload after `compose_media`, not another planner abstraction pass.

## Phase 9: Close Canonicalization Gaps And Choose The Next Runtime

### Phase 9 Problem

Phase 8 proved the first ownership and heavy-runtime cuts, but the repo can still overstate completion if the remaining dead helpers, sprint stubs, and legacy notes are left in place.

Status on 2026-04-14: in progress. The first Phase 9 slice already landed: [../../../src/core/use-cases/tools/list-conversation-media-assets.tool.ts](../../../src/core/use-cases/tools/list-conversation-media-assets.tool.ts#L1) exposes reusable conversation-scoped governed assets to the model, [../../../src/lib/media/browser-runtime/job-snapshots.ts](../../../src/lib/media/browser-runtime/job-snapshots.ts#L1) now normalizes audio payload metadata alongside chart and graph assets, [../../../src/components/admin/AdminBreadcrumb.tsx](../../../src/components/admin/AdminBreadcrumb.tsx#L1) is no longer a sprint stub, [../../../src/adapters/RepositoryFactory.ts](../../../src/adapters/RepositoryFactory.ts#L1) narrows the legacy `getDb()` note to explicit exceptions, and [../../../src/core/capability-catalog/capability-ownership.ts](../../../src/core/capability-catalog/capability-ownership.ts#L1) now records `generate_audio` as the next production-owned `remote_service` workload after `compose_media`. The remaining work is transcript and export continuity plus final doc harmonization.

### Phase 9 Work

| Task | Target files |
| --- | --- |
| remove dead compatibility leftovers and other no-op residual seams | [../../../src/frameworks/ui/chat/plugins/system/resolve-system-card.ts](../../../src/frameworks/ui/chat/plugins/system/resolve-system-card.ts#L1) and adjacent packet/docs references |
| replace or retire sprint stubs that still preserve non-canonical product surfaces | [../../../src/components/admin/AdminBreadcrumb.tsx](../../../src/components/admin/AdminBreadcrumb.tsx#L1) |
| reduce the remaining legacy route-handler assembly note to the real migration surface | [../../../src/adapters/RepositoryFactory.ts](../../../src/adapters/RepositoryFactory.ts#L1) |
| choose and document the next production-owned native or remote workload after `compose_media` | [done: `generate_audio` as the next `remote_service` candidate in the media pack] [../../../docs/_refactor/system-state-2026-04-12/subsystems/execution-targets.md](../../../docs/_refactor/system-state-2026-04-12/subsystems/execution-targets.md#L1), [../../../src/core/capability-catalog/capability-ownership.ts](../../../src/core/capability-catalog/capability-ownership.ts#L1) |

### Phase 9 Exit Criteria

The code and docs describe the same truthful completion state, and the next runtime-promotion decision is explicit rather than implied.

Status target: the dead compatibility helper is gone, the breadcrumb stub is resolved or retired, the RepositoryFactory legacy note is narrower and backed by current code reality, and the next production-owned non-host runtime after `compose_media` is named in the docs with a concrete target shape.

## What Not To Do First

1. Do not start with a database migration to another stack.
2. Do not replace the repository/interactor model just because some assembly seams are inconsistent.
3. Do not split the capability catalog into dozens of tiny files without also tightening registration and projection contracts.
4. Do not attempt a broad UI rewrite before runtime seams are stable.
5. Do not add containerized MCP or native executors before the host has an explicit execution-target contract.

## Success Metrics

| Metric | Desired direction |
| --- | --- |
| `stream-pipeline.ts` size and responsibility count | down |
| provider behavior variance between stream and direct-turn | down |
| manual tool registration steps | down |
| prompt-runtime drift risk across surfaces | down |
| startup validation coverage for runtime contracts | up |
| number of platform seams with explicit ownership rules | up |
| number of capabilities that declare an explicit execution target | up |
| amount of heavy runtime logic living inside the main app container | down |
| clarity of the standard first-party tool set versus extension packs | up |

Use this roadmap after reading [system-state.md](./system-state.md) and [target-state.md](./target-state.md).
