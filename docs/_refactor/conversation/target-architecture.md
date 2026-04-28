# Target Architecture

## Objective

Define the greenfield target architecture for a conversation system built around
one long-lived customer relationship, durable work, reusable outputs, and
continuous memory.

## Target State

The target state has five canonical surfaces:

1. `WorkspaceSnapshot`
   - current customer relationship state
   - active objective, next best action, open loops, active work, and important
     outputs

2. `JobLedger`
   - durable operational truth for queued, running, failed, completed, retried,
     canceled, and superseded work

3. `AssetCatalog`
   - durable output truth for generated, uploaded, derived, canonical,
     superseded, reusable, and ephemeral assets

4. `RelationshipMemory`
   - structured continuity state for goals, preferences, decisions,
     commitments, milestones, unresolved questions, and meaningful outputs

5. `PromptBinding`
   - governed context record for prompt slot versions, effective prompt hash,
     overlays, and request context that shaped important decisions or outputs

The transcript is not one of the canonical state surfaces.
It is a narrative and audit view over the relationship.

## Layered Architecture

### Layer 1: Durable Domain State

This layer owns canonical persistence.

It includes:

- workspace snapshots
- job requests and job events
- asset catalog entries
- relationship memory records
- prompt bindings
- transcript messages
- identity migration events

Rule:

If a future request depends on it, it belongs in durable domain state, not only
inside message parts or browser storage.

### Layer 2: Projection Services

Projection services derive read models from durable state.

Examples:

- homepage restore model
- active work strip model
- reusable asset shelf model
- relationship summary model
- job detail timeline model
- transcript view model

Rule:

Projection can be rebuilt. Source state cannot be reconstructed from projection
alone.

### Layer 3: Execution And Materialization

Execution remains job-backed for deferred work.

Materialized outputs are indexed separately from the job that created them.

This layer owns:

- job enqueue
- job dedupe
- historical result reuse
- lease recovery
- cancellation
- retry and replay
- output registration in the asset catalog

Rule:

Completed work is not active work. It is materialized history and should be
reused intentionally.

### Layer 4: Relationship Intelligence

This layer turns conversation and execution events into structured memory.

It owns:

- memory extraction
- summary updates
- open-loop tracking
- preference updates
- milestone detection
- retrieval over memory and transcript

Rule:

Embeddings are access infrastructure. They are not the memory model.

### Layer 5: Product Experience

The user-facing model is simple:

1. resume current workspace
2. inspect active work
3. reuse prior assets
4. continue conversation
5. search old history when needed

Rule:

The user should not need to understand transcript internals, tool result shapes,
or execution substrates.

## Restore Architecture

Restore reads:

1. workspace snapshot
2. active job projections
3. asset catalog summary
4. relationship memory summary
5. recent transcript slice
6. prompt binding metadata when needed for replay or explanation

Restore must not:

- scan historical tool calls to decide what should run
- enqueue work because an old tool result lacks a current UI projection
- trust browser session storage over server state
- treat completed jobs as active work

## Execution Architecture

The job ledger remains the operational center.

New work follows this path:

1. normalize request
2. resolve reusable materialization
3. if reusable, return existing asset or variant option
4. if not reusable, create job
5. project job events to active-work surfaces
6. register outputs in asset catalog on success
7. update workspace and relationship memory

## Search Architecture

Search splits into four services:

1. relationship memory retrieval
2. transcript recall
3. corpus grounding
4. product or admin discovery

The services may share embedding and ranking infrastructure, but they must not
share one product contract.

## Browser Runtime Architecture

Browser runtime becomes a target adapter and cache.

It may:

- execute local media work
- upload derived outputs
- display optimistic state
- cache queued/running hints for current tab recovery

It may not:

- own durable job truth
- own asset identity
- own restore decisions
- infer active work from old transcript parts

## Definition Of Done

The target architecture is correct when:

- return-user restore works without transcript replay
- completed media never reruns unless explicitly requested
- active work is fully driven by durable job state
- reusable assets are discoverable without reading old message JSON
- relationship memory is maintained continuously
- prompt drift is explainable through prompt binding
- browser state can be cleared without losing continuity
