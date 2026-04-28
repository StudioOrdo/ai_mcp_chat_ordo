# Runtime Core Subsystem Plan

Date: 2026-04-12

## Scope

This document covers the runtime-heavy subsystems:

- chat request handling
- provider execution behavior
- tool registry and capability catalog
- prompt runtime and control plane
- search and retrieval
- deferred jobs

## Current State Matrix

| Subsystem | Current role | Health | Preserve | Refactor target | Evidence |
| --- | --- | --- | --- | --- | --- |
| Chat stream | End-to-end orchestrator for streaming assistant turns | strained | conversation model, lifecycle capture | split by phase | [../../../../src/lib/chat/stream-pipeline.ts](../../../../src/lib/chat/stream-pipeline.ts#L383) |
| Direct-turn runtime | Simple non-stream path for assistant turns | acceptable but drift-prone | lightweight loop | unify provider policy with stream path | [../../../../src/lib/chat/orchestrator.ts](../../../../src/lib/chat/orchestrator.ts#L6) |
| Tool registry | runtime lookup, RBAC, bundle expansion, result formatting | good | in-memory registry, middleware model | reduce manual registration and drift | [../../../../src/core/tool-registry/ToolRegistry.ts](../../../../src/core/tool-registry/ToolRegistry.ts#L33) |
| Capability catalog | source-of-truth for metadata and policy | high-value but oversized | central policy model | split by family or facet | [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts#L31) |
| Prompt runtime | builds effective prompt text | useful but diffuse | slot-based prompt governance | tighten contracts and invalidation | [../../../../src/lib/chat/prompt-runtime.ts](../../../../src/lib/chat/prompt-runtime.ts#L199) |
| Prompt control plane | mutates prompt slots and activation state | good | governed mutations and versioning | add explicit cache/provenance invalidation rules | [../../../../src/lib/prompts/prompt-control-plane-service.ts](../../../../src/lib/prompts/prompt-control-plane-service.ts#L175) |
| Search pipeline | hybrid vector plus BM25 retrieval | solid | query processing, hybrid retrieval | decouple initialization and configuration | [../../../../src/lib/chat/search-pipeline.ts](../../../../src/lib/chat/search-pipeline.ts#L23) |
| Deferred jobs | background work, retries, projections, notifications | strong | worker model and event audit trail | startup validation and event-boundary cleanup | [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L322) |

## Preserve

| Keep | Why |
| --- | --- |
| Conversation interactor and message model | The domain model is not the problem; orchestration concentration is |
| Tool middleware chain | RBAC, logging, and capability routing are cleanly composed |
| Capability catalog concept | Centralized policy data is the right direction for a tool-heavy app |
| QueryProcessor and hybrid retrieval design | Clear retrieval layering and fallback model |
| Deferred-job event projection model | Durable and operationally useful |

## Replace Or Reshape

| Replace or reshape | Why |
| --- | --- |
| One-class stream orchestration | Too many responsibilities are bundled into a single runtime seam |
| Manual bundle registration sprawl | Tool registration is still too hand-assembled in [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts#L44) |
| Single giant capability catalog file | Review and change risk grows with every new tool |
| Prompt assembly without explicit cache and invalidation rules | Hard to reason about cross-surface drift |
| Mixed job-state and assistant-state convergence | Client state sources are more ambiguous than they need to be |

## Work Packages

### 1. Stream Pipeline Decomposition

| Package | Files | Outcome |
| --- | --- | --- |
| request parsing and validation extraction | [../../../../src/app/api/chat/stream/route.ts](../../../../src/app/api/chat/stream/route.ts#L19), [../../../../src/lib/chat/stream-pipeline.ts](../../../../src/lib/chat/stream-pipeline.ts#L383) | route becomes composition-only |
| context and prompt prep extraction | [../../../../src/lib/chat/stream-pipeline.ts](../../../../src/lib/chat/stream-pipeline.ts#L548), [../../../../src/lib/chat/prompt-runtime.ts](../../../../src/lib/chat/prompt-runtime.ts#L199) | prompt prep is explicit and testable |
| stream finalization extraction | [../../../../src/lib/chat/stream-pipeline.ts](../../../../src/lib/chat/stream-pipeline.ts#L896) | assistant completion persistence is isolated |

### 2. Provider Path Convergence

| Package | Files | Outcome |
| --- | --- | --- |
| unify retry and timeout policy | `src/lib/chat/anthropic-stream.ts`, [../../../../src/lib/chat/orchestrator.ts](../../../../src/lib/chat/orchestrator.ts#L6), `src/lib/chat/chat-turn.ts` | stream and direct-turn behave consistently |
| add parity tests | `tests/chat/provider-parity.test.ts` | provider drift becomes visible in CI |

### 3. Tool And Catalog Tightening

| Package | Files | Outcome |
| --- | --- | --- |
| split capability metadata by family | [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts#L31) | smaller review units |
| reduce manual registration | [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts#L57) | fewer sync points between bundles and catalog |
| extend catalog sync tests | `tests/tools/catalog-sync.test.ts`, [../../../../src/lib/chat/registry-sync.test.ts](../../../../src/lib/chat/registry-sync.test.ts) | startup and CI validation improve |

### 4. Prompt Runtime Cleanup

| Package | Files | Outcome |
| --- | --- | --- |
| explicit prompt-runtime cache key and invalidation rules | [../../../../src/lib/chat/prompt-runtime.ts](../../../../src/lib/chat/prompt-runtime.ts#L199), [../../../../src/lib/prompts/prompt-control-plane-service.ts](../../../../src/lib/prompts/prompt-control-plane-service.ts#L204) | predictable prompt behavior across surfaces |
| reduce config-owned prompt text | [../../../../src/lib/chat/prompt-runtime.ts](../../../../src/lib/chat/prompt-runtime.ts#L218), `config/prompts.json` | prompt ownership becomes more coherent |

### 5. Job Boundary Cleanup

| Package | Files | Outcome |
| --- | --- | --- |
| validate capability to handler mapping | [../../../../src/lib/jobs/job-capability-registry.ts](../../../../src/lib/jobs/job-capability-registry.ts#L80), `src/lib/jobs/deferred-job-handlers.ts` | no missing-handler surprises at runtime |
| separate ordered job events from assistant events | [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L322), [../../../../src/lib/chat/stream-pipeline.ts](../../../../src/lib/chat/stream-pipeline.ts#L828) | cleaner client reconciliation |

## Immediate Next Moves

1. Add provider parity tests before changing runtime internals.
2. Extract request parsing and context preparation out of [../../../../src/lib/chat/stream-pipeline.ts](../../../../src/lib/chat/stream-pipeline.ts#L383).
3. Add startup validation for capability-to-handler and capability-to-registry alignment.
4. Split the capability catalog by capability family before adding more tool families.

## Desired End State

The runtime core should end up with a thin route layer, explicit staged orchestration, one provider policy model, a decomposed capability catalog, and one clear contract for each runtime event family.
