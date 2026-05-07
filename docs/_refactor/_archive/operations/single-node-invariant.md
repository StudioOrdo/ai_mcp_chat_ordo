# Single-Node Invariant

This system uses SQLite as its primary data store. SQLite provides
serialized writes via file-level locking, which means:

- Only ONE server process and ONE worker process may access the database.
- Both must run on the SAME host with access to the same filesystem.
- Horizontal scaling requires migrating to PostgreSQL (see Migration Path below).

## Runtime Guard

At startup, `scripts/start-server.mjs` acquires a file-based instance lock at
`$DATA_DIR/.server.lock` (default `.data/.server.lock`). If the lock file
already exists, the server refuses to start with an error message.

The lock is released on graceful shutdown (SIGTERM / SIGINT). If the server
crashes, the lock file must be removed manually before restarting.

## SQLite Pragmas

The database connection (`src/lib/db/index.ts`) applies:

- `journal_mode = WAL` — enables concurrent readers alongside the single writer.
- `busy_timeout = 5000` — waits up to 5 seconds on lock contention before returning SQLITE_BUSY.

## What Breaks if Violated

- Concurrent writes from multiple processes → SQLITE_BUSY / data corruption.
- Deferred jobs polled by a worker on a different host → jobs never processed.
- Embedding indexes built on one node → invisible to queries on another.

## Migration Path to PostgreSQL

1. Replace the better-sqlite3 driver with a PostgreSQL driver (e.g., `pg` or Drizzle PostgreSQL).
2. Update DataMapper implementations (most are already abstracted behind repository interfaces).
3. Replace the file-based lock with `pg_advisory_lock` or similar.
4. Test all repository integration tests against PostgreSQL.
