# Phase 00 Baseline Evidence - 2026-05-02

Status: Complete

## Commands Run

```bash
sed -n '1,220p' docs/_review/system-priority-shortlist-2026-05-01.md
find docs/_refactor/provider-capability-configuration -maxdepth 2 -type f | sort
rg -n "DATA_DIR|STUDIO_ORDO_DB_PATH|VOLUME|\\.data|media-worker|healthcheck|backup|restore|ready|health" Dockerfile Dockerfile.media compose.yaml README.md scripts src/app src/lib src/components | head -n 220
find docs/_refactor/appliance-lifecycle-proof -maxdepth 2 -type f | sort
rg -n "appliance-lifecycle-proof|Priority 1|Priority 2|Status update|Complete|Next Active" docs/_review/system-priority-shortlist-2026-05-01.md
rg -n "Status: Planned|Exit Criteria|Positive Use Cases|Negative Use Cases|Edge Use Cases|SOLID|GoF|Current Code Grounding" docs/_refactor/appliance-lifecycle-proof
rg -n "DATA_DIR|STUDIO_ORDO_DB_PATH|VOLUME|\\.data|media-worker|healthcheck|backup|restore|ready|health" Dockerfile Dockerfile.media compose.yaml README.md scripts src/app src/lib src/components
rg -n "ConfigurationService|provider diagnostics|install/check|setup|admin:health|isSystemInitialized|ensureDbSchema" src scripts package.json
rg -n "backup|restore|archive|manifest|tar|zip|checksum" src scripts package.json README.md docs/_refactor docs/_review
rg -n "getReadinessProbe|getLivenessProbe|getHealthSweepReport|getEnvValidationReport|getDiagnosticsReport|loadSystemHealthBlock" src scripts
rg -n "build-search-index|embedding|vector|FTS|fts|search index|index status|rebuild" src/core src/lib scripts | head -n 260
rg -n "MediaWorkerClient|MEDIA_WORKER_URL|DISABLE_MEDIA_WORKER|DISABLE_DEFERRED_JOB_WORKER|workerHealthy|mediaWorkerHealthy|/health" src scripts compose.yaml README.md
```

## Current Lifecycle Anchors

- `Dockerfile` sets `DATA_DIR=/app/.data`.
- `Dockerfile` sets `STUDIO_ORDO_DB_PATH=/app/.data/local.db`.
- `Dockerfile` sets `STUDIO_ORDO_BLOG_ASSET_ROOT=/app/.data/blog-assets`.
- `Dockerfile` creates `/app/.data`, `/app/.runtime-logs`, and `/app/.next/cache/images`.
- `Dockerfile` declares `VOLUME ["/app/.data"]`.
- `compose.yaml` mounts `./.data:/app/.data` into app and media worker services.
- `compose.yaml` defines a `media-worker` service with a `/health` healthcheck.
- `README.md` documents Docker named volume usage for `/app/.data`.
- `README.md` documents `.data` as the runtime data boundary.
- `README.md` documents `npm run admin:health`.
- `scripts/start-server.mjs` resolves `DATA_DIR`, checks writable runtime directories, and supervises the media worker process.
- `scripts/dev.mjs` starts the local media worker and waits for media worker health.
- `src/lib/config/env-config.ts` defines `DATA_DIR` and `STUDIO_ORDO_DB_PATH`.
- Existing media worker tests cover the worker HTTP/client/runtime path.

## Docker And Runtime Evidence

- `Dockerfile:26` sets `DATA_DIR=/app/.data`.
- `Dockerfile:27` sets `STUDIO_ORDO_DB_PATH=/app/.data/local.db`.
- `Dockerfile:28` sets `STUDIO_ORDO_BLOG_ASSET_ROOT=/app/.data/blog-assets`.
- `Dockerfile:50` creates `/app/.data`, `/app/.runtime-logs`, and `/app/.next/cache/images`.
- `Dockerfile:53` declares `VOLUME ["/app/.data"]`.
- `Dockerfile.media:21` starts `scripts/media-worker-server.ts`.
- `compose.yaml:20` mounts `./.data:/app/.data` into the app service.
- `compose.yaml:52` configures `MEDIA_WORKER_URL` to `http://media-worker:3101`.
- `compose.yaml:56-58` waits for the media worker service to be healthy.
- `compose.yaml:80` and `compose.yaml:105` mount `./.data:/app/.data` into auxiliary services.
- `compose.yaml:111-112` checks media worker health with `GET /health`.
- `README.md:73` documents local dev, production, and compose worker topology.
- `README.md:323` documents production worker supervision and disable/external worker flags.
- `README.md:339-352` documents named volume use for `/app/.data`.
- `README.md:382-394` documents the `.data` tree and `npm run admin:health`.

## Startup And Worker Evidence

- `scripts/start-server.mjs:33-36` resolves `DATA_DIR` and ensures it is writable before server startup.
- `scripts/start-server.mjs:33-56` creates and manages `.server.lock`.
- `scripts/start-server.mjs:89-95` derives deferred worker and media worker mode from `DISABLE_DEFERRED_JOB_WORKER`, `MEDIA_WORKER_URL`, `DISABLE_MEDIA_WORKER`, and `MEDIA_WORKER_PORT`.
- `scripts/start-server.mjs:109-111` tracks `workerHealthy` and `mediaWorkerHealthy`.
- `scripts/start-server.mjs:134-154` updates deferred worker health and restarts within a backoff window.
- `scripts/start-server.mjs:179-199` updates media worker health and restarts within a backoff window.
- `scripts/start-server.mjs:294` exports worker health fields, but route/admin health does not currently consume them.
- `scripts/dev.mjs:191` starts the local media worker.
- `scripts/dev.mjs:259` waits for media worker `/health`.
- `scripts/worker-supervisor.ts` contains an extracted restart-with-backoff helper, but `scripts/start-server.mjs` still has inline worker supervision logic.

## Data And SQLite Evidence

- `src/lib/config/env-config.ts:61-62` validates `STUDIO_ORDO_DB_PATH` and `DATA_DIR`.
- `src/lib/db/index.ts:9-20` resolves SQLite from `STUDIO_ORDO_DB_PATH`, then `DATA_DIR`, then `.data/local.db`.
- `src/lib/db/index.ts:31-42` creates the database directory, opens `better-sqlite3`, enables WAL, sets `busy_timeout`, and ensures schema.
- `src/lib/db/index.ts:69-71` exposes `ensureDbSchema()`.
- `src/lib/db/tables.ts:320-351` defines `embeddings` and `embedding_fts`.
- `src/lib/user-files.ts:14-20` resolves user file storage from `DATA_DIR/user-files`.
- `src/lib/user-files.ts:97`, `src/lib/user-files.ts:125`, and `src/lib/user-files.ts:235` write user files to disk.

## Install And Provider Evidence

- `src/lib/config/ConfigurationService.ts:14-34` resolves settings from env first, then SQLite `system_settings`.
- `src/lib/config/ConfigurationService.ts:43-45` treats selected intelligence provider API-key readiness as system initialization.
- `src/app/api/install/check/route.ts:12` runs `ensureDbSchema()`.
- `src/app/api/install/check/route.ts:14` returns `{ ready: true }`.
- `src/app/api/install/check/route.ts:18` returns `{ ready: false, message }` on DB/data failures.
- `src/app/api/install/setup/route.ts` blocks setup when initialized, validates provider settings, and calls `ensureDbSchema()` before persisting setup.
- `src/app/api/install/validate-keys/route.ts` blocks validation after initialization.
- `src/app/install/InstallWizard.tsx:69-72` calls `/api/install/check`.
- `src/app/install/InstallWizard.tsx:156` posts to `/api/install/setup`.
- `src/lib/ai/providers/provider-settings-service.ts:522-545` persists selected provider/model/key/base URL settings through `ConfigurationService`.

## Health And Admin Evidence

- `src/lib/health/probes.ts:34-42` returns liveness as unconditional `ok`.
- `src/lib/health/probes.ts:44-93` returns readiness based on selected intelligence provider config, selected model, and optional provider capability diagnostics.
- `src/app/api/health/live/route.ts:5` returns `getLivenessProbe()`.
- `src/app/api/health/ready/route.ts:5-7` returns `getReadinessProbe()` and maps non-ok readiness to HTTP 503.
- `scripts/admin-health-sweep.ts:7` calls `getHealthSweepReport()`.
- `scripts/admin-health-sweep.ts:9-10` exits non-zero when health status is `error`.
- `src/lib/admin/processes.ts:83` exposes `getDiagnosticsReport()`.
- `src/lib/admin/processes.ts:168-179` exposes `getHealthSweepReport()` by composing liveness and readiness.
- `src/lib/admin/processes.ts:183` exposes `getEnvValidationReport()`.
- `src/lib/operator/loaders/admin-health-loaders.ts:20-31` combines diagnostics, health, env validation, release manifest, and referral diagnostics.
- `src/app/admin/system/page.tsx:37-45` loads system health, provider diagnostics, tool composition, tool availability, and worker id separately.

## Search And Index Evidence

- `scripts/build-search-index.ts:32-36` constructs `SQLiteVectorStore` and embedding pipeline dependencies.
- `scripts/build-search-index.ts:52-56` can force-delete embeddings before rebuild.
- `scripts/build-search-index.ts:86-96` rebuilds embeddings and BM25/FTS-backed state.
- `scripts/build-search-index.ts:121-122` validates embedding quality.
- `src/lib/db/tables.ts:320-351` defines the durable search tables.
- `src/lib/capabilities/shared/embedding-tool.ts:91-168` exposes rebuild, stats, and delete embedding operations through embedding tools.
- `src/lib/capabilities/shared/embedding-tool.ts:155-159` can return embedding counts for a source type.
- `src/lib/chat/embed-conversation.ts:19-71` embeds conversations for search indexing.
- `src/lib/chat/search-pipeline.ts:19-38` builds the hybrid search pipeline from vector store, local embedder, and BM25 handler.
- No dedicated appliance health/status function was found for search/index freshness, embedding model mismatch, or rebuild health.

## Media Worker Evidence

- `src/lib/media/server/media-worker-http.ts:69-73` returns `{ ok: true }` from `GET /health`.
- `src/lib/media/server/media-worker-client.ts:86-95` resolves `MEDIA_WORKER_URL` and constructs the worker client.
- `src/core/capability-catalog/runtime-tool-binding.ts:187` imports `MediaWorkerClient`.
- `src/core/capability-catalog/runtime-tool-binding.ts:404` routes compose-media worker execution through `MediaWorkerClient`.
- `src/lib/media/server/media-worker-http.test.ts` and `src/lib/media/server/media-worker-client.test.ts` cover HTTP/client behavior.
- Media worker reachability is currently distinct from provider/tool capability availability.

## Backup/Restore Evidence

No manifest-backed appliance backup/restore service was found.

Important non-appliance "restore" or archive surfaces:

- `src/app/api/workspace/restore/route.ts` restores conversation workspace state, not `.data`.
- `src/app/admin/journal/[id]/page.tsx` restores journal revisions, not appliance data.
- `src/core/use-cases/ConversationInteractor.ts` archives/restores conversations, not appliance data.
- `scripts/generate-release-manifest.mjs` and `scripts/validate-release-manifest.mjs` manage release metadata, not data backups.
- `scripts/llm-export.ts` creates `ordo_llm_export.zip`, but it is a code/context export and explicitly excludes `.data`.
- `adm-zip` is available in `package.json`, but no appliance backup command uses it today.

## Current Behavior Versus Planned Behavior

Implemented today:

- Docker and compose define `.data` as the durable runtime mount.
- Startup checks `DATA_DIR` writability.
- SQLite path resolution is deterministic.
- Install check verifies DB/schema access.
- Basic liveness/readiness endpoints exist.
- Admin health and diagnostics helpers exist.
- Provider/model/key diagnostics exist.
- Media worker HTTP health exists.
- Search/index implementation and embedding stats tooling exist.

Not implemented today:

- one shared runtime profile contract
- appliance readiness facade
- data directory probe in `/api/health/ready`
- SQLite health probe beyond install check
- worker health in route/admin readiness
- search/index health probe
- media worker reachability in route/admin readiness
- manifest-backed appliance backup/restore
- lifecycle smoke harness for fresh install, restart, backup, restore, and restored health

## Open Questions Carried Forward

- Should `/api/health/ready` become a component envelope, or should detailed component state stay in admin diagnostics?
- Should `.server.lock` be reported by health after startup, or remain startup-only?
- Should deferred worker health come from process supervisor state, queue heartbeat, or both?
- What minimum search health should be required for appliance readiness: table existence, embedding count, model version, rebuild freshness, golden-query eval freshness, or a separate degraded status?
- Should media worker reachability be treated as optional disabled/degraded status unless media tools are enabled?

## Phase 00 Conclusion

The code already has the raw ingredients for appliance behavior: data volume, SQLite path, media worker health, startup supervision, compose healthchecks, and admin health docs.

The missing piece is proof as a coherent lifecycle contract:

- one shared runtime profile
- one shared readiness facade
- manifest-backed backup/restore
- repeatable fresh/restart/restore smoke harness
- admin/docs closeout that matches implemented behavior

Phase 00 is complete. Later phases should implement against this evidence rather than rediscovering the same surfaces.
