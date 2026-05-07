# Phase 05E Evidence - Release Supply Chain And Image Provenance

Captured: 2026-05-03T07:14:58.717Z

Status: passed

## Source

- Git revision: c99b37a
- Git branch: main
- Dirty worktree: yes
- package-lock sha256: ab7df8612a7970f3661eee6dc4890534c3b15a0fd092e9d74f78d8e798c829b6
- Cargo.lock sha256: 698f9b548a902d69acd0cd46f3dd8159c24f12fa3e33522346b84c161ae30def
- Dockerfile sha256: d3195d4a36627c9b4adc7ce7930fa19362f627003913801926abc5c8f8dd4449

## Toolchains

- Node: v22.22.2
- npm: 10.9.7
- rustc: rustc 1.94.0 (4a4ef493e 2026-03-02) (Homebrew)
- cargo: cargo 1.94.0 (Homebrew)
- Docker: 29.1.2

## Image

- Tag: studioordo:05e-c99b37a
- ID: sha256:24b91cc124f410a85569b0298f14fa53ce59d06df5bbfb512a6e8ffd75f18a8c
- Digest: unavailable
- Size bytes: 3827069354
- User: nextjs
- Exposed ports: 3000/tcp
- Base images: node:${NODE_VERSION}-alpine AS deps, rust:1-alpine AS rust-builder, node:${NODE_VERSION}-alpine AS builder, node:${NODE_VERSION}-alpine AS runner

## Gates

- PASSED native runtime check: > studio-ordo@0.1.0 native:check > node scripts/check-native-runtime.mjs better-sqlite3 tsx (374ms)
- PASSED environment validation: > studio-ordo@0.1.0 validate:env > tsx scripts/validate-env.ts Environment validation passed. (781ms)
- PASSED tracked secret scan: > studio-ordo@0.1.0 scan:secrets > node scripts/scan-secrets.mjs Secret scan passed. (11377ms)
- PASSED typecheck: > studio-ordo@0.1.0 typecheck > tsc --noEmit (3403ms)
- PASSED focused image contract tests: ✓ tests/image-security-contract.test.ts (3 tests) 7ms ✓ tests/appliance-resource-contract.test.ts (3 tests) 5ms ✓ tests/image-runtime-bundle-contract.test.ts (6 tests) 8ms ✓ tests/appliance-lifecycle-smoke.test.ts (3 tests) 8ms Test Files  7 passed (7) Tests  20 passed (20) Start at  03:15:15 Duration  1.42s (transform 331ms, setup 2.28s, import 308ms, tests 41ms, environment 5.49s) (2092ms)
- PASSED rust formatting: completed (229ms)
- PASSED rust tests: test pre_restore_backup_links_snapshot_to_restore_plan ... ok test stale_running_command_recovery_marks_expired_work_failed ... ok test restore_rejects_data_boundary_escape_before_live_mutation ... ok test restore_rejects_hash_mismatch_before_live_mutation ... ok test restore_replays_sqlite_and_assets_from_valid_archive ... ok test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s running 0 tests test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s (753ms)
- PASSED rust clippy: completed (240ms)
- PASSED release manifest generation: Release manifest generated at [path] (126ms)
- PASSED release manifest verification: > studio-ordo@0.1.0 release:verify > node scripts/validate-release-manifest.mjs Release manifest validation passed. (275ms)
- PASSED local compose services: app (196ms)
- PASSED hosted compose services: app (81ms)
- PASSED Docker image build: completed (76697ms)
- PASSED Docker image inspect: image metadata captured (26ms)
- PASSED runner image content assertion: runner-image-ok (249ms)

## SBOM

- Tool: unavailable
- Status: skipped
- Artifact: none
- Summary: No supported SBOM tool was available.

## Vulnerability Scan

- Tool: unavailable
- Status: skipped
- Critical: unknown
- High: unknown
- Artifact: none
- Summary: No supported vulnerability scanner was available.

## Signing

- Tool: unavailable
- Status: skipped
- Artifact: none
- Summary: Signing skipped.

## Warnings

- No supported SBOM tool was available.
- No supported vulnerability scanner was available.

## Blockers

- none
