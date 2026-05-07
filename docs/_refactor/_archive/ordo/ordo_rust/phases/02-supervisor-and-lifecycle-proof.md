# Phase 02: Supervisor And Lifecycle Proof

Status: Planned

## Goal

Prove the crash-only lifecycle model with a small `ordo-supervisor` that can run
Node and Rust child processes, forward signals, capture redacted crash context,
and exit cleanly so Docker can restart the appliance.

While Node work is active, this must remain an isolated CLI proof. Do not make
it the Docker entrypoint or normal development supervisor yet.

## Current Code To Refresh

- `Dockerfile`
- `compose.yaml`
- `scripts/dev.mjs`
- Next.js production start command.
- Existing health endpoints.
- Existing diagnostic and issue-reporting utilities.

## Implementation Scope

- Add a supervisor proof that can be run directly and later enabled by flag.
- Forward `SIGTERM` and `SIGINT` to child processes.
- Capture bounded stderr tails for non-zero child exits.
- Redact secrets before writing or reporting crash context.
- Keep GitHub issue reporting disabled unless explicitly configured.
- Document the future Docker restart contract without changing the entrypoint.

## Out Of Scope

- Automatic restarts inside the supervisor.
- Sending crash telemetry by default.
- Replacing development workflows before production proof passes.
- Editing Docker or compose startup during the pre-integration runway.

## Required Tests

Positive:

- supervisor starts configured child commands;
- graceful termination forwards signals;
- non-zero child exit causes supervisor exit.

Negative:

- crash context redacts provider keys and environment secrets;
- missing child command fails with actionable diagnostics;
- telemetry remains disabled without explicit configuration.

Edge:

- child exits during startup;
- both children exit close together;
- stderr tail is bounded.

## Exit Criteria

- Supervisor can be tested locally without replacing default dev flow.
- Future Docker entrypoint change is documented and reversible, but not applied
  during runway mode.
- Crash-only lifecycle behavior is proven with redaction evidence.
