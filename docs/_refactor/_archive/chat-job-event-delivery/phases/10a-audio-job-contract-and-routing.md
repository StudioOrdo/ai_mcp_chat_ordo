# Phase 10a - Audio Job Contract And Routing

## Goal

Move `generate_audio` onto the same canonical job contract used by
`compose_media`. Audio generation must no longer be a transient synchronous
tool result that only appears stable because a player card renders during the
live stream.

After this phase, a chat request for generated audio creates a durable
`job_requests` row, emits durable `job_events`, and restores through canonical
job snapshots. There is no legacy compatibility lane for browser-runtime
synthetic audio jobs.

## Incident Grounding

Keith's May 1, 2026 audio request generated a valid MP3 and persisted it as a
`user_files` row, but the conversation had zero durable job rows:

- User: `keith@firehose360.com`
- Conversation: `conv_b2d1ac71-9412-45d9-9924-aa033e5ecd4c`
- Assistant message: `msg_9d9522f1-72dc-4a81-8691-99980fe95eb1`
- Audio asset: `uf_cf12236f-9aeb-42ad-abe2-ad60ddd0cc86`
- `job_requests`: `0`
- `job_events`: `0`

This proves the current audio path is still outside the 09a-09d hard-cutover.

## Current Codebase Grounding

Compose media is the pattern to copy, not a special case:

- `src/app/api/chat/jobs/route.ts` enqueues `compose_media` and returns
  canonical snapshots.
- `src/lib/jobs/compose-media-deferred-job.ts` validates the plan, builds a
  materialization/dedupe key, reuses exact materializations, or calls
  `enqueueDeferredToolJob(...)`.
- `src/lib/jobs/deferred-job-worker.ts` owns terminal job transitions and emits
  result events.
- `src/lib/jobs/deferred-job-handlers.ts` derives handlers from
  `JOB_CAPABILITY_TOOL_NAMES`.
- `src/lib/jobs/deferred-job-handler-factories.ts` adapts catalog-bound runtime
  bindings into worker handlers.
- `src/lib/jobs/materialization-registration.ts` registers compose outputs as
  reusable materializations.
- `src/lib/jobs/job-read-model.ts` is the chat/jobs product read model.
- `src/hooks/chat/useChatJobEvents.ts` and
  `src/hooks/chat/useJobStateStore.ts` reconcile canonical snapshots into chat.

Audio has been hard-cut over:

- `src/core/capability-catalog/families/media-capabilities.ts` declares
  `generate_audio` as deferred/job-capable and catalog projection asserts no
  browser product runtime.
- `src/core/capability-catalog/runtime-tool-binding.ts` enqueues, dedupes, or
  exactly reuses canonical audio jobs instead of generating provider bytes
  inline.
- `src/app/api/chat/jobs/route.ts` accepts `compose_media` and
  `generate_audio` through `MEDIA_JOB_ENQUEUE_STRATEGIES`.
- `src/lib/media/browser-runtime/job-snapshots.ts` no longer creates
  browser-runtime audio job candidates from transcript tool results.
- `src/hooks/chat/browserCapabilityRuntimeCore.ts` has no valid
  `generate_audio` browser runtime lane.
- `src/hooks/chat/useAssetResolutionIndex.ts` does not promote direct
  `generate_audio` transcript payloads into product asset state.
- `src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx` renders audio
  controls only from canonical job status entries, completed in 10c.

## QA Findings Resolved

| Finding | Resolution | Proof |
| --- | --- | --- |
| Audio catalog ownership was contradictory. | `generate_audio` is now resolved to the media capability definition and projects as deferred/job-owned. Browser projection returns `null`. | `src/core/capability-catalog/catalog.ts`, `catalog.test.ts`, `browser-capability-registry.test.ts`. |
| The chat job enqueue route was compose-only. | `/api/chat/jobs` now dispatches through `MEDIA_JOB_ENQUEUE_STRATEGIES` for both `compose_media` and `generate_audio`. | `src/app/api/chat/jobs/route.ts`, `src/app/api/chat/jobs/route.test.ts`, `tests/audio-job-contract-guardrails.test.ts`. |
| Live chat tool execution generated audio inline. | Runtime binding now enqueues/dedupes/exactly reuses canonical audio jobs and never calls provider byte generation from live chat execution. | `runtime-tool-binding.ts`, `runtime-tool-binding.test.ts`, `tests/audio-job-contract-guardrails.test.ts`. |
| Browser-runtime audio snapshots were a product-state escape hatch. | `generate_audio` is not a browser capability and no product code creates `browser:...:generate_audio` state. | `job-snapshots.ts`, `browser-capability-registry.test.ts`, `useBrowserCapabilityRuntime.test.tsx`, guardrails. |
| Asset discovery depended on transcript audio payloads. | Product asset resolution no longer indexes direct `generate_audio` transcript payloads; governed discovery is owned by 10b asset/materialization surfaces. | `useAssetResolutionIndex.ts`, `useAssetResolutionIndex.test.tsx`, `media-composition-asset-identity.test.ts`. |
| Existing tests normalized old behavior. | Tests now assert deferred job enqueue, canonical snapshots, no browser audio state, and no transcript-derived product audio authority. | `runtime-tool-binding.test.ts`, `catalog.test.ts`, `job-snapshots.test.ts`, `AudioPlayerCard.test.tsx`. |

## Architecture Decision

`generate_audio` is a media job. It should follow the same source-of-truth
rules as `compose_media`:

1. Tool execution returns a job acknowledgement or reusable materialization,
   never a completed direct artifact payload from the streaming assistant turn.
2. Job lifecycle state lives in `job_requests` and `job_events`.
3. The generated MP3 remains a `user_files` artifact referenced by the terminal
   job result envelope.
4. Chat, jobs rail, jobs workspace, notifications, and restore all consume the
   canonical job snapshot.
5. Browser/runtime transcript-derived audio candidates are deleted, not hidden.

Implementation must be a hard cutover, not compatibility:

- There is one product execution owner: deferred job execution.
- There is one product state owner: canonical job snapshots.
- There is one binary owner: `user_files`.
- There is one reusable output owner: materialization records.
- Historical direct tool results are raw transcript facts, not operational
  product state.

## SOLID / CLEAN / GoF Guardrails

- Single responsibility: enqueue validation/dedupe lives in an audio enqueue
  use case; provider byte generation lives in the worker; rendering lives in
  `AudioPlayerCard`; binary serving remains `/api/user-files/[id]`.
- Open/closed: `/api/chat/jobs` should dispatch through a small media-job
  enqueue strategy map (`compose_media`, `generate_audio`) instead of
  accumulating route-level conditionals.
- Dependency inversion: the worker handler depends on repositories and provider
  interfaces, not React/browser runtime code.
- Interface segregation: transcript export/import may preserve old tool
  results, but product restore/presentation APIs do not depend on that shape.
- DRY: materialization key generation, exact reuse, prompt-binding evidence,
  and job enqueue response shape should mirror compose-media helpers rather
  than reimplement route-local variants.
- Clean architecture: catalog definitions describe capability policy; routes
  orchestrate; use-case services validate/enqueue; repositories persist;
  presenters render canonical snapshots.
- GoF Strategy: media job enqueue handlers are selected by `toolName`.
- GoF Factory: deferred job handler creation remains centralized in
  `createDeferredJobHandlers()`.
- GoF Repository: `JobQueueRepository`, `MaterializationRepository`, and
  `UserFileRepository` are the only persistence boundaries.
- GoF Observer: chat, jobs rail, notifications, and workspace observe job
  events/read-model snapshots.
- GoF Facade: `job-read-model.ts` remains the product-facing facade for job
  state.

## Implementation Completed

1. Catalog ownership is resolved.
   - `CAPABILITY_CATALOG.generate_audio` resolves to the media-pack deferred
     job definition.
   - Browser capability projection returns `null` for `generate_audio`.
2. `/api/chat/jobs` supports `generate_audio` through the shared media job
   strategy map.
   - `compose_media` and `generate_audio` share auth, prompt-binding,
     dedupe/exact-reuse, and canonical snapshot response behavior.
3. Canonical request payload is defined:
   - `title`
   - `text`
   - optional `voice`
   - optional `format`
   - optional `durationTargetSeconds`
   - `materializationKey`
   - `promptBindingId`
4. Audio materialization keys are built from normalized title, text, voice,
   format, duration target, and pipeline version.
5. `enqueueGenerateAudioDeferredJob(...)` exists alongside
   `enqueueComposeMediaDeferredJob(...)`.
   - Validates text/title before enqueue.
   - Builds the dedupe/materialization key.
   - Returns active equivalent jobs when a matching active job exists.
   - Returns exact materialization reuse when available.
   - Otherwise calls `enqueueDeferredToolJob(...)` with `toolName:
     "generate_audio"`.
6. `runtime-tool-binding.ts` returns deferred job/exact-reuse results for
   `generate_audio` instead of generating audio inline.
7. `generate_audio` is registered in the deferred job handler factory map.
8. Transcript-derived/browser-runtime audio job candidates are removed.
9. Prompt/tool descriptions describe audio as job-backed media state.
10. Guardrails fail if product code reintroduces:
    - `browser:...:generate_audio`
    - direct `generateStoredAudioArtifact(...)` execution from live chat
      binding
    - route rejection that only permits `compose_media`
    - product presentation/asset authority from direct audio transcript payloads

## Prune List

Delete or hard-fail production imports that keep the old audio path alive:

- Direct synchronous `generateStoredAudioArtifact(...)` execution from chat
  stream runtime binding.
- Browser-runtime `generate_audio` snapshot projection from transcript
  `tool_result` parts.
- Browser capability registry exposure for `generate_audio` as a product
  runtime.
- Catalog tests asserting browser presentation for `generate_audio`.
- Tests that assert completed audio is represented only as a direct assistant
  `tool_result`.
- UI assumptions that an audio card is authoritative without a job id or
  materialization id.

Retain:

- `AudioPlayer` as the final artifact player.
- `AudioPlayerCard` as a renderer for canonical job snapshots/result envelopes.
- `user_files` storage for generated MP3 bytes.
- Explicit transcript export/import of historical tool results as raw history.
- Direct historical transcript diagnostics in admin surfaces.

## Positive Coverage

- A `generate_audio` tool call enqueues or reuses one durable job:
  `runtime-tool-binding.test.ts`, `src/app/api/chat/jobs/route.test.ts`.
- `/api/chat/jobs` accepts `toolName: "generate_audio"` and returns the same
  canonical response shape as compose media: `route.test.ts`.
- Catalog projection reports deferred/job ownership for `generate_audio` and no
  browser product runtime: `catalog.test.ts`, `browser-capability-registry.test.ts`.
- Canonical audio snapshots flow through chat presentation and reconciliation:
  `ChatPresenter.test.ts`, `useChatJobEvents.test.tsx`.
- Worker/materialization/compose behavior is completed and covered by 10b.
- Reload restore of the completed audio card is completed and covered by 10c.

## Negative Coverage

- No product path creates `browser:...:generate_audio` synthetic job ids:
  `tests/audio-job-contract-guardrails.test.ts`.
- `runtime-tool-binding.ts` does not call `generateStoredAudioArtifact(...)`
  for live chat execution: `tests/audio-job-contract-guardrails.test.ts`.
- A direct completed `generate_audio` transcript result does not become default
  product job state: 10c `ChatPresenter` and `AudioPlayerCard` tests.
- Invalid/empty text fails before enqueue:
  `src/app/api/chat/jobs/route.test.ts`,
  `src/core/capability-catalog/runtime-tool-binding.test.ts`.
- Unauthorized users cannot read another user's job through chat job routes:
  route-level auth tests.

## Edge-Case Coverage

- Job completion before or outside EventSource delivery is repaired by
  `/api/chat/jobs` reconciliation in 10c.
- Provider failure and materialization edge cases are covered in 10b worker
  tests.
- Reuse and compose follow-up are covered in 10b materialization and compose
  tests.

## Validation

Run at minimum:

```bash
npm exec vitest run \
  src/app/api/chat/jobs/route.test.ts \
  src/lib/jobs/deferred-job-runtime.test.ts \
  src/lib/jobs/deferred-job-worker.test.ts \
  src/lib/jobs/job-read-model.test.ts \
  src/core/capability-catalog/catalog.test.ts \
  src/core/capability-catalog/runtime-tool-binding.test.ts \
  src/lib/media/browser-runtime/job-snapshots.test.ts \
  src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/hooks/usePresentedChatMessages.test.tsx
```

Latest 10a QA:

```bash
npm exec vitest run \
  src/app/api/chat/jobs/route.test.ts \
  src/lib/jobs/deferred-job-runtime.test.ts \
  src/lib/jobs/deferred-job-worker.test.ts \
  src/lib/jobs/job-read-model.test.ts \
  src/core/capability-catalog/catalog.test.ts \
  src/core/capability-catalog/runtime-tool-binding.test.ts \
  src/lib/media/browser-runtime/browser-capability-registry.test.ts \
  src/lib/media/browser-runtime/job-snapshots.test.ts \
  src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/hooks/usePresentedChatMessages.test.tsx \
  tests/audio-job-contract-guardrails.test.ts
```

Result: covered in package QA; full validation passes with 654 files,
4778 tests, 2 skipped.

## 10a Done Criteria Complete

- `generate_audio` is product-owned by the deferred job path, not browser
  runtime or direct synchronous chat execution.
- New audio requests create, dedupe, or exactly reuse canonical job/materialized
  state through the same public route surface as compose media.
- Product source contains no default chat path that creates
  `browser:...:generate_audio` state.
- Tests fail if direct completed audio tool results become product job state.
- 10b can implement provider byte generation without revisiting routing,
  catalog ownership, or presentation source-of-truth decisions.
