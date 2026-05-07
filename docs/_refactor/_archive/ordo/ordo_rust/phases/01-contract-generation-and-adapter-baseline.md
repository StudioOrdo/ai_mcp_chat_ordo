# Phase 01: Contract Generation And Adapter Baseline

Status: Planned

## Goal

Make TypeScript/Zod the executable source of truth for Rust-facing contracts and
add adapter boundaries so Rust binaries can be called without leaking shell
details into product code.

During active Node work, this phase should prefer fixtures and export utilities
that do not change runtime behavior.

## Current Code To Refresh

- Zod schemas for jobs, media plans, generation status, backup/restore payloads,
  and search requests.
- TypeScript executor adapters used by backup and local tools.
- `Cargo.toml` and crate build scripts.
- Existing tests for backup executor output and invalid command responses.

## Implementation Scope

- Add a schema export utility for Rust-facing Zod schemas.
- Add generated JSON Schema artifacts in a stable build location.
- Add or document Rust build-time struct generation with `typify`, `schemafy`,
  or an equivalent crate.
- Add TypeScript adapter interfaces for local native executors.
- Add version fields and structured error normalization where missing.
- Add contract fixtures that Rust tests can consume before live integration.

## Out Of Scope

- Rewriting domain schemas for Rust convenience.
- Moving enqueueing or access-control decisions into Rust.
- Replacing existing worker implementations.
- Changing production enqueueing, worker, search, or realtime behavior.

## Required Tests

Positive:

- schema export succeeds deterministically;
- Rust deserializes valid generated examples;
- TypeScript adapter accepts valid versioned Rust output.

Negative:

- adapter rejects invalid JSON;
- adapter rejects unsupported contract versions;
- Rust build fails or tests fail when required generated fields are missing.

Edge:

- camelCase and snake_case mapping remains explicit;
- optional fields and discriminated unions round-trip correctly.

## Exit Criteria

- No new manual TypeScript/Rust duplicate contract is introduced.
- All future native phases have a contract generation path to use.
- Fallback TypeScript behavior remains unchanged.
- Rust-facing fixtures exist even if full schema generation is deferred.
