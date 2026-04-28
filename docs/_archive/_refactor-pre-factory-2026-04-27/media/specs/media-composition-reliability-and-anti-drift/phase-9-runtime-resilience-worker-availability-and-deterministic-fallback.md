# Phase 9: Runtime Resilience, Worker Availability, And Deterministic Fallback

**Status:** Planned Expansion After Phase 7 Identity Closure And Phase 8 Storage-Backed Recovery  
**Objective:** Remove opaque transport fragility from media execution by making worker availability explicit, health-checked, and degradable, so reroute failure does not collapse into `fetch failed` when a safer execution path still exists.

---

## 1. Why This Phase Exists

The April 17 incident showed that the current deferred compose path can still fail before composition even starts because the media worker transport is unavailable.

In the current architecture:

1. deferred reroute is treated as a valid recovery path
2. the media worker client defaults to a localhost endpoint
3. worker availability is not a first-class runtime contract in the same way asset readiness is

That means the system can correctly decide to reroute and still fail immediately on an opaque transport boundary.

Phase 9 exists to make execution-target availability a governed contract instead of a hidden assumption.

---

## 2. Verified Gap After Phase 8

### 2.1 Media Worker Client Still Assumes An Endpoint

The client in [src/lib/media/server/media-worker-client.ts](../../../../../src/lib/media/server/media-worker-client.ts#L1) currently resolves a default base URL and attempts transport directly.

That is acceptable only if availability is proven or if the runtime has a deterministic alternate path.

### 2.2 Worker Failure Is Still Underclassified

The incident logs collapsed the reroute failure to `fetch failed`, which is transport-level evidence but not product-grade execution truth.

Phase 9 must classify:

1. worker unavailable
2. worker unhealthy
3. worker unauthorized
4. worker timed out
5. worker returned runtime failure

as distinct operational states.

---

## 3. Phase 9 Scope

This phase governs resilience at execution-target boundaries for media composition:

1. worker discovery and health
2. deterministic route downgrade when a preferred worker route is unavailable
3. startup diagnostics and operator visibility
4. transport-specific failure classification
5. parity between route planning and real target availability

This phase does not replace Phase 4 route meaning. It operationalizes it.

---

## 4. Phase 9 Invariants

1. A route is not a valid recovery target unless the runtime can prove availability or has a deterministic alternate path.
2. Worker transport failure must never be surfaced as a generic product failure when a more specific operational class is known.
3. Browser reroute may only claim server recovery is available when the target execution environment passes the applicable health contract.
4. In-process server execution and remote worker execution must preserve the same canonical result and failure semantics.
5. Startup diagnostics must make current media execution posture inspectable without source archaeology.

---

## 5. Canonical Phase 9 Contract

### 5.1 Availability Contract

Before the runtime commits to a worker-backed reroute, it must know one of the following is true:

1. the worker target is healthy and reachable
2. the runtime can execute the same canonical compose path in-process
3. the system must fail explicitly with a worker-unavailable class before claiming server recovery

### 5.2 Deterministic Fallback Chain

The media runtime must define and document a deterministic route chain for `compose_media`, for example:

1. browser-local execution when allowed and available
2. healthy worker-backed deferred execution when available
3. in-process deferred or host-backed execution when healthy and policy-valid
4. explicit terminal failure when no valid execution target remains

The exact chain may differ by deployment mode, but it must be explicit and test-backed.

### 5.3 Diagnostic Contract

Operators and release gates must be able to inspect:

1. active media worker target URL or mode
2. last known worker health
3. in-process fallback posture
4. transport-level failures with stable failure classes

---

## 6. Deliverables

### 6.1 Worker Health And Configuration Surface

Formalize worker availability and health checks.

Candidate seams:

- [src/lib/media/server/media-worker-client.ts](../../../../../src/lib/media/server/media-worker-client.ts#L1)
- [src/lib/media/server/media-worker-http.ts](../../../../../src/lib/media/server/media-worker-http.ts#L1)
- [scripts/media-worker-server.ts](../../../../../scripts/media-worker-server.ts#L1)
- [scripts/process-deferred-jobs.ts](../../../../../scripts/process-deferred-jobs.ts#L1)

### 6.2 Deterministic In-Process Fallback

If policy allows, provide a documented in-process or host-backed fallback path when the worker transport is unavailable but the server can still execute canonical compose logic safely.

### 6.3 Route Availability In Diagnostics And QA

Expose execution-target availability in diagnostics, runtime-integrity evidence, and operator-facing health surfaces.

### 6.4 Failure Taxonomy Expansion

Replace raw transport errors in product-level surfaces with explicit classes such as:

1. `worker_unreachable`
2. `worker_unhealthy`
3. `worker_timeout`
4. `worker_unauthorized`
5. `worker_execution_failed`

---

## 7. Required Tests

1. A down worker produces a deterministic worker-unavailable failure class, not opaque `fetch failed` drift.
2. A healthy worker path still returns canonical deferred results.
3. An in-process fallback path, if enabled, preserves the same envelope, artifact, and failure semantics.
4. Browser reroute chooses the correct next route based on actual target availability.
5. Runtime-integrity coverage includes worker-down and worker-health scenarios.

---

## 8. Exit Criteria

1. No media reroute path fails with opaque transport-only messaging when a more specific failure class is available.
2. Execution-target availability is visible in diagnostics and test evidence.
3. Worker unavailability no longer creates an avoidable single point of failure for composition recovery.
