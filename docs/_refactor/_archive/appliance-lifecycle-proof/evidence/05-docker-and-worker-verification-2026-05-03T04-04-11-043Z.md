# Phase 05 Evidence - Docker And Worker Verification

Captured: 2026-05-03T04:04:11.043Z

Mode: local
Status: passed

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

- Manual backup: backup_2fc54ab9-80ff-47a4-8b5f-7c99be5767fa
- Scheduled backup: backup_10c40cb5-2418-4147-8227-f74ff1bbd80b
- Archive size: 32529
- Archive hash prefix: sha256:683af2a053ced
- Restore plan: restore_3a2d5656-fdc6-4aa8-b416-7eea17c36327
- Restored seed file: yes
- Restart verified: yes

## Steps

- PASSED prepare temp data boundary: completed (1ms)
- PASSED install Rust backup executor: executor available (480ms)
- PASSED initialize SQLite schema: schema initialized (55ms)
- PASSED read appliance health: completed (591ms)
- PASSED create manual backup through Rust: completed (398ms)
- PASSED verify restart-persistent seed data: seed file readable (1ms)
- PASSED enqueue and complete scheduled backup: completed (30ms)
- PASSED prepare and execute restore: completed (88ms)

## Warnings

- none
