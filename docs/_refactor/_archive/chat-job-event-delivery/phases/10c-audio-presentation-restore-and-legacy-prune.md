# Phase 10c - Audio Presentation Restore And Legacy Prune

## Goal

Make generated-audio presentation restore from canonical job state only, then
remove the remaining product paths that can render audio from direct transcript
tool results.

After this phase, audio controls cannot flash and disappear because the visible
audio card is keyed to durable job identity and backed by the job read model,
materialization, asset catalog, and `/api/user-files/[id]` byte serving.

## Previous Phase Grounding

10a is complete:

- `generate_audio` is owned by the deferred/job path.
- `/api/runtime/generate-audio/route.ts` is deleted.
- Browser runtime no longer exposes `generate_audio` as a runnable product
  capability.
- Live chat tool execution enqueues, dedupes, or exactly reuses canonical audio
  jobs instead of generating MP3 bytes inline.
- Transcript-derived `generate_audio` payloads are raw history only and are not
  compose/product asset authority.

10b is complete:

- audio byte generation is worker-only and strategy-backed by
  `AudioGenerationProvider`.
- successful jobs produce durable `user_files` MP3 assets and
  `generate_audio:v1` materializations.
- provider failures are classified as transient or terminal through
  `AudioGenerationError`.
- stale generated-audio cache rows with missing MP3 files regenerate instead of
  creating half-presented assets.
- generated audio is discoverable through `AssetCatalogReader` and
  `list_conversation_media_assets` with materialization lineage.
- `compose_media` accepts generated audio by canonical asset id and rejects
  missing, forbidden, pending, wrong-kind, wrong-conversation, or wrong-lineage
  audio before render.

Latest 10b QA:

```bash
npm run typecheck
npm test
```

Result: typecheck passed; 654 files passed, 4778 tests passed, 2 skipped.

## Current Codebase Grounding

The presentation stack already has the canonical building blocks:

- `src/hooks/chat/useChatJobEvents.ts`
  - opens `/api/chat/events`;
  - periodically reconciles `/api/chat/jobs`;
  - reconciles on focus, visibility change, and SSE errors;
  - writes canonical snapshots into the job state store.
- `src/adapters/ChatPresenter.ts`
  - attaches canonical job snapshots to assistant messages;
  - converts snapshots through `canonicalJobSnapshotToStatusPart(...)`;
  - dedupes job render entries by `jobId`;
  - selects fresher entries by sequence, terminal status, result payload, and
    source weight.
- `src/lib/chat/JobRenderCandidateMerger.ts`
  - treats `generate_audio` as a media job;
  - replaces stale assistant prose with truth-bound media status text while a
    canonical audio job is queued, running, failed, or canceled.
- `src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx`
  - renders canonical audio `job_status` entries and their
    `CapabilityResultEnvelope` artifacts;
  - renders terminal failure metadata when no durable audio asset exists;
  - does not render product audio controls from direct structured
    `generate_audio` transcript payloads.
- `src/lib/media/browser-runtime/job-snapshots.ts`
  - no longer creates browser runtime candidates for `generate_audio`;
  - skips deferred job result payloads when deriving browser-runtime work.
- `tests/audio-job-contract-guardrails.test.ts`
  - prevents `/api/runtime/generate-audio`, `browser:...:generate_audio`,
    route-level provider calls, and transcript-derived compose authority from
    returning.

## QA Findings Resolved

| Finding | Resolution | Proof |
| --- | --- | --- |
| Direct audio tool results rendered in default chat. | `ChatPresenter` now suppresses default product render entries for direct `generate_audio` tool-call/result pairs, and `AudioPlayerCard` resolves playable audio only from canonical `job_status` parts. | `ChatPresenter.test.ts`, `AudioPlayerCard.test.tsx`, `usePresentedChatMessages.test.tsx`. |
| Keith-style restore regression was not encoded. | Added Playwright regression for a restored conversation with raw direct transcript audio plus a canonical completed audio job. The test asserts one canonical audio card before and after reload and no raw transcript audio card. | `tests/browser-ui/chat-audio-job-restore.spec.ts`. |
| Direct tool-call entries could create a second product card. | Product audio presentation is now keyed through canonical job entries; raw direct `generate_audio` payloads remain historical transcript data only. | `ChatPresenter.test.ts` asserts direct payloads produce no default product card and canonical snapshots produce exactly one card. |
| Restore/reconciliation had no audio-specific proof. | Added audio-specific reconciliation and presentation tests for missed completion events, stale running transcript state, and completed canonical snapshots. | `useChatJobEvents.test.tsx`, `usePresentedChatMessages.test.tsx`. |
| Stale tests normalized stream-only audio completion language. | Rewrote audio presentation/a11y fixtures to use queued/running/completed job language and canonical completed job state. | `tests/chat-performance-a11y.test.tsx`, `AudioPlayerCard.test.tsx`. |

## Architecture Decision

Audio presentation has one product authority: canonical job snapshots.

The product rendering chain is:

1. Job events and `/api/chat/jobs` produce `CanonicalJobSnapshot`.
2. `useChatJobEvents` stores snapshots in the job state store.
3. `usePresentedChatMessages` passes snapshots into `ChatPresenter`.
4. `ChatPresenter` projects snapshots into `job_status` render entries and
   dedupes by `jobId`.
5. `AudioPlayerCard` renders playable controls only when the selected canonical
   job entry has a durable audio artifact or canonical payload asset id.

Raw transcript `generate_audio` tool calls/results are not product state. They
may remain in import/export/admin diagnostics as historical facts, but they
must not create product audio controls, browser jobs, compose inputs, or asset
authority.

## SOLID / CLEAN / GoF Guardrails

- Single responsibility: job event reconciliation, presentation projection,
  audio card rendering, audio byte serving, and asset discovery remain separate.
- Dependency inversion: the audio card depends on a result-envelope/artifact
  contract, not on TTS provider details or stream transcript shape.
- Interface segregation: chat presentation consumes `CanonicalJobSnapshot` and
  `CapabilityResultEnvelope`; compose consumes asset catalog ids.
- DRY: the same canonical job snapshot drives chat, jobs rail, jobs workspace,
  notifications, and restore.
- GoF Observer: chat presentation observes durable job state through SSE and
  reconciliation.
- GoF Adapter: `ChatPresenter` adapts persisted messages plus job snapshots
  into UI render entries.
- GoF Strategy: `JobRenderCandidateMerger` selects the freshest candidate
  independent of the concrete tool.
- GoF Facade: job read model and asset catalog remain the product-facing state
  facades.

## Implementation Completed

1. `AudioPlayerCard` is canonical-first and product-safe.
   - Render playable controls from `part.resultEnvelope`, `resultEnvelope`, or
     canonical `part.resultPayload` only when `part.type === "job_status"`.
   - Render failed/canceled canonical jobs without playable controls when no
     durable audio artifact exists.
   - Removed default product rendering from direct `toolCall.result` and
     `toolCall.args`.
   - Raw transcript payloads remain raw history/diagnostics only.
2. Direct `generate_audio` tool-call render entries are suppressed in default
   chat.
   - Keep command parsing unaffected.
   - Keep raw message history unchanged.
   - Do not suppress canonical `job_status` entries or deferred-job result
     snapshots.
3. Job-entry identity is job-first.
   - Ensure audio entries are keyed by `jobId` first.
   - Use `toolInvocationId` only for correlation, not as the primary product
     card identity.
   - If exact reuse has no fresh job execution, key the presented card by the
     canonical reused job/materialization snapshot returned by the job read
     model.
4. Restore and reconciliation are covered.
   - Added audio-specific coverage for missed SSE completion restored by
     `/api/chat/jobs`.
   - Added reload/workspace restore coverage where the transcript has no direct
     audio card authority but the job snapshot restores playback.
5. Keith-style regression is encoded.
   - restored conversation contains a historical direct `generate_audio`
     transcript payload;
   - canonical completed audio job contains a durable MP3 artifact;
   - initial restore renders one playable canonical audio card;
   - refresh/reload restores the same single canonical audio card;
   - the raw transcript payload does not create product audio controls.
6. Compose follow-up remains governed by 10b.
   - after generated audio completes, a follow-up video request must call
     `list_conversation_media_assets`;
   - `compose_media` must receive the exact returned audio `assetId` in
     `audioClips[]`;
   - no transcript `generate_audio` result can be used as compose authority.
7. Tests and language that normalized legacy behavior were pruned.
   - Deleted or rewrote tests that expected direct `generate_audio` tool results
     to render product audio cards.
   - Deleted or rewrote tests that mention
     `browser:...:generate_audio` as a valid product state.
   - Updated prompt/presentation copy so audio is described as queued/running
     until the job completes.

## Prune List

Delete or replace:

- Product `AudioPlayerCard` rendering from direct completed
  `generate_audio` transcript payloads.
- `ChatPresenter` default product entries for direct `generate_audio`
  tool-call/tool-result pairs.
- Tests asserting stream-only direct audio completion as product presentation.
- Any remaining product references to `browser:...:generate_audio`.
- Prompt language implying audio is immediately complete during the assistant
  turn before the job completes.

Retain:

- raw transcript display/export/import for historical direct tool results.
- admin diagnostics showing raw message parts.
- `AudioPlayer` as the playback component for canonical audio artifacts.
- `/api/user-files/[id]` range/byte serving.
- `AudioPlayerCard` as the renderer for canonical audio job snapshots and
  result envelopes.

## Positive Coverage

- Restored completed audio job renders one playable audio card:
  `tests/browser-ui/chat-audio-job-restore.spec.ts`,
  `src/hooks/usePresentedChatMessages.test.tsx`.
- Audio card remains visible after full page reload:
  `tests/browser-ui/chat-audio-job-restore.spec.ts`.
- Missed EventSource completion is repaired by `/api/chat/jobs`
  reconciliation: `src/hooks/chat/useChatJobEvents.test.tsx`.
- Jobs rail, chat card, and jobs workspace share the same canonical snapshot
  contract: `src/hooks/chat/useJobStateStore.test.tsx`,
  `src/adapters/ChatPresenter.test.ts`.
- Generated audio asset catalog and `compose_media` follow-up behavior remain
  covered by 10b and guarded here against transcript-derived compose authority:
  `tests/audio-job-contract-guardrails.test.ts`.

## Negative Coverage

- Direct transcript audio payload without canonical job state does not create a
  product audio card: `AudioPlayerCard.test.tsx`,
  `ChatPresenter.test.ts`, `usePresentedChatMessages.test.tsx`.
- Duplicate snapshots for the same audio job render one card:
  `ChatPresenter.test.ts`, `useJobStateStore.test.tsx`.
- Stale running/queued transcript snapshot cannot override a newer completed
  canonical snapshot: `usePresentedChatMessages.test.tsx`.
- Failed or canceled audio job with no asset does not render playable controls:
  `AudioPlayerCard.test.tsx`, `ToolPluginPartRenderer.test.tsx`.
- Direct `generate_audio` transcript result is not a compose candidate:
  `tests/audio-job-contract-guardrails.test.ts`.
- `browser:...:generate_audio` remains absent from product state:
  `tests/audio-job-contract-guardrails.test.ts`,
  `useBrowserCapabilityRuntime.test.tsx`.

## Edge-Case Coverage

- Audio job succeeds but EventSource completion is missed; reconciliation
  restores playback: `useChatJobEvents.test.tsx`.
- User navigates away/reloads after completion; canonical job state restores
  playback: `tests/browser-ui/chat-audio-job-restore.spec.ts`.
- Historical conversation with a raw direct audio payload remains inspectable
  as raw history but does not create product controls:
  `tests/browser-ui/chat-audio-job-restore.spec.ts`,
  `AudioPlayerCard.test.tsx`.
- Exact reuse and materialized audio asset routing are covered in 10b and
  remain protected by the 10c guardrail that only canonical snapshots can
  present product audio.

## Validation Completed

Focused 10c suite:

```bash
npm exec vitest run \
  src/adapters/ChatPresenter.test.ts \
  src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/hooks/chat/useJobStateStore.test.tsx \
  src/hooks/chat/workspaceRestoreApi.test.ts \
  src/lib/media/browser-runtime/job-snapshots.test.ts \
  tests/audio-job-contract-guardrails.test.ts \
  src/hooks/chat/useBrowserCapabilityRuntime.test.tsx \
  tests/chat-performance-a11y.test.tsx
```

Result: 10 files passed, 121 tests passed.

Patched a11y/audio slice:

```bash
npm exec vitest run \
  tests/chat-performance-a11y.test.tsx \
  src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx
```

Result: 2 files passed, 14 tests passed.

Browser restore regression:

```bash
npm exec playwright test tests/browser-ui/chat-audio-job-restore.spec.ts
```

Result: 1 passed.

Full validation:

```bash
npm run typecheck
npm test
```

Result: typecheck passed; 654 files passed, 4778 tests passed, 2 skipped.

## 10c Done Criteria Complete

- Product chat renders generated audio only from canonical job snapshots/result
  envelopes.
- Direct transcript `generate_audio` payloads remain raw history only.
- A completed audio job restores one playable card after reload.
- Missed job events reconcile through `/api/chat/jobs`.
- Failed/canceled audio jobs without assets do not show playable controls.
- Generated audio remains discoverable through governed asset catalog/list
  surfaces and usable by `compose_media`.
- Product code and tests remain free of `/api/runtime/generate-audio`,
  `browser:...:generate_audio`, and transcript-derived audio composition
  authority.
