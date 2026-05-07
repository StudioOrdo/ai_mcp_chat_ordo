# Phase 5 Implementation Spec — UX And Agent Simplification

## Objective

Turn Phase 5 of the platform roadmap into a code-facing implementation plan
that starts from the completed Phase 1 through Phase 4 seams and introduces
one coherent operator and agent interaction model.

This phase should not replace the proven capability runtime, knowledge access,
execution timeline, or revision runtime owners. It should compose those
platform seams into smaller, more stable verbs that remove direct dependence on
subsystem-specific routes, hooks, and registry wiring.

The initial Phase 5 slice should be able to answer:

- what can the agent ask the platform to do through one stable facade?
- how does the UI inspect execution and revision without hopping across route
  shapes?
- where should capability discovery, grounded retrieval, execution,
  inspection, and revision composition live?
- what compatibility adapters remain necessary while the old chat/operator
  entry points are migrated?

## Phase 4 Handoff

Phase 4 introduced one canonical revision inspection seam beside the existing
execution and knowledge seams.

The handoff assumptions now in place are:

- `CapabilityRuntime` is the canonical capability projection seam
- `KnowledgeAccessService` is the canonical grounded retrieval seam
- `DiscoverySearchService` is the canonical discovery seam
- `ExecutionTimelineReader` is the canonical execution inspection seam
- `RevisionReader` is the canonical revision inspection seam
- the main product still composes these seams through local chat hooks,
  tool-composition roots, and route-specific adapters rather than one explicit
  Phase 5 facade

Phase 5 should preserve the same migration pattern used by the earlier phases:

- define one canonical facade and composition boundary first
- project current production-proven behavior into that facade
- keep existing routes and hooks as compatibility adapters during migration
- avoid inventing new business logic inside the facade layer

## Current Code Grounding

The platform seams exist, but the user and agent experience is still composed
from separate local owners.

Current agent/chat composition owners before implementation:

- `src/lib/chat/stream-route-handler.ts` directly assembles prompt runtime,
  conversation services, request-scoped tool selection, and tool execution
  around `getToolComposition()` instead of calling one platform facade
- `src/lib/chat/tool-composition-root.ts` still exposes the direct registry /
  executor composition root for chat execution
- `src/lib/chat/conversation-root.ts` still owns route-scoped conversation
  service composition rather than a narrower Phase 5 platform surface
- `src/hooks/useGlobalChat.tsx` still composes `useChatSend()`,
  `useChatJobEvents()`, and `useBrowserCapabilityRuntime()` as separate
  client responsibilities

Current operator inspection owners before implementation:

- `src/app/api/jobs/route.ts` lists jobs through `ExecutionTimelineReader`
  snapshots
- `src/app/api/chat/jobs/route.ts` lists conversation jobs through a separate
  route and result shape
- `src/app/api/jobs/[jobId]/events/route.ts` exposes execution-history detail
  through a dedicated history route
- `src/app/api/jobs/[jobId]/route.ts` and `src/app/api/chat/jobs/[jobId]/route.ts`
  expose revision-aware job detail
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
  exposes advanced revision-aware factory detail
- `src/app/admin/jobs/page.tsx` still describes the operator model in job-local
  verbs like browse, inspect, cancel, and retry, rather than one broader
  platform interaction model

Current discovery / grounding owners before implementation:

- `src/lib/search/global-search.ts` instantiates `DiscoverySearchService`
  directly for user-facing discovery search
- `src/lib/corpus-library.ts` wraps `KnowledgeAccessService` and legacy corpus
  interactors as a compatibility facade for grounded retrieval and library
  access

Current platform gap before implementation:

- there is no `src/core/platform/facade/` module or equivalent canonical
  Phase 5 owner in the current codebase
- there is no implementation of the `AgentPlatformFacade` contract described
  in `contracts-and-interfaces.md`
- the product still exposes separate composition points for discovery,
  grounding, execution, execution history, and revision rather than one
  coherent Phase 5 interaction boundary

## Current Problem Statement

Today the platform seams are stronger, but the product experience is still
assembled from multiple local entry points.

The current split is:

1. agents still depend on chat-stream composition and tool-registry wiring
   rather than one stable platform facade
2. operators still traverse separate list/detail/history/revision surfaces
   depending on whether the subject is a deferred job, a chat job, or a
   factory work order
3. discovery and grounding are correctly separated at the service layer, but
   not yet composed into one smaller high-level interaction model
4. the browser chat shell still coordinates multiple runtime hooks directly,
   which keeps the client mental model coupled to subsystem boundaries

This means the roadmap's Phase 5 claims are still aspirational. The codebase
has the canonical seams Phase 5 should build on, but it does not yet expose one
small facade or one coherent operator interaction surface over them.

## Scope

### In Scope

- define a canonical Phase 5 facade for agents over capability, knowledge,
  execution, and revision seams
- define the Phase 5 composition boundary for operator-facing interaction
  simplification
- identify the compatibility adapters that should remain temporarily for chat,
  job, and admin routes
- reduce direct subsystem exposure in the main product interaction paths where
  practical
- add focused parity and migration tests for the new facade and simplified
  adapters

### Out of Scope

- replacing `CapabilityRuntime`, `KnowledgeAccessService`,
  `ExecutionTimelineReader`, or `RevisionReader`
- rewriting the whole chat runtime in one slice
- replacing the factory execution engine or the deferred job system
- collapsing all route surfaces into one HTTP endpoint in the first slice
- broad UI redesign unrelated to platform simplification

## Canonical Files To Touch

### Existing Files

- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/core/platform/discovery-search/DiscoverySearchService.ts`
- `src/core/platform/execution/ExecutionTimelineReader.ts`
- `src/core/platform/revision/RevisionReader.ts`
- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/tool-composition-root.ts`
- `src/lib/chat/conversation-root.ts`
- `src/hooks/useGlobalChat.tsx`
- `src/app/api/jobs/route.ts`
- `src/app/api/chat/jobs/route.ts`
- `src/app/api/jobs/[jobId]/events/route.ts`
- `src/app/api/jobs/[jobId]/route.ts`
- `src/app/api/chat/jobs/[jobId]/route.ts`
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
- `src/lib/search/global-search.ts`
- `src/lib/corpus-library.ts`

### New Files

- `src/core/platform/facade/AgentPlatformFacade.ts`
- `src/core/platform/facade/AgentPlatformFacade.test.ts`
- `src/core/platform/facade/PlatformInteractionFacade.ts`
- `src/core/platform/facade/PlatformInteractionFacade.test.ts`

The implementation landed with the planned ownership boundary plus two small
composition roots:

- `src/lib/platform/agent-platform-facade-root.ts`
- `src/hooks/chat/usePlatformChatInteraction.ts`

## Target Phase 5 Shape

Phase 5 should introduce a smaller interaction model that answers these
questions consistently:

1. how does the agent discover what can run?
2. how does the agent ground on knowledge?
3. how does the agent execute a capability?
4. how does the product inspect current execution state?
5. how does the product revise or continue work?

That model should be exposed through one platform facade for agents and one
clear composition boundary for the main operator/chat experience.

This composition must be derived from the current platform seams, not invented
as a new business-logic owner.

## Grounded Phase 5 Assumptions

The roadmap is directionally right, but implementation should start from these
grounded assumptions:

- `CapabilityRuntime`, `KnowledgeAccessService`, `DiscoverySearchService`,
  `ExecutionTimelineReader`, and `RevisionReader` are already the correct
  narrow platform seams Phase 5 should compose
- `stream-route-handler.ts` is the most important current agent/chat execution
  integration point and should become an adapter over the Phase 5 facade
  rather than remaining a direct tool-composition client forever
- `useGlobalChat.tsx` is the clearest current client orchestration seam and
  should become an adapter over a smaller interaction model rather than
  remaining a direct coordinator of multiple runtime hooks forever
- current operator routes should remain temporary transport adapters while the
  interaction model is simplified; the first slice should not delete stable
  route surfaces without parity proof
- Phase 5 should compose existing seams, not re-encode capability selection,
  execution, inspection, or revision policy locally
- unsupported or still-split interaction paths must be explicit in code and
  docs during migration

## Initial Facade Rules

### Agent Facade

The first Phase 5 slice should introduce one explicit agent-facing platform
facade.

Initial inputs:

- `CapabilityRuntime`
- `KnowledgeAccessService`
- `ExecutionTimelineReader`
- `RevisionReader`
- existing execution entry points that already run proven production behavior

Projection rules:

- expose stable verbs for discover, ground, execute, inspect, and revise
- keep business logic in the existing platform seams and runtime owners
- do not make the facade a new logic sink for prompt assembly or routing

### Operator Interaction Simplification

The first Phase 5 slice should reduce operator-facing subsystem hopping.

Initial inputs:

- current jobs list/detail/history routes
- current factory revision route
- current chat runtime hooks and conversation session orchestration

Projection rules:

- define one composition boundary that can assemble execution and revision
  state without forcing the UI to know raw subsystem seams
- preserve current mutation and authorization owners during migration
- prefer adapter reduction over endpoint consolidation in the first slice

### Discovery And Grounding Composition

Discovery and grounding should remain separate concerns, but Phase 5 should
make their composition smaller at the call-site level.

Initial rule:

- keep `DiscoverySearchService` and `KnowledgeAccessService` as separate

## Implementation Closeout

Phase 5 is now implemented in the current codebase.

Delivered platform facade and composition roots:

- `src/core/platform/facade/AgentPlatformFacade.ts` now exposes the stable
  Phase 5 verbs over the existing platform seams
- `src/core/platform/facade/PlatformInteractionFacade.ts` now projects one
  unified interaction model for job and factory inspection flows
- `src/lib/platform/agent-platform-facade-root.ts` now composes the production
  agent facade and current revision mutation runtime over the existing job and
  factory owners
- `src/lib/platform/content-platform-root.ts` now centralizes default discovery
  and grounded-knowledge service composition for user-facing wrappers that do
  not need bespoke executors
- `src/adapters/RepositoryFactory.ts` now exposes a cached
  `getPlatformInteractionFacade()` adapter for route-level transport surfaces

Delivered chat and client simplification adapters:

- `src/lib/chat/stream-route-handler.ts` now consumes the agent facade
  execution surface instead of calling the raw tool-composition root directly
- `src/hooks/chat/usePlatformChatInteraction.ts` now composes send,
  deferred-job hydration, and browser capability runtime into one smaller
  client interaction seam
- `src/hooks/useGlobalChat.tsx` now adapts over that smaller interaction seam
  rather than coordinating those hooks directly

Delivered operator interaction simplification:

- `src/app/api/jobs/route.ts` and `src/app/api/chat/jobs/route.ts` now expose
  `interactions` beside the legacy snapshot list payloads
- `src/app/api/jobs/[jobId]/events/route.ts` now returns canonical revision and
  unified interaction payloads beside event history
- `src/app/api/jobs/[jobId]/route.ts` and
  `src/app/api/chat/jobs/[jobId]/route.ts` now use the unified interaction
  facade for inspection and the agent facade for revision actions
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts` now
  uses the unified interaction facade for inspection and the same agent facade
  revision surface for pause, refine, and resume

Compatibility adapters intentionally retained:

- the transport routes remain separate HTTP adapters for member, chat, and
  admin surfaces
- `getToolComposition()` remains the execution owner behind the agent facade
  root rather than being deleted in the same slice
- `src/lib/corpus-library.ts` remains the compatibility facade for legacy
  corpus callers and still owns its decorated search/index executors while
  routing grounded retrieval through `KnowledgeAccessService`
- factory revision control and manual job replay remain the mutation owners;
  Phase 5 composes them rather than replacing them

Validation status:

- focused facade, route, and hook validation passed with `npx vitest run`
  across the Phase 5 facade tests, job list/detail/history routes, admin
  factory revision route, and `useGlobalChat` coverage
  siblings
- do not merge discovery and grounding into one data service
- do let the Phase 5 facade expose a smaller high-level surface for callers
  that should not need to know both seams directly

## Implementation Slices

### Slice 1: Introduce AgentPlatformFacade

Tasks:

- add a canonical agent-facing facade contract in code
- compose capability discovery, grounded retrieval, execution, execution
  inspection, and revision over the existing platform seams
- do not yet migrate all callers

Acceptance criteria:

- one importable agent-facing facade exists in code
- the facade exposes stable verbs that match the implementation package
  contracts
- no existing production seam is deleted

### Slice 2: Add PlatformInteractionFacade For Product Composition

Tasks:

- define a product-facing composition boundary for execution / revision
  interaction simplification
- make jobs/factory/chat surfaces project into a smaller interaction model
- keep existing transports as adapters during migration

Acceptance criteria:

- one product-facing composition seam exists for Phase 5 interaction assembly
- existing routes can adapt over it without changing mutation owners
- subsystem hopping is reduced at the composition layer

### Slice 3: Migrate Chat Runtime Composition

Tasks:

- make `stream-route-handler.ts` consume the new facade / composition seam
  where practical
- reduce direct dependency on `getToolComposition()` and other low-level
  owners in the highest-level chat execution path
- keep current prompt-runtime and conversation-runtime behavior stable

Acceptance criteria:

- the main chat execution path depends on a smaller Phase 5 surface
- current tool execution behavior remains stable during migration
- the new facade does not become a prompt-policy logic sink

### Slice 4: Migrate Operator Inspection Composition

Tasks:

- reduce route-level composition differences across job list/detail/history and
  factory revision inspection
- expose one smaller interaction model for operator-facing UI surfaces where
  practical
- preserve current route compatibility during migration

Acceptance criteria:

- operator-facing inspection depends on a materially more uniform composition
  surface
- jobs and factory inspection no longer feel like separate product models at
  the composition layer
- authorization and mutation ownership remain stable

### Slice 5: Migrate Client Interaction Assembly

Tasks:

- reduce direct client coordination across `useChatSend()`,
  `useChatJobEvents()`, and `useBrowserCapabilityRuntime()`
- define the minimum new client-side composition surface needed for a coherent
  interaction model
- preserve current chat runtime behavior while reducing subsystem exposure

Acceptance criteria:

- the chat shell depends on a smaller high-level interaction model
- current streaming, deferred job, and browser runtime behavior remain stable
- Phase 5 improves the mental model without hiding real runtime states

### Slice 6: Add Contract And Migration Parity Coverage

Tasks:

- add focused facade tests for discover, ground, execute, inspect, and revise
  composition
- add focused adapter tests for migrated chat and operator integration points
- document the intentionally remaining split surfaces, if any

Acceptance criteria:

- Phase 5 simplification has explicit focused gates
- migration from direct subsystem composition is parity-tested before old
  adapters are removed
- the codebase, not only the roadmap, satisfies the definition of done below

## Ordered Implementation Checklist

This checklist turns the slices above into the concrete file-by-file work still
required to reach 100% completion.

### Step 0: Establish The Canonical Phase 5 Facade Boundary

Current gap:

- no code exists yet under `src/core/platform/facade/`
- the `AgentPlatformFacade` contract exists in package docs only

Files to add:

- `src/core/platform/facade/AgentPlatformFacade.ts`
- `src/core/platform/facade/PlatformInteractionFacade.ts`

Required work:

- define one explicit agent-facing facade over the existing platform seams
- define one explicit product-facing interaction composition boundary

Must be true before moving on:

- the codebase has one importable Phase 5 facade boundary
- the facade layer is composition-only rather than a new logic sink

### Step 1: Compose Capability, Knowledge, Execution, And Revision Verbs

Current gap:

- callers still depend directly on service-specific seams and tool-registry
  composition roots
- there is no stable code owner for discover / ground / execute / inspect /
  revise as one set of verbs

Files to add or update:

- `src/core/platform/facade/AgentPlatformFacade.ts`
- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/core/platform/discovery-search/DiscoverySearchService.ts`
- `src/core/platform/execution/ExecutionTimelineReader.ts`
- `src/core/platform/revision/RevisionReader.ts`

Required work:

- compose the existing seams into one stable facade contract
- keep canonical behavior in the current seam owners
- avoid moving policy into the facade layer

Must be true before moving on:

- one stable agent-facing facade exists in code
- discover / ground / execute / inspect / revise can be invoked without
  knowing subsystem internals

### Step 2: Migrate The Main Chat Execution Path

Current gap:

- `stream-route-handler.ts` still depends directly on `getToolComposition()`
  and local execution wiring
- the highest-level chat execution path still exposes subsystem structure

Files to add or update:

- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/tool-composition-root.ts`
- `src/lib/chat/conversation-root.ts`
- facade tests for the migrated slice

Required work:

- make the main chat execution entry point consume the Phase 5 facade where
  practical
- reduce direct dependency on registry/executor composition details in the
  highest-level path

Must be true before moving on:

- chat execution depends on a smaller platform surface
- current tool execution behavior remains stable during migration

### Step 3: Migrate Operator Inspection Composition

Current gap:

- operator-facing inspection still depends on separate job list/detail/history
  and factory revision route composition
- route shapes still reflect subsystem ownership more than one interaction
  model

Files to add or update:

- `src/core/platform/facade/PlatformInteractionFacade.ts`
- `src/app/api/jobs/route.ts`
- `src/app/api/chat/jobs/route.ts`
- `src/app/api/jobs/[jobId]/events/route.ts`
- `src/app/api/jobs/[jobId]/route.ts`
- `src/app/api/chat/jobs/[jobId]/route.ts`
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`
- `src/app/admin/jobs/page.tsx`

Required work:

- reduce route-level composition differences over execution and revision seams
- expose one smaller interaction model for operator-facing surfaces where
  practical

Must be true before moving on:

- operator-facing inspection is materially more uniform
- subsystem transport boundaries stop acting like separate product models

### Step 4: Migrate Client Interaction Assembly

Current gap:

- `useGlobalChat.tsx` still coordinates multiple runtime hooks directly
- browser/runtime/deferred-job composition still leaks into the client shell

Files to add or update:

- `src/hooks/useGlobalChat.tsx`
- `src/hooks/chat/useChatSend.ts`
- `src/hooks/chat/useChatJobEvents.ts`
- `src/hooks/chat/useBrowserCapabilityRuntime.ts`
- client interaction tests for the touched slice

Required work:

- define a smaller client composition surface for the chat shell
- preserve current stream, deferred-job, and browser-runtime behavior

Must be true before moving on:

- the client shell depends on a smaller interaction model
- Phase 5 reduces subsystem exposure without hiding runtime truth

### Step 5: Close Parity And Regression Gates Before Claiming Completion

Current gap:

- no Phase 5 facade tests exist yet
- parity between direct subsystem composition and the future facade layer is
  still unproven

Files to add or update:

- `src/core/platform/facade/AgentPlatformFacade.test.ts`
- `src/core/platform/facade/PlatformInteractionFacade.test.ts`
- migrated chat route / hook tests
- migrated operator route / page tests

Required work:

- add focused tests for facade composition, operator interaction assembly, and
  migrated chat/runtime integration
- keep current product behavior stable while internals become facade-backed

Exit criteria:

- every Phase 5 slice has executable validation
- adapter parity is proven before direct subsystem composition is deleted
- the codebase, not only the roadmap, satisfies the definition of done below

## Coding Rules For This Phase

1. Do not turn the facade into a new business-logic sink.
2. Do not merge discovery and grounding into one service.
3. Do not replace stable execution or revision runtime owners in the first
   Phase 5 slice.
4. Do not collapse transport boundaries before parity is proven.
5. Prefer composition adapters during migration over broad rewrites.

## Review Checklist

- one canonical Phase 5 facade boundary exists in code
- agents can discover, ground, execute, inspect, and revise without knowing
  subsystem internals
- operator-facing interaction assembly is materially more uniform
- current chat, job, and factory runtime behavior remains stable during
  migration
- remaining split or unsupported interaction paths are explicit in code and
  tests
- migration from direct subsystem composition is parity-tested before old
  adapters are deleted

## Initial Implementation Status

Phase 5 is not yet implemented in the codebase.

Grounded starting point:

- the foundational platform seams now exist for capabilities, knowledge,
  execution, and revision
- chat execution still depends on direct tool-composition and route-local
  orchestration
- operator surfaces still span separate list/detail/history/revision models
- there is still no canonical agent or product interaction facade in code

Recommended first validation commands once implementation starts:

- `npm run test -- src/core/platform/facade/AgentPlatformFacade.test.ts src/core/platform/facade/PlatformInteractionFacade.test.ts`
- `npm run test -- src/lib/chat/stream-route-handler.test.ts src/hooks/chat/useBrowserCapabilityRuntime.test.tsx`
- `npm run test -- 'src/app/api/jobs/[jobId]/route.test.ts' 'src/app/api/chat/jobs/[jobId]/route.test.ts' 'src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.test.ts' src/app/api/jobs/route.test.ts src/app/api/chat/jobs/route.test.ts`
