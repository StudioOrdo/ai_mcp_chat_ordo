# Media Composition Reliability Implementation Program

**Status:** Draft Program — Ready For Execution
**Parent Spec:** [../media-composition-reliability-and-anti-drift-spec.md](../media-composition-reliability-and-anti-drift-spec.md)
**Goal:** Deliver a production-grade media composition system that is truthful, durable, recoverable, observable, and resistant to execution-target drift.

---

## Program Intent

The parent spec defines the architecture contract. This folder turns that contract into phased implementation work with explicit file seams, required tests, exit criteria, and anti-drift rules.

This program assumes greenfield-level rigor within the existing architecture:

1. no hidden orchestration paths
2. no dead code introduced to "prepare" for later work
3. no UI-only truth patches that leave runtime semantics ambiguous
4. no fallback paths that claim automation without a real queueing side effect
5. no runtime parity claims without tests that prove them

The end state is not "working most of the time". The end state is a system that either completes truthfully across runtimes or fails in an explicit, reconstructable way with durable evidence.

---

## Phase Sequence

1. [phase-0-foundation-and-state-model.md](./phase-0-foundation-and-state-model.md)
2. [phase-1-truth-bound-presentation.md](./phase-1-truth-bound-presentation.md)
3. [phase-2-asset-readiness-and-preflight.md](./phase-2-asset-readiness-and-preflight.md)
4. [phase-3-automatic-fallback-and-recovery.md](./phase-3-automatic-fallback-and-recovery.md)
5. [phase-4-execution-target-clarity-and-parity.md](./phase-4-execution-target-clarity-and-parity.md)
6. [phase-5-observability-portability-and-forensics.md](./phase-5-observability-portability-and-forensics.md)
7. [phase-6-hardening-and-release-gates.md](./phase-6-hardening-and-release-gates.md)
8. [phase-7-canonical-asset-identity-and-compose-normalization.md](./phase-7-canonical-asset-identity-and-compose-normalization.md)
9. [phase-8-storage-backed-source-rehydration-and-derivative-continuity.md](./phase-8-storage-backed-source-rehydration-and-derivative-continuity.md)
10. [phase-9-runtime-resilience-worker-availability-and-deterministic-fallback.md](./phase-9-runtime-resilience-worker-availability-and-deterministic-fallback.md)
11. [phase-10-reliability-operations-chaos-coverage-and-permanent-gates.md](./phase-10-reliability-operations-chaos-coverage-and-permanent-gates.md)
12. [phase-11-tool-invocation-identity-and-media-generation-gates.md](./phase-11-tool-invocation-identity-and-media-generation-gates.md)

---

## Delivery Rules

1. Each phase must leave the main branch in a shippable state.
2. Each phase must remove ambiguity rather than layer new conditionals on top of old ambiguity.
3. Every new branch of runtime behavior must have a matching test.
4. Any provisional type, helper, or feature flag introduced in a phase must either be exercised in that same phase or not be added.
5. If an implementation path becomes obsolete during execution, it must be deleted in the same phase that supersedes it.
6. If a doc claim changes, the corresponding architecture docs must be updated in the same phase.

---

## Definition Of Program Success

The program is successful only when all of the following are true.

1. `compose_media` and its prerequisite asset flows are truthful at every user-visible state transition.
2. browser-local execution can recover automatically through the existing deferred-job path.
3. runtime selection for affected capabilities is explicit, documented, and test-backed.
4. durable media assets remain reusable across conversation replay, export, import, and later composition.
5. incident reconstruction can rely on canonical runtime evidence rather than transcript interpretation.
6. the implementation footprint is lean, coherent, and free of placeholder abstractions that never became real behavior.
