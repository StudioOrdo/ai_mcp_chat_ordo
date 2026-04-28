# Capability Platform Unification — Roadmap

## Summary

This roadmap describes how to move from the current subsystem-heavy platform to
a unified capability, knowledge, execution, and revision architecture without
stalling delivery or rewriting proven cores.

This roadmap is part of an implementation pack. It should be read together with:

- `module-map.md`
- `contracts-and-interfaces.md`
- `migration-playbook.md`
- `validation-and-test-strategy.md`
- `phase-1-capability-runtime-implementation.md`
- `phase-2-knowledge-access-implementation.md`
- `phase-3-execution-timeline-implementation.md`
- `phase-4-revision-platform-implementation.md`
- `phase-5-ux-and-agent-simplification-implementation.md`
- `phase-6-platform-convergence-and-timeline-completion.md`
- `phase-7-media-evals-and-video-proof.md`
- `phase-8-media-fault-induction-and-continuity-proof.md`
- `phase-9-shared-media-materialization-and-live-runtime-proof.md`
- `adr-001-capability-runtime.md`

## Refactor Goals

- reduce duplicate ownership of capability metadata
- separate grounding search from navigation search
- unify execution inspection into one timeline surface
- make revision a platform-level concept
- simplify the user and agent experience at the same time

## Non-Goals

- do not replace the factory execution engine
- do not replace the hybrid search engine
- do not rewrite every tool into a new abstraction before proving the shape
- do not pause product delivery for a full platform rewrite

## Phase Overview

| Phase | Focus | Outcome |
| ------- | ------- | ------- |
| Phase 0 | Audit and package design | clear refactor direction and target architecture |
| Phase 1 | Capability runtime unification | one canonical capability projection |
| Phase 2 | Knowledge access split | grounded retrieval separated from discovery search |
| Phase 3 | Execution timeline projection | unified inspection surface across jobs, tools, and factory |
| Phase 4 | Revision platform contract | shared revision vocabulary and transport surfaces |
| Phase 5 | UX and agent simplification | agent facade and operator-facing unified flows |
| Phase 6 | Platform convergence and timeline completion | primary-surface convergence, full first-class timeline coverage, and platform-owned planning |
| Phase 7 | Media evals and video proof | governed typed media discovery plus stress-driven, artifact-backed proof that supported media inputs can assemble into valid final video outputs |
| Phase 8 | Media fault induction and continuity proof | adversarial continuity, identity, routing, and recovery proof for one long-lived media conversation surface |
| Phase 9 | Shared media materialization and live runtime proof | chart and graph promotion is shared across browser and worker lanes, and live workflow proof exercises the real production composition routes |

## Phase Details

### Phase 0: Audit and Package Design

- [x] Audit the current platform holistically
- [x] Identify duplication, ownership drift, and simplification seams
- [x] Define target architecture and migration strategy
- [x] Create this implementation package

**Deliverables:**

- `architecture-audit.md`
- `target-architecture.md`
- `module-map.md`
- `contracts-and-interfaces.md`
- `migration-playbook.md`
- `validation-and-test-strategy.md`
- `phase-1-capability-runtime-implementation.md`
- `adr-001-capability-runtime.md`
- `ROADMAP.md`

### Phase 1: Capability Runtime Unification

- [ ] Introduce a canonical `CapabilityRuntime` projection derived from the
  catalog
- [ ] Collapse redundant binding and manual descriptor assembly into projection
  logic
- [ ] Make tool registration consume the runtime projection rather than rebuild
  metadata ad hoc
- [ ] Centralize execution planning explanation in one runtime surface
- [ ] Add focused tests that prove runtime projection parity for representative
  capabilities

Success criteria:

- a capability is defined once and projected everywhere else
- runtime explainability improves
- adding a new capability requires fewer manual registration steps

### Phase 2: Knowledge Access Split

- [x] Introduce `KnowledgeAccessService` for grounded retrieval and citations
- [x] Introduce `DiscoverySearchService` for routes, admin entities, and shell
  search
- [x] Move corpus prefetch and result shaping behind the grounded retrieval
  service
- [x] Remove duplicated audience filtering and link-building logic from
  parallel retrieval surfaces where practical
- [x] Preserve the existing hybrid engine as the canonical search core

Success criteria:

- agent grounding uses one predictable retrieval surface
- UI discovery search remains powerful but is no longer conflated with RAG
- search result contracts become more consistent

### Phase 3: Execution Timeline Projection

- [x] Define a canonical execution timeline entity and query model
- [x] Add projections from jobs, factory work orders, and tool execution
- [x] Add timeline readers for operator and agent inspection
- [x] Integrate observability events only where they improve execution
  explanation
- [x] Expose artifacts, checkpoints, and failure reasons through the timeline

Success criteria:

- one inspection surface can explain the majority of execution flows
- operators do not need to inspect multiple subsystem-specific histories for
  normal diagnosis
- agents can reason about status and next actions from one model

### Phase 4: Revision Platform Contract

Implementation spec:

- `phase-4-revision-platform-implementation.md`

Current grounded closeout:

- canonical revision contract, projector, and reader now live under
  `src/core/platform/revision/`
- factory revision remains the reference advanced runtime, but inspection now
  projects through the platform reader
- deferred jobs now expose reduced-support revision through the same platform
  vocabulary while preserving current retry/cancel mutation owners
- member, chat, and admin factory inspection routes now expose canonical
  revision payloads

- [x] Define a platform-level revision vocabulary
- [x] Project factory pause/refine/resume into that platform contract
- [x] Add compatibility rules for tools or jobs that support retry only
- [x] Keep factory revision as the reference implementation for advanced
  revision support
- [x] Add transport surfaces that make revision inspection and actions more
  uniform

Success criteria:

- retry, resume, and refine no longer feel like unrelated subsystem verbs
- the product can present one revision surface even when capabilities differ in
  support level
- the codebase satisfies the Phase 4 implementation spec rather than only the
  roadmap summary

Validation status:

- focused Phase 4 validation passed across the canonical projector/reader,
  shared job-action adapter, and migrated admin/member/chat route surfaces

### Phase 5: UX and Agent Simplification

Implementation spec:

- `phase-5-ux-and-agent-simplification-implementation.md`

Current grounded closeout:

- canonical Phase 5 facade modules now live under
  `src/core/platform/facade/`
- chat execution now adapts over the agent facade execution surface in
  `src/lib/chat/stream-route-handler.ts`
- the chat shell now adapts over a smaller `usePlatformChatInteraction()`
  composition seam
- operator-facing job and factory routes now expose one coherent interaction
  payload model beside their compatibility transport shapes

- [x] Introduce an agent-facing facade with stable verbs:
  `discover`, `ground`, `execute`, `inspect`, `revise`
- [x] Simplify operator-facing flows around capability selection and execution
  status
- [x] Reduce subsystem exposure in core product flows
- [x] Ensure evidence, execution, artifacts, and revision are visible from one
  coherent interaction model

Success criteria:

- the user asks for outcomes, not subsystem operations
- the agent works from platform verbs, not local implementation seams
- platform capability becomes easier to leverage because the model is smaller

Validation status:

- focused Phase 5 validation passed across the new facade modules, job
  list/detail/history routes, admin factory revision route, and
  `useGlobalChat` interaction coverage

### Phase 6: Platform Convergence And Timeline Completion

Implementation spec:

- `phase-6-platform-convergence-and-timeline-completion.md`

Grounded starting point:

- the main admin jobs UI still consumes job-local loader and row-shaping logic
  rather than a platform interaction projection, and the current facade does
  not yet expose global admin list or count semantics for that page
- the streaming chat path uses the agent facade, but the direct-turn chat path
  still composes `getToolComposition()` directly even though the existing
  `getAgentPlatformFacade()` root can be reused for the first migration slice
- `ExecutionTimelineReader` still returns explicit unsupported placeholders
  for `chat_turn` and observability execution kinds, and current observability
  durability is limited to runtime audit logs rather than a general persisted
  event reader
- execution planning is explainable and tested, but its ownership still lives
  outside `src/core/platform/execution/`

- [ ] Migrate the primary operator jobs surface onto the unified interaction model
- [ ] Migrate direct-turn chat and adjacent high-level entry points onto the agent facade
- [ ] Add real timeline projection for `chat_turn` and supported observability-backed executions
- [ ] Converge execution-planning ownership into the platform execution module
- [ ] Add focused parity, contract, and workflow tests for the migrated slices

Success criteria:

- the primary operator jobs experience preserves current global browse
  semantics while deriving listed-row state from platform interaction data
- both streaming and direct chat entry points work from platform verbs at the
  high-level boundary
- first-class execution kinds no longer depend on unsupported placeholders for
  supported persisted inspection flows
- execution planning is grounded in the platform execution module described by
  the package

### Phase 7: Media Evals And Video Proof

Implementation spec:

- `phase-7-media-evals-and-video-proof.md`

Grounded starting point:

- live browser media evals already cover generated-image plus TTS,
  uploaded-image plus TTS, and uploaded-clip concat workflows with real debug
  bundles and downloaded media probes
- reusable media eval helpers already capture browser diagnostics, invocation
  evidence, manifest output, authenticated asset downloads, playback checks,
  and ffprobe or ffmpeg validation
- deterministic media QA scripts already validate browser FFmpeg, server
  FFmpeg, composition planning, job routing, media rendering, and file serving
- planner media evals already expose at least one real routing constraint for
  short narrated video requests and need to be promoted into a formal package
  acceptance story
- current live compose failures show that broad mixed-kind media discovery is
  not sufficient for composition safety; Phase 7 needs a typed discovery path
  for clip-slot asset resolution in addition to stronger eval proof
- Phase 7 also needs to behave like a fault-finding phase: it must stress
  ambiguity, repeated governed reuse, retry pressure, and route-boundary
  prompts strongly enough to expose real faults and require rerun-backed
  resolution

- [ ] Define the required cross-media scenario matrix for package-level proof
- [ ] Add governed typed media discovery for composition-safe slot resolution
- [ ] Add stressed ambiguity, retry, and recovery scenarios that are expected
  to expose real system weaknesses
- [ ] Strengthen live video proof gates around playback, stream presence, and non-silent audio
- [ ] Add explicit planner and routing eval coverage for representative media prompts
- [ ] Unify deterministic and live media QA into one Phase 7 acceptance gate
- [ ] Emit durable release evidence for media-readiness claims

Success criteria:

- the package can point to one explicit media-proof phase
- supported image, audio, uploaded clip, and governed artifact flows are
  covered by artifact-backed eval scenarios
- every required video scenario proves a playable final asset and audible
  output when narration is expected
- planner failures are classified truthfully as guarded prompt issues or real
  regressions

### Phase 8: Media Fault Induction And Continuity Proof

Implementation spec:

- `phase-8-media-fault-induction-and-continuity-proof.md`

Grounded starting point:

- current media proof strongly validates explicit-input success, but several
  real bug classes still live in the product seam between continuous chat
  history, governed asset discovery, planner choice, route fallback, and UI
  recovery
- the shipped product uses one long-lived conversation surface, so same-turn
  attachment success is not sufficient evidence for cross-turn media
  continuity
- archived regression plans and combination matrices already identify missing
  or partial continuity, identity, retry, reload, and route-pressure scenarios
- current live evidence shows that the system can still regenerate assets,
  flatten route-specific failures, or surface confusing retry history even
  after final media artifacts are possible

- [ ] Define the adversarial continuity, identity, route, recovery, and UI-truth matrix for media work
- [ ] Map current coverage as covered, partial, missing, or misleading against that matrix
- [ ] Add later-turn continuous-conversation media reuse scenarios that distinguish reuse from regeneration
- [ ] Add ambiguity-heavy mixed-asset scenarios that pressure kind-safe selection and transform discipline
- [ ] Add reload, missed-event, retry, dedupe, reroute, and deferred-only continuity scenarios
- [ ] Emit durable Phase 8 evidence that retains induced failures and rerun-backed resolution

Success criteria:

- the package can point to one explicit fault-induction phase for media
  continuity and recovery readiness
- later-turn reuse in one long-lived conversation is validated directly rather
  than implied by same-turn or harness flows
- ambiguity, retry, reload, reroute, and recovery failures become required
  package gates rather than live-discovered surprises
- induced failures are retained, explained, fixed or intentionally guarded,
  and rerun before the phase is considered complete

## Recommended Sequencing

The order matters.

Recommended implementation order:

1. Capability runtime unification
2. Knowledge access split
3. Execution timeline projection
4. Revision platform contract
5. UX and agent simplification
6. Platform convergence and timeline completion
7. Media evals and video proof
8. Media fault induction and continuity proof

Reason:

- capability runtime defines what can run
- knowledge access defines how the system grounds decisions
- execution timeline defines how the system explains what happened
- revision builds on execution visibility
- user and agent simplification should be the last packaging pass, not the
  first layer of indirection

## Definition of Done

This roadmap is complete when the platform can truthfully claim:

- capabilities are defined once and projected consistently
- grounded retrieval is distinct from discovery search
- execution can be inspected through a unified timeline surface
- revision is exposed through one platform vocabulary
- both user and agent experiences are simpler than the current subsystem map
- supported media workflows are proven by repeatable artifact-backed evals,
  including final playable video generation
- media continuity, recovery, and fault handling remain trustworthy under one
  long-lived conversation surface and adversarial media-state pressure

At that point the codebase will be substantially easier to extend, easier for
agents to use correctly, and easier for operators to trust.
