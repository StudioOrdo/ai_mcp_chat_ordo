# Jobs, Assets, And Materialization Specification

## Objective

Define how the greenfield system should model active work, completed work,
durable assets, reuse, and materialization.

## Current Finding

The current job ledger is strong. The missing piece is completed-result reuse.

Active dedupe prevents duplicate queued or running jobs. It does not answer the
more important question:

Has this work already succeeded, and can the existing output be reused?

## Target Model

### Job Ledger

The job ledger owns execution lifecycle.

It should continue to support:

- queued
- running
- succeeded
- failed
- canceled
- dead letter
- retry
- replay
- supersession
- lease recovery

### Asset Catalog

The asset catalog owns durable outputs.

Every meaningful output from a job should become an asset catalog entry or a
non-asset materialization record.

### Materialization Registry

The materialization registry answers whether a normalized operation has already
produced a reusable result.

Suggested contract:

```typescript
export interface MaterializationRecord {
  id: string;
  userId: string;
  conversationId: string | null;
  operationName: string;
  materializationKey: string;
  pipelineVersion: string;
  sourceAssetIds: readonly string[];
  outputAssetIds: readonly string[];
  producedByJobId: string;
  status: "ready" | "superseded" | "invalidated";
  createdAt: string;
}
```

## Materialization Key Rules

A materialization key should be deterministic.

It should include:

- operation name
- normalized request payload
- canonical source asset IDs
- relevant prompt or model version when output quality depends on it
- media pipeline version
- role or policy scope when relevant

It should not include:

- transient job ID
- browser runtime ID
- raw message ID unless the message is the actual source artifact
- timestamps

## Enqueue Decision

Before creating a new expensive job:

1. parse and normalize the request
2. resolve canonical source assets
3. compute materialization key
4. check active jobs by dedupe key
5. check successful materializations by materialization key
6. return reuse, variant option, active job, or new job

## Outcomes

### Exact Reuse

If a ready materialization matches exactly, return existing output assets.

### Active Equivalent

If an equivalent active job exists, attach the user to that job projection.

### Variant From Existing

If the request is close but not exact, offer a new variant using the prior asset
as explicit source.

### New Job

Only create a new job when no active equivalent and no reusable materialization
exist.

## Asset Lineage Requirements

Asset lineage must be queryable without parsing arbitrary JSON.

The asset catalog should expose:

- produced by job
- derived from asset
- superseded by asset
- canonical for purpose
- source operation
- materialization key

## Browser Runtime Requirements

Browser execution may produce assets, but upload and catalog registration must
be server-authoritative.

Browser-local state may help continue an in-tab execution. It cannot decide
whether durable work exists.

## Definition Of Done

This spec is satisfied when:

- rerunning the homepage never creates duplicate media jobs
- repeating the same media request reuses existing assets or returns an active
  equivalent job
- retry and replay remain explicit user actions
- asset lineage can be queried from catalog fields
- job history and asset history are linked but not conflated
