# Media E2E Eval Program

## Goal

Define a comprehensive end-to-end evaluation program that validates all supported media-generation and media-composition flows in Studio Ordo, including golden paths, recoveries, and truthfulness after interruption.

The core objective is not only to prove that media can be generated, but to prove that:

- generated and uploaded assets are governed and reusable
- composition routes behave truthfully across browser and deferred execution
- users can recover from failures using the UI and status surfaces
- output artifacts are real, playable, and audibly non-silent when expected
- reload, missed events, and job restarts preserve continuity

## Scope

This eval program covers the following user-facing capabilities:

- `generate_audio`
- `generate_chart`
- `generate_graph`
- `compose_media`
- `list_conversation_media_assets`

And the following system surfaces:

- browser-runtime execution
- deferred job enqueue and worker completion
- media artifact playback and download
- jobs-page, admin-jobs, and transcript recovery surfaces

## Scenario Families

### 1. Golden path scenarios

These validate that a user can successfully create media and consume the final result.

Required scenario classes:

1. generated image + generated audio -> video
2. uploaded image + generated audio -> video
3. chart + generated audio -> video
4. graph + generated audio -> video
5. multiple videos -> concat video
6. planner-driven composition from chat attachments

### 2. Recovery scenarios

These validate that the system recovers or fails truthfully.

Required scenario classes:

1. browser runtime unavailable -> deferred enqueue
2. deferred media job failed -> retry from admin/jobs UI
3. running media job -> cancel from UI
4. page reload during active media job -> recovered current state
5. missed SSE / dropped live updates -> reconstructed terminal snapshot
6. upload completes but playback asset is not yet available -> truthful pending state

### 3. Truthfulness scenarios

These verify that the UI and conversation surfaces do not overclaim completion.

Required scenario classes:

1. `client_fetch_pending` is shown as pending, not complete
2. result card does not imply durable video until final artifact exists
3. stale prior media assets are not silently substituted unless explicitly chosen
4. replayed and recovered job cards preserve canonical route and artifact identity

### 4. Governance and continuity scenarios

Required scenario classes:

1. generated media becomes visible in `list_conversation_media_assets`
2. later composition can reuse governed prior-turn assets
3. ported/reloaded conversations preserve media asset references
4. anonymous/signed-in boundaries do not leak media assets across owners

## Assertions Per Scenario

Every media eval scenario should define assertions in five categories.

### UX assertions

- buttons and inputs needed for the flow are visible
- status cards transition through truthful states
- retry/cancel affordances appear only when allowed
- transcript or jobs page exposes the correct next action

### Job-state assertions

- queued/running/succeeded/failed/canceled states are canonical
- progress label and percent survive reload/recovery
- retry creates the right job transition
- fallback enqueue preserves dedupe semantics where required

### Artifact assertions

- final artifact has a governed asset id
- video downloads successfully
- ffprobe shows expected stream types
- audio is present when required
- playback advances past initial currentTime threshold

### Observability assertions

- browser diagnostics are captured
- request failures and page errors are recorded
- runtime-audit signals exist for deferred recovery and terminal outcomes
- manifest/debug summaries are written to artifacts

### Policy assertions

- only valid roles can invoke composition surfaces
- admin/operator recovery actions remain scoped to the right surfaces
- governed asset handles are required for composition

## Release-Gate Proposal

The media-eval program should become a formal release gate with at least these categories:

1. media core matrix
2. media recovery matrix
3. media continuity matrix

Suggested passing rule for release:

- all required golden-path scenarios pass
- all required recovery scenarios pass
- no truthfulness regressions in pending/fallback states
- evidence bundle is written for each live media scenario family

## Required New Deliverables

To operationalize this program, the repo should add:

1. a dedicated media scenario catalog in the eval runner
2. a matrix-to-test traceability table
3. a release evidence section for media-specific e2e outcomes
4. a media failure taxonomy used consistently across cards, jobs, and evidence

## Recommended Implementation Order

1. document current coverage and missing scenarios
2. formalize the coverage matrix
3. add deterministic scenario definitions for media continuity and recovery
4. add live browser media scenarios to the release evidence path
5. tighten retry/cancel/reload assertions around media jobs specifically