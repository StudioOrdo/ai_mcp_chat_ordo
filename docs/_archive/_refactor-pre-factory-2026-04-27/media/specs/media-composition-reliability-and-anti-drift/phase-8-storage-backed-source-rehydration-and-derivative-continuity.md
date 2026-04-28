# Phase 8: Storage-Backed Source Rehydration And Derivative Continuity

**Status:** Planned Expansion After Phase 7 Canonical Asset Identity  
**Objective:** Make chart, graph, and similar source-derived media recoverable from governed storage itself rather than from transcript-local tool payloads, so browser and server derivation both operate from the same durable source-of-truth.

---

## 1. Why This Phase Exists

Phase 7 solves the identity problem: clip references must become canonical governed asset IDs before execution. That still leaves a second structural risk exposed by the incident:

1. browser chart recovery currently tries to rediscover Mermaid source by searching the current conversation messages
2. governed source assets can already exist in storage even when the loaded transcript path is incomplete or stale
3. server materialization has already moved toward storage-backed derivation, but browser recovery still has transcript dependency in key paths

This means the runtime still has two source-of-truth models:

1. server derivation from governed storage
2. browser derivation from transcript-local tool payloads

That split is a reliability bug generator.

Phase 8 eliminates it.

---

## 2. Verified Gap After Phase 7

### 2.1 Browser Chart Recovery Is Transcript-First Today

Current chart recovery in [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L296) calls `findChartPayloadByAssetId()` over loaded messages rather than governed storage.

That is useful as a fallback or optimization, but it cannot remain the primary authority for source rehydration.

### 2.2 Server Compose Materialization Is Already Moving Toward Storage-First

Server materialization now exists in [src/lib/media/server/compose-media-plan-materialization.ts](../../../../../src/lib/media/server/compose-media-plan-materialization.ts#L1), where stored chart and graph assets are rendered and rasterized from governed files.

Phase 8 must align the browser path to the same philosophy.

---

## 3. Phase 8 Scope

This phase governs governed-source rehydration and derivative continuity for source-derived media:

1. chart source assets such as Mermaid `.mmd`
2. graph source assets such as governed JSON payloads
3. future source-derived media classes that rely on stored upstream source rather than only final artifacts

This phase governs:

1. source retrieval by canonical asset ID
2. shared source-to-derivative contracts across browser and server
3. derivative lineage preservation through `derivativeOfAssetId`
4. recovery and recomposition without transcript dependency

---

## 4. Phase 8 Invariants

1. Governed source assets are the primary authority for chart and graph rehydration once they have been persisted.
2. Transcript payload lookup may exist only as a non-authoritative compatibility path, never as the sole recovery path.
3. Browser and server derivation must preserve equivalent lineage semantics when they emit derived images.
4. Derived media must preserve `sourceAssetId` and governed `derivativeOfAssetId` semantics consistently.
5. If governed source retrieval fails, the failure must be attributed as source-rehydration failure, not misreported as “source missing from conversation” unless that is literally the governing truth.

---

## 5. Canonical Phase 8 Contract

### 5.1 Source Retrieval Contract

Given a governed chart or graph asset ID, the runtime must be able to retrieve the source payload necessary to derive renderable media without searching prior transcript messages.

Required behavior:

1. source retrieval works through governed storage APIs or equivalent server-backed retrieval seams
2. source retrieval respects ownership and conversation access constraints
3. retrieval returns enough typed metadata to reconstruct the source payload deterministically

### 5.2 Shared Derivation Contract

Browser and server derivation must agree on:

1. canonical source asset identity
2. derivative lineage metadata
3. output asset kind and MIME type
4. failure classification when derivation or retrieval fails

They do not need byte-perfect visual identity at every pixel, but they must preserve the same semantic artifact contract.

### 5.3 Recovery Contract

Any later compose attempt, startup reconciliation, or imported conversation recovery must be able to:

1. resolve the canonical source asset ID
2. retrieve the governed source payload
3. derive the required intermediate image asset
4. continue execution without searching historical transcript messages

---

## 6. Deliverables

### 6.1 Governed Source Loader

Introduce or formalize one shared loader for source-derived governed assets.

Candidate seams:

- [src/lib/user-files.ts](../../../../../src/lib/user-files.ts#L1)
- [src/lib/media/media-asset-projection.ts](../../../../../src/lib/media/media-asset-projection.ts#L1)
- [src/app/api/user-files/[id]/route.ts](../../../../../src/app/api/user-files/%5Bid%5D/route.ts#L1)

### 6.2 Browser Materialization From Governed Source

Refactor browser chart and graph materialization so the primary source path uses governed source retrieval by asset ID.

Candidate seams:

- [src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L280)
- [src/lib/media/browser-runtime/mermaid-image-derivation.ts](../../../../../src/lib/media/browser-runtime/mermaid-image-derivation.ts#L1)
- [src/lib/media/browser-runtime/graph-image-derivation.tsx](../../../../../src/lib/media/browser-runtime/graph-image-derivation.tsx#L1)

### 6.3 Shared Derivative Metadata Contract

Tighten derivative metadata rules so both browser and server derived images preserve:

1. original source asset ID
2. derivative asset ID
3. retention class
4. conversation binding
5. render dimensions where applicable

### 6.4 Error Wording And Failure Taxonomy Cleanup

Replace conversation-transcript-specific error wording when the real failure is governed source retrieval, access, or derivation failure.

---

## 7. Required Tests

1. Browser chart recovery succeeds from governed source storage even when the original `generate_chart` tool result is not available in the loaded transcript.
2. Browser graph recovery succeeds from governed source storage under the same condition.
3. Server and browser both emit derived image assets with consistent lineage metadata.
4. Governed source retrieval failures surface explicit failure codes distinct from transcript-local lookup failures.
5. Imported governed source assets can be rediscovered and rederived without transcript title matching.

---

## 8. Exit Criteria

1. Chart and graph recomposition no longer require transcript-local source lookup when governed source assets exist.
2. Browser and server derivation both operate from the same governed-source authority model.
3. Error diagnostics accurately distinguish source retrieval, derivation, and execution-route failure classes.
