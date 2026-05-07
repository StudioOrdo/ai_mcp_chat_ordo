# Phase 03 - Chat Jobs Presentation Cutover

## Objective

Present Phase 01/02 media workflows as one coherent product object in chat and Jobs.

The user should see "your video workflow is running" and then the final video artifact, not a loose chart card, a loose audio card, and an unrelated compose job. Phase 02 owns dependency advancement; Phase 03 owns the read model and presentation cutover that makes that backend truth visible.

## Current Code Grounding

### Workflow Runtime From Phases 01-02

- `src/lib/media/workflows/types.ts` defines durable workflow, step, and event snapshots.
- `src/lib/media/workflows/factory.ts` creates chart/audio/video, visual/audio/video, and generated-audio workflow drafts.
- `src/lib/media/workflows/sqlite-media-workflow-repository.ts` persists workflows and now exposes:
  - `listWorkflowsByConversation(...)`
  - `findWorkflowByStepJobId(...)`
  - `listRunnableWorkflows(...)`
  - `markWorkflowRunning(...)`
  - `markWorkflowFailed(...)`
  - `markWorkflowSucceeded(...)`
- `src/lib/media/workflows/orchestrator.ts` is the Phase 02 runtime facade:
  - `advanceByJobId(...)`
  - `advanceWorkflow(...)`
  - `reconcileRunnableWorkflows(...)`
  - `MediaWorkflowDependencyResolver`
  - `MediaWorkflowJobBinder`
  - generated-audio and compose step strategies
- `src/lib/jobs/deferred-job-worker.ts` triggers workflow advancement after successful and terminal failed jobs.
- `src/lib/media/workflows/media-workflow-turn-hook.ts` creates the bridge workflow for the known failure shape: chart generated, audio queued, video promised, but no `compose_media` call.

### Current Chat Presentation Surface

- `src/hooks/usePresentedChatMessages.ts` passes `CanonicalJobSnapshot[]` into `ChatPresenter.presentMany(...)`.
- `src/adapters/ChatPresenter.ts` currently:
  - converts canonical job snapshots into `job_status` parts with `canonicalJobSnapshotToStatusPart(...)`
  - merges explicit/nested/canonical job candidates through `JobRenderCandidateMerger`
  - truth-binds active media text through `resolveTruthBoundMediaText(...)`
  - returns `PresentedMessage.toolRenderEntries`
- `src/lib/chat/JobRenderCandidateMerger.ts` currently dedupes job cards by `jobId` and treats `compose_media`, `generate_audio`, `generate_chart`, and `generate_graph` as media jobs.
- `src/frameworks/ui/chat/bubbles/AssistantBubble.tsx` groups rendered tool entries and sends job/tool entries to `ToolPluginPartRenderer`.
- `src/frameworks/ui/chat/ToolPluginPartRenderer.tsx` resolves a tool/card renderer from the plugin registry.
- `src/frameworks/ui/chat/registry/default-tool-registry.ts` maps:
  - `generate_audio` -> `AudioPlayerCard`
  - `generate_chart` -> `ChartRendererCard`
  - `generate_graph` -> `GraphRendererCard`
  - media card kind -> `MediaRenderCard`
  - fallback job status -> `JobStatusFallbackCard`
- `src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx`, `AudioPlayerCard.tsx`, and `ChartRendererCard.tsx` render media artifacts.
- `src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx` and `JobStatusFallbackCard.tsx` render generic job status.

### Current Jobs Surface

- `src/app/jobs/page.tsx` loads `loadUserJobsWorkspace(...)` and renders `JobsWorkspace`.
- `src/lib/jobs/load-user-jobs-workspace.ts` loads canonical job snapshots through `JobStatusQuery`.
- `src/core/use-cases/JobStatusQuery.ts` is the job read port for user and conversation job snapshots.
- `src/lib/jobs/job-read-model.ts` defines `CanonicalJobSnapshot`, `buildCanonicalJobSnapshot(...)`, and `canonicalJobSnapshotToStatusPart(...)`.
- `src/components/jobs/JobsWorkspace.tsx` renders job list counts, selected job detail, and live updates.
- `src/components/jobs/job-snapshot-reducer.ts` merges live job events into `CanonicalJobSnapshot` state.
- `src/components/jobs/JobDetailPanel.tsx` renders job history and diagnostic actions.

## Product Problem To Solve

The current UI is job-first. That is useful for diagnostics but wrong for workflow-owned media deliverables:

- generated audio can appear as if it is the answer when the user asked for a video
- an older completed `compose_media` job can be selected as the visible result for a newer request
- chart/audio/compose internals can look like separate deliverables
- chat restore only knows about canonical job snapshots, not the durable workflow that ties the jobs together

Phase 03 must introduce a workflow read model and presentation layer without weakening Phase 02's backend ownership of dependency orchestration.

## Target Product Shape

Chat renders one workflow surface for workflow-owned deliverables:

- workflow title and requested deliverable
- current stage: queued, generating audio, composing video, succeeded, failed, canceled
- dependency statuses as secondary detail
- final artifact preview when complete
- clear failure reason when not complete
- diagnostic link to Jobs, not diagnostic noise by default

Jobs renders two levels:

- workflow summary for product users
- underlying linked jobs and events for diagnostics/admin visibility

The final video artifact must appear in chat when the workflow succeeds, including after reload or missed event delivery.

## Target Architecture

### Read Model Facade

Add `MediaWorkflowReadModel` under `src/lib/media/workflows/`.

Responsibilities:

- load workflows by conversation and user
- load workflow-linked jobs through `JobQueueRepository`
- build product-facing workflow snapshots
- resolve final artifact refs from workflow final asset and ready final step output
- expose linked job ids for diagnostics

Non-responsibilities:

- no workflow advancement
- no job execution
- no chat transcript parsing
- no React rendering

Target DTO:

```ts
export interface CanonicalMediaWorkflowSnapshot {
  workflowId: string;
  conversationId: string;
  userId: string;
  title: string;
  requestedDeliverable: "video" | "audio" | "chart" | "image";
  status: "queued" | "running" | "blocked" | "failed" | "succeeded" | "canceled";
  stage: {
    key: string;
    label: string;
    progressPercent: number | null;
  };
  steps: Array<{
    stepId: string;
    kind: string;
    status: string;
    jobId: string | null;
    assetId: string | null;
    label: string;
  }>;
  finalArtifact: {
    assetId: string;
    kind: "video" | "audio" | "image" | "chart" | "graph";
  } | null;
  failure: {
    code: string | null;
    message: string | null;
  };
  linkedJobIds: string[];
  originMessageId: string | null;
  originTurnId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
```

### Presenter Adapter

Add a workflow-aware presentation adapter near the existing presenter boundary:

- `src/lib/media/workflows/media-workflow-presentation.ts`
- converts `CanonicalMediaWorkflowSnapshot` into a renderable `ToolRenderEntry`-compatible object or a new `workflow-status` entry
- selects the workflow's origin assistant message when available
- falls back to nearest assistant message by timestamp only if no origin message exists

The adapter must not mutate transcript content. It only supplies presentational entries.

### Chat Presenter Cutover

Extend `ChatPresenter.presentMany(...)` input from:

```ts
presentMany(messages: ChatMessage[], jobSnapshots: readonly CanonicalJobSnapshot[])
```

to:

```ts
presentMany(
  messages: ChatMessage[],
  jobSnapshots: readonly CanonicalJobSnapshot[] = [],
  workflowSnapshots: readonly CanonicalMediaWorkflowSnapshot[] = [],
)
```

Rules:

- workflow-owned dependency jobs are suppressed as primary cards when their workflow card is present
- explicit standalone jobs still render normally
- canonical job snapshots remain available for active progress strips and diagnostics
- stale completed compose jobs must not satisfy newer workflows
- active workflow text should replace uncertain assistant text the same way `resolveTruthBoundMediaText(...)` protects active media jobs today

### Workflow Card Strategy

Add `MediaWorkflowCard` under `src/frameworks/ui/chat/plugins/custom/`.

Rendering strategy:

- `queued` or `running`: workflow stage, dependency rows, progress if known
- `succeeded`: final artifact preview using existing `MediaRenderCard`/media artifact primitives
- `failed`/`blocked`: failure state with plain reason and Jobs link
- `canceled`: canceled state with Jobs link

This should reuse existing media renderers instead of duplicating video/audio/image player logic.

### Jobs Workspace Cutover

Extend Jobs data loading:

- `loadUserJobsWorkspace(...)` should load workflow summaries alongside job snapshots.
- `JobsWorkspaceState` should hold:
  - `workflows`
  - `jobs`
  - selected workflow or selected job
- `JobsWorkspace` should list workflow summaries first, with linked jobs nested or available in the detail panel.
- `JobDetailPanel` remains the diagnostics panel for a selected linked job.

Underlying job history must remain inspectable, but the default product list should not force users to mentally assemble chart/audio/compose dependencies.

### API / Data Flow

Add or extend read APIs conservatively:

- `GET /api/chat/jobs` may include `workflows` alongside `jobs`, because chat already polls/subscribes there.
- `GET /api/jobs` / Jobs page loader should include workflows for authenticated users.
- No frontend code should enqueue workflow steps. Phase 02 remains the only advancement path.

## SOLID / Clean Boundaries

### Single Responsibility

- `MediaWorkflowReadModel`: projects durable workflow state into product snapshots.
- `MediaWorkflowOrchestrator`: advances workflow state only.
- `ChatPresenter`: attaches already-projected workflow/job presentation entries to messages.
- `MediaWorkflowCard`: renders one workflow snapshot.
- `JobsWorkspace`: arranges workflow/job read models; it does not infer dependency state.
- `JobDetailPanel`: remains job diagnostics.

### Open / Closed

- New deliverable kinds add a workflow card strategy or artifact adapter, not new chat presenter branches.
- New workflow step kinds extend the read model label/stage mapper, not the UI state machine.
- Existing job cards remain available for standalone tools.

### Liskov

- Workflow snapshots must be complete enough that any renderer can rely on `status`, `stage`, `steps`, and `finalArtifact`.
- A succeeded workflow must always have `finalArtifact`.
- A failed workflow must always carry a deterministic failure code/message from Phase 02 or repository state.

### Interface Segregation

- Chat receives only workflow snapshots needed for rendering.
- Jobs receives workflow summaries plus linked job ids.
- Admin diagnostics can request raw events/history separately.
- Media cards receive artifact refs, not repository objects.

### Dependency Inversion

- Read model depends on repository ports: `SqliteMediaWorkflowRepository`, `JobQueueRepository`, and future asset catalog reader.
- Presenter depends on DTOs, not SQLite or job repositories.
- React components depend on props, not database access.

## DRY

- Reuse `CanonicalJobSnapshot` for linked job details.
- Reuse existing `MediaRenderCard`, `AudioPlayerCard`, and chart/graph renderers for artifact previews.
- Reuse `JobRenderCandidateMerger` freshness rules for remaining standalone jobs.
- Reuse workflow steps from `MediaWorkflowSnapshot`; do not reconstruct dependency trees from transcript text.
- Reuse Phase 02 `finalAssetId` and step outputs as the final artifact source of truth.

## GoF Patterns

- Facade: `MediaWorkflowReadModel` hides workflow tables and linked jobs from UI callers.
- Adapter: `media-workflow-presentation.ts` adapts workflow snapshots into chat render entries.
- Strategy: workflow card status/deliverable strategies choose queued/running/succeeded/failed rendering.
- Composite: Jobs workspace displays workflow summaries containing linked job children.
- Observer: existing job event stream remains the trigger for refresh/reconciliation, but not the source of dependency truth.
- Repository: workflow and job repositories isolate persistence.
- State: workflow status and step status drive presentation states directly.

## Implementation Steps

1. Completed: added `CanonicalMediaWorkflowSnapshot` and read-model builder under `src/lib/media/workflows/media-workflow-read-model.ts`.
2. Completed: added repository/read-model tests for:
   - running chart/audio/video workflow
   - succeeded workflow with final video asset
3. Completed: extended chat job loading path to include workflow snapshots:
   - `GET /api/chat/jobs`
   - `useChatJobEvents`
   - `usePresentedChatMessages`
4. Completed: extended `ChatPresenter.presentMany(...)` to accept workflow snapshots.
5. Completed: suppressed primary dependency job cards when `jobId` is linked to a visible workflow.
6. Completed: added `MediaWorkflowCard` and direct workflow entry rendering.
7. Completed: final video previews render from `workflow.finalArtifact`.
8. Completed: extended Jobs workspace loader/state to include workflow summaries and linked jobs.
9. Completed: stale-compose protection is enforced by workflow-owned linked job suppression and final artifact resolution from workflow state only.
10. Completed: docs and QA evidence updated.

## Prune / Do Not Preserve

- Do not show workflow dependency jobs as separate primary deliverables in chat.
- Do not pick "latest successful compose job in the conversation" as a workflow result.
- Do not parse assistant prose to determine workflow completion.
- Do not put workflow orchestration into React hooks.
- Do not make users leave chat to view the final artifact.
- Do not remove diagnostic job history; move it behind Jobs detail/admin inspection.

## Positive Tests

- Running chart+audio+video workflow renders one in-progress workflow card in chat.
- Completed workflow renders final video preview in chat.
- Failed dependency renders workflow failure with clear reason.
- Jobs page groups linked audio/compose jobs under the workflow.
- Workflow card updates after job event refresh.
- Chat reload after completion still shows the final artifact.

## Negative Tests

- Unrelated older `compose_media` job is not displayed as the current workflow result.
- Dependency audio card does not replace the final workflow deliverable.
- A failed audio dependency does not render as a completed audio answer for a video request.
- A job from another conversation/user is not grouped into the workflow.
- A workflow without `finalArtifact` cannot render as succeeded.

## Edge Tests

- Workflow succeeds while chat stream is closed; restore still shows final video.
- Jobs page opened during dependency execution shows current stage.
- Multiple workflows in the same conversation remain distinct.
- Exact materialization reuse produces a completed workflow card without a new compose job card.
- Workflow-created assistant message is missing; card falls back deterministically without attaching to the wrong message.

## Validation Commands

```bash
./node_modules/.bin/vitest run \
  src/lib/media/workflows \
  src/adapters/ChatPresenter.test.ts \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/frameworks/ui/chat \
  src/components/jobs \
  src/app/api/chat/jobs/route.test.ts \
  src/app/jobs \
  --pool=threads

npm run typecheck
```

Package-level eval validation:

```bash
./node_modules/.bin/vitest run \
  tests/evals/eval-scenarios.test.ts \
  tests/evals/eval-fixtures.test.ts \
  tests/evals/eval-runner.test.ts \
  src/lib/media/workflows \
  src/adapters/ChatPresenter.test.ts \
  src/hooks/usePresentedChatMessages.test.tsx \
  --pool=threads
```

## Done Criteria

- Chat shows the current media workflow as one product object.
- Final workflow artifact appears in chat when the workflow succeeds.
- Dependency jobs remain inspectable without becoming duplicate primary cards.
- Jobs page groups workflow-linked jobs under the workflow.
- Stale completed compose jobs cannot masquerade as the result of newer workflow requests.
- No frontend code owns dependency advancement; Phase 02 remains the orchestration boundary.

## Implementation Notes

- Added `src/lib/media/workflows/media-workflow-read-model.ts`.
  - Projects `MediaWorkflowSnapshot` into `CanonicalMediaWorkflowSnapshot`.
  - Resolves final artifacts only from `workflow.finalAssetId` or the correct final deliverable step.
  - Exposes linked job ids and linked job snapshots for diagnostics.
  - Provides `filterPrimaryJobSnapshotsForWorkflows(...)` to suppress workflow-owned dependency jobs from primary chat rendering.
- Added `SqliteMediaWorkflowRepository.listWorkflowsByUser(...)` for Jobs workspace loading.
- Extended `GET /api/chat/jobs` and `GET /api/jobs` to include `workflows` alongside canonical job snapshots.
- Extended `useChatJobEvents(...)` and the global chat state with workflow snapshot reconciliation.
- Extended `usePresentedChatMessages(...)` and `ChatPresenter.presentMany(...)` to accept workflow snapshots.
- Added `workflow-status` tool render entries and direct rendering in both Assistant bubble rendering paths.
- Added `MediaWorkflowCard` for running/failed/completed workflow states.
- Extended `JobsWorkspace` and its reducer state to carry workflow summaries. A QA pass found that an unstable default `workflows = []` caused a render loop in tests; this was fixed with a stable `EMPTY_WORKFLOWS` constant.

## Validation

- `./node_modules/.bin/vitest run src/lib/media/workflows src/adapters/ChatPresenter.test.ts src/hooks/usePresentedChatMessages.test.tsx src/frameworks/ui/chat src/components/jobs src/app/api/chat/jobs/route.test.ts src/app/jobs --pool=threads`
  - 45 files passed, 256 tests passed.
- `npm run typecheck`

## Close-Out

Phase 03 is implemented and validated. Chat and Jobs now consume durable media workflow snapshots instead of treating dependency jobs as separate primary deliverables. Workflow-owned audio/compose jobs are suppressed in primary chat presentation, final video previews are sourced from the workflow final artifact, and Jobs shows workflow summaries while retaining linked job diagnostics.

The deterministic eval scenario `media-workflow-video-completion-deterministic` also validates the product presentation rule: the completed request restores into chat as one `workflow-status` card with final video artifact `uf_eval_bloom_video`, while linked dependency job cards are not rendered as primary assistant deliverables.
