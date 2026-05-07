# Ordo Rust Phase Plan

Status: Planned
Date: 2026-05-06

## Phase Sequence

## Current Execution Mode

Because the Node/Next application is currently active work, begin with the
pre-integration runway. The first implementation sessions should prepare Rust
foundations that are inert by default and do not alter live Node behavior.

Recommended starting slice:

1. complete Phase 00 grounding;
2. add only the safe subset of Phase 03 needed for an inert `ordo-daemon`
  health/version proof;
3. defer supervisor entrypoint, job takeover, realtime, search, scheduler, and
  TLS integration until Node-side contracts stabilize.

See `pre-integration-runway.md` for the safe-now and not-yet lists.

## Full Phase Sequence

1. `phases/00-rust-runtime-baseline-and-boundary-map.md`
   - Refresh current code grounding, name existing Rust and TypeScript anchors,
     and produce the native runtime boundary map.

2. `phases/01-contract-generation-and-adapter-baseline.md`
   - Establish TypeScript/Zod as the schema source of truth, generate JSON
     Schema for Rust, and add typed TypeScript executor adapters.

3. `phases/02-supervisor-and-lifecycle-proof.md`
   - Add a crash-only supervisor proof for Node plus Rust child processes,
     signal forwarding, redacted crash capture, and local-only issue reporting
     gates.

4. `phases/03-ordo-daemon-skeleton-and-health.md`
   - Introduce the single `ordo-daemon` skeleton with health endpoints,
     internal task layout, SQLite connection policy, and feature flags.

5. `phases/04-job-engine-first-native-strategies.md`
   - Move the first native job strategies behind the existing `job_queue`
     contract, starting with deterministic backup/media-safe work before larger
     media composition.

6. `phases/05-realtime-broker-feature-flag.md`
   - Add the Rust realtime broker behind a feature flag, preserving current SSE
     behavior until websocket parity and browser tests pass.

7. `phases/06-rag-search-native-backend-proof.md`
   - Prove native embeddings/vector search behind existing search ports without
     moving retrieval policy or hybrid ranking out of TypeScript.

8. `phases/07-scheduler-and-recurring-jobs.md`
   - Add recurring schedule insertion in Rust while all execution continues
     through the same observable job engine.

9. `phases/08-appliance-networking-tls-prototype.md`
   - Prototype mDNS, local TLS, websocket routing, and reverse proxy behavior as
     an opt-in appliance mode.

10. `phases/09-runtime-hardening-and-closeout.md`
    - Run memory, lifecycle, rollback, security, and parity QA; update docs;
      prune stale Node pressure only after replacement evidence is complete.

## Dependency Rules

- Phase 01 depends on Phase 00.
- During active Node work, Phase 03 may begin after Phase 00 only for inert
  crate/binary scaffolding and health/version proof. Do not wire it into
  runtime startup.
- Phase 02 depends on Phase 01 for crash payload schemas and adapter rules.
- Phase 03 depends on Phase 01 and can run in parallel with Phase 02 after the
  process contract is known.
- Phase 04 depends on Phase 03 and must keep enqueueing in TypeScript.
- Phase 05 depends on Phase 03 and must be feature-flagged until websocket
  parity is proven.
- Phase 06 depends on Phase 01 and existing search port grounding.
- Phase 07 depends on Phase 04 because recurring tasks must enqueue jobs, not
  execute work directly.
- Phase 08 depends on Phase 03 and Phase 05 because TLS routing must respect
  daemon health and websocket ownership.
- Phase 09 depends on every prior phase that is implemented.

## Stop Conditions

Stop a phase before implementation when:

- code grounding does not name exact TypeScript and Rust files;
- the work would change live Node behavior while the package is still in the
  pre-integration runway;
- the phase moves access control, prompt policy, route policy, or UI state into
  Rust;
- a cross-process payload is manually duplicated instead of generated or tested
  against the TypeScript schema;
- rollback requires deleting user data or changing existing queue payloads;
- the implementation adds another long-lived service instead of using the single
  daemon model;
- SQLite write ownership and lock behavior are unclear;
- cancellation behavior is unspecified for subprocess or model work;
- the phase cannot produce package evidence with tests, logs, and remaining
  risks.

## Feature Flag Rule

Every runtime replacement must ship behind a switch until parity is proven.

Recommended flags:

- `ORDO_RUST_DAEMON_ENABLED`
- `ORDO_RUST_SUPERVISOR_ENABLED`
- `ORDO_RUST_JOBS_ENABLED`
- `ORDO_RUST_REALTIME_ENABLED`
- `ORDO_RUST_SEARCH_ENABLED`
- `ORDO_APPLIANCE_TLS_ENABLED`

Flags should default to the current TypeScript path in development unless a
phase explicitly updates the default and includes rollback evidence.
