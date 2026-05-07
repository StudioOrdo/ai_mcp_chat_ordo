# Phase 00 - Baseline Evidence

Status: Complete

## Goal

Capture the current appliance lifecycle behavior before implementation so later phases are grounded in observed code instead of assumptions.

## Current Code Grounding

Known anchors:

- `Dockerfile` sets `DATA_DIR=/app/.data`, `STUDIO_ORDO_DB_PATH=/app/.data/local.db`, and declares `VOLUME ["/app/.data"]`.
- `compose.yaml` mounts `.data` into the app and media worker and defines service healthchecks.
- `README.md` documents `.data`, named Docker volumes, compose, data layout, and `npm run admin:health`.
- `scripts/start-server.mjs` verifies writable directories and supervises the media worker.
- `scripts/dev.mjs` starts the local worker stack and waits for media worker health.
- `src/lib/db/index.ts` resolves SQLite from `STUDIO_ORDO_DB_PATH`, then `DATA_DIR`, then `.data/local.db`; it opens `better-sqlite3`, enables WAL, sets `busy_timeout`, and runs schema initialization.
- `src/lib/config/env-config.ts` validates `DATA_DIR`, `STUDIO_ORDO_DB_PATH`, provider settings, worker settings, and runtime flags.
- `src/lib/config/ConfigurationService.ts` resolves runtime config from env first, then SQLite `system_settings`, and treats selected intelligence provider API-key readiness as install completion.
- `src/app/api/install/check/route.ts` runs `ensureDbSchema()` as the install data/DB readiness check.
- `src/lib/health/probes.ts` currently reports liveness as unconditional `ok` and readiness as provider/model readiness plus optional capability degradation.
- `src/app/api/health/live/route.ts` and `src/app/api/health/ready/route.ts` expose those health probes.
- `src/lib/operator/loaders/admin-health-loaders.ts` wraps health, env validation, release manifest, and referral diagnostics for the admin system page.
- `src/app/admin/system/page.tsx` shows health, provider diagnostics, runtime tool counts, tool availability, and worker id.
- `src/lib/user-files.ts` stores user media under `DATA_DIR/user-files`.
- `src/lib/media/server/media-worker-http.ts` exposes the media worker `/health` endpoint.
- `scripts/admin-health-sweep.ts` loads local env and prints `getHealthSweepReport()` JSON, exiting non-zero when readiness or liveness is `error`.
- `src/lib/admin/processes.ts` owns `getHealthSweepReport()`, `getDiagnosticsReport()`, `getEnvValidationReport()`, release manifest diagnostics, runtime audit log paths, and referral operational diagnostics.
- `scripts/build-search-index.ts`, `src/core/search/*`, and `src/lib/chat/embed-conversation.ts` own indexing/search behavior, but source review did not find a dedicated appliance health probe for search/index status.
- `scripts/start-server.mjs` tracks `workerHealthy` and `mediaWorkerHealthy` internally and exports them, but current route/admin health does not consume those values.

## Tasks

- Capture Docker/runtime evidence:
  - `Dockerfile`
  - `Dockerfile.media`
  - `compose.yaml`
  - `scripts/start-server.mjs`
  - `scripts/dev.mjs`
  - `README.md`
- Capture data durability evidence:
  - `src/lib/config/env-config.ts`
  - `src/lib/db/index.ts`
  - `src/lib/user-files.ts`
  - blog/media/user asset roots
- Capture install/setup readiness surfaces:
  - `src/app/api/install/check/route.ts`
  - `src/app/api/install/setup/route.ts`
  - `src/app/api/install/validate-keys/route.ts`
  - `src/app/install/InstallWizard.tsx`
- Capture provider diagnostics surfaces after provider configuration closeout:
  - `src/lib/ai/providers/provider-diagnostics.ts`
  - `src/lib/ai/providers/provider-settings-service.ts`
  - `src/lib/ai/providers/provider-capability-availability.ts`
- Capture health/admin surfaces:
  - `src/lib/health/probes.ts`
  - `src/app/api/health/live/route.ts`
  - `src/app/api/health/ready/route.ts`
  - `src/lib/operator/loaders/admin-health-loaders.ts`
  - `src/app/admin/system/page.tsx`
  - `scripts/admin-health-sweep.ts`
- Capture job/media/search surfaces:
  - deferred job worker scripts and repositories
  - media worker server/client/runtime
  - search index scripts and search/vector services
- Capture existing backup/restore references:
  - distinguish appliance backup/restore from workspace restore, journal revision restore, release manifest, and LLM export zip.
- Save command output under `evidence/00-baseline-evidence-2026-05-02.md`.

## Use Case Coverage To Preserve

Positive baseline:

- Empty `.data` starts through documented Docker paths.
- Configured `.data` remains mounted through compose and named volume flows.
- Media worker health is detectable.

Negative baseline:

- Missing or unwritable data directory must be detectable.
- Missing provider config must remain distinguishable from optional media/image/audio disablement.
- Worker failure must not be hidden as healthy lifecycle state.

Edge baseline:

- `DATA_DIR` and `STUDIO_ORDO_DB_PATH` may be overridden.
- Compose and single-image runtime profiles have different worker topology.
- Docker may be unavailable during local QA, requiring a non-Docker temp-data fallback.

## QA Findings

1. Runtime data boundary exists, but restore proof does not.
   - `Dockerfile`, `compose.yaml`, and `README.md` consistently point durable runtime state at `.data`.
   - Source search found no manifest-backed appliance backup/restore service. Existing "restore" hits are workspace restore, journal revision restore, UI focus restore, release manifests, or LLM export archives.

2. Startup has stronger data checks than readiness.
   - `scripts/start-server.mjs` ensures `DATA_DIR` is writable and uses a `.server.lock`.
   - `/api/install/check` runs `ensureDbSchema()`.
   - `/api/health/ready` currently checks selected intelligence provider/model and optional provider capabilities, but it does not yet include data directory, SQLite, worker, search, or backup/restore readiness.

3. Health is fragmented across multiple surfaces.
   - `src/lib/health/probes.ts` owns basic liveness/readiness.
   - `src/lib/operator/loaders/admin-health-loaders.ts` combines health with env validation, release manifest, and referral diagnostics.
   - `src/app/admin/system/page.tsx` independently loads provider diagnostics, tool composition, tool availability, and worker id.
   - Phase 03 should consolidate this into an appliance health facade instead of adding more route-local logic.

4. Worker topology is real but implicit.
   - `scripts/start-server.mjs` can supervise deferred jobs and an internal media worker.
   - `compose.yaml` can run `media-worker` as a separate service and points the app at `MEDIA_WORKER_URL`.
   - The current health shape does not report whether the active runtime is single-image supervised worker, compose service, external worker URL, disabled worker, or local dev.

5. Data path resolution has multiple legitimate entry points.
   - SQLite resolves `STUDIO_ORDO_DB_PATH` first, then `DATA_DIR/local.db`.
   - user files resolve directly from `DATA_DIR/user-files`.
   - Docker defaults set both `DATA_DIR` and `STUDIO_ORDO_DB_PATH`.
   - Phase 02 must avoid inventing a second data path policy; it should wrap the existing behavior and report warnings when paths leave the appliance boundary.

6. Optional capability degradation is already modeled for providers, but not for lifecycle components.
   - Provider diagnostics can report optional image/audio/search-like provider capabilities as unavailable without failing core intelligence readiness.
   - The lifecycle work should use the same product semantics: disabled optional components are not the same as broken core components.

7. Admin health helpers are reusable but too narrow for appliance readiness.
   - `scripts/admin-health-sweep.ts` already provides a CLI path.
   - `src/lib/admin/processes.ts` already provides `getHealthSweepReport()`, `getDiagnosticsReport()`, `getEnvValidationReport()`, and release/referral diagnostics.
   - These helpers depend on the current basic health probes, so Phase 03 should evolve them to consume the appliance health facade rather than bypass them.

8. Search has mature implementation surfaces but no dedicated lifecycle health status.
   - Search/indexing surfaces include `scripts/build-search-index.ts`, `src/core/search/*`, vector store ports, embedding pipeline, conversation embedding, and session-value baseline scripts.
   - Source search did not identify a single search health/status function that reports embedding count, model version, index freshness, or rebuild state.
   - Phase 03 should add a search probe behind a narrow interface instead of pulling search internals into admin routes.

9. Media worker health and media capability availability are separate today.
   - `src/lib/media/server/media-worker-http.ts` exposes `/health` as `{ ok: true }`.
   - `MediaWorkerClient` and runtime tool binding own compose-media execution.
   - Provider capability diagnostics own image/audio provider availability.
   - Phase 03 should report worker reachability separately from media provider/tool availability.

## Phase 00 Implementation Instructions

- Do not change product behavior in Phase 00.
- Expand the evidence file with exact command output and source references.
- Record any unclear surface as an open question, not as a design decision.
- Keep evidence focused on appliance lifecycle, not general application architecture.
- Do not treat workspace restore or journal revision restore as appliance restore.
- Preserve the distinction between evidence capture and implementation design.
- Use the resolved QA findings above instead of repeating discovery work during Phase 00 implementation.
- If new evidence contradicts these findings, update this phase doc and the evidence file before proceeding.

## Evidence Commands

```bash
rg -n "DATA_DIR|STUDIO_ORDO_DB_PATH|VOLUME|\\.data|media-worker|healthcheck|backup|restore|ready|health" Dockerfile Dockerfile.media compose.yaml README.md scripts src/app src/lib src/components
rg -n "ConfigurationService|provider diagnostics|install/check|setup|admin:health|isSystemInitialized|ensureDbSchema" src scripts package.json
rg -n "capability|tool|prompt|mcp|exposure|role" src/server src/lib src/app docs/_review/agent-tool-surface-hot-path-review
rg -n "backup|restore|archive|manifest|tar|zip|checksum" src scripts package.json README.md docs/_refactor docs/_review
rg -n "getReadinessProbe|getLivenessProbe|getHealthSweepReport|getEnvValidationReport|getDiagnosticsReport|loadSystemHealthBlock" src scripts
rg -n "build-search-index|embedding|vector|FTS|fts|search index|index status|rebuild" src scripts
rg -n "MediaWorkerClient|MEDIA_WORKER_URL|DISABLE_MEDIA_WORKER|DISABLE_DEFERRED_JOB_WORKER|workerHealthy|mediaWorkerHealthy|/health" src scripts compose.yaml README.md
```

## Evidence To Capture

- Docker data volume and env defaults.
- Compose app/media worker shared `.data` mount and healthchecks.
- Single-image startup and worker supervision behavior.
- Dev startup behavior.
- Install check DB/schema behavior.
- Health live/ready response shape.
- Admin health loader response shape.
- Provider diagnostics response shape.
- Tool/capability availability response shape.
- Current data root consumers.
- Current absence of appliance backup/restore.
- Current search/index statistics or absence of health surface.
- Current media worker health and capability projection.

## Open Questions For Phase 01-03

- Should lifecycle diagnostic tools be operator-only, intent-gated, or admin UI only in the first pass?
- Should `/api/health/ready` remain minimal while admin diagnostics become detailed, or should readiness return a structured component envelope?
- Should startup's `.server.lock` become part of the health facade status or remain startup-only?
- What exact component should report deferred job worker health: process supervisor, queue repository heartbeat, or both?
- What exact component should report search health: schema/index existence, embedding count, model version, golden-query eval freshness, or all of them?

## Resolved QA Questions

- `scripts/admin-health-sweep.ts` and `src/lib/admin/processes.ts` do expose reusable admin health helpers, but they currently wrap the narrow liveness/readiness probes.
- Search/index implementation exists, but a dedicated appliance health or stats function was not found in the reviewed surfaces.
- Media worker status is currently HTTP/process reachability. Media provider/tool capability availability is modeled separately through provider diagnostics and runtime tool availability.

## QA Certification

Phase 00 implementation is complete.

The implementation work for Phase 00 was evidence capture only. It did not create lifecycle services. Later phases own prompt exposure policy, runtime profile, health facade, backup/restore, and smoke harness implementation.

## Exit Criteria

- Complete: Evidence file exists at `docs/_refactor/appliance-lifecycle-proof/evidence/00-baseline-evidence-2026-05-02.md`.
- Complete: Evidence file is updated from the current source tree, not only the initial planning evidence.
- Complete: Evidence clearly separates implemented behavior from planned behavior.
- Complete: Later phases have concrete code surfaces to cite from this baseline.
- Complete: Remaining uncertainty is recorded as open questions instead of assumed away.
