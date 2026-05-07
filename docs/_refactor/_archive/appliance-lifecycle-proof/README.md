# Appliance Lifecycle Proof

Status: In progress - Phase 04 split into 04x safety series

Priority source: `docs/_review/system-priority-shortlist-2026-05-01.md`, Priority 2.

Prerequisite context:

- `docs/_refactor/provider-capability-configuration` completed the first-install provider/model work.
- `docs/_review/agent-tool-surface-hot-path-review` identifies prompt exposure budgeting as the smallest prerequisite needed before exposing more diagnostics and lifecycle tools.

## Purpose

Prove that Ordo behaves like a self-contained AI business appliance, not only a Next.js application that happens to run in Docker.

The package focuses on the operational loop a solopreneur or alpha operator must trust:

- fresh install
- configured restart
- update
- backup
- restore
- health diagnosis
- worker readiness
- data directory portability

## Current Code Grounding

The package is grounded in the current runtime surfaces:

- `Dockerfile` defines `DATA_DIR=/app/.data`, `STUDIO_ORDO_DB_PATH=/app/.data/local.db`, creates writable runtime directories, and declares `VOLUME ["/app/.data"]`.
- `compose.yaml` mounts `./.data:/app/.data`, defines the app service, the media worker service, and media worker healthchecks.
- `README.md` documents `.data`, named Docker volumes, compose startup, runtime data layout, and `npm run admin:health`.
- `scripts/start-server.mjs` validates writable runtime paths and supervises the media worker in the production container path.
- `scripts/dev.mjs` starts the deferred job worker and media worker during local development and waits for media worker readiness.
- `src/lib/health/probes.ts`, install check routes, setup routes, admin system pages, provider diagnostics, job repositories, media storage, search, and configuration services already expose fragments of lifecycle health.

## Architecture Principles

The implementation should leave the system simpler than it was before:

- Single Responsibility: lifecycle health, backup, restore, worker status, and Docker smoke checks are separate services.
- Open/Closed: new probes and backup targets are added through strategies, not route rewrites.
- Liskov Substitution: local filesystem backup strategies can be replaced later by Rust or external adapters without changing routes.
- Interface Segregation: routes and CLI commands depend on narrow ports such as `HealthProbe`, `BackupArchiveStore`, and `WorkerStatusProvider`.
- Dependency Inversion: web routes, admin pages, scripts, and tests depend on lifecycle contracts rather than concrete DB/media/search internals.
- Clean Architecture: domain contracts live below adapters; Next.js routes and scripts are composition surfaces.
- GoF patterns:
  - Facade for the appliance health envelope.
  - Strategy for health probes, archive stores, and restore validation.
  - Command for backup and restore operations.
  - Adapter for Docker/process/filesystem/runtime checks.
  - Template Method or pipeline for lifecycle smoke verification.

## Package Contents

- `contract-spec.md`: lifecycle product and engineering contract.
- `phase-plan.md`: implementation sequence.
- `validation-checklist.md`: required QA across unit, integration, Docker, and functional checks.
- `qa-review.md`: current open risks before implementation.
- `systemic-audit.md`: code surface inventory.
- `phases/`: phase-level specs.
- `evidence/`: command output and implementation evidence captured during execution.

## Phase Status

- Phase 00 baseline evidence: complete.
- Phase 01 prompt exposure budget prerequisite: complete.
- Phase 02 runtime shape and lifecycle contract: complete.
- Phase 03 appliance health facade: complete.
- Phase 04A backup governance contract: complete.
- Phase 04B manifest archive and validation: complete.
- Phase 04C-04F backup/restore safety series: planned.
- Phases 05-06: planned.

## Net Result

When this package is complete, a copied `.data` volume or governed backup archive should be able to restore into a fresh Ordo container and pass a lifecycle health check that explains provider, database, worker, search, media, backup, restore, and data directory status without requiring hidden operator knowledge.

## Use Case Coverage

Every phase must carry positive, negative, and edge coverage forward:

- Positive: fresh install, restart, backup, restore, healthy worker, healthy search, and configured provider.
- Negative: unwritable data, corrupt database, incomplete provider config, failed worker, invalid backup, and unsafe restore.
- Edge: disabled optional capabilities, env path overrides, compose versus single-image runtime, large assets, missing Docker, and cross-platform filesystem behavior.
