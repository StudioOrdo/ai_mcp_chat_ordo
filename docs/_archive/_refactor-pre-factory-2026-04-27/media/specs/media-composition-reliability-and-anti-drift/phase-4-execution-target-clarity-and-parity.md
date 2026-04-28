# Phase 4: Execution-Target Clarity And Runtime Parity

**Status:** Revised After Phase 0 Canonicalization, Phase 1 Truth-Bound Presentation, Phase 2 Readiness Wiring, And Phase 3 Recovery Closure  
**Objective:** Keep execution-target selection explicit, test-backed, and architecture-aligned so route choice never drifts away from the canonical state, presentation, readiness, and recovery contracts already established in Phases 0 through 3.

---

## 1. Why This Phase Exists

The current codebase already supports multiple execution targets for the same capability family:

1. browser-managed media execution
2. deferred-job execution
3. planner-declared native-process execution
4. MCP-backed admin-intelligence execution
5. emerging remote-service promotion paths

That flexibility is useful, but it also creates a drift risk. A capability can have:

1. pack-level runtime ownership defaults
2. lower-level planner target projection
3. runtime-binding dispatch behavior
4. tests that exercise one of those layers
5. docs that describe a different layer as if it were the whole story

Phase 4 exists to stop that category of drift.

Phase 0 already established one canonical lifecycle and failure-stage model. Phase 1 already requires cards and transcript surfaces to consume canonical runtime truth rather than route folklore. Phase 2 already requires all composition routes to respect the same governed-asset readiness contract. Phase 3 already made browser fallback use the existing deferred recovery path instead of inventing another continuation model.

Phase 4 therefore does not get to redefine runtime behavior from scratch. It must describe and tighten the existing route-selection architecture so that execution-target choice remains a clean orchestration concern layered on top of the same state, readiness, and recovery authorities.

---

## 2. Verified Current Architecture

Phase 4 must describe the real routing seams already present in code.

### 2.1 Pack Runtime Ownership Already Exists

The repo already defines runtime ownership at the extension-pack layer in [src/core/capability-catalog/capability-ownership.ts](../../../../../src/core/capability-catalog/capability-ownership.ts#L1).

Current relevant facts:

1. the `media` pack is the next concrete pack-owned runtime family
2. the `media` pack declares `browser_wasm`, `native_process`, `deferred_job`, and `host_ts` as its default and preferred target set
3. the `admin_intelligence` pack declares `host_ts` and `mcp_stdio`, with MCP preferred and host retained as fallback
4. `generate_audio` is explicitly recorded as the next `remote_service` promotion candidate after `compose_media`

This is the top-level ownership truth Phase 4 must preserve. It is non-compliant to describe route defaults only from scattered test behavior or from individual tool implementations.

### 2.2 Low-Level Execution Planning Already Exists

The repo already has a generic execution-target planner in [src/lib/capabilities/execution-targets.ts](../../../../../src/lib/capabilities/execution-targets.ts#L1).

That planner already projects:

1. host targets from executor bindings
2. deferred-job targets from job facets
3. browser targets from browser capability descriptors
4. MCP stdio targets from export and local-target metadata
5. native-process targets from planner overrides
6. remote-service targets from planner overrides

Phase 4 must be explicit about one subtle but important detail: `planCapabilityExecution()` is a lower-level planner, not the only source of runtime-default truth by itself. It consumes an `ExecutionPlanningContext`, and the effective default route for a capability is only final after that context has been supplied.

### 2.3 Runtime Binding Is The Merge Layer Between Ownership And Planning

The actual dispatch seam lives in [src/core/capability-catalog/runtime-tool-binding.ts](../../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1).

That file already does the critical Phase 4 work of turning ownership defaults into executable route behavior:

1. `toExecutionPlanningContext()` merges `getDefaultExecutionPlanningForCapability()` with any explicit request-time overrides
2. `shouldUsePlannedDispatch()` decides when a capability should route through the planner-backed adapter layer instead of a direct host executor only
3. route-specific adapters exist for `browser_wasm`, `deferred_job`, `mcp_stdio`, `mcp_container`, `native_process`, and `remote_service`
4. `compose_media` and `admin_web_search` already exercise this planned-dispatch path in tests

This merge layer is the reason Phase 4 must be careful with wording. The pack-level default authority and the low-level planner are both real, but they serve different roles. Docs that collapse them into one concept will become inaccurate quickly.

### 2.4 Current Capability-Specific Route Reality Is Uneven By Design

The relevant capabilities do not all have the same maturity.

#### `compose_media`

Current route reality:

1. the catalog definition in [src/core/capability-catalog/families/media-capabilities.ts](../../../../../src/core/capability-catalog/families/media-capabilities.ts#L65) declares a browser execution surface, deferred-job facets, a local native-process target, and browser fallback metadata
2. `runtime-tool-binding` already routes `compose_media` through deferred-job execution when browser execution is unavailable
3. `runtime-tool-binding` already routes `compose_media` through the local `native_process` pilot before deferred-job execution when that path is available
4. the native-process pilot is materially backed by [src/lib/capabilities/local-external-target-inventory.ts](../../../../../src/lib/capabilities/local-external-target-inventory.ts#L1) and [scripts/compose-media-native-target.ts](../../../../../scripts/compose-media-native-target.ts#L1)
5. Phase 3 recovery now guarantees that browser-local failure can hand off into the existing deferred path rather than becoming a separate route truth model

#### `admin_web_search`

Current route reality:

1. the catalog definition in [src/core/capability-catalog/families/admin-capabilities.ts](../../../../../src/core/capability-catalog/families/admin-capabilities.ts#L5) declares `mcp_stdio`, `mcp_container`, and shared host execution surfaces
2. pack-level ownership marks this capability as sidecar-first with host fallback
3. the lower-level planner still exposes host and declared MCP targets separately depending on planning context
4. `runtime-tool-binding` already proves default MCP routing, explicit host override, native-process override, remote-service override, and parity between host and MCP-backed outputs

Phase 4 must document those layers honestly instead of pretending that one single test or one single planner call tells the whole story.

#### `generate_audio`

Current route reality:

1. pack ownership places `generate_audio` in the `media` pack even though the capability definition still lives in [src/core/capability-catalog/families/calculator-capabilities.ts](../../../../../src/core/capability-catalog/families/calculator-capabilities.ts#L123)
2. the current binding path still runs through the browser compatibility adapter by default
3. the current tests prove browser-default routing and explicit blocking when browser runtime availability is disabled
4. the code records `generate_audio` as the next `remote_service` promotion candidate, but that is a runtime-ownership direction, not a completed parity implementation today

Phase 4 must keep this distinction sharp. It is non-compliant to document `generate_audio` as already having the same multi-route parity maturity as `compose_media`.

### 2.5 System-State Docs Already Describe The Same Runtime Family Split

The current system-state docs already provide supporting evidence that Phase 4 should align to rather than contradict:

1. [docs/_refactor/system-state-2026-04-12/subsystems/execution-targets.md](../../system-state-2026-04-12/subsystems/execution-targets.md#L1) documents the pack runtime ownership model, the media native-process pilot, and the admin-intelligence sidecar posture
2. [docs/_refactor/system-state-2026-04-12/runtime-e2e-inventory-and-logging.md](../../system-state-2026-04-12/runtime-e2e-inventory-and-logging.md#L1) documents the runtime-specific validation posture and current audit-log coverage by execution environment

Phase 4 should tighten drift between these system docs and the code, not create a second architectural narrative.

---

## 3. Phase 4 Scope

This phase governs execution-target clarity for the capabilities whose route behavior matters most to media reliability and anti-drift discipline:

1. `compose_media`
2. `generate_audio`
3. `admin_web_search`

Specifically, Phase 4 governs:

1. pack-level runtime ownership defaults
2. the merge between pack defaults and low-level execution planning
3. route-specific output parity obligations
4. route-specific validation parity obligations where applicable
5. documentation and tests that must agree with those contracts

This phase does not replace the browser runtime, the deferred worker, the media worker, or the catalog itself. It constrains how route selection is described and validated.

---

## 4. Phase 4 Invariants

The following rules are mandatory.

1. Phase 0 remains authoritative for lifecycle phases, failure stages, and terminal artifact truth regardless of execution target.
2. Phase 1 remains authoritative for what cards, summaries, and transcript-visible job snapshots may claim about route-specific work.
3. Phase 2 remains authoritative for governed asset-readiness and preflight correctness regardless of whether work is routed to browser, native-process, or deferred execution.
4. Phase 3 remains authoritative for browser fallback and server recovery for `compose_media`; execution-target planning may not invent an alternate recovery model.
5. `getDefaultExecutionPlanningForCapability()` is the source of truth for pack-owned default planning context, not isolated calls to lower-level planner helpers.
6. `planCapabilityExecution()` is the canonical target projector once planning context is known, but it is not allowed to silently substitute for pack-level default policy.
7. `runtime-tool-binding` is the canonical merge layer that turns ownership defaults and request-time overrides into real dispatch behavior.
8. Route-specific outputs may differ in transport details, but they may not violate the canonical envelope, asset-governance, and user-visible truth contracts already established in earlier phases.
9. Docs must not describe aspirational route parity as if it were already implemented.

---

## 5. Canonical Phase 4 Contract

### 5.1 Default Planning Contract

Phase 4 must define one clean reading of route defaults.

Required interpretation:

1. pack-level default route intent comes from `getDefaultExecutionPlanningForCapability()`
2. low-level planner projection comes from `planCapabilityExecution()` and related target projectors
3. effective default dispatch behavior comes from `runtime-tool-binding`, which merges the pack default planning context into the planner
4. explicit caller overrides may change route selection, but only through typed execution-planning context rather than hidden side effects

This layered contract is required because the repo already uses all three layers, and each one is legitimate when described precisely.

### 5.2 Route Parity Contract For `compose_media`

`compose_media` is the most demanding Phase 4 capability because it now spans browser-local execution, Phase 3 deferred recovery, planner-declared native-process execution, and deferred-job execution.

Regardless of route, the following must remain invariant:

1. canonical `CapabilityResultEnvelope` structure
2. durable governed artifact identity with `primaryAssetId` and artifact metadata
3. Phase 0 lifecycle and failure-stage meaning
4. Phase 1 presentation safety
5. Phase 2 readiness and governed-asset correctness
6. Phase 3 recovery semantics for browser fallback

Allowed route-specific variation:

1. `replaySnapshot.route`
2. route-specific progress wording where it stays semantically honest
3. route-specific execution diagnostics such as `native_process`, `browser_wasm`, or deferred worker evidence

### 5.3 Route Parity Contract For `admin_web_search`

`admin_web_search` is the Phase 4 proof case for search-side runtime extraction.

Required invariants:

1. sanitized input behavior must remain consistent across host and MCP-backed execution
2. output shape must remain parity-safe across host, `mcp_stdio`, and `mcp_container` routes
3. explicit overrides such as `host_ts`, `native_process`, or `remote_service` must remain typed and test-backed rather than implicit

This is already largely implemented in tests and should be documented as current reality, not future aspiration.

### 5.4 Current Posture Contract For `generate_audio`

`generate_audio` must be documented honestly.

Current truth:

1. it belongs to the media pack for runtime ownership purposes
2. it is still browser-default in the current binding layer
3. it is recorded as the next `remote_service` promotion candidate
4. it does not yet have the same route-parity proof depth as `compose_media` or `admin_web_search`

Phase 4 must preserve this distinction so docs and tests do not overstate current capability maturity.

---

## 6. Current Code Findings

### 6.1 What The Repo Already Proves

1. pack runtime ownership is explicit and test-backed in [src/core/capability-catalog/capability-ownership.ts](../../../../../src/core/capability-catalog/capability-ownership.ts#L1) and [src/core/capability-catalog/capability-ownership.test.ts](../../../../../src/core/capability-catalog/capability-ownership.test.ts#L1)
2. the lower-level planner already projects candidate targets, active versus declared readiness, and fallback ordering in [src/lib/capabilities/execution-targets.ts](../../../../../src/lib/capabilities/execution-targets.ts#L1) and [src/lib/capabilities/execution-targets.test.ts](../../../../../src/lib/capabilities/execution-targets.test.ts#L1)
3. `runtime-tool-binding` already proves default and override routing for `admin_web_search`, including parity across host and MCP-backed execution
4. `runtime-tool-binding` already proves `compose_media` deferred-job routing when browser execution is unavailable
5. `runtime-tool-binding` already proves the local `native_process` pilot for `compose_media`
6. `runtime-tool-binding` already proves current browser-default routing for `generate_audio`
7. the system-state docs already align broadly with the pack-ownership and runtime-family split implemented in code

### 6.2 What Phase 4 Still Needs To Keep Tight

1. docs must distinguish pack-level defaults from low-level planner projection instead of conflating them
2. docs must not imply that `generate_audio` has already completed the same route-parity promotion path that `compose_media` is actively piloting
3. route-parity language for `compose_media` must remain explicitly bound to the Phase 0 through Phase 3 contracts rather than only to envelope-shape similarity
4. any future execution-target promotion must update ownership defaults, planner tests, runtime-binding tests, and system-state docs together

Phase 4 is therefore less about inventing missing orchestration and more about locking the architecture into one precise description.

---

## 7. Required Deliverables

### 7.1 Ownership, Planner, And Binding Alignment

The following must agree in meaning:

1. pack runtime ownership in `capability-ownership`
2. target projection in `execution-targets`
3. dispatch behavior in `runtime-tool-binding`
4. system-state and phase docs

Required proof targets:

1. `compose_media`
2. `generate_audio`
3. `admin_web_search`

### 7.2 Route-Parity Documentation That Respects Earlier Phases

The Phase 4 docs must state explicitly that:

1. route choice does not create new lifecycle semantics
2. route choice does not loosen asset-governance or readiness rules
3. route choice does not change what presentation is allowed to claim
4. route choice does not bypass Phase 3 recovery for browser-managed compose fallback

### 7.3 Drift Tests

The repo must retain focused tests that fail when:

1. pack ownership defaults change without corresponding planner or binding updates
2. planner behavior changes without parity-safe binding behavior
3. route-specific outputs drift away from the canonical contract for the capability
4. system documentation materially contradicts the implemented route posture

Doc drift checks may remain lightweight, but the architectural contract must be explicit enough that such drift is easy to spot and review.

---

## 8. Candidate File Changes

Update when Phase 4 behavior changes:

- [src/core/capability-catalog/capability-ownership.ts](../../../../../src/core/capability-catalog/capability-ownership.ts#L1)
- [src/lib/capabilities/execution-targets.ts](../../../../../src/lib/capabilities/execution-targets.ts#L1)
- [src/core/capability-catalog/runtime-tool-binding.ts](../../../../../src/core/capability-catalog/runtime-tool-binding.ts#L1)
- [src/core/capability-catalog/families/media-capabilities.ts](../../../../../src/core/capability-catalog/families/media-capabilities.ts#L1)
- [src/core/capability-catalog/families/admin-capabilities.ts](../../../../../src/core/capability-catalog/families/admin-capabilities.ts#L1)
- [src/lib/capabilities/local-external-target-inventory.ts](../../../../../src/lib/capabilities/local-external-target-inventory.ts#L1)
- [scripts/compose-media-native-target.ts](../../../../../scripts/compose-media-native-target.ts#L1)
- [src/lib/media/server/media-worker-client.ts](../../../../../src/lib/media/server/media-worker-client.ts#L1)
- [docs/_refactor/system-state-2026-04-12/subsystems/execution-targets.md](../../system-state-2026-04-12/subsystems/execution-targets.md#L1)
- [docs/_refactor/system-state-2026-04-12/runtime-e2e-inventory-and-logging.md](../../system-state-2026-04-12/runtime-e2e-inventory-and-logging.md#L1)

Test surfaces that must stay aligned:

- [src/core/capability-catalog/capability-ownership.test.ts](../../../../../src/core/capability-catalog/capability-ownership.test.ts#L1)
- [src/lib/capabilities/execution-targets.test.ts](../../../../../src/lib/capabilities/execution-targets.test.ts#L1)
- [src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../../src/core/capability-catalog/runtime-tool-binding.test.ts#L1)

---

## 9. Positive Tests

1. `getDefaultExecutionPlanningForCapability()` returns the documented pack defaults for `compose_media`, `generate_audio`, and `admin_web_search`.
2. `runtime-tool-binding` routes `admin_web_search` through the sidecar-first path by default while preserving explicit host override support.
3. `runtime-tool-binding` preserves output parity between host and MCP-backed `admin_web_search` execution.
4. `compose_media` routes to deferred-job execution when browser execution is unavailable and no native-process promotion path is active.
5. `compose_media` routes through the local `native_process` target before deferred-job execution when that pilot is available.
6. `generate_audio` continues to route through the browser compatibility adapter by default until a different pack-owned promotion is actually implemented.

## 10. Negative Tests

1. A change to pack ownership defaults without corresponding planner-context expectations fails tests.
2. A route-specific success envelope that breaks the canonical `compose_media` artifact contract fails parity tests.
3. A doc change that describes `generate_audio` as fully route-parity-promoted before code proves it is non-compliant.
4. An override path that bypasses typed execution planning or adapter dispatch is non-compliant.
5. Any route-specific behavior that violates Phase 0 through Phase 3 contracts is non-compliant even if the immediate route test passes.

## 11. Edge Tests

1. Browser-runtime suppression still preserves the documented fallback posture for `compose_media`.
2. Admin-intelligence execution still has a truthful host fallback when MCP-backed execution is unavailable or explicitly disabled.
3. Future `remote_service` promotion for `generate_audio` must preserve transcript-safe payload identity and governed artifact truth.
4. Native-process and deferred `compose_media` routes must remain presentation-equivalent enough that Phase 1 cards do not need route-specific truth exceptions.
5. Browser fallback plus Phase 3 deferred recovery must remain compatible with the route ordering described in Phase 4.

---

## 12. Exit Criteria

1. A developer can inspect one doc and understand the difference between pack ownership, planner projection, and effective runtime dispatch.
2. Route choice remains a clean orchestration concern layered on top of the Phase 0 state model, Phase 1 presentation rules, Phase 2 readiness rules, and Phase 3 recovery rules.
3. `compose_media`, `generate_audio`, and `admin_web_search` are documented according to their real current route maturity, not a blended aspiration.
4. Tests fail on execution-target drift before route confusion reaches runtime behavior or user-facing presentation.
5. No parallel execution-target narrative exists outside the capability catalog, planner, runtime binding, and aligned system docs.
