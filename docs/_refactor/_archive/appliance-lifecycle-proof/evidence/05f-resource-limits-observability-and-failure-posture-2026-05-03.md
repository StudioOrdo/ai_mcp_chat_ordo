# Phase 05F Evidence - Resource Limits Observability And Failure Posture

Captured: 2026-05-03T07:10:06Z

Post-implementation QA refreshed: 2026-05-03T07:16:40Z

Status: passed

## Implemented

- Centralized appliance resource policy and env validation.
- Required `resources` appliance health component.
- Resource pressure probe for writable `.data` capacity.
- Backup, pre-restore backup, restore execution, and scheduled backup pressure gates before Rust command creation.
- Typed `ResourcePressureError` API responses.
- Admin backup resource projection.
- Local and hosted Compose pids, memory, CPU, tmpfs, Docker log rotation, and liveness healthcheck defaults.
- Worker restart defaults centralized for tests and env-configurable in production startup.
- 05E release gate includes the 05F resource contract test.

## Post-Implementation QA

Closed QA findings:

- Updated the phase document's code-grounding section so it reflects the
  implemented state instead of the pre-implementation gaps.
- Added `scripts/worker-restart-policy.mjs` and declaration file so production
  startup and worker-supervisor tests use the same restart-policy source.
- Updated runtime supervision tests to assert production startup imports the
  shared worker restart policy.

## Verification

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

Result: passed. 13 files, 67 tests.

Post-QA rerun: passed. 13 files, 67 tests.

```bash
npm run typecheck
```

Result: passed.

Post-QA rerun: passed.

```bash
docker compose config --services
docker compose -f compose.hosted.yaml config --services
```

Result: passed. Both returned `app`.

Post-QA rerun: passed. Both returned `app`.

```bash
npm run appliance:release -- --allow-missing-scanners
```

Result: passed.

Post-QA rerun: passed.

Warnings:

- No supported SBOM tool was available.
- No supported vulnerability scanner was available.

Blockers: none.
