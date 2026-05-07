# Phase 6 — Portability And Delivery Baseline

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Freeze the governed delivery and cross-runtime artifact contract so browser, worker, and deferred media execution all resolve to the same portable asset shape.
> Prerequisites: Phase 5 complete

## Phase Intent

This phase exists to make media artifacts portable across execution routes without fragmenting delivery. Once uploads, accounting, and quota enforcement are in place, the next baseline is delivery continuity: browser-side composition, remote worker composition, and deferred job orchestration should all converge on governed `assetId` references and the existing `/api/user-files/[id]` route rather than inventing per-runtime preview stacks.

## Source Anchors To Refresh

- [../../../../src/app/api/user-files/[id]/route.ts](../../../../src/app/api/user-files/[id]/route.ts#L1)
- [../../../../src/app/api/user-files/[id]/route.test.ts](../../../../src/app/api/user-files/[id]/route.test.ts#L1)
- [../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts](../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts#L1)
- [../../../../src/lib/media/server/compose-media-worker-runtime.ts](../../../../src/lib/media/server/compose-media-worker-runtime.ts#L1)
- [../../../../src/lib/media/server/media-worker-http.ts](../../../../src/lib/media/server/media-worker-http.ts#L1)
- [../../../../src/lib/media/server/media-worker-client.ts](../../../../src/lib/media/server/media-worker-client.ts#L1)
- [../../../../src/lib/media/ffmpeg/media-execution-router.ts](../../../../src/lib/media/ffmpeg/media-execution-router.ts#L1)
- [../../../../src/lib/jobs/compose-media-deferred-job.ts](../../../../src/lib/jobs/compose-media-deferred-job.ts#L1)

## Current-State Questions

- Does every media execution route still converge on governed `assetId` plus `/api/user-files/[id]` delivery?
- Are browser and worker transport contracts explicit enough to keep artifact rendering portable across routes and deferred jobs?
- Which runtime paths still persist generated media directly instead of going through the upload-route quota seam?

## Drift Traps

- Adding a second preview or download route for worker or browser artifacts instead of reusing `/api/user-files/[id]`.
- Letting execution-route differences leak into the artifact contract returned to the UI.
- Treating “delivery continuity” as complete while generated media still bypasses the upload-route quota seam in some server-side paths.
- Documenting portability as though full browser E2E proof exists when the current evidence is focused route, worker, and deferred-job coverage.

## Pre-Implementation QA Gate

- [x] Refresh current diagnostics for the delivery and portability anchors.
- [x] Refresh current tests for governed delivery, worker transport, execution routing, and deferred compose-media enqueueing.
- [x] Confirm the listed source anchors still represent the canonical delivery baseline.
- [x] Record exact verification commands for this phase.
- [x] Update this packet's verified-state notes from current code before finalizing status.

## Verified Current State

This section reflects the live delivery baseline as verified on 2026-04-15.

### Current Code Notes

- [../../../../src/app/api/user-files/[id]/route.ts](../../../../src/app/api/user-files/[id]/route.ts#L1) remains the single governed delivery path for stored media. It enforces owner access, supports byte-range playback, returns private immutable caching headers, and keeps delete behavior unattached-only.
- [../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts](../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts#L1) resolves visual and audio inputs through `/api/user-files/{assetId}` and uploads composed browser artifacts back through `/api/chat/uploads`, so browser-generated output rejoins the governed user-file substrate with a stable `assetId`.
- [../../../../src/lib/media/server/media-worker-http.ts](../../../../src/lib/media/server/media-worker-http.ts#L1) and [../../../../src/lib/media/server/media-worker-client.ts](../../../../src/lib/media/server/media-worker-client.ts#L1) define an explicit NDJSON transport for remote composition: progress events stream first, then a final result envelope or error event.
- [../../../../src/lib/media/server/compose-media-worker-runtime.ts](../../../../src/lib/media/server/compose-media-worker-runtime.ts#L1) persists worker output back into `UserFileSystem` and returns artifacts pointing to `/api/user-files/{assetId}`. This keeps the delivery path unified, but it does not currently consume the `/api/chat/uploads` quota-enforcement seam.
- [../../../../src/lib/media/ffmpeg/media-execution-router.ts](../../../../src/lib/media/ffmpeg/media-execution-router.ts#L1) chooses `browser_wasm` versus `deferred_server` strictly from capability and profile limits, not from a separate delivery contract.
- [../../../../src/lib/jobs/compose-media-deferred-job.ts](../../../../src/lib/jobs/compose-media-deferred-job.ts#L1) validates plan shape and constraints up front, then deduplicates queued compose-media work by `plan.id` so deferred portability starts from a stable plan identity.
- [../../../../src/app/e2e/media-lab/MediaE2ELab.tsx](../../../../src/app/e2e/media-lab/MediaE2ELab.tsx#L1) exposes a browser harness and artifact manifest for the portable asset contract, but this phase’s verified evidence is still focused unit and integration coverage rather than packet-level browser automation proof.

### Current QA Notes

- 2026-04-15 focused Phase 6 verification is green:
  - `npm exec vitest run 'src/app/api/user-files/[id]/route.test.ts' src/lib/media/server/media-worker-http.test.ts src/lib/media/server/media-worker-client.test.ts src/lib/media/ffmpeg/media-execution-router.test.ts src/lib/jobs/compose-media-deferred-job.test.ts`
  - Result: 5 files passed, 26 tests passed.
- Changed-file lint is green:
  - `npm exec eslint 'src/app/api/user-files/[id]/route.ts' 'src/app/api/user-files/[id]/route.test.ts' src/lib/media/browser-runtime/ffmpeg-browser-executor.ts src/lib/media/server/compose-media-worker-runtime.ts src/lib/media/server/media-worker-http.ts src/lib/media/server/media-worker-http.test.ts src/lib/media/server/media-worker-client.ts src/lib/media/server/media-worker-client.test.ts src/lib/media/ffmpeg/media-execution-router.ts src/lib/media/ffmpeg/media-execution-router.test.ts src/lib/jobs/compose-media-deferred-job.ts src/lib/jobs/compose-media-deferred-job.test.ts`
  - Result: no output.
- Editor diagnostics are clean on the delivery anchors listed above.

## Suggested Verification Commands

```bash
npm exec vitest run 'src/app/api/user-files/[id]/route.test.ts' src/lib/media/server/media-worker-http.test.ts src/lib/media/server/media-worker-client.test.ts src/lib/media/ffmpeg/media-execution-router.test.ts src/lib/jobs/compose-media-deferred-job.test.ts
npm exec eslint 'src/app/api/user-files/[id]/route.ts' 'src/app/api/user-files/[id]/route.test.ts' src/lib/media/browser-runtime/ffmpeg-browser-executor.ts src/lib/media/server/compose-media-worker-runtime.ts src/lib/media/server/media-worker-http.ts src/lib/media/server/media-worker-http.test.ts src/lib/media/server/media-worker-client.ts src/lib/media/server/media-worker-client.test.ts src/lib/media/ffmpeg/media-execution-router.ts src/lib/media/ffmpeg/media-execution-router.test.ts src/lib/jobs/compose-media-deferred-job.ts src/lib/jobs/compose-media-deferred-job.test.ts
```

## Expected Evidence Artifacts

- Route tests proving governed owner-only delivery, byte-range playback, and conservative delete behavior.
- Worker transport tests proving streamed progress and final-envelope continuity.
- Execution-router tests proving delivery-path neutrality across browser and deferred routes.
- Deferred compose-media job tests proving stable plan validation and dedupe behavior.

## Detailed Implementation Plan

1. Keep `/api/user-files/[id]` as the only governed preview and delivery path for persisted media artifacts.

1. Ensure each execution route returns portable `assetId`-backed artifacts instead of route-specific preview URLs or transport-specific payload shapes.

1. Keep browser and remote worker transport contracts explicit and test-backed so progress, result envelopes, and failure events remain stable.

1. Record any remaining policy asymmetry separately instead of hiding it inside “delivery complete” language.

## Scope Guardrails

- Do not add a second media-serving route for worker, browser, or deferred artifacts.
- Do not treat quota-policy unification for server-generated media as solved by this phase unless those paths actually consume the same enforcement seam.

## Implementation Record

- Date: 2026-04-15
- Files changed:
  - `src/app/api/user-files/[id]/route.ts`
  - `src/app/api/user-files/[id]/route.test.ts`
  - `src/lib/media/browser-runtime/ffmpeg-browser-executor.ts`
  - `src/lib/media/server/compose-media-worker-runtime.ts`
  - `src/lib/media/server/media-worker-http.ts`
  - `src/lib/media/server/media-worker-client.ts`
  - `src/lib/media/ffmpeg/media-execution-router.ts`
  - `src/lib/jobs/compose-media-deferred-job.ts`
- Summary of what landed:
  - Governed asset delivery stayed centralized on `/api/user-files/[id]`.
  - Browser and worker composition routes now converge on portable `assetId`-backed artifacts instead of route-specific delivery stacks.
  - Remote worker transport is explicit and stream-oriented via NDJSON progress and result events.
  - Deferred compose-media enqueueing validates and deduplicates plan identity before background execution.
- Deviations from the detailed plan:
  - Server-side generated media paths still persist directly through `UserFileSystem.storeBinary`, so quota enforcement remains asymmetric relative to `/api/chat/uploads`.

## Post-Implementation QA

- [x] Run targeted tests.
- [x] Run changed-file diagnostics.
- [x] Re-read the source anchors and confirm the intended delivery seam stayed governed and portable.
- [x] Record residual risks and follow-on work.

## Exit Criteria

- Persisted media artifacts resolve through one governed delivery path.
- Browser and deferred worker execution both return portable `assetId`-backed artifact references.
- Worker transport, route delivery, and deferred job enqueueing are explicitly tested.
- Remaining policy asymmetries are documented instead of hidden.

## Handoff

- What the next phase should now assume:
  - `/api/user-files/[id]` is the canonical delivery path for stored media across user, operator, browser-runtime, and remote-worker surfaces.
  - Compose-media browser and deferred routes already converge on stable `assetId` plus `/api/user-files/{assetId}` artifacts.
  - The focused governed-delivery, worker-transport, routing, and deferred-job bundle is green as of 2026-04-15.
- What remains unresolved:
  - Worker-generated and some other server-generated media still persist directly through `UserFileSystem.storeBinary`, so generated-media quota enforcement is not yet unified with `/api/chat/uploads`.
  - Packet-level browser automation proof for end-to-end delivery continuity has not been added yet; the current evidence is route and integration coverage plus the media-lab harness.
- What docs need updating:
  - [./status-board.md](./status-board.md#L1) and [../implementation-roadmap.md](../implementation-roadmap.md#L1) now need to include this phase explicitly.
  - [../../../_refactor/media/specs/media-platform-phased-implementation-plan.md](../../../_refactor/media/specs/media-platform-phased-implementation-plan.md#L454) should capture the governed-delivery baseline and the remaining generated-media quota asymmetry.
