# Appliance Lifecycle Proof Validation Checklist

Status: Planned

## Unit Tests

- Prompt exposure policy:
  - default prompt excludes operator-only and internal-only diagnostics.
  - executable registry still contains hidden tools for authorized paths.
  - intent-gated tools can be projected when explicitly requested.

- Health facade:
  - all probes pass and readiness returns healthy.
  - writable data directory check fails with a clear blocker.
  - SQLite open/schema/write check failures map to actionable diagnostics.
  - optional media/image/audio capabilities report disabled instead of failed when keys or providers are absent.
  - media worker unavailable produces degraded media status without breaking core chat readiness.

- Backup/restore:
  - manifest includes version, timestamp, included paths, exclusions, and checksums.
  - archive excludes caches, lock files, build output, and non-durable runtime noise.
  - restore rejects path traversal.
  - restore rejects checksum mismatch.
  - restore rejects unsupported future manifest versions.
  - restore requires explicit overwrite behavior when target data exists.

## Integration Tests

- Install check route reports provider, database, and data directory readiness consistently.
- Admin health/diagnostics loader consumes the same health facade as API and CLI paths.
- Backup command creates an archive from a fixture `.data` tree.
- Restore command restores fixture data and passes health checks against the restored path.
- Job/media/search capability state is reflected in diagnostics.

## Docker Smoke Tests

- Fresh container starts with empty named volume.
- Restarted container preserves configuration.
- Container with restored data volume passes readiness.
- Compose app waits for healthy media worker when media worker profile is enabled.
- Missing or unwritable mounted `.data` fails loudly.

## Functional QA

- Admin sees a concise appliance status: healthy, degraded, or blocked.
- Disabled optional capabilities are explained without alarming users.
- Restore instructions are short enough for a non-expert operator to follow.
- Health output avoids leaking provider keys, database contents, or secrets.

## Required Commands During Closeout

- `npm run typecheck`
- focused lifecycle unit/integration tests added by the package
- `npm run test`
- Docker lifecycle smoke command added by Phase 05, when Docker is available

If Docker is unavailable during a QA pass, record that explicitly in evidence and run the non-Docker harness against temporary data directories.
