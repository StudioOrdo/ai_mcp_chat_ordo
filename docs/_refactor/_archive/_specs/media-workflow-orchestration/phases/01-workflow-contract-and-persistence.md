# Phase 01 - Workflow Contract And Persistence

## Objective

Create the durable contract for multi-step media workflows so a request like "make a video with a chart and new audio" becomes one owned backend workflow instead of disconnected assistant tool calls.

This phase should not execute dependency chains yet. It establishes the write model, read model, invariants, and tests needed for the orchestrator in Phase 02.

## Current Failure Grounding

Conversation: `conv_b2d1ac71-9412-45d9-9924-aa033e5ecd4c`

User request:

- `msg_eaab96fd-374f-4225-b522-0e99889cb5c0`
- `2026-05-01T16:47:22.584Z`
- requested a new video with a chart and a new 30 second audio explanation.

Observed state:

- `generate_chart` created `chart_blooms_ai`.
- `generate_audio` created `job_26dc3d17-5d4f-4650-9b7c-e7414aabf0ff`.
- audio completed as `uf_2b5ce913-dbc0-45b1-8318-2fd340f49da6`.
- no `compose_media` job exists after `2026-05-01T16:47:00Z`.

Root contract gap:

- `job_requests` knows individual jobs.
- `job_events` knows individual lifecycle events.
- `messages.parts` knows model tool calls and prose.
- no durable owner knows "this user asked for a final video, and these generated dependencies must lead to that final video."

## Target Model

Add a media workflow persistence contract with these concepts:

- `media_workflows`: one row per user-requested deliverable workflow.
- `media_workflow_steps`: one row per dependency or final executable step.
- `media_workflow_events`: durable lifecycle events for debugging, UI history, and replay.

Recommended statuses:

- workflow: `queued`, `running`, `blocked`, `failed`, `succeeded`, `canceled`
- step: `pending`, `queued`, `running`, `ready`, `blocked`, `failed`, `skipped`

Recommended step kinds:

- `generate_chart`
- `generate_audio`
- `generate_image`
- `compose_media`
- `reuse_asset`

The exact schema can be adjusted to match repository style, but it must support:

- `workflow.id`
- `workflow.user_id`
- `workflow.conversation_id`
- `workflow.origin_message_id`
- `workflow.origin_turn_id`
- `workflow.requested_deliverable`
- `workflow.status`
- `workflow.final_asset_id`
- `workflow.failure_code`
- `workflow.failure_message`
- `step.id`
- `step.workflow_id`
- `step.kind`
- `step.status`
- `step.depends_on_step_ids_json`
- `step.job_id`
- `step.asset_id`
- `step.input_json`
- `step.output_json`

## Architecture

### Boundaries

- `MediaWorkflowRepository`: owns persistence.
- `MediaWorkflowProjector`: maps DB rows into a UI/API read model.
- `MediaWorkflowFactory`: turns a requested deliverable into workflow + steps.
- Existing `JobQueueRepository`: remains the owner of executable job state.
- Existing `AssetCatalogReader`: remains the owner of governed media asset discovery.

### SOLID

- Single Responsibility: the workflow repository does not execute jobs; it only persists workflow state.
- Open/Closed: new workflow templates add strategies without rewriting job handlers.
- Interface Segregation: UI reads workflow snapshots, not raw persistence rows.
- Dependency Inversion: orchestration depends on repository ports and job enqueue services.

### DRY

- Do not duplicate asset id validation. Reuse existing canonical media asset validation and `AssetCatalogReader`.
- Do not duplicate job status DTOs. Workflow snapshots may reference canonical job snapshots.
- Do not duplicate media plan canonicalization. Final `compose_media` step should use existing composition plan materialization.

### GoF Patterns

- Factory: request-to-workflow template creation.
- State: legal workflow and step transitions.
- Repository: durable workflow persistence.
- Facade: read model for chat/jobs.

## Implementation Steps

1. Add schema migration/bootstrap for workflow tables.
2. Add TypeScript domain types for workflows, steps, statuses, and deliverable kinds.
3. Add `MediaWorkflowRepository` and SQLite implementation through existing DB wiring.
4. Add legal transition helpers and tests.
5. Add `MediaWorkflowFactory` for at least:
   - chart + generated audio + composed video
   - existing image/chart + generated audio + composed video
   - generated audio only as a non-composition baseline
6. Add a read model projector that returns one workflow snapshot with:
   - workflow status
   - requested deliverable
   - ordered steps
   - linked job ids
   - linked asset ids
   - final artifact if present
7. Add an API/internal use case to create a workflow from a validated request.

## Prune / Do Not Preserve

- Do not preserve assistant-polling behavior as a workflow mechanism.
- Do not store workflow truth inside `messages.parts`.
- Do not treat a `get_my_job_status` result as workflow state.
- Do not infer workflow completion by searching for any successful `compose_media` job in the conversation.

## Positive Tests

- Creating a chart+audio+video workflow persists one workflow and ordered dependency steps.
- Workflow read model includes origin message and user/conversation ownership.
- Existing governed asset inputs are represented as `reuse_asset` or ready input steps.
- Workflow factory rejects missing final deliverable type.

## Negative Tests

- Another user's asset cannot be attached to a workflow.
- A `job_...` id is rejected anywhere an `assetId` is required.
- A workflow cannot move to `succeeded` without a final asset id for final-artifact workflows.
- A step cannot move to `ready` without either an asset id or explicit non-asset output.

## Edge Tests

- Chart step can be ready immediately if `generate_chart` executes inline and stores a durable chart file.
- Audio step can start as queued because it is deferred.
- Workflow can be blocked with a user-facing reason without losing dependency state.
- Replayed or repaired workflow preserves event history.

## Validation Commands

```bash
npm exec vitest run \
  src/lib/media/workflows \
  src/core/platform/media-workflows \
  src/app/api/chat/media-workflows
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

- Durable workflow tables or equivalent repository-backed persistence exist.
- A media workflow can be created independently of assistant prose.
- The Bloom request shape can be represented as one workflow with chart, audio, and compose steps.
- Tests lock the rule that final-artifact workflows cannot succeed without a final artifact.

## Implementation Notes

- Added durable tables: `media_workflows`, `media_workflow_steps`, and `media_workflow_events`.
- Added workflow domain types, state guardrails, a SQLite repository, and a chart+generated-audio+video factory.
- Added factory coverage for existing governed visual asset + generated audio + composed video.
- Added factory coverage for generated-audio-only workflows as the non-composition baseline.
- Added validated repository creation that rejects assets not owned by the workflow user.
- Added regression coverage for the Bloom request shape:
  - chart step starts `ready`
  - audio step is linked to the deferred audio job
  - compose step remains pending until dependencies are ready
- Added guardrails that reject `job_...` values where governed media `assetId` values are required.
- Added guardrails that prevent a final-artifact workflow from succeeding without `finalAssetId`.

## Validation

- `npm exec vitest run src/lib/media/workflows/media-workflow-contract.test.ts`
- `npm exec vitest run src/lib/media/workflows src/lib/media/ffmpeg/media-composition-plan.test.ts src/lib/jobs/compose-media-deferred-job.test.ts src/lib/jobs/deferred-job-worker.test.ts`
- `npm run typecheck`

## QA Close-Out

- Pass: durable workflow tables exist in schema migration.
- Pass: workflow repository persists and reads workflow, ordered steps, linked jobs, linked assets, and event history.
- Pass: Bloom request shape is represented as one workflow with ready chart, linked audio job, and pending compose step.
- Pass: existing visual + generated audio + composed video workflow shape is covered.
- Pass: generated-audio-only baseline workflow shape is covered.
- Pass: `job_...` ids are rejected as media asset references.
- Pass: validated workflow creation rejects another user's asset.
- Pass: final-artifact workflows cannot succeed without `finalAssetId`.
- Pass: ready steps require an asset id or explicit output.
- Pass: deterministic eval scenario `media-workflow-video-completion-deterministic` proves the Bloom-style request is represented as one durable workflow before runtime advancement.
