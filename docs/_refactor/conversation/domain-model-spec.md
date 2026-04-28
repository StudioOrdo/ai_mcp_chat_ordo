# Domain Model Specification

## Objective

Define the canonical domain models for the greenfield conversation system. These
are high-level contracts, not final TypeScript implementations.

## Contract Rules

1. Domain models own state; message parts render state.
2. Every model must have clear ownership and lifecycle rules.
3. Every model must support anonymous-to-authenticated migration.
4. Every model must be projectable into UI without reverse-engineering
   transcript internals.
5. Every model must be safe to rebuild from durable source events when possible.

## Workspace Snapshot

### Workspace Purpose

`WorkspaceSnapshot` is the canonical current-state model for a customer
relationship.

### Workspace Contract

```typescript
export interface WorkspaceSnapshot {
  id: string;
  userId: string;
  conversationId: string;
  status: "active" | "archived" | "deleted";
  title: string;
  currentObjective: string | null;
  recommendedNextStep: string | null;
  openLoops: readonly WorkspaceOpenLoop[];
  activeJobRefs: readonly WorkspaceJobRef[];
  importantAssetRefs: readonly WorkspaceAssetRef[];
  latestMemoryRef: string | null;
  latestPromptBindingRef: string | null;
  updatedAt: string;
}
```

### Workspace Ownership

Owned by a workspace projection service.

Inputs include:

- conversation events
- user messages
- assistant outputs
- job events
- asset catalog changes
- relationship memory changes

### Workspace Non-Goals

It must not store full transcript content.
It must not duplicate full job payloads.
It must not duplicate full asset metadata.

## Relationship Memory

### Memory Purpose

`RelationshipMemory` is the canonical continuity model.

### Memory Contract

```typescript
export interface RelationshipMemoryRecord {
  id: string;
  userId: string;
  conversationId: string;
  memoryType:
    | "goal"
    | "preference"
    | "decision"
    | "commitment"
    | "open_question"
    | "milestone"
    | "asset_context";
  summary: string;
  evidenceRefs: readonly MemoryEvidenceRef[];
  status: "active" | "resolved" | "superseded" | "retracted";
  confidence: number;
  createdAt: string;
  updatedAt: string;
}
```

### Memory Ownership

Owned by a memory projection service.

Inputs include transcript turns, summaries, job completions, asset creation,
and explicit user corrections.

### Memory Non-Goals

It is not an embedding row.
It is not a summary message.
It is not a hidden prompt string.

## Job Ledger

### Job Ledger Purpose

`JobLedger` is the canonical operational model.

The existing job tables already approximate this and should be evolved rather
than discarded.

### Job Ledger Contract

```typescript
export interface WorkspaceJob {
  id: string;
  userId: string | null;
  conversationId: string;
  toolName: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "dead_letter";
  requestKey: string | null;
  materializationKey: string | null;
  replayedFromJobId: string | null;
  supersededByJobId: string | null;
  outputAssetRefs: readonly string[];
  createdAt: string;
  updatedAt: string;
}
```

### Job Ledger Ownership

Owned by the job system.

It should remain append-event-backed.

### Job Ledger Non-Goals

It must not be reconstructed from message parts.

It must not depend on browser session storage.

## Asset Catalog Entry

### Asset Catalog Purpose

`AssetCatalogEntry` is the canonical durable output model.

### Asset Catalog Contract

```typescript
export interface AssetCatalogEntry {
  id: string;
  userId: string;
  conversationId: string | null;
  kind: "audio" | "chart" | "graph" | "image" | "video" | "subtitle" | "waveform" | "document";
  status: "pending" | "ready" | "failed" | "superseded" | "deleted";
  source: "uploaded" | "generated" | "derived";
  retentionClass: "ephemeral" | "conversation" | "durable";
  contentHash: string;
  materializationKey: string | null;
  derivativeOfAssetId: string | null;
  producedByJobId: string | null;
  canonicalForPurpose: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Asset Catalog Ownership

Owned by the asset catalog.

User-file storage can remain the binary storage backend.

### Asset Catalog Non-Goals

It must not rely on scanning tool results for lineage.
It must not hide lineage only in JSON metadata.

## Transcript Message

### Transcript Purpose

The transcript is the readable conversation history.

### Rules

- It may render links to jobs, assets, memory, and prompt bindings.
- It may contain rich message parts for display.
- It may be exported.
- It may be searched for forensic recall.

### Transcript Non-Goals

The transcript must not own active work, reusable asset truth, relationship
memory truth, or restore behavior.

## Prompt Binding

### Prompt Binding Purpose

`PromptBinding` records governed context that shaped an important decision,
memory update, or output.

### Prompt Binding Contract

```typescript
export interface PromptBinding {
  id: string;
  userId: string;
  conversationId: string;
  surface: "chat_stream" | "direct_turn" | "job_execution" | "memory_projection";
  effectiveHash: string;
  slotRefs: readonly PromptSlotVersionRef[];
  overlayRefs: readonly PromptOverlayRef[];
  createdAt: string;
}
```

### Prompt Binding Ownership

Owned by prompt runtime or a prompt-binding recorder.

### Prompt Binding Non-Goals

It must not store unnecessary full prompt text for every event unless audit
policy explicitly requires it.

## Identity Migration Event

### Identity Migration Purpose

Identity migration records anonymous-to-authenticated transfer and repair.

### Identity Migration Contract

```typescript
export interface IdentityMigrationEvent {
  id: string;
  sourceUserId: string;
  targetUserId: string;
  migratedConversationIds: readonly string[];
  migratedJobIds: readonly string[];
  migratedAssetIds: readonly string[];
  repairedMemoryRefs: readonly string[];
  repairedSearchSourceIds: readonly string[];
  status: "started" | "completed" | "failed" | "partially_repaired";
  createdAt: string;
  completedAt: string | null;
}
```

### Identity Migration Ownership

Owned by identity migration service.

### Identity Migration Non-Goals

It must not be a hidden side effect of login.

## Definition Of Done

This domain model is ready when implementation can answer:

- where current relationship state lives
- where active work lives
- where completed outputs live
- where memory lives
- where prompt continuity lives
- how all of it migrates from anonymous to authenticated ownership
