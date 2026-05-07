# Migration Playbook

## Objective

Define how to migrate toward the target architecture incrementally without
breaking delivery or causing half-migrated ownership confusion.

## Migration Strategy

Use a strangler pattern with projection-first rollout.

That means:

- do not rewrite the current system in place all at once
- introduce new canonical projections and facades beside existing seams
- move consumers over one boundary at a time
- delete old assembly layers only after parity is proven

## Core Principle

Projection before replacement.

The fastest safe route is to read current systems into new canonical models
first, then migrate consumers, then retire old composition paths.

## Migration Order

### Step 1: Freeze Canonical Ownership

Before implementation starts, establish these decisions:

- capability catalog remains the canonical capability source of truth
- hybrid search remains the canonical retrieval engine
- factory orchestrator remains the canonical advanced revision runtime
- execution timeline becomes the canonical inspection surface

Reason:

Without these anchor decisions, implementation will create more parallel layers
instead of fewer.

### Step 2: Introduce Capability Runtime As Read-Only Projection

Initial implementation:

- add `CapabilityRuntime` projection code
- do not yet remove runtime binding or registry code
- add parity tests for representative capabilities

Migration outcome:

- the new runtime shape becomes trustworthy before it becomes required

Exit criteria:

- projected runtime matches current behavior for a representative cross-section
  of capabilities

### Step 3: Move Tool Registration To Consume Projected Runtime

Initial implementation:

- change registry assembly to consume `CapabilityRuntime`
- keep legacy wiring available behind tests until parity is complete

Migration outcome:

- capability metadata stops being rebuilt manually in multiple layers

Exit criteria:

- adding or modifying a capability requires fewer manual touch points

### Step 4: Introduce Knowledge Access Service Beside Existing Corpus Surfaces

Initial implementation:

- wrap existing retrieval engine and shaping logic in `KnowledgeAccessService`
- keep current corpus tools and facades intact initially
- use adapters to call into the new service

Migration outcome:

- grounded retrieval gets one clear platform seam

Exit criteria:

- corpus tool flows can consume the new service without feature loss

### Step 5: Split Discovery Search From Grounding Search

Initial implementation:

- extract current route/admin/entity search into `DiscoverySearchService`
- leave global search behavior intact while moving logic behind the new service

Migration outcome:

- discovery becomes explicit and no longer masquerades as RAG retrieval

Exit criteria:

- search code no longer mixes navigation and evidence concerns in the same
  service contract

### Step 6: Introduce Execution Timeline Projection

Initial implementation:

- define timeline entities
- project from existing job, work-order, and tool execution sources
- provide a read-only inspection layer first

Migration outcome:

- one timeline view exists before any persistence consolidation is attempted

Exit criteria:

- a majority of execution inspections can be performed through the timeline
  reader alone

### Step 7: Introduce Revision Platform Contract

Primary implementation spec:

- `phase-4-revision-platform-implementation.md`

Grounded handoff into this step:

- the execution timeline seam from Phase 3 is complete and is the inspection
  dependency Phase 4 should build on
- advanced revision support already exists in the factory subsystem and should
  be projected into the platform contract rather than replaced
- retry-only job flows already exist and should be modeled as reduced support,
  not over-generalized into advanced revision semantics

Initial implementation:

- map factory revision support into the generalized revision contract
- map retry-only job flows into reduced revision support levels

Migration outcome:

- the platform gains one revision vocabulary without pretending every subsystem
  supports the same actions

Exit criteria:

- revision capability is inspectable and explainable at the platform level
- the implementation matches the ordered checklist in
  `phase-4-revision-platform-implementation.md`

Current status:

- complete
- canonical revision inspection now ships through
  `src/core/platform/revision/RevisionReader.ts`
- current factory/member/chat revision transports are compatibility adapters
  over that reader rather than owning raw revision shaping logic

### Step 8: Add Agent Facade Last

Primary implementation spec:

- `phase-5-ux-and-agent-simplification-implementation.md`

Grounded handoff into this step:

- the platform seams for capability, knowledge, execution, and revision now
  exist and should be composed rather than replaced
- `stream-route-handler.ts` remains the clearest current high-level agent/chat
  execution integration point
- the chat shell and operator surfaces still compose multiple subsystem-owned
  hooks and routes directly, which is the concrete simplification target for
  Phase 5

Initial implementation:

- compose the new platform modules into one facade
- do not let the facade become a new logic sink

Migration outcome:

- agents get a smaller stable surface after the underlying pieces are already
  coherent

Exit criteria:

- agents can work through platform verbs instead of subsystem-specific seams
- the implementation matches the ordered checklist in
  `phase-5-ux-and-agent-simplification-implementation.md`

Current status:

- complete
- the canonical Phase 5 agent facade now ships through
  `src/core/platform/facade/AgentPlatformFacade.ts`
- the canonical operator interaction composition now ships through
  `src/core/platform/facade/PlatformInteractionFacade.ts`
- current member/chat/admin routes remain compatibility transports over those
  facades rather than owning separate inspection and revision composition

### Step 9: Converge Remaining High-Level Consumers And Execution Coverage

Primary implementation spec:

- `phase-6-platform-convergence-and-timeline-completion.md`

Grounded handoff into this step:

- route-level interaction and agent facades now exist and are already proven
  on the streaming chat path plus several inspection routes
- the primary admin jobs UI, direct-turn chat path, `chat_turn` timeline
  coverage, observability timeline coverage, and execution-planning ownership
  are still the main remaining convergence gaps from the architecture QA pass
- the current admin jobs surface still depends on mapper-owned global list,
  filter, and count behavior, so the first migration slice must preserve those
  semantics while layering interaction projection onto listed jobs
- the current agent-facade production root already exists, so direct-turn chat
  can reuse `getAgentPlatformFacade()` before any new root is introduced
- the first honest observability timeline slice must anchor on persisted audit
  sources such as runtime audit logs, not on the in-memory observability event
  bus alone

Initial implementation:

- preserve mapper-owned admin browse semantics while projecting listed jobs
  through platform interaction data
- migrate direct-turn chat onto the existing agent facade boundary and defer
  secondary eval or helper cleanup until after the product path is moved
- complete timeline projection for `chat_turn` and supported persisted
  observability-backed executions
- move execution-planning ownership under `src/core/platform/execution/`
  with compatibility exports as needed

Migration outcome:

- the architecture becomes grounded not only at the route seam, but at the
  primary operator and chat entry points as well

Exit criteria:

- the remaining QA findings from the post-Phase-5 package audit are resolved
- the implementation matches the ordered checklist in
  `phase-6-platform-convergence-and-timeline-completion.md`

### Step 10: Add Intensive Media Proof

Primary implementation spec:

- `phase-7-media-evals-and-video-proof.md`

Grounded handoff into this step:

- the platform package has already converged the core capability, grounding,
  execution, revision, operator, and agent seams
- the codebase already contains live media browser evals, deterministic media
  QA scripts, and evidence helpers, but they are not yet represented as a
  dedicated package phase
- media workflows remain one of the highest-risk user-facing outcome classes,
  especially where image, audio, uploads, and final video assembly must all
  succeed together

Initial implementation:

- formalize the cross-media eval matrix as a package acceptance surface
- strengthen final-video proof through browser playback and downloaded-asset
  inspection
- classify planner or routing failures truthfully with stable debug artifacts
- unify deterministic and live media QA entry points into one Phase 7 gate

Migration outcome:

- the package can make a concrete readiness claim for supported media assembly
  and final video generation rather than relying on scattered runtime tests

Exit criteria:

- the implementation matches the ordered checklist in
  `phase-7-media-evals-and-video-proof.md`
- the package can produce durable evidence for media readiness across the
  required scenario matrix

## Deletion Rules

No old layer should be deleted until all three conditions are true:

1. projection parity is tested
2. primary consumers have been migrated
3. runtime diagnostics show no missing behavior

If one of those is false, the old layer should remain temporarily even if it is
ugly.

## Code Review Rules

Every migration PR should state:

- what canonical owner is being strengthened
- what duplicate owner is being reduced
- what consumer is being migrated
- what remains intentionally untouched

This keeps the refactor moving toward simplification instead of local cleanup.

## Risk Register

### Risk 1: New Abstraction Layer Without Deletion Pressure

Failure mode:

- the codebase gains new platform modules but keeps old manual wiring forever

Mitigation:

- require each phase to identify which duplicate owner is being reduced

### Risk 2: Agent Facade Introduced Too Early

Failure mode:

- facade becomes another translation layer over unstable internals

Mitigation:

- add facade only after capability runtime, knowledge access, and timeline are
  already coherent

### Risk 3: Over-Generalizing Revision

Failure mode:

- platform contract promises refine/resume behaviors to systems that only retry

Mitigation:

- make revision support levels explicit and test unsupported states honestly

### Risk 4: Premature Persistence Unification

Failure mode:

- rewrite effort expands into replacing multiple durable stores at once

Mitigation:

- project timelines first; unify storage only if later evidence justifies it

## Definition of Done

The migration playbook is ready when:

- sequence is explicit
- parity-before-deletion rules are explicit
- risks are named and mitigated
- the plan supports incremental delivery instead of a rewrite freeze
