# Phase 05 Evidence - Docker And Worker Verification

Captured: 2026-05-03T03:49:50.001Z

Mode: local
Status: failed

## Runtime

- Node: v22.22.2
- Rust: rustc 1.94.0 (4a4ef493e 2026-03-02) (Homebrew)
- Image: not used
- Git revision: c99b37a
- Data directory label: .data
- App port: not started
- Media port: not started
- Executor path: /Users/kwilliams/Projects/ordoSite/bin/ordo-backup

## Health

- Status: degraded
- Warnings: 1

## Backup And Restore

- Manual backup: backup_fa7b5de0-a539-45ea-ae66-2729c0704d8a
- Scheduled backup: backup_83433692-b868-4d5c-b646-d9cc69c4065c
- Archive size: 32530
- Archive hash prefix: sha256:bea78335622f0
- Restore plan: restore_d5474d99-e3be-4252-86d3-f223d1cf1eee
- Restored seed file: no
- Restart verified: no

## Steps

- PASSED prepare temp data boundary: completed (7ms)
- PASSED install Rust backup executor: executor available (1ms)
- PASSED initialize SQLite schema: schema initialized (161ms)
- PASSED read appliance health: completed (1422ms)
- PASSED create manual backup through Rust: completed (40ms)
- PASSED verify restart-persistent seed data: seed file readable (1ms)
- PASSED enqueue and complete scheduled backup: completed (33ms)
- FAILED prepare and execute restore: Rust backup executor run-once failed: Error: FOREIGN KEY constraint failed

Caused by:
    Error code 787: Foreign key constraint failed
 (71ms)

## Warnings

- Rust backup executor run-once failed: Error: FOREIGN KEY constraint failed

Caused by:
    Error code 787: Foreign key constraint failed

