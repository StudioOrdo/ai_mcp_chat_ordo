# Phase 09: Runtime Hardening And Closeout

Status: Planned

## Goal

Close the Rust runtime package only after implemented native paths prove parity,
rollback, memory behavior, crash behavior, and security boundaries.

## Current Code To Refresh

- All files changed by implemented Rust phases.
- Docker and compose runtime configuration.
- admin diagnostics and health surfaces.
- test reports and package evidence.
- stale Node worker/search/realtime paths proposed for cleanup.

## Implementation Scope

- Run package-level validation checks.
- Compare memory behavior for migrated paths under the Docker budget.
- Verify feature flag rollback for every native replacement.
- Prune stale Node runtime pressure only when replacement evidence exists.
- Update release, operations, and admin docs.
- Record remaining deferred Rust work.

## Out Of Scope

- Pruning fallbacks without parity and rollback evidence.
- Adding new native features during closeout.
- Turning experimental networking or search defaults on without explicit
  product approval.

## Required Tests

Positive:

- single-image Docker build includes required binaries;
- enabled native paths pass parity tests;
- disabled native flags use current TypeScript fallbacks.

Negative:

- crash reports remain redacted;
- admin diagnostics stay role-gated;
- product UI does not expose raw runtime internals.

Edge:

- restart during active native job;
- websocket reconnect after daemon restart;
- search model unavailable at startup;
- scheduled job insertion during database contention.

## Exit Criteria

- Package checklist is complete or explicitly deferred with owners.
- Evidence records tests, failures, fixes, and residual risk.
- Rust runtime responsibilities are clear, bounded, and reversible.
