# Phase 03: Restore Read Model And Idempotent Homepage

## Objective

Replace transcript-driven homepage restore with a canonical restore read model.

Restore should load the current workspace, durable active jobs, reusable asset
refs, workflow context, operator transition state, trust distribution state,
relationship memory summary, migration state, and recent transcript without
executing history.

Phase 03 is not a UI redesign phase and not a full asset, memory, prompt,
workflow, or referral implementation phase. Its job is to establish the restore
contract and cut the homepage off from executable transcript replay.

## Source Specs

- [../restore-and-experience-spec.md](../restore-and-experience-spec.md)
- [../target-architecture.md](../target-architecture.md)
- [../business-workflow-context-spec.md](../business-workflow-context-spec.md)
- [../operator-transition-and-trust-distribution-spec.md](../operator-transition-and-trust-distribution-spec.md)
- [../validation-strategy.md](../validation-strategy.md)
- [../test-infrastructure-and-evidence.md](../test-infrastructure-and-evidence.md)
- [phase-01-canonical-domain-contracts.md](phase-01-canonical-domain-contracts.md)
- [phase-02-workspace-snapshot-projection.md](phase-02-workspace-snapshot-projection.md)
- [phase-02a-business-workflow-context-projection.md](phase-02a-business-workflow-context-projection.md)
- [phase-02b-operator-transition-and-trust-distribution-projection.md](phase-02b-operator-transition-and-trust-distribution-projection.md)

## Phase 02 Handoff

Phase 02 defines the workspace snapshot contracts and plan, but the codebase does
not yet have a concrete `WorkspaceSnapshotReader` implementation under
`src/core/platform/conversation-workspace/`.

That means Phase 03 has a hard prerequisite:

- either land the Phase 02 projection-backed reader first
- or co-ship that reader as the first task inside Phase 03 before any homepage
  cutover begins

Phase 03 must still consume a single rebuildable `WorkspaceSnapshotReader`
instead of creating a second workspace authority.

Use the Phase 02 contract directly:

- `WorkspaceSnapshot` from `src/core/entities/conversation-workspace.ts`
- `WorkspaceSnapshotReader` from
  `src/core/use-cases/WorkspaceSnapshotRepository.ts`
- a Phase 02 projection-backed reader and pure projector that still needs to be
  implemented in code

Important handoff rule: `WorkspaceSnapshot.activeJobRefs` means queued/running
work only. Terminal failed/succeeded/canceled/dead-letter jobs are not active
work. Phase 03 may expose separate attention-needed or recent job projections,
but it must not pollute `activeJobRefs` with terminal statuses.

Until the reader exists, Phase 03 must not shortcut back to
`ConversationInteractor.getActiveForUser()` as a pseudo-workspace query. That
would collapse the architecture back into transcript restore.

## Phase 02A Handoff

Phase 02A implemented `RepositoryBackedBusinessWorkflowContextReader` and wired
it through `getBusinessWorkflowContextReader()` in `RepositoryFactory`.

Phase 03 should consume that reader directly through the
`BusinessWorkflowContextReader` port:

- call `findByConversationId(conversationId)` after the workspace conversation
  identity is known
- treat `null` as an explicit no-workflow-context result
- render or serialize `relatedRefs`, `notificationRefs`, `healthRefs`,
  `primaryMode`, `origin`, and `recommendedAction` from the returned context
- keep `lifecycleRefs` and `interruptedTurnRefs` empty until later recorder work
  gives them durable conversation-linked authority
- do not recreate workflow context from lead/deal/referral chat cards,
  lifecycle system messages, prompt handoff blocks, current page memento, or
  failed-send `useRef(Map)` state

Phase 02A deliberately did not add schema. If Phase 03 needs persisted origin,
interrupted-turn, or lifecycle refs for restore presentation, that should be a
new recorder/capture task and not a transcript scan.

## Phase 02B Handoff

Phase 02B is now implemented in code and available for Phase 03 consumption.

Available readers and projectors:

- `src/core/platform/operator-transition/TrustDistributionProjector.ts`
- `src/core/platform/operator-transition/TrustDistributionReader.ts`
- `src/core/platform/operator-transition/OperatorTransitionProjector.ts`
- `src/core/platform/operator-transition/OperatorTransitionReader.ts`
- `getTrustDistributionReader()` and `getOperatorTransitionReader()` in
  `src/adapters/RepositoryFactory.ts`

Phase 03 should consume those readers directly through their ports:

- `TrustDistributionReader.findByConversationId(conversationId)` for
  conversation-scoped share and referral context
- `OperatorTransitionReader.findByConversationId(conversationId)` for
  conversation-scoped operator mode, status, expertise refs, and recommended
  action
- `findByUserId(userId)` only when restore is user-scoped before a conversation
  is resolved

Current grounded limitation:

- Phase 02B intentionally leaves `audienceRefs`, `offerRefs`, `introScripts`,
  `activeCampaignRefs`, and `physicalShareAssets` empty until later phases add
  durable sources

Phase 03 must preserve those explicit empties/nulls. It must not backfill them
from campaign queue copy, coach cards, transcript narration, or referral tool
cards.

## Current Codebase Grounding

The homepage already has a thin server boundary, but restore currently happens
inside the client chat provider and hooks.

There is also no `src/core/platform/conversation-restore/` implementation in the
repo yet, and there is still no concrete
`src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts`.

So the current codebase truth is:

- Phase 01 contracts exist
- Phase 02A and Phase 02B readers exist
- Phase 02 workspace projection and Phase 03 restore read model do not yet
  exist in code

### Homepage And Current Restore Path

| Surface | Current behavior | Phase 03 rule |
| --- | --- | --- |
| `src/app/page.tsx` | Server component resolves session/shell redirect, then renders `<ChatSurface mode="embedded" />`. | Keep the route thin. It may pass initial restore data or let the client fetch a restore endpoint, but it must not become a DB-heavy god loader. |
| `src/frameworks/ui/ChatSurface.tsx` | Mounts `useChatSurfaceState`; embedded homepage and floating chat share global chat state. | Both embedded and floating surfaces should consume the same restore store/adapter. Do not fork homepage-only restore behavior. |
| `src/hooks/useGlobalChat.tsx` | Owns messages, current conversation, `applyConversationPayload`, and the transcript-centric chat provider contract. `applyConversationPayload` is still typed to `RestoredConversationPayload` from `chatConversationApi.ts`. | Split canonical restore state from transcript render state. `messages` becomes recent transcript/render state, not workspace authority. Remove transcript-shaped restore payload as the provider boundary. |
| `src/hooks/chat/useChatRestore.ts` | On mount calls `restoreActiveConversation` or by-id restore and dispatches `REPLACE_ALL`. | Replace with a restore read-model load. It may adapt `recentTranscript` to messages, but must not derive active jobs/assets from messages. |
| `src/hooks/chat/useChatConversationSession.ts` | `refreshConversation` calls transcript restore APIs and dispatches `REPLACE_ALL`. | Refresh must call the restore read model or a compatibility adapter that preserves the new authority boundaries. |
| `src/hooks/chat/chatConversationApi.ts` | Fetches `/api/conversations/active` or `/api/conversations/:id`, maps `conversation + messages + parts` into `RestoredConversationPayload`. | Introduce a new restore client or evolve this file behind a new `WorkspaceRestorePayload`; do not keep transcript payload as the restore source of truth. |
| `src/app/api/conversations/active/route.ts` | Calls `ConversationInteractor.getActiveForUser(userId)` and returns `{ conversation, messages }`. | May remain as compatibility/export transcript endpoint, but it cannot be homepage restore authority after Phase 03. |
| `src/app/api/conversations/[id]/route.ts` | GET returns `{ conversation, messages }`; PATCH/DELETE mutate conversation metadata/state. | By-id restore must use the restore read model; transcript GET may remain compatibility if clearly named/consumed. |

### Job And SSE Surfaces

| Surface | Current behavior | Phase 03 rule |
| --- | --- | --- |
| `src/hooks/chat/usePlatformChatInteraction.ts` | Composes `useChatSend`, `useChatJobEvents`, and `useBrowserCapabilityRuntime` around the same transcript message state. | This is the real migration seam. Phase 03 must split transcript send/runtime concerns from restore/job/read-model concerns instead of extending this coupling. |
| `src/hooks/chat/useChatJobEvents.ts` | Fetches `/api/chat/jobs`, subscribes to `/api/chat/events`, and upserts `JobStatusMessagePart` into chat messages. | Keep SSE as live transport only. Reconcile from durable job/read-model state and update restore/job view state, not canonical state hidden in message parts. |
| `src/app/api/chat/jobs/route.ts` | GET resolves conversation through `ConversationInteractor`, lists chat job snapshots/interactions; POST enqueues compose media. | GET can be replaced or narrowed by restore/job query surfaces. Avoid active conversation fallback that loads transcript just to find job state. |
| `src/app/api/chat/events/route.ts` | Resolves conversation through `ConversationInteractor`, falls back to `getActiveForUser`, then streams durable conversation events. | The stream is useful but should resolve conversation from restore/workspace identity without pulling transcript. Missed events must reconcile through restore or durable job queries. |
| `src/app/api/jobs/route.ts` | Uses `getPlatformInteractionFacade().listUserJobInteractions`, supports `activeOnly=true`, and filters with `getActiveJobStatuses()`. | This is the better durable pattern to copy for restore: platform facade plus durable reader, not message-part state. |
| `src/app/api/jobs/events/route.ts` | User-scoped durable event stream over `job_requests`/`job_events`. | Prefer this pattern for user-scoped restore reconciliation and sequence guarded reconnect behavior. |
| `src/components/jobs/useJobsEventStream.ts` | Fetches durable `/api/jobs`, subscribes to `/api/jobs/events`, sequence-guards events, and refetches on focus/visibility/error. | Copy this reconciliation shape for chat restore/job surfaces. The reducer may keep UI state, not invent authority. |
| `src/lib/jobs/job-event-stream.ts` | Generic SSE response factory over durable job events. | Keep as transport adapter. Do not encode restore decisions in SSE serialization. |

### Browser Runtime And Asset Surfaces

| Surface | Current behavior | Phase 03 rule |
| --- | --- | --- |
| `src/hooks/chat/useBrowserCapabilityRuntime.ts` | Scans `messages` for browser runtime candidates, rewrites `tool_result` parts as `job_status`, reads browser runtime cache, and can enqueue deferred compose-media recovery. | Browser runtime is disposable execution support. On restore it must only consider explicitly pending restore/runtime intents, never historical transcript parts. |
| `src/lib/media/browser-runtime/job-snapshots.ts` | `getBrowserRuntimeCandidates(messages)` pairs old `tool_call` and `tool_result` parts to infer work. | Keep only as a compatibility adapter for active in-session work until removed. It must not run against restored transcript history. |
| `src/hooks/chat/browserRuntimeJobStore.ts` | Module-local controllers and completed job ids. | Treat as process/browser-local convenience only. It cannot determine restored active work. |
| `src/hooks/chat/useAssetResolutionIndex.ts` | Builds chart/graph/audio lookup maps by scanning message `tool_result` parts. | This may remain presentation compatibility for recent transcript, but restore asset shelf/reusable assets must come from durable file/asset projections. |
| `src/hooks/chat/chatState.ts` | `REPLACE_ALL`, `UPSERT_JOB_STATUS`, and `REWRITE_TOOL_RESULT_AS_BROWSER_JOB` mutate the message list. | Chat reducer should become transcript/render reducer only. Job/workspace/asset restore reducers or stores should be separate so execution state stops piggybacking on message history. |

### Composition Roots And Existing Patterns

| Surface | Current behavior | Phase 03 rule |
| --- | --- | --- |
| `src/adapters/RepositoryFactory.ts` | Process-cached repository/read-model getters, including `getExecutionTimelineReader`, `getPlatformInteractionFacade`, and `getJobStatusQuery`. | Add restore reader/facade wiring here or in a conversation composition root. Do not import data mappers in core restore code. |
| `src/lib/chat/conversation-root.ts` | Request-scoped conversation runtime composition using `ConversationInteractor` and mappers. | Use only as a composition-root pattern. A restore route may use a restore composition root, but core restore readers cannot call `getDb()`. |
| `src/core/platform/execution/ExecutionTimelineReader.ts` | Repository-backed reader plus pure projectors, implements a narrow query interface. | Copy this style for `WorkspaceRestoreReader`: ports in, explicit projection out. |
| `src/core/platform/facade/PlatformInteractionFacade.ts` | Facade over execution timelines and job revisions. | Use as a model for a small restore facade only. Do not build a god facade that owns jobs, browser runtime, workflow, memory, and UI decisions. |

## Source Authority Matrix

| Restore field | Current source to use first | Forbidden source |
| --- | --- | --- |
| `workspace` | Phase 02 `WorkspaceSnapshotReader.findActiveByUser` or `findByConversationId` with user ownership. | `ConversationInteractor.getActiveForUser` as a shortcut; message arrays; browser storage. |
| `activeJobs` | `JobQueueRepository`/`ExecutionTimelineReader`/`PlatformInteractionFacade` filtered by `getActiveJobStatuses()`. | `JobStatusMessagePart` embedded in transcript; SSE cache; browser runtime maps. |
| `attentionNeededJobs` or `recentJobs` | Durable job snapshots/interactions for failed/canceled/succeeded review states. | Adding terminal jobs to `WorkspaceSnapshot.activeJobRefs`. |
| `assets` | Durable `UserFileRepository` and asset projection helpers from Phase 02/05. | `tool_result`, `job_status`, imported transcript JSON, browser session storage. |
| `workflow` | `BusinessWorkflowContextReader` or explicit null placeholder. | Lead/deal/referral/tool cards in old messages. |
| `operatorTransition` | Phase 02B/06 reader or explicit null placeholder. | Chat transcript narration. |
| `trustDistribution` | Referral/trust reader or explicit null placeholder. | QR/link/tool-card reconstruction from messages. |
| `memory` | `RelationshipMemoryReader` or summary reader, explicit null until available. | Re-summarizing full transcript on homepage load. |
| `recentTranscript` | `MessageRepository` recent slice for display only. | Full transcript replay as operational state. |
| `migration` | Identity/session migration service or explicit null placeholder. | Local browser cache or historical anonymous chat cards. |

## Restore Read Model Shape

Start from the target API shape in `restore-and-experience-spec.md`, but make
the Phase 03 implementation deliberately small and explicit.

Suggested contract:

```typescript
export interface WorkspaceRestorePayload {
  workspace: WorkspaceSnapshot | null;
  activeJobs: readonly JobStatusSnapshot[];
  attentionNeededJobs: readonly JobStatusSnapshot[];
  assets: readonly WorkspaceAssetRef[];
  workflow: BusinessWorkflowContextProjection | null;
  operatorTransition: OperatorTransitionProjection | null;
  trustDistribution: TrustDistributionProjection | null;
  memory: RelationshipMemorySummary | null;
  recentTranscript: TranscriptSlice;
  migration: IdentityMigrationStatus | null;
  restoreMeta: {
    schemaVersion: 1;
    restoredAt: string;
    source: "durable_read_model";
  };
}
```

Phase 03 can use placeholder/null projection types for later phases, but each
placeholder must be intentionally named and guarded. Do not fake workflow,
memory, migration, operator, or referral details from messages just to make the
payload look complete.

Recommended file shape:

- `src/core/platform/conversation-workspace/WorkspaceSnapshotReader.ts`
- `src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.ts`
- `src/core/platform/conversation-restore/WorkspaceRestoreReader.ts`
- `src/core/platform/conversation-restore/WorkspaceRestoreProjector.ts`
- `src/core/platform/conversation-restore/WorkspaceRestoreReader.test.ts`
- `src/core/platform/conversation-restore/WorkspaceRestoreProjector.test.ts`
- `src/app/api/workspace/restore/route.ts` or another clearly named restore
  route
- `src/hooks/chat/workspaceRestoreApi.ts` or a renamed/evolved client restore
  adapter

Do not bury this under `chatConversationApi.ts` without renaming the public
contract. The name should tell future maintainers that restore is workspace
continuity, not transcript continuity.

## Decide

Decide the endpoint shape and cutover strategy from code shape and testability,
not preference.

Default decision for the first implementation:

1. Land the missing Phase 02 workspace snapshot reader and projector if they
  are still absent when Phase 03 starts.
2. Add a new restore endpoint with an explicit name, such as
   `/api/workspace/restore`.
3. Keep `/api/conversations/active` and `/api/conversations/:id` as transcript
   compatibility endpoints until consumers are migrated.
4. Teach `useChatRestore`/`useChatConversationSession` to load the restore
   payload and adapt only `recentTranscript` into message state.
5. Move active job state out of `messages` into a restore/job slice consumed by
   chat presentation.
6. Prevent `useBrowserCapabilityRuntime` from scanning restored transcript
   history for executable candidates.

Rejected approaches:

- using browser session storage as authoritative restore state
- silently rerunning old tool results
- returning full transcript as the restore source of truth
- letting each hook re-infer canonical state independently from the restore read
  model
- treating SSE as the source of truth rather than live transport over durable
  job state
- reducing restore to chat continuity when business workflow context is
  available
- reconstructing QR/referral, first-run agency, or operator-transition state
  from chat tool cards
- adding a giant `RestoreService` singleton that imports adapters, hooks,
  projectors, and UI presenters in one place

## Clean Architecture, SOLID, And GoF Rules

Phase 03 must be Uncle Bob clean in the practical sense: dependencies point
inward, use cases are testable without Next.js or React, and policy does not
hide inside route handlers or hooks.

### Clean Architecture Rules

- Core restore contracts and projectors belong under `src/core/platform` or
  `src/core/use-cases` and import only entities, ports, and pure helpers.
- Concrete SQLite mappers stay in `src/adapters` and are wired through
  `RepositoryFactory` or a route composition root.
- Next.js route handlers authenticate, parse request inputs, call one restore
  reader/facade, and serialize JSON. They do not project workspace state.
- React hooks fetch, cache, subscribe, and render. They do not decide active
  work, reusable assets, workflow truth, or migration truth.
- Browser runtime code executes current client-capable work only when given a
  fresh runtime intent. It does not mine restored history for work.
- Transcript remains audit/display history. It is never the operational control
  plane.

### SOLID Rules

- Single Responsibility: `WorkspaceRestoreReader` composes read models;
  `WorkspaceRestoreProjector` shapes payloads; hooks render/cache/subscribe;
  routes serialize.
- Open/Closed: later phases add workflow, trust, prompt, memory, and asset
  projection readers by extending restore input, not rewriting chat hooks.
- Liskov Substitution: the restore reader must run against fake readers in
  deterministic tests and be replaceable by a persisted restore read model.
- Interface Segregation: depend on narrow readers such as
  `WorkspaceSnapshotReader`, `JobStatusQuery`, `BusinessWorkflowContextReader`,
  and `RelationshipMemoryReader`, not broad interactors.
- Dependency Inversion: high-level restore policy depends on ports and domain
  contracts; adapters depend on storage details.

### GoF Patterns To Use Deliberately

- Repository: durable conversations, jobs, files, workflow, memory, prompt, and
  referral state are read through repository/query ports.
- Data Mapper: SQLite row mapping stays behind existing or new adapter classes.
- Projector: pure restore projector converts explicit loaded state into
  `WorkspaceRestorePayload`.
- Facade: a small restore facade may compose workspace, jobs, assets, memory,
  and transcript slice for a route. It must not contain UI or browser runtime
  policy.
- Abstract Factory / Composition Root: use `RepositoryFactory` or a narrow
  restore composition root to assemble the restore reader from snapshot,
  workflow, operator, trust, jobs, and transcript readers without leaking
  concrete adapters into core restore code.
- Strategy: job grouping, asset ranking, transcript slicing, and placeholder
  projection rules should be replaceable pure strategies.
- Adapter: client restore adapter maps the restore payload into the current chat
  provider while the UI migrates.
- Null Object / Empty Projection: absent later-phase data returns null or empty
  arrays, never fake inferred objects.
- Observer: SSE hooks observe durable event streams and reconcile back to the
  restore/job read models.

### Patterns To Avoid

- Active Record: no domain object should save/query itself during restore.
- Service Locator in core: `RepositoryFactory` is acceptable at framework
  boundaries only, not inside core restore code.
- God Facade: do not create one object that owns restore, send, job enqueue,
  browser runtime, transcript rendering, and workflow mutation.
- Singleton domain state: browser/module maps are not durable restore truth.
- Template Method route logic: do not spread restore projection across multiple
  route callbacks.
- Message-part authority: `MessagePart`, `tool_result`, and `job_status` are
  render evidence, not restore authority.

## Hook, SSE, And Browser Runtime Rules

Homepage idempotency depends on changing hook ownership, not hiding old parts.

- `useChatRestore` should load one restore payload, then populate transcript
  render state from `recentTranscript` only.
- `useChatConversationSession.refreshConversation` should refresh from the same
  restore payload or a compatible restore reader, not from `conversation +
  messages` transcript APIs.
- `useGlobalChat` should stop exposing transcript-shaped restore helpers such as
  `applyConversationPayload(RestoredConversationPayload)` as the canonical
  continuity seam. The provider boundary should shift to a workspace restore
  shape plus a transcript adapter.
- `useChatJobEvents` should reconcile durable job snapshots into job/restore UI
  state. If it still emits `UPSERT_JOB_STATUS` for compatibility, that path must
  be explicitly transitional and covered by removal tests.
- `useBrowserCapabilityRuntime` must receive only fresh in-session candidates or
  explicit pending runtime intents from restore. It must not call
  `getBrowserRuntimeCandidates(restoredMessages)` on historical transcript.
- SSE reconnect must follow the `useJobsEventStream` pattern: remember last
  sequence, ignore stale events, and refetch durable state on visibility/focus,
  error, or reconnect gaps.
- Clearing browser storage must not lose active jobs, durable assets, workspace
  identity, workflow context, trust state, or migration status.

## Spec QA

Before coding, create or update restore cases:

- empty workspace
- active conversation with running job
- old successful media output
- failed job needing attention
- cleared browser session storage
- anonymous or migrating identity
- stale or empty browser runtime cache
- missed job event followed by restore reconciliation
- SSE disconnect and reconnect during active work
- hook remount after route transition or page reload
- lead, deal, referral, training, or setup origin context
- first-run, career-transition, or community-affiliate activation context
- referral QR/link readiness and recent trusted-introduction milestones
- interrupted or failed send with retryable business context
- completed notified work that should become a review action

## Build

Build the restore read model and wire the homepage to consume it in the
smallest safe slice.

Expected deliverables:

- missing Phase 02 workspace snapshot reader/projector if still absent at start
  of implementation
- restore query/read model over `WorkspaceSnapshotReader`, durable jobs,
  durable assets, optional workflow/memory/prompt/trust/migration readers, and
  recent transcript slice
- endpoint or server loader with explicit restore naming
- client restore adapter with a new workspace restore payload contract
- workflow context, operator transition, and trust distribution placeholders or
  projections in the restore response
- hook contract updates for restore, global chat state, browser runtime state,
  and job events
- SSE reconcile path that refreshes from durable job/read-model state
- idempotency guard against historical execution
- focused restore tests
- browser continuity test that records restore evidence
- release-evidence scenario entry for restore idempotency

Minimum test cases:

- no active workspace returns a restorable empty/null payload without throwing
- active workspace restores without reading full transcript as authority
- active queued/running jobs come from durable job state
- failed/canceled terminal jobs are exposed only as attention-needed/recent jobs
- old successful browser media in transcript does not rerun
- clearing browser storage does not hide active jobs or durable assets
- missed SSE events reconcile after refetch
- remount/reload does not duplicate jobs, browser runtime controllers, or job
  status messages
- by-id restore verifies user ownership and does not leak another user's
  workspace
- import/export transcript compatibility still works without becoming homepage
  restore authority

## Remove Before Phase 03 Is Complete

Phase 03 is complete only when homepage restore no longer depends on executable
transcript replay. Remove or quarantine all of the following before closing the
phase:

- homepage restore reliance on `/api/conversations/active` returning
  `{ conversation, messages }`
- `RestoredConversationPayload` as the homepage continuity contract in
  `src/hooks/chat/chatConversationApi.ts` and `src/hooks/useGlobalChat.tsx`
- `useChatRestore` dispatching `REPLACE_ALL` from transcript restore as the
  canonical restore operation
- `useChatConversationSession.refreshConversation` using transcript endpoints as
  the primary refresh path
- `useGlobalChat.applyConversationPayload(...)` as the main restore entrypoint
- `usePlatformChatInteraction` coupling restore-era transcript state, SSE job
  reconciliation, and browser runtime execution in one seam without a separate
  restore/job state boundary
- any active-job derivation from `MessagePart`, `tool_result`, `job_status`, or
  restored `ChatMessage[]`
- any reusable-asset restore derivation from transcript tool results or browser
  runtime cache
- any `useBrowserCapabilityRuntime` execution pass over restored historical
  messages
- any browser runtime deferred recovery enqueue triggered solely by historical
  transcript content
- any continued dependence on `chatState.ts` actions `REPLACE_ALL`,
  `UPSERT_JOB_STATUS`, or `REWRITE_TOOL_RESULT_AS_BROWSER_JOB` as the only place
  canonical restore/job truth is represented
- any SSE hook behavior that treats the latest event stream cache as more
  authoritative than durable job/read-model refetch
- any route-facing restore code that calls `ConversationInteractor.getActiveForUser`
  just to discover workspace identity or job state
- any Phase 03 closure without a real `WorkspaceSnapshotReader` implementation
  wired into the restore path
- any core restore/projector import of React hooks, Next.js route types,
  `DataMapper` classes, `getDb()`, browser runtime modules, or UI renderers
- any fake workflow, first-run, referral, operator-transition, migration, or
  memory state reconstructed from chat cards

Compatibility exceptions must be named, tested, and shrink-only. For example,
`/api/conversations/active` may remain for transcript import/export or legacy
callers, but the homepage cannot depend on it as restore authority.

## Phase QA

Before implementation, confirm that active work comes from durable job state and
not transcript message parts.

Also confirm that hooks are projections over the restore read model and durable
job events. Hooks may cache, subscribe, and render, but they must not invent a
second operational truth.

Confirm that first-run, QR/referral, and trusted-introduction state come from
their owning services and projections, not historical tool cards.

## Implementation QA

Required validation:

- restore endpoint tests
- restore projector/reader tests with fake ports
- hook or client restore tests
- browser or integration proof that repeated homepage loads create no jobs
- proof that clearing browser storage does not lose active jobs or assets
- regression test for old successful media not rerunning
- SSE disconnect/reconnect test proving missed events reconcile from durable
  state
- hook remount test proving restored state is stable across reload or route
  transition
- evidence bundle proving the restored state came from canonical read models,
  not executable transcript parts
- browser proof that business workflow context appears without transcript
  re-derivation, even if Phase 03 returns an explicit null placeholder
- proof that referral QR/link and trusted-introduction state restore without
  transcript tool-card re-derivation, even if Phase 03 returns an explicit null
  placeholder

Suggested evidence updates:

- add a Phase 03 entry to `release/conversation-refactor-evidence.json`
- extend `npm run qa:conversation-refactor` to include restore idempotency tests
- add architecture canaries that reject forbidden imports in
  `src/core/platform/conversation-restore/*`
- add a browser-level evidence scenario for repeated homepage restore with an
  old browser-runtime-capable transcript

## Update

After completion, update Phase 04, Phase 05, Phase 06, Phase 08, and Phase 10
with any restore gaps around job reuse, asset shelf quality, business workflow
context, operator transition, trust distribution, relationship memory, prompt
binding, or transcript presentation.
