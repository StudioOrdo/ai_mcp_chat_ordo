# Phase 05F - Resource Limits Observability And Failure Posture

Status: complete

## Goal

Make the one-image appliance predictable under pressure.

An online solopreneur instance should degrade clearly before it exhausts host
resources, fills its durable volume silently, loses backup safety, or corrupts
runtime state during a worker crash loop.

This phase is not about maximum throughput. It is about a boring, bounded,
operator-friendly appliance that can be put behind Traefik or run directly with
Docker without surprising the owner.

## Inputs From Earlier Phases

- 05A made the image a non-root, read-only, one-service appliance with writable
  `.data`, read-only config, tmpfs runtime scratch paths, `no-new-privileges`,
  and `cap_drop: ALL`.
- 05B established hosted reverse-proxy mode through `ORDO_PUBLIC_ORIGIN`,
  `TRUST_PROXY_HEADERS`, CSRF/origin handling, and a hosted Compose template
  without host port publication.
- 05C minimized the runtime bundle while keeping Node, FFmpeg, SQLite native
  dependencies, the Rust backup executor, the media worker, and the backup
  scheduler inside the same image.
- 05D hardened first boot and secrets through central env parsing, `_FILE`
  secret support, install-token requirements, and redacted diagnostics.
- 05E added release provenance, multi-architecture release manifest generation,
  Docker Compose config validation, release scans, and a release gate that can
  include this phase's new guardrail tests.
- 04A-04F added the governed backup/restore model, archive validation, restore
  safety pipeline, Rust executor integration, admin/conversation self-service,
  scheduled backups, retention, and backup health projection.

## Current Code Grounding

### Docker And Compose

- `Dockerfile`
  - runtime uses `node:${NODE_VERSION}-alpine`.
  - runs as `USER nextjs`.
  - declares `DATA_DIR=/app/.data`,
    `STUDIO_ORDO_DB_PATH=/app/.data/local.db`, and
    `STUDIO_ORDO_BLOG_ASSET_ROOT=/app/.data/blog-assets`.
  - copies `bin/ordo-backup` from the Rust builder stage.
  - declares `VOLUME ["/app/.data"]`.
- `compose.yaml`
  - is a single `app` service.
  - has `read_only: true`, `security_opt: no-new-privileges:true`,
    `cap_drop: [ALL]`, and direct `3000:3000` publication.
  - has bounded tmpfs mounts for `/tmp`, `/app/.runtime-logs`, and
    `/app/.next/cache`.
  - has `pids_limit`, CPU, memory reservation/limit, Docker log rotation, and
    `/api/health/live` liveness healthcheck defaults.
- `compose.hosted.yaml`
  - is a single `app` service for reverse-proxy launch.
  - uses `expose: "3000"` instead of `ports`.
  - has the same read-only, tmpfs, `no-new-privileges`, and `cap_drop` posture.
  - supports Docker secrets for provider keys and install/runtime tokens.
  - has the same bounded resource, log rotation, tmpfs, and liveness posture as
    local Compose.
- `tests/image-security-contract.test.ts`
  - asserts the exact bounded tmpfs values.
- `tests/docker-runtime-contract.test.ts`
  - asserts the single-service shape and one-image Docker path.
- `tests/appliance-resource-contract.test.ts`
  - asserts Compose resource/log/tmpfs/liveness defaults and centralized env
    policy coverage.

### Health And Readiness

- `src/lib/health/probes.ts`
  - `getLivenessProbe()` is intentionally simple and always returns `ok`.
  - `getReadinessProbe()` delegates to `getApplianceHealthReport()`.
  - readiness returns 503 only when the appliance health status is `blocked`.
- `src/lib/appliance/health-facade.ts`
  - includes probes for `runtime`, `data`, `sqlite`, `provider`, `network`,
    `security`, `resources`, `tools`, `media_worker`, `deferred_worker`,
    `search`, and `backup_restore`.
  - required components include `runtime`, `data`, `sqlite`, `provider`,
    `network`, `security`, and `resources`.
- `src/lib/appliance/health-types.ts`
  - `ApplianceHealthComponent` includes `resources`.
- `src/lib/appliance/probes/data-boundary-probe.ts`
  - validates the known writable data roots are inside `DATA_DIR`.
  - does not inspect free space or pressure.
- `src/lib/appliance/probes/backup-restore-probe.ts`
  - reports executor availability, command counts, policy health, and backup
    warnings.
  - does not report durable volume pressure.
- `src/lib/storage/volume-capacity.ts`
  - already wraps `statfs` and returns total/free/used/percent metrics for the
    data root.
  - is currently media-oriented and not part of appliance readiness.
- `src/lib/storage/volume-capacity.test.ts`
  - already covers available capacity, `statfs` failure, and invalid metrics.

### Backup, Restore, And Disk Safety

- `src/lib/appliance/backup/backup-self-service.ts`
  - is the admin/conversation facade for manual backup, validation, restore plan
    creation, pre-restore backup, restore execution, and policy updates.
  - `createManualBackup()`, `requestPreRestoreBackup()`, and
    `executeConfirmedRestore()` already require executor availability before
    enqueuing work.
  - manual backup, pre-restore backup, and restore execution now check resource
    pressure before creating Rust work.
- `src/lib/appliance/backup/backup-command-service.ts`
  - creates manual backup snapshots and queues `backup.create`.
- `src/lib/appliance/backup/backup-scheduled-command-service.ts`
  - creates scheduled backup snapshots and queues `backup.create`.
- `src/lib/appliance/backup/restore-command-service.ts`
  - authorizes restore execution only after restore confirmation and a
    succeeded pre-restore backup.
  - receives requests only after `BackupSelfService` has checked resource
    pressure.
- `src/lib/appliance/backup/backup-policy-defaults.ts`
  - default policy is enabled, daily, retain 7.
- `src/lib/appliance/backup/backup-retention-service.ts`
  - prunes scheduled backups outside retention after command success.
- `src/lib/appliance/backup/backup-health-projection.ts`
  - reports policy/scheduler/retention health but not disk capacity.
- `src/lib/appliance/resources/resource-pressure-service.ts`
  - owns reusable resource-pressure checks for manual backup, scheduled backup,
    pre-restore backup, and restore execution.

### Workers And Failure Posture

- `scripts/start-server.mjs`
  - starts Next.js, deferred jobs, media worker, Rust backup executor, and
    backup scheduler inside the one image.
  - reads worker restart policy from `scripts/worker-restart-policy.mjs`.
  - deferred and media worker crash loops shut down the app.
  - backup executor and scheduler crash loops continue the app in degraded mode.
  - shutdown timeout is configurable with `SHUTDOWN_TIMEOUT_MS`.
- `tests/worker-server-decoupling.test.ts`
  - asserts current restart-limit behavior.
- `scripts/worker-supervisor.ts`
  - uses the same default worker restart policy module as production startup.

### Media And Upload Limits

- `src/lib/media/media-upload-policy.ts`
  - caps chat upload file size at `32 MiB`.
- `src/lib/media/browser-runtime/ffmpeg-worker-limits.ts`
  - caps FFmpeg asset payloads at `500 MB`.
  - caps captured FFmpeg log head/tail lines.
- `src/lib/media/browser-runtime/rasterization-constants.ts`
  - caps SVG markup at `5 MB`.
- `src/lib/chat/conversation-portability.ts`
  - caps conversation import payloads at `2 MB`.
- `src/lib/audio/audio-generation-service.test.ts`
  - guards TTS response size via `TTS_MAX_RESPONSE_BYTES`.
- These limits are scattered by feature and are not projected into appliance
  health/admin diagnostics.

### Env And Docs

- `src/lib/config/env-config.ts`
  - validates `SHUTDOWN_TIMEOUT_MS`, hosted mode, origin, secrets, providers,
    worker ports, provider timeouts, and appliance resource envs.
- `.env.example`
  - documents provider config and appliance resource defaults.
- `README.md`
  - documents one-image runtime, health/QA commands, resource defaults, and
    backup/restore pressure behavior.

## Design Principles

- Policy Object:
  - resource thresholds and Compose defaults must be centralized in one small
    appliance resource policy module, not scattered across probes, backup code,
    Docker tests, and docs.
- Facade:
  - resource state should enter the system through appliance health and the
    backup self-service facade. UI, chat tools, and admin pages should consume
    projected state instead of rechecking disk themselves.
- Strategy:
  - keep the data-capacity provider injectable so tests can simulate full disks
    without manipulating the host filesystem.
- Circuit Breaker:
  - keep worker crash-loop policy explicit. Deferred/media crashes remain
    app-fatal because core work cannot proceed safely; backup executor/scheduler
    crashes remain degraded because the app can still serve and explain that
    backup/restore execution is unavailable.
- Fail Closed For Destructive Work:
  - low durable-volume capacity must block backup creation, pre-restore safety
    backup creation, and restore execution before any Rust command is queued.
- Minimal Rust Responsibility:
  - Rust remains the raw archive executor. TypeScript owns pressure policy,
    health projection, admin messaging, and scheduling decisions.

## QA Findings Closed

1. Scheduled backup pressure checks must not live in the low-level command
   writer.
   - `BackupScheduledCommandService.enqueueScheduledBackup()` currently has an
     atomic "create snapshot and command" contract.
   - Capacity checks belong in `BackupScheduleService.evaluateDueBackup()`
     before that command writer is called.
2. Compose resource limits must be real Compose runtime keys.
   - Use `pids_limit`, `mem_reservation`, `mem_limit`, `cpus`, and `logging`
     on the service.
   - Do not rely on `deploy.resources` for local/non-Swarm Docker Compose.
3. Env validation must handle Docker unit strings separately from numeric
   thresholds.
   - Byte and percent thresholds should be numeric.
   - Compose size values such as `512m`, `2g`, and `10m` should be validated
     by a small unit-string schema.
4. Backup/restore blocked-capacity failures must be typed.
   - The UI, chat tools, scheduler, and API routes need to distinguish resource
     pressure from generic executor failure.
5. The 05E release gate must pick up the new resource contract tests.
   - `FOCUSED_IMAGE_TESTS` in
     `src/lib/appliance/release/appliance-image-release.ts` should include the
     new 05F contract test file.

## Implementation Plan

### 1. Add Appliance Resource Policy

Create `src/lib/appliance/resources/appliance-resource-policy.ts`.

The policy should expose typed defaults and env parsing for:

- durable data volume warning threshold:
  - default: warn below `2 GiB` or below `15%` free.
- durable data volume block threshold:
  - default: block below `512 MiB` or below `5%` free.
- backup/restore reserve threshold:
  - default: require at least the larger of the data block threshold and
    `2x` the latest known archive size when that archive size is available.
- tmpfs defaults for Compose:
  - `/tmp`: `512m`
  - `/app/.runtime-logs`: `64m`
  - `/app/.next/cache`: `256m`
- Docker runtime defaults:
  - pids limit: `256`
  - memory reservation: `512m`
  - memory limit: `2g`
  - CPU limit: `2.0`
  - log max size: `10m`
  - log max files: `5`
- worker restart policy:
  - max restarts: `3`
  - restart window: `60000 ms`
  - shutdown timeout: continue to use `SHUTDOWN_TIMEOUT_MS`.

Add env names through `src/lib/config/env-config.ts`:

- `ORDO_DATA_FREE_WARN_BYTES`
- `ORDO_DATA_FREE_WARN_PERCENT`
- `ORDO_DATA_FREE_BLOCK_BYTES`
- `ORDO_DATA_FREE_BLOCK_PERCENT`
- `ORDO_TMP_SIZE`
- `ORDO_RUNTIME_LOG_TMPFS_SIZE`
- `ORDO_NEXT_CACHE_TMPFS_SIZE`
- `ORDO_PIDS_LIMIT`
- `ORDO_MEMORY_RESERVATION`
- `ORDO_MEMORY_LIMIT`
- `ORDO_CPUS`
- `ORDO_LOG_MAX_SIZE`
- `ORDO_LOG_MAX_FILE`
- `ORDO_WORKER_MAX_RESTARTS`
- `ORDO_WORKER_RESTART_WINDOW_MS`

Validation should reject impossible thresholds such as block percent greater
than warn percent, negative bytes, or zero pids.

Validation details:

- byte thresholds and restart timings are positive integers.
- percent thresholds are numbers from `0` through `100`.
- Compose size values accept only simple Docker size units:
  - examples: `64m`, `512m`, `2g`.
  - reject blank values, negative values, shell snippets, paths, and spaces.
- CPU values accept positive decimal strings such as `0.5`, `1`, or `2.0`.
- log file count and pids limit are positive integers.

### 2. Add Resource Health Probe

Create a dedicated probe:

- `src/lib/appliance/probes/resource-pressure-probe.ts`

It should:

- use an injected capacity reader in tests and `statfs` through the existing
  `src/lib/storage/volume-capacity.ts` path in production.
- inspect the resolved `DATA_DIR`, not arbitrary media paths.
- report:
  - `healthy` when above warn thresholds.
  - `degraded` when below warn thresholds.
  - `blocked` when below block thresholds.
  - `degraded` with remediation when capacity cannot be read.
- include redacted/admin-safe metadata:
  - total bytes.
  - free bytes.
  - used bytes.
  - used percent.
  - warn/block thresholds.
  - decision reason.
- not leak host-only absolute paths in public readiness output beyond the
  existing admin diagnostics surface.

Update:

- `src/lib/appliance/health-types.ts`
  - add `resources` to `ApplianceHealthComponent`.
- `src/lib/appliance/health-facade.ts`
  - include `resources` as a required component.
  - blocked resources should make `/api/health/ready` return 503.
- `tests/health-probes.test.ts`
- `tests/health-routes.test.ts`
- `src/lib/appliance/probes/appliance-probes.test.ts`

### 3. Gate Backup And Restore Enqueue Paths

Create a small service:

- `src/lib/appliance/resources/resource-pressure-service.ts`

It should expose:

- `assertCanCreateBackup(context)`
- `assertCanCreatePreRestoreBackup(context)`
- `assertCanExecuteRestore(context)`
- `getResourcePressureSummary()`

Add a typed error:

- `ResourcePressureError`
  - code: `APPLIANCE_RESOURCE_PRESSURE`
  - operation: `manual_backup | scheduled_backup | pre_restore_backup | restore_execute`
  - status: `degraded | blocked | unavailable`
  - message: actionable, redacted, and suitable for admin/chat display.
  - metadata: threshold/free-space facts only; no secret paths.

Wire it into:

- `BackupSelfService.createManualBackup()`
- `BackupSelfService.requestPreRestoreBackup()`
- `BackupSelfService.executeConfirmedRestore()`
- `BackupScheduleService.evaluateDueBackup()` before
  `BackupScheduledCommandService.enqueueScheduledBackup()` is called.

Behavior:

- If data capacity is `blocked`, throw a typed/actionable error before creating
  a pending snapshot or system command.
- If data capacity is `degraded`, allow manual backups but return warnings.
- For pre-restore backup and restore execution, treat degraded-but-above-block
  as allowed with warnings; block below the computed safety reserve.
- Scheduled backups should return a `blocked` schedule decision under unsafe
  capacity and append an audit/health warning without creating a snapshot or
  system command.
- The low-level scheduled command writer should remain an atomic persistence
  primitive; it should not own policy decisions.

Tests:

- `src/lib/appliance/resources/resource-pressure-service.test.ts`
- extend `src/lib/appliance/backup/backup-self-service.test.ts`.
- extend `src/lib/appliance/backup/backup-schedule-service.test.ts` so blocked
  capacity returns a `blocked` decision before command creation.
- negative assertions must prove no snapshot or command is created when blocked.

### 4. Harden Compose Resource Defaults

Update `compose.yaml` and `compose.hosted.yaml`:

- tmpfs entries should include bounded options:
  - `/tmp:rw,nosuid,nodev,size=${ORDO_TMP_SIZE:-512m}`
  - `/app/.runtime-logs:rw,noexec,nosuid,nodev,size=${ORDO_RUNTIME_LOG_TMPFS_SIZE:-64m}`
  - `/app/.next/cache:rw,noexec,nosuid,nodev,size=${ORDO_NEXT_CACHE_TMPFS_SIZE:-256m}`
- add:
  - `pids_limit: ${ORDO_PIDS_LIMIT:-256}`
  - `mem_reservation: ${ORDO_MEMORY_RESERVATION:-512m}`
  - `mem_limit: ${ORDO_MEMORY_LIMIT:-2g}`
  - `cpus: ${ORDO_CPUS:-2.0}`
  - Docker `json-file` logging options:
    - `max-size: ${ORDO_LOG_MAX_SIZE:-10m}`
    - `max-file: ${ORDO_LOG_MAX_FILE:-5}`
- keep local direct launch with `ports: "3000:3000"`.
- keep hosted launch with `expose: "3000"` and no host port publication.
- change Docker healthcheck from `/` to `/api/health/live`.
  - Liveness should stay cheap and non-config-gating.
  - Readiness remains available at `/api/health/ready` for admin, release
    checks, and reverse-proxy/platform admission decisions.
- do not add `deploy.resources` as the only limit mechanism; it is not the
  local Compose enforcement surface.

Update tests:

- `tests/image-security-contract.test.ts`
- `tests/docker-runtime-contract.test.ts`
- add `tests/appliance-resource-contract.test.ts` for Compose and env policy.
- update `src/lib/appliance/release/appliance-image-release.ts` so
  `FOCUSED_IMAGE_TESTS` includes the new resource contract test.

### 5. Surface Limits In Admin And Health

Update appliance/admin projections so an admin can see why the instance is
degraded:

- `/api/health/ready` should include resource component warnings.
- admin diagnostics should show:
  - data free bytes/percent.
  - warn/block thresholds.
  - Docker resource defaults from policy.
  - backup safety state.
  - worker crash-loop policy.
- backup admin page and conversation backup tool responses should include
  resource warnings when backup/restore is allowed but near limits.
- API routes that catch `ResourcePressureError` should return a controlled
  client-safe error body instead of a generic 500.

Do not expose:

- provider secrets.
- raw secret file paths.
- host-only Docker socket or machine internals.
- per-file backup archive internals beyond existing manifest/integrity facts.

### 6. Worker Failure Posture

Refactor restart constants into a tiny shared policy module instead of leaving
magic values only in `scripts/start-server.mjs`.

Target:

- `src/lib/appliance/runtime/worker-restart-policy.ts`

Use this from:

- `scripts/start-server.mjs`
- `scripts/worker-supervisor.ts`

Keep current behavior:

- deferred worker crash loop: app exits.
- media worker crash loop: app exits.
- backup executor crash loop: app continues degraded.
- backup scheduler crash loop: app continues degraded.

Add explicit tests that the behavior is intentional and documented:

- `tests/worker-server-decoupling.test.ts`
- `tests/runtime-supervision-contract.test.ts`

Do not change the production crash-loop semantics in this phase unless a test
proves the current semantics are unsafe. The goal is to centralize and expose
the policy, not to create a new supervision model.

### 7. Document Operational Defaults

Update:

- `.env.example`
- `README.md`
- `docs/_refactor/appliance-lifecycle-proof/phases/05-docker-and-worker-verification-harness.md`
- `docs/_refactor/appliance-lifecycle-proof/phases/README.md`

Docs must explain:

- one-image default resource limits.
- how to raise/lower limits for tiny VPS vs larger instances.
- how low disk appears in health/admin.
- that Docker healthcheck uses liveness and readiness is the meaningful
  admission/diagnostic endpoint.
- that backup/restore may block before enqueueing when data volume capacity is
  unsafe.
- that retention remains enabled by default and is not a substitute for host
  disk monitoring.

## Positive Use Cases

- Local Compose starts the single image with bounded tmpfs, logs, pids, memory,
  and CPU defaults.
- Hosted Compose starts the same image behind a reverse proxy without publishing
  host ports and with the same resource defaults.
- `/api/health/live` stays 200 when config is incomplete but the process is
  alive.
- `/api/health/ready` returns 200 when resources are healthy and required
  config is valid.
- Admin diagnostics show healthy data capacity and the configured thresholds.
- Manual backup succeeds when disk capacity is healthy.
- Restore execution succeeds after confirmation and a succeeded pre-restore
  backup when capacity is healthy.
- Worker crash-loop behavior is explicit and covered by tests.

## Negative Use Cases

- Data volume below block threshold makes readiness 503.
- Manual backup does not create a snapshot or system command when capacity is
  blocked.
- Pre-restore safety backup does not enqueue when capacity is blocked.
- Restore execution does not enqueue when there is not enough reserve for
  destructive I/O.
- Scheduled backup does not create a doomed command under blocked capacity.
- Compose contract tests fail if resource/log/tmpfs limits are removed.
- Docker healthcheck does not call readiness and therefore does not restart the
  app solely because provider config or disk pressure needs admin action.

## Edge Use Cases

- Capacity reader fails because the host filesystem does not support `statfs`.
- Total/free/used metrics are zero or inconsistent.
- Archive size is unknown for an older or failed snapshot.
- Latest archive is very large compared with remaining disk.
- `.data` is mounted to a nearly full host volume.
- Container restarts while a Rust command lease is active.
- Backup executor is missing or disabled while resource health is otherwise
  healthy.
- User uploads many files while scheduled backup is due.
- Long media render fills `/tmp` and fails with a clear message.
- Hosted Traefik deployment relies on readiness outside Docker Compose.

## Out Of Scope

- Kubernetes, Swarm, autoscaling, or Traefik platform orchestration.
- Changing the backup archive format.
- Moving capacity policy into the Rust executor.
- File-by-file backup checksums beyond the existing archive integrity contract.
- Full cgroup telemetry dashboards.
- Docker image vulnerability remediation beyond the release gates introduced in
  05E.
- Host-level disk pruning automation.

## Exit Criteria

- `compose.yaml` and `compose.hosted.yaml` contain tmpfs size/options,
  pids/memory/CPU defaults, Docker log rotation, and liveness healthcheck.
- Resource policy is centralized and validated through `env-config`.
- Appliance health includes a required `resources` component.
- Readiness blocks on unsafe durable-volume capacity.
- Admin diagnostics and backup self-service surface resource warnings.
- Backup, pre-restore backup, restore execution, and scheduled backup enqueue
  paths respect resource pressure before creating unsafe work.
- Worker restart policy is centralized or explicitly documented with tests.
- Tests cover positive, negative, and edge resource-pressure cases.
- `.env.example`, README, and phase docs explain operational defaults and
  pressure behavior.
- Release gate from 05E includes or references the new resource contract tests.

## Required Verification Commands

Run the focused phase set:

```bash
./node_modules/.bin/vitest run \
  src/lib/appliance/resources \
  src/lib/appliance/probes/resource-pressure-probe.test.ts \
  src/lib/appliance/health-facade.test.ts \
  src/lib/appliance/backup/backup-self-service.test.ts \
  src/lib/appliance/backup/backup-schedule-service.test.ts \
  tests/health-probes.test.ts \
  tests/health-routes.test.ts \
  tests/image-security-contract.test.ts \
  tests/docker-runtime-contract.test.ts \
  tests/appliance-resource-contract.test.ts \
  tests/runtime-supervision-contract.test.ts \
  tests/worker-server-decoupling.test.ts \
  --pool=threads
```

Then run:

```bash
npm run typecheck
docker compose config --services
docker compose -f compose.hosted.yaml config --services
npm run appliance:release -- --allow-missing-scanners
```

## Implementation Completed

Phase 05F is implemented.

Implemented files:

```text
compose.yaml
compose.hosted.yaml
.env.example
README.md
scripts/start-server.mjs
scripts/worker-supervisor.ts
src/app/admin/system/backups/BackupSelfServiceManager.tsx
src/app/api/admin/system/backups/route.ts
src/app/api/admin/system/restore-plans/[planId]/execute/route.ts
src/app/api/admin/system/restore-plans/[planId]/pre-restore-backup/route.ts
src/lib/appliance/backup/backup-schedule-service.ts
src/lib/appliance/backup/backup-schedule-service.test.ts
src/lib/appliance/backup/backup-self-service.ts
src/lib/appliance/backup/backup-self-service.test.ts
src/lib/appliance/health-facade.ts
src/lib/appliance/health-facade.test.ts
src/lib/appliance/health-types.ts
src/lib/appliance/probes/appliance-probes.test.ts
src/lib/appliance/probes/resource-pressure-probe.ts
src/lib/appliance/probes/resource-pressure-probe.test.ts
src/lib/appliance/release/appliance-image-release.ts
src/lib/appliance/resources/appliance-resource-policy.ts
src/lib/appliance/resources/resource-pressure-service.ts
src/lib/appliance/resources/resource-pressure-service.test.ts
src/lib/appliance/resources/resource-pressure.ts
src/lib/appliance/runtime/worker-restart-policy.ts
src/lib/config/env-config.ts
tests/appliance-resource-contract.test.ts
tests/env-centralization.test.ts
tests/image-security-contract.test.ts
```

The completed implementation:

- adds a centralized appliance resource policy with env validation.
- adds a required `resources` health component and resource pressure probe.
- blocks unsafe manual backups, scheduled backups, pre-restore backups, and
  restore execution before creating Rust commands.
- surfaces resource warnings through backup self-service and admin UI.
- adds typed `ResourcePressureError` responses for admin backup/restore APIs.
- bounds local and hosted Compose with tmpfs sizes, pids, memory, CPU, Docker
  log rotation, and liveness healthcheck.
- centralizes worker restart defaults for tests and makes production restart
  limits env-configurable.
- includes the new resource contract test in the image release gate.

## Verification Completed

Completed on 2026-05-03:

```bash
./node_modules/.bin/vitest run \
  src/lib/appliance/resources \
  src/lib/appliance/probes/resource-pressure-probe.test.ts \
  src/lib/appliance/health-facade.test.ts \
  src/lib/appliance/backup/backup-self-service.test.ts \
  src/lib/appliance/backup/backup-schedule-service.test.ts \
  tests/health-probes.test.ts \
  tests/health-routes.test.ts \
  tests/image-security-contract.test.ts \
  tests/docker-runtime-contract.test.ts \
  tests/appliance-resource-contract.test.ts \
  tests/runtime-supervision-contract.test.ts \
  tests/worker-server-decoupling.test.ts \
  tests/env-centralization.test.ts \
  --pool=threads
```

Result: 13 files passed, 67 tests passed.

```bash
npm run typecheck
docker compose config --services
docker compose -f compose.hosted.yaml config --services
npm run appliance:release -- --allow-missing-scanners
```

Results:

- TypeScript passed.
- Local Compose config returned `app`.
- Hosted Compose config returned `app`.
- Appliance release gate passed.
- Release gate warnings were limited to missing optional SBOM and vulnerability
  scanner tools.
