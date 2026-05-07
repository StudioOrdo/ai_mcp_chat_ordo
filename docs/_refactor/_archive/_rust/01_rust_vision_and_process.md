# The Rust Architecture: Vision & Process

Studio Ordo is designed as an autonomous, self-contained AI business appliance. While TypeScript and Next.js handle the "Cognitive Layer" (UI, Agent routing, Prompt governance), Rust handles the "Bare Metal Layer" (Backups, Core I/O, File System integrity).

## 1. The Vision: A Distributed, Local OS
The introduction of Rust into the monorepo is an architectural expansion to guarantee resilience. 

We utilize a **Database Event Bus** pattern:
- **Zero API Overhead:** The Node.js ecosystem and the Rust ecosystem never communicate over HTTP or native FFI bindings. They communicate entirely through the SQLite database.
- **The Domain Split:** Node.js writes tasks to the `job_requests` table (The Cognitive Queue). Rust polls the `system_commands` table (The Bare Metal Queue). 
- **The Watchdog Resilience:** If the Node.js event loop deadlocks while processing a massive LLM payload, the Rust daemon is entirely unaffected. It continues to execute scheduled backups, process restores, and manage the system's hard state independently.

## 2. The Elite Development Process
To ensure 100% reliability and memory safety, all Rust development within the `crates/` workspace strictly adheres to the following pipeline:

### Toolchain & Supply Chain
- **Toolchain Pinning:** A `rust-toolchain.toml` guarantees all developers and CI pipelines use the exact same compiler version (e.g., `1.81.0`).
- **Dependency Auditing:** `cargo-deny` is configured in `deny.toml` to actively block any crates that violate AGPL-3.0 compatibility or contain known security vulnerabilities.

### Quality Assurance
- **Ruthless Linting:** Every crate must define `#![deny(clippy::all)]` and `#![warn(clippy::pedantic)]` at the top of `src/main.rs` or `src/lib.rs`.
- **Error Handling:** We use `anyhow` for binary application context and `thiserror` for strict library error definitions. `.unwrap()` is banned in production logic.
- **Test-Driven Isolation:** Core logic is tested using isolated, temporary filesystems (e.g., the `tempfile` crate) to prove SQLite locks and I/O operations work before integration.

---

## 3. The Recovery Partition: `ordo-backup`
The foundational implementation of this vision is the `ordo-backup` crate—a standalone "Recovery Partition" daemon capable of executing system state backups and restores without locking the Node.js interface.

### How Node Interfaces with Rust
The API boundary is strictly defined by the `system_commands` table in SQLite, which utilizes JSON payloads for bidirectional data passing. 

#### Requesting a Backup
When the Next.js UI or AI Agent needs to schedule a backup (or guarantee a rollback point), it executes:
```sql
INSERT INTO system_commands (id, target, command, status) 
VALUES ('<uuid>', 'rust_daemon', 'backup', 'pending');
```
The Rust daemon processes the backup, safely snapshots the active database using the `rusqlite` Backup API (without breaking Next.js WAL operations), compresses the `blog-assets` and `user-files`, and returns the artifact path via the `result_payload`:
`{"snapshot_path": ".data/backups/snapshot_YYYYMMDD_HHMMSS.zip"}`

#### Requesting a Restore
When the UI needs to roll back the system, it queries `system_commands` for available backups and issues a restore command passing the target snapshot:
```sql
INSERT INTO system_commands (id, target, command, status, payload_json) 
VALUES ('<uuid>', 'rust_daemon', 'restore', 'pending', '{"snapshot_path": ".data/backups/snapshot_20260502_183024.zip"}');
```

### The Restore Engine (`restore.rs`)
The restoration process is designed for absolute safety:
1. **Staging:** The daemon unpacks the requested `.zip` into `.data/.restore_staging/`.
2. **Safe DB Swap:** It uses the `rusqlite::backup` API *in reverse*, injecting the staged `local.db` pages directly into the live Next.js Database connection. This safely overwrites the database without causing "Database is locked" errors or corrupting active Node reads.
3. **Asset Swap:** It atomically replaces the live `blog-assets` and `user-files` directories with the unpacked versions.
4. **Cleanup:** It deletes the staging directory and marks the row `complete`.

### Dual CLI Mode
The binary runs under two `clap` subcommands:
- `ordo-backup daemon`: The infinite polling loop used in production.
- `ordo-backup mock-trigger` / `mock-restore`: CLI commands used for isolated development and CI testing to simulate Node.js inserting records into the database.
