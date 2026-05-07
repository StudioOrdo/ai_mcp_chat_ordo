# Phase 04 - Backup Restore Service Index

Status: Index - implemented by the 04x safety series

## Goal

Implement backup and restore as a self-service appliance safety system for solopreneurs.

The reliability bar is intentionally high: an admin user with no technical background must be able to trust the system as the sole recoverable record of their business. Backup should be easy. Restore must be deliberate, validated, reversible where possible, and audited.

## Product Principle

Protect the solopreneur from:

- accidental destructive changes
- AI-agent mistakes
- failed experiments
- bad restores
- broken upgrades
- filesystem mistakes
- stale or missing backups

No implementation should optimize for cleverness over recoverability.

## Architecture Decision

Use TypeScript for governance and Rust for hard-state execution.

- TypeScript owns contracts, role policy, admin/conversation surfaces, health, manifests, command records, and restore confirmation flow.
- Rust owns durable filesystem and SQLite snapshot/restore execution once the command contract is safe.
- SQLite is the bridge. No HTTP service or native FFI is required for backup/restore.
- SQLite metadata stays intentionally small. It records operations, policy, snapshot identity, archive location, archive hash, size, validation status, and audit events. It does not mirror every archive file.
- Phase 04 uses archive-level integrity for v1. Rust should not compute or store file-by-file checksums unless a later requirement proves the cost is worth it.

The existing `crates/ordo-backup` code is a useful prototype, not yet a complete Phase 04 production implementation. It must be brought under the Phase 02 data boundary and Phase 04 manifest/validation contract before restore is trusted.

## 04x Phase Series

This file is not a standalone implementation phase. The backup/restore service is implemented by completing 04A through 04F.

- `04a-backup-governance-contract.md`
  - Define Node-owned contracts, schema, command repository, backup policy, and role/audit model.
- `04b-manifest-archive-and-validation.md`
  - Implement manifest-backed archive creation/reading/validation with archive-level integrity and path safety.
- `04c-restore-safety-pipeline.md`
  - Implement restore planning, staging validation, confirmation, pre-restore backup, and safe failure behavior.
- `04d-rust-backup-executor-integration.md`
  - Bring `ordo-backup` under the governed command/data-boundary/manifest contract.
- `04e-admin-and-conversation-self-service.md`
  - Add admin UI and operator-only conversational flows for list/create/validate/restore.
- `04f-automatic-backup-policy-and-health.md`
  - Add configurable automatic latest backup, retention, overdue detection, and real health probe integration.

## Non-Negotiable Safety Rules

- Restore validation must happen before writing to the live data directory.
- Restore must reject path traversal, absolute archive paths, symlinks, unsupported manifest versions, archive hash mismatches, and failed SQLite integrity checks.
- Restore must refuse to overwrite live data unless an explicit governed restore request is confirmed.
- Restore must create a `pre_restore` backup before modifying live state whenever the live system is readable.
- Retention cleanup must only run after a new backup has validated.
- Automatic backup must never overwrite the only known-good backup.
- Manifests must not contain secrets, API keys, env dumps, bearer tokens, or raw prompt content beyond what is already in the SQLite/user data being backed up.
- Conversation restore must never execute in one step. It must stage, summarize impact, and require explicit admin confirmation.
- Backup/restore tooling must remain hidden from default user chat and use `operator_only` or `internal_only` exposure.

## Current Grounding

Already completed:

- Phase 00 proved `.data` is the durable appliance boundary and found no governed appliance restore.
- Phase 01 added prompt exposure budgeting so lifecycle tools can be operator-only.
- Phase 02 added `getApplianceDataBoundary()` and `getApplianceRuntimeProfile()`.
- Phase 03 added the appliance health facade and a placeholder `backup_restore` probe.

Existing Rust:

- `crates/ordo-backup` can snapshot SQLite with `rusqlite::backup`.
- It can zip `local.db`, `blog-assets`, and `user-files`.
- It can poll `system_commands`.
- It currently hardcodes paths, lacks manifest/archive-level integrity validation, and restore extraction is not yet safe enough for production.

## Exit Criteria For The 04x Series

- Admins can create, list, validate, and request restore from admin pages.
- Admins can create/list/validate/request restore conversationally through operator-only tools.
- Restore requires a confirmation step and creates a pre-restore backup.
- Automatic backups can be disabled or configured on a simple interval.
- Latest successful backup status is visible in health and admin UI.
- Backup archives include a manifest and archive-level integrity hash.
- Restore rejects unsafe or incompatible archives before writing.
- Rust execution, if enabled, obeys the Node-owned command and data-boundary contract.
- Full positive, negative, and edge tests exist for backup, validation, restore safety, automatic backup policy, and health integration.
