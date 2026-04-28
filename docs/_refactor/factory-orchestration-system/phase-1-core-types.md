# Phase 1 — Core Factory Types: Clean Entity Model and Invariants

## Objective

Define the core TypeScript entity model for the factory system in a way that is:

- compatible with the existing job and capability architecture
- safe to persist and serialize without adapters leaking into entities
- explicit about valid and invalid states
- narrow enough to avoid dead code and speculative abstractions
- orthogonal, so planning, runtime execution, QA, and release concerns stay separated

Phase 1 should produce a clean domain model that Phase 2 through Phase 5 can build on without needing to rename fields, split mixed responsibilities, or undo status duplication.

## Status

- Design: QA reviewed and implemented
- Implementation: Complete
- Scope: entity contracts, constants, pure helpers, invariants, and tests
- Out of scope: repositories, orchestration services, API routes, persistence adapters

## Phase 1 Exit Criteria

Phase 1 is complete only when all of the following are true:

1. [x] Factory entities are defined in `src/core/entities/` with JSON-safe shapes.
2. [x] Planning state is separated from runtime state.
3. [x] Top-level lifecycle does not duplicate per-stage lifecycle.
4. [x] Existing system types are reused where they already express the same concept.
5. [x] Entity files contain only types, constants, guards, and pure helper functions.
6. [x] Every type has positive, negative, and edge-case coverage in tests.
7. [x] No field exists without a known Phase 2+ consumer.

## Implementation Result

Implemented files:

- `src/core/entities/factory-validation.ts`
- `src/core/entities/factory-constants.ts`
- `src/core/entities/product-brief.ts`
- `src/core/entities/production-stage.ts`
- `src/core/entities/production-dag.ts`
- `src/core/entities/stage-run-record.ts`
- `src/core/entities/draft.ts`
- `src/core/entities/research-packet.ts`
- `src/core/entities/factory-asset.ts`
- `src/core/entities/composition.ts`
- `src/core/entities/qa-report.ts`
- `src/core/entities/release.ts`
- `src/core/entities/outcome.ts`
- `src/core/entities/work-order.ts`
- `tests/factory/types.test.ts`

Validation completed:

- `vitest` focused run passed for `tests/factory/types.test.ts`
- editor diagnostics reported no errors across the new entity and test files

## Clean Code Rules for Phase 1

These rules are part of the design, not implementation notes.

### 1. Keep entities persistence-safe

Do not use `Map`, `Set`, `Date`, class instances, or callback fields in core entities. Use plain objects, readonly arrays, string timestamps, and discriminated unions.

Reason:

- entities will flow through jobs, event logs, SQLite, JSON payloads, and future graph persistence
- JSON-safe shapes reduce adapter code and serialization bugs
- plain objects are easier to diff, snapshot, store, and replay

### 2. Do not mix plan with runtime

`ProductionDAG` is the plan.

`WorkOrder` is the runtime container.

`ProductionStage` describes what should run.

`StageRunRecord` describes what did run.

Do not put mutable execution state like `status`, `startedAt`, `completedAt`, `result`, or `error` on the plan node itself.

Reason:

- immutable plans are easier to reason about, version, compare, and checkpoint
- runtime mutations belong to execution state, not planning state
- this avoids forcing DAG regeneration when only run state changes

### 3. Reuse existing system concepts

Where possible, align with existing entity contracts:

- reuse existing media kinds from `src/core/entities/media-asset.ts`
- align lifecycle naming with `src/core/entities/job.ts`
- align progress and phase language with `src/core/entities/capability-result.ts`

Do not create a second vocabulary for the same concept unless factory behavior is materially different.

### 4. Prefer derivation over duplicated status fields

Avoid a large `WorkOrderStatus` enum that duplicates stage progress such as `researching`, `producing`, `releasing`, and `qa_pending`.

Use:

- a small coarse-grained work-order status for ownership and terminal state
- stage run records to determine the active phase and detailed execution state

Reason:

- duplicate state machines drift
- detailed lifecycle is already captured by stage runs and progress phases
- derived read models are cleaner than over-encoding state in the entity

### 5. Use discriminated unions when content differs by kind

Do not model section content or stage configuration as broad `unknown` unless the value is truly opaque at this layer.

When the type shape is known by variant, use a discriminated union.

### 6. Keep helpers pure

Entity files may contain:

- type definitions
- `as const` arrays and derived union types
- guards
- invariant helpers
- pure derivation helpers

Entity files must not contain:

- repository access
- network calls
- file system logic
- ID generation
- time generation

Inject IDs and timestamps from the calling layer.

## Non-Goals

Phase 1 should not attempt to solve:

- persistence layout
- retry scheduling
- checkpoint storage
- UI formatting
- orchestration behavior
- provider-specific media payloads

If a field is only needed by one future adapter and not by the domain model, it does not belong in Phase 1 entities.

## Orthogonal Architecture Boundaries

The model should be split into four concerns:

1. Intent
  `ProductBrief`
2. Plan
  `ProductionDAG`, `ProductionStage`
3. Runtime
  `WorkOrder`, `StageRunRecord`, `ExecutionLogEntry`
4. Outputs
  `Draft`, `ResearchPacket`, `FactoryAsset`, `Composition`, `QAReport`, `Release`, `Outcome`

This separation is the core defense against dead code and tangled abstractions.

## Existing Codebase Anchors

The design should stay grounded in the current system:

- `src/core/entities/job.ts`
  - coarse-grained lifecycle, failure classification, retry and recovery concepts
- `src/core/entities/capability-result.ts`
  - progress phases and envelope patterns
- `src/core/entities/media-asset.ts`
  - canonical media asset kind vocabulary
- `src/lib/blog/blog-article-production-service.ts`
  - reference orchestration flow and staged artifact production
- `src/lib/jobs/job-capability-types.ts`
  - progress phase definitions and capability-driven execution metadata

## Recommended Type Hierarchy

```text
ProductBrief
  -> ProductionDAG
     -> ProductionStage[]
  -> WorkOrder
     -> StageRunRecord[]
     -> ExecutionLogEntry[]
    -> Draft?
     -> ResearchPacket?
     -> FactoryAsset[]
     -> Composition?
     -> QAReport?
     -> Release?
    -> Outcome?
```

## Core Constants and Shared Types

Phase 1 should prefer constant arrays plus derived union types so the compiler and tests stay aligned.

```typescript
// File: src/core/entities/factory-constants.ts

import type { MediaAssetKind } from "@/core/entities/media-asset";

export const FACTORY_ASSET_KINDS = [
  "image",
  "chart",
  "graph",
  "audio",
  "video",
] as const;

export type FactoryAssetKind = (typeof FACTORY_ASSET_KINDS)[number];

export const QA_CRITERIA = [
  "accuracy",
  "accessibility",
  "tone_match",
  "performance",
  "brand_compliance",
  "completeness",
  "uniqueness",
] as const;

export type QACriterion = (typeof QA_CRITERIA)[number];

export const STAGE_KINDS = [
  "research",
  "draft",
  "asset_generation",
  "composition",
  "qa",
  "qa_resolution",
  "release",
  "outcome",
] as const;

export type StageKind = (typeof STAGE_KINDS)[number];

export const WORK_ORDER_STATUSES = [
  "planned",
  "running",
  "paused",
  "succeeded",
  "failed",
  "canceled",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

type ReusedMediaKinds = Extract<MediaAssetKind, "image" | "chart" | "graph" | "audio" | "video">;
```

Design notes:

- `Draft` and `Composition` are first-class outputs, not asset kinds
- `FactoryAssetKind` should stay limited to generated asset outputs that behave like assets in orchestration and QA
- factory-specific constants should live in one place and be reused across entity files and tests
- prefer `Extract<>` when a factory concept is a subset of an existing system concept

## Entity Specifications

### 1. ProductBrief

`ProductBrief` is user intent. It should remain stable even if the plan is regenerated.

```typescript
// File: src/core/entities/product-brief.ts

import type { FactoryAssetKind, QACriterion } from "./factory-constants";

export interface ProductBrief {
  id: string;
  schemaVersion: 1;
  title: string;
  topic: string;
  description?: string;
  audience?: string;
  tone?: string;
  assetKinds: readonly FactoryAssetKind[];
  qaCriteria: readonly QACriterion[];
  targetChannels: readonly string[];
  executionPreferences: {
    autoRetryOnFailure: boolean;
    parallelizeAssets: boolean;
    maxAssetCount?: number;
  };
  createdAt: string;
  createdBy: string;
  sourceConversationId?: string;
}
```

Required invariants:

- `title` is non-empty after trimming
- `topic` is non-empty after trimming
- `assetKinds` has at least one item
- `assetKinds` contains no duplicates
- `qaCriteria` contains no duplicates
- `targetChannels` contains no duplicates
- `maxAssetCount`, when present, is greater than `0`

Design guidance:

- use camelCase to match the existing codebase
- keep user intent separate from orchestration decisions inferred later
- do not store generated stage config here

### 2. ProductionStage

`ProductionStage` is a plan node, not a runtime record.

```typescript
// File: src/core/entities/production-stage.ts

import type { FactoryAssetKind, StageKind } from "./factory-constants";

export interface ProductionStage {
  key: string;
  kind: StageKind;
  label: string;
  description?: string;
  dependencyKeys: readonly string[];
  parallelizable: boolean;
  timeoutMs?: number;
  config?: ProductionStageConfig;
}

export type ProductionStageConfig =
  | { kind: "research"; queryHint?: string }
  | { kind: "draft"; outlineHint?: string }
  | { kind: "asset_generation"; assetKind: FactoryAssetKind; assetSlot: string }
  | { kind: "composition"; template?: string }
  | { kind: "qa"; scope: "asset" | "page" }
  | { kind: "qa_resolution"; strategy: "auto" | "manual" }
  | { kind: "release"; channels: readonly string[] }
  | { kind: "outcome"; observationWindowDays?: number };
```

Required invariants:

- `key` is unique within a DAG
- `dependencyKeys` contains no duplicates
- a stage cannot depend on itself
- `config.kind`, when present, must align with `kind`
- `timeoutMs`, when present, must be positive

### 3. ProductionDAG

`ProductionDAG` is the immutable plan generated from a brief.

```typescript
// File: src/core/entities/production-dag.ts

import type { ProductionStage } from "./production-stage";

export interface ProductionDAG {
  id: string;
  schemaVersion: 1;
  briefId: string;
  version: number;
  stages: readonly ProductionStage[];
  autoParallelize: boolean;
  generatedAt: string;
  generatedBy: string;
  generationReason: "batch_automation" | "single_asset" | "revision_loop";
}

export function getStageByKey(dag: ProductionDAG, key: string): ProductionStage | undefined {
  return dag.stages.find((stage) => stage.key === key);
}
```

Required invariants:

- `stages` is non-empty
- stage keys are unique
- all dependency keys reference existing stages
- the graph is acyclic
- `version` is at least `1`

Design guidance:

- keep helper functions pure and narrow
- topological sort validation belongs in helpers/tests, not in an orchestrator-only file

### 4. StageRunRecord

This is the runtime counterpart to `ProductionStage`.

```typescript
// File: src/core/entities/stage-run-record.ts

export const STAGE_RUN_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "skipped",
  "paused",
  "canceled",
] as const;

export type StageRunStatus = (typeof STAGE_RUN_STATUSES)[number];

export interface StageRunRecord {
  id: string;
  stageKey: string;
  status: StageRunStatus;
  startedAt?: string;
  completedAt?: string;
  resultRef?: StageResultRef;
  errorCode?: string;
  errorMessage?: string;
  attemptCount: number;
}

export interface StageResultRef {
  entityKind: "research_packet" | "draft" | "asset" | "composition" | "qa_report" | "release" | "outcome";
  entityId: string;
}
```

Required invariants:

- `id` is a durable non-empty identifier for this stage run record
- a `pending` stage cannot have `startedAt` or `completedAt`
- a `running` stage must have `startedAt`
- a terminal stage cannot have `completedAt` before `startedAt`
- `attemptCount` is `0` for pending stages and at least `1` after execution begins
- `resultRef` is present only for succeeded stages unless explicitly documented otherwise

### 5. WorkOrder

`WorkOrder` is the runtime aggregate root.

```typescript
// File: src/core/entities/work-order.ts

import type { WorkOrderStatus } from "./factory-constants";
import type { ProductionDAG } from "./production-dag";
import type { StageRunRecord } from "./stage-run-record";

export interface WorkOrder {
  id: string;
  schemaVersion: 1;
  briefId: string;
  status: WorkOrderStatus;
  currentDag: ProductionDAG;
  stageRuns: readonly StageRunRecord[];
  executionLog: readonly ExecutionLogEntry[];
  revision: number;
  previousWorkOrderIds: readonly string[];
  pausedState?: WorkOrderPauseState;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  userId: string;
  conversationId?: string;
  initiatedBy: "batch_automation" | "single_asset" | "revision_loop";
}

export interface WorkOrderPauseState {
  pausedAt: string;
  reason: string;
  resumeFromStageKey: string;
}

export interface ExecutionLogEntry {
  timestamp: string;
  stageKey?: string;
  eventType:
    | "planned"
    | "started"
    | "progress"
    | "succeeded"
    | "failed"
    | "skipped"
    | "paused"
    | "resumed"
    | "canceled";
  details?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}
```

Required invariants:

- `briefId` matches `currentDag.briefId`
- `revision` is at least `1`
- `previousWorkOrderIds` contains no duplicates
- `previousWorkOrderIds` preserves multi-parent lineage when a revision is derived from more than one prior work order
- `pausedState` exists only when `status` is `paused`
- `completedAt` exists only for terminal statuses
- `stageRuns` reference only stage keys in `currentDag`
- there is at most one `StageRunRecord` per stage key in the same revision

Design guidance:

- keep work-order status coarse
- derive fine-grained execution state from `stageRuns`
- keep lineage multi-parent capable in the domain even if a given revision usually has one direct parent
- do not duplicate asset, QA, or release payloads inside the work order when a referenced output entity exists

### 6. ResearchPacket

```typescript
// File: src/core/entities/research-packet.ts

export interface ResearchPacket {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  queryUsed: string;
  searchTimestamp: string;
  summary: string;
  confidenceScore: number;
  sources: readonly SourceReference[];
  claims: readonly Claim[];
  searchEngine?: "web" | "vector" | "hybrid";
}

export interface SourceReference {
  id: string;
  title: string;
  url: string;
  retrievedAt: string;
  relevanceScore: number;
}

export interface Claim {
  id: string;
  text: string;
  supportingSourceIds: readonly string[];
  confidence: number;
  contradictionClaimIds?: readonly string[];
}
```

Required invariants:

- `confidenceScore` is between `0` and `1`
- `relevanceScore` is between `0` and `1`
- every `supportingSourceIds` entry references a known source
- claims may be empty only if the summary explicitly indicates no reliable evidence was found

### 7. Draft

The draft is the canonical structured narrative output produced before asset composition.

```typescript
// File: src/core/entities/draft.ts

export interface Draft {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  title: string;
  summary?: string;
  sections: readonly DraftSection[];
  createdAt: string;
  revision: number;
  sourceResearchPacketId?: string;
}

export type DraftSection =
  | { id: string; kind: "heading"; order: number; text: string; level: 1 | 2 | 3 | 4 }
  | { id: string; kind: "paragraph"; order: number; text: string }
  | { id: string; kind: "callout"; order: number; text: string; tone?: "info" | "warning" | "success" };
```

Required invariants:

- `revision` is at least `1`
- section IDs are unique
- section order values are unique and contiguous after normalization
- `title` is non-empty after trimming

### 8. FactoryAsset

Prefer a distinct factory entity name to avoid confusion with other asset models in the repo.

```typescript
// File: src/core/entities/factory-asset.ts

import type { FactoryAssetKind, QACriterion } from "./factory-constants";

export interface FactoryAsset {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  kind: FactoryAssetKind;
  label?: string;
  uri?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  generationParams: Record<string, unknown>;
  generatedAt: string;
  generationDurationMs?: number;
  provenance: AssetProvenance;
  qaStatus: "pending" | "passed" | "failed";
  qaFindings: readonly QAFinding[];
  revision: number;
}

export interface AssetProvenance {
  stageKey: string;
  previousAssetId?: string;
  sourceAssetIds?: readonly string[];
}

export interface QAFinding {
  id: string;
  criterion: QACriterion;
  severity: "error" | "warning" | "info";
  message: string;
  suggestedFix?: string;
  code?: string;
}
```

Required invariants:

- `revision` is at least `1`
- `qaFindings` is empty when `qaStatus` is `pending`
- `qaStatus` is `failed` when any finding has severity `error`
- `previousAssetId`, when present, must not equal `id`
- assets generated from the same stage must still remain distinguishable by `id` and provenance

### 9. Composition

Avoid `content: unknown`. Use a section union.

```typescript
// File: src/core/entities/composition.ts

export interface Composition {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  title: string;
  sections: readonly CompositionSection[];
  embeddedAssetIds: readonly string[];
  htmlContent?: string;
  metadata: {
    theme?: string;
    layout?: string;
    targetChannel?: string;
  };
  provenance: {
    draftId: string;
    assetIds: readonly string[];
  };
  createdAt: string;
  revision: number;
}

export type CompositionSection =
  | { id: string; kind: "heading"; order: number; text: string; level: 1 | 2 | 3 | 4 }
  | { id: string; kind: "text"; order: number; text: string }
  | { id: string; kind: "image" | "chart" | "graph" | "video" | "audio"; order: number; assetId: string; caption?: string };
```

Required invariants:

- section IDs are unique
- section order values are unique and contiguous after normalization
- every media section references an asset in `embeddedAssetIds`
- `embeddedAssetIds` contains no duplicates

### 10. QAReport

Use arrays and IDs instead of `Map`.

```typescript
// File: src/core/entities/qa-report.ts

import type { FactoryAssetKind, QACriterion } from "./factory-constants";
import type { QAFinding } from "./factory-asset";

export interface QAReport {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  status: "passed" | "failed" | "needs_review";
  totalFindings: number;
  passedCriteria: readonly QACriterion[];
  failedCriteria: readonly QACriterion[];
  assetReports: readonly AssetQAReport[];
  pageFindings: readonly QAFinding[];
  recommendedFixes: readonly string[];
  autoResolvableCount: number;
  requiresUserDecision: boolean;
  createdAt: string;
}

export interface AssetQAReport {
  assetId: string;
  assetKind: FactoryAssetKind;
  findings: readonly QAFinding[];
  status: "passed" | "failed";
}
```

Required invariants:

- `totalFindings` equals the sum of asset and page findings
- `passedCriteria` and `failedCriteria` do not overlap
- `requiresUserDecision` is true when non-auto-resolvable errors remain
- an `AssetQAReport` marked `passed` has zero error-severity findings

### 11. Release

Use arrays or records, not `Map`.

```typescript
// File: src/core/entities/release.ts

export interface Release {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  version: string;
  releaseNumber: number;
  compositionId: string;
  publishedDestinations: readonly PublishedDestination[];
  releasedAt: string;
  releasedBy: string;
  approvedBy?: string;
  releaseNotes?: string;
  archiveUri?: string;
  socialPosts?: readonly SocialPost[];
  metrics?: ReleaseMetrics;
}

export interface PublishedDestination {
  channel: string;
  url: string;
}

export interface SocialPost {
  platform: "twitter" | "linkedin" | "facebook";
  content: string;
  scheduledAt?: string;
  postedAt?: string;
  postUrl?: string;
}

export interface ReleaseMetrics {
  viewCount?: number;
  engagementByChannel?: Record<string, number>;
}
```

Required invariants:

- `releaseNumber` is at least `1`
- `publishedDestinations` cannot contain duplicate channels
- `version` must match the chosen release version policy
- `postUrl` cannot exist unless the post was actually published

### 12. Outcome

`Outcome` captures post-release observations without polluting the release entity itself.

```typescript
// File: src/core/entities/outcome.ts

export interface Outcome {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  releaseId: string;
  observedAt: string;
  metrics: OutcomeMetrics;
  notes?: string;
}

export interface OutcomeMetrics {
  viewCount?: number;
  engagementByChannel?: Record<string, number>;
  conversionCount?: number;
}
```

Required invariants:

- `releaseId` must reference the released output being observed
- metrics may be sparse, but all numeric values must be non-negative
- `observedAt` must be greater than or equal to the related release timestamp once adapters enforce relational checks

## Integration with Existing Job Model

The factory types should complement the current job model rather than replace it.

| Factory Entity | Existing Anchor | Guidance |
| --- | --- | --- |
| `ProductBrief` | `JobRequestSeed.requestPayload` | brief becomes structured input payload |
| `ProductionDAG` | `JobProgressPhaseDefinition[]` | derive progress phases from stages |
| `WorkOrder` | `JobRequest` | work order is the domain aggregate; job remains the execution envelope |
| `ExecutionLogEntry` | `JobEvent` | preserve append-only event semantics |
| `FactoryAsset` | `MediaAssetDescriptor` | reuse asset vocabulary where concepts overlap |
| `QAReport` | job result payload or artifact | report is a domain output, not a replacement for job progress |

Implementation guidance:

- do not force the factory entity layer to mirror database tables one-to-one
- do not make the work order pretend to be a job request
- use adapters to translate between domain entities and runtime/persistence models

## Positive, Negative, and Edge-Case Test Matrix

Phase 1 needs more than “types compile”. These tests should exist before Phase 2 begins.

### ProductBrief

Positive cases:

- valid brief with one asset kind
- valid brief with multiple asset kinds and multiple QA criteria
- valid brief with optional audience, tone, and channels omitted

Negative cases:

- empty title
- empty topic
- duplicate asset kinds
- duplicate QA criteria
- `maxAssetCount` equal to `0` or negative

Edge cases:

- maximum supported asset count
- brief requesting all supported asset kinds
- brief sourced from anonymous or system-initiated flows if supported later

### ProductionDAG

Positive cases:

- minimal DAG with research, draft, composition, QA, release
- multi-asset DAG with valid dependency fan-out

Negative cases:

- duplicate stage keys
- missing dependency target
- self-dependency
- cyclic dependencies

Edge cases:

- single-stage DAG if used for refinement mode
- DAG version increment after regeneration
- all asset generation stages marked parallelizable but release not parallelizable

### StageRunRecord

Positive cases:

- pending stage with no timestamps
- running stage with `startedAt`
- succeeded stage with `resultRef`

Negative cases:

- pending stage with `completedAt`
- succeeded stage without `startedAt`
- failed stage with `attemptCount` of `0`

Edge cases:

- paused stage resumed later
- canceled stage after partial execution
- skipped stage due to branch or user override

### WorkOrder

Positive cases:

- new planned work order with empty stage runs
- running work order with active stage
- paused work order with valid `pausedState`
- succeeded work order with terminal timestamps

Negative cases:

- paused work order without `pausedState`
- non-paused work order with `pausedState`
- stage run referencing missing stage key
- `briefId` mismatching DAG brief ID

Edge cases:

- revision `1` with no previous work orders
- later revision with lineage chain
- canceled work order after some successful stage runs

### ResearchPacket

Positive cases:

- research packet with multiple sources and claims
- research packet with hybrid search engine label

Negative cases:

- confidence outside `[0, 1]`
- claim references unknown source
- relevance score outside `[0, 1]`

Edge cases:

- zero claims but valid summary explaining insufficient evidence
- contradictory claims captured explicitly

### Draft

Positive cases:

- draft with heading and paragraph sections
- draft linked to research packet

Negative cases:

- empty title
- duplicate section IDs
- duplicate order values

Edge cases:

- single-section draft
- draft revision after QA remediation

### FactoryAsset

Positive cases:

- generated media asset with provenance
- revised asset referencing previous asset
- asset with optional media metadata omitted when not yet materialized

Negative cases:

- failed QA status with empty findings when an error is expected
- asset referencing itself as previous asset
- revision less than `1`

Edge cases:

- uploaded replacement asset
- derived asset from multiple sources
- asset with warning-only findings but passing status policy defined explicitly

### Composition

Positive cases:

- composition with mixed text and media sections
- all media sections resolve to embedded assets

Negative cases:

- duplicate section IDs
- duplicate order values
- media section references missing asset ID

Edge cases:

- text-only composition
- single-section composition
- composition revision after asset replacement

### QAReport

Positive cases:

- passing report with zero findings
- failed report with asset and page findings
- report requiring user decision

Negative cases:

- `totalFindings` mismatch
- overlapping passed and failed criteria
- passed asset report with error-level findings

Edge cases:

- all findings auto-resolvable
- page-level findings only with no asset findings

### Release

Positive cases:

- release with one published destination
- release with multiple destinations and social posts

Negative cases:

- duplicate destination channels
- invalid version format if validation is enforced
- `postUrl` without publication timestamp

Edge cases:

- release with archive only and deferred publishing
- release metrics omitted entirely

### Outcome

Positive cases:

- outcome with sparse metrics
- outcome with engagement metrics for multiple channels

Negative cases:

- negative metric values
- missing release reference

Edge cases:

- outcome recorded long after release
- outcome with notes but no metrics beyond a single observed count

## Recommended Helper Functions

Phase 1 may include pure helpers like:

- `isValidProductBrief(...)`
- `validateProductionDag(...)`
- `getTerminalStageRuns(...)`
- `getActiveStageRun(...)`
- `deriveWorkOrderProgress(...)`
- `hasBlockingQaFindings(...)`

Do not add helpers without a real near-term consumer in Phase 2 or Phase 3.

## Files to Create

| File | Purpose |
| --- | --- |
| `src/core/entities/factory-constants.ts` | canonical factory constants and union types |
| `src/core/entities/product-brief.ts` | intent model |
| `src/core/entities/production-stage.ts` | plan node model |
| `src/core/entities/production-dag.ts` | immutable execution plan |
| `src/core/entities/stage-run-record.ts` | stage runtime state |
| `src/core/entities/work-order.ts` | runtime aggregate root |
| `src/core/entities/research-packet.ts` | research output |
| `src/core/entities/draft.ts` | structured narrative output |
| `src/core/entities/factory-asset.ts` | asset output |
| `src/core/entities/composition.ts` | assembled page output |
| `src/core/entities/qa-report.ts` | QA output |
| `src/core/entities/release.ts` | release output |
| `src/core/entities/outcome.ts` | post-release observation output |
| `tests/factory/types.test.ts` | invariant and helper tests |

## Anti-Dead-Code Checklist

Before adding any field or helper, ask:

1. Which later phase consumes this?
2. Is this domain state, or adapter state?
3. Can this be derived instead of stored?
4. Does an existing entity already encode this concept?
5. Will this serialize cleanly across jobs, storage, and UI payloads?

If the answer is unclear, do not add it in Phase 1.

## Next Steps

1. Begin Phase 2 with a repository contract that preserves the JSON-safe entity boundaries established here.
2. Translate these entities into storage adapters rather than mutating the domain contracts.
3. Keep orchestration behavior in Phase 3 services instead of adding it to entity files.
