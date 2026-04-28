# Phase 3: Automatic Fallback And Recovery

**Status:** Implemented And Focused-Test Verified After Phase 0 Canonicalization, Phase 1 Truth-Bound Presentation, And Phase 2 Readiness Wiring  
**Objective:** Keep browser fallback, startup reconciliation, and local overflow on the canonical `compose_media` recovery path so every non-local continuation either creates or reuses a real deferred job or ends in an explicit `deferred_enqueue` failure.

---

## 1. Why This Phase Exists

Phase 0 already gave the media stack one canonical lifecycle and failure-stage vocabulary. Phase 1 made presentation consume that truth instead of inventing its own. Phase 2 made composition wait for governed, policy-valid, lineage-correct assets before execution can start.

Those phases solved truth drift before execution and during presentation. They did not yet close the operational gap after browser execution fails or is interrupted.

Today, the codebase can already do all of the following:

1. detect browser-local compose failure or fallback requirement
2. normalize that state into truthful `compose_fallback_required` and related failure metadata
3. enqueue a real deferred `compose_media` job through `/api/chat/jobs`
4. publish canonical deferred job snapshots and rehydrate them into the conversation

That bridge is now in place.

When browser FFmpeg returns `fallback_required`, when startup reconciliation recovers stale persisted `compose_media` work, or when browser-local admission overflows, the browser runtime now routes through the shared `/api/chat/jobs` surface, receives a canonical deferred job snapshot back, and rewrites the synthetic browser result into that real deferred state. If queue creation fails, the runtime publishes an explicit `failureStage: "deferred_enqueue"` failure instead of leaving a stranded reroute snapshot.

Phase 3 therefore closes the last orchestration gap between truthful browser fallback signaling and real deferred recovery behavior.

---

## 2. Verified Current Architecture

Phase 3 must compose the runtime seams that already exist in code today.

### 2.1 Phase 0 Lifecycle And Failure Authorities Already Exist

The repo already has the canonical state vocabulary Phase 3 must use:

1. lifecycle phases and failure stages are typed in [src/core/entities/media-runtime-state.ts](../../../../../src/core/entities/media-runtime-state.ts#L1)
2. browser, deferred, and persisted browser-runtime state normalize through [src/lib/media/browser-runtime/media-runtime-normalization.ts](../../../../../src/lib/media/browser-runtime/media-runtime-normalization.ts#L1)
3. browser-originated transcript snapshots are constructed in [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)
4. deferred job publication projects the same lifecycle model in [src/lib/jobs/job-status.ts](../../../../../src/lib/jobs/job-status.ts#L1)

Phase 3 must advance recovery through those same authorities. It is non-compliant to add a second fallback-state model or a separate recovery-only transcript shape.

### 2.2 Phase 1 Already Makes The Distinction Phase 3 Depends On

Phase 1 explicitly distinguished `compose_fallback_required` from `compose_queued_deferred` and `compose_running_deferred`.

That distinction is already supported by the runtime model:

1. `fallback_required` normalizes to `compose_fallback_required`
2. deferred job snapshots normalize to `compose_queued_deferred` or `compose_running_deferred`
3. presentation can already render those states differently once the underlying state changes

This matters because Phase 3 is not allowed to skip that distinction. A reroute-needed snapshot is not proof that the server job exists.

### 2.3 Phase 2 Already Gates Recovery Inputs

Phase 2 now guarantees that both browser and deferred compose paths consume the same governed-asset readiness contract before execution:

1. browser-side compose staging now materializes chart and graph clips and checks governed asset readiness in [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1)
2. worker-side compose execution now evaluates the same readiness contract in [src/lib/media/server/compose-media-worker-runtime.ts](../../../../../src/lib/media/server/compose-media-worker-runtime.ts#L1)
3. deferred enqueue still normalizes and structurally validates the plan in [src/lib/jobs/compose-media-deferred-job.ts](../../../../../src/lib/jobs/compose-media-deferred-job.ts#L1)

Phase 3 should build on that. Recovery must reuse the same canonical plan and readiness assumptions, not bypass them with a looser reroute payload.

### 2.4 Browser Runtime Admission And Startup Reconciliation Already Exist

The browser runtime already has real recovery-related primitives:

1. persisted browser runtime entries are stored in session storage through [src/lib/media/browser-runtime/browser-runtime-state.ts](../../../../../src/lib/media/browser-runtime/browser-runtime-state.ts#L1)
2. startup reconciliation and capacity planning are computed in [src/lib/media/browser-runtime/browser-capability-runtime.ts](../../../../../src/lib/media/browser-runtime/browser-capability-runtime.ts#L1)
3. `useBrowserCapabilityRuntime()` already marks interrupted persisted compose work as `fallback_required` when the capability descriptor requires server recovery
4. overflow and interruption decisions already use catalog-derived browser capability metadata through [src/lib/media/browser-runtime/browser-capability-registry.ts](../../../../../src/lib/media/browser-runtime/browser-capability-registry.ts#L1)

So the repo already knows when work should reroute. The gap is that this decision currently terminates in a browser snapshot instead of continuing into a real enqueue.

### 2.5 Deferred Enqueue And Dedupe Already Exist

The shared deferred path for `compose_media` is already present and test-backed:

1. [src/app/api/chat/jobs/route.ts](../../../../../src/app/api/chat/jobs/route.ts#L77) accepts `compose_media` enqueue requests
2. [src/lib/jobs/compose-media-deferred-job.ts](../../../../../src/lib/jobs/compose-media-deferred-job.ts#L1) normalizes the plan, validates constraints, and deduplicates with `compose_media:${plan.id}`
3. [src/lib/jobs/compose-media-deferred-job.test.ts](../../../../../src/lib/jobs/compose-media-deferred-job.test.ts#L1) already proves queued and deduplicated deferred payload behavior

That means Phase 3 does not need a new queue, route, or dedupe mechanism.

### 2.6 Deferred Job Rehydration Already Exists

The conversation surface already knows how to consume deferred job state once a real job exists:

1. [src/hooks/chat/useChatJobEvents.ts](../../../../../src/hooks/chat/useChatJobEvents.ts#L1) rehydrates current job snapshots from `/api/chat/jobs` and listens for job events
2. [src/lib/jobs/job-status.ts](../../../../../src/lib/jobs/job-status.ts#L1) projects deferred job state into transcript-safe `job_status` parts
3. [src/frameworks/ui/useChatSurfaceState.tsx](../../../../../src/frameworks/ui/useChatSurfaceState.tsx#L1) treats real job IDs differently from synthetic browser job IDs

Phase 3 therefore only needs to get the deferred job created and linked coherently. The rendering and rehydration path already exists.

---

## 3. Phase 3 Scope

This phase governs browser-to-deferred recovery for `compose_media` after local execution cannot safely continue:

1. automatic deferred enqueue when browser compose reports `fallback_required`
2. startup reconciliation for persisted browser compose work after refresh or interruption
3. idempotent reroute behavior using the existing compose-media dedupe key
4. transcript and progress continuity between synthetic browser status and real deferred job status
5. truthful explicit failure when deferred recovery cannot be created

This phase does not replace the deferred worker, the browser FFmpeg executor, or the Phase 2 preflight contract. It wires them together into one operational recovery path.

---

## 4. Phase 3 Invariants

The following rules are mandatory.

1. `compose_fallback_required` is a recovery-needed state, not proof that deferred execution was enqueued.
2. The only compliant server recovery path is the existing `/api/chat/jobs` plus `compose-media-deferred-job` flow.
3. Deferred recovery must reuse the same canonical `MediaCompositionPlan` identity so `compose_media:${plan.id}` remains the dedupe key.
4. Persisted browser runtime entries remain minimal recovery metadata; they are not a second source of artifact truth.
5. Browser recovery may resume local work only when the runtime can prove that local continuation is still valid; otherwise it must enqueue deferred recovery or fail explicitly.
6. Recovery must preserve canonical failure-stage truth. A local fallback signal, a deferred enqueue failure, and a deferred execution failure are distinct states.
7. Browser and deferred snapshots must reconcile into one logical composition story rather than creating ghost progress or duplicate active jobs.
8. Phase 3 must reuse Phase 2 asset-readiness and plan-validation contracts. Recovery may not weaken preflight correctness.

---

## 5. Canonical Recovery Contract

Phase 3 should define one recovery contract layered on top of the existing lifecycle model.

### 5.1 Recovery Triggers

Recovery is relevant only after preflight succeeded or after prior local execution metadata proves work had begun.

At minimum, the browser runtime must treat these conditions as recovery triggers for `compose_media`:

1. browser FFmpeg returns `fallback_required`
2. startup reconciliation finds a persisted queued or running `compose_media` entry that no longer has a live local executor
3. local admission-control overflow routes a new `compose_media` run away from the browser because no local capacity is available

### 5.2 Recovery Decisions

For each triggered recovery, the runtime must decide one of the following:

1. resume locally, if the browser runtime can prove the work is still valid and resumable
2. enqueue deferred recovery, if policy allows server fallback and the canonical plan is available
3. fail explicitly, if neither safe resume nor deferred enqueue can be completed

These are conceptual recovery decisions, not permission to invent new status strings outside the Phase 0 model.

### 5.3 Required State Transitions

The user-visible state transitions must remain truthful and ordered:

1. browser-local failure or interruption may first surface as `compose_fallback_required`
2. only a successful deferred enqueue may advance the lifecycle to `compose_queued_deferred`
3. deferred worker start may advance the lifecycle to `compose_running_deferred`
4. deferred worker completion may advance the lifecycle to `compose_succeeded`
5. deferred enqueue failure must remain an explicit failure with `failureStage: "deferred_enqueue"`
6. deferred worker failure must remain an explicit failure with `failureStage: "deferred_execution"`

### 5.4 Required Recovery Evidence

Each recovery path must leave enough evidence for transcript replay and operational debugging.

Required evidence:

1. the local recovery trigger or interruption reason
2. whether deferred enqueue was attempted
3. whether enqueue succeeded, deduplicated, or failed
4. the resulting real deferred job ID when one exists
5. enough linkage to prevent the browser-local job and deferred job from appearing as unrelated work

---

## 6. Current Code Findings And Implemented Closures

This section records what the repo now satisfies for Phase 3 and the concrete closures added during implementation.

### 6.1 Already Satisfied Or Mostly Satisfied

1. the canonical lifecycle and failure-stage model already contains the states Phase 3 needs, including `compose_fallback_required`, deferred lifecycle phases, and `deferred_enqueue`
2. browser runtime reconciliation already closes out stale persisted work into explicit `fallback_required`, `failed`, or `interrupted` states instead of silently leaving ghost activity
3. the shared `/api/chat/jobs` route already supports real `compose_media` deferred enqueue
4. `compose-media-deferred-job` already enforces canonical plan normalization, structural validation, and idempotent dedupe via `compose_media:${plan.id}`
5. deferred worker execution already returns canonical artifact envelopes and job publication surfaces them through transcript-safe job snapshots
6. the chat surface already rehydrates and streams real deferred job state once a server job exists
7. browser capability descriptors already declare which browser capabilities fall back to the server, so reroute policy is not hidden in ad hoc hook code

### 6.2 Phase 3 Closures Now In Place

1. `useBrowserCapabilityRuntime()` now POSTs to `/api/chat/jobs` when browser FFmpeg returns `fallback_required` for `compose_media`, then rewrites the synthetic browser result with the canonical deferred job snapshot returned by the route.
2. startup reconciliation and browser-local overflow now reuse that same enqueue helper, so stale persisted compose work and overflowed compose work no longer stop at advisory reroute signaling.
3. the shared enqueue route now returns a canonical `job_status` snapshot directly, which gives the browser runtime an explicit handoff from the synthetic browser attempt to the real deferred job.
4. browser recovery publishes `failureStage: "deferred_enqueue"` and `failureCode: "deferred_enqueue_failed"` when queue creation fails.
5. browser candidate extraction now ignores tool results that have already been rewritten into non-browser deferred snapshots, preventing ghost local reruns.
6. focused tests now prove browser fallback enqueue, enqueue failure, startup reconciliation enqueue, overflow enqueue, and synthetic-to-deferred progress-strip continuity.
7. the browser Playwright suite now proves the real browser-triggered enqueue path by forcing a capability-probe fallback, asserting the `/api/chat/jobs` POST payload, and waiting for the UI to render the deferred queued state.

Within the focused Phase 3 scope, no known browser-to-deferred recovery gap remains.

---

## 7. Required Deliverables

### 7.1 Browser-Initiated Deferred Enqueue

When `compose_media` browser execution returns `fallback_required`, the browser runtime must attempt the shared deferred enqueue route.

Required behavior:

1. POST to `/api/chat/jobs` with `toolName: "compose_media"`, the canonical `conversationId`, and the same canonical plan the browser just staged
2. treat `200` with `deduplicated: true` and `201` with a new job as successful recovery outcomes
3. when enqueue succeeds, stop treating the browser snapshot as terminal local failure and allow canonical deferred state to take over
4. when enqueue fails, publish an explicit failure with `failureStage: "deferred_enqueue"`

### 7.2 Startup Recovery Manager

Persisted queued or running `compose_media` entries recovered after reload must no longer end at advisory reroute snapshots alone.

Required behavior:

1. determine whether the local run can actually resume
2. if it cannot resume and the capability policy allows fallback, attempt the shared deferred enqueue route
3. avoid duplicate recovery work by relying on the existing dedupe key and by not enqueueing if a real deferred job already exists for the same plan
4. clean up persisted browser entries only after the recovery decision is durable

### 7.3 Transcript And Progress Continuity

The handoff from synthetic browser job state to real deferred job state must remain coherent.

Required behavior:

1. no duplicate active progress entries should remain after the server job becomes authoritative
2. the user must be able to see that work moved from local execution to server execution without mistaking reroute-needed state for queued-server state
3. where practical, recovery snapshots should preserve explicit linkage between the original browser attempt and the deferred job that superseded it

### 7.4 Focused Recovery Coverage

Phase 3 is not complete until the repo has focused tests that cover the full browser-to-deferred handoff contract.

Required coverage:

1. browser FFmpeg fallback triggers exactly one `/api/chat/jobs` enqueue attempt
2. successful enqueue results in deferred queued or running state rather than a stranded `compose_fallback_required` terminal snapshot
3. deduplicated enqueue returns the existing job cleanly without duplicate progress surfaces
4. enqueue failure surfaces `failureStage: "deferred_enqueue"`
5. persisted interrupted compose work rehydrates into resume, deferred recovery, or explicit terminal failure deterministically

---

## 8. Candidate File Changes

Update:

- [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1)
- [src/lib/media/browser-runtime/browser-capability-runtime.ts](../../../../../src/lib/media/browser-runtime/browser-capability-runtime.ts#L1)
- [src/lib/media/browser-runtime/browser-runtime-state.ts](../../../../../src/lib/media/browser-runtime/browser-runtime-state.ts#L1)
- [src/app/api/chat/jobs/route.ts](../../../../../src/app/api/chat/jobs/route.ts#L77)
- [src/lib/jobs/compose-media-deferred-job.ts](../../../../../src/lib/jobs/compose-media-deferred-job.ts#L1)
- [src/hooks/chat/useChatJobEvents.ts](../../../../../src/hooks/chat/useChatJobEvents.ts#L1)
- [src/lib/jobs/job-status.ts](../../../../../src/lib/jobs/job-status.ts#L1)

Add, if needed:

- `src/lib/media/browser-runtime/compose-media-recovery.ts`
- `src/lib/media/browser-runtime/compose-media-recovery.test.ts`

---

## 9. Positive Tests

1. Browser `compose_media` fallback enqueues exactly one deferred job through `/api/chat/jobs`.
2. A deduplicated deferred enqueue reuses the active job for the same `compose_media:${plan.id}` key.
3. Successful browser-triggered recovery produces deferred queued or running transcript state that later resolves to canonical deferred success.
4. Reloaded persisted compose work either resumes locally or reroutes deterministically according to capability policy.
5. Deferred recovery still executes the same canonical plan that passed Phase 2 readiness and preflight validation.

## 10. Negative Tests

1. Reroute signaling without a real enqueue remains a failure, not a successful recovery.
2. Enqueue failure publishes `failureStage: "deferred_enqueue"` instead of generic local failure wording.
3. Duplicate fallback triggers do not create duplicate deferred jobs.
4. Recovery may not bypass conversation authorization, plan validation, or governed asset readiness.
5. Synthetic browser job state may not continue to present as the active authority once a real deferred job supersedes it.

## 11. Edge Tests

1. Browser tab refresh during local compose recovers deterministically from the persisted entry.
2. Browser interruption after local staging but before upload results in enqueue, explicit recovery failure, or explicit terminal failure with no silent abandonment.
3. Queue route temporary failure leaves explicit recovery evidence instead of a stranded fallback snapshot.
4. A browser reroute that hits an already-running deferred job deduplicates cleanly and preserves continuity.
5. Conversation refresh or focus reconciliation does not duplicate the same recovered deferred job in the progress strip.

---

## 12. Exit Criteria

1. Browser fallback is a real operational path that creates or reuses a deferred job, not only a truthful advisory snapshot.
2. Refresh and interruption recovery either resume or defer deterministically.
3. Deferred enqueue is idempotent and proven by focused tests.
4. `compose_fallback_required`, `compose_queued_deferred`, and `compose_running_deferred` remain distinct canonical states throughout recovery.
5. No known Phase 3 recovery gap remains between browser reroute detection and real deferred execution.
