# Phase 6 Implementation Spec — Platform Convergence And Timeline Completion

## Objective

Turn the post-Phase-5 QA findings into one implementation-grade convergence
phase that closes the remaining gap between the shipped platform seams and the
target architecture.

This phase should not replace the proven Phase 1 through Phase 5 seams. It
should finish migrating the still-split product and operator entry points onto
those seams, extend execution inspection to the execution kinds the target
architecture already promised, and move execution-planning ownership toward
the platform boundary described in the package.

The initial Phase 6 slice should be able to answer:

- does the main operator jobs surface consume the unified interaction model or
  still depend on job-local shaping?
- do all first-class chat entry points consume the stable agent facade or only
  the streaming path?
- can the platform inspect `chat_turn` and observability execution kinds
  through a real reader instead of explicit unsupported placeholders?
- has execution planning converged on the platform execution boundary, or does
  it still live as a parallel library concern outside `src/core/platform/`?

## Phase 5 Handoff

Phase 5 introduced the first explicit platform facade and the first unified
operator interaction facade.

The handoff assumptions now in place are:

- `CapabilityRuntime` is the canonical capability projection seam
- `KnowledgeAccessService` is the canonical grounded retrieval seam
- `DiscoverySearchService` is the canonical discovery seam
- `ExecutionTimelineReader` is the canonical execution inspection seam for
  currently supported execution kinds
- `RevisionReader` is the canonical revision inspection seam
- `AgentPlatformFacade` and `PlatformInteractionFacade` now exist in code and
  are already used by the main streaming chat route and several route-level
  inspection surfaces
- several important product surfaces still bypass those facades and therefore
  keep the package short of the target architecture

Phase 6 should preserve the same migration pattern used by the earlier phases:

- start from the landed platform seams rather than re-opening architecture
  design from scratch
- migrate the remaining high-level consumers onto those seams
- extend the execution reader only where real persisted or derivable signals
  already exist
- keep compatibility adapters only where the package can explain them
  honestly after convergence

## Current Code Grounding

The package is materially implemented, but the QA pass found four concrete
classes of remaining gap.

### Remaining Operator-Surface Owners

- `src/app/admin/jobs/page.tsx` still presents the operator model in job-local
  terms: "Browse, inspect, cancel, and retry deferred tool jobs."
- `src/lib/admin/jobs/admin-jobs.ts` still builds the main admin jobs list by
  reading `getJobQueueDataMapper()` directly and shaping rows locally through
  `toListEntry()`
- `src/components/admin/JobsTableClient.tsx` still renders raw job-governance
  and status fields rather than a broader platform interaction model
- `PlatformInteractionFacade` currently exposes user-, conversation-, job-,
  and work-order-scoped reads, but it does not yet expose a global admin list
  or count surface for the jobs page
- that means the current admin migration cannot simply swap `loadAdminJobList()`
  to a facade call; it needs to preserve mapper-owned global filtering and
  pagination while layering platform interaction projection onto listed jobs

### Remaining Agent / Chat Entry-Point Owners

- `src/lib/chat/stream-route-handler.ts` now consumes the agent facade
  execution surface, which is the Phase 5 success path
- `src/app/api/chat/route.ts` still routes through `executeDirectChatTurn()`
- `src/lib/chat/chat-turn.ts` still calls `getToolComposition()` directly and
  assembles its own direct-turn execution path instead of adapting over the
  agent facade
- `src/lib/chat/stream-short-circuits.ts` still reuses that direct-turn path
  for math short-circuit handling
- `src/lib/platform/agent-platform-facade-root.ts` already provides the
  process-cached production root for `AgentPlatformFacade`, so the shortest
  grounded migration path is to reuse that root in direct-turn entry points
  before introducing any new wrapper seam
- `src/lib/evals/live-runtime.ts`, `src/lib/evals/live-runner.ts`, and
  `src/lib/chat/tools.ts` still expose raw tool-composition surfaces, but they
  are secondary convergence targets after the product-facing direct-turn path

### Remaining Execution-Timeline Gaps

- `src/core/platform/execution/ExecutionTimelineReader.ts` supports `job`,
  `work_order`, and tool-envelope inspection, but still returns explicit
  unsupported placeholders for `chat_turn` and `observability`
- `src/lib/chat/chat-turn.ts`, `src/lib/chat/stream-execution.ts`, and prompt
  provenance / stream lifecycle code already expose execution-adjacent signals
  that can anchor a real chat-turn projection
- `src/lib/observability/events.ts` is an in-memory event bus, while
  `src/lib/observability/runtime-audit-log.ts` provides the only current
  persisted observability-like execution record surface
- that means the first honest observability projection should anchor on
  persisted runtime-audit-log backed executions and other durable audit trails,
  not on ephemeral event-bus listeners alone

### Remaining Execution-Planning Boundary Gap

- the target architecture and module map place execution planning under the
  platform execution module
- current planning still lives in `src/lib/capabilities/execution-targets.ts`
  plus catalog-owned planning policy helpers outside `src/core/platform/`
- `src/core/platform/execution/` currently contains timeline files only, so
  the execution substrate promised by the package is still only partially
  grounded in the codebase

## Current Problem Statement

Today the package has the right platform seams, but it still misses full
convergence on the highest-level product paths.

The remaining split is:

1. the route layer exposes unified interaction payloads, but the primary
   operator jobs experience still depends on job-local loaders and job-local
   view models
2. the streaming chat path uses the new agent facade, but the direct-turn chat
   path and several eval/runtime entry points still depend on raw
   tool-composition wiring
3. the execution timeline contract already reserves `chat_turn` and
   observability kinds, but the reader still explains them as unsupported
   rather than as real inspectable execution kinds
4. execution planning behavior exists and is explainable, but it has not yet
   converged on the platform execution module described by the package

This means the package is directionally correct but not yet fully grounded in
the architecture it claims. Phase 6 is the convergence phase that should close
those remaining gaps.

## Scope

### In Scope

- migrate the primary operator jobs surface onto the unified interaction model
- migrate direct-turn chat and adjacent high-level tool entry points onto the
  agent facade boundary
- add real read-first execution timeline support for `chat_turn` and
  observability where current persisted or derivable signals already exist
- move execution-planning ownership toward the platform execution module while
  preserving shipped behavior
- add focused parity and workflow tests for the migrated slices
- update package docs so compatibility adapters are only retained where the
  code still genuinely requires them after this phase

### Out of Scope

- replacing `CapabilityRuntime`, `KnowledgeAccessService`,
  `ExecutionTimelineReader`, `RevisionReader`, `AgentPlatformFacade`, or
  `PlatformInteractionFacade`
- rewriting the admin UI wholesale beyond the interaction-model convergence
  needed for the jobs surface
- replacing job or factory persistence models
- broad observability redesign unrelated to timeline projection
- changing execution-target policy semantics without explicit parity proof

## Canonical Files To Touch

### Existing Files

- `src/app/admin/jobs/page.tsx`
- `src/lib/admin/jobs/admin-jobs.ts`
- `src/components/admin/JobsTableClient.tsx`
- `src/app/api/chat/route.ts`
- `src/lib/chat/chat-turn.ts`
- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/stream-short-circuits.ts`
- `src/lib/chat/tools.ts`
- `src/lib/evals/live-runtime.ts`
- `src/lib/evals/live-runner.ts`
- `src/core/platform/execution/ExecutionTimeline.ts`
- `src/core/platform/execution/ExecutionTimelineReader.ts`
- `src/core/platform/execution/ExecutionTimelineProjector.ts`
- `src/lib/capabilities/execution-targets.ts`
- `src/core/capability-catalog/execution-planning-policy.ts`
- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- `src/core/platform/capability-runtime/CapabilityExecutionExplanation.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/core/tool-registry/ToolExecutionContext.ts`
- `src/core/platform/facade/AgentPlatformFacade.ts`
- `src/core/platform/facade/PlatformInteractionFacade.ts`
- `src/lib/platform/agent-platform-facade-root.ts`

### New Files

- `src/core/platform/execution/ChatTurnTimelineProjector.ts`
- `src/core/platform/execution/ObservabilityTimelineProjector.ts`
- `src/core/platform/execution/ExecutionPlanner.ts`
- `src/core/platform/execution/ExecutionTargetStrategy.ts`
- `src/core/platform/execution/ExecutionPlanner.test.ts`
- `src/core/platform/execution/ChatTurnTimelineProjector.test.ts`
- `src/core/platform/execution/ObservabilityTimelineProjector.test.ts`
- `src/lib/admin/jobs/admin-job-interactions.ts`

If the direct-turn migration can reuse `getAgentPlatformFacade()` cleanly, it
does not need a new root file in the first slice.

The exact filenames can move slightly, but the ownership boundary should stay
the same.

## Target Phase 6 Shape

Phase 6 should finish convergence on three user-facing platform promises and
one architecture-facing platform promise.

### Promise 1: One Operator Interaction Model

The primary operator jobs experience should consume one interaction-oriented
model derived from `PlatformInteractionFacade`, not a job-local list shape.

That means the main admin jobs path should answer:

1. what execution is this?
2. what capability and governance rules apply?
3. what revision or retry actions are honestly available?
4. what detail or timeline surface should the operator inspect next?

### Promise 2: One Agent Execution Boundary

The direct-turn chat path, streaming chat path, and adjacent runtime helpers
should all consume the same agent-facing execution surface.

That does not require deleting every tool-composition helper. It does require
that high-level agent entry points stop owning raw registry composition.

### Promise 3: One Execution Timeline For First-Class Kinds

`job`, `work_order`, `tool`, `chat_turn`, and observability-backed execution
records should all be inspectable through the execution timeline reader once a
real persisted or derivable source exists.

Phase 6 should prefer honest reduced-support projections over fabricated
durable history.

### Promise 4: Platform-Owned Execution Planning

Explainable execution planning should live under the platform execution module
described by the package, even if compatibility exports remain temporarily in
place.

The planner should remain behaviorally identical unless tests explicitly prove
an approved policy change.

## Grounded Phase 6 Assumptions

The package is directionally right, but implementation should start from these
grounded assumptions:

- `PlatformInteractionFacade` is already the correct convergence seam for the
  operator-facing jobs surface, but the admin jobs page still needs mapper-
  backed global list and count semantics that the facade does not yet expose
- `AgentPlatformFacade` is already the correct convergence seam for high-level
  chat execution entry points and should become the direct-turn owner boundary
- `executeDirectChatTurn()` is the narrowest current non-streaming chat
  execution owner and should first become an adapter over the existing
  `getAgentPlatformFacade()` root rather than continuing to compose the
  registry directly
- `ExecutionTimelineReader` should remain the canonical read surface; Phase 6
  should extend it rather than adding a parallel timeline reader for chat or
  observability
- chat-turn and observability timeline support should be derived from current
  prompt provenance, chat runtime lifecycle, and persisted audit sources;
  Phase 6 should not invent fake durability that the codebase does not have
- execution planning already behaves correctly enough to preserve; the main
  Phase 6 task is boundary convergence into the platform execution module with
  parity tests guarding behavior

## Initial Phase 6 Rules

### Operator Convergence Rule

The first migrated operator UI should be the main admin jobs surface.

Initial rule:

- preserve mapper-owned global list filters, counts, and pagination first
- layer platform interaction data onto listed jobs through an adapter or an
  extended facade surface rather than replacing the entire admin list path in
  one jump
- preserve existing auth, bulk-action, and pagination behavior during the
  migration
- avoid a visual redesign in the same slice unless the interaction model
  requires one

### Direct-Chat Convergence Rule

The direct-turn chat path should become an adapter over the agent facade.

Initial rule:

- preserve current prompt-building, tool-manifest, and provider behavior
- reduce raw `getToolComposition()` ownership at the high-level call site by
  reusing `getAgentPlatformFacade().getExecutionSurface()` first
- keep low-level tool-composition internals in place while high-level entry
  points migrate

### Timeline Completion Rule

`chat_turn` and observability execution kinds should become real projections
only if the available sources can support an honest read model.

Initial rule:

- prefer reduced-support, partially persisted timelines over unsupported
  placeholders when current prompt provenance or audit records are already
  sufficient
- do not treat the in-memory observability event bus as durable execution
  history
- if one execution kind still lacks enough persisted signals after the first
  slice, the remaining limitation must be explicit in code and docs

### Execution-Planner Convergence Rule

Execution planning should move under `src/core/platform/execution/` with
behavior-preserving compatibility exports.

Initial rule:

- migrate ownership, not policy
- introduce platform-owned exports in a way that existing imports from
  `src/lib/capabilities/execution-targets.ts` can be preserved or re-exported
  during the first migration slice
- preserve current target precedence and block-reason behavior by default
- use projection-parity tests to prevent silent planner drift

## Implementation Slices

### Slice 1: Migrate The Admin Jobs Surface To Platform Interactions

Tasks:

- introduce an admin-loader seam that keeps `JobQueueDataMapper` for global
  list filters, counts, and pagination while projecting listed jobs through
  `PlatformInteractionFacade` or a thin admin interaction adapter
- adapt the main admin jobs page and table client to render interaction-driven
  capability, timeline, and revision state
- preserve current bulk action wiring during the first migration slice

Acceptance criteria:

- the main admin jobs experience is no longer described or loaded as a raw
  deferred-job-only surface
- operator UI state for listed rows is derived from platform interaction data
  without regressing the current global browse semantics
- focused route or loader tests prove parity for representative job states

### Slice 2: Migrate Direct Chat And Adjacent Entry Points To The Agent Facade

Tasks:

- adapt `executeDirectChatTurn()` and the direct `/api/chat` route over the
  existing `getAgentPlatformFacade()` production root
- adapt math short-circuit handling to use the same boundary
- keep `getToolsForRole()` and eval/runtime helpers as follow-on cleanup once
  the direct-turn product path is migrated

Acceptance criteria:

- the direct-turn chat path and streaming chat path both use the platform
  facade at the high-level boundary
- standard agent/chat flows no longer require direct registry composition at
  their top-level entry points
- focused chat-turn tests prove parity for tool-enabled and short-circuit
  paths

### Slice 3: Add Chat-Turn Timeline Projection

Tasks:

- introduce a projector for `chat_turn` execution inspection using existing
  prompt provenance, turn lifecycle, and assistant generation records where
  available
- extend `ExecutionTimelineReader` so `chat_turn` no longer returns the
  current unsupported placeholder in standard cases
- define honest fallback behavior for older turns without sufficient records

Acceptance criteria:

- `chat_turn` inspection is queryable through the canonical timeline reader
- supported vs reduced-support chat-turn states are explicit
- tests cover representative direct-turn and streamed-turn inspection cases

### Slice 4: Add Observability Timeline Projection

Tasks:

- project relevant observability event sequences into the canonical timeline
  model where current persisted audit data is sufficient
- extend `ExecutionTimelineReader` so observability-backed inspection can
  return a real timeline instead of the current unsupported placeholder
- keep observability-specific storage and transport owners intact during the
  first slice, and do not require a new generic observability persistence layer

Acceptance criteria:

- observability execution inspection is available through the canonical reader
  for supported persisted cases
- unsupported or partial cases remain explicit rather than implicit
- focused tests cover sequencing, failure explanation, and artifact-less
  lifecycle projections

### Slice 5: Converge Execution Planning Into The Platform Execution Module

Tasks:

- introduce `ExecutionPlanner` and strategy-oriented ownership under
  `src/core/platform/execution/`
- preserve existing compatibility exports from `src/lib/capabilities/` while
  the new platform ownership becomes canonical
- migrate the current type and function import graph incrementally across
  `CapabilityRuntime`, capability-catalog helpers, runtime tool binding, and
  executor dispatch instead of attempting a single-step rewrite

Acceptance criteria:

- execution planning ownership is grounded under the platform execution module
- current target precedence, enabled-target rules, and block reasons remain
  behaviorally stable
- parity tests prove that the migration changed ownership rather than policy

## Focused Validation Plan

Minimum validation expected for Phase 6:

- admin jobs loader or page tests covering interaction-driven browse state
- direct-turn chat tests covering facade-based execution and math short-circuit
  reuse
- timeline reader and projector tests for `chat_turn`
- timeline reader and projector tests for observability-backed execution
- execution-planner parity tests covering representative inline, deferred,
  browser, and blocked-plan capabilities

Recommended focused suites:

- `src/app/admin/jobs/page.test.tsx`
- `src/lib/admin/jobs/*.test.ts`
- `src/lib/chat/chat-turn.test.ts`
- `src/core/platform/execution/ExecutionTimelineReader.test.ts`
- `src/core/platform/execution/*.test.ts`
- `src/lib/capabilities/execution-targets.test.ts` or migrated planner
  equivalents
- `src/app/api/chat/route.test.ts` and `src/app/api/chat/stream/route.test.ts`
  if the direct-turn boundary change reaches those transport surfaces
  equivalents

## Completion Criteria

Phase 6 is complete when all of the following are true:

- the primary operator jobs experience consumes the unified platform
  interaction model rather than job-local row shaping
- the direct-turn chat path is an adapter over the agent facade rather than a
  direct tool-composition client
- `ExecutionTimelineReader` provides real timeline projections for `chat_turn`
  and supported observability-backed executions
- execution-planning ownership is grounded in the platform execution module
  described by the package
- the package docs can describe remaining compatibility adapters as
  intentional, narrow exceptions rather than as unresolved convergence gaps
