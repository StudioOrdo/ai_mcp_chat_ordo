# Phase 02 Evidence - Runtime Shape And Lifecycle Contract

Date: 2026-05-02

## Implementation Summary

Phase 02 added read-only appliance lifecycle contracts without changing worker spawning behavior, compose topology, backup/restore behavior, or health readiness semantics.

Code added:

- `src/lib/appliance/data-boundary.ts`
  - centralizes `DATA_DIR`, SQLite path, SQLite WAL/SHM siblings, blog asset root, user-file root, include paths, exclude paths, and outside-boundary warnings.
- `src/lib/appliance/runtime-profile.ts`
  - describes app runtime profile, process role, Docker/container signal, compose signal, media-worker mode, deferred-worker mode, data dir, SQLite path, and warnings.

Code integrated:

- `src/lib/db/index.ts`
  - delegates SQLite path resolution to the shared data boundary.
- `src/lib/user-files.ts`
  - preserves `getDataRootPath()` and `getUserFilesRootPath()` exports while delegating to the shared data boundary.
- `src/lib/blog/blog-asset-storage.ts`
  - preserves `STUDIO_ORDO_BLOG_ASSET_ROOT` behavior while delegating root calculation to the shared data boundary.
- `scripts/start-server.mjs`
  - adds non-behavioral runtime marker envs for app role and supervised/disabled/external media-worker mode.
- `scripts/dev.mjs`
  - adds non-behavioral runtime marker envs for app role and local-dev/disabled media-worker mode.
- `README.md`
  - documents the appliance runtime profile/data boundary location and purpose.
- `tests/docker-runtime-contract.test.ts`
  - updated to assert centralization through `src/lib/appliance/data-boundary.ts`.

Tests added:

- `src/lib/appliance/data-boundary.test.ts`
- `src/lib/appliance/runtime-profile.test.ts`

## Closeout QA

QA found one implementation gap after the first completion pass:

- `detectDocker()` returned `false` immediately when `/.dockerenv` inspection threw, so it could skip `/proc/1/cgroup` fallback detection.

Resolution:

- Updated `detectDocker()` to treat an inaccessible `/.dockerenv` check as non-decisive and continue to cgroup detection.
- Added a regression test proving cgroup detection still works when `/.dockerenv` cannot be inspected.

## Regression Commands

Targeted Phase 02 regression:

```bash
npm test -- --run src/lib/appliance/data-boundary.test.ts src/lib/appliance/runtime-profile.test.ts tests/docker-runtime-contract.test.ts tests/runtime-supervision-contract.test.ts tests/env-centralization.test.ts tests/health-probes.test.ts src/lib/health/probes.test.ts
```

Result:

```text
Test Files  7 passed (7)
Tests       43 passed (43)
```

Typecheck:

```bash
npm run typecheck
```

Result:

```text
tsc --noEmit
```

Exited successfully.

Touched-file lint:

```bash
npm run lint -- src/lib/appliance/data-boundary.ts src/lib/appliance/runtime-profile.ts src/lib/appliance/data-boundary.test.ts src/lib/appliance/runtime-profile.test.ts src/lib/db/index.ts src/lib/user-files.ts src/lib/blog/blog-asset-storage.ts
```

Result: exited successfully.

Full unit suite:

```bash
npm test -- --run
```

Result:

```text
Test Files  689 passed (689)
Tests       4981 passed | 2 skipped (4983)
```

## Exit Criteria Check

- Runtime profile contract exists in code: satisfied.
- Data boundary contract exists in code: satisfied.
- SQLite path resolution is shared between the contract and `src/lib/db/index.ts`: satisfied.
- `DATA_DIR`, blog asset root, and user file root calculations are no longer separately implemented in DB, user-files, and blog-asset modules: satisfied.
- Startup scripts do not duplicate incompatible runtime assumptions: satisfied through non-behavioral marker envs only.
- Contract can represent single-image, compose, dev, test, disabled, and external worker shapes: satisfied by tests.
- Contract records warnings without crashing for degraded-but-describable configurations: satisfied by tests.
- README lifecycle wording matches implemented contract: satisfied.
- Phase 03 can consume the contract without rereading Docker, compose, or startup scripts: satisfied.
