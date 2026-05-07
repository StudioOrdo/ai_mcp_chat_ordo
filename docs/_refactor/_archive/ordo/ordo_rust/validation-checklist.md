# Ordo Rust Validation Checklist

Status: Paused
Date: 2026-05-06

## Pause Rule

The current dormant `ordo-daemon` package is sufficient preparation as of
2026-05-07. Do not add more Rust-only meta proofs, inventories, or drift guards
unless they directly support a concrete integration decision.

## Package-Level Checks

- During active Node work, Rust changes remain inert by default.
- Pre-integration Rust binaries are not wired into normal dev, production,
  Docker, or compose startup.
- TypeScript/Zod remains the source of truth for cross-process schemas.
- Rust code does not own access control, prompt construction, UI state, or
  product navigation policy.
- The appliance still builds as one Docker image.
- The runtime does not require external queues, vector databases, telemetry
  services, or cloud-only infrastructure.
- `ordo-daemon` is the only long-lived Rust daemon process.
- Native replacements are guarded by feature flags until parity is proven.
- Node fallback behavior remains available for each migrated path until
  closeout.
- SQLite write patterns are documented and tested for lock behavior.
- Subprocess cancellation is tested for active native job strategies.
- Crash reporting redacts secrets and is disabled unless explicitly configured.
- Rust health endpoints and Node health endpoints participate in watchdog
  behavior only after graceful shutdown paths are verified.
- Browser realtime behavior is verified with real websocket clients before SSE
  polling is removed.
- Search migrations preserve current search result contracts and ranking
  semantics visible to TypeScript callers.
- Recurring schedules insert observable jobs; scheduler code does not directly
  perform business work.
- Local TLS and mDNS remain opt-in until certificate trust UX is documented and
  tested.

## Required Test Layers

- Rust unit tests for domain structs, adapters, and error classification.
- Rust integration tests for SQLite lease acquisition, cancellation, and retry
  state transitions.
- TypeScript adapter tests for valid output, invalid output, missing binary,
  timeout, and version mismatch.
- Schema generation tests proving exported JSON Schema matches TypeScript/Zod
  contracts and Rust deserialization.
- Supervisor tests for signal forwarding, non-zero child exits, redaction, and
  fail-fast behavior.
- Daemon health tests for ready, degraded, and shutdown states.
- Job parity tests comparing TypeScript worker outcomes with Rust strategy
  outcomes on deterministic fixtures.
- Browser tests for websocket subscribe, reconnect, lane routing, typing, and
  governance update events.
- Search tests for embedding shape, vector score bounds, empty corpus behavior,
  and hybrid ranking preservation.
- Scheduler tests for singleton locking, missed runs, duplicate prevention, and
  job queue visibility.
- Docker tests proving the single image contains the required binaries and runs
  within the configured memory budget.

## Pre-Integration Checks

- New Rust crates compile without requiring Node runtime changes.
- New binaries can be invoked directly from Cargo or focused tests.
- Any TypeScript additions are schema/export/adapter-only and do not change
  production behavior.
- Feature flags default to the existing Node path.
- No Docker entrypoint, compose service, or `npm run dev` behavior changes are
  made in runway-only phases.
- Evidence states which future phase may activate the dormant work.

## Required Closeout Evidence

Each phase must add or update evidence under `../evidence/` or this package with:

- code anchors verified before editing;
- contracts crossing the TypeScript/Rust boundary;
- files changed;
- flags introduced or modified;
- tests run;
- memory or concurrency observations when runtime behavior changes;
- rollback path;
- QA pass 1 issues and fixes;
- QA pass 2 issues and fixes;
- remaining risks or deferred work.

## Static Scan Targets

Product-facing TypeScript code must not newly expose these implementation terms
to regular owner/public UI:

- `ordo-daemon`
- `ordo-supervisor`
- `Unix Domain Socket`
- `WAL`
- `lease id`
- `worker panic`
- `crash signature`
- `serde`
- `tokio`
- `ONNX Runtime`
- `sqlite-vss`
- raw subprocess command lines
- raw provider API keys
- raw websocket channel identifiers

Admin/System diagnostics may expose implementation terms when role-gated and
when secrets remain redacted.
