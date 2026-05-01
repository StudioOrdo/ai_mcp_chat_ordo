# Compose Media Execution Ownership Contract Spec

## Objective

Make `compose_media` execution definitive, idempotent, and restore-safe.

The system must produce at most one canonical video output for one semantic
compose request unless the user explicitly requests a new variation, replay, or
different plan. Chat transcript entries must never independently re-trigger
media execution after the command has been accepted.

This is an architectural refactor, not a cosmetic UI fix. The root problem is
that conversation transcript parts currently act as both render history and
executable runtime state. That creates duplicate execution paths between browser
runtime, server/deferred jobs, materialization records, and restore logic.

## Incident Grounding

### User And Conversation

- User: `keith@firehose360.com`
- User ID: `usr_0159221e-4c1a-4aa7-b467-da1342e943ea`
- Conversation ID: `conv_e048ce6b-b446-4e92-a56f-f60da6e4499c`
- User request timestamp: `2026-04-30T03:12:57.358Z`
- User request: `Combine the training audio with the luminous flesh image into a video`

### Observed Outputs

One request produced more than one video-facing result:

1. Server/deferred compose job output:
   - Job: `job_6a9c6ba7-4e80-4c48-b498-16e735931386`
   - Output asset: `uf_390e54f4-5161-4461-9732-7bbbafbc631c`
   - Created at: `2026-04-30 03:13:16`
   - Metadata: `{"assetKind":"video","source":"generated","toolName":"compose_media","retentionClass":"conversation"}`
   - File: `e8d89d311062f9fbe99e21c0d6221227.mp4`
   - Size: `961786`

2. Browser/client uploaded output:
   - Output asset: `uf_b8110e05-c7b4-4d8a-8498-b46aa6fbf247`
   - Created at: `2026-04-30 03:13:27`
   - Metadata: `{"assetKind":"video","source":"uploaded","toolInvocationId":"toolu_01W6HQ719Uv5q2SMoGJBWsNX","retentionClass":"conversation"}`
   - File: `bfecebf039114aff5512b5db2d28b212.mp4`
   - Size: `1277365`

3. Stale transcript/runtime surface:
   - Message: `msg_15f973ac-32a3-4253-8290-66d53e016374`
   - Tool result contains `generationStatus: "client_fetch_pending"`
   - This can render as a third processing/composition surface even after the
     server job has already completed.

### Important Trace Detail

The browser-uploaded duplicate video is tied to tool invocation
`toolu_01W6HQ719Uv5q2SMoGJBWsNX`.

That invocation was the first `compose_media` call in
`msg_15f973ac-32a3-4253-8290-66d53e016374`, whose tool result was:

```json
{
  "ok": false,
  "action": "media_asset_discovery_required",
  "error": "Call list_conversation_media_assets before compose_media, then pass the returned assetId values exactly into the composition plan."
}
```

The browser runtime still treated the paired `tool_call` args as an executable
compose candidate.

## Five Whys

1. Why did one request produce multiple video surfaces?
   - Because the same compose intent executed through both server/deferred and
     browser/client runtime paths, and the transcript retained a pending
     browser-runtime result.

2. Why did both runtime paths execute?
   - Because `compose_media` is modeled as hybrid. The tool result can return
     `client_fetch_pending`, and `useBrowserCapabilityRuntime` scans transcript
     tool results to decide what to execute locally while server/deferred jobs
     can also run the same semantic plan.

3. Why did browser runtime execute a failed discovery-required call?
   - Because browser candidate discovery pairs `tool_call` and `tool_result`,
     then uses the original tool call args as executable payload. It does not
     treat `{ ok:false, action:"media_asset_discovery_required" }` as terminal
     non-executable state.

4. Why did dedupe not stop the duplicate?
   - Server jobs dedupe through a canonical compose materialization key in
     `job_requests`. Browser runtime uses synthetic job IDs derived from message
     structure, such as `browser:${messageId}:compose_media:${resultIndex}`.
     Those identity systems are not reconciled before execution.

5. Why is this architectural?
   - The conversation transcript is serving three incompatible roles:
     user-visible history, tool execution log, and resumable runtime queue. That
     lets restored messages, failed tool results, pending client artifacts, and
     server job snapshots race each other.

## Root Cause

`compose_media` does not have a single authoritative execution owner.

Executable state is inferred from transcript parts, while durable job state is
held in `job_requests` and durable output state is held in
`materialization_records` and `user_files`. The browser and server paths can
therefore act on the same semantic compose command without sharing one
idempotency ledger.

## Source Authority

| Concern | Current owner | Problem |
| --- | --- | --- |
| Tool result shape | `src/core/use-cases/tools/compose-media.tool.ts` | Returns `client_fetch_pending`, which is executable UI/runtime state rather than a job reference. |
| Browser runtime discovery | `src/lib/media/browser-runtime/job-snapshots.ts` | Scans transcript parts and creates synthetic runtime jobs from message structure. |
| Browser runtime execution | `src/hooks/chat/useBrowserCapabilityRuntime.ts` | Starts local execution based on transcript candidates and persisted browser runtime state. |
| Server/deferred execution | `src/lib/jobs/compose-media-deferred-job.ts` | Creates canonical job/materialization identity, but only for server path. |
| Job queue API | `src/app/api/chat/jobs/route.ts` | Already handles active job reuse and exact materialization reuse for deferred compose, but is not the single entry point for every compose execution. |
| Materialization registry | `src/lib/jobs/materialization-registration.ts` and `src/lib/jobs/materialization-key.ts` | Registers successful server jobs, but browser uploads can bypass the same job ownership contract. |
| Materialization key | `src/lib/jobs/materialization-key.ts` | Already defines the canonical semantic key using normalized clips, profile, policies, output format, and resolution. The refactor should reuse this rather than invent a second key. |
| Chat rendering | `src/frameworks/ui/chat/ToolPluginPartRenderer.tsx` and media cards | Renders transcript-derived and job-derived states together. |
| Job render merging | `src/lib/chat/JobRenderCandidateMerger.ts` | Merges job render candidates by job ID, but cannot merge synthetic browser jobs with canonical server jobs because their IDs are unrelated. |
| Jobs rail projection | `src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts` | Dedupes by job ID only; duplicate synthetic/canonical compose jobs can both affect counts and UI state. |
| Restore behavior | `src/hooks/chat/useChatRestore.ts`, `src/hooks/chat/useChatConversationSession.ts`, browser runtime state | Restored transcript parts can remain executable-looking. |

## Existing Code To Preserve

The codebase already has several pieces of the correct architecture. The
refactor should consolidate around them rather than replace them:

- `buildComposeMediaMaterializationKey` in
  `src/lib/jobs/materialization-key.ts` is the canonical semantic idempotency
  key.
- `enqueueComposeMediaDeferredJob` in
  `src/lib/jobs/compose-media-deferred-job.ts` already performs plan
  normalization, active job reuse, exact materialization reuse, and queued job
  creation for the deferred path.
- `POST /api/chat/jobs` in `src/app/api/chat/jobs/route.ts` already handles
  exact materialization reuse and creates a conversation-local alias when a
  reusable materialization belongs to another conversation.
- `registerComposeMediaMaterialization` in
  `src/lib/jobs/materialization-registration.ts` already converts a successful
  compose job into a reusable materialization record.
- `job_events` already provide an append-only timeline suitable for projection.

The target is to make every compose execution path use these authorities.

## Target Architecture

### Principle

`job_requests`, `job_events`, and `materialization_records` are the source of
truth for compose execution.

Conversation messages are a render projection. They may contain references to
jobs and artifacts, but they must not be independently executable after being
persisted.

The browser runtime may remain a valid executor, but only as an executor for a
canonical job. It must not infer its own job from message IDs or result indexes.

### Command Flow

The desired flow is:

```text
User intent
  -> ComposeMediaCommand
  -> ComposeMediaCommandHandler
  -> canonical plan normalization
  -> materialization key resolution
  -> find reusable materialization OR create/reuse one job
  -> execution target assignment
  -> executor claims job
  -> output persisted through materialization registry
  -> UI renders job/materialization projection
```

The forbidden flow is:

```text
messages
  -> scan tool_result
  -> infer executable candidate
  -> start browser/server runtime
```

### Domain Model

#### ComposeMediaCommand

Represents user intent to create or reuse a composed video.

Required fields:

- `conversationId`
- `userId`
- `plan`
- `requestedByMessageId`
- `toolInvocationId` when available
- `idempotencyScope`
- `requestedAt`

Optional fields:

- `requestedVariationReason`
- `replayOfJobId`
- `preferredExecutionTarget`
- `promptBindingId`

Recommended home:

- Application service under `src/core/use-cases` or `src/lib/jobs`, depending on
  existing dependency direction.
- It should depend on existing repository interfaces, not on React hooks,
  transport-layer request objects, or UI state.

#### ComposeMediaJob

Backed by `job_requests`.

Required fields:

- `id`
- `conversationId`
- `userId`
- `toolName = "compose_media"`
- `status`
- `dedupeKey`
- `executionTarget` stored either as a first-class column or as a validated
  field inside `requestPayloadJson`
- `requestPayloadJson`
- `createdAt`
- `updatedAt`

Execution target must be explicit:

- `browser_wasm`
- `media_worker`
- `deferred_remote`
- `native_process`

Only one target may own a job at a time.

If `executionTarget` remains inside `requestPayloadJson` during migration, it
must still be treated as part of the job contract and validated before any
executor claims work. A later schema cleanup may promote it to a column.

#### ComposeMediaMaterialization

Backed by `materialization_records`.

Required fields:

- `materializationKey`
- `toolName = "compose_media"`
- `status`
- `inputSourceRefs`
- `outputRefs`
- `producedByJobId`
- `reusePolicy`

The materialization key must be generated from the normalized semantic plan,
not from message IDs or runtime-specific payload shape.

## Contract Rules

1. `compose_media` must create or reference one canonical job for one semantic
   plan.
2. Browser runtime must not execute compose work directly from transcript
   parts.
3. Browser runtime may execute only a job explicitly assigned to a browser
   execution target.
4. Server/deferred runtime may execute only a job explicitly assigned to a
   server/deferred execution target.
5. If browser execution fails or is unavailable, fallback must transition the
   same job or create a child job linked by `replayed_from_job_id`; it must not
   create an unrelated transcript-derived execution.
6. `client_fetch_pending` must not be persisted as an executable state for
   `compose_media`.
7. Failed tool results such as `media_asset_discovery_required` are terminal
   instruction states, not executable runtime candidates.
8. Existing restored transcript entries with `client_fetch_pending` must be
   treated as legacy render-only artifacts unless linked to a live canonical
   job.
9. UI job cards must be projected from canonical job/materialization state.
10. Jobs rail counts must be based on canonical job state, not transcript scan
    count.
11. `job_requests.dedupe_key` and `materialization_records.materialization_key`
    must use the same canonical materialization key for `compose_media`.
12. A browser-uploaded compose output must include enough lineage to connect it
    to the owning job and materialization record. At minimum: `producedByJobId`
    or equivalent job evidence, `toolName: "compose_media"`, and the canonical
    materialization key.
13. A transcript part may contain a `jobId`, but if the job cannot be found in
    canonical job state, it must render as legacy/stale rather than execute.
14. A replay must be explicit. Automatic repair of stale transcript state must
    not enqueue or run media jobs.

## Architectural Invariants

These invariants should become tests:

- One semantic compose plan maps to one canonical materialization key.
- One active canonical compose job exists per conversation and materialization
  key.
- One completed canonical compose job registers at most one ready
  materialization record unless a newer explicit replay supersedes it.
- One chat render surface for a compose output is selected from canonical job
  and materialization state, not from every matching transcript part.
- A failed validation/discovery tool result is never executable.
- A restored conversation is observational until the user issues a new command.
- The jobs rail never counts `browser:*` synthetic compose IDs as canonical
  active jobs after this refactor.

## Design Pattern Mapping

| Pattern | Use |
| --- | --- |
| Command | `ComposeMediaCommand` captures intent once. |
| Repository | Job/materialization/user-file persistence behind interfaces. |
| Strategy | Browser/server/native execution target implementations. |
| State | Job lifecycle transitions. |
| Observer | UI subscribes to job events. |
| Projection | Chat cards and jobs rail derive display state. |
| Unit of Work | Command handler normalizes plan, resolves idempotency, and creates/reuses job atomically. |
| Adapter | Browser worker, media worker, native process share one executor contract. |

## Implementation Plan

### Phase 1: Freeze Transcript-As-Executor Behavior

- Identify every path where persisted messages are scanned for executable
  `compose_media` candidates.
- Document which runtime candidates are needed for legacy browser-only tools and
  which are only historical restore artifacts.
- Add tests proving failed/discovery-required compose results are not executable
  candidates.
- Add tests proving a canonical server job snapshot suppresses same-plan
  browser execution.
- Add tests proving restored `client_fetch_pending` compose results render as
  stale/legacy unless linked to a live canonical job.

This phase may include temporary guardrails, but they are not the final
architecture.

### Phase 2: Introduce Compose Command Handler

- Create a compose command/application service that owns:
  - plan normalization
  - semantic materialization key generation
  - active job reuse
  - reusable materialization lookup
  - execution target assignment
  - job creation
- Reuse `buildComposeMediaMaterializationKey` and the existing
  `enqueueComposeMediaDeferredJob` behavior where possible.
- Route `compose_media` tool execution through this handler.
- Tool result should return a canonical job/materialization reference, not
  `client_fetch_pending`.

The handler output should be one of:

```ts
type ComposeMediaCommandResult =
  | { outcome: "queued"; jobId: string; materializationKey: string }
  | { outcome: "active_equivalent"; jobId: string; materializationKey: string }
  | { outcome: "exact_reuse"; jobId: string | null; materializationId: string; materializationKey: string };
```

The handler must not return executable browser payloads.

### Phase 3: Unify Runtime Execution Around Job Claims

- Browser runtime must claim a canonical job before doing work.
- Server/deferred worker must claim the same job model.
- Runtime adapters must emit the same job events and materialization outputs.
- Browser upload output must register against the owning job and
  materialization key.
- If browser execution is still supported, introduce a browser job claim API or
  equivalent signed job handoff. The browser should receive `jobId`,
  `materializationKey`, and validated plan from the server instead of deriving
  work from transcript parts.
- Browser completion must call a completion endpoint that records the output
  against the canonical job before the UI renders success.

### Phase 4: Convert Chat To Projection

- Chat messages should render:
  - job references
  - latest job event snapshots
  - materialization/artifact references
- Chat restore must not restart compose work from historical tool results.
- Existing legacy `client_fetch_pending` compose results should display as
  stale/legacy if no canonical job exists.
- `JobRenderCandidateMerger` should prefer canonical job IDs and should not
  merge or promote synthetic browser compose IDs after this refactor.
- `resolveJobsRail` should receive canonical job entries only for compose media.

### Phase 5: Cleanup And Migration

- Remove compose execution from transcript scanner.
- Delete or narrow synthetic browser job IDs for `compose_media`.
- Backfill or ignore existing legacy transcript states according to migration
  policy.
- Ensure jobs rail, diagnostics, and media library all point at the canonical
  job/materialization state.

## Dead Code And Cleanup Targets

The implementation is not complete until obsolete compose-specific runtime code
is either removed or narrowed with tests proving why it remains.

Cleanup candidates:

- `compose_media` handling in
  `src/lib/media/browser-runtime/job-snapshots.ts`
  - Remove synthetic `browser:${messageId}:compose_media:${resultIndex}` as an
    execution identity.
  - Keep projection helpers only if they render canonical job state.
- `compose_media` execution branch in
  `src/hooks/chat/useBrowserCapabilityRuntime.ts`
  - Remove transcript-derived execution.
  - Replace with canonical job-claim execution if browser execution remains.
- `client_fetch_pending` return shape in
  `src/core/use-cases/tools/compose-media.tool.ts`
  - Replace with canonical command/job result.
- Browser upload metadata for compose outputs
  - Stop recording compose outputs as generic `source: "uploaded"` without job
    lineage.
  - Preserve upload support for genuine user uploads.
- Session storage state in
  `src/lib/media/browser-runtime/browser-runtime-state.ts`
  - It must not persist compose execution ownership independently of canonical
    jobs.
- Any UI code that counts or renders compose cards from raw transcript parts
  when a canonical job/materialization exists.

Do not delete browser FFmpeg or media worker code merely because it participated
in the incident. The problem is ownership, not the existence of multiple
execution strategies.

## Schema And Persistence Notes

Preferred schema additions:

- Add `execution_target` to `job_requests`, or strictly validate
  `request_payload_json.executionTarget` during a transition period.
- Add output job lineage to browser-created user files:
  - `produced_by_job_id` if a column is introduced, or
  - metadata fields with `toolName`, `jobId`, `materializationKey`, and
    `retentionClass`.

If columns are added, migrations should preserve existing rows and classify
legacy browser-uploaded compose videos as historical artifacts, not canonical
job outputs unless they can be matched to a materialization/job by evidence.

## Migration Policy

Existing persisted transcript entries with `compose_media` and
`generationStatus: "client_fetch_pending"` must not be treated as executable
after this refactor.

Migration options:

1. Preferred: create read-only legacy projection state at render time.
2. Acceptable: one-time migration that links legacy transcript entries to
   canonical jobs when a clear `job_requests` or `materialization_records` match
   exists.
3. Not acceptable: replaying historical compose tool results to "repair" the
   transcript.

Legacy video rows with `metadata.source = "uploaded"` and a compose
`toolInvocationId` should be treated as historical artifacts unless a canonical
job/materialization link can be proven. They should not be promoted to canonical
outputs by filename, timestamp proximity, or UI order alone.

## Positive Cases

- A user asks for one video and one canonical compose job is created.
- The same request submitted twice while active returns the same active job.
- The same semantic plan after completion returns the reusable materialization
  unless the user explicitly requests a variation.
- Browser execution succeeds and registers output through the same
  materialization record as server execution would.
- Server execution succeeds and chat/jobs rail show one result.
- Browser fallback creates a linked state transition, not an unrelated duplicate.
- Restore shows existing job/materialization state without restarting execution.

## Negative Cases

- Do not execute `compose_media` from a historical transcript scan.
- Do not let `media_asset_discovery_required` become an executable browser job.
- Do not create independent browser and server outputs for the same semantic
  plan.
- Do not use message IDs or result indexes as the primary compose idempotency
  boundary.
- Do not let jobs rail count transcript-derived pending compose states as active
  jobs.
- Do not persist `client_fetch_pending` as a durable source of execution truth.

## Edge Cases

- User explicitly asks for a variation of the same plan.
- User asks to replay a failed job.
- Browser starts work and the tab closes.
- Browser starts work and server fallback is required.
- Server job is already running when browser sees a stale transcript result.
- Completed materialization exists but the original chat message is missing.
- Durable blog image assets are not `user_files` but are valid compose inputs.
- Existing `uploaded` video rows created by browser runtime lack a
  `produced_by_job_id`.
- `POST /api/chat/jobs` exact reuse returns a reused job snapshot from a prior
  materialization; UI must render one result in the current conversation, not
  both the old producing job and a new synthetic card.
- A browser tab has a stale `studioordo.browser-runtime.v1` session storage
  entry for a compose run that now has a completed canonical server job.
- Two assistant messages contain the same normalized plan because the model
  first called `compose_media`, received `media_asset_discovery_required`, then
  called `list_conversation_media_assets`, then called `compose_media` again.

## Validation Commands

Focused validation should include:

```bash
npm exec vitest run \
  src/lib/media/browser-runtime/job-snapshots.test.ts \
  src/hooks/chat/useBrowserCapabilityRuntime.test.tsx \
  src/lib/jobs/compose-media-deferred-job.test.ts \
  src/lib/jobs/deferred-job-worker.test.ts \
  src/lib/jobs/materialization-registration.test.ts \
  src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts
```

Broader validation should include:

```bash
npm exec vitest run \
  src/core/capability-catalog/runtime-tool-binding.test.ts \
  src/lib/chat/registry-sync.test.ts \
  src/lib/media/server/compose-media-worker-runtime.test.ts \
  src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts \
  tests/chat/chat-stream-route.test.ts
```

Browser validation should verify:

- one user compose request creates one canonical job
- exactly one video artifact appears for that job
- reload/restore does not restart compose
- jobs rail active count reflects canonical jobs only
- legacy `client_fetch_pending` transcript entries do not launch execution
- browser session storage containing an old compose runtime entry does not
  restart or duplicate a canonical completed job

## QA Checklist

Before implementation begins, confirm:

- The spec reuses `buildComposeMediaMaterializationKey`.
- The spec reuses or centralizes `enqueueComposeMediaDeferredJob` behavior
  rather than creating a second command path.
- The chosen command handler has no React dependency.
- The transcript scanner has no authority to enqueue, claim, or start
  `compose_media`.
- Browser execution, if retained, has a server-issued canonical job claim.
- Exact reuse and active dedupe behavior in `POST /api/chat/jobs` are preserved.
- Dead code removal is part of the definition of done, not a follow-up.

## Definition Of Done

The refactor is complete when:

- `compose_media` execution has one canonical job owner per semantic plan
- all runtime targets claim canonical jobs before executing
- all outputs register through one materialization path
- chat transcript parts are render-only for compose execution
- restore cannot restart historical compose work
- failed discovery/tool-validation states cannot become executable runtime jobs
- duplicate video creation for one compose request is prevented by architecture,
  not by a UI-only filter
- obsolete transcript-derived compose execution paths are removed or narrowed to
  render-only code
- legacy duplicate artifacts remain auditable but cannot trigger new execution
- focused and broader tests pass
