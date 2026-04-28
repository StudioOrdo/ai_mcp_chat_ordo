# Phase 9 Implementation Spec — Shared Media Materialization And Live Runtime Proof

## Objective

Close the gap exposed after Phase 8: chart and graph-backed composition inputs
must be promoted into governed image assets in every execution lane that can
produce final video, not only in the browser runtime.

Phase 9 exists to make one claim credible:

- a media composition request that is valid in the product remains valid across
  browser and worker execution targets because source-kind promotion is a
  shared preflight concern, not an accidental browser-only behavior

## Why Phase 8 Was Not Enough

Phase 8 proved continuity and failure truthfulness for one long-lived media
conversation surface.

It did not yet prove that the same governed chart or graph source would remain
composable once execution moved into the deferred worker lane.

That left one expensive integrity hole:

- browser compose could succeed because it rasterized chart and graph sources
- deferred or remote compose could reject the same plan before any shared
  materialization ran

The result was a platform that looked continuity-safe from the chat surface but
still diverged once the execution target changed.

## Current Grounding

The codebase now contains the right building blocks for a real fix.

### Shared And Worker Surfaces

- `src/lib/media/server/compose-media-plan-materialization.ts` can rehydrate
  stored chart and graph sources, rasterize them to PNG, and persist governed
  derived image assets with lineage metadata
- `src/lib/media/server/compose-media-worker-runtime.ts` is the deferred and
  remote worker execution seam that must receive executable image and video
  clips rather than raw chart and graph sources
- `src/lib/media/ffmpeg/media-composition-plan.ts` now distinguishes between
  structural plan validity and executable-plan validity so model-facing and
  preflight-facing validation do not fight each other
- `src/hooks/chat/composeMediaMaterializationCore.ts` and
  `src/hooks/chat/useBrowserCapabilityRuntime.ts` still own the browser lane,
  but now validate the post-materialization executable plan explicitly

### Live Proof Surfaces

- `tests/browser-ui/media-live-workflows.spec.ts` exercises real media
  workflows with downloadable artifacts and playback validation
- `tests/browser-ui/media-compose-eval.spec.ts` exercises the product-facing
  composition path end to end
- `tests/browser-ui/media-compose-planner-eval.spec.ts` captures plan and
  artifact evidence from the real chat workflow
- `scripts/run-phase-7-media-evals.ts` already provides a useful pattern for a
  release-evidence runner that combines deterministic and live proof

## Phase 9 Requirements

Phase 9 should be considered complete only when all four of these are true.

### 1. Shared Promotion Proof

- chart and graph visual clips are accepted as structurally valid composition
  inputs before materialization
- executable validation still blocks raw chart and graph clips when promotion
  did not occur
- worker execution promotes governed chart and graph sources into governed
  derived image assets before readiness validation and FFmpeg execution begin

### 2. Route Parity Proof

- browser and worker lanes agree on what an executable composition plan is
- target selection cannot change a valid product request into an invalid one
  solely because chart or graph promotion was browser-only
- lineage metadata is preserved when derived images are created for compose

### 3. Live Workflow Proof

- live workflows with real keys still produce inspectable final videos after
  the shared materialization fix
- generated chart and graph scenarios remain part of the live workflow matrix
- planner-driven workflows retain plan snapshots, artifact metadata, playback
  validation, and audio validation where required

### 4. Release Evidence Proof

- one phase-specific script captures deterministic and live command outcomes
- evidence records whether live media credentials were enabled
- evidence bundles remain detailed enough to diagnose a route-specific failure
  without rerunning the whole matrix first

## Scope

### In Scope

- shared materialization proof for governed chart and graph composition inputs
- executable-plan validation parity across browser and worker execution lanes
- deterministic worker runtime tests for derived-image promotion and lineage
- live workflow proof using the real media harness with live keys when enabled
- release evidence generation for deterministic and live Phase 9 commands

### Out Of Scope

- migrating `compose_media` onto the factory DAG in this phase
- redesigning the FFmpeg execution stack
- replacing the existing media lab or planner eval surfaces

Phase 9 treats the dedicated compose worker lane as the canonical execution
surface that must be proven correct today. DAG integration can be evaluated
later only if compose-specific stage contracts are defined deliberately rather
than inferred from current factory semantics.

## Canonical Files

### Existing Files

- `src/lib/media/ffmpeg/media-composition-plan.ts`
- `src/lib/media/server/compose-media-plan-materialization.ts`
- `src/lib/media/server/compose-media-worker-runtime.ts`
- `src/hooks/chat/composeMediaMaterializationCore.ts`
- `src/hooks/chat/useBrowserCapabilityRuntime.ts`
- `src/lib/media/server/compose-media-plan-materialization.test.ts`
- `src/lib/media/server/compose-media-worker-runtime.test.ts`
- `src/lib/media/ffmpeg/media-composition-plan.test.ts`
- `tests/browser-ui/media-live-workflows.spec.ts`
- `tests/browser-ui/media-compose-eval.spec.ts`
- `tests/browser-ui/media-compose-planner-eval.spec.ts`

### New Files

- `scripts/run-phase-9-media-runtime-evals.ts`
- `release/phase-9-media-runtime-evidence.json`

## Validation Matrix

### Deterministic Commands

1. `npm run test -- src/lib/media/server/compose-media-plan-materialization.test.ts src/lib/media/server/compose-media-worker-runtime.test.ts src/lib/media/ffmpeg/media-composition-plan.test.ts`
2. `node_modules/.bin/tsx scripts/run-sprint-7-qa.ts --tests-only`
3. `node_modules/.bin/next build`

### Live Commands

1. `node_modules/.bin/playwright test tests/browser-ui/media-live-workflows.spec.ts`
2. `node_modules/.bin/playwright test tests/browser-ui/media-compose-eval.spec.ts`
3. `node_modules/.bin/playwright test tests/browser-ui/media-compose-planner-eval.spec.ts`

Live commands should run only when explicit live-key enablement is present.

## Passing Rules

- chart and graph clips cannot fail in the worker lane solely because they were
  not promoted before preflight
- executable validation must still reject raw chart and graph clips when a
  route bypasses materialization
- derived compose assets must preserve `derivativeOfAssetId` and, when
  available, `derivativeOfToolInvocationId`
- live workflows must continue to prove downloadable playable output and
  non-silent audio where required
- evidence files must show exactly which command failed before Phase 9 can be
  considered blocked or complete

## Immediate Follow-On Work

1. expand live proof with an explicit later-turn chart-plus-audio-to-video chat
   scenario once the current planner and workflow harnesses expose that path
   without brittle selector coupling
2. add an execution-inspection surface that exposes derived compose-asset
   lineage directly in operator diagnostics
3. revisit DAG integration only after compose-specific stage boundaries,
   checkpoints, and artifact semantics are specified explicitly
