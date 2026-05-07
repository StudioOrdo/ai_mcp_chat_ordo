# Phase 10b - Audio Worker Materialization And Compose Integration

## Goal

Harden the server-side `generate_audio` worker path and prove generated audio is
a governed reusable media asset for `compose_media`.

10a moved audio onto the canonical job contract and removed the legacy direct
runtime/product-state lanes. 10b must make the worker, materialization, asset
catalog, and composition paths production-grade so generated audio can be used
reliably as a narration source without falling back to transcript state.

After this phase:

- audio bytes are produced only by the deferred worker handler;
- successful audio jobs always register reusable materialization records;
- generated audio is discoverable through governed asset catalog/read-model
  surfaces;
- `compose_media` accepts generated audio by canonical asset id;
- failures are terminal, classified, observable job failures, not disappearing
  player cards or half-created assets.

## Previous Phase Grounding

10a is complete and green:

- `generate_audio` catalog ownership is deferred/job-only.
- `/api/chat/jobs` uses a media enqueue strategy map for `compose_media` and
  `generate_audio`.
- live chat tool execution enqueues/dedupes/exactly reuses deferred audio jobs
  instead of calling the TTS provider inline.
- `src/app/api/runtime/generate-audio/route.ts` was deleted.
- browser-runtime `generate_audio` snapshots and `browser:...:generate_audio`
  product state were removed.
- transcript-derived `generate_audio` payloads are raw history only; they are
  not asset-resolution or composition inputs.
- guardrail coverage exists in `tests/audio-job-contract-guardrails.test.ts`.

Latest 10a QA:

```bash
npm run typecheck
npm test
```

Result: typecheck passed; 654 files passed, 4778 tests passed, 2 skipped.

## Current Codebase Grounding

The current architecture already contains the primary 10b building blocks:

- `src/lib/jobs/deferred-job-handler-factories.ts`
  - owns `createGenerateAudioDeferredJobHandler()`;
  - calls `generateStoredAudioArtifact(...)` inside the worker lane only;
  - returns a deferred `CapabilityResultEnvelope` with an audio artifact ref.
- `src/lib/jobs/deferred-job-worker.ts`
  - calls `registerGenerateAudioMaterialization(...)` after successful
    `generate_audio` jobs;
  - emits canonical progress, result, failure, retry, cancellation, and
    notification events.
- `src/lib/jobs/materialization-registration.ts`
  - registers `generate_audio:v1` materializations;
  - records durable output refs to `user_files` audio assets;
  - records prompt-binding provenance when the job carries a source binding.
- `src/lib/jobs/materialization-key.ts`
  - builds deterministic `generate_audio` materialization keys from normalized
    title, text, voice, format, duration target, and pipeline version.
- `src/core/platform/asset-catalog/AssetCatalogReader.ts`
  - joins `user_files` with materializations;
  - lists conversation-linked materialized assets even when the file originated
    in another same-user conversation through exact reuse.
- `src/core/use-cases/tools/list-conversation-media-assets.tool.ts`
  - exposes governed audio assets for reuse by `compose_media`.
- `src/lib/media/media-composition-asset-identity.ts`
  - accepts audio candidates from governed asset catalog/list surfaces;
  - intentionally does not derive audio candidates from direct
    `generate_audio` transcript results.
- `src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts`
  - supports `audioClips` by canonical asset id.

## QA Findings Resolved

| Finding | Current proof | Implemented correction |
| --- | --- | --- |
| Worker path existed, but provider execution was coupled to a concrete service call. | `src/lib/audio/audio-generation-provider.ts` now defines `AudioGenerationProvider`; `createGenerateAudioDeferredJobHandler()` receives the provider through dependencies. | Handler tests cover injected provider success, unsupported options before provider execution, and cancellation after provider generation without terminal progress. |
| Audio materialization existed, but raw text source refs would be the wrong authority. | `registerGenerateAudioMaterialization(...)` keeps `inputSourceRefs: []`, records durable audio output refs, records evidence, and propagates prompt-binding provenance. | Privacy-preserving text inputs are represented by deterministic materialization key, job request payload, evidence, and prompt-binding provenance; no invented message/source refs are introduced. |
| Asset discovery was governed, but composition readiness needed explicit generated-audio negatives. | `AssetCatalogReader`, `list_conversation_media_assets`, and media asset projection now expose generated audio with `producedByJobId` and `materializationKey`. | Compose worker runtime tests prove missing and non-ready generated audio fails before render; preflight covers forbidden, pending, kind mismatch, conversation mismatch, and lineage mismatch. |
| Provider failure classification was too generic. | `AudioGenerationError` carries `failureClass`, `reasonCode`, and optional status; `DeferredJobWorker` consumes it directly. | 429/5xx/timeouts are transient; 4xx and oversize are terminal; failed/canceled jobs do not register ready materializations. |
| Stale generated-audio cache rows could fail instead of regenerating. | `generateStoredAudioArtifact(...)` now treats a cache DB hit with a missing MP3 on disk as a stale cache miss. | The worker regenerates audio and stores a fresh durable user file instead of surfacing a disappearing/half-created audio artifact. |
| Existing direct command payload shapes remain as raw/presentation compatibility code. | Guardrails block `/api/runtime/generate-audio`, browser-runtime `generate_audio` product state, route-level provider calls, and transcript-derived compose authority. | 10b does not depend on compatibility command shapes; they remain raw history/presentation only and are not model-visible composition authority. |

## Architecture Decision

`generate_audio` is now a first-class media job with four boundaries:

1. Enqueue boundary:
   `enqueueGenerateAudioDeferredJob(...)` validates input, computes the
   materialization key, dedupes active jobs, and returns exact reuse when safe.
2. Worker boundary:
   a deferred handler owns provider bytes, storage, progress, cancellation, and
   result envelope creation.
3. Materialization boundary:
   `registerGenerateAudioMaterialization(...)` creates the reusable output
   record and prompt-binding evidence.
4. Asset/catalog boundary:
   `AssetCatalogReader` and `list_conversation_media_assets` expose canonical
   asset ids to `compose_media`; transcript tool results do not.

The composition path must consume generated audio exactly the same way it
consumes uploaded audio: by canonical asset id served through `/api/user-files/[id]`.

## SOLID / CLEAN / GoF Guardrails

- Single responsibility: enqueue logic, provider generation, file storage,
  materialization registration, asset discovery, and rendering stay in separate
  modules.
- Open/closed: new audio provider variants are added through a worker/provider
  strategy, not by branching route or chat runtime code.
- Dependency inversion: the worker handler depends on an audio generation port
  and repositories; it does not depend on React, browser runtime, or transcript
  projection.
- Interface segregation: `compose_media` sees `audioClips[]` asset ids, not
  TTS provider payloads or transcript result shapes.
- DRY: audio exact reuse, dedupe, prompt binding, and materialization follow
  the compose-media pattern.
- GoF Strategy: audio provider selection lives behind one worker strategy.
- GoF Factory: `DEFERRED_JOB_HANDLER_FACTORIES` remains the handler creation
  point.
- GoF Repository: `UserFileRepository`, `JobQueueRepository`, and
  `MaterializationRepository` remain the persistence boundaries.
- GoF Facade: job read model and asset catalog are the product-facing state
  facades.
- GoF Observer: chat, jobs rail, notifications, and workspace observe durable
  job events and snapshots.

## Implementation Completed

1. Extracted the worker audio provider contract.
   - Keep `generateStoredAudioArtifact(...)` as the default implementation.
   - Inject the provider/strategy into `createGenerateAudioDeferredJobHandler`.
   - Cover cache hit, provider success, provider failure, abort, and oversized
     response behavior without network calls.
2. Tightened audio input normalization.
   - Ensure `parseGenerateAudioInput(...)`, materialization keys, request
     payloads, and provider inputs agree on title, text, voice, format, and
     duration target policy.
   - If voice/format are not product-supported yet, explicitly reject or ignore
     them consistently; do not silently include them in one layer and drop them
     in another.
3. Hardened failure mapping.
   - Provider 429/502/503/504/timeouts become transient retryable failures.
   - policy/validation/oversize failures become terminal failures.
   - failed or canceled audio jobs must not register ready materializations.
4. Strengthened materialization registration.
   - Keep output refs as `{ kind: "asset", id: audioAssetId }`.
   - Preserve prompt-binding evidence.
   - Supersede older same-key materializations exactly like compose media.
   - Do not store raw transcript/message refs as reusable source authority.
5. Proved governed discovery.
   - `list_conversation_media_assets({ kinds: ["audio"] })` returns generated
     audio with label, mime type, source, retention class, tool name,
     duration, produced job id, and materialization key where available.
   - same-user exact reuse aliases remain visible in the requesting
     conversation through materialization records.
6. Proved compose integration.
   - `compose_media` accepts a generated audio asset id from the governed
     catalog.
   - missing, wrong-user, non-ready, or non-audio assets fail before render.
   - generated audio plus generated image produces a valid video result in the
     server path.
7. Added source guardrails.
   - No `/api/runtime/generate-audio` route can return.
   - No `browser:...:generate_audio` product state can return.
   - No compose/product path can use direct `generate_audio` transcript results
     as audio asset authority.
   - `generateStoredAudioArtifact(...)` remains reachable only from the audio
     service and deferred worker/provider implementation.

## Prune List

Delete or replace:

- Any compose-media path that discovers audio by scanning transcript
  `generate_audio` tool results.
- Audio asset recovery that depends on `browser:...:generate_audio` runtime
  candidates.
- Tests that make composition depend on direct audio tool result shape.
- Any new direct HTTP/runtime route that generates MP3 bytes outside deferred
  jobs.
- Route-level audio provider calls.

Retain:

- `user_files` as the binary storage contract.
- `/api/user-files/[id]` range serving for playback and FFmpeg input.
- `AudioPlayerCard` and `AudioPlayer` as renderers for canonical job
  snapshots/result envelopes.
- existing uploaded-audio classifications.
- direct historical transcript export/import as raw history only.

## Positive Coverage

- Worker success creates a ready `user_files` MP3 and terminal job result.
- Worker result envelope contains an audio artifact with `assetId`,
  `/api/user-files/{assetId}`, `audio/mpeg`, retention class, and duration.
- Materialization registration records generated audio as reusable
  `generate_audio:v1`.
- Prompt binding follows from audio job to materialization record.
- Exact reuse returns canonical materialized state without rerunning provider.
- `list_conversation_media_assets` returns generated audio with
  `assetKind: "audio"` and materialization lineage.
- `compose_media` accepts a generated audio asset id from governed discovery.
- Generated audio plus generated image produces a valid server-rendered video.

## Negative Coverage

- Missing audio asset cannot be composed.
- Wrong-user audio asset cannot be composed.
- Non-ready audio asset cannot be composed.
- Direct completed `generate_audio` transcript result is not a compose
  candidate.
- Audio materialization for one user is not reused by another user.
- Provider failure records failed job state and no ready materialization.
- Invalid or empty text fails before provider execution.
- `/api/runtime/generate-audio` remains absent.

## Edge-Case Coverage

- Reused same-user asset originated in another conversation and is aliased into
  the requesting conversation by materialization.
- MP3 exists on disk but DB row is missing.
- DB row exists but file is missing.
- Provider returns a response larger than the max byte cap.
- Worker is canceled after provider start but before terminal progress.
- Composition uses uploaded audio in one request and generated audio in another.
- Composition uses one generated audio plus one generated chart/image/video.

## Validation

Run at minimum:

```bash
npm exec vitest run \
  tests/audio-job-contract-guardrails.test.ts \
  src/lib/jobs/deferred-job-worker.test.ts \
  src/lib/jobs/materialization-registration.test.ts \
  src/core/platform/asset-catalog/AssetCatalogReader.test.ts \
  src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts \
  src/lib/media/media-composition-asset-identity.test.ts \
  src/lib/media/server/compose-media-plan-materialization.test.ts \
  src/lib/media/ffmpeg/server/ffmpeg-server-executor.test.ts

npm run typecheck
npm test
```

Latest 10b QA:

```bash
npm exec vitest run \
  tests/audio-job-contract-guardrails.test.ts \
  src/lib/audio/audio-generation-service.test.ts \
  src/lib/jobs/deferred-job-handler-factories.test.ts \
  src/lib/jobs/deferred-job-worker.test.ts \
  src/lib/jobs/materialization-registration.test.ts \
  src/core/platform/asset-catalog/AssetCatalogReader.test.ts \
  src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts \
  src/lib/media/media-composition-asset-identity.test.ts \
  src/lib/media/compose-media-preflight.test.ts \
  src/lib/media/server/compose-media-plan-materialization.test.ts \
  src/lib/media/server/compose-media-worker-runtime.test.ts \
  src/lib/media/ffmpeg/server/ffmpeg-server-executor.test.ts
```

Result: 12 files passed, 61 tests passed.

```bash
npm run typecheck
npm test
```

Result: typecheck passed; 654 files passed, 4778 tests passed, 2 skipped.

## 10b Done Criteria Complete

- Audio provider execution is worker-only and strategy/port-backed.
- Successful audio jobs produce durable user-file assets and reusable
  materializations.
- Failed/canceled audio jobs never register ready materializations.
- Generated audio is discoverable only through governed asset catalog/list
  surfaces.
- `compose_media` can consume generated audio by canonical asset id.
- Product code remains free of `/api/runtime/generate-audio`,
  `browser:...:generate_audio`, and transcript-derived audio composition
  authority.
- Positive, negative, and edge-case tests cover the worker, materialization,
  asset discovery, and compose integration paths.
