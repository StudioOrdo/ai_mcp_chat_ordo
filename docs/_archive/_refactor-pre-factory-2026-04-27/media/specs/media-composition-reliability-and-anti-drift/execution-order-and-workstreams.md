# Phase 7 Through 10 Execution Order And Workstreams

**Status:** Execution Plan For The Reliability Expansion  
**Scope:** [phase-7-canonical-asset-identity-and-compose-normalization.md](./phase-7-canonical-asset-identity-and-compose-normalization.md) through [phase-10-reliability-operations-chaos-coverage-and-permanent-gates.md](./phase-10-reliability-operations-chaos-coverage-and-permanent-gates.md)

---

## 1. Planning Intent

The new phases were added because the April 17 incident exposed three still-open reliability faults:

1. compose plans can still carry non-canonical placeholder handles
2. browser recovery still depends too much on transcript-local source lookup
3. server reroute can still collapse on opaque worker transport failure

These phases should not be executed as one large undifferentiated refactor. The work needs to land in ordered slices that progressively reduce risk while keeping the branch shippable.

This plan therefore optimizes for:

1. highest-leverage contract fixes first
2. one new authority seam at a time
3. test expansion in the same slice that adds behavior
4. no “temporary” fallback logic that becomes permanent drift

---

## 2. Recommended Order

The recommended execution order is:

1. Phase 7A through 7D: canonical asset identity first
2. Phase 8A through 8C: governed-source rehydration second
3. Phase 9A through 9D: execution-target resilience third
4. Phase 10A through 10C: permanent reliability gates last

This order is intentional.

1. If Phase 7 is not complete, later phases still inherit bad clip identity.
2. If Phase 8 is not complete, browser recovery still needs transcript archaeology even after canonicalization.
3. If Phase 9 is not complete, reroute remains operationally brittle even with good identity and storage-backed recovery.
4. Phase 10 should freeze and gate the finished contracts, not precede them.

---

## 3. Slice Sizing Guidance

Use these slice sizes unless the implementation reveals a strong reason to split further.

1. small slice: 1 to 3 production files plus focused tests
2. medium slice: 3 to 6 production files plus focused tests and one supporting doc update
3. large slice: only allowed when the seam is inherently cross-cutting and already tightly bounded by tests

Preferred posture for these phases:

1. Phase 7: medium, medium, small, medium
2. Phase 8: medium, medium, small
3. Phase 9: small, medium, medium, small
4. Phase 10: medium, medium, small

---

## 4. Phase 7 Execution Plan

### 4.1 Phase 7A: Introduce One Canonical Compose Plan Resolver

**Goal:** add one shared seam that converts draft clip references into governed canonical asset IDs before execution or recovery can observe the plan.

**Why first:** this is the highest-leverage fix. It removes the placeholder-handle problem at the earliest possible boundary.

**Likely file workstreams:**

1. [src/lib/media/ffmpeg/media-composition-plan.ts](../../../../../src/lib/media/ffmpeg/media-composition-plan.ts)
2. [src/core/use-cases/tools/compose-media.tool.ts](../../../../../src/core/use-cases/tools/compose-media.tool.ts)
3. [src/core/use-cases/tools/list-conversation-media-assets.tool.ts](../../../../../src/core/use-cases/tools/list-conversation-media-assets.tool.ts)
4. [src/lib/media/media-asset-projection.ts](../../../../../src/lib/media/media-asset-projection.ts)

**Likely tests:**

1. [src/core/use-cases/ConversationInteractor.test.ts](../../../../../src/core/use-cases/ConversationInteractor.test.ts)
2. [src/lib/media/ffmpeg/media-composition-plan.test.ts](../../../../../src/lib/media/ffmpeg/media-composition-plan.test.ts)

**Acceptance bar for this slice:**

1. a draft plan with provisional handles can be canonicalized when governed assets exist
2. unresolved handles fail before execution routing
3. no execution path receives a placeholder handle after canonicalization succeeds

### 4.2 Phase 7B: Use Canonical Plans In Browser Runtime And Deferred Enqueue

**Goal:** ensure browser execution startup, startup recovery, and deferred enqueue all consume the same canonicalized plan rather than the original raw payload.

**Likely file workstreams:**

1. [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts)
2. [src/lib/jobs/compose-media-deferred-job.ts](../../../../../src/lib/jobs/compose-media-deferred-job.ts)
3. [src/app/api/chat/jobs/route.ts](../../../../../src/app/api/chat/jobs/route.ts)

**Likely tests:**

1. [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx)
2. [src/lib/jobs/compose-media-deferred-job.test.ts](../../../../../src/lib/jobs/compose-media-deferred-job.test.ts)
3. [src/app/api/chat/jobs/route.test.ts](../../../../../src/app/api/chat/jobs/route.test.ts)

**Acceptance bar for this slice:**

1. browser reroute receives canonical asset IDs only
2. startup reconciliation does not resurrect placeholder references
3. deferred job payloads no longer preserve draft handles when canonical IDs are available

### 4.3 Phase 7C: Rewrite Transcript-Visible Payloads To Canonical IDs

**Goal:** make the persisted/rewritten tool results themselves expose governed IDs as the authoritative compose identity.

**Likely file workstreams:**

1. [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts)
2. [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts)
3. [src/adapters/ChatPresenter.ts](../../../../../src/adapters/ChatPresenter.ts)

**Likely tests:**

1. [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx)
2. [src/lib/media/browser-runtime/job-snapshots.test.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.test.ts)

**Acceptance bar for this slice:**

1. later compose requests can use persisted tool result payloads directly
2. transcript replay no longer prefers placeholder card-local IDs over governed IDs

### 4.4 Phase 7D: Portability And Replay Identity Preservation

**Goal:** ensure export/import/replay still preserve canonical clip identity after the new canonicalization contract lands.

**Likely file workstreams:**

1. [src/lib/chat/conversation-portability.ts](../../../../../src/lib/chat/conversation-portability.ts)
2. [src/core/use-cases/ConversationInteractor.ts](../../../../../src/core/use-cases/ConversationInteractor.ts)
3. [src/core/use-cases/tools/list-conversation-media-assets.tool.ts](../../../../../src/core/use-cases/tools/list-conversation-media-assets.tool.ts)

**Likely tests:**

1. [tests/chat/conversation-portability.test.ts](../../../../../tests/chat/conversation-portability.test.ts)
2. [src/core/use-cases/ConversationInteractor.test.ts](../../../../../src/core/use-cases/ConversationInteractor.test.ts)

**Acceptance bar for this slice:**

1. imported conversations can still produce canonical compose plans
2. no replay path depends on title or transcript text matching

---

## 5. Phase 8 Execution Plan

### 5.1 Phase 8A: Introduce A Shared Governed Source Loader

**Goal:** formalize one loader for source-derived media so both browser and server can retrieve chart and graph source by asset ID.

**Likely file workstreams:**

1. [src/lib/user-files.ts](../../../../../src/lib/user-files.ts)
2. [src/lib/media/media-asset-projection.ts](../../../../../src/lib/media/media-asset-projection.ts)
3. [src/app/api/user-files/[id]/route.ts](../../../../../src/app/api/user-files/%5Bid%5D/route.ts)

**Likely tests:**

1. [src/app/api/user-files/[id]/route.test.ts](../../../../../src/app/api/user-files/%5Bid%5D/route.test.ts)
2. [src/lib/media/media-asset-projection.test.ts](../../../../../src/lib/media/media-asset-projection.test.ts)

**Acceptance bar:**

1. a governed chart or graph asset can be loaded with typed source semantics
2. retrieval failures are explicit and distinguishable from transcript absence

### 5.2 Phase 8B: Switch Browser Chart And Graph Recovery To Storage-First

**Goal:** make browser materialization retrieve governed source by canonical asset ID before trying transcript lookup.

**Likely file workstreams:**

1. [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts)
2. [src/lib/media/browser-runtime/mermaid-image-derivation.ts](../../../../../src/lib/media/browser-runtime/mermaid-image-derivation.ts)
3. [src/lib/media/browser-runtime/graph-image-derivation.tsx](../../../../../src/lib/media/browser-runtime/graph-image-derivation.tsx)

**Likely tests:**

1. [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx)
2. any browser-focused card or runtime tests that currently assume transcript-only lookup

**Acceptance bar:**

1. chart and graph recomposition works when the governed source exists even if the corresponding tool result is absent from the loaded transcript
2. transcript lookup becomes compatibility fallback only

### 5.3 Phase 8C: Align Derivative Metadata And Error Taxonomy

**Goal:** make browser and server derivation preserve the same lineage semantics and failure language.

**Likely file workstreams:**

1. [src/lib/media/server/compose-media-plan-materialization.ts](../../../../../src/lib/media/server/compose-media-plan-materialization.ts)
2. [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts)
3. [src/lib/media/compose-media-preflight.ts](../../../../../src/lib/media/compose-media-preflight.ts)

**Likely tests:**

1. [src/lib/media/server/compose-media-worker-runtime.test.ts](../../../../../src/lib/media/server/compose-media-worker-runtime.test.ts)
2. [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx)

**Acceptance bar:**

1. derived images preserve lineage consistently
2. errors distinguish source retrieval, source derivation, and execution-route failure

---

## 6. Phase 9 Execution Plan

### 6.1 Phase 9A: Add Media Worker Health Classification

**Goal:** stop collapsing worker transport failure into raw `fetch failed`.

**Likely file workstreams:**

1. [src/lib/media/server/media-worker-client.ts](../../../../../src/lib/media/server/media-worker-client.ts)
2. [src/lib/media/server/media-worker-http.ts](../../../../../src/lib/media/server/media-worker-http.ts)
3. [src/lib/jobs/deferred-job-worker.ts](../../../../../src/lib/jobs/deferred-job-worker.ts)

**Likely tests:**

1. [src/lib/media/server/media-worker-client.test.ts](../../../../../src/lib/media/server/media-worker-client.test.ts)
2. [src/lib/media/server/media-worker-http.test.ts](../../../../../src/lib/media/server/media-worker-http.test.ts)

**Acceptance bar:**

1. worker-unreachable and worker-runtime-failed are separate failure classes
2. audit logs and job failures carry the classified form

### 6.2 Phase 9B: Formalize Worker Availability And Diagnostics

**Goal:** make current media execution posture inspectable and health-checked.

**Likely file workstreams:**

1. [scripts/media-worker-server.ts](../../../../../scripts/media-worker-server.ts)
2. [scripts/process-deferred-jobs.ts](../../../../../scripts/process-deferred-jobs.ts)
3. [scripts/admin-diagnostics.ts](../../../../../scripts/admin-diagnostics.ts)
4. [src/lib/observability/runtime-audit-log.ts](../../../../../src/lib/observability/runtime-audit-log.ts)

**Likely tests or evidence seams:**

1. diagnostics tests if present
2. runtime-integrity evidence scripts in later slices

**Acceptance bar:**

1. operator surfaces can state whether worker mode is healthy, absent, or degraded
2. route availability is no longer inferred indirectly from failures

### 6.3 Phase 9C: Add Deterministic In-Process Fallback If Policy Allows

**Goal:** ensure server recovery has a documented alternate path when the worker transport is unavailable.

**Likely file workstreams:**

1. [src/lib/media/server/compose-media-worker-runtime.ts](../../../../../src/lib/media/server/compose-media-worker-runtime.ts)
2. [src/lib/media/server/media-worker-client.ts](../../../../../src/lib/media/server/media-worker-client.ts)
3. [src/core/capability-catalog/runtime-tool-binding.ts](../../../../../src/core/capability-catalog/runtime-tool-binding.ts)
4. [src/lib/capabilities/execution-targets.ts](../../../../../src/lib/capabilities/execution-targets.ts)

**Likely tests:**

1. [src/lib/media/server/compose-media-worker-runtime.test.ts](../../../../../src/lib/media/server/compose-media-worker-runtime.test.ts)
2. [src/core/capability-catalog/runtime-tool-binding.test.ts](../../../../../src/core/capability-catalog/runtime-tool-binding.test.ts)

**Acceptance bar:**

1. browser reroute does not dead-end on worker transport when another valid server execution path exists
2. the alternate path preserves the same canonical envelope and artifact contract

### 6.4 Phase 9D: Align Browser Reroute Decisions With Real Availability

**Goal:** the browser runtime should only claim reroute when the next route is actually available, otherwise it should surface the correct degraded failure class.

**Likely file workstreams:**

1. [src/lib/media/browser-runtime/browser-capability-runtime.ts](../../../../../src/lib/media/browser-runtime/browser-capability-runtime.ts)
2. [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts)

**Likely tests:**

1. [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx)
2. [tests/browser-ui/ffmpeg-browser-runtime.spec.ts](../../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts)

**Acceptance bar:**

1. reroute-required, reroute-unavailable, and deferred-running are distinct and truthful user-visible states

---

## 7. Phase 10 Execution Plan

### 7.1 Phase 10A: Freeze The Reliability Scenario Matrix In Tests

**Goal:** turn the observed incident classes into explicit automated scenarios.

**Likely file workstreams:**

1. [src/hooks/chat/useBrowserCapabilityRuntime.test.tsx](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.test.tsx)
2. [src/lib/media/server/compose-media-worker-runtime.test.ts](../../../../../src/lib/media/server/compose-media-worker-runtime.test.ts)
3. [tests/browser-ui/ffmpeg-browser-runtime.spec.ts](../../../../../tests/browser-ui/ffmpeg-browser-runtime.spec.ts)

**Scenario minimums:**

1. unresolved placeholder IDs
2. governed source present but transcript source absent
3. browser interruption before completion
4. worker unavailable during reroute
5. lineage mismatch during recovery or readiness

### 7.2 Phase 10B: Add Runtime-Integrity And Release Evidence Gates

**Goal:** make those scenarios block release when they regress.

**Likely file workstreams:**

1. [scripts/run-runtime-integrity-qa.ts](../../../../../scripts/run-runtime-integrity-qa.ts)
2. [release/runtime-integrity-evidence.json](../../../../../release/runtime-integrity-evidence.json)
3. [release/qa-evidence.json](../../../../../release/qa-evidence.json)
4. [release/manifest.json](../../../../../release/manifest.json)

**Acceptance bar:**

1. reliability scenarios appear in evidence, not only in local tests
2. release readiness can fail on semantic media regressions

### 7.3 Phase 10C: Publish Runbook And Anti-Drift Rules

**Goal:** leave durable operator and contributor guidance after the code stabilizes.

**Likely file workstreams:**

1. [docs/_refactor/media/specs/media-composition-reliability-and-anti-drift/phase-10-reliability-operations-chaos-coverage-and-permanent-gates.md](./phase-10-reliability-operations-chaos-coverage-and-permanent-gates.md)
2. related runtime-integrity or system-state docs under [docs/_refactor/system-state-2026-04-12](../../system-state-2026-04-12)
3. possibly [README.md](../../../../../README.md) if operator workflows need top-level visibility

**Acceptance bar:**

1. future media routing or source-derived work has a visible anti-drift checklist
2. incident handling no longer depends on source-code archaeology

---

## 8. What Not To Do

1. Do not start with Phase 9 worker resilience before Phase 7 identity closure. That leaves bad clip identity alive across more routes.
2. Do not implement Phase 8 storage-backed recovery on top of unresolved placeholder IDs. That only moves the failure later.
3. Do not add release-gate scenarios in Phase 10 before the failure taxonomy in Phase 9 exists. The evidence will be too ambiguous.
4. Do not patch browser cards or transcript rendering to “hide” ambiguity. Every slice must tighten runtime truth first.

---

## 9. Suggested Milestone Boundaries

If the work needs milestone grouping, use these:

1. Milestone A: Phase 7A through 7D
Outcome: compose identity is canonical and replay-safe

2. Milestone B: Phase 8A through 8C
Outcome: source-derived media rehydrates from governed storage across browser and server

3. Milestone C: Phase 9A through 9D
Outcome: reroute and server recovery are operationally resilient and availability-aware

4. Milestone D: Phase 10A through 10C
Outcome: the reliability model is gated permanently by tests, evidence, and runbooks

---

## 10. Definition Of Execution Success

This execution plan is successful only when:

1. no `compose_media` execution path can observe non-canonical clip identity
2. no source-derived media recovery path depends on transcript lookup when governed storage exists
3. no reroute path fails opaquely when target availability can be classified
4. no future regression in those classes can ship without failing a permanent gate
