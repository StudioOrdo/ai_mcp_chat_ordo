# Phase 02 - Runtime Shape And Lifecycle Contract

Status: Complete

## Goal

Make the appliance runtime shape explicit in code so health, backup, restore, install support, Docker support, and future admin diagnostics reason from one shared lifecycle contract.

This phase must not build the full health facade or backup/restore system. It creates the stable contract those phases consume.

## Dependencies

Phase 00 evidence:

- `.data` is already the durable boundary in `Dockerfile`, `compose.yaml`, `README.md`, SQLite, blog assets, media, and user files.
- Startup scripts already make runtime assumptions about data paths, worker supervision, and media worker topology.
- Health/admin/install code currently reasons about pieces of the system independently.

Phase 01 prerequisite:

- Any new lifecycle or runtime-inspection capability created from this package must be classified `operator_only` or `internal_only` unless deliberately user-facing.
- Phase 02 should add contracts/services only. If it adds a conversational/admin tool, it must use prompt exposure metadata and must not expand the default chat prompt.

## Current Code Grounding

Runtime and process shape:

- `Dockerfile`
  - `ARG NODE_VERSION=22.22.2`
  - `ENV DATA_DIR=/app/.data`
  - `ENV STUDIO_ORDO_DB_PATH=/app/.data/local.db`
  - `ENV STUDIO_ORDO_BLOG_ASSET_ROOT=/app/.data/blog-assets`
  - creates `/app/.data`, `/app/.runtime-logs`, and `.next` image cache paths
  - declares `VOLUME ["/app/.data"]`
  - runs `node scripts/start-server.mjs`
- `Dockerfile.media`
  - separate media worker image path
  - runs `scripts/media-worker-server.ts`
- `compose.yaml`
  - app service is read-only except tmpfs and mounted `.data`
  - app and media worker share `./.data:/app/.data`
  - app defaults `MEDIA_WORKER_URL` to `http://media-worker:3101`
  - app depends on media worker `condition: service_healthy`
  - media worker healthcheck calls `http://127.0.0.1:3101/health`
- `scripts/start-server.mjs`
  - checks `better-sqlite3` native runtime compatibility before startup
  - resolves `DATA_DIR`
  - writes `.server.lock`
  - ensures data dir is writable
  - derives deferred worker mode from `DISABLE_DEFERRED_JOB_WORKER`
  - derives media worker mode from `DISABLE_MEDIA_WORKER`, `MEDIA_WORKER_URL`, and `MEDIA_WORKER_PORT`
  - supervises deferred job worker and in-image media worker with restart windows
  - exports `workerHealthy`, `mediaWorkerHealthy`, restart constants
- `scripts/dev.mjs`
  - checks native runtime compatibility
  - starts Next dev, deferred worker, and media worker
  - uses `.next/dev-stack.lock`
  - waits for media worker `/health`
  - shuts down all children together

Data path and database shape:

- `src/lib/config/env-config.ts`
  - parses `DATA_DIR`, default `.data`
  - parses `STUDIO_ORDO_DB_PATH`
  - parses `MEDIA_WORKER_URL`, `MEDIA_WORKER_PORT`, provider settings, worker settings
- `src/lib/db/index.ts`
  - privately resolves DB path from `STUDIO_ORDO_DB_PATH`, then `DATA_DIR`, then `.data/local.db`
  - creates DB parent dir
  - opens `better-sqlite3`
  - enables WAL and `busy_timeout`
  - exposes `ensureDbSchema()`
- `src/lib/user-files.ts`
  - uses `DATA_DIR/user-files`
- `src/lib/blog/blog-asset-storage.ts`
  - uses `getDataRootPath()` and `blog-assets`

Health and diagnostics shape:

- `src/lib/health/probes.ts`
  - liveness is unconditional `ok`
  - readiness currently checks selected provider/model and optional provider capabilities only
- `src/lib/admin/processes.ts`
  - diagnostics report includes package/release/provider/metrics/runtime-audit/referral info
  - health sweep composes liveness and readiness
  - env validation wraps `validateRequiredRuntimeConfig()`
- `src/app/api/health/live/route.ts`
  - returns `getLivenessProbe()`
- `src/app/api/health/ready/route.ts`
  - returns `getReadinessProbe()` and maps `error` to HTTP 503
- `src/app/api/install/check/route.ts`
  - calls `ensureDbSchema()` and returns install readiness
- `src/app/admin/system/page.tsx`
  - currently loads health, diagnostics, provider diagnostics, tool composition, tool availability, and worker id through separate calls

Media worker shape:

- `src/lib/media/server/media-worker-http.ts`
  - `GET /health` returns `{ ok: true }`
- `src/lib/media/server/media-worker-client.ts`
  - resolves media worker base URL from `MEDIA_WORKER_URL` or `http://127.0.0.1:3101`
  - executes `/compose-media`

Existing guardrail tests:

- `tests/docker-runtime-contract.test.ts`
- `tests/runtime-supervision-contract.test.ts`
- `tests/dev-stack-entrypoint.test.ts`
- `tests/env-centralization.test.ts`
- `tests/sqlite-boundary.test.ts`
- `tests/health-probes.test.ts`
- `src/lib/health/probes.test.ts`
- `src/lib/media/server/media-worker-client.test.ts`
- `src/lib/media/server/media-worker-http.test.ts`

## Problem Statement

The system has runtime facts in several places:

- Docker and compose declare data paths and worker topology.
- Startup scripts derive worker modes and lock behavior.
- DB code privately derives SQLite path.
- Health probes know provider readiness but not data, DB, worker, or runtime profile.
- Admin diagnostics show system facts but not one canonical appliance runtime contract.

Phase 02 should centralize those facts behind a read-only contract without changing startup orchestration.

## Implementation Design

Add a small runtime profile and data boundary module under a lifecycle/runtime namespace.

Recommended files:

- `src/lib/appliance/runtime-profile.ts`
- `src/lib/appliance/data-boundary.ts`
- `src/lib/appliance/runtime-profile.test.ts`
- `src/lib/appliance/data-boundary.test.ts`

Use `appliance` rather than generic `lifecycle` because `src/lib/lifecycle/*` already exists for user/account lifecycle events and coach payloads. This avoids namespace confusion.

### Runtime Profile Contract

Recommended DTO:

```ts
export type ApplianceRuntimeProfileId =
  | "single_image"
  | "compose_app"
  | "local_dev"
  | "test"
  | "unknown";

export type ApplianceRuntimeProcessRole =
  | "app"
  | "media_worker"
  | "unknown";

export type MediaWorkerMode =
  | "supervised_child"
  | "compose_service"
  | "external_url"
  | "disabled"
  | "local_dev";

export type DeferredWorkerMode =
  | "supervised_child"
  | "local_dev"
  | "disabled"
  | "unavailable";

export interface ApplianceRuntimeProfile {
  profileId: ApplianceRuntimeProfileId;
  processRole: ApplianceRuntimeProcessRole;
  nodeEnv: "development" | "production" | "test";
  isDocker: boolean;
  isCompose: boolean;
  dataDir: string;
  sqlitePath: string;
  sqliteInsideDataDir: boolean;
  mediaWorker: {
    mode: MediaWorkerMode;
    url: string | null;
    port: number | null;
    disabled: boolean;
  };
  deferredWorker: {
    mode: DeferredWorkerMode;
    disabled: boolean;
    workerId: string | null;
  };
  warnings: string[];
}
```

The contract must be pure/read-only. It may inspect environment variables, process cwd, and sentinel files, but must not start workers, open long-lived sockets, mutate `.data`, or initialize the DB.

The implementation should accept an optional dependency bag for tests instead of requiring tests to mutate global process state:

```ts
interface RuntimeProfileInput {
  env?: Record<string, string | undefined>;
  cwd?: string;
  fileExists?: (path: string) => boolean;
  readTextFile?: (path: string) => string | null;
}
```

Default production callers can omit the input and read from `process.env`, `process.cwd()`, and the local filesystem.

### Runtime Detection Rules

Profile id:

- `test` when `NODE_ENV === "test"`.
- `local_dev` when `NODE_ENV === "development"`.
- `compose_app` when production app runtime has a compose signal, especially `MEDIA_WORKER_URL=http://media-worker:3101` or `COMPOSE_PROJECT_NAME`.
- `single_image` when production app runtime has no compose signal. This still applies when media worker mode is `external_url`; the media mode carries that topology detail.
- `unknown` only when the above cannot be determined.

Compose detection should be conservative:

- Do not require Docker socket access.
- Treat hostnames like `media-worker` or env marker `COMPOSE_PROJECT_NAME` as compose signals.
- Treat absolute external URLs as `external_url` media worker mode unless the host is the compose service hostname.

Docker/container detection should be conservative and non-fatal:

- Do not require Docker socket access.
- Return `isDocker: true` when `/.dockerenv` exists or `/proc/1/cgroup` contains a known container marker such as `docker`, `containerd`, or `kubepods`.
- Return `false` when sentinel checks are unavailable. Detection failure must not throw.

Process role:

- Default to `app`.
- Report `media_worker` only when a clear marker exists, such as a future explicit env value or the current process entrypoint being `scripts/media-worker-server.ts`.
- Report `unknown` only when the role cannot safely be described.

Media worker mode:

- `disabled` when `DISABLE_MEDIA_WORKER === "1"`.
- `external_url` when `MEDIA_WORKER_URL` is configured and is not a local or compose service URL.
- `compose_service` when `MEDIA_WORKER_URL` is configured to `media-worker`.
- `supervised_child` in production single-image mode when not disabled and no external URL is configured.
- `local_dev` in development when not disabled.

Important startup nuance:

- `scripts/start-server.mjs` currently mutates `MEDIA_WORKER_URL` to `http://127.0.0.1:${MEDIA_WORKER_PORT}` when it supervises an in-image media worker.
- Phase 02 may add non-behavioral marker envs inside startup scripts, such as `ORDO_MEDIA_WORKER_MODE=supervised_child`, if needed to avoid ambiguous detection after that mutation.
- If no marker exists, production loopback media URLs should be treated as `supervised_child` by default, not compose.

Deferred worker mode:

- `disabled` when `DISABLE_DEFERRED_JOB_WORKER === "1"`.
- `local_dev` when `NODE_ENV === "development"`.
- `supervised_child` in production single-image/app runtime when not disabled.
- `unavailable` only when the runtime cannot safely infer status.

### Data Boundary Contract

Recommended DTO:

```ts
export interface ApplianceDataBoundary {
  dataDir: string;
  sqlitePath: string;
  sqliteWalPath: string;
  sqliteShmPath: string;
  sqliteInsideDataDir: boolean;
  defaultSqlitePath: string;
  blogAssetRoot: string;
  blogAssetRootInsideDataDir: boolean;
  userFileRoot: string;
  userFileRootInsideDataDir: boolean;
  requiredIncludePaths: string[];
  defaultExcludePaths: string[];
  warnings: string[];
}
```

Rules:

- Resolve `DATA_DIR` exactly once in this module.
- Resolve DB path with the same precedence as `src/lib/db/index.ts`: `STUDIO_ORDO_DB_PATH`, then `DATA_DIR/local.db`, then `.data/local.db`.
- Resolve blog assets with the same precedence as `src/lib/blog/blog-asset-storage.ts`: `STUDIO_ORDO_BLOG_ASSET_ROOT`, then `DATA_DIR/blog-assets`.
- Resolve user files as `DATA_DIR/user-files`.
- Export helpers from this module and update current path owners to delegate:
  - `src/lib/db/index.ts` must use the shared SQLite resolver.
  - `src/lib/user-files.ts` must keep exporting `getDataRootPath()` and `getUserFilesRootPath()`, but those functions should delegate to the shared data-boundary resolver.
  - `src/lib/blog/blog-asset-storage.ts` must keep current public behavior while using the shared blog asset resolver.
- Warn when `STUDIO_ORDO_DB_PATH` resolves outside `DATA_DIR`.
- Warn when `STUDIO_ORDO_BLOG_ASSET_ROOT` resolves outside `DATA_DIR`.
- Include default durable roots:
  - data dir
  - SQLite database, `${sqlitePath}-wal`, and `${sqlitePath}-shm`
  - blog assets
  - user files
- Exclude:
  - `.server.lock`
  - runtime logs unless a later backup phase opts in
  - `.next/cache`
  - temp files
  - generated release/build artifacts outside `.data`

### Integration Points

Phase 02 should add contracts and light integration only:

- `src/lib/db/index.ts`
  - replace local `resolveDbPath()` with the shared data-boundary resolver.
  - Keep `getDb()` behavior unchanged.
- `src/lib/user-files.ts`
  - preserve exports and behavior while delegating `DATA_DIR` and user-file root calculation to the shared data-boundary resolver.
- `src/lib/blog/blog-asset-storage.ts`
  - preserve `STUDIO_ORDO_BLOG_ASSET_ROOT` override behavior while delegating effective blog asset root calculation to the shared data-boundary resolver.
- `scripts/start-server.mjs` and `scripts/dev.mjs`
  - do not change worker spawning behavior.
  - may set non-behavioral runtime marker envs only if required to make runtime profile detection exact and testable.
- `src/lib/health/probes.ts`
  - may include a non-invasive `runtimeProfile` or `dataBoundary` summary only if tests show shape compatibility.
  - Do not broaden readiness semantics yet; Phase 03 owns the health facade.
- `src/lib/admin/processes.ts`
  - may include runtime profile in diagnostics if low-risk.
  - Do not make admin UI changes here unless required by tests.
- `README.md`
  - update lifecycle wording to say runtime profile/data boundary contract exists and health facade comes in Phase 03.

Do not edit:

- worker spawning behavior in `scripts/start-server.mjs` or `scripts/dev.mjs`
- compose topology
- backup/restore implementation
- tool catalog unless a runtime diagnostic tool is added, which is not required for this phase

## SOLID/Clean/GOF Notes

- Single Responsibility: runtime profile detection describes the runtime; startup scripts start processes.
- Open/Closed: new runtime profiles can be added without changing health or backup callers.
- Interface Segregation: data boundary and runtime profile are separate contracts.
- Dependency Inversion: future health/admin/backup code consumes DTO-producing ports, not Docker scripts or raw env variables.
- Clean Architecture: infrastructure details stay in adapters; route/admin surfaces consume stable read models.
- Adapter: env/Docker/compose/process details are adapted into one runtime profile DTO.
- Facade preparation: Phase 03 can compose these contracts into appliance health without re-reading env/script logic.

## Positive Use Cases

- Production single-image runtime reports:
  - `profileId: "single_image"`
  - `processRole: "app"`
  - data dir `/app/.data`
  - SQLite `/app/.data/local.db`
  - media worker mode `supervised_child`
  - deferred worker mode `supervised_child`
- Compose app runtime reports:
  - `profileId: "compose_app"`
  - `processRole: "app"`
  - media worker mode `compose_service`
  - media worker URL `http://media-worker:3101`
- Local dev reports:
  - `profileId: "local_dev"`
  - media worker mode `local_dev`
  - deferred worker mode `local_dev`
- Test runtime reports:
  - `profileId: "test"`
  - no Docker assumptions
- DB path resolver continues matching current SQLite behavior.
- Blog asset root override continues matching current behavior.
- User file root continues matching current behavior.

## Negative Use Cases

- `STUDIO_ORDO_DB_PATH` outside `DATA_DIR` reports `sqliteInsideDataDir: false` and a warning.
- `STUDIO_ORDO_BLOG_ASSET_ROOT` outside `DATA_DIR` reports `blogAssetRootInsideDataDir: false` and a warning.
- `DISABLE_MEDIA_WORKER=1` reports media worker disabled and does not invent a URL.
- `DISABLE_DEFERRED_JOB_WORKER=1` reports deferred worker disabled.
- Invalid `MEDIA_WORKER_URL` reports a warning but does not crash runtime profile generation.
- Missing or blank env vars fall back to the same defaults used today.

## Edge Use Cases

- Relative `DATA_DIR` resolves from `process.cwd()`.
- Relative `STUDIO_ORDO_DB_PATH` resolves from `process.cwd()`.
- `MEDIA_WORKER_URL=http://127.0.0.1:3101` in production should not be reported as compose.
- `MEDIA_WORKER_URL=http://media-worker:3101` should be reported as compose service.
- A future external media worker URL should be represented as `external_url`.
- Windows-style path behavior should be handled through `path.resolve()` and `path.relative()`, not string prefix checks.

## Test Plan

Add focused unit tests:

- `src/lib/appliance/data-boundary.test.ts`
  - default `.data/local.db`
  - env `DATA_DIR`
  - env `STUDIO_ORDO_DB_PATH`
  - env `STUDIO_ORDO_BLOG_ASSET_ROOT`
  - SQLite inside/outside data dir warning
  - blog asset root inside/outside data dir warning
  - user file root remains under data dir
  - WAL/SHM sibling paths are included
  - relative paths normalize correctly
  - required includes and default excludes are stable
- `src/lib/appliance/runtime-profile.test.ts`
  - single-image production profile
  - compose app profile from `MEDIA_WORKER_URL=http://media-worker:3101`
  - local dev profile
  - test profile
  - process role default app
  - disabled media worker
  - disabled deferred worker
  - external media worker URL
  - production loopback media worker URL reports supervised child, not compose
  - compose marker from `COMPOSE_PROJECT_NAME`
  - Docker sentinel detection does not throw when sentinel files are unavailable
  - invalid media worker URL warning
- Update existing guardrails as needed:
  - `tests/docker-runtime-contract.test.ts`
  - `tests/runtime-supervision-contract.test.ts`
  - `tests/env-centralization.test.ts`
  - `tests/health-probes.test.ts`

Regression checks:

- `npm test -- --run src/lib/appliance/data-boundary.test.ts src/lib/appliance/runtime-profile.test.ts tests/docker-runtime-contract.test.ts tests/runtime-supervision-contract.test.ts tests/env-centralization.test.ts tests/health-probes.test.ts src/lib/health/probes.test.ts`
- `npm run typecheck`

## Exit Criteria

- Runtime profile contract exists in code.
- Data boundary contract exists in code.
- SQLite path resolution is shared between the contract and `src/lib/db/index.ts`.
- `DATA_DIR`, blog asset root, and user file root calculations are not duplicated across `src/lib/db/index.ts`, `src/lib/user-files.ts`, and `src/lib/blog/blog-asset-storage.ts`.
- Existing startup scripts do not duplicate new incompatible runtime assumptions.
- The contract can represent single-image, compose, dev, test, disabled, and external worker shapes.
- The contract records warnings without crashing for degraded-but-describable configurations.
- README lifecycle wording matches the implemented profile/data-boundary contract.
- Phase 03 can consume the contract to build an appliance health facade without rereading Docker, compose, or startup scripts.

## QA Certification Notes

This phase is ready for implementation after the following corrections:

- Removed the ambiguous `compose_media_worker` profile id from the app runtime profile and replaced it with an explicit `processRole`.
- Added dependency injection expectations so tests can exercise env, cwd, and filesystem sentinels without global-state coupling.
- Added explicit handling for `scripts/start-server.mjs` mutating `MEDIA_WORKER_URL` for supervised child media workers.
- Added `STUDIO_ORDO_BLOG_ASSET_ROOT`, user-file root, SQLite WAL/SHM, and inside/outside-data-dir requirements to the data boundary.
- Clarified that path helpers in DB, user files, and blog assets must delegate to one boundary rather than keeping separate path policy.

## Implementation Evidence

Evidence file: `../evidence/02-runtime-shape-and-lifecycle-contract-2026-05-02.md`

## Non-Goals

- No backup/restore archive implementation.
- No full appliance health facade.
- No worker restart refactor.
- No Docker topology change.
- No default chat exposure for lifecycle diagnostics.
- No Rust rewrite.
