# Ordo Rust Boundary Map

Status: Draft
Date: 2026-05-06

## Current Runtime Ownership

TypeScript/Node remains the live product runtime.

Rust work in this package is currently limited to dormant pre-integration
foundations. Nothing in this map grants Rust production ownership of jobs,
realtime, search, scheduler, TLS, Docker lifecycle, or product policy.

## Existing Rust Workspace

- `Cargo.toml` declares a wildcard workspace over `crates/*`.
- `crates/ordo-backup` is the only existing implemented Rust crate before this
  package slice.
- `crates/ordo-backup/src/native_contract.rs` is the strongest current model for
  versioned camelCase `serde` JSON contracts.
- `crates/ordo-backup/src/main.rs` exposes direct CLI subcommands and is not a
  general product runtime daemon.

## Live TypeScript Owners

### Health

- Live routes: `src/app/api/health/live/route.ts` and
  `src/app/api/health/ready/route.ts`.
- Probe implementation: `src/lib/health/probes.ts`.
- Rust may prepare a dormant `ordo-daemon` health/readiness contract, but Node
  health remains authoritative until a later integration phase.

### Jobs

- Worker entrypoint: `scripts/process-deferred-jobs.ts`.
- Repository contract: `src/core/use-cases/JobQueueRepository.ts`.
- SQLite mapper: `src/adapters/JobQueueDataMapper.ts`.
- Domain contract: `src/core/entities/job.ts`.
- Rust must not claim `job_requests`, update job status, or append job events
  during runway mode.

### Scheduler

- Live scheduler entrypoint: `scripts/process-backup-scheduler.ts`.
- Rust must not insert recurring jobs until the scheduler phase exits runway
  mode.

### Realtime

- Current jobs stream route: `src/app/api/jobs/events/route.ts`.
- Current SSE implementation: `src/lib/jobs/job-event-stream.ts`.
- Current browser consumer: `src/components/jobs/useJobsEventStream.ts`.
- Rust must not replace SSE or add websocket runtime behavior during runway
  mode.

### Search

- Search ports: `src/core/search/ports/Embedder.ts` and
  `src/core/search/ports/VectorStore.ts`.
- Local embedder: `src/adapters/LocalEmbedder.ts`.
- Vector store and JS SQLite UDF: `src/adapters/SQLiteVectorStore.ts`.
- Rust may later sit behind these ports, but it must not replace embeddings or
  vector search during runway mode.

## First Safe Rust Slice

The first inert implementation slice is `crates/ordo-daemon`:

- direct Cargo-invoked binary only;
- `/health` and `/ready` proof responses available through a one-request local
  HTTP command;
- all subsystems disabled by default;
- no SQLite connection;
- no production startup wiring;
- no Node dependency.

## Integration Work That Must Wait

- Docker entrypoint or compose wiring for `ordo-daemon`.
- Node health watchdog dependency on Rust health.
- Job queue leasing or execution in Rust.
- SSE replacement or websocket broker activation.
- Native embedding/vector backend activation.
- Recurring scheduler insertion in Rust.
- Local TLS, reverse proxy, or mDNS runtime behavior.
