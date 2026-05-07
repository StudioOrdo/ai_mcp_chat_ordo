# Phase 05 Evidence - Docker And Worker Verification

Captured: 2026-05-03T03:47:27.565Z

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

- Manual backup: backup_54168e7f-e3f1-4881-a1f4-a6da09c4f8be
- Scheduled backup: backup_dc56d430-98c0-47ad-8a1a-c151c8d30135
- Archive size: 32541
- Archive hash prefix: sha256:8b5a523d0d3f9
- Restore plan: restore_b7add271-b2fe-4f9f-a354-02f7d1c959ec
- Restored seed file: no
- Restart verified: no

## Steps

- PASSED prepare temp data boundary: completed (1ms)
- PASSED install Rust backup executor: executor available (0ms)
- PASSED initialize SQLite schema: schema initialized (50ms)
- PASSED read appliance health: completed (539ms)
- PASSED create manual backup through Rust: completed (35ms)
- PASSED verify restart-persistent seed data: seed file readable (0ms)
- PASSED enqueue and complete scheduled backup: completed (26ms)
- FAILED prepare and execute restore: Rust backup executor run-once failed: Error: FOREIGN KEY constraint failed

Caused by:
    Error code 787: Foreign key constraint failed
 (59ms)

## Warnings

- Rust backup executor run-once failed: Error: FOREIGN KEY constraint failed

Caused by:
    Error code 787: Foreign key constraint failed

