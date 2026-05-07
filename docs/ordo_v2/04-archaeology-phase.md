# Archaeology Phase

Status: proposed first GitHub issue

## Goal

Collect the real current state before building Ordo v2.

This phase does not implement product changes. It creates the evidence map that
lets us plan the event log, realtime path, briefs, and section UI correctly.

## Why This Comes First

The repo already has useful code. We should not rebuild blindly.

The work is to find what is real, what is partial, what is stale, and what tests
already protect it.

## Code Areas To Audit

### Runtime and Rust

- `crates/ordo-backup/src/*`
- `crates/ordo-backup/tests/*`
- `crates/ordo-daemon/src/*`
- `src/lib/appliance/native/*`
- `src/lib/appliance/backup/*`
- `src/core/use-cases/operations/*`

Questions:

- Which command tables exist?
- Which command statuses are supported?
- Which result contracts are shared across Rust and TypeScript?
- What is still duplicated manually?
- How does restart recovery work today?

### Events and realtime

- `src/lib/jobs/job-event-stream.ts`
- `src/lib/jobs/job-event-history.ts`
- `src/lib/jobs/job-event-bus.ts`
- `src/app/api/jobs/events/route.ts`
- `src/app/api/chat/events/route.ts`
- `src/lib/activity/*`
- `src/lib/observability/events.ts`

Questions:

- What events exist today?
- Which events are durable?
- Which events are only in process memory?
- Which endpoints poll?
- Which routes already use sequence numbers?

### Briefs

- `src/core/entities/brief.ts`
- `src/core/entities/brief-execution.ts`
- `src/lib/briefs/*`
- brief data mappers in `src/adapters/**`

Questions:

- Which brief tables exist?
- Which update request/result states are implemented?
- Which brief types are wired to UI?
- What evidence manifest shape exists?
- What still needs storage or projection?

### Section read models

- `src/lib/dashboard/*`
- `src/lib/studio/*`
- `src/lib/business/*`
- `src/lib/offers/*`
- `src/lib/referrals/*`
- `src/components/*`
- `src/app/**/page.tsx`

Questions:

- Which sections have real read models?
- Which pages still build meaning directly inside React?
- Which selected detail pages start with global totals?
- Which surfaces show raw jobs, logs, providers, payloads, or internal ids?

### Database

Find migration/schema ownership for:

- conversations;
- jobs;
- job events;
- operations;
- system commands;
- backups/restores;
- briefs;
- offers/events;
- referrals;
- media/workflows;
- activity.

Questions:

- Where is schema declared?
- Which tables already have sequences?
- Which tables need owner/visibility fields?
- Which tables are candidates for projections?

## Deliverables

Create:

- `docs/ordo_v2/evidence/current-runtime-map.md`
- `docs/ordo_v2/evidence/current-database-map.md`
- `docs/ordo_v2/evidence/current-read-model-map.md`
- `docs/ordo_v2/evidence/current-realtime-map.md`
- `docs/ordo_v2/evidence/current-briefs-map.md`
- GitHub issues for accepted next work.

## Positive Tests To Identify

List existing tests that prove:

- Rust can claim and execute a command;
- TypeScript validates native command results;
- backup/restore commands are admin-gated;
- jobs produce ordered events;
- chat event streaming respects conversation/user access;
- brief update result validation works;
- current read models hide private or raw details.

## Negative Tests To Identify

List missing or existing tests for:

- private event leakage;
- stale Rust/TypeScript schema drift;
- duplicate command execution;
- expired leases;
- event replay after reconnect;
- failed brief update preserving prior brief;
- owner UI hiding raw diagnostics.

## Edge Tests To Identify

List missing or existing tests for:

- process crash after command claim;
- browser reconnect after missed events;
- no events after sequence;
- high event volume;
- multiple users watching the same object;
- anonymous user hitting owner event endpoints;
- old brief with new evidence pending.

## Required Commands

Initial commands:

```bash
rg --files crates src docs/_business docs/_refactor/rust_projects
rg -n "system_commands|brief_update|section_brief|job_events|sequence|EventSource|ReadableStream|WebSocket|EventEmitter" src crates
npm run typecheck
cargo test --manifest-path crates/ordo-backup/Cargo.toml
cargo test --manifest-path crates/ordo-daemon/Cargo.toml
```

Add focused test commands based on what the audit finds.

## Acceptance Criteria

- The reports name actual files and tests.
- Each claim is marked as implemented, partial, missing, or stale.
- The next implementation issues are small enough for one branch each.
- No UI changes are made in this phase.

## Non-Goals

- no schema migration;
- no UI redesign;
- no Rust daemon consolidation;
- no WebSocket implementation;
- no new brief generation;
- no media execution changes.
