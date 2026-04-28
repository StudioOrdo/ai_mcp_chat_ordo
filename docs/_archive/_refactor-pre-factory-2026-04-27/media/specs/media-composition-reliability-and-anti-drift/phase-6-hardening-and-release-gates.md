# Phase 6: Hardening, Intensive E2E, And Release Gates

**Status:** Revised After Phase 0 Canonical State, Phase 1 Truth-Bound Presentation, Phase 2 Governed Readiness, Phase 3 Automatic Recovery, Phase 4 Execution-Target Clarity, And Phase 5 Observability And Portability Closure  
**Objective:** Turn the Phase 0 through 5 runtime contracts into a release-grade confidence bar without inventing a second test, portability, observability, or delivery architecture.

---

## 1. Why This Phase Exists

Phases 0 through 5 already closed the dangerous semantic drift in the runtime itself:

1. Phase 0 established canonical lifecycle, failure-stage, and terminal truth semantics.
2. Phase 1 forced cards, transcript summaries, and job surfaces to render canonical runtime truth rather than optimistic prose.
3. Phase 2 made governed asset identity, lineage, and readiness the hard preflight gate before composition.
4. Phase 3 made browser-local failure promote into the real deferred recovery path rather than stopping at advisory UI signaling.
5. Phase 4 clarified that route choice belongs to layered execution planning and dispatch, not to a second truth model.
6. Phase 5 made incidents reconstructable and made governed media continuity survive export, import, refresh, replay, and rediscovery.

That means Phase 6 does not get to invent new runtime meaning. It must prove that the Phase 0 through 5 contracts stay intact under real browser conditions, deferred execution, governed upload and retrieval, and release-gate verification.

If Phase 6 is complete, an operator should be able to say, without source archaeology:

1. which runtime route was exercised
2. whether the transcript and card surfaces stayed truthful during that route
3. whether governed assets remained usable after upload, replay, export, or import
4. whether fallback and deferred recovery remained durable and deduplicated
5. whether the release gate would block drift before it reached production

If those answers only exist as ad hoc test knowledge or tribal memory, Phase 6 is incomplete.

---

## 2. Verified Current Architecture

Phase 6 must describe the hardening and release seams that already exist in code.

### 2.1 Browser Runtime Hardening Already Uses The Canonical Media Contracts

The browser runtime already executes against the same canonical runtime model established in earlier phases.

Current relevant facts:

1. browser composition, preflight, fallback enqueue, persisted-state reconciliation, and playback verification already live in [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1)
2. browser snapshots already emit canonical `lifecyclePhase`, `failureCode`, `failureStage`, `failureClass`, and `recoveryMode` through [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)
3. playback verification now has a typed failure seam in [src/lib/media/browser-runtime/video-asset-readiness.ts](../../../../../src/lib/media/browser-runtime/video-asset-readiness.ts#L1)
4. browser composition routing already remains constrained by the canonical planning and profile logic in [src/lib/media/ffmpeg/media-execution-router.ts](../../../../../src/lib/media/ffmpeg/media-execution-router.ts#L1) and [src/lib/media/ffmpeg/media-composition-plan.ts](../../../../../src/lib/media/ffmpeg/media-composition-plan.ts#L1)

Phase 6 must therefore harden the existing browser path rather than describing a separate browser test runtime.

### 2.2 Governed Upload, Addressability, And Retrieval Already Form The Delivery Backbone

The repo already has a governed media delivery seam that Phase 6 must treat as authoritative.

Current relevant facts:

1. governed upload and quota-aware persistence already flow through [src/app/api/chat/uploads/route.ts](../../../../../src/app/api/chat/uploads/route.ts#L1)
2. governed file persistence and quota-safe batch semantics already live in [src/lib/user-files.ts](../../../../../src/lib/user-files.ts#L1) and [src/adapters/UserFileDataMapper.ts](../../../../../src/adapters/UserFileDataMapper.ts#L1)
3. governed file retrieval, HEAD metadata, range requests, and delete eligibility already live in [src/app/api/user-files/[id]/route.ts](../../../../../src/app/api/user-files/%5Bid%5D/route.ts#L1)
4. governed asset projection already stays canonical through [src/lib/media/media-asset-projection.ts](../../../../../src/lib/media/media-asset-projection.ts#L1)

This is the Phase 6 delivery seam. Hardening work must use it instead of adding media-test-only storage or alternate retrieval paths.

### 2.3 Browser E2E Harness Already Exists And Is Media-Aware

The repo already has a real browser verification harness rather than a placeholder E2E plan.

Current relevant facts:

1. the Playwright-managed production server already enables the media E2E harness and runtime-audit log directory in [playwright.config.ts](../../../../../playwright.config.ts#L1)
2. the browser-focused discovery entry point and command surface already live in [tests/browser-ui/README.md](../../../../../tests/browser-ui/README.md#L1)
3. browser runtime fallback, queued deferred replacement, and media-card behavior already have real-page proof in [tests/browser-ui/ffmpeg-browser-runtime.spec.ts](../../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts#L1)
4. live generated-media and upload workflows are already part of the declared browser suite in [tests/browser-ui/README.md](../../../../../tests/browser-ui/README.md#L1)

Phase 6 must therefore document the real browser harness already in the repo instead of prescribing a future one.

### 2.4 Deferred Recovery And Forensic Handoff Already Have Durable Evidence

Phase 5 closed the observability gap that Phase 6 now depends on.

Current relevant facts:

1. compose deferred enqueue now writes durable audit events in [src/lib/jobs/compose-media-deferred-job.ts](../../../../../src/lib/jobs/compose-media-deferred-job.ts#L1)
2. the shared enqueue route already returns canonical job snapshots in [src/app/api/chat/jobs/route.ts](../../../../../src/app/api/chat/jobs/route.ts#L1)
3. deferred worker execution and runtime-audit evidence already remain anchored in [src/lib/jobs/deferred-job-worker.ts](../../../../../src/lib/jobs/deferred-job-worker.ts#L1) and [src/lib/observability/runtime-audit-log.ts](../../../../../src/lib/observability/runtime-audit-log.ts#L1)

Phase 6 must not reframe release hardening as a separate logging effort. The hardening bar is built on the Phase 5 evidence seam that already exists.

### 2.5 Runtime Integrity And Release Evidence Already Exist As First-Class Gates

The repo already contains a release-facing integrity gate rather than only local test commands.

Current relevant facts:

1. the focused runtime-integrity bundle already runs through [scripts/run-runtime-integrity-qa.ts](../../../../../scripts/run-runtime-integrity-qa.ts#L1)
2. runtime-integrity evidence already writes release artifacts consumed by the release process
3. the repo memory baseline already records the accepted commands and artifacts: `npm run runtime:inventory`, `npm run qa:runtime-integrity`, and `npm run release:evidence`
4. the current release artifact contract already includes `release/runtime-inventory.json`, `release/runtime-integrity-evidence.json`, and `release/qa-evidence.json`

Phase 6 must therefore treat runtime-integrity evidence as an existing gate, not a future recommendation.

---

## 3. Phase 6 Scope

This phase governs one thing: converting the Phase 0 through 5 runtime contracts into a release-grade confidence bar.

Specifically, Phase 6 governs:

1. browser E2E proof for canonical browser, fallback, and deferred replacement behavior
2. governed upload and retrieval hardening for real media delivery and later composition reuse
3. parity between focused Vitest coverage, browser proof, and runtime-integrity gates
4. release evidence that blocks drift in route truthfulness, asset continuity, and runtime inventory assumptions

This phase does not redefine lifecycle meaning, presentation truth, readiness semantics, fallback lineage, route planning, or observability semantics. It depends on all of them.

---

## 4. Phase 6 Invariants

The following rules are mandatory.

1. Phase 0 remains authoritative for lifecycle phases, terminality, and failure-stage meaning.
2. Phase 1 remains authoritative for what transcript, card, and job surfaces may claim.
3. Phase 2 remains authoritative for governed asset identity, lineage, and readiness validation.
4. Phase 3 remains authoritative for browser-to-deferred recovery and dedupe-aware handoff.
5. Phase 4 remains authoritative for execution-target selection and route meaning.
6. Phase 5 remains authoritative for forensic evidence and portability continuity.
7. Phase 6 may not introduce a second release-gate vocabulary that bypasses canonical result envelopes, job snapshots, or runtime-integrity artifacts.
8. Phase 6 may not add test-only media delivery paths that bypass governed upload, retrieval, or projection seams.
9. Phase 6 may not treat browser proof, deferred proof, and release evidence as interchangeable; each has a distinct role and all must stay semantically aligned.
10. Any hardening or release check added in this phase must consume existing seams before it is allowed to introduce a new one.

---

## 5. Canonical Phase 6 Contract

### 5.1 Hardening Contract

Every supported media route must either succeed truthfully or fail truthfully under the same canonical runtime model used in production.

Required interpretation:

1. browser success, browser fallback, deferred execution, and governed delivery must all produce canonical runtime evidence
2. interruption, refresh, overflow, and replay paths must not create duplicate jobs or false terminal states
3. playback verification and upload/delivery failures must remain distinct from generic runtime exceptions

### 5.2 Browser Proof Contract

The browser harness must prove user-visible behavior, not just HTTP success.

Required interpretation:

1. real-page tests must validate browser compose behavior against rendered card and transcript state
2. fallback-to-deferred recovery must be visible as a canonical queued server job, not only as a network side effect
3. browser proof must keep using the governed user-file route and the real chat/job surfaces rather than private fixture-only abstractions

### 5.3 Governed Delivery Contract

Hardening must preserve the governed delivery backbone already used by the runtime.

Required behavior:

1. uploads must continue to enter through the governed upload route and quota-aware storage seam
2. runtime consumers must continue to use governed asset IDs and `/api/user-files/[id]` for retrieval and readiness checks
3. later composition, replay, export, and import must continue to consume projected governed assets rather than stale card-local copies

### 5.4 Runtime-Integrity Contract

Release gating must remain evidence-based.

Required behavior:

1. focused integrity suites must remain runnable through the runtime-integrity script
2. runtime-integrity evidence must be written as release artifacts, not ephemeral terminal-only output
3. failed integrity steps must be able to block release evidence generation or release readiness

### 5.5 Documentation-And-Gate Parity Contract

Phase 6 documentation must not drift from the actual verification surface.

Required interpretation:

1. docs must describe the browser harness, runtime-integrity commands, and governed delivery seams that actually exist
2. docs must not describe fallback as advisory now that recovery is automatic
3. docs must not describe portability or delivery as message-only behavior now that governed asset rebinding and rediscovery are part of the contract

---

## 6. Current Code Findings

### 6.1 What The Repo Already Proves

1. browser compose success, fallback enqueue, queued deferred replacement, and playback-verification failure classification are already covered in [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx#L1)
2. browser fallback-to-deferred recovery is already proven in a real page in [tests/browser-ui/ffmpeg-browser-runtime.spec.ts](../../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts#L1)
3. governed upload, quota handling, and derived-asset persistence are already covered in [src/app/api/chat/uploads/route.test.ts](../../../../../src/app/api/chat/uploads/route.test.ts#L1)
4. governed retrieval, HEAD metadata, range behavior, and delete eligibility are already covered in [src/app/api/user-files/[id]/route.test.ts](../../../../../src/app/api/user-files/%5Bid%5D/route.test.ts#L1)
5. portability round-trip, imported asset rebinding, and later rediscovery are already covered in [tests/chat/conversation-portability.test.ts](../../../../../tests/chat/conversation-portability.test.ts#L1), [src/core/use-cases/ConversationInteractor.test.ts](../../../../../src/core/use-cases/ConversationInteractor.test.ts#L1), and [src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts](../../../../../src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts#L1)
6. runtime-integrity already has a first-class script and release artifact contract instead of being an informal command sequence

### 6.2 What Phase 6 Must Keep Tight

1. docs must not imply that Phase 6 still needs a brand-new browser harness; the harness already exists and must stay aligned with runtime truth
2. docs must not imply that governed delivery is only about final artifact serving; upload, HEAD metadata, range support, and quota enforcement are part of the hardening seam
3. docs must not imply that release gates are just a build plus a few tests; runtime-integrity artifacts are part of the accepted release evidence contract
4. docs must not prescribe temporary migration cleanup that is no longer identifiable as active code in this slice without grounding it in specific files

Phase 6 is therefore a hardening-and-governance phase built on the already-landed runtime seams, not a speculative cleanup phase.

---

## 7. Required Deliverables

### 7.1 Browser And Deferred Confidence Alignment

The following seams must agree in meaning:

1. browser job snapshots and card rendering
2. deferred enqueue route snapshots and durable audit entries
3. real-page fallback proof in the browser harness
4. governed asset retrieval used by readiness and playback verification

### 7.2 Governed Delivery Alignment

The following seams must agree in meaning:

1. upload route validation and quota handling
2. user-file persistence and projection defaults
3. HEAD and range retrieval semantics
4. portability, rebinding, and later rediscovery before recomposition

### 7.3 Release Evidence Alignment

The following seams must agree in meaning:

1. focused Vitest confidence bundles
2. Playwright browser proof
3. runtime-integrity script outputs
4. release evidence artifacts and blocking rules

### 7.4 Doc Wording That Respects Earlier Phases

Phase 6 docs must state explicitly that:

1. hardening does not redefine lifecycle semantics from Phase 0
2. browser and card proof do not bypass truth-bound presentation from Phase 1
3. delivery hardening does not bypass governed readiness and lineage from Phase 2
4. E2E fallback proof does not replace the real recovery model from Phase 3
5. release-gate parity does not override the execution-target rules from Phase 4
6. release hardening builds on the observability and portability seams from Phase 5 rather than replacing them

---

## 8. Candidate File Changes

Update when Phase 6 behavior or release confidence meaning changes:

- [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1)
- [src/app/api/chat/jobs/route.ts](../../../../../src/app/api/chat/jobs/route.ts#L1)
- [src/lib/jobs/compose-media-deferred-job.ts](../../../../../src/lib/jobs/compose-media-deferred-job.ts#L1)
- [src/app/api/chat/uploads/route.ts](../../../../../src/app/api/chat/uploads/route.ts#L1)
- [src/app/api/user-files/[id]/route.ts](../../../../../src/app/api/user-files/%5Bid%5D/route.ts#L1)
- [src/lib/user-files.ts](../../../../../src/lib/user-files.ts#L1)
- [src/lib/media/media-asset-projection.ts](../../../../../src/lib/media/media-asset-projection.ts#L1)
- [tests/browser-ui/ffmpeg-browser-runtime.spec.ts](../../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts#L1)
- [tests/browser-ui/README.md](../../../../../tests/browser-ui/README.md#L1)
- [playwright.config.ts](../../../../../playwright.config.ts#L1)
- [scripts/run-runtime-integrity-qa.ts](../../../../../scripts/run-runtime-integrity-qa.ts#L1)
- [release/runtime-integrity-evidence.json](../../../../../release/runtime-integrity-evidence.json)
- [release/qa-evidence.json](../../../../../release/qa-evidence.json)
- [docs/_refactor/system-state-2026-04-12/runtime-e2e-inventory-and-logging.md](../../system-state-2026-04-12/runtime-e2e-inventory-and-logging.md#L1)

---

## 9. Positive Tests

1. browser compose success, browser fallback, deferred queued replacement, and playback verification remain truthful and canonical
2. governed upload and user-file retrieval preserve the same asset identity used by runtime composition and portability
3. import, rebinding, rediscovery, and later composition remain compatible under current runtime contracts
4. runtime-integrity and release evidence continue to pass when the runtime contracts remain aligned

## 10. Negative Tests

1. missing deferred enqueue audit evidence fails focused Phase 6 confidence
2. playback readiness timeouts that collapse back into generic runtime exceptions fail focused browser-runtime confidence
3. governed delivery regressions in upload, HEAD metadata, or range retrieval fail hardening coverage because they break Phase 2 and Phase 5 assumptions
4. stale docs or release claims that describe unsupported runtime behavior must be treated as drift

## 11. Edge Tests

1. refresh, reconciliation, and overflow must keep recovery deduplicated and truthful
2. derived chart and graph assets must stay governed and composable after browser materialization
3. imported governed assets must remain rediscoverable before later composition reuse
4. worker-disabled browser proof must still surface canonical deferred replacement behavior under fallback conditions

---

## 12. Exit Criteria

1. focused Vitest hardening suites pass across browser, deferred, portability, and governed delivery seams
2. browser E2E proof passes for canonical fallback-to-deferred replacement behavior
3. runtime-integrity evidence stays green and remains consumable by release evidence
4. docs describe the actual verification and delivery seams already present in the repo
5. the release bar now protects the exact runtime-truth, governed-delivery, and fallback-evidence contracts that Phases 0 through 5 established
