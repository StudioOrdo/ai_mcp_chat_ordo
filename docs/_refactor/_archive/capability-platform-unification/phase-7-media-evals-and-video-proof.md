# Phase 7 Implementation Spec — Media Evals And Video Proof

## Objective

Add an intensive eval phase that proves the unified platform can assemble the
media types it claims to support and can reliably produce playable video
outputs through the shipped runtime paths.

Phase 7 also needs to close the discovery gap exposed by current live failures:
the system already has broad media listing, but composition still lacks a
governed, kind-aware discovery and selection path that can safely choose the
right asset for each clip slot.

This phase is not about inventing a new media architecture. It is about taking
the media-generation and media-assembly behavior already present in the
codebase and putting it behind explicit, repeatable, evidence-producing evals
that prove the system works end to end.

That work is incomplete if Phase 7 only adds more evals while leaving
composition to resolve image, video, audio, chart, and graph references from a
single untyped candidate pool.

The first Phase 7 question should be:

- can the system prove, with artifacts and debug evidence, that it can accept
  governed or uploaded media inputs, assemble the expected intermediate media
  types, and deliver a final playable video through the same user-facing
  surfaces the product actually ships?

The second Phase 7 question should be:

- can the system deliberately stress ambiguous media discovery, mixed asset
  pools, route selection, and runtime recovery paths strongly enough to expose
  real faults before release, and can the phase require those faults to be
  explained and resolved rather than merely recorded?

## Phase 6 Handoff

By the end of Phase 6, the package should have one converged platform surface
for operator interactions, agent execution, timeline inspection, and
execution-planning ownership.

Phase 7 builds on that convergence instead of reopening it.

The handoff assumptions are:

- the canonical platform seams already exist and remain the right abstraction
  boundaries
- the media runtime already spans browser FFmpeg, server FFmpeg, deferred-job
  execution, governed asset serving, and user-facing artifact rendering
- the codebase already contains live browser eval scaffolding, media debug
  helpers, and release evidence patterns that can be promoted into a
  first-class package phase
- remaining risk is less about missing abstractions and more about proving the
  assembled media system is correct across real workflows, inputs, and runtime
  paths
- one remaining correctness gap sits directly on the path to that proof:
  `compose_media` still depends on broad conversation-media discovery plus
  alias-based canonicalization that does not enforce clip-kind compatibility at
  resolution time

## Current Code Grounding

The codebase already contains substantial media-eval infrastructure. Phase 7
should use that as its starting point.

### Existing End-To-End Media Eval Surface

- `tests/browser-ui/media-compose-eval.spec.ts` already runs live browser
  workflows that prove generated-image plus TTS, uploaded-image plus TTS, and
  uploaded-clip concat scenarios
- those scenarios already assert final artifact visibility, browser playback,
  downloaded asset inspection, video stream presence, audio stream presence,
  and non-silent output through `ffprobe` and `ffmpeg`
- the same spec already writes debug bundles under
  `test-results/media-compose-eval-artifacts/`

### Existing Media Eval Helper Surface

- `tests/browser-ui/helpers/media-eval.ts` already provides reusable
  instrumentation for browser diagnostics, upload fixtures, invocation
  evidence, manifest capture, authenticated downloads, playback checks,
  `ffprobe`, and audio-volume validation
- that helper already captures the core evidence Phase 7 needs: runtime route
  usage, invocation ids, job ids, asset ids, rendered invocation cards, and
  final media probes

### Existing Runtime And QA Surfaces

- `scripts/run-sprint-7-qa.ts` already validates browser FFmpeg, server
  FFmpeg, media composition plan contracts, job capability registry behavior,
  media render card rendering, user-files serving, and build health
- `scripts/run-phase-11-tool-invocation-qa.ts` already defines live-media
  passing rules for playable video, audible video, governed asset reuse, and
  truthful assistant narration under runtime state
- `scripts/media-worker-server.ts` and the dev runtime already expose the
  worker path used by remote or deferred media execution

### Existing Media Discovery Surface

- `src/core/use-cases/tools/list-conversation-media-assets.tool.ts` already
  exposes reusable governed media assets for the active conversation and can
  optionally filter by `kinds`
- `src/lib/media/media-composition-asset-identity.ts` already builds
  composition canonicalization options from transcript parts,
  `list_conversation_media_assets` payloads, and governed user files
- `src/lib/media/ffmpeg/media-composition-plan.ts` already canonicalizes clip
  asset references through alias bindings and discovered asset candidates

### Existing Known Discovery Constraints

- `list_conversation_media_assets` currently returns a mixed asset pool by
  default unless the caller explicitly narrows `kinds`
- `canonicalizeMediaCompositionPlanWithRepairs()` currently resolves aliases to
  asset ids without preserving clip-kind compatibility during the repair step
- current live failures show that this is not theoretical: image clip slots can
  end up bound to prior video or chart assets and then fail late in compose
  preflight rather than being prevented at discovery time

## Phase 7 QA Findings

The current Phase 7 direction is strong on happy-path proof, but it was still
too weak in three areas when compared against the real system behavior:

1. it proved successful media assembly paths more clearly than it stressed the
  ambiguous or failure-prone discovery paths that actually break in practice
2. it described truthful failure classification, but it did not yet require a
  systematic reproduce-explain-fix-rerun loop for the failures the phase is
  expected to uncover
3. it covered planner and runtime route proof, but it did not yet explicitly
  stress saturation, mixed-media ambiguity, retry pressure, or repeated
  governed-asset reuse in the same conversation

Phase 7 should therefore be treated as both a proof phase and a fault-finding
phase. It must not stop at demonstrating that media works when the inputs are
clean. It must stress the system until it exposes the kinds of problems we are
already seeing in live use, then require those problems to be explained and
driven to resolution.

## Grounded 5 Whys

### System 5 Whys

1. Why does the current system still produce serious media failures even though
  core media generation and composition paths already exist?
  Because the system is better at proving individual happy-path capabilities
  than it is at governing the end-to-end selection, routing, and reuse of the
  assets those capabilities produce.
2. Why is that end-to-end governance weak?
  Because discovery, canonicalization, planning, composition, and proof have
  grown as adjacent surfaces rather than one tightly stress-tested contract.
3. Why did those surfaces drift apart?
  Because most validation concentrated on proving a route can succeed rather
  than on proving ambiguous, repeated, or adversarial inputs cannot silently
  corrupt the route.
4. Why was that validation bias allowed?
  Because media readiness was still being treated as a late-stage proof
  problem instead of a system-integrity problem spanning discovery, planning,
  execution, and recovery.
5. Why does Phase 7 need to change that?
  Because without a phase dedicated to stress, diagnosis, and resolution, the
  package can claim convergence while leaving the most expensive media bugs to
  surface only in live operator or user workflows.

### Media System 5 Whys

1. Why did `compose_media` fail in the real traced conversation?
  Because an image clip slot ended up bound to a governed asset whose real
  kind was not image.
2. Why did the wrong asset kind get into the plan?
  Because asset resolution was working from a broad mixed candidate pool and
  alias repair could rewrite references without preserving clip-kind
  compatibility.
3. Why was a broad mixed pool allowed to act as the final resolution step?
  Because `list_conversation_media_assets` is intentionally general-purpose,
  but composition-specific narrowing was not enforced strongly enough before
  canonicalization.
4. Why was the issue detected late instead of early?
  Because the hard kind mismatch check happens in compose preflight, after the
  bad plan has already been built and queued.
5. Why must Phase 7 stress this specifically?
  Because this is exactly the kind of system fault that happy-path media proof
  will miss unless the phase forces mixed-kind conversations, ambiguous asset
  labels, governed reuse pressure, and repeated retry scenarios.

### Existing Known Media-Eval Constraints

- the checked-in upload fixture at `public/ordo-avatar.png` is the stable live
  upload source for browser media workflows
- the planner live eval already documented one real failure mode: a short
  narrated video request currently routes to `browser_short_explainer` and can
  fail if the prompt does not satisfy that mode's three-to-five visual beat
  requirement
- successful live media runs already produce artifact manifests and generated
  videos under `test-results/media-e2e-artifacts/` and
  `test-results/media-compose-eval-artifacts/`

## Current Problem Statement

The codebase can already generate and assemble media, but the implementation
package still lacks a dedicated phase that proves this behavior comprehensively
enough to support the platform claim.

The remaining gap is not a lack of raw tests. The gap is that the package does
not yet define one explicit phase whose job is to prove:

1. the system can accept and govern the media input types the product exposes
2. the system can discover and select governed media inputs with clip-kind,
  conversation, and lineage safety before composition begins
3. the system can assemble those inputs into valid intermediate and final
   outputs
4. the system can produce a final video that is genuinely playable and, when
   required, audibly non-silent
5. the proof is repeatable, artifact-backed, and tied to the same runtime
   surfaces that ship in production-like flows

Without that proof phase, the platform package can claim convergence while
still leaving the highest-risk media workflows validated only informally or in
isolated pockets.

Without a stress-and-resolution layer inside that phase, the package can also
pass media proof while still failing under repeated governed reuse,
mixed-modality ambiguity, or recovery pressure.

## Scope

### In Scope

- define a package-level eval phase for cross-media assembly and final-video
  proof
- define the minimum governed media-discovery contract required for safe
  composition
- define the minimum stress matrix required to expose ambiguity, saturation,
  retry, and recovery faults in media discovery, planning, and execution
- standardize the live media scenarios that must pass before the package can
  claim video-generation readiness
- cover generated media, uploaded media, governed media reuse, clip concat,
  narration-backed video, and final artifact rendering
- cover typed asset discovery for composition slots so image, video, audio,
  chart, and graph references are not resolved from one unsafe mixed pool
- require evidence bundles that capture browser diagnostics, invocation
  evidence, workflow status, manifest output, and downloaded media probes
- add planner or routing evals that prove the system chooses a valid assembly
  mode for representative media prompts
- define deterministic preflight suites and live suites that work together
  rather than separately
- require a reproduce-explain-fix-rerun workflow for critical failures the
  phase intentionally surfaces

### Out of Scope

- redesigning the media runtime
- replacing the current FFmpeg browser or server executors
- changing capability semantics solely to make an eval easier to pass
- inventing synthetic media workflows that do not match product behavior
- broad UX redesign of media surfaces unrelated to testability or evidence
- building a generic media search product surface unrelated to composition
  safety

## Canonical Files To Touch

### Existing Files

- `tests/browser-ui/media-compose-eval.spec.ts`
- `tests/browser-ui/media-compose-planner-eval.spec.ts`
- `tests/browser-ui/helpers/media-eval.ts`
- `tests/browser-ui/ffmpeg-browser-runtime.spec.ts`
- `scripts/run-sprint-7-qa.ts`
- `scripts/run-phase-11-tool-invocation-qa.ts`
- `scripts/media-worker-server.ts`
- `src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts`
- `src/lib/media/server/compose-media-worker-runtime.test.ts`
- `src/lib/media/ffmpeg/media-composition-plan.test.ts`
- `src/lib/media/ffmpeg/media-execution-router.test.ts`
- `src/core/use-cases/tools/compose-media.tool.test.ts`
- `src/app/api/chat/jobs/route.test.ts`
- `src/frameworks/ui/chat/plugins/custom/MediaRenderCard.test.tsx`
- `src/app/api/user-files/[id]/route.test.ts`

### Potential New Files

- `tests/browser-ui/media-compose-matrix-eval.spec.ts`
- `tests/browser-ui/media-video-proof-regression.spec.ts`
- `scripts/run-phase-7-media-evals.ts`
- `release/phase-7-media-eval-evidence.json`

The exact filenames can move, but the Phase 7 ownership boundary should stay
focused on eval orchestration, proof artifacts, and acceptance gates.

## Target Phase 7 Shape

Phase 7 should make one package-level claim credible:

the unified platform can assemble supported media inputs into valid final media
outputs, including playable video, and can prove that with repeatable eval
evidence.

That claim should be expressed through four proof surfaces.

Before those proof surfaces are credible, Phase 7 also needs one correctness
surface for governed discovery.

Before Phase 7 can be considered complete, it also needs one stress surface
for systemic failure discovery and one closure surface for resolution.

### Correctness Surface 0: Governed Media Discovery

Phase 7 should prove that composition does not resolve clip references through
an unsafe mixed asset pool.

Minimum requirements:

- discovery for composition is kind-aware at the clip-slot boundary
- conversation-scoped asset lookup remains the default for governed user-file
  reuse
- cross-conversation or cross-lineage reuse requires an explicit supported path
  rather than silent alias repair
- alias-based repairs cannot rewrite an image clip to a video, chart, or graph
  asset id
- charts and graphs can still be intentionally promoted into image-backed
  compose inputs, but only through an explicit derived-image materialization or
  typed server-preparation path

### Stress Surface 0.5: Media Fault Discovery

Phase 7 should prove that the system can survive or truthfully reject the
failure-prone conditions that already exist in the real product surface.

Minimum required stress conditions:

- mixed conversations containing image, video, chart, graph, and audio assets
  with overlapping or similar aliases
- repeated governed-asset reuse across multiple compose attempts in the same
  conversation
- retries after an initial failed composition
- planner prompts that are near the route boundary and likely to reveal
  ambiguous mode selection
- browser, deferred-job, and server-execution scenarios that run under real
  diagnostic capture rather than synthetic mocks alone

### Closure Surface 0.75: Reproduce, Explain, Resolve

Phase 7 should not only discover critical faults. It should define what must
happen after they are discovered.

Minimum rule:

- reproduce the failure with retained artifacts
- explain the failure using the actual governed state, route, plan, and media
  evidence
- fix the root cause or explicitly classify it as an intentional guardrail
- rerun the exact stress scenario to prove the defect is resolved or the
  guarded-failure behavior is now truthful and stable

### Proof Surface 1: Input Coverage

Phase 7 should prove the system can correctly ingest and govern the media types
already exposed in the product flow:

- generated image inputs
- uploaded image inputs
- uploaded video clip inputs
- narration or TTS audio inputs
- governed media artifacts reused as composition inputs
- charts and graphs that must be promoted into image-backed composition inputs

### Proof Surface 2: Assembly Coverage

Phase 7 should prove the system can assemble media through the composition
paths it already ships:

- image plus narration to video
- uploaded image plus narration to video
- existing video clip concat to combined video
- browser-runtime video assembly where `browser_wasm` is expected
- server or worker media execution where browser execution is not the chosen
  path
- repeated compose attempts in one conversation after prior media artifacts
  already exist and can influence governed discovery

### Proof Surface 3: Final Video Proof

Phase 7 should prove final video outputs are not just present, but usable.

Minimum proof for a successful video scenario:

- final artifact link is visible in the product surface
- rendered video element is playable in the browser
- downloaded file contains at least one video stream
- downloaded file contains audio when the scenario expects narration or sound
- volume detection proves the required audio output is not silent
- manifest and debug bundle identify the runtime route that produced the asset

### Proof Surface 4: Planner And Routing Proof

Phase 7 should prove the system selects a valid assembly mode for representative
media prompts instead of only validating execution after the route is already
chosen.

That means the planner eval should cover:

- short narrated video prompts
- prompts that should route to browser video assembly
- prompts that should require enough visual beats or assets before execution
- prompts that should fail early with truthful guidance instead of ambiguous
  runtime failure
- prompts that require governed-asset discovery to return typed image or audio
  candidates rather than a mixed pool
- prompts that intentionally pressure route boundaries so the phase can detect
  planner drift rather than only confirm stable happy paths

## Grounded Phase 7 Assumptions

- `tests/browser-ui/media-compose-eval.spec.ts` is already the best anchor for
  live product-surface media proof and should be expanded, not replaced
- `tests/browser-ui/helpers/media-eval.ts` already contains the evidence and
  diagnostics primitives needed for a package-level media proof phase
- the existing Sprint 7 QA script is a deterministic preflight gate and should
  remain the fast structural validation layer beneath live evals
- the existing Phase 11 QA script already contains strong passing rules that
  should be pulled forward into Phase 7 instead of being treated as isolated
  late-stage release logic
- planner evals should be explicit about known routing constraints and should
  distinguish between correct guarded failure and incorrect routing failure
- discovery for composition should be narrowed and governed rather than relying
  on the current broad mixed-kind listing surface alone
- Phase 7 should prove the system as it exists; it should not hide current
  planner limitations or rewrite prompts purely to manufacture success

## Initial Phase 7 Rules

### Live Evidence Rule

Every live media eval must write a debug bundle that can explain success or
failure without rerunning the entire suite.

Minimum bundle contents:

- browser diagnostics
- workflow status snapshots
- manifest output
- invocation evidence
- console errors and request failures
- final screenshot
- downloaded media probes for successful video scenarios
- discovery evidence for composition-driven scenarios, including the asset ids,
  asset kinds, and resolution path chosen for each filled clip slot
- failure reproduction context for stressed scenarios, including the full
  conflicting candidate set when governed discovery ambiguity is part of the
  fault

### Media Matrix Rule

Phase 7 should explicitly define the minimum required scenario matrix rather
than treating media eval as a single happy-path test.

Minimum matrix:

- generated image to narrated video
- uploaded image to narrated video
- governed artifact reuse into final video
- uploaded video concat into final video
- planner-selected short video scenario
- typed governed discovery scenario where the conversation contains mixed asset
  kinds and compose must still choose the right kind per slot

Minimum stress extensions:

- repeated compose attempts in the same conversation after prior outputs exist
- governed discovery ambiguity where labels or prompts overlap across kinds
- retry after terminal failure to prove either corrected behavior or stable
  truthful rejection
- route-boundary prompt variants that distinguish broken routing from guarded
  failure

### Typed Discovery Rule

If `compose_media` depends on governed asset discovery, the discovery path must
return or enforce the right kind for the current slot before the plan is
queued.

Initial rule:

- image clip slots can only resolve to image-compatible governed assets or
  explicit chart or graph promotion paths
- audio clip slots can only resolve to audio assets
- video clip slots can only resolve to video assets
- broad `list_conversation_media_assets` output is not sufficient by itself as
  the last resolution step for composition
- alias repair must preserve clip-kind compatibility

### Truthful Failure Rule

If a scenario fails because the planner or runtime correctly rejects an
insufficient prompt or asset set, the eval should capture and classify that as
an expected guarded failure rather than hiding it as a flaky test.

Initial rule:

- distinguish "invalid prompt or missing beat coverage" from "runtime broken"
- distinguish discovery ambiguity, planner drift, runtime breakage, and
  intentional guardrails from one another
- require failure artifacts that prove why the guard triggered
- only treat unexpected routing or silent broken outputs as regressions

### Resolution Loop Rule

Critical failures discovered by Phase 7 stress scenarios are not complete when
they are merely classified.

Initial rule:

- every critical regression must produce a retained repro artifact bundle
- every retained repro must map to a root-cause explanation grounded in
  governed state, plan state, route state, or runtime state
- every fixed regression must be rerun through the same stressed scenario
- if a failure remains intentionally guarded, the phase must prove the guard is
  explicit, stable, and user-truthful

### Stress Before Confidence Rule

Phase 7 should not accept a media system as ready solely because the happy-path
matrix passes.

Initial rule:

- stress ambiguous discovery before claiming governed reuse is ready
- stress route boundaries before claiming planner readiness
- stress repeated and recovery-driven composition before claiming execution
  robustness
- treat high-signal stressed failures as a stronger readiness indicator than a
  larger number of unchallenging happy-path passes

### Preflight And Live Layering Rule

Phase 7 should keep deterministic suites and live suites separate but tied to
one acceptance story.

Initial rule:

- deterministic unit and integration suites prove contracts, routing logic,
  registry behavior, and serving behavior quickly
- live browser suites prove end-to-end media assembly and final video validity
- release evidence should report both layers together

## Implementation Slices

### Slice 1: Formalize The Phase 7 Media Eval Matrix

Tasks:

- define the required scenario matrix and its expected runtime route, artifact
  kind, and evidence bundle
- define the minimum discovery-safe scenario set and expected slot-level asset
  kind guarantees
- define the minimum stress scenario set for ambiguity, repeated governed
  reuse, retry, and route-boundary prompts
- promote existing workflow 1, workflow 2, and workflow 6 scenarios into the
  official package phase definition
- add explicit governed-asset-reuse and planner-driven scenarios where they
  are not already first-class

Acceptance criteria:

- the package names the minimum scenarios required for media readiness
- each scenario defines required inputs, expected outputs, and expected proof
  artifacts
- scenario coverage spans image, audio, uploaded clips, and final video
- scenario coverage includes both proof scenarios and deliberate
  fault-discovery scenarios

### Slice 2: Add Governed Typed Discovery For Composition

Tasks:

- define the minimum typed media-discovery contract required by
  `compose_media`
- add or tighten composition-facing discovery so slot resolution remains aware
  of clip kind, conversation scope, and supported lineage rules
- prevent alias-based canonicalization from rewriting clip references across
  incompatible media kinds
- preserve supported chart and graph reuse by routing them through explicit
  image-materialization or other typed preparation paths rather than accidental
  mixed-pool resolution
- add deterministic stressed cases that prove mixed candidate pools do not
  collapse image, video, chart, and graph aliases into the wrong slot binding

Acceptance criteria:

- image, audio, and video clip slots resolve through kind-compatible governed
  discovery
- mixed conversation asset pools no longer allow image slots to bind to video,
  chart, or graph ids by alias collision
- supported chart and graph reuse remains explicit and testable
- deterministic coverage proves the discovery contract before live media evals
  depend on it

### Slice 3: Add Stress And Recovery Evals

Tasks:

- add stressed governed-discovery scenarios that intentionally create
  overlapping aliases and mixed asset pools
- add repeated-compose and retry scenarios that run after prior outputs exist
  in the same conversation
- add recovery-oriented scenarios that prove failure artifacts are sufficient
  to rerun and resolve the defect path

Acceptance criteria:

- Phase 7 can deliberately surface the class of media fault already observed in
  live use
- stressed scenarios produce artifact bundles sufficient for root-cause
  analysis without ad hoc local reproduction
- rerunning the stressed scenario after a fix becomes part of the phase’s
  normal closeout loop

### Slice 4: Strengthen Live Video Proof

Tasks:

- expand the live browser media evals so every required video scenario proves
  browser playback, downloaded file inspection, stream presence, and audio
  presence when applicable
- ensure every passing live scenario records invocation evidence and runtime
  route selection in the debug bundle
- add explicit assertions for governed artifact rendering and authenticated
  file serving where needed

Acceptance criteria:

- every required video scenario proves playable final video
- every audio-required video scenario proves non-silent audio
- every live scenario emits an inspectable debug bundle and manifest evidence

### Slice 5: Add Planner And Routing Evals

Tasks:

- formalize planner eval coverage for short narrated video requests and other
  representative media prompts
- classify known guarded failures separately from broken route selection
- record planner outcomes and failure-context artifacts in a stable location

Acceptance criteria:

- planner behavior for representative media prompts is covered by explicit
  evals
- guarded failures and broken-routing regressions are distinguishable from one
  another
- failure artifacts are sufficient to diagnose prompt-shape or route-selection
  issues without rerunning locally first

### Slice 6: Unify Deterministic And Live QA Entry Points

Tasks:

- add one Phase 7 orchestration entry point that runs deterministic preflight
  media QA plus the live browser eval layer when live media gates are enabled
- keep environment-gated live execution explicit
- write release evidence summarizing scenario results and proof artifacts

Acceptance criteria:

- one command or script can represent the full Phase 7 media-proof gate
- deterministic and live evidence are reported together
- skipped live media execution is explicit rather than silently omitted

## Focused Validation Plan

Minimum validation expected for Phase 7:

- deterministic discovery and canonicalization suites prove slot-safe governed
  asset selection before live media execution begins
- deterministic stress suites prove ambiguous discovery and repeated governed
  reuse do not silently corrupt composition inputs
- deterministic media-runtime and contract suites remain green
- live media compose evals pass for the required scenario matrix when live
  media gates are enabled
- planner media evals either pass or classify guarded failures truthfully with
  artifacts
- critical stressed failures are reproduced, explained, fixed or intentionally
  guarded, and rerun before the phase is considered closed
- release evidence summarizes both deterministic and live layers

Recommended focused suites and commands:

- `node scripts/run-sprint-7-qa.ts --tests-only`
- `npx playwright test tests/browser-ui/media-compose-eval.spec.ts`
- `npx playwright test tests/browser-ui/media-compose-planner-eval.spec.ts`
- `node scripts/run-phase-11-tool-invocation-qa.ts`

## Completion Criteria

Phase 7 is complete when all of the following are true:

- the package has an explicit media-eval phase rather than scattered media
  proof across unrelated scripts and specs
- the package defines and validates a governed typed-discovery path for
  composition rather than relying on broad mixed-kind asset listing alone
- the package uses stressed scenarios to expose ambiguity, recovery, and route
  weaknesses rather than relying on happy-path proof alone
- the required scenario matrix proves image, audio, uploaded clip, governed
  asset reuse, and final video assembly behavior
- every required final-video scenario proves playable output and, when
  expected, audible non-silent output
- planner evals distinguish correct guarded failures from broken routing or
  execution regressions
- critical stressed failures are either resolved and rerun successfully or are
  reclassified as explicit truthful guardrails with stable evidence
- one Phase 7 gate can produce durable evidence showing whether the media
  system is genuinely ready
