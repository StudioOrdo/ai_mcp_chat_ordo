# Appliance Lifecycle Contract Spec

Status: Planned

## Contract

Ordo must behave as a portable appliance cell:

- The runtime image can start without external database, search, vector, media, queue, or cache services.
- The `.data` directory is the durable state boundary.
- Provider keys and selected models are governed by the provider configuration system completed in `docs/_refactor/provider-capability-configuration`.
- Optional capabilities such as image generation, text-to-speech, local media composition, and future local speech transcription can be disabled without breaking chat or admin health.
- Health diagnostics explain whether the appliance is usable, degraded, or blocked.

## Canonical Runtime Shape

The implementation should make one canonical shape explicit:

- Single-image production path: `scripts/start-server.mjs` launches the web app and supervises required in-image workers.
- Compose path: `compose.yaml` may split the media worker into a second service, but it remains one appliance cell that shares the same `.data` contract.

The health envelope must report which runtime profile is active so operators can understand whether worker failures are in-process, supervised child processes, or compose services.

## Durable State Contract

The durable state boundary is `.data`.

Required:

- SQLite database path resolution through the existing config path.
- Blog/media/user assets stored under configured data roots.
- Backup manifest containing application version, created time, included paths, excluded paths, checksum data, and restore compatibility information.
- Restore validation before writing over live data.
- Clear exclusions for runtime logs, caches, lock files, and generated build artifacts.

Forbidden:

- Secrets in backup manifests.
- Path traversal during restore.
- Silent partial restore success.
- Backup commands that require a running external service.

## Health Contract

Health must distinguish:

- liveness: the process can answer.
- readiness: the appliance can serve configured core workflows.
- diagnostics: detailed component status for admins.

The readiness envelope should include:

- data directory exists and is writable
- SQLite can open, read schema state, and perform a bounded write check
- provider configuration can resolve effective chat provider/model
- required tools are enabled and optional tools are clearly disabled or degraded
- deferred job runtime status is known or explicitly unavailable
- media worker status is reachable or intentionally disabled
- search/index status is known, including embedding model/version mismatch if detectable
- backup/restore support is available for the configured data path

## Positive Use Cases

- Fresh Docker run creates `.data`, completes install, validates provider, restarts, and remains configured.
- Named Docker volume is moved to a new container and passes readiness.
- Backup archive is produced from `.data`, restored into a clean data directory, and passes readiness.
- Optional OpenAI image/audio capabilities remain disabled when no OpenAI key is configured while chat still works through another provider.
- Compose media worker reports healthy and media capability is available.

## Negative Use Cases

- `.data` is not writable.
- SQLite database is missing, locked, corrupt, or schema-incompatible.
- Provider configuration is incomplete after install.
- Media worker is down while media tools remain enabled.
- Backup archive checksum does not match.
- Restore archive attempts path traversal.
- Backup manifest was produced by an unsupported future version.

## Edge Use Cases

- Env overrides point SQLite outside `.data`.
- Restore target already contains a database.
- Backup was created before manifest support.
- Data directory contains large media assets.
- Runtime logs are present but should not be required for restore.
- The app runs on macOS, Linux, or Windows-mounted volumes with different permission behavior.
- Compose and single-image runtime profiles report worker state differently.

## Non-Goals

- Multi-node clustering.
- External object storage.
- Cloud backup providers.
- A2A commerce.
- Replacing SQLite.
- Rust rewrites before the TypeScript ports are stable.
