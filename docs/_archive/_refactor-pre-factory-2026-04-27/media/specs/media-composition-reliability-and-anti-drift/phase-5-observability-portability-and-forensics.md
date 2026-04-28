# Phase 5: Observability, Portability, And Forensics

**Status:** Revised After Phase 0 Canonicalization, Phase 1 Truth-Bound Presentation, Phase 2 Readiness Wiring, Phase 3 Recovery Closure, And Phase 4 Execution-Target Clarification  
**Objective:** Make media incidents reconstructable and preserve governed media continuity across export, import, replay, refresh, and later composition without introducing a second observability or portability architecture.

---

## 1. Why This Phase Exists

Phases 0 through 4 already closed the most dangerous runtime drift:

1. Phase 0 established canonical lifecycle, terminal truth, and failure-stage meaning.
2. Phase 1 required user-visible cards, transcript summaries, and job surfaces to consume canonical runtime state rather than optimistic prose.
3. Phase 2 made governed asset readiness and reuse the hard gate before composition.
4. Phase 3 made browser-local failure hand off into the existing deferred recovery path instead of inventing a second continuation model.
5. Phase 4 clarified that route selection is a layered orchestration concern, not a separate truth model.

That means Phase 5 does not get to invent brand-new logging or portability systems. It must tighten the evidence and continuity seams that those earlier phases already depend on.

If a media incident occurs now, the operator should be able to answer, without transcript guesswork:

1. what the runtime believed the asset state was
2. what route was attempted first
3. whether fallback or deferred recovery happened
4. what canonical failure code and failure stage were published
5. whether durable governed assets remained reusable after export, import, replay, or refresh

If those answers only exist in scattered source archaeology, Phase 5 is incomplete.

---

## 2. Verified Current Architecture

Phase 5 must describe the real observability and portability seams already present in code.

### 2.1 Canonical Runtime Truth Already Exists In Job And Browser Snapshots

The repo already carries transcript-safe runtime truth through canonical message parts and envelopes rather than ad hoc UI state.

Current relevant facts:

1. browser-managed media status normalization already lives in [src/lib/media/browser-runtime/media-runtime-normalization.ts](../../../../../src/lib/media/browser-runtime/media-runtime-normalization.ts#L1)
2. browser-runtime snapshots already preserve `lifecyclePhase`, `failureCode`, `failureStage`, `failureClass`, and `recoveryMode` in [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)
3. deferred-job result payloads already preserve the same canonical fields in [src/lib/jobs/deferred-job-result.ts](../../../../../src/lib/jobs/deferred-job-result.ts#L1)
4. deferred projection already publishes canonical media lifecycle and failure metadata through [src/lib/jobs/job-status.ts](../../../../../src/lib/jobs/job-status.ts#L1)
5. portability import/export already round-trips those fields in [src/lib/chat/conversation-portability.ts](../../../../../src/lib/chat/conversation-portability.ts#L1)

Phase 5 must therefore treat transcript/job evidence as an existing canonical seam, not as a future enhancement.

### 2.2 Server-Owned Runtime Audit Logging Already Exists

The repo already has a dedicated best-effort JSONL audit bridge in [src/lib/observability/runtime-audit-log.ts](../../../../../src/lib/observability/runtime-audit-log.ts#L1).

Current relevant facts:

1. server-owned audit categories are already explicit: `deferred_job`, `native_process`, `remote_service`, and `mcp_process`
2. audit logs are written to `.runtime-logs/*.jsonl` by default
3. the directory is already configurable through `ORDO_RUNTIME_AUDIT_LOG_DIR`
4. audit writes are intentionally best-effort so observability does not break the runtime path

This is the Phase 5 forensic spine for server-owned runtimes. The doc must describe it as current reality.

### 2.3 Deferred Execution Already Emits Durable Forensic Events

The deferred worker already writes meaningful runtime-audit entries in [src/lib/jobs/deferred-job-worker.ts](../../../../../src/lib/jobs/deferred-job-worker.ts#L1).

Current relevant facts:

1. lease recovery is logged
2. job start is logged
3. progress updates are logged with phase and lease context
4. cancellation is logged
5. retry scheduling is logged
6. terminal success and failure are logged

That means the deferred path already satisfies a large part of the Phase 5 forensic requirement, especially for Phase 3 browser-to-deferred recovery.

### 2.4 Native-Process And Remote-Service Routes Already Emit Durable Forensic Events

The planner-backed non-host adapters already write audit entries in [src/lib/capabilities/external-target-adapters.ts](../../../../../src/lib/capabilities/external-target-adapters.ts#L1).

Current relevant facts:

1. `native_process` writes `invoke_started`, `invoke_failed`, and `invoke_succeeded`
2. `remote_service` writes the same start/success/failure lifecycle
3. the logged context already includes route identifiers, user/conversation context, and timeout metadata

Phase 5 must preserve these as the canonical non-host forensic seam rather than encouraging parallel per-capability logging.

### 2.5 Browser Runtime Still Requires Transcript-First Forensics

The current system-state doc in [docs/_refactor/system-state-2026-04-12/runtime-e2e-inventory-and-logging.md](../../system-state-2026-04-12/runtime-e2e-inventory-and-logging.md#L1) is accurate about the current browser posture.

Current relevant facts:

1. `browser_wasm` does not write into the server-side JSONL audit files
2. browser incidents are currently reconstructed through canonical browser-runtime job snapshots, transcript state, and focused browser tests
3. the browser path already preserves reroute-required and failure metadata through the same canonical job-status seam used by the server path

Phase 5 must document this honestly. Browser forensics are not absent, but they do not yet use the same file-backed audit channel as server-owned runtimes.

### 2.6 Portability And Replay Already Have A Canonical Media Continuity Seam

The portability layer already exists in [src/lib/chat/conversation-portability.ts](../../../../../src/lib/chat/conversation-portability.ts#L1).

Current relevant facts:

1. export payloads already include an attachment manifest, job references, and transcript copy
2. portable media payload normalization already exists for `generate_audio`, `generate_chart`, `generate_graph`, and `compose_media`
3. portable media artifacts are already reconstructed into canonical artifact refs during export/import normalization
4. import already restores canonical `job_status` fields including lifecycle and failure metadata
5. typed media attachments already round-trip with `assetId`, `assetKind`, `mimeType`, `source`, and `retentionClass`

Phase 5 must therefore constrain and extend this seam rather than inventing a second portability format.

### 2.7 Governed Media Rediscovery Already Exists And Is The Portability Backstop

The canonical later-turn discovery surface already exists as `list_conversation_media_assets`.

Relevant implemented pieces:

1. catalog definition and prompt guidance in [src/core/capability-catalog/families/media-capabilities.ts](../../../../../src/core/capability-catalog/families/media-capabilities.ts#L1)
2. host execution in [src/core/use-cases/tools/list-conversation-media-assets.tool.ts](../../../../../src/core/use-cases/tools/list-conversation-media-assets.tool.ts#L1)
3. candidate projection in [src/lib/media/media-asset-projection.ts](../../../../../src/lib/media/media-asset-projection.ts#L1)
4. portability/import rebinding proof in [src/core/use-cases/ConversationInteractor.test.ts](../../../../../src/core/use-cases/ConversationInteractor.test.ts#L880)
5. direct tool-level proof in [src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts](../../../../../src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts#L1)

This matters because Phase 5 continuity is not just about preserving metadata in exported messages. It is about preserving enough governed identity that the imported conversation can rediscover those assets through the canonical host-owned listing surface before later composition.

---

## 3. Phase 5 Scope

This phase governs two tightly related concerns:

1. forensic evidence for media runtime incidents
2. durable governed media continuity across portability and later reuse

Specifically, Phase 5 governs:

1. canonical failure metadata carried in transcript-safe job and tool snapshots
2. file-backed audit logging for server-owned execution environments
3. conversation export/import normalization for governed media artifacts and job history
4. rebinding imported governed assets to the target conversation
5. rediscovery of imported and replayed media through `list_conversation_media_assets`

This phase does not replace Phase 0 runtime state, Phase 1 presentation, Phase 2 readiness, Phase 3 recovery, or Phase 4 route selection. It depends on all of them.

---

## 4. Phase 5 Invariants

The following rules are mandatory.

1. Phase 0 remains authoritative for lifecycle phases, terminality, failure-stage meaning, and durable asset truth.
2. Phase 1 remains authoritative for what transcript and card surfaces may claim from runtime evidence.
3. Phase 2 remains authoritative for governed asset identity and readiness semantics.
4. Phase 3 remains authoritative for browser fallback and deferred recovery lineage.
5. Phase 4 remains authoritative for which execution environment was selected and how route choice is described.
6. Phase 5 may not create a second observability format that bypasses canonical `job_status`, result-envelope, or artifact seams.
7. Phase 5 may not treat exported media as reusable unless governed asset identity remains recoverable.
8. Browser forensics and server-owned audit files may differ in transport, but they must remain semantically compatible enough to reconstruct the same incident.
9. Portability logic must preserve canonical media identity and failure metadata instead of reducing prior work to display-only remnants.

---

## 5. Canonical Phase 5 Contract

### 5.1 Failure Evidence Contract

Every media incident must leave enough canonical evidence to answer:

1. what capability was executing
2. which execution environment owned the attempt
3. what the runtime thought the current lifecycle phase was
4. what failure code and failure stage were published
5. what recovery action was taken or expected

Current implemented carriers of that evidence are:

1. `job_status` message parts
2. deferred-job result payloads
3. canonical result envelopes and replay snapshots
4. server-owned JSONL runtime-audit files where applicable

### 5.2 Server-Owned Forensics Contract

For `deferred_job`, `native_process`, `remote_service`, and `mcp_process`, durable JSONL audit evidence is the required server-side forensic seam.

Required interpretation:

1. file-backed audit logs are a debugging bridge, not a replacement for persisted job events
2. audit records must be sufficient to correlate runtime category, tool attempt, and terminal outcome
3. operators must be able to find the concrete log file paths without source archaeology

The current system-state doc and `admin:diagnostics` posture already support this contract and should remain aligned.

### 5.3 Browser Forensics Contract

The browser runtime must remain reconstructable even though it does not yet write server-side JSONL audit files.

Required interpretation:

1. browser failures must publish explicit canonical `job_status` evidence
2. reroute-required compose failures must preserve canonical failure code, failure stage, and recovery mode
3. browser-to-deferred handoff must remain visible through transcript/job snapshots rather than hidden in UI-only state

This is how Phase 5 stays consistent with the Phase 3 recovery model.

### 5.4 Portability Contract

Conversation export/import must preserve enough normalized media truth that later turns can still reason about previous governed assets.

Required behavior:

1. exported portable payloads must preserve typed media identity where available
2. imported message parts must restore canonical media descriptors rather than degrading them to plain text
3. canonical lifecycle and failure metadata must survive round-trip import/export for job-backed media state

### 5.5 Governed Asset Continuity Contract

Phase 5 continuity does not end at message import.

Required behavior:

1. imported governed assets must be rebound to the imported conversation when appropriate
2. `list_conversation_media_assets` must remain the canonical later-turn rediscovery surface
3. later composition must be able to use rediscovered imported assets without fabricating IDs or depending on stale card-local payloads

This is already the implemented shape proven in `ConversationInteractor` tests and should be documented as such.

### 5.6 Route-Aware Forensics Contract

Phase 5 must stay consistent with Phase 4 route clarity.

Required interpretation:

1. route choice belongs to the execution-target layer
2. forensic evidence must record or preserve enough route context to reconstruct that choice later
3. route differences may change evidence transport, but not the semantic meaning of lifecycle, failure, or durable asset truth

---

## 6. Current Code Findings

### 6.1 What The Repo Already Proves

1. canonical media lifecycle and failure metadata already flow through browser-runtime normalization, deferred projection, and deferred-job result payloads
2. server-owned runtime-audit logging already exists and is wired for deferred jobs, native-process adapters, and remote-service adapters
3. portability already preserves transcript copy, job references, attachment manifests, and typed media descriptors
4. imported job-status parts already restore lifecycle and failure metadata on round-trip import
5. imported governed assets are already rebound to the imported conversation and rediscovered through `list_conversation_media_assets`
6. later composition from exported/imported chart and audio state is already proven in `ConversationInteractor` tests

### 6.2 What Phase 5 Must Keep Tight

1. docs must not imply that browser observability uses the same file-backed audit mechanism as server-owned runtimes today
2. docs must not describe portability as message-copy only; governed asset rebinding and rediscovery are part of the actual continuity contract
3. failure taxonomy language must stay aligned with the canonical snapshot fields already in code rather than inventing a second terminology set
4. any future browser diagnostic artifact should extend the existing canonical evidence model, not replace transcript/job evidence

Phase 5 is therefore primarily an architecture-tightening and evidence-contract phase, not a greenfield implementation phase.

---

## 7. Required Deliverables

### 7.1 Canonical Evidence Alignment

The following seams must agree in meaning:

1. browser-runtime media normalization
2. deferred-job projection and result payloads
3. transcript-safe message parts
4. portability normalization
5. server-owned runtime-audit files

### 7.2 Portability And Rediscovery Alignment

The following seams must agree in meaning:

1. portable media payload normalization in `conversation-portability`
2. governed media projection in `media-asset-projection`
3. imported asset rebinding in `ConversationInteractor`
4. later-turn rediscovery through `list_conversation_media_assets`

### 7.3 Doc Wording That Respects Earlier Phases

Phase 5 docs must state explicitly that:

1. observability does not redefine lifecycle semantics from Phase 0
2. portability does not bypass presentation truth from Phase 1
3. portability does not bypass governed readiness and identity from Phase 2
4. observability does not create a second recovery model outside Phase 3
5. route-aware evidence remains layered on top of Phase 4 execution-target rules rather than replacing them

---

## 8. Candidate File Changes

Update when Phase 5 behavior changes:

- [src/lib/media/browser-runtime/media-runtime-normalization.ts](../../../../../src/lib/media/browser-runtime/media-runtime-normalization.ts#L1)
- [src/lib/media/browser-runtime/job-snapshots.ts](../../../../../src/lib/media/browser-runtime/job-snapshots.ts#L1)
- [src/lib/jobs/job-status.ts](../../../../../src/lib/jobs/job-status.ts#L1)
- [src/lib/jobs/deferred-job-result.ts](../../../../../src/lib/jobs/deferred-job-result.ts#L1)
- [src/lib/observability/runtime-audit-log.ts](../../../../../src/lib/observability/runtime-audit-log.ts#L1)
- [src/lib/jobs/deferred-job-worker.ts](../../../../../src/lib/jobs/deferred-job-worker.ts#L1)
- [src/lib/capabilities/external-target-adapters.ts](../../../../../src/lib/capabilities/external-target-adapters.ts#L1)
- [src/lib/chat/conversation-portability.ts](../../../../../src/lib/chat/conversation-portability.ts#L1)
- [src/lib/media/media-asset-projection.ts](../../../../../src/lib/media/media-asset-projection.ts#L1)
- [src/core/use-cases/ConversationInteractor.test.ts](../../../../../src/core/use-cases/ConversationInteractor.test.ts#L1)
- [src/core/use-cases/tools/list-conversation-media-assets.tool.ts](../../../../../src/core/use-cases/tools/list-conversation-media-assets.tool.ts#L1)
- [src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts](../../../../../src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts#L1)
- [docs/_refactor/system-state-2026-04-12/runtime-e2e-inventory-and-logging.md](../../system-state-2026-04-12/runtime-e2e-inventory-and-logging.md#L1)

---

## 9. Positive Tests

1. Browser and deferred media state publish canonical lifecycle, failure, and recovery metadata through transcript-safe job snapshots.
2. Server-owned deferred, native-process, and remote-service execution leave durable JSONL audit entries.
3. Exported and re-imported conversations preserve typed media descriptors and canonical job metadata.
4. Imported governed assets are rebound to the imported conversation and rediscoverable through `list_conversation_media_assets`.
5. Later composition can build valid plans from rediscovered imported assets without fabricating media IDs.

## 10. Negative Tests

1. Browser or deferred snapshots missing lifecycle, failure code, or failure stage are non-compliant.
2. A server-owned route that executes without leaving durable audit evidence is non-compliant.
3. Export/import behavior that drops governed asset identity into card-only residue is non-compliant.
4. Imported conversations that cannot rediscover governed media through the canonical listing surface are non-compliant.
5. Docs that describe the browser path as already having the same file-backed audit posture as server-owned runtimes are non-compliant.

## 11. Edge Tests

1. Empty media inventory still returns a valid rediscovery envelope.
2. Mixed historical, imported, and newly-generated assets normalize consistently under the same projection rules.
3. Browser-local start plus deferred-server finish still leaves coherent cross-route evidence.
4. Transcript copy remains meaningful even when the import payload contains active progress phases rather than terminal media artifacts.
5. Best-effort runtime-audit logging failure must not break the runtime path.

---

## 12. Exit Criteria

1. A developer can inspect one doc and understand the difference between transcript-safe evidence, server-owned runtime-audit files, and portability continuity.
2. Media incidents can be reconstructed from canonical evidence without transcript guesswork or source archaeology.
3. Durable governed assets survive export, import, rebinding, rediscovery, and later composition.
4. Browser and server-owned runtimes are documented according to their real current observability posture, not a blended aspiration.
5. No parallel observability or portability narrative exists outside the canonical runtime-state, job-snapshot, runtime-audit, portability, and governed-asset discovery seams.
