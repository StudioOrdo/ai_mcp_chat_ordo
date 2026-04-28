# Phase 11: Tool Invocation Identity And Media Generation Gates

**Status:** Implemented  
**Parent Spec:** [../media-composition-reliability-and-anti-drift-spec.md](../media-composition-reliability-and-anti-drift-spec.md)  
**Incident Driver:** duplicate tool results, contradictory media status, and failed chart/audio/video composition in the cheese conversation incident  
**Objective:** Make every tool execution a first-class invocation with stable identity from provider tool use through stream events, persisted message parts, transcripts, job snapshots, browser runtime, media assets, and eval evidence.

---

## 1. Problem Statement

The current runtime can render duplicate or contradictory tool outcomes because it treats a tool call as a pair of display parts instead of a durable invocation record.

Today, identity is inferred from weak signals:

1. tool name
2. result payload
3. assistant message id
4. job id
5. content hash
6. browser-runtime candidate position

Those are useful secondary signals, but none is the invocation identity. Two legitimate calls can share the same tool name and payload, and one replayed call can appear with a new local position. This is why downstream dedupe has needed to exist in multiple places.

The intervention is not complete until duplicate suppression is a consequence of stable invocation identity, not a patch applied independently by each rendering or runtime surface.

---

## 2. Root-Cause Findings

### 2.1 Invocation Identity Is Dropped At The Provider Boundary

Anthropic tool-use blocks include a provider tool-use id, but the app callbacks currently pass only tool name, args, and result. The id does not survive into `StreamEvent`, `MessagePart`, transcript entries, job snapshots, browser runtime candidates, or media artifacts.

Required fix:

1. `runClaudeAgentLoopStream()` must pass an invocation id into both tool-call and tool-result callbacks.
2. If the provider supplies an id, use it as the canonical `toolInvocationId`.
3. If an internal tool invocation is synthesized, generate a deterministic local id from stream id, round index, and tool-use index.

### 2.2 One Execution Can Produce Multiple Renderable Records

The stream execution path may append a raw `tool_result`, then append derived job-status or deferred-job parts from the same result. This can be valid, but only if all derived records share the same `toolInvocationId` and renderers know they belong to one invocation track.

Required fix:

1. Raw result, deferred job snapshot, browser-runtime snapshot, and final media result must share invocation identity.
2. The UI must collapse multiple states for the same invocation into one visible track unless the spec explicitly allows a secondary artifact row.

### 2.3 Provider Retry Can Replay Side Effects

Provider resilience can retry or fall back after a partial attempt. If a tool side effect has already happened, retrying without an invocation id can duplicate execution or duplicate emission.

Required fix:

1. The tool executor must receive `toolInvocationId`.
2. Side-effecting tools must be idempotent by invocation id or by a documented stronger tool-specific key.
3. Retries must not execute the same invocation twice unless the tool declares it is safe and idempotent.

### 2.4 Transcript And Presenter Pairing Are Too Coarse

Transcript entries use the assistant message id as their source, and presenter pairing matches tool calls to results by name and encounter order. This fails for repeated tool names, duplicate replay, and multi-stage media outcomes.

Required fix:

1. Transcript entries for tool results must include `toolInvocationId`.
2. Presenter pairing must prefer exact invocation id over name/order pairing.
3. Name/order pairing may remain only as a backwards-compatibility fallback for historical messages.

### 2.5 Media Composition Can Narrate Intent Before Preconditions Are True

The failed cheese flow combined successful chart/audio generation with an invalid compose precondition: the chart result was not yet a compose-ready image asset. The assistant narration said composition was starting before preflight had proved the route was executable.

Required fix:

1. `compose_media` cannot enter running state until every referenced visual/audio clip is a governed asset of the correct kind.
2. Chart and graph outputs must be rasterized into governed image assets before video composition starts.
3. The assistant may say it is preparing or rasterizing inputs, but may not say composition is running until a browser, native, or deferred compose invocation has actually started.

---

## 3. Canonical Identity Contract

### 3.1 Required Field

Add `toolInvocationId: string` as the canonical identity field for active and future tool calls.

The field must be present on:

1. `StreamEvent` variants for `tool_call` and `tool_result`
2. `ChatAction` variants for `APPEND_TOOL_CALL` and `APPEND_TOOL_RESULT`
3. `MessagePart` variants for `tool_call` and `tool_result`
4. `ToolCallData` and any presenter-facing paired tool-call structure
5. transcript entries for `tool_result`
6. browser-runtime candidates and persisted browser-runtime entries
7. deferred job request metadata when a tool invocation queues a job
8. `JobStatusMessagePart` when the job status is a projection of a tool invocation
9. media asset provenance metadata where available
10. runtime audit events for tool start, tool result, job enqueue, and terminal outcome

Historical messages without this field must remain readable. Fallback identity may be derived for display only, but new executions must have a real id.

### 3.2 Identity Source Rules

1. Provider tool calls use Anthropic `tool_use.id` as `toolInvocationId`.
2. Internally synthesized tool calls use `local:<streamId>:<roundIndex>:<toolIndex>`.
3. Deferred jobs created from tool invocations must keep both `jobId` and `toolInvocationId`.
4. Browser-runtime jobs created from tool results must keep both `browserRuntimeJobId` and `toolInvocationId`.
5. A retry of the same invocation must reuse the same `toolInvocationId`.
6. A user-requested retry must create a new `toolInvocationId` and link `replayedFromToolInvocationId` if applicable.

### 3.3 Dedupe Rules

1. Exact duplicate `tool_result` events with the same `toolInvocationId` are ignored after the first terminal result unless they carry a higher sequence or a richer state for the same invocation track.
2. Two tool calls with different `toolInvocationId` values must both be preserved even if their name, args, and result are identical.
3. Raw tool result and job-status projection with the same `toolInvocationId` must render as one track, not two independent outcomes.
4. Content-hash dedupe is allowed only as a compatibility fallback when `toolInvocationId` is absent.

---

## 4. Code Paths That Must Be Updated

### 4.1 Provider And Stream Emission

1. [src/lib/chat/anthropic-stream.ts](../../../../../src/lib/chat/anthropic-stream.ts)
2. [src/lib/chat/stream-execution.ts](../../../../../src/lib/chat/stream-execution.ts)
3. [src/core/entities/chat-stream.ts](../../../../../src/core/entities/chat-stream.ts)
4. [src/adapters/chat/EventParserStrategy.ts](../../../../../src/adapters/chat/EventParserStrategy.ts)
5. [src/lib/chat/StreamStrategy.ts](../../../../../src/lib/chat/StreamStrategy.ts)
6. [src/hooks/chat/chatStreamDispatch.ts](../../../../../src/hooks/chat/chatStreamDispatch.ts)
7. [src/hooks/chat/chatStreamRunner.ts](../../../../../src/hooks/chat/chatStreamRunner.ts)

### 4.2 Persistence, Transcript, And Presentation

1. [src/core/entities/message-parts.ts](../../../../../src/core/entities/message-parts.ts)
2. [src/adapters/ConversationDataMapper.ts](../../../../../src/adapters/ConversationDataMapper.ts)
3. [src/lib/chat/transcript-store.ts](../../../../../src/lib/chat/transcript-store.ts)
4. [src/adapters/ChatPresenter.ts](../../../../../src/adapters/ChatPresenter.ts)
5. [src/frameworks/ui/MessageList.tsx](../../../../../src/frameworks/ui/MessageList.tsx)
6. [src/frameworks/ui/chat/ToolPluginPartRenderer.tsx](../../../../../src/frameworks/ui/chat/ToolPluginPartRenderer.tsx)

### 4.3 Media Runtime And Job Projection

1. [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts)
2. [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts)
3. [src/hooks/chat/composeMediaMaterializationCore.ts](../../../../../src/hooks/chat/composeMediaMaterializationCore.ts)
4. [src/lib/jobs/enqueue-deferred-tool-job.ts](../../../../../src/lib/jobs/enqueue-deferred-tool-job.ts)
5. [src/lib/jobs/deferred-job-result.ts](../../../../../src/lib/jobs/deferred-job-result.ts)
6. [src/lib/jobs/job-status-snapshots.ts](../../../../../src/lib/jobs/job-status-snapshots.ts)
7. [src/lib/jobs/compose-media-deferred-job.ts](../../../../../src/lib/jobs/compose-media-deferred-job.ts)
8. [src/app/api/chat/jobs/route.ts](../../../../../src/app/api/chat/jobs/route.ts)

### 4.4 Media Tool Surfaces

1. audio: [src/core/use-cases/tools/generate-audio.tool.ts](../../../../../src/core/use-cases/tools/generate-audio.tool.ts)
2. image: [src/lib/blog/blog-image-generation-service.ts](../../../../../src/lib/blog/blog-image-generation-service.ts)
3. image provider: [src/adapters/OpenAiBlogImageProvider.ts](../../../../../src/adapters/OpenAiBlogImageProvider.ts)
4. chart: [src/core/use-cases/tools/generate-chart.tool.ts](../../../../../src/core/use-cases/tools/generate-chart.tool.ts)
5. graph: [src/core/use-cases/tools/generate-graph.tool.ts](../../../../../src/core/use-cases/tools/generate-graph.tool.ts)
6. video compose: [src/core/use-cases/tools/compose-media.tool.ts](../../../../../src/core/use-cases/tools/compose-media.tool.ts)
7. browser compose: [src/lib/media/browser-runtime/ffmpeg-browser-executor.ts](../../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts)
8. worker compose: [src/lib/media/server/compose-media-worker-runtime.ts](../../../../../src/lib/media/server/compose-media-worker-runtime.ts)

---

## 5. Unit Test Requirements

### 5.1 Positive Unit Tests

1. `anthropic-stream` preserves provider `tool_use.id` on `onToolCall` and `onToolResult` callbacks.
2. `StreamEvent` parser preserves `toolInvocationId` for `tool_call` and `tool_result` SSE payloads.
3. `StreamStrategy` forwards `toolInvocationId` into chat actions.
4. reducer stores `toolInvocationId` on `tool_call` and `tool_result` message parts.
5. `ChatPresenter` pairs calls and results by `toolInvocationId` when present.
6. `TranscriptStore` writes one transcript entry per invocation result and includes `toolInvocationId`.
7. `job-snapshots` carries `toolInvocationId` from tool result to browser runtime job-status part.
8. deferred-job result conversion carries `toolInvocationId` into the returned job snapshot.
9. media asset identity extraction keeps invocation identity with audio, chart, graph, image, and compose candidates.

### 5.2 Negative Unit Tests

1. duplicate `tool_result` with the same `toolInvocationId` does not append a second result part.
2. two `tool_result` events with same payload but different `toolInvocationId` both append.
3. a job-status snapshot without a matching invocation id cannot overwrite a tracked invocation result.
4. `compose_media` rejects chart or graph source assets as visual clips until they are rasterized to image assets.
5. `compose_media` rejects audio clips whose asset id does not resolve to an audio asset.
6. a provider retry cannot call a side-effecting tool twice with the same `toolInvocationId` unless the tool reports idempotent reuse.
7. transcript export cannot emit two tool-result entries for the same `toolInvocationId` and same terminal sequence.

### 5.3 Edge-Case Unit Tests

1. historical messages without `toolInvocationId` still render using backwards-compatible name/order pairing.
2. two identical audio generations in one turn render as two cards only when invocation ids differ.
3. a raw tool result followed by a deferred job snapshot with the same invocation id renders as one invocation track.
4. a browser-runtime success snapshot followed by a deferred recovery snapshot with the same invocation id prefers the terminal successful artifact if sequence ordering says it is newer.
5. a failed snapshot followed by a durable-asset snapshot with the same invocation id resolves to the durable asset state.
6. malformed SSE metadata falls back without crashing, but logs a degradation event.
7. invocation ids survive JSON persistence round trips.

---

## 6. Integration Test Requirements

### 6.1 Stream And Persistence Integration

Required tests:

1. `/api/chat/stream` emits `tool_call` and `tool_result` events with the same `toolInvocationId` for one provider tool use.
2. a stream with duplicate same-id `tool_result` events produces one persisted result part.
3. a stream with two different invocation ids for the same tool produces two persisted result parts.
4. persisted messages hydrate back into the chat surface with invocation ids intact.
5. `convo.log` or transcript projection exposes `toolInvocationId` for tool-result entries.

Suggested files:

1. [tests/chat/chat-stream-route.test.ts](../../../../../tests/chat/chat-stream-route.test.ts)
2. [src/hooks/chat/useChatStreamRuntime.test.tsx](../../../../../src/hooks/chat/useChatStreamRuntime.test.tsx)
3. [src/hooks/chat/chatStreamRunner.test.ts](../../../../../src/hooks/chat/chatStreamRunner.test.ts)
4. [src/adapters/ConversationDataMapper.test.ts](../../../../../src/adapters/ConversationDataMapper.test.ts)
5. [src/lib/chat/transcript-store.test.ts](../../../../../src/lib/chat/transcript-store.test.ts)

### 6.2 Media Runtime Integration

Required tests:

1. `generate_audio` stream result creates one playable audio card and one transcript result for the invocation.
2. `generate_blog_image` result carries invocation identity through artifact payload and card rendering.
3. `generate_chart` result carries invocation identity through chart storage and any rasterized derivative.
4. `generate_graph` result carries invocation identity through graph storage and any rasterized derivative.
5. `compose_media` browser-runtime candidate uses the originating invocation id.
6. `compose_media` deferred fallback uses the same invocation id in the queued job snapshot.
7. media composition from chart plus audio creates exactly one compose invocation track after chart rasterization.
8. media composition from graph plus audio creates exactly one compose invocation track after graph rasterization.
9. media composition from generated image plus audio creates exactly one compose invocation track.
10. repeated submit of the same compose plan reuses the expected job identity without duplicating visible invocation tracks.

Suggested files:

1. [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx)
2. [src/lib/media/browser-runtime/job-snapshots.test.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.test.ts)
3. [src/lib/jobs/compose-media-deferred-job.test.ts](../../../../../src/lib/jobs/compose-media-deferred-job.test.ts)
4. [src/app/api/chat/jobs/route.test.ts](../../../../../src/app/api/chat/jobs/route.test.ts)
5. [src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx](../../../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx)
6. [src/frameworks/ui/chat/plugins/custom/ChartRendererCard.test.tsx](../../../../../src/frameworks/ui/chat/plugins/custom/ChartRendererCard.test.tsx)
7. [src/frameworks/ui/chat/plugins/custom/GraphRendererCard.test.tsx](../../../../../src/frameworks/ui/chat/plugins/custom/GraphRendererCard.test.tsx)
8. [src/frameworks/ui/chat/plugins/custom/EditorialWorkflowCard.test.tsx](../../../../../src/frameworks/ui/chat/plugins/custom/EditorialWorkflowCard.test.tsx)

---

## 7. Real Media Generation Test Requirements

Routine unit tests may use mocks, but the intervention is not accepted until real media generation paths are covered by live or artifact-backed tests. These tests may be gated by environment variables and run in media release gates rather than every pull request.

### 7.1 Audio

Positive tests:

1. generate a real audio asset through the active TTS path
2. assert governed `uf_` asset id
3. assert MIME type is audio
4. assert duration is greater than zero
5. assert waveform or ffprobe evidence proves non-silent audio where expected
6. assert exactly one visible audio card per `toolInvocationId`

Negative tests:

1. TTS provider failure produces one failed invocation track
2. retry creates a new invocation id linked to the failed one
3. durable cached audio result with failed browser status renders as ready, not failed

Edge tests:

1. two identical text/title requests in the same turn remain separate only if invocation ids differ
2. cached audio reuse is explicit and does not duplicate transcript entries

### 7.2 Image

Positive tests:

1. generate a real image through the blog image generation path or media lab image endpoint
2. assert asset is stored with governed identity
3. assert image dimensions are nonzero
4. assert image can be reused as a `compose_media` visual clip
5. assert image-generation invocation id is preserved in artifact provenance

Negative tests:

1. provider returns no image bytes and the invocation fails once
2. generated `blogasset_` identity is not used as an audio clip
3. inaccessible image asset fails compose preflight before compose starts

Edge tests:

1. generated image reused across a later turn keeps asset identity and not the original invocation id as execution truth
2. imported or uploaded images without invocation id remain composable through governed asset id

### 7.3 Chart

Positive tests:

1. generate a Mermaid chart result
2. store the chart payload as governed media
3. rasterize the chart to a governed image derivative before composition
4. compose chart image plus generated audio into a real playable video
5. assert one chart invocation track and one compose invocation track

Negative tests:

1. raw `text/vnd.mermaid` chart asset is rejected as direct compose visual
2. invalid Mermaid syntax fails in the chart/rasterization invocation, not as an ambiguous compose failure
3. duplicate chart result with same invocation id does not create duplicate browser-runtime candidates

Edge tests:

1. large chart truncation or simplification emits a diagnostic and still preserves invocation identity
2. later reuse of chart derivative uses governed image asset id, not the chart source id

### 7.4 Graph

Positive tests:

1. generate a graph result
2. store graph payload as governed media
3. rasterize graph to governed image derivative before composition
4. compose graph image plus generated audio into a real playable video
5. assert graph invocation identity links source graph, rasterized derivative, and compose input lineage

Negative tests:

1. raw graph JSON asset is rejected as direct compose visual
2. graph render failure produces one terminal invocation track
3. duplicate graph result with same invocation id does not duplicate cards, transcript entries, or runtime candidates

Edge tests:

1. oversized table graph truncation emits diagnostic and preserves invocation identity
2. graph derivative reuse in a later turn remains governed by asset id with provenance back to original invocation

### 7.5 Video Composition

Positive tests:

1. generated image plus generated audio produces a playable video
2. uploaded image plus generated audio produces a playable video
3. chart derivative plus generated audio produces a playable video
4. graph derivative plus generated audio produces a playable video
5. uploaded video pair concatenates into a playable video
6. prior output video can be reused in a new composition
7. browser WASM success writes a governed video asset
8. browser fallback enqueues exactly one deferred job for the same invocation track
9. direct deferred composition succeeds without a browser attempt where configured

Negative tests:

1. missing visual asset fails preflight before compose starts
2. missing audio asset fails preflight before compose starts when audio is required
3. chart or graph source passed directly to compose fails with the canonical message
4. invalid asset id prefix fails at parse/enqueue boundary
5. media worker unavailable produces deferred recovery or explicit terminal failure, not an orphaned running card
6. ffmpeg failure produces one failed invocation track with diagnostic logs

Edge tests:

1. reload during browser composition recovers one coherent invocation track
2. missed SSE after deferred completion reconstructs one terminal snapshot
3. cancel then retry links the new invocation to the old one without overwriting history
4. retrograde job events do not regress the visible state for an invocation
5. repeated compose request for same plan dedupes job creation while preserving user-visible invocation semantics

---

## 8. Eval And Release Gate Requirements

### 8.1 Deterministic Evals

Add deterministic eval scenarios that do not require live providers but prove planning and truthfulness.

Required scenarios:

1. `tool-invocation-id-preserved-through-stream`
2. `duplicate-tool-result-same-invocation-suppressed`
3. `same-payload-different-invocation-preserved`
4. `media-chart-requires-rasterized-image-before-compose`
5. `media-graph-requires-rasterized-image-before-compose`
6. `media-compose-does-not-narrate-running-before-preflight`
7. `media-compose-reuses-governed-assets-only`

### 8.2 Browser E2E Evals

Extend the browser media eval suite with invocation assertions.

Required scenario families:

1. audio generation card uniqueness
2. generated image to video
3. chart to video
4. graph to video
5. prior video reuse
6. browser fallback to deferred compose
7. reload/missed-SSE recovery for media jobs

Suggested files:

1. [tests/browser-ui/media-compose-eval.spec.ts](../../../../../tests/browser-ui/media-compose-eval.spec.ts)
2. [tests/browser-ui/media-live-workflows.spec.ts](../../../../../tests/browser-ui/media-live-workflows.spec.ts)
3. [tests/browser-ui/media-compose-planner-eval.spec.ts](../../../../../tests/browser-ui/media-compose-planner-eval.spec.ts)
4. [tests/browser-ui/helpers/media-eval.ts](../../../../../tests/browser-ui/helpers/media-eval.ts)

### 8.3 Evidence Bundle Requirements

Every live media eval must write evidence containing:

1. conversation id
2. stream id
3. tool invocation ids
4. job ids
5. input asset ids
6. derivative asset ids
7. final asset ids
8. runtime route used
9. transcript entry count per invocation
10. rendered card count per invocation
11. ffprobe or browser playback proof for video/audio outputs
12. browser console and runtime audit excerpts for failures

### 8.4 Release Gate

The intervention is not complete until these commands or their successors are documented and passing in release evidence:

1. focused unit and integration bundle for invocation identity
2. media core matrix
3. media recovery matrix
4. media continuity matrix
5. live provider media generation gate when provider credentials are available

Passing rule:

1. no duplicate visible tool result for the same `toolInvocationId`
2. no duplicate transcript tool result for the same `toolInvocationId`
3. no duplicate browser-runtime candidate for the same `toolInvocationId`
4. every media output used in composition is a governed asset of the correct kind
5. every video eval proves playable video
6. every audio-required video eval proves audio presence
7. assistant copy never claims completed or running video before the runtime state supports it

---

## 9. Implementation Order

### Slice 11A: Schema And Backwards-Compatible Identity

1. Add `toolInvocationId` to stream events, actions, message parts, presenter types, transcript entries, and job-status parts.
2. Keep historical fallback rendering.
3. Add parser, reducer, persistence, and transcript unit tests.

Exit criteria:

1. new executions carry invocation id in memory and persistence
2. old messages still render

### Slice 11B: Provider And Tool Executor Identity

1. Pass provider tool-use id through streaming callbacks.
2. Pass invocation id into the tool executor context.
3. Add idempotency tests for side-effecting tool execution.

Exit criteria:

1. same provider invocation cannot execute twice without idempotent reuse
2. retry behavior is explicit and test-backed

### Slice 11C: Presentation And Transcript Canonicalization

1. Pair tool calls and results by invocation id.
2. Collapse raw result plus job-status projection into one track.
3. Add presenter, plugin, transcript, and message-list tests.

Exit criteria:

1. no duplicate visible card for one invocation
2. transcript has one terminal entry per invocation result

### Slice 11D: Media Runtime Identity

1. Thread invocation id through browser runtime candidates, deferred enqueue, job snapshots, and media asset provenance.
2. Add audio, image, chart, graph, and video integration tests.

Exit criteria:

1. media runtime reconstructs lineage from invocation to final artifact
2. compose preflight blocks invalid source assets before running

### Slice 11E: Eval And Release Gates

1. Add deterministic eval scenarios.
2. Add live media eval assertions.
3. Add evidence bundle fields.

Exit criteria:

1. media eval evidence can prove invocation uniqueness and artifact validity
2. release gate fails on duplicate invocation output

---

## 10. Non-Goals

1. Do not replace job ids with invocation ids. They represent different things.
2. Do not remove plan-id dedupe for `compose_media`; it remains the job-level dedupe key.
3. Do not make content hash the primary identity key for new executions.
4. Do not require live provider tests in every local developer run.
5. Do not use UI-only filtering as the acceptance fix.

---

## 11. Acceptance Checklist

- [x] `toolInvocationId` is mandatory for new tool calls and results.
- [x] provider tool-use id survives to client stream events.
- [x] tool executor receives invocation identity.
- [x] side-effecting media tools are idempotent by invocation or documented stronger key.
- [x] persisted message parts include invocation identity.
- [x] transcript entries include invocation identity.
- [x] presenter pairing uses invocation identity first.
- [x] browser runtime candidates include invocation identity.
- [x] deferred job snapshots include invocation identity.
- [x] audio generation has positive, negative, and edge coverage.
- [x] image generation has positive, negative, and edge coverage.
- [x] chart generation and rasterization have positive, negative, and edge coverage.
- [x] graph generation and rasterization have positive, negative, and edge coverage.
- [x] video composition has positive, negative, and edge coverage.
- [x] deterministic evals cover duplicate and truthfulness failures.
- [x] live media evals prove real audio, image, chart, graph, and video paths when credentials are available.
- [x] release evidence records invocation ids, job ids, asset ids, and playback proof.

## 12. Implemented Gate

Run the deterministic Phase 11 gate with:

```bash
npm run qa:phase-11-tool-invocation
```

The command writes [release/phase-11-tool-invocation-evidence.json](../../../../../release/phase-11-tool-invocation-evidence.json). It always runs the deterministic identity/media provenance bundle and records the required scenarios, passing rules, command status, and evidence tails.

Live media/browser/provider gates are wired into the same command and run when credentials and browser media infrastructure are available:

```bash
ORDO_PHASE_11_LIVE_MEDIA=1 npm run qa:phase-11-tool-invocation
```

Live eval debug bundles now include invocation evidence: conversation id, stream ids, tool invocation ids, job ids, input/derivative/final asset ids, runtime routes, transcript counts per invocation, rendered card counts per invocation, and playback/ffprobe proof where the scenario produces media.