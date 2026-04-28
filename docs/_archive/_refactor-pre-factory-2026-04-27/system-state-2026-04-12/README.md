# System State, Target State, And Refactor Plan

Date: 2026-04-12

This workstream is a source-backed audit of the current system, the intended target architecture, and the refactor plan that moves the platform from one to the other.

## Scope

- Source-first review of `src/`, `package.json`, route structure, selected tests, and current editor diagnostics.
- Focus on architecture, subsystem boundaries, runtime behavior, delivery surface, and refactor pressure.
- No attempt to restate older architecture docs as truth. Where this folder makes a claim, it is based on source inspection.

## Deliverables

- [system-state.md](./system-state.md): where the system is now.
- [target-state.md](./target-state.md): where the system should end up.
- [refactor-roadmap.md](./refactor-roadmap.md): the plan to get from the current state to the target state.
- [subsystems/runtime-core.md](./subsystems/runtime-core.md): detailed plan for chat, tools, prompt runtime, search, and jobs.
- [subsystems/platform-delivery.md](./subsystems/platform-delivery.md): detailed plan for auth, data access, routes, admin, and shell/UI.
- [subsystems/execution-targets.md](./subsystems/execution-targets.md): execution strategy for in-process tools, browser WASM, MCP containers, and FFmpeg.
- [phases/README.md](./phases/README.md): stub-controlled delivery loop plus one packet per roadmap phase.
- [phases/status-board.md](./phases/status-board.md): lightweight live view of which phase is active, blocked, or ready.

## Reading Order

1. [system-state.md](./system-state.md)
2. [target-state.md](./target-state.md)
3. [refactor-roadmap.md](./refactor-roadmap.md)
4. [phases/README.md](./phases/README.md)
5. [phases/status-board.md](./phases/status-board.md)

## Three-Part Summary

| Question | Answer |
| --- | --- |
| Where are we now? | A capable AI-assisted operating console with real architecture, but with too much behavior concentrated in a few runtime seams |
| Where do we want to be? | A solopreneur host core with a smaller standard tool surface, MCP-based extension packs, and replaceable execution runtimes including containers and native executors |
| How do we get there? | First tighten host boundaries and runtime contracts, then introduce an execution-target abstraction, then split core tools from extension packs, then externalize heavy runtimes |

## Headline Assessment

| Area | Assessment |
| --- | --- |
| Product shape | AI-assisted operating console with chat-first UX, retrieval, tools, deferred jobs, admin operations, and content workflows |
| Code quality | Stronger than average. Real layering, real tests, and real domain boundaries are present |
| Architectural durability | Under pressure. Several critical paths are concentrating too much behavior in a small number of files |
| Best decisions to preserve | capability catalog direction, tool middleware, conversation interactors, deferred-job event model, hybrid search pipeline |
| Biggest risks | monolithic chat orchestration, metadata god-files, single-node concurrency assumptions, mixed dependency assembly patterns |

## Current-To-Target Direction

| Layer | Current state | Target state |
| --- | --- | --- |
| Product shape | powerful integrated app | smaller host core plus extension packs |
| Tool model | first-party tools dominate | first-party standard tools plus optional MCP extensions |
| Runtime model | mixed but implicit | explicit execution-target model |
| Media execution | hybrid browser and server path, but operationally uneven | browser acceleration plus dedicated media runtime outside the main app container |
| Performance path | mostly TypeScript in the host | TypeScript host plus Rust or Swift executors where justified |

## Quantitative Signals

| Signal | Current state |
| --- | --- |
| Files under `src/` | 1043 |
| App page routes | 43 |
| API routes | 51 |
| Tool implementation files | 56 |
| Tool bundle files | 11 |

## Hotspot Files

| File | Size | Why it matters |
| --- | --- | --- |
| [../../../src/core/capability-catalog/catalog.ts](../../../src/core/capability-catalog/catalog.ts) | 1896 lines | Central metadata spine for capability policy, presentation, jobs, and prompt hints |
| [../../../src/lib/chat/stream-pipeline.ts](../../../src/lib/chat/stream-pipeline.ts) | 1304 lines | Main chat orchestration path and biggest architectural concentration risk |
| [../../../src/lib/jobs/deferred-job-worker.ts](../../../src/lib/jobs/deferred-job-worker.ts) | 586 lines | Background execution core with retry, projection, and notification handling |
| [../../../src/lib/chat/prompt-runtime.ts](../../../src/lib/chat/prompt-runtime.ts) | 560 lines | Effective prompt assembly and provenance behavior |
| [../../../src/adapters/RepositoryFactory.ts](../../../src/adapters/RepositoryFactory.ts) | 290 lines | Process-wide dependency assembly seam for a large part of the app |

## Current Recommendation

Start with runtime convergence, not a database rewrite. The system gets more value from breaking apart the chat path, unifying provider behavior, and tightening tool and prompt contracts than it would from introducing a new persistence stack early.

Use [system-state.md](./system-state.md) for the current baseline, [target-state.md](./target-state.md) for the north star, and [refactor-roadmap.md](./refactor-roadmap.md) for the transition sequence. The roadmap is intentionally ordered to reduce risk before broad mechanical change.
For execution-model implications, also read [subsystems/execution-targets.md](./subsystems/execution-targets.md).
Use [phases/README.md](./phases/README.md) when you want to actually run the work through a controlled refresh-plan-implement-QA loop.
