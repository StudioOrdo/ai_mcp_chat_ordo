# Phase 03 - Appliance Health Facade

Status: Complete - implemented and verified 2026-05-02

## Goal

Consolidate lifecycle health into one shared appliance facade used by API routes, admin UI loaders, CLI scripts, and future operator-only conversational diagnostics.

This phase must make health explainable without implementing backup/restore archives or changing worker supervision. It should compose existing provider/runtime/data surfaces and add narrow probes where no health surface exists.

## Dependencies

Phase 00 evidence:

- Health is currently fragmented across `src/lib/health/probes.ts`, `src/lib/admin/processes.ts`, `src/lib/operator/loaders/admin-health-loaders.ts`, admin system UI, install check routes, provider diagnostics, media worker HTTP health, and search/index tooling.
- Readiness currently checks selected intelligence provider/model and optional provider capability degradation only.
- Search has implementation and stats surfaces, but no dedicated appliance health probe.
- Media worker reachability and media provider/tool availability are separate concerns.

Phase 01 prompt exposure:

- Any future lifecycle diagnostic tool must be `operator_only` or `internal_only`.
- Phase 03 should not add a default-chat tool.
- If a conversational/admin tool is added later, it must use prompt exposure metadata and must not expand the default chat prompt.

Phase 02 contracts:

- Use `src/lib/appliance/runtime-profile.ts` for runtime profile, worker mode, Docker/compose signal, and runtime warnings.
- Use `src/lib/appliance/data-boundary.ts` for `DATA_DIR`, SQLite path, blog assets, user files, WAL/SHM siblings, include/exclude paths, and outside-boundary warnings.
- Do not reread Docker/compose/startup script logic in the health facade.

## Current Code Grounding

Core health routes and probes:

- `src/lib/health/probes.ts`
  - defines `ProbeStatus = "ok" | "error"`.
  - `getLivenessProbe()` is unconditional `ok`.
  - `getReadinessProbe()` resolves selected intelligence provider config through `ProviderConfigService`, uses provider diagnostics, reports optional capability degradation as warnings, and returns `error` only when core intelligence key/model are not ready.
- `src/app/api/health/live/route.ts`
  - returns `getLivenessProbe()` with HTTP 200.
- `src/app/api/health/ready/route.ts`
  - returns `getReadinessProbe()` and maps `error` to HTTP 503.
- `tests/health-probes.test.ts`, `tests/health-routes.test.ts`, and `src/lib/health/probes.test.ts`
  - assert current provider-readiness behavior and route status mapping.

Admin and CLI health:

- `src/lib/admin/processes.ts`
  - `getHealthSweepReport()` composes liveness and readiness.
  - `getDiagnosticsReport()` separately reports package/release/provider/metrics/runtime-audit/referral details.
  - `getEnvValidationReport()` wraps `validateRequiredRuntimeConfig()`.
- `scripts/admin-health-sweep.ts`
  - prints `getHealthSweepReport()` JSON and exits non-zero when health status is `error`.
- `scripts/admin-diagnostics.ts`
  - prints `getDiagnosticsReport()` JSON.
- `src/lib/operator/loaders/admin-health-loaders.ts`
  - builds admin system health block from health sweep, env validation, release manifest, diagnostics, and referral diagnostics.
- `src/app/admin/system/page.tsx`
  - loads health block, provider diagnostics, runtime tool counts, tool availability, and worker id through separate calls.

Install and DB:

- `src/app/api/install/check/route.ts`
  - calls `ensureDbSchema()` and returns `{ ready: true }`, or `ready: false` with HTTP 500 on failure.
- `src/lib/db/index.ts`
  - now delegates SQLite path resolution to Phase 02 data boundary and opens `better-sqlite3`, enables WAL, sets `busy_timeout`, and runs schema initialization.

Provider and tool readiness:

- `src/lib/ai/providers/provider-diagnostics.ts`
  - reports selected intelligence provider, model, key state, optional capability states, impacted tools, and tool availability summary.
- `src/lib/ai/providers/provider-capability-availability.ts`
  - models optional capability states as `available`, `disabled`, `missing_key`, or `unsupported`.
- `src/lib/tools/tool-availability-service.ts`
  - owns runtime tool enable/disable policy and effective manifest.

Runtime and data contracts:

- `src/lib/appliance/runtime-profile.ts`
  - describes profile id, process role, Docker/compose signals, media worker mode, deferred worker mode, and warnings.
- `src/lib/appliance/data-boundary.ts`
  - describes data dir, SQLite path/WAL/SHM, blog asset root, user file root, include/exclude paths, and warnings.

Media worker:

- `src/lib/media/server/media-worker-http.ts`
  - `GET /health` returns `{ ok: true }`.
- `src/lib/media/server/media-worker-client.ts`
  - resolves base URL from `MEDIA_WORKER_URL` or `http://127.0.0.1:3101`, but currently exposes only compose-media execution, not a reusable health-check method.
- `scripts/start-server.mjs`
  - supervises in-image media worker and deferred worker and exports internal `workerHealthy` and `mediaWorkerHealthy`.
- `scripts/dev.mjs`
  - waits for media worker `/health` during local stack startup.

Deferred jobs:

- `src/lib/jobs/deferred-job-runtime.ts`
  - runs the worker loop and reports per-loop summary.
- `src/lib/jobs/deferred-job-worker.ts`
  - owns job claiming, lease recovery, retry classification, and terminal event handling.
- `src/lib/jobs/runtime-contracts.ts`
  - validates handler/registry drift at startup.
- There is no standalone deferred-worker health probe yet. Phase 03 should report configured mode and static contract health first, and avoid claiming live process liveness unless a reliable heartbeat exists.

Search/index:

- `src/lib/capabilities/shared/embedding-tool.ts`
  - implements `get_index_stats` using vector store count and BM25 index metadata.
- `src/core/search/ports/VectorStore.ts`
  - exposes `count(sourceType?: string)`.
- `src/core/search/ports/BM25IndexStore.ts`
  - exposes BM25 index read/staleness methods.
- `scripts/build-search-index.ts`
  - rebuilds embeddings and BM25 index.
- There is no shared search health service yet. Phase 03 should add a narrow search probe around existing stats dependencies or explicitly return `unknown` when stats dependencies are unavailable.

## Problem Statement

The system has useful health facts, but callers compose them differently:

- `/api/health/ready` knows provider readiness but not runtime/data/worker/search state.
- `admin:health` returns the narrow readiness envelope.
- Admin system UI mixes health, provider diagnostics, tool counts, referral diagnostics, and worker id in route/page-local composition.
- Install check validates DB/schema separately from readiness.
- Media and search have health-like facts but no shared lifecycle probe.

Phase 03 should introduce one facade that reports appliance component health without breaking the existing route response contracts abruptly.

## Implementation Design

Add a small appliance health package under `src/lib/appliance`.

`getApplianceHealthReport()` should be asynchronous because media-worker health and future probes can require bounded I/O. Keep individual probes sync where possible, but the facade contract should be `Promise<ApplianceHealthReport>` from the start.

Recommended files:

- `src/lib/appliance/health-types.ts`
- `src/lib/appliance/health-facade.ts`
- `src/lib/appliance/probes/runtime-profile-probe.ts`
- `src/lib/appliance/probes/data-boundary-probe.ts`
- `src/lib/appliance/probes/sqlite-probe.ts`
- `src/lib/appliance/probes/provider-probe.ts`
- `src/lib/appliance/probes/tool-availability-probe.ts`
- `src/lib/appliance/probes/media-worker-probe.ts`
- `src/lib/appliance/probes/deferred-worker-probe.ts`
- `src/lib/appliance/probes/search-index-probe.ts`
- `src/lib/appliance/probes/backup-restore-probe.ts`
- matching focused tests beside the implementation or under `src/lib/appliance`.

Keep probes small and dependency-injected. The facade should orchestrate probes, not know how to inspect every subsystem directly.

### Health Types

Recommended DTO:

```ts
export type ApplianceHealthStatus =
  | "healthy"
  | "degraded"
  | "blocked"
  | "disabled"
  | "unknown";

export type ApplianceHealthComponent =
  | "runtime"
  | "data"
  | "sqlite"
  | "provider"
  | "tools"
  | "media_worker"
  | "deferred_worker"
  | "search"
  | "backup_restore";

export interface ApplianceHealthProbeResult {
  component: ApplianceHealthComponent;
  status: ApplianceHealthStatus;
  impact: "required" | "optional" | "informational";
  summary: string;
  remediation: string | null;
  metadata: Record<string, unknown>;
  checkedAt: string;
  warnings: string[];
}

export interface ApplianceHealthReport {
  status: ApplianceHealthStatus;
  generatedAt: string;
  profile: ApplianceRuntimeProfile;
  dataBoundary: ApplianceDataBoundary;
  components: ApplianceHealthProbeResult[];
  summary: {
    healthy: number;
    degraded: number;
    blocked: number;
    disabled: number;
    unknown: number;
  };
  warnings: string[];
}

export interface ApplianceHealthProbe {
  component: ApplianceHealthComponent;
  run(context: ApplianceHealthContext): Promise<ApplianceHealthProbeResult> | ApplianceHealthProbeResult;
}

export interface ApplianceHealthContext {
  generatedAt: string;
  profile: ApplianceRuntimeProfile;
  dataBoundary: ApplianceDataBoundary;
  providerDiagnostics?: ProviderDiagnosticsReport;
  timeoutMs: number;
}
```

Status aggregation:

- `blocked` if any `required` component is blocked.
- `degraded` if no required component is blocked but any `required` component is degraded or unknown.
- `degraded` if an `optional` component is degraded and actionable.
- `healthy` if all required components are healthy and optional components are healthy or disabled, and informational components are healthy, disabled, or unknown.
- `disabled` should only be a component status, not the top-level status.
- `unknown` top-level should be used only when the facade itself cannot run enough probes to classify.
- `informational` unknown components, such as the Phase 04 backup/restore placeholder, must be counted but must not degrade top-level health by themselves.

Required components for Phase 03:

- runtime
- data
- sqlite
- provider

Optional/degradable components for Phase 03:

- tools
- media_worker
- deferred_worker
- search

Informational components for Phase 03:

- backup_restore

### Probe Design

Runtime profile probe:

- Consume `getApplianceRuntimeProfile()`.
- `impact: "required"`.
- `healthy` when profile is `single_image`, `compose_app`, `local_dev`, or `test` with no warnings.
- `degraded` when warnings exist.
- `unknown` when profile id is `unknown`.
- Metadata should include profile id, process role, docker/compose flags, media worker mode, and deferred worker mode.

Data boundary probe:

- Consume `getApplianceDataBoundary()`.
- `impact: "required"`.
- Check path policy only; do not mutate files.
- `healthy` when SQLite/blog/user paths are inside `DATA_DIR` and no warnings exist.
- `degraded` when paths are outside `DATA_DIR` but describable.
- Metadata should include data dir, sqlite path, blog asset root, user file root, include count, exclude count, and inside-boundary booleans.

SQLite probe:

- `impact: "required"`.
- Must use a dependency-injected checker so tests can simulate failures without opening real DBs.
- Default checker can call `ensureDbSchema()` or a narrower DB open/schema check if available.
- `healthy` when schema check succeeds.
- `blocked` when DB open/schema check throws.
- Metadata should include sqlite path and whether path is inside data dir.
- Do not swallow error messages; include a safe redacted summary.

Provider probe:

- `impact: "required"`.
- Use `getProviderDiagnosticsReportSync()` initially to preserve current readiness behavior.
- `healthy` when required intelligence provider key and model are ready and optional provider-backed tool degradation count is zero.
- `degraded` when required intelligence is ready but optional capability providers/tools are missing, disabled, or unsupported.
- `blocked` when required intelligence provider key or model is missing.
- Metadata should include provider, model, key configured boolean, optional capability counts, and tool summary counts.

Tool availability probe:

- `impact: "optional"`.
- Use provider diagnostics `toolSummary` or `getToolAvailabilityService()`.
- `healthy` when no effective manifest warnings and no unexpected provider/tool-policy failures.
- `degraded` when provider-gated tools are unavailable due to optional provider config.
- `disabled` only for explicitly disabled optional tools/capabilities.
- Do not duplicate provider probe logic; this probe explains tool policy state.

Media worker probe:

- `impact: "optional"`.
- Use Phase 02 runtime profile for mode and URL.
- If `DISABLE_MEDIA_WORKER=1` or mode is `disabled`, return `disabled`.
- If mode is `local_dev` and URL is absent, return `unknown` or `degraded` with remediation to start `npm run dev`; do not block core readiness.
- If mode is `compose_service`, `external_url`, or `supervised_child`, perform a bounded `GET /health` check when a URL is known.
- For `supervised_child` with a missing URL, derive the default loopback URL from `MEDIA_WORKER_PORT`/profile port only inside the media health adapter. Do not change Phase 02 runtime profile semantics.
- Add a reusable health method to `MediaWorkerClient` or a small `checkMediaWorkerHealth()` adapter. Keep timeout support injectable.
- `healthy` on HTTP 200 JSON `{ ok: true }`.
- `degraded` on timeout, non-200, invalid JSON, or fetch failure.

Deferred worker probe:

- `impact: "optional"`.
- Use Phase 02 runtime profile for mode and `DEFERRED_JOB_WORKER_ID`.
- Use `assertDeferredJobRuntimeContracts(createDeferredJobHandlers())` or an injected contract checker to catch handler/registry drift.
- `disabled` when disabled.
- `healthy` when static runtime contracts pass and mode is supervised/local dev.
- `degraded` when worker id is missing in a mode where one is expected, or contract validation fails.
- Do not claim live worker process health until a durable heartbeat exists. If live state is unavailable, say so in metadata.

Search/index probe:

- `impact: "optional"`.
- Add a narrow `SearchIndexHealthReader` adapter rather than calling a model-visible tool.
- Prefer existing vector/BM25 ports where easy to compose.
- Minimum Phase 03 acceptable behavior:
  - `healthy` when stats reader reports embeddings or BM25 stats for configured corpus source.
  - `degraded` when BM25 index is stale or embedding count is zero for a source expected to be indexed.
  - `unknown` when search stats dependencies are unavailable in the current runtime.
- Do not make search health a blocker for core readiness in Phase 03.

Backup/restore support probe:

- `impact: "informational"` until Phase 04.
- Phase 04 owns real backup/restore.
- Phase 03 should return `unknown` with summary "Backup/restore service not implemented yet" or `degraded` only if a required command is expected and absent.
- This probe exists so the facade shape is stable before Phase 04 fills it in.

## Integration Points

Implement the facade first, then adapt existing surfaces:

- `src/lib/health/probes.ts`
  - Keep `getLivenessProbe()` response compatible.
  - Update `getReadinessProbe()` to consume the appliance health facade while preserving current top-level `status: "ok" | "error"` for `/api/health/ready`.
  - Because the facade is async, `getReadinessProbe()` should become async. Update all direct callers and tests in this phase; do not leave mixed sync/async health callers.
  - Map facade `blocked` to readiness `error`.
  - Map facade `healthy` and `degraded` to readiness `ok`, with warnings/details for degraded optional components.
- `src/lib/admin/processes.ts`
  - Update `getHealthSweepReport()` to include `appliance` health report while preserving existing `status`, `liveness`, and `readiness` fields.
  - Update `getDiagnosticsReport()` to include runtime profile/data boundary summaries from the facade or Phase 02 contracts.
  - `getHealthSweepReport()` should become async with the facade. Update `scripts/admin-health-sweep.ts`, admin loaders, tests, and any imports together.
- `scripts/admin-health-sweep.ts`
  - Continue using `getHealthSweepReport()`.
  - Exit non-zero only when facade top-level status is `blocked` or legacy health status is `error`.
- `src/lib/operator/loaders/admin-health-loaders.ts`
  - Build warnings and summary from appliance health components instead of manually inferring from narrow readiness only.
- `src/app/admin/system/page.tsx`
  - Keep existing provider/tool cards in Phase 03 unless low-risk.
  - Add or feed a concise appliance component summary from the health block if needed.
- `src/app/api/install/check/route.ts`
  - May continue to use direct DB check in Phase 03 unless tests show duplication risk. If changed, it must preserve `{ ready: boolean, message?: string }`.

Do not add a user/default chat tool in this phase.

## SOLID/Clean/GOF Notes

- Single Responsibility: probes inspect one component; the facade aggregates.
- Open/Closed: new lifecycle probes register without rewriting route handlers.
- Interface Segregation: route/admin/CLI callers consume report DTOs, not raw DB/media/search/provider internals.
- Dependency Inversion: probes depend on narrow checker/reader interfaces that tests can replace.
- Clean Architecture: Next.js routes and scripts are composition surfaces; appliance health logic stays in `src/lib/appliance`.
- Facade: `getApplianceHealthReport()` is the shared read model.
- Strategy: each component probe is a strategy.
- Null Object: disabled optional capabilities return `disabled` results instead of thrown errors.
- Adapter: provider diagnostics, media HTTP health, DB schema check, and search stats are adapted into one component result shape.

## Positive Use Cases

- Fully configured single-image or compose runtime reports top-level `healthy`.
- Missing OpenAI key for image/audio with chat provider configured reports top-level `degraded` or `healthy` with disabled/degraded optional components, not `blocked`.
- Disabled media worker reports component `disabled` without failing core readiness.
- Compose media worker with healthy `/health` reports component `healthy`.
- Admin health sweep includes component-level explanations without each caller reassembling provider/runtime/data state.

## Negative Use Cases

- Missing selected intelligence provider key or model reports provider `blocked` and readiness HTTP 503.
- SQLite open/schema check failure reports SQLite `blocked` and readiness HTTP 503.
- Data boundary paths outside `.data` report data `degraded` with remediation, not an unhandled crash.
- Media worker URL configured but unreachable reports media worker `degraded`, not core `blocked`.
- Runtime profile cannot be classified reports runtime `unknown` and top-level `degraded`.

## Edge Use Cases

- Probe timeout returns `unknown` or `degraded` for that component without preventing the rest of the report.
- Search stats dependencies are unavailable in tests/local runtime and return `unknown` rather than failing the whole facade.
- Backup/restore probe returns stable `unknown` placeholder until Phase 04.
- Backup/restore placeholder is informational and does not degrade top-level health by itself.
- `NODE_ENV=test` runtime profile remains non-Docker by default.
- Compose app with `MEDIA_WORKER_URL=http://media-worker:3101` is reported through Phase 02 profile, not re-derived in health code.
- Existing health route consumers still receive `status: "ok" | "error"` until a later API version changes the public contract.

## Test Plan

Focused unit tests:

- `src/lib/appliance/health-facade.test.ts`
  - aggregates all healthy probes to top-level `healthy`.
  - maps required blocked component to top-level `blocked`.
  - maps actionable optional degraded components to top-level `degraded`.
  - keeps informational unknown components from degrading top-level health by themselves.
  - counts healthy/degraded/blocked/disabled/unknown components.
  - preserves warnings from probes.
- Probe tests:
  - runtime profile healthy/degraded/unknown.
  - data boundary healthy/degraded.
  - SQLite healthy/blocked through injected checker.
  - provider healthy/degraded/blocked from injected diagnostics.
  - media worker disabled/healthy/degraded/fetch timeout.
  - deferred worker disabled/healthy/degraded contract failure.
  - search healthy/degraded/unknown.
  - backup restore placeholder unknown.
- Existing route/admin tests:
  - `tests/health-probes.test.ts`
  - `src/lib/health/probes.test.ts`
  - `tests/health-routes.test.ts`
  - `tests/admin-processes.test.ts`
  - admin loader tests if present or new focused tests for `loadSystemHealthBlock()`.

Regression commands:

```bash
npm test -- --run src/lib/appliance/health-facade.test.ts src/lib/appliance/data-boundary.test.ts src/lib/appliance/runtime-profile.test.ts tests/health-probes.test.ts src/lib/health/probes.test.ts tests/health-routes.test.ts tests/admin-processes.test.ts src/lib/media/server/media-worker-client.test.ts
npm run typecheck
```

Run full suite before closeout:

```bash
npm test -- --run
```

## Exit Criteria

- `getApplianceHealthReport()` exists and composes narrow probes.
- Health component DTOs support `healthy`, `degraded`, `blocked`, `disabled`, and `unknown`.
- Runtime/data probes consume Phase 02 contracts.
- Provider readiness preserves current selected-provider behavior and optional capability degradation semantics.
- `/api/health/ready` keeps backward-compatible `ok/error` behavior while internally using the facade.
- `admin:health` and admin health loaders consume the facade instead of recomposing lifecycle status independently.
- Media worker health is represented separately from media provider/tool availability.
- Deferred worker probe does not make false live-liveness claims without heartbeat evidence.
- Search/index health has a narrow reader or explicit `unknown` fallback.
- Backup/restore appears only as a placeholder probe for Phase 04.
- Informational backup/restore placeholder does not prevent a fully configured Phase 03 system from reporting top-level `healthy`.
- No new default-chat lifecycle diagnostic tool is exposed.
- Tests cover positive, negative, and edge cases for facade aggregation and route compatibility.

## QA Certification Notes

Phase 03 is ready for implementation after these QA corrections:

- Added per-component `impact` so required failures, optional degradation, and informational placeholders aggregate correctly.
- Clarified that the Phase 04 backup/restore placeholder must not make a fully configured Phase 03 system permanently degraded.
- Made the async boundary explicit because media worker health requires bounded HTTP checks; if `getReadinessProbe()` or `getHealthSweepReport()` becomes async, all callers must be updated in the same phase.
- Added `ApplianceHealthContext` so probes share Phase 02 profile/data contracts and provider diagnostics instead of recomputing global state.
- Clarified supervised-child media worker URL handling without changing Phase 02 runtime profile semantics.

## Implementation Closeout

Implemented 2026-05-02 with evidence in `../evidence/03-appliance-health-facade-2026-05-02.md`.

Key closeout notes:

- Added the shared appliance health facade and component DTOs under `src/lib/appliance`.
- Added runtime, data, SQLite, provider, tool availability, media worker, deferred worker, search, and backup/restore placeholder probes.
- Preserved the public readiness contract while routing readiness and admin health through the appliance facade.
- Kept lifecycle diagnostics out of the default chat tool surface.
- Added bounded media worker HTTP health checks through `MediaWorkerClient.checkHealth()`.
- Added facade-level probe timeout handling so a slow component returns a degraded or unknown component result without blocking the full health report.
- Kept the deferred worker probe from claiming live liveness; it reports static contract health and lazy-loads handler contracts only when the probe runs.
- Updated release evidence generation for async health sweep collection.

Verification:

- `npm run typecheck`
- `npm test`

## Non-Goals

- No backup/restore archive implementation.
- No new public health API version unless backward-compatible.
- No worker supervisor refactor.
- No durable deferred-worker heartbeat unless explicitly split into a later phase.
- No Docker compose topology changes.
- No default user-facing chat diagnostic tool.
