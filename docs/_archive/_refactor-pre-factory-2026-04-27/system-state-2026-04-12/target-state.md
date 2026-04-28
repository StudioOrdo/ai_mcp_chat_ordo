# Target State

Date: 2026-04-12

## Purpose

This document defines the desired future shape of the system.

The target is not just a cleaner version of the current app. The target is a platform with a smaller host core, a stable standard tool surface, an extension plane built around MCP, and replaceable execution runtimes for heavy or specialized work.

## North Star

The platform should become a solopreneur operating core with:

1. a stable host that owns policy, state, jobs, and rendering
2. a curated set of standard first-party tools
3. an extension model based on MCP tool packs and sidecars
4. explicit execution targets for browser, container, and native runtimes
5. a path to move hot or heavy workloads into Rust and Swift executors without changing the host model

## Desired Product Shape

| Layer | Desired role |
| --- | --- |
| Host core | conversations, prompts, policy, jobs, artifacts, observability, identity, and shell |
| Standard tools | stable first-party tools that almost every deployment should have |
| Extension packs | optional tool families delivered through MCP or dedicated runtimes |
| Execution runtimes | replaceable engines that do work but do not own canonical state |

## Desired System Responsibilities

### Host Core Should Own

- conversation state
- prompt runtime and governance
- capability registration and policy
- RBAC and identity context
- job scheduling and lifecycle state
- artifact ownership and retention
- admin and operator views
- observability and provenance

### Extensions Should Own

- specialized execution logic
- external integration logic
- heavy data processing
- isolated dependency trees
- experimental features that should not increase host complexity

## Solopreneur Core

The host should eventually narrow to a core that feels durable and boring.

### Core Capabilities

- conversation runtime
- prompt governance and replayability
- knowledge and conversation retrieval primitives
- standard navigation and context inspection tools
- user preferences and lightweight profile state
- jobs, artifacts, and notifications
- simple admin and observability surface

### Not Core

These areas should be treated as optional packs unless they prove universally necessary:

- editorial and publishing workflows
- advanced affiliate or referral workflows
- vertical-specific admin analysis
- heavy media composition pipelines
- specialized private integrations

## Standard Tool Surface

The standard tool surface should be smaller and more stable than the current combined first-party tool set.

### Standard Tool Families

- inspect current state
- search system knowledge
- search prior conversations
- navigate or open relevant surfaces
- manage personal preferences and profile
- inspect jobs and artifacts
- ask for system explanations or diagnostics

### Extension Tool Families

- advanced publishing
- media rendering and transformation
- large retrieval or indexing jobs
- third-party integrations
- experimental or domain-specific workflows

### Extension Pack Runtime Ownership

The target state is not just a list of packs. Each pack should have an explicit runtime ownership model.

| Pack | Runtime ownership | Why |
| --- | --- | --- |
| `admin_intelligence` | sidecar-first MCP pack | isolated admin analysis logic and web-search-style dependencies fit long-lived MCP sidecars well |
| `media` | hybrid pack with a first native-process pilot | browser acceleration plus a dedicated media worker already prove this family wants non-host execution, and `compose_media` now has a planner-owned local native target |
| `publishing` | host-owned pack with deferred jobs | workflow and policy still matter more than runtime isolation |
| `referrals` | host-owned pack for now | current value is query and analytics cohesion rather than heavy execution isolation |

The next concrete extension-pack runtime after the first admin-intelligence wave is now the media pack in code, not just in planning. It already spans `browser_wasm`, governed deferred execution, and a dedicated worker boundary, and `compose_media` now has a planner-owned local `native_process` target, which makes it the best candidate for the next promoted non-host runtime without changing the host's policy or persistence model.

## Desired Execution Model

The host should stop treating execution mode as an implementation detail and start treating it as a first-class capability contract.

### Execution Targets

| Target kind | Intended use |
| --- | --- |
| `host_ts` | standard first-party tools with low latency and modest resource cost |
| `deferred_job` | durable background work still owned by the host runtime |
| `browser_wasm` | interactive local acceleration, privacy-sensitive transforms, and lightweight client-side jobs |
| `mcp_stdio` | local MCP tools for development or simple sidecar integration |
| `mcp_container` | isolated extension packs, specialized runtimes, and long-lived sidecars |
| `native_process` | Rust or Swift executors invoked by the host under a stable contract |
| `remote_service` | externalized execution when full service boundaries are justified |

### Rule

Execution targets should be replaceable without changing:

- capability policy
- prompt policy
- conversation state model
- artifact model
- job lifecycle model
- UI rendering contract

## Docker And MCP Target State

Containerized MCP should become the default extension model for isolated or specialized packs.

### Desired Container Model

- long-lived MCP sidecars by family, not one container per call
- typed tool contracts at the host boundary
- host-owned RBAC, provenance, and persistence
- container-owned execution only

### Good Candidates

- media and FFmpeg packs
- indexing and retrieval packs
- external integration packs
- untrusted or high-dependency experimental packs

### Current Adoption

- `compose_media` now runs through a dedicated media worker runtime instead of host-local FFmpeg execution.
- `admin_web_search` is now the first extracted pack-owned workload: it defaults to a sidecar-first `mcp_stdio` execution path while preserving explicit host and container overrides under the shared execution-target contract.
- The media pack is now the next concrete runtime promotion target after that first admin-intelligence wave, and `compose_media` now has a first planner-declared local `native_process` pilot in addition to its governed deferred-worker path.

## WASM Target State

WASM should remain an accelerator, not the universal backend.

### Good WASM Use Cases

- interactive rendering
- local transforms
- small media jobs
- chart and graph generation
- privacy-sensitive local processing

### What WASM Should Not Become

- the only media backend
- the only execution path for heavy workloads
- the place where canonical state is decided

## Rust And Swift Target State

### Rust Should Be The Default Native Backend Option For

- indexing and retrieval engines
- heavy background workers
- parsing and transformation pipelines
- media orchestration and binary tooling
- memory-sensitive or concurrency-heavy workloads

### Swift Should Be Used When

- Apple-native frameworks are the reason for the feature
- a native Apple client becomes part of the product strategy
- local Apple-specific media, vision, or automation capabilities matter more than generic server portability

## Distance From Today

| Area | Relative distance |
| --- | --- |
| Solopreneur host core | moderate |
| Standard tool surface | moderate |
| MCP as primary extension model | significant |
| Containerized runtime support | significant |
| WASM as a stable accelerator layer | moderate |
| Native executor path for Rust or Swift | large |

## Success Criteria

The platform is at the target state when all of the following are true:

1. the host core is smaller and more explicit than the current app-centric shape
2. standard tools are easy to identify and stable across deployments
3. specialized capabilities can ship as MCP sidecars or native executors without changing host policy logic
4. heavy media and processing runtimes no longer depend on the main Next.js app container
5. the capability model can describe execution targets directly
6. the host remains the system of record for conversations, jobs, artifacts, and governance

## Related Notes

- [system-state.md](./system-state.md)
- [refactor-roadmap.md](./refactor-roadmap.md)
- [subsystems/execution-targets.md](./subsystems/execution-targets.md)
