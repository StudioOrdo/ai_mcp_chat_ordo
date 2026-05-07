# Phase 05 - Docker And Worker Verification Harness And Image Hardening Index

Status: implemented and locally verified; image hardening continues in 05x

## Goal

Add repeatable lifecycle verification for fresh install, restart, worker
readiness, automatic backup, restore, and restored data behavior across Docker
and local development.

The output of this phase is proof that Ordo is a real self-contained appliance:
one app image, one durable `.data` boundary, one SQLite database, one Rust
backup executor, one TypeScript scheduler, supervised workers, and no required
external database, queue, search service, cron, or backup service.

This phase must verify the runtime created by Phases 00-04F. It should not add
new backup semantics unless verification exposes a concrete gap.

## 05x Image-Hardening Series

The base Phase 05 work proved the single-image appliance direction. The next
work is intentionally split into a focused 05x series so the image can become
simple, hardened, and launchable without dragging in the future Ordo Studio
Traefik platform.

This file remains the base runtime proof and index. The image-hardening work is
implemented by:

- `05a-image-security-baseline-and-runtime-contract.md`
  - local and hosted compose security contracts: non-root, read-only, no
    capabilities, no privilege escalation, one service, and allowed writable
    paths.
- `05b-hosted-appliance-network-and-proxy-contract.md`
  - reverse-proxy readiness, hosted network posture, canonical public origin,
    and trusted forwarded-header behavior.
- `05c-image-minimization-and-runtime-bundle.md`
  - production image inventory and progressive removal of unnecessary runtime
    files while preserving workers and MCP behavior.
- `05d-secrets-and-first-boot-hardening.md`
  - install lock, hosted first-boot token policy, file-backed secrets, and
    redaction.
- `05e-release-supply-chain-and-image-provenance.md`
  - SBOM, vulnerability scanning, image digest, signing/attestation hooks, and
    release evidence.
- `05f-resource-limits-observability-and-failure-posture.md`
  - tmpfs/log/resource limits, disk pressure, and predictable failure behavior.

The 05x series remains image-focused. It must not implement tenant creation,
Traefik automation, billing, orchestration UI, or `ordostudio.com` platform
management.

## Dependencies

- Phase 02 defines the runtime profile and `.data` boundary.
- Phase 03 defines the appliance health facade.
- Phase 04A-04C define backup, archive, validation, and restore safety
  contracts.
- Phase 04D provides the Rust `ordo-backup` executor.
- Phase 04E provides admin and conversation self-service.
- Phase 04F provides automatic backup policy, scheduler, retention, and backup
  health projection.

## Current Code Grounding

Ground this phase in the current code, not an imagined deployment shape:

- `Dockerfile`
  - already uses `node:22.22.2-alpine`.
  - already has a Rust builder stage:
    `FROM rust:1-alpine AS rust-builder`.
  - already builds `cargo build --release -p ordo-backup`.
  - already copies `/app/target/release/ordo-backup` to `./bin/ordo-backup`.
  - already declares `DATA_DIR=/app/.data` and `STUDIO_ORDO_DB_PATH=/app/.data/local.db`.
  - already installs `ffmpeg`.
  - currently copies `node_modules`, `src`, `scripts`, `mcp`, docs, release,
    config, and the Rust binary into the runner image.
- `compose.yaml`
  - now runs one default `app` service.
  - app uses the main image and a shared `./.data:/app/.data` mount.
  - no longer sets `MEDIA_WORKER_URL=http://media-worker:3101` by default.
  - no longer depends on a `media-worker` sidecar.
  - no longer runs the `admin-web-search-mcp` sidecar in the default appliance
    compose path.
  - runs `read_only: true`, tmpfs mounts, `no-new-privileges`, and
    `cap_drop: ALL`.
  - remains a local convenience wrapper around the one app image.
- `Dockerfile.media`
  - removed from the supported appliance path.
- `scripts/start-server.mjs`
  - checks native Node runtime compatibility.
  - ensures `DATA_DIR` is writable and owns the single-writer server lock.
  - supervises deferred worker, in-image media worker, Rust backup executor,
    and backup scheduler.
  - mutates `MEDIA_WORKER_URL` to `http://127.0.0.1:${mediaWorkerPort}` when
    using supervised in-image media.
  - starts the Rust executor from `ORDO_BACKUP_EXECUTOR_PATH || bin/ordo-backup`.
  - starts `scripts/process-backup-scheduler.ts`.
  - waits for all children on shutdown.
- `scripts/dev.mjs`
  - checks native Node runtime compatibility.
  - prevents duplicate local worker stacks with `.next/dev-stack.lock`.
  - starts Next dev, deferred worker, media worker, Rust backup executor, and
    backup scheduler.
  - auto-builds `bin/ordo-backup` through `scripts/install-backup-executor.mjs`
    when the local executor binary is missing.
  - waits for media worker `/health`.
- `scripts/process-backup-scheduler.ts`
  - enforces Node 22.
  - supports `ORDO_BACKUP_SCHEDULER_RUN_ONCE=1`.
  - respects `DISABLE_BACKUP_SCHEDULER=1`.
  - runs reconciler before due scheduling.
- `scripts/install-backup-executor.mjs`
  - builds and installs the Rust binary locally.
- `src/lib/appliance/health-facade.ts`
  - aggregates runtime, data, SQLite, provider, tools, media, deferred worker,
    search, and backup/restore health.
- `src/lib/appliance/probes/backup-restore-probe.ts`
  - reports executor presence plus automatic backup policy freshness through
    the shared 04F projection.
- `src/lib/appliance/backup/*`
  - now includes command, archive validation, restore safety, Rust command
    integration, self-service, scheduler, reconciler, retention, and health
    projection services.
- Current tests:
  - `tests/docker-runtime-contract.test.ts`
  - `tests/runtime-supervision-contract.test.ts`
  - `tests/dev-stack-entrypoint.test.ts`
  - `tests/health-probes.test.ts`
  - `src/lib/appliance/health-facade.test.ts`
  - `src/lib/appliance/probes/appliance-probes.test.ts`
  - `src/lib/appliance/backup/backup-schedule-service.test.ts`
  - Rust crate tests under `crates/ordo-backup`.

## Product Position

The supported appliance shape should be:

- **Primary production path:** one app image running `scripts/start-server.mjs`,
  with supervised child processes for deferred jobs, media worker, Rust backup
  executor, and backup scheduler.
- **Compose path:** a one-service wrapper around the same app image. Compose
  must not introduce a required second image, second media service, external
  queue, external database, external search service, or external backup service.
- **Local development path:** `npm run dev` should behave like the one-image
  appliance with local child supervision and temp-data smoke support.
- **CI/QA path:** deterministic harnesses should use temp directories and
  random ports. Docker tests should be skipped or marked unavailable when Docker
  itself is unavailable, not silently treated as passed.

Do not build a dependency on external cron, Redis, Postgres, object storage,
Qdrant, Elasticsearch, or a separate backup service.

## Design

Add a lifecycle smoke harness with a shared template and separate execution
adapters.

Recommended files:

```text
src/lib/appliance/verification/lifecycle-smoke.ts
src/lib/appliance/verification/local-lifecycle-adapter.ts
src/lib/appliance/verification/docker-lifecycle-adapter.ts
src/lib/appliance/verification/lifecycle-evidence.ts
scripts/run-appliance-lifecycle-smoke.ts
tests/appliance-lifecycle-smoke.test.ts
tests/docker-appliance-lifecycle.contract.test.ts
```

Recommended package scripts:

```json
{
  "appliance:smoke": "tsx scripts/run-appliance-lifecycle-smoke.ts",
  "appliance:smoke:local": "APPLIANCE_SMOKE_MODE=local tsx scripts/run-appliance-lifecycle-smoke.ts",
  "appliance:smoke:docker": "APPLIANCE_SMOKE_MODE=docker tsx scripts/run-appliance-lifecycle-smoke.ts"
}
```

The harness should support:

- `local` mode
  - uses temporary `DATA_DIR`, temporary `STUDIO_ORDO_DB_PATH`, random app
    port, random media worker port, and the installed local `bin/ordo-backup`.
  - builds `bin/ordo-backup` first if missing.
  - starts `npm run start` only after `npm run build`, or starts the lower-level
    `node scripts/start-server.mjs` when a production build already exists.
  - disables provider-required live calls but keeps core health meaningful.
- `docker` mode
  - builds the app image.
  - runs the app image with a temporary bind mount or named volume.
  - verifies the Rust binary exists inside the image.
  - verifies `node scripts/start-server.mjs` starts the supervised workers.
  - must prove there is no required sidecar media-worker container.
- `compose` mode
  - starts `compose.yaml` as a one-service app wrapper.
  - verifies compose uses the same app image and same supervised child process
    family as direct `docker run`.
  - verifies `MEDIA_WORKER_URL` is not set to `http://media-worker:3101` by
    default. `start-server.mjs` should set it to the supervised child URL.

Use a Template Method sequence:

```text
prepare runtime
prepare empty data boundary
start appliance
wait for HTTP readiness
query appliance health
create seed data
run manual backup
validate backup archive
restart appliance
verify state persisted
configure automatic backup interval for test
run scheduler one-shot or wait due window
verify scheduled command and Rust executor completion
prepare restore plan
create pre-restore backup
execute restore into clean target
start restored appliance
verify restored health and seed data
collect evidence
stop appliance
cleanup temp runtime unless evidence retention requested
```

The sequence may use direct service calls for deterministic setup, but the
runtime proof must exercise the same durable SQLite tables and Rust executor
used by the app.

### Evidence

Evidence should be written as JSON plus a readable Markdown summary:

```text
docs/_refactor/appliance-lifecycle-proof/evidence/05-docker-and-worker-verification-<timestamp>.json
docs/_refactor/appliance-lifecycle-proof/evidence/05-docker-and-worker-verification-<timestamp>.md
```

Evidence must include:

- mode: `local`, `docker`, or `compose-single-image`
- image tag or local git revision
- Node version
- Rust version when available
- executor path
- app port and media port, redacted if needed
- data directory path redacted to basename when persisted in docs
- health report summary
- backup id, archive size, archive hash prefix only
- restore plan id
- scheduler result
- restart result
- command durations
- failures with redacted messages

Never write secrets, provider keys, cookies, session tokens, raw DB rows, or
full absolute private paths into committed evidence.

## Required Runtime Checks

The harness must verify:

- empty data directory initializes schema and health.
- `start-server.mjs` can run with only `.data` writable.
- deferred worker starts or reports disabled according to env.
- media worker reports the correct mode:
  - supervised child in one-image/local start-server path.
  - supervised child in compose path.
  - disabled when `DISABLE_MEDIA_WORKER=1`.
- Rust backup executor binary exists and can start.
- backup scheduler starts and can run one-shot.
- `backup_restore` health reports executor availability and policy freshness.
- manual backup creates a valid archive through Rust.
- scheduled backup can be enqueued by TypeScript and completed by Rust.
- restart preserves SQLite and durable file state.
- restore into a clean target passes health and restores seeded data.
- shutdown drains children without orphaning media worker, deferred worker,
  backup executor, or scheduler.
- missing provider keys disable optional capabilities without failing core
  lifecycle proof.

## Docker Alignment Decisions

Phase 05 should make the Docker story less ambiguous:

1. Keep the app image as the canonical appliance image.
2. Ensure the app image includes:
   - production Next build
   - `node_modules` needed by worker scripts
   - `scripts`
   - `src`
   - `mcp`
   - `config`
   - Rust `bin/ordo-backup`
   - `ffmpeg`
3. Make `compose.yaml` default to one `app` service only.
4. Remove `MEDIA_WORKER_URL=http://media-worker:3101` from the default compose
   app environment so `scripts/start-server.mjs` can supervise the in-image
   media worker.
5. Remove `depends_on: media-worker` from the default compose app service.
6. Remove the default `media-worker` compose service and `Dockerfile.media`
   from the supported appliance path unless a separate explicitly named
   development-only profile is justified.
7. Remove or update tests that assert the old multi-service compose contract.
8. Verify `read_only: true` containers still work by mounting writable paths:
   - `/app/.data`
   - `/tmp`
   - any required Next cache path if image optimizer or runtime cache writes
     happen in production.
9. Verify `bin/ordo-backup` is executable as non-root `nextjs`.
10. Verify `DATA_DIR`, `STUDIO_ORDO_DB_PATH`, blog assets, user files, backups,
   and restore staging all remain inside `/app/.data`.
11. Verify backup archives do not include `.next/cache`, `.runtime-logs`, or
   temporary restore staging except where explicitly intended.

## Local Development Alignment Decisions

Phase 05 should make local development match appliance behavior:

1. `npm run dev` should start the same logical process family:
   - Next dev
   - deferred worker
   - media worker
   - Rust backup executor
   - backup scheduler
2. Local smoke must use temp `.data` by default so it cannot corrupt the
   founder's working data.
3. Local smoke must choose random ports so port 3000/3101 collisions are not a
   false failure.
4. Local smoke must build/install `bin/ordo-backup` if missing, but should
   report a clear Rust toolchain failure if cargo is unavailable.
5. Local smoke must expose the exact command needed to reproduce a failure.

## Rust Verification

Rust is now part of the appliance contract. Phase 05 must verify:

- `cargo test -p ordo-backup`
- `cargo build --release -p ordo-backup`
- local `scripts/install-backup-executor.mjs` installs an executable
  `bin/ordo-backup`.
- Docker build compiles the Rust binary and copies it into the runner image.
- Rust daemon can lease and complete `backup.create`.
- Rust daemon can execute `restore.request` against a staged target.
- Rust failures leave durable command and audit evidence.

Do not make Rust responsible for schedule policy, retention policy, admin
preferences, or health freshness. Those remain TypeScript-owned from 04F.

## SOLID/Clean/GOF Notes

- Template Method: lifecycle smoke sequence is fixed while execution adapters differ.
- Adapter: Docker and local process execution are separate adapters.
- Single Responsibility: smoke harness verifies lifecycle; it does not implement backup, health, or worker logic.
- Facade: harness reads appliance health through the existing health facade.
- Command: backup and restore work are durable `system_commands`, not direct
  filesystem mutations from the harness.
- Strategy: local, direct Docker, and compose-single-image modes are runtime
  strategies over the same appliance image.
- Dependency Inversion: harness depends on process/runtime adapter ports, not
  direct shell calls spread through verification logic.

Recommended interfaces:

```ts
interface ApplianceRuntimeAdapter {
  prepare(): Promise<PreparedRuntime>;
  start(runtime: PreparedRuntime): Promise<RunningAppliance>;
  stop(running: RunningAppliance): Promise<void>;
  cleanup(runtime: PreparedRuntime): Promise<void>;
}

interface RunningAppliance {
  baseUrl: string;
  dataDirLabel: string;
  runCommand(command: string, args: string[], env?: Record<string, string>): Promise<CommandResult>;
  readHealth(): Promise<ApplianceHealthReport>;
}

interface LifecycleSmokeStep {
  name: string;
  run(context: LifecycleSmokeContext): Promise<LifecycleSmokeStepResult>;
}
```

## Positive Use Cases

- Docker fresh-start smoke passes.
- Local temp-data smoke passes.
- Restored data smoke passes.
- One-image Docker run starts app, deferred worker, media worker, Rust executor,
  and scheduler.
- Automatic scheduled backup completes and becomes latest successful.
- Restart preserves seed data and backup metadata.
- Restore to a clean data target produces a healthy appliance.
- Compose starts the same single app image without a separate media-worker
  service.

## Negative Use Cases

- Unwritable data mount fails loudly.
- Media worker down reports degraded media status.
- Bad restore archive fails before startup.
- Rust binary missing reports degraded backup health and a clear remediation.
- Backup scheduler disabled reports scheduling disabled without failing manual
  backup.
- Docker unavailable reports skipped/unavailable Docker mode and suggests local
  mode, instead of pretending Docker passed.
- Provider keys absent do not block core appliance readiness.
- Restore archive with wrong manifest fails before mutating target data.

## Edge Use Cases

- Docker is unavailable during CI/local QA.
- Port 3000 or media worker port is already occupied.
- Provider keys are intentionally absent, so optional capabilities must report disabled without failing core lifecycle checks.
- Existing `.data` is dirty in the developer checkout.
- Host sleeps or clock jumps while scheduler is due.
- Large data directory makes backup slower than the health timeout.
- Container restarts while Rust executor has a leased command.
- Compose accidentally reintroduces a media-worker sidecar or external
  `MEDIA_WORKER_URL`; contract tests fail.
- Read-only container root blocks a path that was accidentally left outside
  `/app/.data` or `/tmp`.

## Exit Criteria

- A documented lifecycle smoke command exists.
- The command records useful evidence without leaking secrets.
- Docker-unavailable fallback is explicit.
- Phase closeout records which mode was run.
- Local mode proves fresh start, restart, manual backup, scheduled backup,
  restore, and health.
- Docker one-image mode proves the Rust binary is packaged and supervised.
- Docker one-image mode proves workers and scheduler are supervised by
  `scripts/start-server.mjs`.
- Compose mode uses one app service and no required sidecar services.
- Rust tests and TypeScript tests both pass.
- `npm run typecheck` passes.
- The full `npm test` suite passes.
- Evidence is written under the appliance lifecycle proof evidence directory.

## Original QA Certification

Reviewed: 2026-05-03

Decision at implementation start: Phase 05 implementation must move the runtime
to one supported container image.

Current code supports this direction:

- `Dockerfile` already builds and packages the Rust `ordo-backup` binary into
  the app image.
- `Dockerfile` already installs `ffmpeg` into the app image.
- `scripts/start-server.mjs` already supervises deferred jobs, media worker,
  Rust backup executor, and backup scheduler from the app process family.
- `scripts/dev.mjs` already mirrors that process family locally and installs
  the Rust executor when missing.
- 04F backup health now uses the shared backup health projection, so the
  lifecycle smoke can read one consistent health surface.

Original implementation targets, now completed in base Phase 05:

- remove external default `media-worker` service from compose.
- remove default `MEDIA_WORKER_URL=http://media-worker:3101`.
- remove default `depends_on: media-worker`.
- remove `Dockerfile.media` from the supported path.
- update tests that asserted the old compose media-worker service contract.
- update README language from `app` plus `media-worker` to the single app image.

The 05x series starts after this base implementation and focuses on hardening
the image contract rather than proving the one-image shape again.

## Implementation Order

1. Convert compose/docs/tests to the one-image appliance contract:
   - default compose has one `app` service.
   - remove default `MEDIA_WORKER_URL=http://media-worker:3101`.
   - remove default `depends_on: media-worker`.
   - remove or quarantine `Dockerfile.media`.
   - update README and contract tests.
2. Add a small verification domain under
   `src/lib/appliance/verification`.
3. Add local runtime adapter using temp `.data` and random ports.
4. Add Docker runtime adapter that can build/run the app image with a temp
   bind mount.
5. Add lifecycle smoke CLI with local/docker/compose-single-image mode
   selection.
6. Add deterministic unit tests for the template sequence and adapter command
   construction.
7. Add contract tests for Dockerfile, compose, `start-server.mjs`, and
   `dev.mjs` alignment.
8. Run local smoke and record evidence.
9. Run Docker smoke when Docker is available and record evidence.
10. Update README/admin docs only after the harness proves the commands.

## Implementation Closeout

Completed: 2026-05-03

Implemented files:

- `compose.yaml`
  - now defaults to one `app` service.
  - removes the default media-worker sidecar, admin web search sidecar,
    `MEDIA_WORKER_URL=http://media-worker:3101`, and `depends_on`.
  - keeps `read_only: true` and adds writable tmpfs mounts for `/tmp`,
    `/app/.runtime-logs`, and `/app/.next/cache`.
- `Dockerfile`
  - remains the single supported appliance image and packages `ffmpeg`, Node,
    app workers, TypeScript runtime scripts, and Rust `bin/ordo-backup`.
- `Dockerfile.media`
  - removed from the supported runtime path.
- `scripts/install-backup-executor.mjs`
  - always rebuilds the Rust release binary for local smoke.
  - installs a symlink on macOS so local `bin/ordo-backup` executes the current
    `target/release/ordo-backup` without stale copied binaries.
- `crates/ordo-backup/src/command_store.rs`
  - exposes a mutable SQLite connection for restore execution.
- `crates/ordo-backup/src/sqlite_snapshot.rs`
  - supports restoring into the executor's existing SQLite connection.
- `crates/ordo-backup/src/restore_executor.rs`
  - restores through the single executor connection to avoid self-locking.
  - reconciles restored metadata parent-first: snapshot, command, then restore
    plan, preserving foreign-key correctness after database replacement.
- `crates/ordo-backup/src/daemon.rs`
  - runs restore commands against a mutable command store.
- `src/lib/appliance/verification/*`
  - adds the lifecycle smoke domain, command runner, local adapter, Docker
    adapter, evidence rendering, and typed evidence model.
- `scripts/run-appliance-lifecycle-smoke.ts`
  - adds local, docker, and compose-single-image smoke entrypoint.
- `tests/appliance-lifecycle-smoke.test.ts`
  - covers evidence redaction and CLI mode contract.
- `tests/docker-appliance-lifecycle.contract.test.ts`
  - locks the single-image Docker/compose contract.
- `README.md`
  - documents the single-image appliance runtime and local process family.

Smoke defects found and fixed:

1. Restore FK failure after SQLite replacement.
   - Why 1: local lifecycle smoke failed during `restore.request`.
   - Why 2: Rust replaced `local.db` with an older backup snapshot.
   - Why 3: the restored DB did not contain the restore command and plan rows
     that were created after the backup snapshot.
   - Why 4: reconciliation inserted the restored `restore_plans` row before
     reinserting the referenced `system_commands` parent row.
   - Why 5: the executor had no smoke proof for a real app-created restore
     where the target DB is older than the command state.
   - Fix: reconcile parent rows before child rows and prove it through the
     local lifecycle smoke.
2. Restore executor self-lock/stale binary behavior in local smoke.
   - Why 1: an old copied `bin/ordo-backup` could continue to run even after
     Rust code changed.
   - Why 2: the local adapter only installed the executor when the file was
     missing.
   - Why 3: restore opened a second SQLite destination connection while the
     command-store connection was still alive.
   - Why 4: the restore path needed to mutate the same database it used for
     command ownership.
   - Why 5: the verification harness did not force a fresh Rust install before
     running the lifecycle proof.
   - Fix: local smoke always rebuilds/installs the executor and restore now
     uses the command store's mutable connection as the single writer.

Verification evidence:

- Local appliance smoke passed:
  `../evidence/05-docker-and-worker-verification-2026-05-03T04-04-11-043Z.md`
- Local smoke covered:
  - temp `.data` initialization
  - schema initialization
  - appliance health read
  - manual backup through Rust
  - durable seed-data read
  - scheduled backup enqueue through TypeScript and completion through Rust
  - restore plan creation
  - pre-restore safety backup
  - restore execution through Rust
  - restored seed-file verification
- Targeted tests passed:
  - `cargo test -p ordo-backup`
  - `npm run typecheck`
  - `npm test -- tests/docker-runtime-contract.test.ts tests/runtime-supervision-contract.test.ts tests/dev-stack-entrypoint.test.ts tests/appliance-lifecycle-smoke.test.ts tests/docker-appliance-lifecycle.contract.test.ts src/lib/appliance/backup/backup-self-service.test.ts src/lib/appliance/probes/backup-restore-probe.test.ts`
- Full suite passed after closeout fixes:
  - `npm test`
  - 707 test files passed
  - 5078 tests passed, 2 skipped
- Docker compose contract verified locally:
  - `docker compose config --services` returns only `app`.

Remaining Phase 06 carry-forward:

- Run and record full Docker image smoke in an environment with enough Docker
  Desktop storage and host free space for a production image build.
- Add admin-facing lifecycle closeout docs that point to the latest smoke
  evidence and explain how to rerun local and Docker modes.
