# Appliance Lifecycle Systemic Audit

Status: Baseline captured in Phase 00

## Runtime And Install Surfaces

| Surface | Current Role | Target Role |
| --- | --- | --- |
| `Dockerfile` | Defines app image, `.data` volume, runtime env defaults, and production command. | Canonical single-image appliance runtime. |
| `Dockerfile.media` | Defines separate media worker image path. | Optional compose worker profile; must remain compatible with one appliance data contract. |
| `compose.yaml` | Runs app and media worker with shared `.data` mount and healthchecks. | Verified appliance-cell runtime profile. |
| `README.md` | Documents Docker run, named volume, compose, data layout, and health command. | Operator-facing lifecycle documentation. |
| `scripts/start-server.mjs` | Ensures writable paths and supervises media worker. | Production runtime adapter reporting lifecycle profile and worker state. |
| `scripts/dev.mjs` | Starts local app, deferred worker, and media worker. | Development-only lifecycle adapter used for parity checks. |

## Data Surfaces

| Surface | Current Role | Target Role |
| --- | --- | --- |
| `src/lib/config/env-config.ts` | Resolves `DATA_DIR` and `STUDIO_ORDO_DB_PATH`. | Source for lifecycle data path resolution. |
| `src/lib/db/index.ts` | Opens SQLite database. | Health probe and backup quiescence participant. |
| `.data/local.db` | Default SQLite database. | Durable state included in backup/restore. |
| blog/media/user asset storage | Durable generated/user files. | Included in backup/restore according to manifest rules. |
| `.runtime-logs` | Runtime evidence/log output. | Optional diagnostics artifact, excluded from required restore unless explicitly requested. |
| `.next/cache` | Build/runtime cache. | Always excluded from backup/restore. |

## Health And Diagnostics Surfaces

| Surface | Current Role | Target Role |
| --- | --- | --- |
| `src/lib/health/probes.ts` | Existing health probe implementation. | Probe strategy foundation for appliance health facade. |
| install check routes | Report setup readiness. | Consume shared readiness service. |
| admin system pages | Show operational health. | Consume shared appliance diagnostics. |
| provider diagnostics | Report provider/model capability state. | Child probe within appliance readiness. |
| media worker `/health` | Reports worker process health. | Child probe within media capability readiness. |
| job repository/runtime | Tracks deferred job state. | Child probe for background work readiness. |
| search/index services | Local retrieval state. | Child probe for search/index readiness. |

## Tool And Conversation Surfaces

| Surface | Current Role | Target Role |
| --- | --- | --- |
| capability catalog | Source of governed tool metadata. | Also carries prompt exposure policy. |
| MCP export surfaces | Operator/admin tool access boundary. | Export only lifecycle tools that are intentionally operator-visible. |
| chat tool projection | Default assistant tool surface. | Hide operator/internal diagnostics unless intent or role permits. |

## Cleanup Candidates

- Duplicate data-path checks after the lifecycle data path resolver exists.
- Route-local health mapping after the health facade exists.
- Script-local worker status parsing after a worker status adapter exists.
- Ad hoc backup/archive helpers if any are found during Phase 00 evidence capture.
