# Phase 8 Implementation Spec — Media Fault Induction And Continuity Proof

## Objective

Add a dedicated phase whose job is to force the unified media system into the
failure-prone states already observed in live use, retain evidence for those
states, and require either a root-cause fix or a truthful guardrail before the
package can claim continuity readiness.

Phase 8 is not a larger version of Phase 7.

Phase 7 proves supported media workflows can succeed.

Phase 8 must prove the product remains correct when media continuity,
discovery, routing, retries, reloads, and recovery pressure make the system
behave like the real app rather than a clean lab harness.

The first Phase 8 question should be:

- can the system preserve truthful, deterministic media continuity when the
  user works in one long-lived conversation containing many prior generated,
  uploaded, deferred, and derived assets?

The second Phase 8 question should be:

- can the system surface, explain, and recover from continuity, routing,
  identity, and recovery faults strongly enough that the next live failure is
  expected by the matrix rather than discovered ad hoc?

## Phase 7 Handoff

By the end of Phase 7, the package should already have:

- deterministic coverage for composition planning, browser and server routing,
  render-card behavior, and governed file serving
- live proof that several representative media workflows can produce playable
  final video outputs with debug bundles
- an explicit warning that happy-path media proof is not enough to claim media
  readiness when continuity, ambiguity, and recovery paths remain weak

Phase 8 builds on that proof instead of reopening it.

The handoff assumptions are:

- the media runtime can already succeed when given correct explicit inputs
- the strongest remaining media risk is system integrity across continuous
  conversation state, repeated reuse, route divergence, and recovery pressure
- the current chat product uses one long-lived conversation surface rather than
  a fresh bounded thread for each media task
- the controlling failure seam is no longer only media execution correctness,
  but the product path that decides which prior assets, plans, jobs, and
  retries the execution layer will actually receive

## Current Code Grounding

The codebase already contains many of the ingredients Phase 8 needs.

### Existing Continuity And Recovery Surfaces

- `src/hooks/chat/chatSendPolicy.ts` builds backend history for the next turn,
  but drops `tool_call` and `tool_result` parts entirely
- `src/lib/chat/task-origin-handoff.ts` already demonstrates a server-owned
  structured handoff pattern for request-local UI context
- `src/lib/media/media-composition-asset-identity.ts` already knows how to
  derive canonical media candidates from transcript parts, attachments,
  `list_conversation_media_assets`, user files, and job snapshots
- `src/lib/media/compose-media-preflight.ts` already classifies readiness
  failures such as kind mismatch, conversation mismatch, and lineage mismatch

### Existing Media Integrity Evidence

- `tests/browser-ui/media-compose-planner-eval.spec.ts` already exercises the
  real chat surface for same-turn attached media inputs
- `tests/browser-ui/media-live-workflows.spec.ts` already proves several media
  lab workflows end to end with downloadable artifacts and playback validation
- `tests/browser-ui/ffmpeg-browser-runtime.spec.ts` already exercises browser
  runtime rendering, fallback, and completed media card behavior
- `docs/_archive/_tests-pre-factory-2026-04-27/evals/pipeline-regression-plan.md`
  already records several real media pipeline bug classes and missing tests
- `docs/_archive/_tests-pre-factory-2026-04-27/evals/media-combination-matrix.md`
  already identifies missing or partial continuity, recovery, and identity
  combinations

### Existing Known Continuity Constraints

- same-turn attachment flows are materially easier than cross-turn reuse in one
  long-lived conversation
- the media lab harness proves explicit asset binding, not continuous-chat
  continuity
- charts and graphs can be promoted into image-backed compose inputs, but the
  real chat product still needs to decide when that promotion is required and
  whether reuse should occur instead of regeneration
- browser, deferred, and server execution targets do not always preserve the
  same failure semantics or recovery detail unless that behavior is explicitly
  covered

## Phase 8 QA Findings

Current media proof is still too weak in five ways when compared against real
continuous conversation behavior:

1. it proves explicit-input success more clearly than it proves cross-turn
   continuity under one long-lived thread
2. it proves route success more clearly than it proves route divergence,
   fallback truthfulness, and route-specific failure preservation
3. it validates kind-aware preflight more clearly than it validates the full
   product path that decides which asset ids reach preflight at all
4. it validates generated final artifacts more clearly than it validates the
   product state after reload, missed live events, or repeated retries
5. it identifies some failure classes in archived plans, but does not yet make
   those classes a mandatory package gate

Phase 8 should therefore be treated as a fault-induction phase and continuity
readiness phase. It must deliberately create the conditions under which media
continuity is likely to fail, then require retained evidence, diagnosis, and
rerun-backed closeout.

## Grounded 5 Whys

### System 5 Whys

1. Why can Phase 7 still pass while real continuous-chat media failures occur?
   Because most existing proof surfaces validate explicit-input success rather
   than the continuous product path that selects and reuses inputs over time.
2. Why is the continuous product path weaker than the runtime path?
   Because continuity depends on transcript shaping, request handoff,
   discovery, planner selection, route behavior, and recovery state rather than
   only on media execution.
3. Why does that make failures more likely in one long-lived conversation?
   Because more prior assets, overlapping labels, retries, and historical job
   state increase ambiguity while the conversation boundary becomes less useful
   as a task boundary.
4. Why is that not already blocked by current preflight or discovery tests?
   Because many deterministic tests begin after the product has already chosen
   the asset ids or route, and several live tests use same-turn or synthetic
   harness shortcuts that avoid the full continuity seam.
5. Why must Phase 8 exist as a separate phase?
   Because the package needs one explicit phase whose purpose is to break
   continuity, routing, and recovery assumptions before live users do.

### Media Continuity 5 Whys

1. Why did the traced “combine them into a video” request regenerate assets?
   Because the product path reached the model with lossy prior-turn media
   context rather than a structured selected-asset continuity contract.
2. Why was the prior-turn media context lossy?
   Because backend history shaping dropped structured tool results and the next
   request did not carry an explicit media-working-set handoff.
3. Why did the model then choose new generation tools?
   Because the remaining chat context still allowed many valid media tools and
   no deterministic higher-priority reuse contract constrained selection.
4. Why did that become a runtime-visible failure rather than only a planning
   quirk?
   Because regenerated chart or graph assets still need explicit promotion into
   image-backed compose inputs, and the system can arrive at invalid or
   misleading follow-up plans before final compose succeeds.
5. Why must Phase 8 stress this exact path?
   Because long-lived, reuse-heavy conversations are the shipped product shape,
   not an edge case.

## Current Problem Statement

The package can already prove several media workflows succeed, but it still
lacks one explicit phase that proves the product remains correct when:

1. the user stays inside one continuous conversation instead of starting fresh
2. many prior media assets with overlapping labels exist in the same thread
3. the request depends on reusing prior outputs rather than same-turn
   attachments
4. route choice, fallback, or retry changes how execution state is surfaced
5. reload, missed live events, or repeated attempts pressure recovery logic

Without that phase, the package can claim media proof while still leaving the
most expensive continuity and recovery failures to be discovered through live
use.

## Scope

### In Scope

- define a package-level fault-induction phase for continuity, identity,
  routing, and recovery failures in media workflows
- define the minimum adversarial scenario matrix needed to claim media
  continuity readiness for one long-lived conversation
- require evidence bundles that retain enough state to explain continuity,
  planner, route, and recovery failures without ad hoc reruns
- cover cross-turn reuse, mixed-kind ambiguity, asset-id discipline, route
  divergence, reload and missed-event recovery, retry pressure, and UI truth
- map current coverage as covered, partial, missing, or misleading so the next
  package gate is based on reality rather than optimistic assumptions
- prioritize a first set of high-value scenarios that should be implemented
  immediately

### Out of Scope

- replacing the FFmpeg executors
- redesigning the entire chat product surface before proof exists
- inventing synthetic failure modes that do not match shipped behavior
- treating Phase 8 as a generic chaos-testing initiative unrelated to media
  continuity or execution truthfulness

## Canonical Files To Touch

### Existing Files

- `docs/_refactor/capability-platform-unification/ROADMAP.md`
- `docs/_refactor/capability-platform-unification/validation-and-test-strategy.md`
- `src/hooks/chat/chatSendPolicy.ts`
- `src/lib/chat/task-origin-handoff.ts`
- `src/lib/media/media-composition-asset-identity.ts`
- `src/lib/media/compose-media-preflight.ts`
- `tests/browser-ui/media-compose-planner-eval.spec.ts`
- `tests/browser-ui/media-live-workflows.spec.ts`
- `tests/browser-ui/ffmpeg-browser-runtime.spec.ts`
- `tests/browser-ui/helpers/media-eval.ts`
- `scripts/run-phase-7-media-evals.ts`
- `scripts/run-phase-11-tool-invocation-qa.ts`

### Potential New Files

- `tests/browser-ui/media-continuity-faults.spec.ts`
- `tests/browser-ui/media-recovery-faults.spec.ts`
- `tests/evals/media-fault-induction.test.ts`
- `scripts/run-phase-8-media-faults.ts`
- `release/phase-8-media-fault-evidence.json`

The exact filenames can move, but Phase 8 ownership should stay focused on
fault induction, continuity proof, recovery proof, and durable evidence.

## Target Phase 8 Shape

Phase 8 should make one package-level claim credible:

the unified platform can remain truthful and continuity-safe for media work in
one long-lived conversation, even when ambiguity, retries, reloads, missed
events, and route changes pressure the system.

That claim should be expressed through five surfaces.

### Surface 1: Continuity Proof

Phase 8 should prove that cross-turn media follow-ups reuse the right prior
assets or explicitly ask for clarification instead of silently regenerating or
silently binding the wrong media.

Minimum requirements:

- later-turn compose requests can reuse earlier generated chart, graph, image,
  audio, and video outputs without relying on vague transcript recall alone
- the product has a deterministic higher-priority continuity path before broad
  rediscovery or regeneration
- repeated prior assets with overlapping labels do not cause silent reuse of
  the wrong asset

### Surface 2: Identity And Selection Proof

Phase 8 should prove the system preserves correct asset identity under real
product pressure.

Minimum requirements:

- invalid asset-id classes are rejected truthfully
- visual, audio, and video slots remain kind-safe under real follow-up flows
- derivative or source-lineage requirements remain visible and enforceable
- chart and graph reuse either promote explicitly into image-backed inputs or
  fail truthfully before misleading composition work begins

### Surface 3: Route And Recovery Proof

Phase 8 should prove route selection, fallback, retry, reload, and missed
event recovery remain coherent.

Minimum requirements:

- browser-first, deferred, and direct-server paths preserve meaningful failure
  semantics
- reroute and retry surfaces do not flatten source or continuity failures into
  generic execution errors
- reload and missed live events recover coherent job, artifact, and UI state

### Surface 4: Truthful State Proof

Phase 8 should prove the user sees one honest workflow state rather than a
confusing pile of stale or contradictory cards.

Minimum requirements:

- retries and deduped attempts resolve into a coherent workflow track
- earlier failed or superseded attempts remain auditable without dominating the
  UI
- the system does not claim reuse when regeneration occurred
- the system does not claim media execution failure when the real issue was
  selection, identity, or recovery state

### Surface 5: Closure Proof

Phase 8 should prove that critical induced failures are handled as package
defects with evidence-backed closeout.

Minimum requirements:

- induced failures write retained evidence bundles
- retained bundles capture the conflicting assets, plan, route, and recovery
  state that explains the fault
- fixes rerun the exact induced scenario
- guardrails remain explicit, stable, and user-truthful if a fault is accepted
  as unsupported behavior rather than fixed

## Proposed Phase 8 Matrix

### Group 1: Continuity Scenarios

| Scenario | Current coverage | Controlling seam |
| --- | --- | --- |
| later-turn chart + audio reuse into video | Missing | `chatSendPolicy.ts`, planner selection, continuity handoff |
| later-turn graph + audio reuse into video | Missing | continuity handoff, chart/graph promotion |
| later-turn prior video reuse with new narration | Partial | asset identity, route selection |
| many prior similarly named media assets, then “combine them” | Missing | selection discipline, ambiguity handling |

### Group 2: Identity And Selection Scenarios

| Scenario | Current coverage | Controlling seam |
| --- | --- | --- |
| wrong asset-id class in audio slot | Partial | plan validation, planner discipline |
| `blogasset_*` misuse in non-visual slots | Partial | validation, planner discipline |
| chart or graph reused later without explicit promotion | Missing | continuity path, transform discipline |
| conflicting aliases across image, chart, graph, and video kinds | Missing | canonicalization and discovery |

### Group 3: Route And Recovery Scenarios

| Scenario | Current coverage | Controlling seam |
| --- | --- | --- |
| browser compose reroutes to deferred with preserved failure semantics | Partial | browser/deferred contract preservation |
| direct deferred-only compose from the start | Missing | route selection and worker path |
| reload during running compose job | Missing | persisted job state and UI rehydration |
| completed compose after missed SSE event | Missing | snapshot recovery and timeline state |

### Group 4: Truthfulness Scenarios

| Scenario | Current coverage | Controlling seam |
| --- | --- | --- |
| repeated retry yields one logical workflow track | Partial | job-card succession and dedupe rendering |
| earlier failed attempts become superseded after success | Partial | system card rendering |
| system says it reused assets when it actually regenerated | Missing | narration and continuity evidence |
| system retries blindly without diagnosing prior failure | Partial | job-status tool usage and retry behavior |

## Existing Coverage Map

The current Phase 8 baseline should be treated as follows.

### Covered

- browser runtime can execute a valid compose result and render coherent media
  cards in `tests/browser-ui/ffmpeg-browser-runtime.spec.ts`
- live media harness workflows can produce several playable video outputs in
  `tests/browser-ui/media-live-workflows.spec.ts`
- same-turn attached-image-plus-audio planner composition is covered in
  `tests/browser-ui/media-compose-planner-eval.spec.ts`
- deterministic preflight already classifies several readiness failures in
  `src/lib/media/compose-media-preflight.ts`

### Partial

- repeated governed reuse is acknowledged but not yet a mandatory browser-level
  gate
- route fallback and deferred composition exist, but continuity and failure
  semantics are not uniformly asserted end to end
- asset-id discipline is documented and partly tested, but still not covered as
  a holistic continuous-chat scenario
- job dedupe and retry behavior exist at the unit level without full UI truth
  coverage

### Missing

- long-lived conversation follow-ups that depend on reusing earlier generated
  assets rather than same-turn attachments
- ambiguity-heavy conversations with many prior media assets and overlapping
  labels
- reload, missed-event, and post-retry continuity flows for media jobs
- planner truthfulness checks that distinguish reuse from regeneration in later
  turns

### Misleading If Treated As Full Coverage

- the media lab harness proves explicit asset binding and runtime correctness,
  but not real chat continuity
- chart and graph workflows in the harness prove pre-rasterized image inputs,
  not later-turn chart or graph reuse through the main planner
- same-turn planner attachment coverage is not a substitute for later-turn
  continuity coverage inside one long-lived thread

## Current QA Grounding Snapshot

The current codebase already grounds some Phase 8 assumptions more strongly
than the initial draft implied, but it also leaves several key package gates
entirely unimplemented.

### Confirmed Current Coverage

- `src/hooks/chat/chatSendPolicy.ts` still drops `tool_call` and `tool_result`
  parts from backend replay history, so the traced continuity seam is present
  in shipping code rather than hypothetical
- `src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts` and
  `src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts`
  already ignore superseded jobs and prefer the deferred replacement when a
  synthetic browser `compose_media` job is superseded, so supersession support
  exists at the progress-strip layer
- `src/lib/jobs/compose-media-deferred-job.test.ts` already covers deduped
  active compose reuse at the queue boundary, so `dedupe_same_plan` is not
  fully missing; it is unit-covered but not yet browser- or conversation-level
  proof
- `tests/browser-ui/ffmpeg-browser-runtime.spec.ts` already covers browser
  fallback to deferred enqueue and verifies queued server-state rewriting for
  `compose_media`, so route fallback is partially grounded in browser tests
- `tests/browser-ui/deferred-blog-jobs.spec.ts` already proves reload
  continuity for deferred blog jobs, which means the product has an adjacent
  recovery pattern but not a media-specific one

### Confirmed Current Gaps

- no Phase 8 browser specs currently exist at
  `tests/browser-ui/media-continuity-faults.spec.ts` or
  `tests/browser-ui/media-recovery-faults.spec.ts`
- no deterministic Phase 8 eval currently exists at
  `tests/evals/media-fault-induction.test.ts`
- no orchestration entry point currently exists at
  `scripts/run-phase-8-media-faults.ts`
- no current browser spec exercises later-turn “combine them” reuse through the
  real continuous chat surface after prior generated media already exists
- no current browser spec exercises media reload continuity or missed-event
  snapshot recovery the way `deferred-blog-jobs.spec.ts` does for blog jobs
- `src/frameworks/ui/chat/plugins/system/resolve-system-card.ts` currently
  decides only whether a failed job should render as a shared error card or a
  media failure card; it does not provide the workflow-track or supersession
  semantics that Phase 8 truthfulness scenarios need

### Confirmed Current Partials That Need Better Package Language

- asset-id discipline is stronger than “unvalidated” because
  `src/lib/media/ffmpeg/media-composition-plan.ts` already enforces canonical
  asset-id format through `validateMediaCompositionAssetReferences(...)`, but
  it still does not make later-turn audio-slot misuse a fully solved product
  problem because the browser- and planner-level continuity paths remain
  uncovered
- supersession is stronger than “missing” because the progress strip already
  respects `supersededByJobId`, but the conversation-card layer still lacks a
  corresponding end-to-end truthfulness contract
- route recovery is stronger than “missing” because the browser runtime tests
  already cover fallback to deferred for `compose_media`, but those tests are
  still mocked runtime-path checks rather than one long-lived conversation
  continuity proof

### Current Phase 8 Bottom Line

The Phase 8 concept is grounded by real code and adjacent tests, but the
package still lacks the central thing Phase 8 is supposed to provide:

- a required gate for later-turn media continuity in one long-lived
  conversation
- a required gate for media-specific reload and missed-event recovery
- a required gate for conversation-level truthfulness around retries,
  supersession, and reuse-versus-regeneration

## First Three Scenarios To Implement Immediately

These are the highest-value scenarios because together they cover the most
expensive current blind spots.

### Scenario 1: Later-Turn “Combine Them” Reuse Without Regeneration

Flow:

1. generate a chart in chat
2. generate narration audio in chat
3. send a later-turn follow-up such as “now combine them into a video”
4. assert the final plan reuses the earlier governed assets or asks for
   clarification
5. assert no new chart or audio asset was generated before composition

Why first:

- this is the exact live failure class already observed
- it tests the continuity seam rather than only the runtime
- it reveals whether the product needs a structured media working-set handoff

### Scenario 2: Ambiguous Mixed-Asset Conversation With Overlapping Labels

Flow:

1. create or upload multiple similarly named image, chart, graph, and audio
   assets in the same long-lived conversation
2. ask for a follow-up compose request using vague language such as “use the
   launch chart with the latest narration”
3. assert the system either selects the right explicit candidate set or asks
   for clarification
4. assert it does not silently bind the wrong kind or wrong asset

Why second:

- this is the fastest way to break unsafe discovery assumptions
- it turns a broad mixed pool into a mandatory product gate

### Scenario 3: Reload And Missed-Event Recovery During Active Compose

Flow:

1. start a media composition that runs long enough to observe progress
2. reload the page or drop the live event stream
3. assert the conversation and media card recover the active or terminal state
   coherently from persisted state
4. assert the final artifact and status remain truthful after recovery

Why third:

- continuity is not only asset reuse; it is also state survival
- this will reveal whether the system can be trusted outside a clean browser
  session

## Initial Phase 8 Rules

### Continuity Before Rediscovery Rule

The product should try deterministic continuity before broad rediscovery or
regeneration.

Initial rule:

- selected or otherwise explicit prior assets win first
- continuity-safe prior outputs win before broad discovery search
- broad discovery and regeneration become fallback behavior, not the default

### Same-Turn Is Not Enough Rule

Same-turn attachment success does not count as continuity proof.

Initial rule:

- every critical media follow-up class must be validated in a later turn after
  prior assets and prior job state already exist

### Route Truthfulness Rule

Route fallback and recovery must preserve the meaning of the failure.

Initial rule:

- reroute cannot flatten continuity, source, or identity faults into generic
  worker errors
- the user-visible surface should still reflect what actually happened

### Recovery Is Product Behavior Rule

Reload, missed live events, retry, and dedupe are part of the shipped media
product rather than admin-only diagnostics.

Initial rule:

- recovery scenarios are required package gates rather than optional later
  checks

### Misleading Success Rule

A passing media artifact is not sufficient if the path to it was misleading.

Initial rule:

- Phase 8 should fail if the system achieves a final artifact through silent
  regeneration when the user asked for reuse
- Phase 8 should fail if the UI leaves contradictory workflow state visible
  after retries or dedupe resolution

## Implementation Slices

### Slice 1: Formalize The Phase 8 Fault Matrix

Tasks:

- define the required continuity, identity, route, recovery, and truthfulness
  scenario groups
- map each required scenario to its controlling code seam and evidence bundle
- mark each scenario as covered, partial, missing, or misleading based on the
  current repo state

Acceptance criteria:

- the package names the minimum adversarial scenarios required for continuity
  readiness
- the current gap state is explicit rather than implied

### Slice 2: Add Continuous-Conversation Reuse Evals

Tasks:

- add later-turn reuse scenarios for chart, graph, audio, image, and video
  assets
- assert reuse-versus-regeneration truthfulness
- retain enough evidence to explain why a later turn reused, regenerated, or
  asked for clarification

Acceptance criteria:

- later-turn media reuse is a real gate rather than a live bug source

### Slice 3: Add Ambiguity And Identity Fault Evals

Tasks:

- create ambiguity-heavy conversations with overlapping labels across kinds
- add strict assertions for invalid id classes, wrong-kind slot binding, and
  required transform or lineage behavior

Acceptance criteria:

- the system no longer silently binds the wrong asset under mixed-pool pressure

### Slice 4: Add Recovery And Route Pressure Evals

Tasks:

- add reload, missed-event, reroute, deferred-only, retry, and dedupe scenarios
- assert preserved failure semantics and coherent final UI state

Acceptance criteria:

- recovery and route drift become first-class package gates

### Slice 5: Unify Phase 8 Evidence

Tasks:

- add one Phase 8 orchestration entry point for adversarial deterministic and
  browser-level media continuity tests
- emit durable release evidence that records scenario status and retained
  repro artifacts

Acceptance criteria:

- one command can represent the package’s Phase 8 media fault gate

## Focused Validation Plan

Minimum validation expected for Phase 8:

- deterministic continuity and identity tests prove that later-turn reuse and
  invalid-id scenarios are caught before live media execution depends on them
- browser-level continuity tests prove later-turn media follow-ups do not
  silently regenerate or bind the wrong assets
- browser-level recovery tests prove reload and missed-event continuity for
  running and completed media jobs
- route-pressure tests prove fallback and deferred paths preserve truthful
  failure detail
- release evidence summarizes both induced failures and resolved reruns

Recommended focused suites and commands:

- target-state commands after the new Phase 8 suites exist:
  `npx vitest run tests/evals/media-fault-induction.test.ts`
- target-state commands after the new Phase 8 suites exist:
  `npx playwright test tests/browser-ui/media-continuity-faults.spec.ts`
- target-state commands after the new Phase 8 suites exist:
  `npx playwright test tests/browser-ui/media-recovery-faults.spec.ts`
- target-state command after the new Phase 8 runner exists:
  `node scripts/run-phase-8-media-faults.ts`

## Completion Criteria

Phase 8 is complete when all of the following are true:

- the package has one explicit media fault-induction and continuity-proof phase
- the package can name the current state of each required continuity and
  recovery scenario as covered, partial, missing, or intentionally guarded
- later-turn media reuse in one long-lived conversation is validated directly
  rather than inferred from same-turn attachment success
- ambiguity-heavy mixed-asset scenarios are part of the required gate
- reload, missed-event, retry, reroute, and deferred-only media behaviors are
  validated as product behavior rather than incidental admin diagnosis
- induced failures produce retained evidence and rerun-backed closeout
- one Phase 8 gate can show whether the continuous-chat media product is
  genuinely trustworthy under pressure
