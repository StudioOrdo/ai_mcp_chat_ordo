# System State

Date: 2026-04-12

## Executive Summary

This codebase is not a simple website. From source, it is a full-stack AI-assisted operations platform with a chat-first interface at [../../../src/app/page.tsx](../../../src/app/page.tsx#L7), a floating global chat surface in [../../../src/app/layout.tsx](../../../src/app/layout.tsx#L135), a streaming chat runtime in [../../../src/app/api/chat/stream/route.ts](../../../src/app/api/chat/stream/route.ts#L19), a non-stream direct turn path in [../../../src/app/api/chat/route.ts](../../../src/app/api/chat/route.ts#L9), a hybrid search pipeline in [../../../src/lib/chat/search-pipeline.ts](../../../src/lib/chat/search-pipeline.ts#L23), a deferred-job execution model in [../../../src/lib/jobs/deferred-job-worker.ts](../../../src/lib/jobs/deferred-job-worker.ts#L322), and a substantial admin delivery surface in [../../../src/app/admin/page.tsx](../../../src/app/admin/page.tsx#L45).

The good news is that the system has real architecture. The bad news is that the most critical runtime seams are starting to accumulate too much responsibility, and the codebase is approaching the point where new features will increase coordination cost faster than they increase product value.

## Relative To The Target State

The system is closer in product capability than in platform shape.

| Area | Current position relative to target |
| --- | --- |
| Solopreneur host core | partially present but still too mixed with product-specific workflows |
| Standard first-party tools | strong raw surface area, but not yet curated into a smaller stable standard set |
| MCP as extension model | present in concept and limited implementation, but not yet the primary customization boundary |
| Containerized runtimes | conceptually compatible, not yet host-supported as a first-class target |
| Browser WASM | real and useful, but still narrow rather than foundational |
| Rust or Swift executor path | not yet a general contract in the host |

In practical terms, the current system is best described as a capable integrated app that has the right instincts for becoming a host platform, but has not finished that transition.

## What The System Does

| Domain | Current behavior | Primary evidence |
| --- | --- | --- |
| Conversational runtime | Streams assistant responses, executes tools, persists conversation state, handles attachments, emits lifecycle events | [../../../src/app/api/chat/stream/route.ts](../../../src/app/api/chat/stream/route.ts#L19), [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L383) |
| Direct-turn runtime | Executes a non-stream chat turn against the same user/message model | [../../../src/app/api/chat/route.ts](../../../src/app/api/chat/route.ts#L9), [../../../src/lib/chat/orchestrator.ts](../../../src/lib/chat/orchestrator.ts#L6) |
| Tool execution | Registers role-aware tools, applies middleware, formats results, expands bundles | [../../../src/core/tool-registry/ToolRegistry.ts](../../../src/core/tool-registry/ToolRegistry.ts#L33), [../../../src/lib/chat/tool-composition-root.ts](../../../src/lib/chat/tool-composition-root.ts#L57) |
| Capability metadata | Centralizes schemas, RBAC, execution mode, prompt hints, presentation, and job policy | [../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts#L31) |
| Prompt governance | Builds effective system prompts from DB slots, config overlays, and request context; supports control-plane mutation and provenance | [../../../src/lib/chat/prompt-runtime.ts](../../../src/lib/chat/prompt-runtime.ts#L199), [../../../src/lib/prompts/prompt-control-plane-service.ts](../../../src/lib/prompts/prompt-control-plane-service.ts#L140) |
| Retrieval | Runs hybrid vector plus BM25 retrieval with query processing and fallback chaining | [../../../src/lib/chat/search-pipeline.ts](../../../src/lib/chat/search-pipeline.ts#L23) |
| Deferred jobs | Runs leased background jobs with retries, projections, notifications, and read models | [../../../src/lib/jobs/deferred-job-runtime.ts](../../../src/lib/jobs/deferred-job-runtime.ts#L39), [../../../src/lib/jobs/deferred-job-worker.ts](../../../src/lib/jobs/deferred-job-worker.ts#L322) |
| Platform shell | Renders route-specific shell modes, theme state, nav, footer, and chat mounting points | [../../../src/components/AppShell.tsx](../../../src/components/AppShell.tsx#L15), [../../../src/app/layout.tsx](../../../src/app/layout.tsx#L73) |
| Admin operations | Aggregates health, leads, conversations, jobs, content ops, and analytics into a role-gated surface | [../../../src/app/admin/page.tsx](../../../src/app/admin/page.tsx#L45) |

## System Quality

| Dimension | Assessment |
| --- | --- |
| Product ambition | High. This is a platform with multiple operating surfaces, not a single feature app |
| Code quality | 7.5/10 |
| Architectural durability under current growth | 5.5/10 |
| Testing posture | Good in breadth, uneven in runtime fidelity |
| Operational scale posture | Good for single-node operation, weak for multi-instance evolution |

## What Is Strong

| Strength | Why it matters | Evidence |
| --- | --- | --- |
| Layered domain code | Interactors and repositories are not cosmetic abstractions; they carry actual domain boundaries | [../../../src/core/use-cases/ConversationInteractor.ts](../../../src/core/use-cases/ConversationInteractor.ts#L365) |
| Tool middleware design | Logging, RBAC, and capability checks are composed around execution rather than tangled into handlers | [../../../src/lib/chat/tool-composition-root.ts](../../../src/lib/chat/tool-composition-root.ts#L60) |
| Capability catalog direction | Central metadata definition is the right direction for a tool-heavy system | [../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts#L31) |
| Deferred-job event model | Durable event history plus read-model projection is one of the strongest parts of the repo | [../../../src/lib/jobs/deferred-job-worker.ts](../../../src/lib/jobs/deferred-job-worker.ts#L243), [../../../src/lib/jobs/job-capability-registry.ts](../../../src/lib/jobs/job-capability-registry.ts#L80) |
| Search composition | Query processing and fallback chaining are clean and replaceable | [../../../src/lib/chat/search-pipeline.ts](../../../src/lib/chat/search-pipeline.ts#L39), [../../../src/lib/chat/search-pipeline.ts](../../../src/lib/chat/search-pipeline.ts#L50) |
| Admin degradation behavior | Dashboard loaders use partial failure tolerance instead of blocking the whole screen | [../../../src/app/admin/page.tsx](../../../src/app/admin/page.tsx#L48) |

## What Is Weak

| Weakness | Why it matters | Evidence |
| --- | --- | --- |
| Chat orchestration concentration | Too much critical behavior lives in one file and one class | [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L383) |
| Dual provider/runtime paths | Stream and direct-turn paths can drift in provider behavior and failure handling | [../../../src/app/api/chat/stream/route.ts](../../../src/app/api/chat/stream/route.ts#L19), [../../../src/app/api/chat/route.ts](../../../src/app/api/chat/route.ts#L9), [../../../src/lib/chat/orchestrator.ts](../../../src/lib/chat/orchestrator.ts#L6) |
| Metadata concentration | The capability catalog is valuable, but its current size makes every change high-blast-radius | [../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts#L31) |
| Mixed dependency assembly | The repo uses process-cached factories, request-scoped composition roots, and direct construction side by side | [../../../src/adapters/RepositoryFactory.ts](../../../src/adapters/RepositoryFactory.ts#L45), [../../../src/lib/chat/conversation-root.ts](../../../src/lib/chat/conversation-root.ts#L92), [../../../src/app/layout.tsx](../../../src/app/layout.tsx#L97) |
| Single-node assumptions | In-memory active-stream tracking and process-global SQLite are acceptable now but limit future topology | [../../../src/lib/chat/active-stream-registry.ts](../../../src/lib/chat/active-stream-registry.ts#L18), [../../../src/lib/db/index.ts](../../../src/lib/db/index.ts#L6) |
| Route validation inconsistency | Some request paths use explicit schemas, others still parse manually | [../../../src/app/api/chat/stream/route.ts](../../../src/app/api/chat/stream/route.ts#L26), [../../../src/app/api/chat/route.ts](../../../src/app/api/chat/route.ts#L13) |
| Live repo hygiene | The editor currently reports a type error, so the mainline is not continuously clean | [../../../tests/chat-performance-a11y.test.tsx](../../../tests/chat-performance-a11y.test.tsx#L163) |

## Architectural Hotspots

| File | Current role | Refactor implication |
| --- | --- | --- |
| [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L383) | End-to-end stream orchestration | Must be split into staged services before more feature expansion |
| [../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts#L31) | Capability source-of-truth | Must be decomposed by capability family or facet before it becomes policy spaghetti |
| [../../../src/lib/chat/prompt-runtime.ts](../../../src/lib/chat/prompt-runtime.ts#L199) | Effective prompt assembly | Needs contract tightening and cache/invalidation rules |
| [../../../src/lib/jobs/deferred-job-worker.ts](../../../src/lib/jobs/deferred-job-worker.ts#L322) | Background execution engine | Strong core that should be preserved, but startup validation and boundary cleanup are needed |
| [../../../src/adapters/RepositoryFactory.ts](../../../src/adapters/RepositoryFactory.ts#L45) | Process-wide dependency access | Needs a clear rule about where service-locator access is allowed |

## Preserve Versus Replace

| Preserve | Replace or reduce |
| --- | --- |
| Conversation interactor model | God-class stream orchestration |
| Tool registry middleware pipeline | Manual, fragmented tool registration strategy |
| Deferred-job event and projection model | Mixed stream and job event convergence in the chat path |
| Hybrid search approach | Hardcoded search initialization at global composition time |
| Capability catalog idea | Single giant catalog file as the long-term shape |
| Theme bootstrap and route-surface shelling | App-shell branching that is currently too pathname-driven |

## Immediate Risks

1. The next wave of runtime features will almost certainly add more branches to [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts#L383) unless that seam is decomposed first.
2. The next major capability expansion will make [../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts#L31) harder to review and easier to break accidentally.
3. Any future move to multi-instance deployment will force changes in [../../../src/lib/chat/active-stream-registry.ts](../../../src/lib/chat/active-stream-registry.ts#L18) and [../../../src/lib/db/index.ts](../../../src/lib/db/index.ts#L32).
4. Continued mixing of direct construction and factory access will increase test and change friction around platform code.

## Bottom Line

This system is credible. It is not accidental code. The core issue is not that the architecture is fake; it is that the highest-leverage parts of it are now carrying too many responsibilities. The correct next move is disciplined decomposition of the runtime seams, not a cosmetic rewrite.
