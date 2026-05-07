# Phase 07: Media Workflow Operation Migration

Status: Implemented and QA verified on 2026-05-03

## Goal

Make media generation and composition a first-class `media_workflow` operation instead
of a parallel workflow/job subsystem that the assistant describes after the fact.

After this phase, chat, admin, diagnostics, and logs see one canonical operation for a
media request. Media workflow rows, deferred jobs, materializations, and generated
assets remain executor detail, but user-visible progress, retry, cancel, blockers,
and artifacts are projected through the operation kernel.

## QA Certification

This document was QA reviewed against the current codebase on 2026-05-03
before implementation.

Pre-implementation current-code anchors:

- media workflow types, factories, repository, orchestrator, read model, and turn
  hook exist;
- media deferred job helpers for `generate_audio` and `compose_media` exist;
- chat job mutation routes still enqueue or revise jobs directly;
- chat `MediaWorkflowCard`, jobs rail, and `JobsWorkspace` render current media
  workflow state outside operation actions;
- `OperationDraftFactory` still exposes the disabled `media.workflow` placeholder;
- `OperationKindRegistry` already registers `media_workflow`;
- `OperationStatusMapping` already maps media workflow and media step statuses;
- `OperationActionPolicy` has a legacy `media.retry_step` validator but no
  `media.workflow.*` validators;
- media worker, tool availability, provider availability, and browser/WASM probes
  exist as current capability inputs.

Issues corrected during QA:

- made operation action payload validator updates explicit;
- clarified that `media.workflow.reconcile` is an internal service, not a
  user-visible stored action;
- corrected step-state mapping to use the implemented canonical mapping:
  media step `queued` -> operation step `ready`, media step `ready` -> operation
  step `succeeded`;
- added `MediaWorkflowCard` and `JobsWorkspace` to the required UI migration and
  test scope.

Certification evidence:

- existing anchor paths referenced by this phase were checked on disk;
- `git diff --check` passed for this phase document and the phase index;
- `npx vitest run src/core/use-cases/operations/OperationStatusMapping.test.ts src/core/use-cases/operations/OperationActionPolicy.test.ts src/lib/media/workflows/media-workflow-contract.test.ts src/lib/media/workflows/media-workflow-orchestrator.test.ts src/lib/media/workflows/media-workflow-read-model.test.ts src/frameworks/ui/chat/plugins/custom/MediaWorkflowCard.test.tsx src/components/jobs/JobsWorkspace.test.tsx`
  passed: 7 files, 52 tests.

Certification result:

- ready for implementation;
- no known stale existing file references;
- expected-new files are clearly named as Phase 07 implementation outputs;
- no unresolved QA blockers remain in the specification.

## Implementation Closeout

Phase 07 is implemented.

Implemented outcomes:

- `media_workflow` operations now use typed `media.workflow.create`,
  `media.workflow.retry_step`, and `media.workflow.cancel` actions instead of the
  disabled placeholder action.
- media workflow action schemas are registered in `OperationActionPolicy`.
- media workflow creation, retry, cancel, reconciliation, step projection, artifact
  projection, and action refresh are handled by operation executor/reconciler
  adapters.
- deferred media jobs carry operation/workflow/step metadata in their request
  payloads.
- media intent routing now converts unavailable required provider slots, such as
  missing `tts` capability, into blocked operation gates before execution.
- `/api/chat/jobs` POST now creates and dispatches a media workflow operation instead
  of directly enqueueing the user-facing job path.
- catalog-bound user-facing `compose_media` and `generate_audio` executions now
  create media workflow operations through `media-workflow-operation-launcher`
  instead of directly enqueueing media jobs; only `system_worker` composition keeps
  the low-level media-worker executor path.
- `/api/chat/jobs/[jobId]` routes media workflow retry/cancel through operation
  action dispatch while leaving plain non-media jobs on the existing revision path.
- chat media workflow cards, the jobs rail, and the jobs workspace render
  operation-backed action buttons when workflow operation actions are available.
- `media-workflow-turn-hook` no longer creates prose-derived workflows; it only
  reconciles deterministic existing workflow state.
- the missing generate-audio deferred-job regression test file was added so the
  phase verification target exists on disk.
- a media workflow architecture guardrail now fails if the catalog reintroduces
  direct `enqueueComposeMediaDeferredJob` or `enqueueGenerateAudioDeferredJob`
  imports on user-facing media tools.

Implementation verification:

- `npm test -- src/core/use-cases/operations/MediaWorkflowOperationActions.test.ts src/core/use-cases/operations/OperationActionPolicy.test.ts src/core/use-cases/operations/OperationIntentPolicy.test.ts src/core/use-cases/operations/OperationIntentRouter.test.ts src/lib/media/workflows/media-workflow-operation-executor.test.ts src/lib/media/workflows/media-workflow-operation-reconciler.test.ts src/core/use-cases/operations/OperationStatusMapping.test.ts src/lib/media/workflows/media-workflow-contract.test.ts src/lib/media/workflows/media-workflow-orchestrator.test.ts src/lib/media/workflows/media-workflow-read-model.test.ts src/lib/media/workflows/media-workflow-turn-hook.test.ts src/lib/jobs/compose-media-deferred-job.test.ts src/lib/jobs/generate-audio-deferred-job.test.ts src/lib/operations/operation-action-api.test.ts src/app/api/chat/jobs/route.test.ts 'src/app/api/chat/jobs/[jobId]/route.test.ts' src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts src/frameworks/ui/chat/plugins/custom/MediaWorkflowCard.test.tsx src/components/jobs/JobsWorkspace.test.tsx src/lib/chat/stream-preparation.operation-grounding.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/lib/media/workflows/media-workflow-architecture-guardrails.test.ts`
  passed: 22 files, 151 tests, 2 skipped Docker/MCP tests.
- `npm run typecheck` passed.
- `npm run lint` passed with the existing warning backlog and 0 errors.
- `git diff --check` passed.

Regression grep results:

- `media.workflow` hits are limited to the contract, executor, route, launcher,
  UI, and test surfaces expected for this phase.
- direct `enqueueComposeMediaDeferredJob` / `enqueueGenerateAudioDeferredJob` imports
  have no hits in `src/app`, `src/frameworks/ui`, `src/components`, or the catalog
  runtime binding; remaining hits are executor/orchestrator internals and deferred
  job unit tests.
- backup/restore action copy has no hits in media UI surfaces.
- remaining `actionType: "job"` hits are non-media job UI tests and remain acceptable
  for later non-media deferred-job migration.

## Phase Inputs

Use the completed operation-kernel phases as constraints, not loose inspiration:

- Phase 01 defined operation kinds, statuses, steps, events, actions, artifacts, risk,
  confirmation, and capability gates.
- Phase 02 added durable operation storage and read models.
- Phase 03 added the action dispatch boundary and executor registry.
- Phase 04 added operation draft construction and intent routing, with media currently
  represented by a disabled placeholder action.
- Phase 05 made chat grounding truthful: the assistant may only describe actions and
  state that exist in the operation read model.
- Phase 06 proved the migration pattern with backup and restore: typed actions,
  executor adapters, idempotent reconciliation, operation artifacts, and no text-only
  safety path.

## Current Code Grounding

The existing media subsystem is useful and should be adapted, not replaced blindly:

- `src/lib/media/workflows/types.ts` defines `MediaWorkflow`, `MediaWorkflowStep`,
  statuses, step kinds, and workflow events.
- `src/lib/media/workflows/factory.ts` creates chart/audio/video, visual/audio/video,
  and generated-audio workflow drafts.
- `src/lib/media/workflows/state.ts` validates workflow success and step readiness.
- `src/lib/media/workflows/sqlite-media-workflow-repository.ts` owns
  `media_workflows`, `media_workflow_steps`, and `media_workflow_events`.
- `src/lib/media/workflows/orchestrator.ts` advances workflows by reading deferred job
  state, binding compose jobs, detecting exact reuse, and marking workflow success or
  failure.
- `src/lib/media/workflows/media-workflow-read-model.ts` builds the current workflow
  snapshot used by chat and admin.
- `src/lib/media/workflows/media-workflow-turn-hook.ts` currently creates best-effort
  workflows after assistant turns when it detects promised video composition.
- `src/lib/jobs/generate-audio-deferred-job.ts` and
  `src/lib/jobs/compose-media-deferred-job.ts` enqueue canonical media jobs and handle
  active-equivalent or exact-reuse outcomes.
- `src/app/api/chat/jobs/route.ts` directly enqueues `generate_audio` and
  `compose_media` jobs, and also returns media workflow snapshots.
- `src/app/api/chat/jobs/[jobId]/route.ts` exposes job cancel/retry actions through
  the older execution revision path.
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts` renders media/job rail actions
  as job actions or text prompts, not operation actions.
- `src/frameworks/ui/chat/plugins/custom/MediaWorkflowCard.tsx` renders workflow
  progress in assistant messages.
- `src/components/jobs/JobsWorkspace.tsx` renders workflow cards in the jobs/admin
  workspace.
- `src/core/use-cases/operations/OperationDraftFactory.ts` has a disabled
  `media.workflow` placeholder action for `media_workflow` operations.
- `src/core/use-cases/operations/OperationKindRegistry.ts` already registers the
  `media_workflow` operation kind.
- `src/core/use-cases/operations/OperationStatusMapping.ts` already maps
  `MediaWorkflowStatus` and `MediaWorkflowStepStatus` into canonical operation
  statuses.
- `src/core/use-cases/operations/OperationActionPolicy.ts` currently validates
  stored action payloads through `DEFAULT_OPERATION_PAYLOAD_VALIDATORS`; it has a
  legacy `media.retry_step` validator but no validators for the Phase 07
  `media.workflow.*` actions yet.
- `src/lib/tools/tool-availability-service.ts`,
  `src/lib/ai/providers/provider-capability-availability.ts`,
  `src/lib/appliance/probes/tool-availability-probe.ts`,
  `src/lib/appliance/probes/media-worker-probe.ts`, and
  `src/lib/media/browser-runtime/ffmpeg-capability-probe.ts` are the current
  capability inputs for media provider/tool/worker/runtime gating.
- `src/lib/operations/operation-action-dispatch-root.ts` currently registers
  diagnostics and backup/restore executors only.
- `src/lib/operations/operation-intent-root.ts` includes `media_workflow` in the
  resource-pressure gate, but does not yet gate media providers, tools, or workers.

Important semantic mismatch: `MediaWorkflowStepStatus.ready` means the media step has
completed and produced a usable result. In the operation kernel this projects as
operation step `succeeded`. `MediaWorkflowStepStatus.queued` projects as operation
step `ready` because canonical operation steps do not have a `queued` state.

## Target Architecture

Use a clean anti-corruption adapter between the operation kernel and the existing
media subsystem.

- Core operation code owns contracts only:
  `MediaWorkflowOperationActions`, action payload schemas, risk levels, role rules,
  and allowed status transitions.
- Application media-operation code owns orchestration:
  media workflow draft creation, workflow persistence, deferred job enqueueing,
  workflow reconciliation, artifact projection, retry, and cancel.
- Existing media workflow repositories and orchestrators remain executor internals.
  They must not be imported by core operation contract modules.
- Chat and admin mutate media workflows only by executing operation actions.
- Existing direct job APIs may remain read-only during this phase, but media workflow
  creation, retry, and cancel must no longer depend on `/api/chat/jobs` mutation as
  the user-facing path.

Recommended files:

- Add `src/core/use-cases/operations/MediaWorkflowOperationActions.ts`.
- Update `src/core/use-cases/operations/OperationActionPolicy.ts` with payload
  validators for the new `media.workflow.*` schema keys. Do not keep media
  workflow actions on `payloadSchemaKey: "none"`.
- Add `src/lib/media/workflows/media-workflow-operation-executor.ts`.
- Add `src/lib/media/workflows/media-workflow-operation-reconciler.ts`.
- Add `src/lib/media/workflows/media-workflow-operation-factory.ts` if draft
  conversion becomes larger than the executor should own.
- Register the executor in `src/lib/operations/operation-action-dispatch-root.ts`.
- Replace the disabled media action placeholder in
  `src/core/use-cases/operations/OperationDraftFactory.ts`.
- Extend `src/lib/operations/operation-intent-root.ts` with media-specific gates.

## Operation Contract

`media_workflow` actions should be explicit and typed:

- `media.workflow.create`: create the media workflow rows, operation steps, and initial
  queued jobs required by the request.
- `media.workflow.retry_step`: retry a failed or canceled media step without creating a
  duplicate workflow.
- `media.workflow.cancel`: cancel pending/running workflow work and project the
  operation as `cancelled` when cancellation succeeds.

Reconciliation is an internal application service, not a user-visible stored action.
Do not expose `media.workflow.reconcile` as a chat/admin action unless a later phase
adds an explicit admin-only maintenance contract for it.

Each action must carry structured payload, not natural-language instructions:

- `create` payload: requested deliverable, source conversation/message/turn ids,
  selected workflow template, provider/tool choices, and idempotency key.
- `retry_step` payload: `workflowId`, `stepId`, and retry idempotency key.
- `cancel` payload: `workflowId` and cancellation reason.
- Reconciliation input: `operationId`, `workflowId`, and optional source event
  watermark passed directly to the reconciler service.

Required payload schema keys:

- `media.workflow.create`
- `media.workflow.retry_step`
- `media.workflow.cancel`

Remove or alias the existing `media.retry_step` validator only if no current tests or
actions still rely on it. Greenfield implementation should prefer one media workflow
action namespace instead of keeping both names indefinitely.

Risk and confirmation:

- Workflow creation is `medium` risk with `single_click` confirmation because it can
  spend provider credits or local resources.
- Retry is `medium` risk with `single_click` confirmation.
- Cancel is `low` risk with `single_click` confirmation.
- Any high-cost provider path may raise the create/retry action to phrase
  confirmation in a later policy phase, but Phase 07 should keep the contract simple.

## State Mapping

Project media workflow state into operation state deterministically:

The spelling difference is intentional: media workflows and jobs use `canceled`;
canonical operations and operation steps use `cancelled`.

| Media workflow status | Operation status |
| --- | --- |
| `queued` | `queued` |
| `running` | `running` |
| `blocked` | `blocked` |
| `failed` | `failed` |
| `succeeded` | `succeeded` |
| `canceled` | `cancelled` |

Project media step state into operation step state:

| Media step status | Operation step status |
| --- | --- |
| `pending` | `pending` |
| `queued` | `ready` |
| `running` | `running` |
| `ready` | `succeeded` |
| `blocked` | `blocked` |
| `failed` | `failed` |
| `skipped` | `skipped` |

Project media step kinds into operation step kinds:

- `generate_chart` -> `media.generate_chart`
- `generate_audio` -> `media.generate_audio`
- `generate_image` -> `media.generate_image`
- `compose_media` -> `media.compose`
- `reuse_asset` -> `media.reuse_asset`

## Event And Artifact Projection

The reconciler must be idempotent. Re-running it after the same workflow/job state
must not duplicate operation events, artifacts, or user-visible actions.

Required projection rules:

- `workflow_created` becomes an operation event and creates initial operation steps.
- `workflow_running` moves the operation to `running`.
- `step_queued`, `step_ready`, and `step_failed` update the matching operation step
  through `OperationStatusMapping`.
- Job state changes for step `jobId` append operation events with the job id as
  source metadata.
- Exact media reuse creates a `materialization` artifact without requiring a job.
- Generated audio, image, chart, and video assets become operation artifacts.
- Compose logs or executor errors become `media_log` artifacts when they are useful
  for admin diagnosis.
- Failed steps expose `media.workflow.retry_step` only when the failed step can be
  safely retried.
- Terminal workflow success or failure closes the operation and removes unsafe actions.

Use stable source keys for idempotency, for example:

- `media_workflow_event:<eventId>`
- `media_workflow_step:<workflowId>:<stepId>:<status>:<updatedAt>`
- `media_job:<jobId>:<status>:<updatedAt>`
- `media_asset:<assetId>`

## Provider, Tool, And Worker Gates

Media operations must block before execution when required capability is missing.

Extend `src/lib/operations/operation-intent-root.ts` so `media_workflow` checks:

- runtime resource pressure from the existing resource gate;
- tool availability for `generate_audio`, `compose_media`, and image generation when
  the selected template requires it;
- provider capability for audio/image generation when the template requires external
  providers;
- media worker/runtime availability for local composition;
- browser/WASM media capability only when that path is selected.

Missing capability is an operation `blocked` state with a clear blocker artifact or
event. It must not become assistant prose, a hidden job failure, or a disabled button
without a reason.

## API And UI Migration

Keep user-facing mutation surfaces aligned with operation actions:

- `/api/chat/jobs` GET may continue returning read models during migration.
- `/api/chat/jobs` POST must stop being the primary user-facing media mutation path.
  It should either create a `media_workflow` operation or become an internal endpoint
  used only by the operation executor.
- `/api/chat/jobs/[jobId]` cancel/retry must route through operation action dispatch
  when the job belongs to a media workflow. Plain non-media jobs can remain on the
  old path until a later tool-task migration.
- `resolve-jobs-rail` should render operation actions for media workflow snapshots
  when an operation exists. Text prompts like "help me revise" are not acceptable
  for media operation retry/cancel.
- `MediaWorkflowCard` should render operation-backed action buttons for blocked,
  failed, cancellable, or retryable workflows when operation actions are available.
- `JobsWorkspace` should link media workflow cards to the canonical operation state
  and show operation actions instead of raw linked-job controls for workflow-level
  retry/cancel.
- `media-workflow-turn-hook` must no longer be the source of truth for promised media
  work. It can create a draft media operation from deterministic context, or be
  pruned once the intent compiler covers the same path.

## Data Model Strategy

Prefer linking through operation artifacts and JSON metadata before adding new tables.
The existing media workflow tables are executor state, while operation tables are the
canonical product state.

Required links:

- media workflow request metadata stores `operationId` and source action id;
- deferred job request payload stores `operationId`, operation step id, workflow id,
  and workflow step id;
- operation artifacts store workflow id, job id, materialization id, and asset id;
- read models can resolve a workflow from an operation without scanning every row.

If JSON lookup becomes too brittle, add a narrowly scoped repository query helper.
Do not create a second operation/media join schema unless implementation proves the
artifact link is insufficient.

## Pruning

Because this is greenfield, remove or retire duplicated paths instead of preserving
them indefinitely:

- Replace the disabled `media.workflow` placeholder action with the Phase 07 action
  contract.
- Remove media workflow creation from assistant prose-driven success paths.
- Remove user-facing direct enqueue paths for media workflow mutation once operation
  action dispatch covers them.
- Remove media-specific retry/cancel text prompts from chat surfaces where operation
  buttons are available.
- Keep low-level job enqueue helpers because the media operation executor still needs
  them.

## Tests Required

Add or update focused tests:

- `src/core/use-cases/operations/MediaWorkflowOperationActions.test.ts`
  - validates action schemas, role rules, confirmation policy, and allowed statuses;
  - rejects malformed create/retry/cancel payloads.
- `src/core/use-cases/operations/OperationActionPolicy.test.ts`
  - verifies `media.workflow.create`, `media.workflow.retry_step`, and
    `media.workflow.cancel` payload schema keys are registered;
  - rejects missing `workflowId`, `stepId`, and idempotency fields as appropriate.
- `src/lib/media/workflows/media-workflow-operation-executor.test.ts`
  - create action creates one workflow, one operation step per media step, and
    required initial jobs;
  - repeated create action with the same idempotency key does not duplicate work;
  - missing provider/tool/worker capability returns blocked operation state;
  - retry creates exactly one replacement job for the failed step;
  - cancel cancels queued/running media work and projects the operation as
    `cancelled`.
- `src/lib/media/workflows/media-workflow-operation-reconciler.test.ts`
  - maps `ready` media steps to `succeeded` operation steps;
  - projects generated assets as operation artifacts;
  - projects exact reuse as a materialization artifact;
  - appends no duplicate events or artifacts on repeated reconciliation;
  - exposes retry only for retryable failed steps.
- `src/app/api/chat/jobs/route.test.ts`
  - verifies media mutation either creates an operation or is rejected as no longer
    user-facing;
  - preserves read-only job/workflow listing.
- `src/app/api/chat/jobs/[jobId]/route.test.ts`
  - verifies media job retry/cancel dispatches operation actions when the job is part
    of a media workflow.
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts`
  - verifies media workflow cards render operation action buttons, not text-only
    prompts, when operation actions are available.
- `src/frameworks/ui/chat/plugins/custom/MediaWorkflowCard.test.tsx`
  - verifies failed/blocked media workflow messages expose operation action buttons
    with visible button styling and no text-only confirmation path.
- `src/components/jobs/JobsWorkspace.test.tsx`
  - verifies workflow cards use operation status/actions as the governing state while
    preserving linked job diagnostics as detail.
- `src/lib/chat/stream-preparation.operation-grounding.test.ts`
  - verifies chat grounding includes media workflow operation state, blockers, and
    artifacts.

Keep existing media tests passing:

- `src/core/use-cases/operations/OperationStatusMapping.test.ts`
- `src/core/use-cases/operations/OperationActionPolicy.test.ts`
- `src/lib/media/workflows/media-workflow-contract.test.ts`
- `src/lib/media/workflows/media-workflow-orchestrator.test.ts`
- `src/lib/media/workflows/media-workflow-read-model.test.ts`
- `src/lib/media/workflows/media-workflow-turn-hook.test.ts`
- `src/lib/jobs/compose-media-deferred-job.test.ts`
- `src/lib/jobs/generate-audio-deferred-job.test.ts`
- `src/lib/operations/operation-action-api.test.ts`

## Regression Greps

Run these before closeout and investigate every hit:

```bash
rg -n "Media workflow operation executors are registered in Phase 07|actionType: \"media.workflow\"|actionType: 'media.workflow'" src
rg -n "enqueueComposeMediaDeferredJob|enqueueGenerateAudioDeferredJob" src/app src/frameworks/ui src/components
rg -n "Create Safety Backup|Execute Restore" src/lib/media src/frameworks/ui/chat/plugins/custom src/frameworks/ui/jobs-rail src/components/jobs
rg -n "actionType: \"job\"|actionType: 'job'" src/frameworks/ui/jobs-rail src/components/jobs src/frameworks/ui/chat
```

The last grep may still find non-media job actions. That is acceptable only if the
Phase 07 media workflow path has operation actions and the remaining job actions are
plain non-media deferred jobs scheduled for a later migration.

## Verification Commands

Run the targeted test set first, then the broader suite:

```bash
npm test -- src/core/use-cases/operations/MediaWorkflowOperationActions.test.ts
npm test -- src/core/use-cases/operations/OperationActionPolicy.test.ts
npm test -- src/lib/media/workflows/media-workflow-operation-executor.test.ts
npm test -- src/lib/media/workflows/media-workflow-operation-reconciler.test.ts
npm test -- src/core/use-cases/operations/OperationStatusMapping.test.ts
npm test -- src/lib/media/workflows/media-workflow-orchestrator.test.ts
npm test -- src/lib/media/workflows/media-workflow-read-model.test.ts
npm test -- src/app/api/chat/jobs/route.test.ts
npm test -- 'src/app/api/chat/jobs/[jobId]/route.test.ts'
npm test -- src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts
npm test -- src/frameworks/ui/chat/plugins/custom/MediaWorkflowCard.test.tsx
npm test -- src/components/jobs/JobsWorkspace.test.tsx
npm test -- src/lib/chat/stream-preparation.operation-grounding.test.ts
npm run typecheck
npm run lint
git diff --check
```

## Exit Criteria

- A user media request creates a durable `media_workflow` operation with typed
  actions, operation steps, and truthful chat grounding.
- Media workflow/job progress is visible through operation read models in chat and
  admin.
- Generated assets, materializations, and useful logs are operation artifacts.
- Retry and cancel are operation actions with idempotent executor behavior.
- Missing providers, disabled tools, missing worker capability, or resource pressure
  block media operations clearly before execution.
- Direct media job mutation paths are pruned or downgraded to internal/read-only
  surfaces.
- The assistant can no longer claim media work ran unless an operation event, step, or
  artifact proves it.
