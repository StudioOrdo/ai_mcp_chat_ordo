# Phase 04 - Guardrails, Tests, And Pruning

## Objective

Lock the implemented media workflow architecture from Phases 01-03 so future changes cannot regress to assistant-driven async chaining, status polling loops, duplicate dependency cards, or stale job confusion.

Phase 04 does not add a new orchestration model. It hardens the model we now have:

- durable workflow ownership in `src/lib/media/workflows`
- automatic step advancement through `MediaWorkflowOrchestrator`
- workflow read projection through `MediaWorkflowReadModel`
- chat and jobs presentation through canonical workflow snapshots
- diagnostic job tools kept out of the normal product path

The product rule is simple: when the user asks for a final media deliverable, the workflow owns the outcome. Individual jobs are implementation details unless the user explicitly asks to inspect them.

## Current Codebase Grounding

### Workflow Runtime

- `src/lib/media/workflows/types.ts` defines the durable workflow, step, dependency, artifact, and event contract.
- `src/lib/media/workflows/state.ts` owns workflow state transition invariants.
- `src/lib/media/workflows/factory.ts` creates workflow records from planned media work.
- `src/lib/media/workflows/sqlite-media-workflow-repository.ts` persists workflows, steps, dependencies, events, and read queries.
- `src/lib/media/workflows/orchestrator.ts` is the only normal runtime path that may advance workflow steps and enqueue dependent work.
- `src/lib/media/workflows/media-workflow-turn-hook.ts` binds assistant-planned media workflows to conversation turn execution.
- `src/lib/jobs/deferred-job-worker.ts` calls the workflow orchestrator after job success/failure so workflows can advance without an open assistant stream.
- `src/lib/jobs/compose-media-deferred-job.ts` and `src/lib/jobs/generate-audio-deferred-job.ts` are job executors, not workflow owners.
- `src/lib/media/ffmpeg/media-composition-plan.ts`, `src/lib/media/server/compose-media-worker-runtime.ts`, and `src/lib/media/server/compose-media-plan-materialization.ts` remain media execution internals.

### Read Model And Presentation

- `src/lib/media/workflows/media-workflow-read-model.ts` is the canonical workflow-to-UI projection.
- `src/adapters/ChatPresenter.ts` merges chat messages, job render candidates, and workflow snapshots.
- `src/lib/chat/JobRenderCandidateMerger.ts` must suppress dependency jobs that are represented by a workflow card.
- `src/hooks/usePresentedChatMessages.ts`, `src/hooks/chat/useChatJobEvents.ts`, `src/hooks/chat/useJobStateStore.ts`, `src/hooks/useGlobalChat.tsx`, and `src/frameworks/ui/useChatSurfaceState.tsx` carry workflow snapshots to chat without turning hooks into workflow engines.
- `src/frameworks/ui/chat/plugins/custom/MediaWorkflowCard.tsx` is the canonical chat card for multi-step media deliverables.
- `src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx`, `src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx`, and `src/frameworks/ui/chat/plugins/custom/ChartRendererCard.tsx` remain artifact renderers.
- `src/frameworks/ui/MessageList.tsx`, `src/frameworks/ui/chat/bubbles/AssistantBubble.tsx`, `src/frameworks/ui/chat/ToolPluginPartRenderer.tsx`, and `src/frameworks/ui/chat/registry/default-tool-registry.ts` should render workflow state, not infer it.

### Jobs And API Surfaces

- `src/app/api/chat/jobs/route.ts` returns chat-visible job and workflow snapshots.
- `src/app/api/jobs/route.ts`, `src/app/jobs/page.tsx`, `src/lib/jobs/load-user-jobs-workspace.ts`, and `src/components/jobs/JobsWorkspace.tsx` present canonical job/workflow state for the jobs surface.
- `src/lib/jobs/job-read-model.ts` and `src/lib/jobs/job-snapshot-state.ts` remain the canonical job read model.
- `src/components/jobs/job-snapshot-reducer.ts`, `src/components/jobs/useJobsEventStream.ts`, and `src/components/jobs/JobDetailPanel.tsx` consume events and snapshots. They must not decide workflow advancement.
- `src/components/jobs/JobsWorkspace.tsx` must keep stable default collections such as `EMPTY_WORKFLOWS`; unstable `[]` or `{}` defaults in stateful UI are a regression risk.

## Architecture Phase 04 Protects

### SOLID Boundaries

- **Single Responsibility:** job executors generate artifacts; the orchestrator advances workflows; read models project state; UI renders projections.
- **Open/Closed:** new media step types should be added through orchestrator strategies and workflow metadata, not by editing chat hooks or UI event listeners.
- **Liskov Substitution:** workflow steps must obey the same lifecycle contract regardless of tool type: queued, running, succeeded, failed, canceled, or blocked with a durable reason.
- **Interface Segregation:** UI consumers receive `MediaWorkflowSnapshot` and `JobSnapshot` read models, not repository internals or raw worker payloads.
- **Dependency Inversion:** high-level workflow orchestration depends on enqueue/repository abstractions. It must not depend on React hooks, browser state, or assistant text output.

### CLEAN/DRY Boundaries

- The workflow repository is the durable source of truth for workflow state.
- The job read model is the durable source of truth for job state.
- `MediaWorkflowReadModel` is the only place that should assemble workflow presentation state from workflow and job records.
- `ChatPresenter` is the only chat adapter that should merge persisted messages, jobs, and workflow cards.
- Dependency job suppression should use shared workflow linkage helpers, not repeated ad hoc filtering.
- Final media selection must use the workflow final artifact/terminal step, not "latest successful compose job in conversation" heuristics.
- Job status tools may report facts, but they must not be required to complete normal media workflows.

### GoF Patterns In Use

- **Repository:** `SqliteMediaWorkflowRepository` isolates persistence and query mechanics.
- **State:** `state.ts` centralizes legal workflow and step transitions.
- **Strategy:** `MediaWorkflowOrchestrator` delegates step execution decisions by step kind instead of embedding every media rule in one branch-heavy caller.
- **Facade:** `MediaWorkflowReadModel` gives UI/API code a stable projection facade over workflows, jobs, assets, and events.
- **Adapter:** `ChatPresenter` adapts backend read models into chat-renderable parts.
- **Observer:** deferred job completion events and jobs SSE streams observe job changes; they do not own workflow decisions.
- **Composite:** `MediaWorkflowCard` presents a multi-step deliverable as one product object while preserving child artifact details.
- **Guard Clause / Chain of Responsibility:** job binding and workflow advancement must reject wrong user, wrong conversation, wrong job kind, invalid plan, and duplicate events before enqueueing dependent work.

## Guardrail Themes

1. Final media deliverables require durable workflow ownership.
2. Assistant polling is diagnostic only, not default execution.
3. Workflow success requires the requested final artifact, not dependency success.
4. Dependency jobs do not become duplicate primary chat deliverables.
5. Old successful jobs cannot satisfy a new workflow request.
6. Wrong-user or wrong-conversation jobs cannot advance a workflow.
7. Malformed final compose plans fail deterministically instead of leaving workflows pending forever.
8. Stateful UI must not create render loops through unstable default arrays or objects.

## Source Audit Targets

Run and classify every match before implementation:

```bash
rg -n "get_my_job_status|list_my_jobs|list_deferred_jobs|get_deferred_job_status" src tests docs
rg -n "compose_media.*generate_audio|generate_audio.*compose_media|audio.*compose|compose.*audio" src tests
rg -n "latest.*compose|completed.*compose|find\\(.*compose_media|filter\\(.*compose_media" src tests
rg -n "job_completed|job_progress|needs_input|__response_state__" src/lib src/hooks src/frameworks src/app tests
rg -n "workflowStateEntries|workflowSnapshots|filterPrimaryJobSnapshotsForWorkflows|MediaWorkflowReadModel" src tests
rg -n "= \\[\\]|= \\{\\}" src/components src/frameworks src/hooks
```

Classification categories:

- `keep`: explicit user/admin diagnostics, debug history, or low-level job detail pages.
- `replace`: default workflow behavior that must use durable workflow orchestration or read models.
- `delete`: dead compatibility path or stale assumption from pre-workflow media chaining.
- `test-only`: useful fixtures that do not encode intended product behavior.

## Implementation Steps

1. Add a Bloom-style regression test in `src/lib/media/workflows/media-workflow-orchestrator.test.ts`:
   - user requests chart + generated audio + final video
   - chart is ready during the assistant turn
   - audio completes after the assistant stream ends
   - `deferred-job-worker` invokes the orchestrator
   - compose is enqueued automatically
   - repeated completion handling is idempotent
   - workflow succeeds only after the final compose artifact is durable
2. Add repository and binder guardrails:
   - wrong user job cannot bind to a workflow step
   - wrong conversation job cannot bind to a workflow step
   - wrong job kind cannot satisfy a dependency
   - malformed final compose plan fails with a durable reason such as `invalid_compose_plan`
3. Add read model guardrails in `src/lib/media/workflows/media-workflow-read-model.test.ts`:
   - dependency jobs are linked under the workflow
   - final artifact is selected from workflow terminal state
   - unrelated successful compose jobs in the conversation are ignored
   - restored chat can render completed workflow state without SSE replay
4. Add chat presentation guardrails:
   - `src/adapters/ChatPresenter.test.ts` proves linked dependency jobs are suppressed as primary assistant cards.
   - `src/hooks/usePresentedChatMessages.test.tsx` proves workflow snapshots flow through restored and live chat state.
   - `src/frameworks/ui/chat/plugins/custom/MediaWorkflowCard.test.tsx` proves final video, audio, and intermediate artifacts render from the workflow snapshot.
5. Add jobs surface guardrails:
   - `src/components/jobs/JobsWorkspace.test.tsx` proves workflow snapshots render and stable empty defaults do not loop.
   - `src/app/api/chat/jobs/route.test.ts` and `src/app/api/jobs/route.test.ts` prove workflow snapshots are returned with job snapshots.
6. Add a small architecture guardrail test or lint-style test under `src/lib/media/workflows` that fails on reintroduced normal-path assistant polling or frontend workflow enqueue logic.
7. Add a deterministic eval scenario, `media-workflow-video-completion-deterministic`, that exercises the whole package:
   - seeded signed-in member asks for chart + generated audio + final video
   - workflow is created with chart/audio/compose steps
   - audio job completion advances the backend workflow and enqueues compose once
   - final compose job completion marks the workflow succeeded with a durable video artifact
   - chat presentation renders one workflow card and suppresses dependency job cards
   - job-status polling tools are not used for normal completion
8. Delete or rewrite tests that bless manual assistant chaining, latest-job inference, or dependency cards as the final product answer.
9. Update prompt/tool guidance so the model can start workflows and report durable state, but cannot promise manual follow-up across async boundaries as the primary completion mechanism.

## Prune List

Delete or replace:

- prompt language that encourages repeated job polling for normal media completion
- UI logic that infers a final media deliverable from the latest successful job in a conversation
- frontend hook logic that enqueues workflow follow-up steps
- tests where an audio/chart/image dependency card is treated as equivalent to the requested final video
- duplicate primary cards for jobs linked to a workflow
- stale compatibility branches that special-case pre-workflow media chaining
- worker or assistant helpers that say "compose after audio completes" without durable workflow dependency ownership

Keep:

- explicit user/admin job diagnostics
- detailed job event history in the jobs surface
- low-level media execution tests for audio, chart, image, and compose jobs
- browser composition capability where it is a legitimate execution backend, not a workflow orchestration substitute

## Positive Tests

- Workflow completes without the assistant stream being open.
- Workflow repair advances a ready dependency graph after server restart.
- Explicit job status tools still work when the user asks about a specific job.
- Admin/staff diagnostics can inspect underlying job events.
- Completed workflows restore into chat with final artifact controls.
- Jobs page shows the workflow as the product object and child jobs as implementation details.

## Negative Tests

- Repeated job status polling does not enqueue or complete workflow steps.
- Workflow cannot succeed with only chart/audio/image dependencies ready.
- Wrong user asset cannot complete a workflow.
- Wrong conversation job cannot complete a workflow.
- Unrelated successful compose job cannot satisfy the current workflow.
- Invalid final compose plan cannot leave the workflow pending indefinitely.

## Edge Tests

- Server restart between audio completion and compose enqueue.
- Duplicate job completion event.
- Workflow canceled before dependency completion.
- Final compose succeeds but chat restore happens before event stream arrives.
- Multiple media workflows requested in the same conversation within seconds.
- Dependency succeeds after workflow failure or cancellation.
- Jobs API receives no workflows and still uses stable empty arrays.

## Validation Commands

Focused validation:

```bash
./node_modules/.bin/vitest run \
  src/lib/media/workflows \
  src/adapters/ChatPresenter.test.ts \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/frameworks/ui/chat \
  src/components/jobs \
  src/app/api/chat/jobs/route.test.ts \
  src/app/api/jobs/route.test.ts \
  src/app/jobs \
  --pool=threads

npm run typecheck
```

Deterministic eval validation:

```bash
./node_modules/.bin/vitest run \
  tests/evals/eval-scenarios.test.ts \
  tests/evals/eval-fixtures.test.ts \
  tests/evals/eval-runner.test.ts \
  src/lib/media/workflows \
  --pool=threads
```

Full confidence validation before closing the package:

```bash
npm test
npm run typecheck
```

## Done Criteria

- The Bloom chart + audio + video failure has a durable regression test.
- No normal product path requires assistant job polling to advance a workflow.
- Workflow final-artifact completion is owned by durable workflow state.
- Dependency jobs are suppressed as duplicate primary chat deliverables.
- Wrong-user, wrong-conversation, wrong-kind, duplicate-event, and malformed-plan cases are covered.
- Stale assistant-chaining and latest-job inference tests are deleted or rewritten.
- Workflow snapshots render correctly in restored chat, live chat, and the jobs page.
- Deterministic eval scenario `media-workflow-video-completion-deterministic` passes and proves package-level behavior across workflow creation, dependency advancement, chat presentation, and status-polling avoidance.
- Focused tests, full test suite, and typecheck pass.
- Product docs clearly state that workflows, not the assistant stream, own async media deliverables.
