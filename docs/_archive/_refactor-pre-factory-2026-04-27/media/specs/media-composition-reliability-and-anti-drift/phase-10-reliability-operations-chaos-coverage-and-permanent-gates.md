# Phase 10: Reliability Operations, Chaos Coverage, And Permanent Gates

**Status:** Planned Expansion After Phase 7 Through 9 Closure  
**Objective:** Convert the identity, governed-source, and runtime-resilience contracts into permanent operational discipline through scenario-driven gates, failure-injection coverage, and anti-drift evidence that blocks regressions before release.

---

## 1. Why This Phase Exists

Phase 6 already created a serious hardening and release-gate posture. The incident still demonstrated that a release-grade media system needs a stricter final layer:

1. incident classes must be represented directly in automated scenarios
2. reliability drift must be blocked by permanent evidence, not rediscovered by user pain
3. operational runbooks and diagnostics must align with the same scenario matrix used in tests

Phase 10 exists to make the earlier contracts durable under ongoing feature work.

---

## 2. Phase 10 Scope

This phase governs long-lived operational reliability for media composition:

1. failure-injection scenarios
2. scenario-backed runtime-integrity evidence
3. incident runbooks and operator diagnostics
4. permanent release blockers for reliability regressions
5. anti-drift review rules for future media work

---

## 3. Phase 10 Invariants

1. Any media execution path that can fail in production must have at least one deterministic automated scenario that exercises the failure class.
2. Release evidence must include reliability-specific scenarios, not only green-path execution.
3. Operational diagnostics, runtime-integrity scripts, and docs must describe the same scenario vocabulary.
4. New media capabilities may not bypass the Phase 7 through 9 contracts by introducing route-local shortcuts.
5. Anti-drift gates must fail on semantic regressions even when basic rendering still appears to work.

---

## 4. Canonical Phase 10 Contract

### 4.1 Required Failure-Scenario Matrix

At minimum, the permanent reliability matrix must cover:

1. unresolved placeholder asset IDs presented to compose
2. governed source asset present but transcript-local tool result absent
3. browser-local interruption before completion
4. worker unavailable during reroute
5. worker healthy but execution failure returned canonically
6. derivative lineage mismatch during readiness validation
7. imported governed media reused in later composition
8. startup reconciliation after refresh during active media work

### 4.2 Release Gate Contract

Runtime-integrity and release evidence must fail if any required media reliability scenario:

1. produces non-canonical failure stages
2. emits ambiguous or contradictory route truth
3. depends on transcript-only source lookup when governed source exists
4. allows placeholder asset identities into executable compose plans
5. hides worker availability failure behind transport-only error messaging

### 4.3 Documentation And Runbook Contract

The final program state must include:

1. operator runbooks for media worker availability and compose recovery
2. reliability scenario documentation tied to tests and scripts
3. anti-drift contribution rules for any future media routing or source-derived asset work

---

## 5. Deliverables

### 5.1 Failure-Injection Test Expansion

Extend focused Vitest and browser E2E coverage so each required reliability scenario is exercised deliberately.

Candidate seams:

- [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx#L1)
- [tests/browser-ui/ffmpeg-browser-runtime.spec.ts](../../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts#L1)
- [src/lib/media/server/compose-media-worker-runtime.test.ts](../../../../../src/lib/media/server/compose-media-worker-runtime.test.ts#L1)

### 5.2 Runtime-Integrity Scenario Gates

Update runtime-integrity and release evidence so the media reliability matrix is a first-class blocking surface.

Candidate seams:

- [scripts/run-runtime-integrity-qa.ts](../../../../../scripts/run-runtime-integrity-qa.ts#L1)
- [release/runtime-integrity-evidence.json](../../../../../release/runtime-integrity-evidence.json)
- [release/qa-evidence.json](../../../../../release/qa-evidence.json)

### 5.3 Media Reliability Runbook

Document operator steps for:

1. identifying whether failure was identity, source-rehydration, readiness, route-availability, or execution failure
2. checking worker health and current execution posture
3. validating governed source and derivative lineage
4. confirming release evidence coverage for the incident class

### 5.4 Anti-Drift Contribution Rules

Document rules that any future media capability change must satisfy before merge:

1. canonical asset identity compliance
2. governed-source rehydration compliance for source-derived media
3. execution-target availability and failure taxonomy compliance
4. scenario coverage added for any new failure class or route

---

## 6. Required Tests And Evidence

1. Failure-injection tests cover every required scenario in the matrix.
2. Runtime-integrity evidence records those scenarios explicitly.
3. Browser and server logs are sufficient to classify each failure without transcript guesswork.
4. Release gating fails when any reliability scenario regresses.

---

## 7. Exit Criteria

1. Media reliability failures are blocked by permanent gates rather than rediscovered repeatedly in production-like usage.
2. Operator guidance, automated tests, and release evidence all describe the same reliability model.
3. Future media changes have a documented anti-drift checklist anchored in the real failure modes already observed.
