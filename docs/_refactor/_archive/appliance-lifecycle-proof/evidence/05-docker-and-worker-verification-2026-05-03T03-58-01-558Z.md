# Phase 05 Evidence - Docker And Worker Verification

Captured: 2026-05-03T03:58:01.558Z

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

- Manual backup: backup_59c65f24-780f-49cf-8a0c-ce76d5d41abd
- Scheduled backup: backup_02a49d06-d63b-4a63-83c4-35745184e28c
- Archive size: 32530
- Archive hash prefix: sha256:c2658b91962ef
- Restore plan: restore_95f3c29b-863d-4eab-af41-d0294a965883
- Restored seed file: yes
- Restart verified: yes

## Steps

- PASSED prepare temp data boundary: completed (2ms)
- PASSED install Rust backup executor: executor available (419ms)
- PASSED initialize SQLite schema: schema initialized (55ms)
- PASSED read appliance health: completed (599ms)
- PASSED create manual backup through Rust: completed (294ms)
- PASSED verify restart-persistent seed data: seed file readable (1ms)
- PASSED enqueue and complete scheduled backup: completed (30ms)
- PASSED prepare and execute restore: completed (80ms)

## Warnings

- none
