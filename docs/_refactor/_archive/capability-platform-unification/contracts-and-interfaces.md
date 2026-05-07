# Contracts and Interfaces

## Objective

Define the canonical contracts that implementation should converge on. These are
not final TypeScript files, but they are concrete enough to guide production
code, reviews, and tests.

## Contract Design Rules

1. Contracts should encode platform concepts, not local implementation seams.
2. Contracts should be additive-friendly and projection-friendly.
3. Contracts should make unsupported states explicit.
4. Contracts should prefer explainability over magic defaults.

## Capability Runtime Contract

```typescript
export interface CapabilityRuntime<Input = unknown, Output = unknown> {
  capabilityName: string;
  family: string;
  roles: readonly string[] | "ALL";
  input: CapabilityInputContract<Input>;
  output: CapabilityOutputContract<Output>;
  presentation: CapabilityPresentationContract;
  execution: CapabilityExecutionContract;
  revision: CapabilityRevisionContract;
  grounding: CapabilityGroundingContract;
}
```

Responsibilities:

- expose the full runtime-facing shape of a capability
- be derived from canonical metadata
- be consumed by registry, planner, and agent-facing surfaces

### Capability Input Contract

```typescript
export interface CapabilityInputContract<TInput> {
  parse(raw: Record<string, unknown>): TInput;
  describe(): Record<string, unknown>;
}
```

Why:

- parsing and schema description should remain aligned
- registry and agent surfaces should consume the same contract

### Capability Execution Contract

```typescript
export interface CapabilityExecutionContract {
  mode: "sync" | "deferred" | "hybrid";
  preferredTargets: readonly ExecutionTargetKind[];
  fallbackTargets: readonly ExecutionTargetKind[];
  supportsStreaming: boolean;
  explainPlan(context: ExecutionPlanningContext): CapabilityExecutionPlan;
}
```

Why:

- execution planning must be explainable
- preferred and fallback targets should be explicit

## Execution Plan Contract

```typescript
export interface CapabilityExecutionPlan {
  capabilityName: string;
  runnable: boolean;
  primaryTarget: CapabilityExecutionTarget | null;
  fallbackTargets: readonly CapabilityExecutionTarget[];
  blockReason?: string;
  rationale: readonly string[];
}
```

Why:

- the planner must return a diagnostic object, not only a target
- this object becomes inspectable in tooling and tests

## Knowledge Access Contract

```typescript
export interface KnowledgeAccessRequest {
  query: string;
  role: string;
  maxResults?: number;
  prefetchPolicy?: "never" | "when_strong_match" | "always";
}

export interface KnowledgeAccessResponse {
  query: string;
  retrievalQuality: "strong" | "partial" | "none";
  citations: readonly CitationRecord[];
  evidence: readonly KnowledgeEvidenceRecord[];
  prefetchedSections: readonly PrefetchedSection[];
  followUp: "refine_query" | "cite_results" | "inspect_prefetched_sections";
}
```

Why:

- the response must be usable by both agents and UI surfaces
- grounding quality and follow-up guidance should be first-class

## Discovery Search Contract

```typescript
export interface DiscoverySearchRequest {
  query: string;
  userId?: string;
  roles: readonly string[];
  maxResults?: number;
}

export interface DiscoverySearchResponse {
  query: string;
  results: readonly DiscoveryResult[];
}
```

Why:

- this stays intentionally simpler than knowledge access
- discovery search should not carry grounding-specific behavior

## Execution Timeline Contract

```typescript
export interface ExecutionTimeline {
  executionId: string;
  executionKind: "tool" | "job" | "work_order" | "chat_turn";
  status: "queued" | "running" | "paused" | "succeeded" | "failed" | "canceled";
  startedAt?: string;
  completedAt?: string;
  activeStepKey?: string | null;
  events: readonly ExecutionTimelineEvent[];
  artifacts: readonly ExecutionArtifactRecord[];
  revision: ExecutionRevisionSummary;
}
```

This becomes the canonical answer to:

- what happened
- what was produced
- what can happen next

### Timeline Event Contract

```typescript
export interface ExecutionTimelineEvent {
  sequence: number;
  timestamp: string;
  phase: string;
  type: "started" | "progress" | "succeeded" | "failed" | "paused" | "resumed" | "canceled";
  label: string;
  details?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}
```

Why:

- current systems already emit this information in different forms
- projection should normalize it without forcing identical storage

## Revision Contract

```typescript
export interface CapabilityRevisionContract {
  supportLevel: "none" | "retry_only" | "resume" | "refine_and_resume";
  supportedActions: readonly RevisionActionType[];
}

export interface RevisionActionRequest {
  executionId: string;
  action: RevisionActionType;
  payload?: Record<string, unknown>;
}

export interface RevisionActionResult {
  accepted: boolean;
  status: "completed" | "queued" | "rejected";
  message: string;
  nextExecutionId?: string;
  timelineRef?: string;
}
```

Why:

- retry-only and full refine/resume systems must fit the same vocabulary
- support-level differences remain explicit

## Agent Facade Contract

```typescript
export interface AgentPlatformFacade {
  discoverCapabilities(input: AgentCapabilityDiscoveryRequest): Promise<AgentCapabilityDiscoveryResponse>;
  searchKnowledge(input: KnowledgeAccessRequest): Promise<KnowledgeAccessResponse>;
  executeCapability(input: AgentCapabilityExecutionRequest): Promise<AgentCapabilityExecutionResponse>;
  inspectExecution(input: AgentExecutionInspectionRequest): Promise<ExecutionTimeline>;
  reviseExecution(input: RevisionActionRequest): Promise<RevisionActionResult>;
}
```

Why:

- gives agents stable platform verbs
- prevents agents from depending on subsystem-specific shapes

## Acceptance Rules For Contracts

Every contract added in implementation should satisfy these questions:

1. Can an agent use this without knowing subsystem internals?
2. Can a UI render meaningful state from this without reconstructing logic?
3. Can execution failures be explained through this shape?
4. Can unsupported behaviors be represented honestly?

If the answer is no, the contract needs revision before code lands.

## Definition of Done

This contract document is ready when:

- the target interfaces are concrete enough to guide implementation
- support-level differences are explicit
- execution and grounding are explainable by contract
- the new contracts reduce subsystem-specific coupling
