# Phase 05 Evidence - Docker And Worker Verification

Captured: 2026-05-03T03:50:47.540Z

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

- Manual backup: none
- Scheduled backup: none
- Archive size: unknown
- Archive hash prefix: unknown
- Restore plan: none
- Restored seed file: no
- Restart verified: no

## Steps

- PASSED prepare temp data boundary: completed (1ms)
- PASSED install Rust backup executor: executor available (17987ms)
- PASSED initialize SQLite schema: schema initialized (54ms)
- PASSED read appliance health: completed (538ms)
- FAILED create manual backup through Rust: Rust backup executor run-once failed:  (148ms)

## Warnings

- Rust backup executor run-once failed: 
