# Phase 9 — Canonicalization Closeout And Runtime Promotion

> Status: In Progress
> Loop State: The first Phase 9 slices are live: conversation media asset discovery, audio payload continuity, portability-layer export and replay continuity, breadcrumb canonicalization, and the next production non-host runtime choice are now real; final doc harmonization and the broader focused runtime rerun remain.
> Goal: Finish the residual non-canonical seams left after Phase 8, document the true completion state honestly, and close the asset-continuity gap that currently prevents generated charts, graphs, and audio from being reused reliably in `compose_media` production flows.
> Prerequisites: Phase 8 evidence should stay green and the execution-target contract from Phase 7 should remain stable.

## Phase Intent

Phase 9 exists to prevent Phase 8 from staying "almost finished" indefinitely. The main architectural work from Phase 8 is already real: ownership is explicit, heavy media execution is externalized, and admin-intelligence is sidecar-first. What remains is narrower and more dangerous because it is easy to ignore: dead compatibility helpers that make docs overclaim, sprint stubs that preserve a non-canonical surface, legacy assembly seams that keep older patterns alive, and an unresolved asset-continuity gap between media generation and media composition. The code already proves that charts, graphs, audio, and composed video can all live in the governed `user_files` surface, but the production chat workflow still does not promote those assets into a reusable, discoverable contract that later `compose_media` calls can depend on. This phase should close the leftover credibility gap between the docs and the code, remove the manual-demo ceiling visible in the incident transcript, and convert the next-runtime question into an explicit tracked decision rather than a vague future intention.

## Source Anchors To Refresh

- [./phase-8-core-pack-separation-and-heavy-runtime-externalization.md](./phase-8-core-pack-separation-and-heavy-runtime-externalization.md#L1)
- [./status-board.md](./status-board.md#L1)
- [../refactor-roadmap.md](../refactor-roadmap.md#L1)
- [../subsystems/execution-targets.md](../subsystems/execution-targets.md#L1)
- [../../../../src/components/admin/AdminBreadcrumb.tsx](../../../../src/components/admin/AdminBreadcrumb.tsx#L1)
- [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L1)
- [../../../../src/frameworks/ui/chat/plugins/system/resolve-system-card.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-system-card.ts#L1)
- [../../../../src/core/capability-catalog/capability-ownership.ts](../../../../src/core/capability-catalog/capability-ownership.ts#L1)
- [../../../../src/lib/capabilities/local-external-target-inventory.ts](../../../../src/lib/capabilities/local-external-target-inventory.ts#L1)
- [../../../../src/lib/media/server/media-worker-client.ts](../../../../src/lib/media/server/media-worker-client.ts#L1)
- [../../../../src/lib/media/server/compose-media-worker-runtime.ts](../../../../src/lib/media/server/compose-media-worker-runtime.ts#L1)
- [../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1)
- [../../../../src/lib/media/browser-runtime/job-snapshots.ts](../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)
- [../../../../src/lib/media/media-asset-projection.ts](../../../../src/lib/media/media-asset-projection.ts#L1)
- [../../../../src/lib/user-files.ts](../../../../src/lib/user-files.ts#L1)
- [../../../../src/app/api/tts/route.ts](../../../../src/app/api/tts/route.ts#L1)
- [../../../../src/app/api/user-files/[id]/route.ts](../../../../src/app/api/user-files/[id]/route.ts#L1)
- [../../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx#L1)
- [../../../../src/frameworks/ui/chat/plugins/custom/ChartRendererCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/ChartRendererCard.tsx#L1)
- [../../../../src/frameworks/ui/chat/plugins/custom/GraphRendererCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/GraphRendererCard.tsx#L1)
- [../../../../src/core/entities/media-composition.ts](../../../../src/core/entities/media-composition.ts#L1)
- [../../../../src/lib/jobs/deferred-job-handler-factories.ts](../../../../src/lib/jobs/deferred-job-handler-factories.ts#L1)
- [../../../../src/lib/jobs/deferred-job-handlers.ts](../../../../src/lib/jobs/deferred-job-handlers.ts#L1)

## Current-State Questions

- Which Phase 8 claims are fully true in code and test evidence, and which are only directionally true?
- Which residual seams are dead code or sprint stubs and can simply be deleted or replaced now?
- Which legacy seams are still active enough to require measured migration instead of removal?
- Where do generated charts, graphs, and audio already become governed assets, and where does that asset identity disappear from the production chat workflow?
- What transcript-, API-, or tool-level surface should let the model discover existing conversation assets instead of relying on remembered card text or fabricated handles?
- What is the next production-owned non-host runtime after `compose_media`, and what evidence would make that decision real instead of aspirational?
- Which docs still describe the right direction but the wrong completion state?

## Drift Traps

- Treating the remaining Phase 8 work as "cosmetic" even when it changes whether the docs are trustworthy.
- Reopening broad abstraction work in execution targets instead of finishing canonicalization and runtime ownership.
- Calling a dead helper "done enough" and leaving it in place, which preserves a false compatibility surface.
- Adding a new runtime abstraction or native-executor module before naming the exact next workload it will own.
- Assuming the media problem is inside FFmpeg when the real production failure is earlier: asset promotion, discovery, and conversation continuity.
- Solving only the UI display of asset IDs without adding a model-usable way to locate and select governed assets for later composition.
- Updating only the packet while leaving the status board, roadmap, or subsystem note out of sync.

## Pre-Implementation QA Gate

- [ ] Refresh the current Phase 8 evidence bundle and production build.
- [ ] Re-read the Phase 8 packet, status board, roadmap, and execution-target subsystem note together.
- [ ] Confirm which residual seams are dead-code deletions, which are canonical replacements, and which are still real product work.
- [ ] Trace the current chart, graph, audio, and compose-media asset lifecycle from generation to persisted `user_files` record to later reuse.
- [ ] Record the exact verification commands for this phase before making code changes.
- [ ] Update this packet's verified-state notes before closing any of the listed items.

## Verified Current State

This section is pre-populated from the 2026-04-14 audit and should be updated when Phase 9 starts implementation.

### Current Code Notes

- The first ownership cut is real in [../../../../src/core/capability-catalog/capability-ownership.ts](../../../../src/core/capability-catalog/capability-ownership.ts#L60), [../../../../src/core/capability-catalog/capability-ownership.ts](../../../../src/core/capability-catalog/capability-ownership.ts#L82), and [../../../../src/core/capability-catalog/capability-ownership.ts](../../../../src/core/capability-catalog/capability-ownership.ts#L113).
- The first heavy-runtime extraction is real: `compose_media` now reaches the dedicated worker client in [../../../../src/lib/media/server/media-worker-client.ts](../../../../src/lib/media/server/media-worker-client.ts#L32), and the worker persists governed artifacts with `primaryAssetId` output in [../../../../src/lib/media/server/compose-media-worker-runtime.ts](../../../../src/lib/media/server/compose-media-worker-runtime.ts#L116) and [../../../../src/lib/media/server/compose-media-worker-runtime.ts](../../../../src/lib/media/server/compose-media-worker-runtime.ts#L125).
- The admin-intelligence pack is sidecar-first by default and now includes `admin_search` in [../../../../src/lib/capabilities/shared/admin-intelligence-tool.ts](../../../../src/lib/capabilities/shared/admin-intelligence-tool.ts#L74) and [../../../../src/lib/capabilities/shared/admin-intelligence-tool.ts](../../../../src/lib/capabilities/shared/admin-intelligence-tool.ts#L103).
- Deferred-job handler derivation is farther along than the packet originally implied: [../../../../src/lib/jobs/deferred-job-handler-factories.ts](../../../../src/lib/jobs/deferred-job-handler-factories.ts#L95) is empty, and [../../../../src/lib/jobs/deferred-job-handlers.ts](../../../../src/lib/jobs/deferred-job-handlers.ts#L1) now assembles handlers from the canonical job tool list rather than a handwritten per-tool table.
- The legacy `blog`, `book`, `books`, and `corpus` route families are deleted from the app tree.
- Browser-managed media generation already persists more than the incident transcript suggested.
- `generate_audio` stores governed audio assets through [../../../../src/app/api/tts/route.ts](../../../../src/app/api/tts/route.ts#L201), and the returned payload already carries `assetId` plus `cached_asset` semantics in [../../../../src/core/use-cases/tools/UiTools.ts](../../../../src/core/use-cases/tools/UiTools.ts#L80).
- `generate_chart` and `generate_graph` are uploaded into `user_files` by the browser runtime when they do not already have an asset ID in [../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L146) and [../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L225).
- Browser-runtime job snapshots already know how to expose stored chart, graph, audio, and composed-video artifacts through transcript-safe `resultEnvelope.artifacts` in [../../../../src/lib/media/browser-runtime/job-snapshots.ts](../../../../src/lib/media/browser-runtime/job-snapshots.ts#L167).
- The viewer cards for audio, chart, and graph already display stored asset rails or asset IDs when artifact refs are present in [../../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx#L74), [../../../../src/frameworks/ui/chat/plugins/custom/ChartRendererCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/ChartRendererCard.tsx#L51), and [../../../../src/frameworks/ui/chat/plugins/custom/GraphRendererCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/GraphRendererCard.tsx#L58).
- `compose_media` already accepts governed `chart`, `graph`, and `audio` clip kinds in [../../../../src/core/entities/media-composition.ts](../../../../src/core/entities/media-composition.ts#L4), and the server runtime resolves those clip asset IDs from `user_files` before composition in [../../../../src/lib/media/server/compose-media-worker-runtime.ts](../../../../src/lib/media/server/compose-media-worker-runtime.ts#L62).
- The current production ceiling is not storage or execution. It is continuity and discovery.
- There is only a direct-download route for user files in [../../../../src/app/api/user-files/[id]/route.ts](../../../../src/app/api/user-files/[id]/route.ts#L1); there is no first-class chat-facing route or capability for listing reusable conversation assets.
- The model is told not to fabricate `compose_media` asset IDs in [../../../../src/core/capability-catalog/families/media-capabilities.ts](../../../../src/core/capability-catalog/families/media-capabilities.ts#L155), but the production chat workflow does not yet provide a canonical way to discover valid prior asset IDs from the current conversation.
- That mismatch explains the incident transcript: the runtime could have consumed real governed assets, but the assistant had no trustworthy surface for locating them and fell back to placeholder demo handles.
- Remaining unresolved seams confirmed during audit include the following.
- [../../../../src/components/admin/AdminBreadcrumb.tsx](../../../../src/components/admin/AdminBreadcrumb.tsx#L3) is still an explicit sprint stub.
- [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L54) still documents direct `getDb()` route-handler usage as a legacy migration seam.
- [../../../../src/frameworks/ui/chat/plugins/system/resolve-system-card.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-system-card.ts#L55) still carries a dead `isCompatibilitySnapshot(...)` helper that always returns `false`.
- The roadmap still points to a future native-executor surface in [../refactor-roadmap.md](../refactor-roadmap.md#L219), but there is still no dedicated `native-executors.ts` module or `services/` tree.

### Current QA Notes

- Focused Phase 8 runtime bundle passed on 2026-04-14: 10 files and 64 tests covering ownership mapping, native media targeting, media worker routing, job registry derivation, runtime binding parity, and both admin MCP stdio surfaces.
- A fresh production build passed on 2026-04-14 after the audit fixes, including search-index generation, TypeScript, and static page generation.
- The current QA evidence proves the first media native-process pilot and `admin_web_search` parity across `host_ts`, `mcp_stdio`, and `mcp_container`, but it does not yet prove a second production-owned non-host workload after `compose_media`.
- Incident transcript review on 2026-04-14 showed two distinct production gaps.
- The video path failed operationally because the assistant could not discover real governed asset handles from prior chart and audio generations, not because the `compose_media` runtime rejected those media kinds.
- The journal-article incident showed a separate replay and lease-continuity problem, but that is adjacent to this media issue rather than the direct cause of failed media composition.

## Suggested Verification Commands

```bash
npx vitest run \
  src/core/capability-catalog/capability-ownership.test.ts \
  src/lib/capabilities/local-external-target-inventory.test.ts \
  src/lib/media/server/media-worker-client.test.ts \
  src/lib/jobs/job-capability-registry.test.ts \
  src/lib/jobs/deferred-job-runtime.test.ts \
  src/lib/jobs/compose-media-deferred-job.test.ts \
  src/lib/capabilities/shared/admin-intelligence-tool.test.ts \
  src/core/capability-catalog/runtime-tool-binding.test.ts \
  tests/mcp/transport/admin-web-search-mcp-stdio.test.ts \
  tests/mcp/transport/operations-mcp-stdio.test.ts

npm run build
```

## Expected Evidence Artifacts

- A deletion or canonical replacement record for the dead compatibility helper and any other proven dead seams.
- A concrete resolution for the admin breadcrumb stub: either a real canonical implementation or an explicit decision to remove it.
- A smaller legacy note or reduced call surface around direct `getDb()` route-handler usage in [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L54).
- A concrete asset-continuity design note covering generation, persistence, transcript projection, asset discovery, and composition reuse for charts, graphs, audio, and composed video.
- A first-class route or tool contract that lets the assistant list reusable governed assets for the active conversation instead of relying on card memory.
- Transcript or message-level continuity evidence that later turns can recover valid asset IDs from prior media generations without rerunning those tools.
- An explicit decision note naming the next production-owned `native_process` or `remote_service` workload after `compose_media`, with rationale and target runtime shape.
- Updated docs so the Phase 8 packet, status board, roadmap, and execution-target subsystem note all reflect the same completion state.
- A rerun of the focused Phase 8 runtime bundle and a green production build after any code or doc updates.

## Detailed Implementation Plan

1. Close the residual non-canonical seams left behind by Phase 8.
   - Delete dead compatibility helpers that no longer gate any runtime behavior.
   - Replace or remove sprint stubs that still preserve a non-canonical UI or assembly surface.
2. Reduce the remaining legacy assembly notes to the smallest truthful surface.
   - Re-check direct `getDb()` usage and move any easy route-handler cases behind repository exports.
   - Narrow or update the legacy note in `RepositoryFactory` so it describes the real remaining migration set, not a generic future intention.
3. Promote generated media assets into a reusable production contract.
   - Keep chart, graph, audio, and composed-video outputs aligned on the same governed `user_files` identity rules: `assetId`, `assetKind`, `source`, `retentionClass`, and `conversationId`.
   - Audit where those fields are only implicit in UI payloads versus canonically projected into transcript-safe envelopes and replay surfaces.
   - Eliminate cases where the UI can render a stored asset but the later conversation turn cannot reliably recover or reuse that same asset identity.
4. Add a first-class asset discovery surface for composition workflows.
   - Introduce a canonical conversation-asset query path backed by `UserFileRepository.listByConversation(...)` so the model can locate valid governed assets before planning `compose_media`.
   - Prefer a real tool or route-level surface over card scraping or transcript heuristics.
   - Shape the output around composition planning: asset ID, kind, label or title, duration or dimensions when available, originating tool, and retention constraints.
5. Connect asset discovery to `compose_media` planning and transcript continuity.
   - Ensure later turns can recover previously generated chart, graph, and audio asset IDs from the same conversation without forcing regeneration.
   - Add composition-oriented guidance so the assistant uses discovered governed assets rather than placeholder IDs.
   - Verify that `compose_media` plans using discovered chart, graph, and audio assets can execute on both the browser and deferred-worker paths.
6. Convert the next-runtime question into an explicit tracked decision.
   - Decide whether the next production-owned non-host workload after `compose_media` is another media workload, an admin-intelligence workload, or a future remote-service candidate.
   - Record the chosen workload, default target shape, and non-goals in code-adjacent docs.
7. Align the docs to the actual completion state.
   - Update the Phase 8 packet where it overstates deletions or understates derived runtime ownership.
   - Keep the Phase 9 packet, status board, roadmap, and execution-target subsystem note synchronized in one patch.

## Code-Level Implementation Notes

### Asset Discovery Surface

1. Add a canonical conversation-asset read surface instead of relying on card memory.
   - Reuse [../../../../src/core/use-cases/UserFileRepository.ts](../../../../src/core/use-cases/UserFileRepository.ts#L1) and [../../../../src/adapters/UserFileDataMapper.ts](../../../../src/adapters/UserFileDataMapper.ts#L47) as the single source of truth for reusable generated assets.
   - Prefer adding a chat-safe route that lists only the active user's assets for one conversation instead of extending the existing direct-download route in [../../../../src/app/api/user-files/[id]/route.ts](../../../../src/app/api/user-files/[id]/route.ts#L1).
   - If a model-callable tool is added, register it through the capability catalog and the media bundle in [../../../../src/lib/chat/tool-bundles/media-tools.ts](../../../../src/lib/chat/tool-bundles/media-tools.ts#L1) so the discovery surface ships with `compose_media`, `generate_audio`, `generate_chart`, and `generate_graph`.
   - Shape the returned payload around composition planning, not generic file browsing: `assetId`, `assetKind`, `mimeType`, `conversationId`, `createdAt`, `toolName`, `retentionClass`, `source`, and dimensions or duration from `metadata` when available.
   - Filter out non-media documents by reusing projection logic from [../../../../src/lib/media/media-asset-projection.ts](../../../../src/lib/media/media-asset-projection.ts#L68) instead of open-coding another asset-kind classifier.

2. Keep the route and tool contract honest about ownership and scope.
   - Require conversation ownership checks similar to chat job and conversation routes before listing assets.
   - Return only assets that can legally participate in media composition: `audio`, `chart`, `graph`, `image`, `video`, `subtitle`, `waveform`.
   - Include a composition-friendly display label derived from existing payload fields or stored filename so the assistant can describe candidate assets clearly before selecting them.

### Transcript And Envelope Continuity

1. Preserve reusable asset identity in the transcript and replay surfaces.
   - Audit [../../../../src/lib/media/browser-runtime/job-snapshots.ts](../../../../src/lib/media/browser-runtime/job-snapshots.ts#L167) and [../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L146) to ensure that every persisted chart or graph result includes the final `assetId`, `assetKind`, `mimeType`, `source`, and `retentionClass` in the canonical `resultEnvelope.payload`, not only in derived artifact rails.
   - Keep audio aligned with the same contract by treating [../../../../src/core/use-cases/tools/UiTools.ts](../../../../src/core/use-cases/tools/UiTools.ts#L80) as the compatibility payload and [../../../../src/app/api/tts/route.ts](../../../../src/app/api/tts/route.ts#L201) as the authoritative persistence seam.
   - Avoid any phase 9 change that leaves the UI cards informative while the stored conversation export or replay snapshot drops the reusable asset metadata.

2. Normalize the projection layer rather than patching each card independently.
   - Prefer strengthening [../../../../src/lib/media/media-asset-projection.ts](../../../../src/lib/media/media-asset-projection.ts#L52) and the result-envelope assembly path over adding more `assetId`-specific logic in [../../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx#L1), [../../../../src/frameworks/ui/chat/plugins/custom/ChartRendererCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/ChartRendererCard.tsx#L1), or [../../../../src/frameworks/ui/chat/plugins/custom/GraphRendererCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/GraphRendererCard.tsx#L1).
   - The cards should remain consumers of `resultEnvelope.artifacts` and `resultEnvelope.payload`, not become independent authorities for asset continuity.

### Compose-Media Planning Integration

1. Add an explicit locate-then-compose path to the media workflow.
   - Update the model-facing guidance around `compose_media` so the assistant first discovers governed assets, then emits the composition plan.
   - Keep [../../../../src/core/entities/media-composition.ts](../../../../src/core/entities/media-composition.ts#L1) as the planning contract and do not loosen the `assetId` requirement.
   - Use the discovery surface to fill `visualClips` and `audioClips` with real asset IDs and the correct clip `kind` values already supported by the runtime.

2. Keep execution-target behavior unchanged unless the discovery work exposes a real runtime bug.
   - The browser path already dereferences `assetId` to `/api/user-files/:id` in the FFmpeg executor and the server worker already resolves asset paths from `user_files`; Phase 9 should not fork those rules.
   - If composition fails after real asset discovery is wired up, treat that as a separate runtime defect and track it independently from the discovery work.

### Candidate File Changes

1. New route or tool surface.
   - Candidate route: add a conversation-scoped asset listing route near the existing user-file download surface under `src/app/api/user-files/`.
   - Candidate tool: add a catalog-backed discovery tool that queries `UserFileRepository.listByConversation(...)` and register it in the media bundle.

2. Existing code expected to change.
   - [../../../../src/core/use-cases/UserFileRepository.ts](../../../../src/core/use-cases/UserFileRepository.ts#L1): only if projection-specific query helpers are truly needed; otherwise keep the interface stable.
   - [../../../../src/adapters/UserFileDataMapper.ts](../../../../src/adapters/UserFileDataMapper.ts#L47): only if sorting, filtering, or metadata enrichment for media discovery cannot live above the repository.
   - [../../../../src/lib/media/media-asset-projection.ts](../../../../src/lib/media/media-asset-projection.ts#L1): central place for turning stored user files into transcript-safe composition candidates.
   - [../../../../src/lib/media/browser-runtime/job-snapshots.ts](../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1): strengthen canonical payload and artifact projection for persisted chart, graph, and audio results.
   - [../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1): only to ensure persistence writes back the canonical stored metadata after upload.
   - [../../../../src/lib/chat/tool-bundles/media-tools.ts](../../../../src/lib/chat/tool-bundles/media-tools.ts#L1): include any new asset-discovery tool in the same governed bundle as media generation and composition.

### Test Notes

1. Add coverage for the new discovery seam.
   - Route or tool tests should prove that only the active user's assets from the requested conversation are returned.
   - Include mixed asset types so the result shows `chart`, `graph`, `audio`, and unrelated documents filtered appropriately.

2. Add continuity tests for later-turn reuse.
   - Extend browser-runtime or chat tests so a generated chart or graph is persisted, later rediscovered, and then selected into a valid `compose_media` plan.
   - Add at least one audio-plus-chart or audio-plus-graph test that proves the assistant no longer needs fabricated placeholder handles.

3. Keep runtime tests targeted.
   - Reuse the existing focused media and runtime-binding suites before adding new broad end-to-end coverage.
   - Only add a larger browser or deferred-worker scenario if the smaller continuity tests do not fully exercise the new discovery contract.

## Scope Guardrails

- Do not reopen planner or adapter abstraction work unless a verified bug requires it.
- Do not invent a generic native-executor framework before choosing the next concrete workload.
- Do not broaden this phase into a general UI redesign.
- Do not preserve dead compatibility code just because it is already inert.
- Do not solve this only as a chat-card affordance; the assistant needs a canonical model-usable asset discovery path.
- Do not couple composition to brittle transcript parsing when `user_files` already exists as the governed asset store.

## Implementation Record

- Date: 2026-04-14
- Files changed:
   - `src/lib/chat/conversation-portability.ts`
   - `src/core/use-cases/ConversationInteractor.test.ts`
  - `src/core/use-cases/tools/list-conversation-media-assets.tool.ts`
  - `src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts`
  - `src/lib/media/media-asset-projection.ts`
  - `src/lib/media/media-asset-projection.test.ts`
  - `src/core/capability-catalog/catalog-input-schemas.ts`
  - `src/core/capability-catalog/families/media-capabilities.ts`
  - `src/core/capability-catalog/runtime-tool-binding.ts`
  - `src/core/capability-catalog/runtime-tool-binding.test.ts`
  - `src/core/capability-catalog/catalog.test.ts`
  - `src/core/capability-catalog/capability-ownership.test.ts`
  - `src/lib/chat/tool-bundles/media-tools.ts`
  - `src/frameworks/ui/chat/plugins/system/resolve-system-card.ts`
- Summary of what landed:
   - Normalized exported and imported `tool_result` and `job_status` media payloads in `conversation-portability.ts` so audio, chart, graph, and compose-media metadata survive JSON export/import and replay surfaces with canonical `assetId`, `mimeType`, `source`, and `retentionClass` fields.
   - Synthesized canonical media `resultEnvelope` records for imported media job parts when older exports only carried `resultPayload`, keeping replay artifacts and later-turn reuse aligned with the live browser-runtime path.
   - Rebound referenced governed asset IDs to the imported conversation during `ConversationInteractor.importConversation(...)`, which makes imported media discoverable through `list_conversation_media_assets` instead of leaving discovery scoped only to the source thread.
   - Added round-trip tests proving exported/imported media history can still drive a valid `compose_media` plan and that imported conversations can rediscover chart and audio assets through the canonical listing surface before composition.
  - Added `list_conversation_media_assets` as a catalog-backed media capability that lists reusable governed assets from the active conversation using `UserFileRepository.listByConversation(...)`.
  - Added a shared projection helper so composition-friendly asset candidates are derived from the existing `user_files` media projection logic instead of a parallel classifier.
  - Wired the media bundle to inject both `jobQueueRepository` for `compose_media` and `userFileRepository` for media discovery.
  - Removed the dead `isCompatibilitySnapshot` helper while touching the remaining Phase 9 seam inventory.
  - Normalized browser-runtime audio payloads so governed audio metadata now persists through snapshot and result-envelope continuity with the same contract used for chart and graph assets.
  - Replaced the breadcrumb stub comment path with a real admin breadcrumb component and narrowed the RepositoryFactory legacy note to explicit shrink-only exceptions.
  - Recorded `generate_audio` as the next production-owned `remote_service` workload after `compose_media` in code and execution-target docs.
  - Added focused tests for the new discovery tool, projection helper, catalog size, bundle membership, and media-pack ownership.
- Deviations from the detailed plan:
  - Landed the model-callable tool path first and did not add a separate chat-safe route in this cut.
   - The remaining work is no longer payload continuity itself; it is broader verification reruns and any follow-on compose-media workflow hardening that shows up once discovery and portability are both canonical.

## Post-Implementation QA

- [x] Run the focused Phase 8 runtime bundle.
- [x] Run changed-file diagnostics.
- [x] Run a production build.
- [x] Prove that a prior generated chart, graph, or audio asset can be discovered from the active conversation and then used in a valid `compose_media` plan.
- [x] Add or refresh tests for any new asset-discovery route or tool surface.
- [ ] Re-read the Phase 8 packet, status board, roadmap, and execution-target subsystem note for synchronization drift.
- [x] Record any remaining unresolved runtime-adoption work after the first Phase 9 cut.

## Exit Criteria

- The residual dead compatibility helper and any equivalent no-op seams are removed.
- The admin breadcrumb stub is replaced or explicitly retired.
- The documented raw DB migration seam is either smaller, more specific, or partially closed in code.
- Generated chart, graph, and audio assets can be rediscovered from the active conversation without rerunning generation.
- `compose_media` can be planned from discovered governed assets rather than placeholder handles.
- The transcript and UI surfaces expose enough stable asset metadata that later turns can continue a media workflow honestly.
- The next production-owned `native_process` or `remote_service` workload after `compose_media` is explicitly named and documented.
- Phase 8 and Phase 9 docs describe the same truthful completion state.

## Handoff

- What the next implementation loop should now assume: Phase 8's main runtime and ownership cuts are real; charts, graphs, audio, and video already share the governed `user_files` substrate; canonical discovery now works both in live conversations and after import because referenced governed assets are rebound to the imported thread.
- What remains unresolved: the remaining work is mostly documentation synchronization drift and any raw DB route-handler cases that are too invasive to close in one loop, not media portability continuity itself.
- What docs need updating: [./status-board.md](./status-board.md#L1), [../refactor-roadmap.md](../refactor-roadmap.md#L1), [../subsystems/execution-targets.md](../subsystems/execution-targets.md#L1), and the Phase 8 packet should stay aligned with this packet.
