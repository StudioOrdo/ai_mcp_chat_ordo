# Phase 02 - Dependency Orchestration Runtime

## Objective

Make workflow dependencies advance automatically when prerequisite jobs or inline asset steps complete.

The backend, not the assistant, must enqueue the next executable step.

## Current Code Grounding

- `src/lib/media/workflows/types.ts` defines the durable workflow/step/event contract created in Phase 01.
- `src/lib/media/workflows/state.ts` enforces core state invariants, including "final artifact workflows require `finalAssetId`" and "`job_...` is not an asset id."
- `src/lib/media/workflows/factory.ts` creates supported workflow drafts:
  - chart + generated audio + composed video
  - existing governed visual + generated audio + composed video
  - generated audio only
- `src/lib/media/workflows/sqlite-media-workflow-repository.ts` persists workflows, ordered steps, step job links, step asset outputs, workflow events, and validated asset ownership.
- `src/lib/media/workflows/orchestrator.ts` currently advances a workflow from linked job state and enqueues `compose_media` when chart/visual and audio dependencies are ready.
- `src/lib/media/workflows/media-workflow-turn-hook.ts` detects the May 1 Bloom failure shape after an assistant turn: generated chart + deferred audio + video promise + no `compose_media` call.
- `src/lib/chat/runtime-hook-composition.ts` registers `MediaWorkflowTurnHook` alongside `LoggingMiddleware`.
- `src/lib/jobs/deferred-job-worker.ts` invokes `MediaWorkflowOrchestrator.advanceByJobId(...)` after successful job completion, after materialization registration, and after terminal job failure.
- `src/lib/jobs/compose-media-deferred-job.ts` remains the canonical enqueue path for server `compose_media` jobs.
- `src/lib/jobs/generate-audio-deferred-job.ts` remains the canonical enqueue path for server `generate_audio` jobs.
- `src/lib/media/server/compose-media-worker-runtime.ts` remains the canonical server composition executor.
- `src/lib/media/server/compose-media-plan-materialization.ts` materializes chart/graph source assets into image assets before executable FFmpeg composition.
- `src/lib/media/ffmpeg/media-composition-plan.ts` now accepts chart/graph source assets at enqueue time and keeps executable validation strict after materialization.

## Phase 02 Implementation Status

Implemented:

- A workflow can be created after an assistant turn that generated chart + audio but failed to call `compose_media`.
- A linked successful `generate_audio` job can mark the audio step `ready`.
- Once visual and audio steps are ready, the orchestrator enqueues one `compose_media` job and links it to the compose step.
- A linked successful `compose_media` job can mark the compose step `ready` and mark the workflow `succeeded`.
- Exact reusable compose materialization can complete the workflow without enqueueing duplicate work.
- Terminal linked job failure marks the step and workflow `failed` with the linked job failure reason.
- Duplicate repair/event triggers are covered by idempotency tests and do not enqueue duplicate compose jobs.
- `reconcileRunnableWorkflows(...)` advances durable non-terminal workflows after missed event delivery or process restart.
- The orchestrator now uses explicit dependency resolver, job binder, and step strategies for generated audio and compose behavior.
- The compose step plan builder supports durable chart, graph, generated image, and reused visual source assets.
- An eligible compose step that cannot build a valid composition plan now fails deterministically instead of remaining pending.
- Workflow status transitions from `queued` to `running` when linked work has started or completed.
- Deferred job success and terminal failure both trigger best-effort workflow advancement from the worker hot path.

## Target Architecture

Phase 02 should harden the initial orchestrator into a clean dependency runtime with explicit collaborators.

### Runtime Facade

`MediaWorkflowOrchestrator`

- Public methods:
  - `advanceWorkflow(workflowId)`
  - `advanceByJobId(jobId)`
  - `reconcileRunnableWorkflows({ conversationId?, userId?, limit? })`
- Responsibilities:
  - load workflow snapshot
  - delegate step readiness/failure extraction to strategies
  - enqueue eligible deferred steps
  - persist legal workflow/step transitions
  - remain idempotent under repeated calls
- Non-responsibilities:
  - no chat rendering
  - no transcript mutation
  - no direct FFmpeg/media execution
  - no assistant/tool prompting

### Dependency Resolver

`MediaWorkflowDependencyResolver`

- Input: `MediaWorkflowSnapshot`, candidate step.
- Output:
  - `eligible`
  - `waiting`
  - `failed`
- Rules:
  - every `dependsOnStepIds` entry must point to an existing step
  - every dependency must be `ready` or `skipped`
  - failed dependency blocks/fails dependent steps
  - missing dependency is a workflow contract failure

### Step Strategy Interface

`MediaWorkflowStepStrategy`

Required methods:

- `canHandle(step)`
- `extractJobResult(step, job)`

Initial strategies:

- `GeneratedAudioStepStrategy`
  - extracts audio artifact id from `generate_audio` result envelope
  - marks step `ready` with `assetId`
- `ComposeMediaStepStrategy`
  - extracts final video artifact id from `compose_media` result envelope
  - marks workflow `succeeded` only after final video asset id is present

The orchestrator owns command construction for Phase 02 because the only deferred follow-up command is `compose_media`; new generated media step kinds should be added through a new strategy before expanding the loop.

### Job Binder

`MediaWorkflowJobBinder`

- Links deferred job ids to workflow steps through `media_workflow_steps.job_id`.
- Must reject binding a job owned by another user/conversation.
- Must reject binding a tool name incompatible with the step kind.
- Must be idempotent when the same equivalent active job is returned by dedupe.

### Repair/Reconciliation Runner

`MediaWorkflowOrchestrator.reconcileRunnableWorkflows(...)`

- Finds non-terminal workflows with:
  - linked terminal jobs not yet reflected in step state
  - eligible pending steps
  - stale `queued`/`running` workflow state after process restart
- Calls `MediaWorkflowOrchestrator.advanceWorkflow(...)`.
- Should be usable from:
  - deferred worker startup
  - admin repair script
  - focused test harness
  - future job-event repair loop

## Execution Rules

1. A step is eligible when all dependencies are `ready` or explicitly skipped.
2. An eligible deferred step is enqueued once and linked to the workflow step.
3. A linked job reaching `succeeded` moves the step to `ready` and records output asset ids.
4. A linked job reaching terminal failure moves the step and workflow to `failed`, unless the step strategy declares recoverable blocking behavior.
5. When all final-step dependencies are ready, the final `compose_media` step is enqueued automatically.
6. A final `compose_media` success sets `workflow.final_asset_id` and `workflow.status = succeeded`.
7. Workflow status moves to `running` when any dependency is queued, running, or ready and the workflow has not reached a terminal state.
8. A workflow cannot remain `queued` after a dependency job has completed.
9. Repeated calls with the same workflow/job state must produce no duplicate jobs and no duplicate terminal transitions.
10. Exact materialization reuse must mark the relevant step `ready` and record evidence without creating a duplicate job.

## SOLID / Clean Boundaries

### Single Responsibility

- `MediaWorkflowOrchestrator`: coordinates state advancement only.
- `MediaWorkflowDependencyResolver`: determines readiness/blocking only.
- `MediaWorkflowStepStrategy`: knows one step kind's enqueue/result/failure semantics.
- `SqliteMediaWorkflowRepository`: persists workflow state and validates persistence invariants.
- `DeferredJobWorker`: executes jobs and emits job results; it only triggers orchestration after job completion.
- `MediaWorkflowTurnHook`: creates a workflow from a completed assistant turn; it does not execute jobs or complete workflows.

### Open / Closed

- New dependency types are added by registering a new `MediaWorkflowStepStrategy`.
- The orchestrator loop should not grow `if step.kind === ...` branches for every new media type.
- New triggers use the same `advanceWorkflow(...)` facade.

### Liskov

- Every step strategy must follow the same result contract:
  - no job result means no state change
  - terminal failure returns a deterministic failure/blocking transition
  - success returns asset/output refs that satisfy `state.ts` invariants

### Interface Segregation

- UI should consume workflow snapshots, not repository internals.
- Job execution code should receive only `JobQueueRepository` and job handler dependencies.
- Workflow repair code should not depend on chat interactor or React hooks.

### Dependency Inversion

- Orchestration depends on repository/job/materialization ports.
- Runtime composition depends on `enqueueComposeMediaDeferredJob(...)`, not raw `job_requests` inserts.
- Asset ownership remains repository/Asset Catalog concern, not assistant prompt concern.

## DRY

- Reuse `enqueueGenerateAudioDeferredJob(...)` and `enqueueComposeMediaDeferredJob(...)` for job creation.
- Reuse `materialization_records` and exact reuse logic for compose/audio outputs.
- Reuse `media-composition-plan.ts` validation and canonicalization.
- Reuse `compose-media-plan-materialization.ts` for chart/graph -> image conversion.
- Reuse `state.ts` invariants for every transition.
- Do not re-parse assistant transcripts after workflow creation; the workflow snapshot is the source of truth.

## GoF Patterns

- Observer: job completion in `DeferredJobWorker` observes terminal job state and triggers `advanceByJobId(...)`.
- Strategy: `MediaWorkflowStepStrategy` implementations encapsulate generated audio, ready asset, and compose behavior.
- Command: the orchestrator builds the next executable `compose_media` command and submits it through the existing deferred job queue.
- State: workflow and step transitions are explicit and validated before persistence.
- Facade: `MediaWorkflowOrchestrator` is the only public advancement API for worker, repair, and future route triggers.
- Repository: `SqliteMediaWorkflowRepository` isolates durable persistence.
- Template Method: orchestration loop follows a fixed order: refresh linked jobs -> apply terminal outputs/failures -> resolve eligible steps -> enqueue next command.

## Implementation Steps

1. Completed: refactored the current `MediaWorkflowOrchestrator` helpers into explicit internal collaborators:
   - `MediaWorkflowDependencyResolver`
   - `MediaWorkflowStepStrategyRegistry`
   - `MediaWorkflowJobBinder`
2. Completed: added step strategies:
   - audio job strategy for `generate_audio`
   - compose job strategy for `compose_media`
3. Completed: linkage remains in `media_workflow_steps.job_id`; no workflow columns were added to `job_requests`.
4. Completed: worker triggers orchestration after job success and terminal failure, not from frontend event listeners.
5. Completed: terminal linked job failure marks the workflow `failed`.
6. Completed: `reconcileRunnableWorkflows(...)` repairs workflows stuck in non-terminal states with completed linked jobs.
7. Completed: idempotency guards and tests prevent duplicate compose jobs under repeated triggers.
8. Completed: workflow status transitions from `queued` to `running` when work begins.

`MediaWorkflowTurnHook` remains intentionally narrow and creates the durable bridge workflow only for the chart + generated audio + promised video failure shape. Asset ownership validation remains enforced by the workflow repository for persisted asset references.

## Prune / Do Not Preserve

- Do not rely on assistant calling `get_my_job_status` to unlock the next step.
- Do not let frontend job event listeners enqueue server workflow steps.
- Do not create duplicate compose jobs when a completion event is received more than once.
- Do not infer chart readiness from visible chat rendering; readiness must be durable.
- Do not infer workflow success from any successful compose job in the conversation.
- Do not let `MediaWorkflowTurnHook` become a general transcript parser; it is a narrow bridge for same-turn workflow recovery.
- Do not add another media renderer path; keep server composition owned by the existing media worker runtime.

## Positive Tests

- Creating a Bloom chart+audio+video workflow queues audio and records ready chart state.
- Audio success automatically enqueues `compose_media`.
- Compose success marks workflow succeeded and records final video asset id.
- Reconciliation advances a workflow whose linked audio job completed while the stream was closed.
- Exact compose materialization reuse completes the compose step without duplicate queue work.
- Workflow status transitions to `running` after the first queued/ready dependency.

## Negative Tests

- Audio failure fails or blocks the workflow with a clear reason.
- Missing chart asset prevents compose and produces a deterministic blocked/failed state.
- Duplicate completion triggers do not enqueue duplicate compose jobs.
- A completed unrelated compose job in the conversation does not satisfy the current workflow.
- A job from another user/conversation cannot be bound to a workflow step.
- A step with incompatible tool/job kind cannot be bound.
- A workflow cannot be marked succeeded until the final requested artifact is present.

## Edge Tests

- Audio completes after assistant stream has ended.
- User reloads page before dependency completion.
- Orchestrator restarts after server restart and advances from durable state.
- Chart is durable but audio is still running.
- Compose job succeeds but materialization projection is delayed; workflow remains non-succeeded until final asset id is known.
- Assistant calls chart/audio, promises video, and ends `needs_input`; backend still owns the workflow.
- Chart/graph source assets are accepted at enqueue time and materialized before executable composition.
- Repeated `advanceByJobId(...)` after successful audio does not create a second compose job.

## Validation Commands

```bash
npm exec vitest run \
  src/lib/media/workflows \
  src/lib/jobs/compose-media-deferred-job.test.ts \
  src/lib/jobs/deferred-job-runtime.test.ts \
  src/lib/jobs/deferred-job-worker.test.ts \
  src/lib/media/ffmpeg/media-composition-plan.test.ts \
  src/lib/media/server/compose-media-worker-runtime.test.ts \
  src/app/api/chat/jobs/route.test.ts
```

Package-level eval validation:

```bash
./node_modules/.bin/vitest run \
  tests/evals/eval-scenarios.test.ts \
  tests/evals/eval-fixtures.test.ts \
  tests/evals/eval-runner.test.ts \
  src/lib/media/workflows \
  --pool=threads
```

## Done Criteria

- The backend automatically creates the final compose job after generated dependencies are ready.
- No assistant status polling is needed for normal workflow completion.
- Repeated events and repair scans are idempotent.
- The Bloom failure shape is covered by a regression test.

## Implementation Notes

- Hardened `MediaWorkflowOrchestrator` into the Phase 02 runtime facade.
- Added `MediaWorkflowDependencyResolver`, `MediaWorkflowJobBinder`, and step strategies for generated audio and compose result extraction.
- Added `SqliteMediaWorkflowRepository.listRunnableWorkflows(...)`, `markWorkflowRunning(...)`, and `markWorkflowFailed(...)`.
- The orchestrator advances workflow steps by linked `jobId` and reconciles durable non-terminal workflows without requiring a fresh SSE/job event.
- Successful `generate_audio` jobs mark the audio step `ready` and enqueue the dependent `compose_media` step exactly once.
- Failed/canceled linked jobs mark their step and workflow failed with deterministic failure metadata.
- Successful `compose_media` jobs mark the compose step `ready` and complete the workflow with `finalAssetId`.
- `DeferredJobWorker` now invokes the orchestrator after successful and terminal failed job completion as a best-effort continuation path.
- `MediaWorkflowTurnHook` creates a durable workflow when an assistant turn produces chart + deferred audio and promises video/composition without calling `compose_media`.
- Media composition plan validation now allows chart/graph source assets before server-side materialization; executable validation still requires image/video after materialization.
- Added focused tests for automatic compose enqueue, duplicate advancement idempotency, terminal dependency failure, reconciliation, binding guardrails, and final video completion.
- QA follow-up added regression coverage for malformed eligible compose workflows and exact materialization reuse completing the workflow without queueing duplicate compose work.

## Validation

- `npm exec vitest run src/lib/media/workflows src/lib/jobs/compose-media-deferred-job.test.ts src/lib/jobs/deferred-job-runtime.test.ts src/lib/jobs/deferred-job-worker.test.ts src/lib/media/ffmpeg/media-composition-plan.test.ts src/lib/media/server/compose-media-worker-runtime.test.ts src/app/api/chat/jobs/route.test.ts`
  - 8 files passed, 70 tests passed.
- `npm run typecheck`

## Close-Out

Phase 02 is implemented and validated. The system no longer depends on the assistant remembering to call `compose_media` after an audio dependency completes; the backend workflow runtime owns dependency advancement, failure propagation, idempotency, and repair scanning from durable state.

The deterministic eval scenario `media-workflow-video-completion-deterministic` now exercises the phase package end to end: audio completion triggers backend compose enqueue, duplicate advancement does not create a second compose job, status polling tools are not used, and workflow success is withheld until the final video artifact is durable.
