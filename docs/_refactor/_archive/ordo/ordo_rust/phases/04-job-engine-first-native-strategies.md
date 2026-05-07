# Phase 04: Job Engine First Native Strategies

Status: Planned

## Goal

Move the first safe native job strategies behind the existing SQLite `job_queue`
contract while preserving TypeScript enqueueing, payload schemas, failure
classification, retry behavior, and UI observability.

## Current Code To Refresh

- `scripts/process-deferred-jobs.ts`
- job queue schema and migrations.
- backup/restore executor code and tests.
- media probing/composition code and fixtures.
- job event streaming and admin job surfaces.

## Implementation Scope

- Add Rust job domain types generated from TypeScript contracts.
- Add job store traits and SQLite adapter implementation.
- Add worker loop skeleton with lease acquisition and expiration handling.
- Add observer publishing hooks for current UI/event behavior.
- Migrate the first deterministic strategies, preferring backup/media inspection
  before high-risk composition.
- Add cancellation handling for active subprocess work.

## Out Of Scope

- Changing job payloads from TypeScript.
- Migrating all job types in one phase.
- Removing the TypeScript worker before parity evidence is complete.

## Required Tests

Positive:

- Rust worker acquires one pending job lease;
- valid fixture job completes with the same visible state as TypeScript;
- progress events reach the existing UI/event path.

Negative:

- invalid payload becomes the same failure class as TypeScript;
- cancellation stops active subprocess work;
- lease conflict does not double-run a job.

Edge:

- worker crash leaves recoverable lease state;
- large file paths and spaces work;
- timeout produces structured failure.

## Exit Criteria

- At least one native strategy has parity evidence.
- TypeScript enqueueing remains unchanged.
- Rollback to the TypeScript worker is one flag change.
