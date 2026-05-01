# Phase 09b - Canonical Job Read Model

## Goal

Make the job read model complete enough that chat, jobs rail, jobs workspace,
notifications, restore, and admin diagnostics can render job state without
reading transcript `job_status` parts.

After this phase, a job snapshot is the only product-renderable representation
of job lifecycle state.

## Current Codebase Grounding

Useful existing seams:

- `src/lib/jobs/job-read-model.ts`
- `src/core/platform/execution/ExecutionTimelineReader.ts`
- `src/core/platform/facade/PlatformInteractionFacade.ts`
- `src/adapters/JobQueueDataMapper.ts`
- `src/core/entities/job.ts`
- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`
- `src/lib/jobs/job-publication.ts`
- `src/lib/jobs/job-status.ts`
- `src/lib/jobs/job-status-snapshots.ts`
- `src/lib/jobs/job-status-part-merge.ts`
- `src/lib/jobs/deferred-job-result.ts`
- `src/app/api/chat/jobs/route.ts`
- `src/hooks/chat/useJobStateStore.ts`
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts`
- `src/lib/jobs/materialization-registration.ts`
- `src/core/entities/materialization.ts`
- `src/core/use-cases/tools/blog-image.tool.ts`
- `src/lib/media/browser-runtime/job-snapshots.ts`

The read model had much of the right shape, but product surfaces still fell
back to transcript parts for renderable state. This phase removes that need by
making every job snapshot carry complete presentation, origin, result, and
artifact data.

Current implementation facts after 09b QA:

- `src/lib/jobs/job-read-model.ts` exports `CanonicalJobSnapshot` as the
  product DTO; the old `{ messageId, conversationId, part }` product snapshot
  shape has been removed.
- `buildCanonicalJobSnapshot(...)` emits top-level lifecycle, presentation,
  origin, ownership, result, artifact, materialization, and failure fields.
- `job_requests` persists `origin_message_id`, `origin_turn_id`, and
  `tool_invocation_id`; `JobQueueDataMapper` reads and writes those fields.
- `buildCanonicalJobSnapshot(...)` classifies origin by explicit origin,
  tool-invocation origin, or `job_created_at` fallback. Event-payload-only
  `toolInvocationId` is no longer a product read-model fallback.
- `ExecutionTimelineReader` is the read path behind `JobStatusQuery`; it builds
  canonical `snapshot`, diagnostic `timeline`, and diagnostic `history`
  together.
- `/api/chat/jobs` returns `jobs` as the only product contract. The route no
  longer returns full `interactions`; diagnostic interaction data remains under
  diagnostics/admin surfaces.
- `MaterializationRepository.findByProducedJobId(...)` is implemented and wired
  into `ExecutionTimelineReader`, so reusable outputs are joined into
  `materializationRefs` on canonical snapshots.
- `buildCanonicalJobSnapshot(...)` redacts sensitive `inputSnapshot` fields and
  never exposes raw `requestPayload` directly through the product snapshot.
- Compose-media materialization is registered in
  `registerComposeMediaMaterialization(...)`; generated asset refs are projected
  through `resultEnvelope.artifacts` and materialization refs where durable
  materializations exist.

## QA Findings

| Finding | Code-grounded proof | Resolution |
| --- | --- | --- |
| Product snapshot shape must not be a message-part wrapper. | `src/lib/jobs/job-read-model.ts` now exports `CanonicalJobSnapshot` and `buildCanonicalJobSnapshot(...)`. | Resolved. Product routes and read queries return top-level canonical fields. |
| Origin metadata must be durable. | `JobRequest`/`JobRequestSeed` include `originMessageId`, `originTurnId`, and `toolInvocationId`; `JobQueueDataMapper` persists matching columns. | Resolved. Origin classification is deterministic and row-backed. |
| Product chat route must not expose diagnostic interactions. | `src/app/api/chat/jobs/route.ts` returns `{ ok, conversationId, jobs }` from canonical snapshots. | Resolved. Full interaction history remains diagnostic/admin-only. |
| Materialization data must be joined into snapshots. | `MaterializationDataMapper.findByProducedJobId(...)` exists and `ExecutionTimelineReader` passes the record into `buildCanonicalJobSnapshot(...)`. | Resolved. `materializationRefs` are populated for reusable outputs. |
| Raw request payload must not leak through product snapshots. | `redactJobInputSnapshot(...)` is applied to envelope and fallback request input. | Resolved. Sensitive keys are redacted before route serialization. |
| Result projection should stay centralized. | `buildCanonicalJobSnapshot(...)` reuses `buildJobPublication(...)` while exposing canonical top-level fields. | Resolved. Projection is reused without preserving message-part shape as the product DTO. |
| User scoping must be visible in the snapshot. | `CanonicalJobSnapshot.ownership` includes `userId`, `visibility`, and `initiatorType`. | Resolved. Query paths still enforce user/conversation authorization. |
| Remaining stream/message bridges must be explicit. | `canonicalJobSnapshotToStatusPart(...)` and transcript normalizers remain only as bridge helpers. | Resolved by 09c/09d for product state. Any retained status-part conversion is an internal renderer/diagnostic adapter and cannot become a persistence, restore, or product DTO source. |

## Required Snapshot Contract

Each product-renderable job snapshot must include:

- `jobId`
- `conversationId`
- `userId` or an explicit anonymous/ownership-transfer state
- `toolName`
- `label`
- `status`
- `sequence`
- `updatedAt`
- `createdAt`, `startedAt`, and `completedAt`
- `origin` object:
  - `originMessageId` when a persisted user/assistant message caused the job
  - `originTurnId` when a prompt provenance turn caused the job
  - `toolInvocationId` when the job came from an assistant tool call
  - documented fallback placement only for system/repaired jobs where no chat
    origin exists by design
- redacted `inputSnapshot`; raw `requestPayload` is allowed only in
  diagnostic/admin contexts
- `resultPayload` for terminal jobs when available
- `resultEnvelope` for all renderable job cards
- `artifactRefs` for generated media/assets
- `materializationRefs` when outputs are reusable
- `visibility`, ownership, and transfer metadata
- `failureClass`, `recoveryMode`, and retry metadata for failures
- `timelineRef` or `historyRef` for diagnostics, without forcing default chat
  rendering to consume full execution timelines

If any product surface needs transcript inspection to render a normal job card,
this phase is incomplete.

## Target DTO Shape

09b hard-cuts to this product-facing shape. The old
`JobStatusSnapshot { messageId, part }` wrapper is not a product DTO. Product
code must not use `JobStatusMessagePart` as a persistence, restore,
reconciliation, or read-model contract. A temporary internal adapter from
`CanonicalJobSnapshot` to existing job-card renderer props is acceptable only
inside the presentation boundary while the source of truth remains canonical
snapshots.

```ts
interface CanonicalJobSnapshot {
  jobId: string;
  conversationId: string;
  userId: string | null;
  toolName: string;
  label: string;
  title?: string;
  subtitle?: string;
  status: JobStatus;
  sequence: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  origin: {
    originMessageId?: string;
    originTurnId?: string;
    toolInvocationId?: string;
    fallback: "explicit_origin" | "tool_invocation" | "job_created_at";
  };
  inputSnapshot: Record<string, unknown>;
  resultPayload?: unknown;
  resultEnvelope: CapabilityResultEnvelope | null;
  artifactRefs: readonly CapabilityArtifactRef[];
  materializationRefs: readonly string[];
  ownership: {
    userId: string | null;
    visibility: "owner" | "anonymous_session" | "admin";
    initiatorType: JobInitiatorType;
  };
  failure: {
    failureClass: JobFailureClass | null;
    recoveryMode: JobRecoveryMode | null;
    nextRetryAt: string | null;
    lastCheckpointId: string | null;
    replayedFromJobId: string | null;
    supersededByJobId: string | null;
  };
}
```

The exact exported type can differ, but the semantics above must be present and
covered by tests.

## Architecture Principles

- SOLID:
  - Single responsibility: job read-model construction lives in job code, not
    chat presentation code.
  - Open/closed: new capability families add presentation descriptors and
    envelope projection without changing the core snapshot contract.
  - Interface segregation: chat restore consumes a small snapshot DTO, not DB
    entities.
- DRY:
  - One canonical job DTO.
  - One freshness comparator.
  - One envelope projection path.
  - One materialization/artifact enrichment path shared by chat, jobs rail, and
    jobs workspace.
- GoF patterns:
  - Builder: construct `CanonicalJobSnapshot` from `JobRequest + latest
    JobEvent + optional materialization/assets`.
  - Adapter: route handlers serialize snapshots for browser consumers.
  - Strategy: capability-specific envelope projection remains descriptor-driven.
  - Facade: `PlatformInteractionFacade` can expose diagnostics/timelines while
    product chat consumes the smaller snapshot DTO.
  - Repository: job, event, materialization, and asset reads stay behind
    repository interfaces rather than leaking SQL into presenters.

## Implementation Steps

1. Add a `CanonicalJobSnapshot` contract in job read-model code. Do not place
   the canonical contract in chat/presenter modules.
   Delete or rename the current `JobStatusSnapshot` product type rather than
   adapting it.
2. Add durable origin metadata. Preferred greenfield shape is a normalized
   `origin_json` or explicit columns on `job_requests` for
   `origin_message_id`, `origin_turn_id`, and `tool_invocation_id`. Do not make
   event-payload derivation a product fallback; it can exist only in tests or
   one-time repair/backfill code.
3. Update `JobRequest`, `JobRequestSeed`, and `JobQueueDataMapper` so enqueue
   paths can write the origin once instead of relying on event payloads.
4. Update `enqueueDeferredToolJob(...)` and compose-media enqueue paths to pass
   `toolInvocationId`; wire message/turn ids when available from stream
   execution or prompt provenance.
5. Preserve the useful projection logic from
   `buildJobPublication(...)`/`buildJobStatusPartFromProjection(...)`, but move
   it behind a canonical builder that emits top-level snapshot fields instead
   of `part`. Any message-part projector that remains must be diagnostic-only
   and outside the default product path.
6. Add a materialization/artifact enrichment reader. For compose media, join
   `materialization_records` by `produced_by_job_id`. For generated images,
   project stable image artifact refs from `resultEnvelope.artifacts`,
   `resultPayload`, or the asset repository.
   Add repository coverage for `findByProducedJobId(...)` or equivalent.
7. Update `ExecutionTimelineReader` so `snapshot` is canonical while timeline
   and history remain diagnostic siblings.
8. Update `/api/chat/jobs` so `jobs` is the canonical product contract. Move
   `interactions` behind a diagnostic/admin flag or a separate diagnostic route;
   product chat must not consume it.
9. Update jobs rail/workspace tests to render from canonical snapshots alone.
10. Add a DB/read-model test for the Keith image case: the snapshot has image
   artifact URI, dimensions, visibility, origin, ownership, and envelope without
   reading transcript messages.
11. Add `src/adapters/JobQueueDataMapper.test.ts`; it does not exist yet, and
    09b needs repository-level coverage for origin persistence, ownership
    transfer visibility, and event-payload fallback behavior.

## Prune List

Delete or stop using:

- `JobStatusSnapshot { messageId, conversationId, part }` as a product DTO.
- Snapshot fields that duplicate `MessagePart` naming only for transcript
  compatibility.
- Job render metadata stored only inside assistant message parts.
- Separate image/media artifact reconstruction in presenter code when the job
  snapshot can own it.
- Tests that seed only transcript `job_status` parts when testing product job
  rendering.
- Product chat dependencies on `/api/chat/jobs` `interactions` timeline shape.
- `messageId: jobmsg_${jobId}` as the product placement anchor once explicit
  origin fallback exists.
- Any new raw `requestPayload` exposure from product routes where a redacted
  `inputSnapshot` is sufficient.
- Product stream/publication helpers that emit `messageId: jobmsg_${jobId}` or
  `JobStatusMessagePart` instead of canonical job events/snapshots.

## Validation Plan

Positive tests:

- `generate_blog_image` succeeded snapshot renders from read model alone.
- `compose_media` succeeded snapshot includes artifact and materialization refs.
- Failed jobs expose failure and retry metadata.
- Jobs rail and jobs workspace agree on count/state from the same snapshots.
- Existing queued/running jobs expose progress without a terminal event.
- Anonymous-to-authenticated transferred jobs retain ownership history and
  become visible to the authenticated owner.

Negative tests:

- Missing `conversationId`, `jobId`, or `toolName` rejects snapshot creation.
- Snapshot builder redacts or rejects unsafe request payload fields.
- Product route does not include another user's job.
- A snapshot with only `messageId: jobmsg_${jobId}` and no origin/fallback
  classification is rejected by the canonical builder.
- A job whose only `toolInvocationId` exists in `job_events.event_payload_json`
  fails canonical product snapshot creation until repaired/backfilled.
- Default product chat does not need `interactions.timeline`,
  `interactions.history`, or transcript `job_status` parts to render a card.

Edge-case tests:

- Job exists with events but no terminal result yet.
- Job terminal event exists but artifact persistence failed.
- Job was transferred from anonymous to authenticated ownership.
- Job was canceled after partial progress.
- Latest job event is audit-only (`ownership_transferred`,
  `notification_sent`, etc.) and the snapshot falls back to the latest
  renderable event or durable job state.
- Exact compose-media reuse returns a canonical snapshot for the produced job
  plus a conversation-local materialization alias.
- Two jobs share one assistant turn but have different `toolInvocationId`
  anchors.

Run:

```bash
npm exec vitest run \
  tests/chat-job-state-contract-guardrails.test.ts \
  src/lib/jobs/job-read-model.test.ts \
  src/lib/jobs/job-status.test.ts \
  src/lib/jobs/job-publication.test.ts \
  src/core/platform/execution/ExecutionTimelineReader.test.ts \
  src/core/platform/facade/PlatformInteractionFacade.test.ts \
  src/adapters/JobQueueDataMapper.test.ts \
  src/app/api/chat/jobs/route.test.ts \
  'src/app/api/chat/jobs/[jobId]/route.test.ts' \
  src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts \
  src/components/jobs/JobsWorkspace.test.tsx \
  tests/blog-image-tool.test.ts \
  src/core/use-cases/tools/blog-image.tool.test.ts \
  src/lib/jobs/materialization-registration.test.ts \
  src/lib/media/media-asset-projection.test.ts \
  src/lib/media/browser-runtime/job-snapshots.test.ts
```

`src/adapters/JobQueueDataMapper.test.ts` was added during 09b for
repository-level origin persistence coverage.

## Implementation Evidence

Implemented on April 30, 2026.

09b now hard-cuts the product read model to `CanonicalJobSnapshot`:

- `JobStatusSnapshot { messageId, conversationId, part }` is removed as the
  product DTO.
- `job_requests` persists `origin_message_id`, `origin_turn_id`, and
  `tool_invocation_id`.
- `JobRequest`, `JobRequestSeed`, and `JobQueueDataMapper` read/write durable
  origin metadata.
- `buildCanonicalJobSnapshot(...)` emits top-level presentation, lifecycle,
  origin, ownership, result, artifact, materialization, and failure fields.
- `ExecutionTimelineReader` and `JobStatusQuery` return canonical snapshots.
- `/api/chat/jobs` returns canonical `jobs` and canonical enqueue/reuse
  snapshots, without the diagnostic `interactions` payload.
- `ExecutionTimelineReader` enriches canonical snapshots with
  `MaterializationRepository.findByProducedJobId(...)`.
- `buildCanonicalJobSnapshot(...)` redacts sensitive fallback request/envelope
  input fields before product serialization.
- Jobs workspace, jobs rail summaries, slash-command status, eval tools, and
  status tooling consume canonical fields.
- Transcript `JobStatusMessagePart` conversion is isolated to internal
  renderer/diagnostic bridge helpers. 09c/09d removed it from persisted
  assistant lifecycle messages, restore, product reconciliation, and product
  read-model DTOs.

Package QA after 09d:

- `/api/chat/jobs` remains the product route contract and returns canonical
  snapshots.
- `extractJobStatusSnapshots(...)` is not a product read or presentation path.
- `canonicalJobSnapshotToStatusPart(...)` is not a product DTO conversion; it
  is a presentation adapter for card components that still accept status-part
  shaped props.
- Guardrails fail if message-shaped job lifecycle state is reintroduced as a
  default chat source, persisted assistant lifecycle write, or restore
  dependency.

Focused 09b tests passed:

```bash
npx vitest run \
  tests/chat-job-state-contract-guardrails.test.ts \
  src/lib/jobs/job-read-model.test.ts \
  src/lib/jobs/job-status.test.ts \
  src/lib/jobs/job-publication.test.ts \
  src/core/platform/execution/ExecutionTimelineReader.test.ts \
  src/core/platform/facade/PlatformInteractionFacade.test.ts \
  src/adapters/JobQueueDataMapper.test.ts \
  src/app/api/chat/jobs/route.test.ts \
  'src/app/api/chat/jobs/[jobId]/route.test.ts' \
  src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts \
  src/components/jobs/JobsWorkspace.test.tsx \
  tests/blog-image-tool.test.ts \
  src/core/use-cases/tools/blog-image.tool.test.ts \
  src/lib/jobs/materialization-registration.test.ts \
  src/lib/media/media-asset-projection.test.ts \
  src/lib/media/browser-runtime/job-snapshots.test.ts \
  tests/deferred-job-status.tool.test.ts \
  tests/job-status-summary-tools.test.ts \
  src/lib/jobs/load-user-jobs-workspace.test.ts \
  src/components/jobs/job-snapshot-reducer.test.ts \
  src/components/jobs/job-workspace-helpers.test.ts
```

Result before final QA patch: 21 test files passed, 113 tests passed.

Final 09b QA patch tests passed:

```bash
npm test -- \
  src/lib/jobs/job-read-model.test.ts \
  src/core/platform/execution/ExecutionTimelineReader.test.ts \
  src/app/api/chat/jobs/route.test.ts \
  tests/chat-job-state-contract-guardrails.test.ts
```

Result: 4 test files passed, 27 tests passed.

Full validation also passed:

```bash
npm run typecheck
npm test
```

Result after final 09b QA patch: typecheck passed. Full Vitest passed.

Latest package validation after 09d: 652 Vitest files passed, 4755 tests
passed, 2 skipped.

## Done Checklist

- [x] Product job snapshots contain origin, presentation, result, artifact, and
  ownership fields.
- [x] `JobStatusSnapshot { messageId, part }` is no longer a product DTO.
- [x] Chat/job UI tests can render normal job cards without transcript
  `job_status` parts.
- [x] Artifact-producing tools have complete terminal envelopes in the job read
  model.
- [x] Snapshot route tests cover success, failure, canceled, active, anonymous
  transfer, and unauthorized access cases.
- [x] Duplicate DTOs or presenter-only artifact reconstruction paths are pruned
  from the product read model; remaining transcript bridges are explicitly
  classified for 09c/09d removal.
