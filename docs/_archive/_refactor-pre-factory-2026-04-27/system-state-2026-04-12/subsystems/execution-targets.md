# Execution Targets

Date: 2026-04-12

## Purpose

This note evaluates the system as a multi-runtime host and describes how it should evolve to support:

- first-party in-process tools
- browser-managed WASM tools
- containerized MCP tools
- future Rust and Swift executors

## Bottom Line

The system now has a real execution-target contract, but it is not yet a fully generalized multi-runtime platform.

The current code supports six meaningful ideas already:

1. a TypeScript host runtime that owns policy, state, jobs, and rendering
2. a browser WASM execution path for selected capabilities
3. MCP servers as separate stdio processes
4. a compose-backed container sidecar pilot for declared MCP targets
5. generic native-process adapters that execute planner-selected process targets
6. generic remote-service adapters that execute planner-selected HTTP-style targets

That makes your plan viable. The remaining work is broadening the current planner and sidecar operations model beyond the first pilot and attaching the native or remote contracts to a production-owned family.

## Pack Runtime Ownership

The extension-pack model is now explicit enough to name runtime ownership rather than treating every non-core family as undecided.

| Pack | Current ownership model | Default runtime shape | Near-term direction |
| --- | --- | --- | --- |
| `admin_intelligence` | active extracted pack | `mcp_stdio` preferred with `host_ts` fallback | broaden to stronger `mcp_container` operations once the sidecar fleet expands beyond the first pilot |
| `media` | next concrete pack runtime | `browser_wasm` for interactive generation, planner-declared `native_process` plus dedicated media worker for governed composition, `deferred_job` fallback, `host_ts` only as compatibility glue | broaden the first `compose_media` native-process pilot into a fuller non-host media runtime family, with `generate_audio` explicitly chosen as the next `remote_service` promotion candidate |
| `publishing` | pack-owned but still host-managed | `deferred_job` plus `host_ts` mutation/query surfaces | keep host-owned until heavier production workloads justify a dedicated runtime |
| `referrals` | pack-owned but still host-managed | `host_ts` query and analytics surfaces | keep in-process until isolation or third-party integration pressure justifies externalization |

The important decision for Phase 8 is now implemented in code: the next runtime promotion after the first admin-intelligence sidecar wave is the media pack, not the referral or publishing packs. The media family already had the strongest runtime split in code, and `compose_media` now has a planner-declared local `native_process` pilot through [../../../../src/lib/capabilities/local-external-target-inventory.ts](../../../../src/lib/capabilities/local-external-target-inventory.ts#L1), [../../../../scripts/compose-media-native-target.ts](../../../../scripts/compose-media-native-target.ts#L1), and [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1) without changing host policy or artifact governance.

The next explicit workload after `compose_media` is now also chosen: [../../../../src/core/capability-catalog/capability-ownership.ts](../../../../src/core/capability-catalog/capability-ownership.ts#L1) records `generate_audio` as the first production-owned `remote_service` candidate. That choice keeps the follow-on promotion inside the same media pack, matches the existing provider-network boundary already crossed by TTS generation, and preserves host ownership of RBAC, persistence, and governed artifact metadata.

## Current Execution Modes In Source

| Mode | Current status | Evidence |
| --- | --- | --- |
| In-process TypeScript tool | mature | [../../../../src/core/tool-registry/ToolRegistry.ts](../../../../src/core/tool-registry/ToolRegistry.ts#L33), [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts#L57) |
| Deferred internal job | mature | [../../../../src/lib/jobs/deferred-job-worker.ts](../../../../src/lib/jobs/deferred-job-worker.ts#L322), [../../../../src/lib/jobs/deferred-job-handlers.ts](../../../../src/lib/jobs/deferred-job-handlers.ts#L53) |
| Browser WASM | real but narrow | [../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts](../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts#L75), [../../../../src/lib/media/ffmpeg/media-execution-router.ts](../../../../src/lib/media/ffmpeg/media-execution-router.ts#L17) |
| MCP stdio process | present for standalone servers | [../../../../mcp/calculator-server.ts](../../../../mcp/calculator-server.ts#L1), [../../../../mcp/operations-server.ts](../../../../mcp/operations-server.ts#L1) |
| Containerized MCP | compose-backed pilot exists with real Docker-backed parity proof | [../../../../src/lib/capabilities/mcp-process-runtime.ts](../../../../src/lib/capabilities/mcp-process-runtime.ts#L1), [../../../../src/lib/capabilities/mcp-stdio-adapter.ts](../../../../src/lib/capabilities/mcp-stdio-adapter.ts#L1), [../../../../compose.yaml](../../../../compose.yaml#L1), [../../../../src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L620) |
| Native binary executor | generic planner-backed adapter now has a first local pilot for `compose_media` | [../../../../src/lib/capabilities/external-target-adapters.ts](../../../../src/lib/capabilities/external-target-adapters.ts#L1), [../../../../src/lib/capabilities/local-external-target-inventory.ts](../../../../src/lib/capabilities/local-external-target-inventory.ts#L1), [../../../../scripts/compose-media-native-target.ts](../../../../scripts/compose-media-native-target.ts#L1), [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1) |
| Remote service executor | generic planner-backed adapter exists, but no production family owns it yet | [../../../../src/lib/capabilities/external-target-adapters.ts](../../../../src/lib/capabilities/external-target-adapters.ts#L1), [../../../../src/core/capability-catalog/runtime-tool-binding.ts](../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1) |

## Containerized MCP Tools

### Assessment

Supporting Docker containers as MCP tools is a good idea for this system.

It fits your goal because containers give you:

- runtime isolation
- dependency isolation
- easier third-party extension packaging
- a cleaner path for Rust executors
- a cleaner path for heavy media or indexing workloads

### What The System Needs

The app can already define MCP-exportable tools through catalog projection in [../../../../src/core/capability-catalog/mcp-export.ts](../../../../src/core/capability-catalog/mcp-export.ts#L56), and it now has a host-side execution layer that can call those tools through `mcp_stdio`, a compose-backed `mcp_container` pilot, or a planner-declared local `native_process` for the first media workload.

What it still needs is broader operational coverage around the first pilots: health supervision, more than one declared container family, and additional production-native or production-remote capabilities beyond `compose_media` that use the new generic adapters.

The architecture should grow a new runtime concept:

| Target kind | Description |
| --- | --- |
| `host_ts` | current in-process TypeScript executor |
| `deferred_job` | current background job executor |
| `browser_wasm` | client-managed execution |
| `mcp_stdio` | local process speaking MCP over stdio |
| `mcp_container` | containerized MCP tool or tool-pack |
| `native_process` | Rust or Swift binary invoked directly by the host |
| `remote_service` | HTTP or RPC service for externalized workloads |

### Recommended Container Model

Do not make every tool its own short-lived `docker run` process. That will be slow and operationally noisy.

Prefer one of these two patterns:

1. Long-lived MCP sidecar containers by tool family
2. Long-lived utility containers with a host-side adapter and job queue

For this system, I would use sidecar MCP containers for extension packs and long-running specialized families such as:

- advanced retrieval and indexing
- media transformation
- private integrations
- experimental or untrusted tools

### Recommended Boundary

The host should keep ownership of:

- auth
- RBAC
- conversation state
- prompt runtime
- job state
- artifact ownership
- observability

The container should own only execution.

That means a containerized MCP tool should not be the system of record. It should receive typed input, do work, and return typed output.

## WASM In The Current System

### FFmpeg What Exists

The browser runtime is not imaginary. It is real and deliberately wired:

- capability registry: [../../../../src/lib/media/browser-runtime/browser-capability-registry.ts](../../../../src/lib/media/browser-runtime/browser-capability-registry.ts#L13)
- capability probe: [../../../../src/lib/media/browser-runtime/ffmpeg-capability-probe.ts](../../../../src/lib/media/browser-runtime/ffmpeg-capability-probe.ts#L1)
- browser executor: [../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts](../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts#L75)
- worker: [../../../../src/lib/media/browser-runtime/ffmpeg.worker.ts](../../../../src/lib/media/browser-runtime/ffmpeg.worker.ts#L1)
- route selection: [../../../../src/lib/media/ffmpeg/media-execution-router.ts](../../../../src/lib/media/ffmpeg/media-execution-router.ts#L17)
- browser-to-server fallback path: [../../../../src/app/api/chat/jobs/route.ts](../../../../src/app/api/chat/jobs/route.ts#L74)
- required COOP and COEP headers: [../../../../next.config.ts](../../../../next.config.ts#L3)

### What It Means

This is already a hybrid execution design. The important implication is that the codebase is conceptually ready for multiple execution targets.

### What It Is Not Yet

The browser FFmpeg path is not a full production-grade media engine yet.

Important evidence:

- the browser worker currently loads only the first visual input and optionally the first audio input in [../../../../src/lib/media/browser-runtime/ffmpeg.worker.ts](../../../../src/lib/media/browser-runtime/ffmpeg.worker.ts#L52)
- the worker comment explicitly says the execution args are simplified rather than a full filter graph in [../../../../src/lib/media/browser-runtime/ffmpeg.worker.ts](../../../../src/lib/media/browser-runtime/ffmpeg.worker.ts#L64)
- the routing limits are intentionally conservative at 2 visual clips, 2 audio clips, and 60 seconds in [../../../../src/lib/media/ffmpeg/media-execution-router.ts](../../../../src/lib/media/ffmpeg/media-execution-router.ts#L12)
- the executor tests and browser E2E coverage still lean more heavily on structural and UI-state validation than on full local-transcode golden-path verification, in [../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts](../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts#L1) and [../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts](../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts#L1)

So the current WASM layer is best understood as a strong architectural starting point, not a finished general-purpose local media runtime.

### Recommendation For WASM

Use browser WASM for:

- low-latency local rendering
- privacy-sensitive local transforms
- small interactive media or chart jobs
- graceful client-side acceleration

Do not treat browser WASM as the only long-term media backend.

It should remain one execution target among several.

## FFmpeg In The Current System

### What Exists

The server path is explicit and safe in concept:

- structured plan schema: [../../../../src/lib/media/ffmpeg/media-composition-plan.ts](../../../../src/lib/media/ffmpeg/media-composition-plan.ts#L1)
- server executor: [../../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts](../../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts#L1)
- deferred handler wiring: [../../../../src/lib/jobs/deferred-job-handlers.ts](../../../../src/lib/jobs/deferred-job-handlers.ts#L125)

The good design choice is that the server executor builds deterministic FFmpeg args from a structured plan and does not accept raw CLI from the model in [../../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts](../../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts#L107).

### Critical Current Weakness

The current container deployment does not appear ready for server FFmpeg execution.

Evidence:

- the server executor defaults `FFMPEG_BIN` to `/opt/homebrew/bin/ffmpeg` in [../../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts](../../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts#L8)
- the production Dockerfile does not install FFmpeg in [../../../../Dockerfile](../../../../Dockerfile#L1)
- the compose file defines only the app container in [../../../../compose.yaml](../../../../compose.yaml#L1)

That means `compose_media` on the deferred server path is likely to fail in a containerized deployment unless FFmpeg is injected externally.

### Recommendation For FFmpeg

Do not keep long-term media execution inside the main Next.js app container.

Choose one of these paths:

1. Dedicated media worker container with FFmpeg installed
2. Containerized MCP media pack
3. Rust-based media orchestrator that shells out to FFmpeg or uses native crates where appropriate

For your architecture, I would prefer either a dedicated media worker container or a containerized MCP media pack.

## Recommended Long-Term Execution Strategy

### Host Responsibilities

The host app should remain responsible for:

- capability registration
- capability policy
- permission checks
- prompt/runtime context
- conversation and job persistence
- artifacts and governance
- UI rendering

### Execution Responsibilities

Execution engines should become replaceable.

| Capability type | Best default |
| --- | --- |
| fast standard tool | `host_ts` |
| simple visual or local interactive task | `browser_wasm` |
| heavy media or indexing task | `mcp_container` or `native_process` |
| external integration | `mcp_container` or `remote_service` |
| Apple-native local feature | `native_process` with Swift |
| heavy backend engine | `native_process` with Rust or containerized Rust service |

## How This Changes Before And After Refactor

### Now

The system can support multi-runtime ideas, but the execution modes are scattered across different subsystems.

### After Refactor

The system should have one explicit execution-target abstraction used by the capability catalog and the runtime.

That would let one capability run as:

- host TypeScript
- browser WASM
- deferred internal worker
- MCP container
- Rust process
- Swift process

without changing the host’s policy or persistence model.

## Strategic Recommendation

Your plan is good if you sequence it this way:

1. Refactor the host so execution target is a first-class contract.
2. Keep the solopreneur core in-process and stable.
3. Add containerized MCP support for extension packs and heavy runtimes.
4. Treat browser WASM as an accelerator, not the universal runtime.
5. Move FFmpeg out of the main app container.
6. Use Rust for heavy backend executors first, and Swift where Apple-native capabilities actually justify it.

## Immediate Next Steps

1. Extend environment-backed parity and failure-mode coverage across each active execution-target family.
2. Broaden sidecar supervision beyond the current compose-backed pilot.
3. Promote the media pack from hybrid browser-plus-worker delivery to the next explicit non-host extension runtime family.
4. Pull FFmpeg execution fully out of the main app deployment model.
5. Choose the first production-owned native or remote execution family.
