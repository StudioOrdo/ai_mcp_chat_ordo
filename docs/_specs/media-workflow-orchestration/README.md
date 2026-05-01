# Media Workflow Orchestration

## Why This Exists

On May 1, 2026, `keith@firehose360.com` asked Studio Ordo to create a new video with a chart and a new 30 second audio explanation about Bloom's Taxonomy and AI in education.

The system successfully generated:

- chart asset: `chart_blooms_ai`
- audio job: `job_26dc3d17-5d4f-4650-9b7c-e7414aabf0ff`
- audio asset: `uf_2b5ce913-dbc0-45b1-8318-2fd340f49da6`

The system did not create a video because no `compose_media` job was ever enqueued for that request. The assistant promised "chart, audio, then compose", polled the audio job too quickly, ended with `needs_input`, and the later audio completion event had no durable workflow owner that could continue to composition.

This is a product-trust failure, not a video renderer failure.

## Product Rule

When a user asks for a generated media deliverable, the assistant may initiate the request, but the backend must own the workflow until it reaches a terminal state:

- succeeded with the final user-visible artifact
- failed with a clear, actionable reason
- blocked on explicit user input that is represented as durable workflow state

The assistant must not be responsible for manually chaining async jobs across stream boundaries.

## Current Code Grounding

- `src/lib/chat/stream-execution.ts` enqueues deferred jobs when the model calls deferred tools.
- `src/core/entities/chat-stream.ts` defines `job_progress` and `job_completed` stream events.
- `src/lib/chat/StreamStrategy.ts` treats job completion as a UI event, not as a workflow continuation.
- `src/app/api/chat/jobs/route.ts` can enqueue `generate_audio` and `compose_media` jobs through the shared route surface.
- `src/lib/media/server/compose-media-worker-runtime.ts` already executes server-side media composition from governed assets.
- `src/core/use-cases/AssetCatalogReader.ts` and `list_conversation_media_assets` expose reusable media handles.
- `user_files`, `materialization_records`, `job_requests`, and `job_events` now provide enough durable state to orchestrate this correctly.

## Target Architecture

The target is a durable media workflow read/write model:

1. A user request creates one media workflow.
2. The workflow records desired deliverable, required inputs, generated asset intents, dependencies, and current state.
3. Dependency jobs run through existing deferred job infrastructure.
4. Job completion events update dependency state.
5. When all dependencies are ready, the orchestrator creates the next job.
6. Chat and Jobs render the workflow from one canonical read model.

The workflow is the owner. The model is not.

## Design Principles

- SOLID: workflow orchestration owns dependency progression; job handlers own one executable unit; message persistence owns speech.
- Clean: no hidden assistant polling loops, no transcript job-state mutation, no implicit "maybe compose later" behavior.
- DRY: one dependency resolver and one workflow state projector; no separate React, route, and assistant implementations.
- GoF:
  - State: workflow and dependency status transitions.
  - Observer: job completion events drive workflow progression.
  - Command: each generated dependency or final composition is an executable job command.
  - Facade: chat/jobs consume a workflow read model instead of raw job/event fragments.
  - Strategy: media workflow templates define chart+audio+video, image+audio+video, audio-only, etc.

## Phase Plan

1. [Phase 01 - Workflow Contract And Persistence](phases/01-workflow-contract-and-persistence.md)
2. [Phase 02 - Dependency Orchestration Runtime](phases/02-dependency-orchestration-runtime.md)
3. [Phase 03 - Chat Jobs Presentation Cutover](phases/03-chat-jobs-presentation-cutover.md)
4. [Phase 04 - Guardrails Tests And Pruning](phases/04-guardrails-tests-and-pruning.md)

## Hard Cutover Rules

1. Do not build a compatibility layer that lets the assistant remain the workflow engine.
2. Do not depend on repeated `get_my_job_status` polling for default execution.
3. Do not call a media workflow complete until the requested final artifact exists.
4. Do not render old successful jobs as evidence that the current workflow completed.
5. Do not allow `job_...` ids to stand in for media `assetId` values.
6. Do not add new user-facing tools for this package unless implementation proves an existing tool surface cannot express the request.

## Done Criteria

- The Bloom chart+audio+video request shape creates a durable workflow.
- The chart and audio dependencies can complete independently.
- Audio completion automatically unlocks the final `compose_media` job.
- The final video appears in chat and Jobs from the workflow read model.
- If any dependency fails, the workflow fails or blocks with a specific reason.
- Tests prove there is no assistant status-poll loop required for normal media workflow completion.
