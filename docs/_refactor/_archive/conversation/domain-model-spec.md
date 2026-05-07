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
  workflowContextRef: string | null;
  operatorTransitionRef: string | null;
  trustDistributionRef: string | null;
  relatedBusinessRefs: readonly BusinessObjectRef[];
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
- business workflow context changes
- operator transition and trust distribution changes

### Workspace Non-Goals

It must not store full transcript content.
It must not duplicate full job payloads.
It must not duplicate full asset metadata.
It must not duplicate full lead, deal, referral, lifecycle, or notification
payloads.

## Business Workflow Context

### Workflow Context Purpose

`BusinessWorkflowContext` is the canonical business-momentum model around a
conversation.

It exists so the app can serve solopreneurs and small businesses like a compact
enterprise operating layer: CRM context, work tracking, onboarding, assets,
notifications, and next actions without requiring separate enterprise tools.

### Workflow Context Contract

```typescript
export interface BusinessWorkflowContext {
  id: string;
  userId: string;
  conversationId: string;
  primaryMode: "revenue" | "service" | "training" | "operations" | "setup" | "general";
  origin: WorkflowOriginContext | null;
  relatedRefs: readonly BusinessObjectRef[];
  lifecycleRefs: readonly LifecycleProgressRef[];
  notificationRefs: readonly WorkflowNotificationRef[];
  interruptedTurnRefs: readonly InterruptedTurnRef[];
  healthRefs: readonly WorkflowHealthRef[];
  recommendedAction: WorkflowRecommendedAction | null;
  updatedAt: string;
}
```

### Workflow Context Ownership

Owned by a workflow context projection service.

Inputs include task-origin handoffs, current-page memento, lifecycle and coach
events, failed-send recovery, job notifications, health diagnostics, and related
business entities such as leads, deals, consultations, referrals, training
paths, and journal items.

### Workflow Context Non-Goals

It must not duplicate full business-object payloads.
It must not become an external CRM clone.
It must not depend on external SaaS integrations to be valuable.
It must not use transcript scanning as its source of truth.

## Operator Transition Profile

### Operator Transition Purpose

`OperatorTransitionProfile` is the canonical first-run and return-user
activation model for people converting expertise, work history, relationships,
or an existing business into useful AI-assisted operations.

It exists because the product is not only for businesses that already know what
they are doing. It is also for people who need help becoming economically
effective.

### Operator Transition Contract

```typescript
export interface OperatorTransitionProfile {
  id: string;
  userId: string;
  conversationId: string | null;
  status:
    | "not_started"
    | "discovering_offer"
    | "building_first_motion"
    | "sharing"
    | "following_up"
    | "operating";
  operatorMode:
    | "existing_business"
    | "new_solo_offer"
    | "career_transition"
    | "community_affiliate"
    | "internal_admin";
  expertiseRefs: readonly OperatorExpertiseRef[];
  audienceRefs: readonly OperatorAudienceRef[];
  offerRefs: readonly OperatorOfferRef[];
  trustDistributionRef: string | null;
  recommendedAction: OperatorTransitionAction | null;
  updatedAt: string;
}
```

### Operator Transition Ownership

Owned by an activation projection service.

Inputs include install completion, first-run conversation, lifecycle and coach
events, profile updates, referral enablement, first offer creation, first share
asset creation, and trust-distribution milestones.

### Operator Transition Non-Goals

It must not become a personality profile.
It must not duplicate profile, referral, lead, or deal payloads.
It must not require a user to have an existing business before the app is
useful.
It must not hide setup blockers that prevent real work.

## Trust Distribution Context

### Trust Distribution Purpose

`TrustDistributionContext` is the canonical model for turning human trust into
trackable distribution through QR codes, referral links, intro scripts,
physical-card assets, and downstream referral milestones.

### Trust Distribution Contract

```typescript
export interface TrustDistributionContext {
  id: string;
  userId: string;
  conversationId: string | null;
  referralCode: string | null;
  referralUrl: string | null;
  qrCodeUrl: string | null;
  physicalShareAssets: readonly TrustShareAssetRef[];
  introScripts: readonly TrustIntroScript[];
  activeCampaignRefs: readonly TrustCampaignRef[];
  recentReferralRefs: readonly BusinessObjectRef[];
  recommendedAction: OperatorTransitionAction | null;
  updatedAt: string;
}
```

### Trust Distribution Ownership

Owned by a trust-distribution projection service.

Inputs include user profile referral fields, affiliate enablement, QR/link
generation, signed referral visits, referral ledger events, campaign assets,
lead/deal/training milestones, admin credit review, and notification feed
events.

### Trust Distribution Non-Goals

It must not automate spam or generic cold outreach.
It must not replace the referral ledger.
It must not automatically approve payouts.
It must not store full campaign, lead, deal, or referral payloads.

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
