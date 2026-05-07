# Appliance Lifecycle Proof Phase Plan

Status: In progress - Phase 04 split into 04x safety series

## Phase Order

0. `phases/00-baseline-evidence.md` - Complete
   - Capture current Docker, data, health, worker, search, media, and setup behavior before implementation.

1. `phases/01-prompt-exposure-budget-prerequisite.md` - Complete
   - Implement the minimal tool prompt exposure classification needed so lifecycle diagnostics do not bloat the default assistant tool surface.

2. `phases/02-runtime-shape-and-lifecycle-contract.md` - Complete
   - Make the appliance runtime profile explicit and define the data directory lifecycle contract in code-facing docs and contracts.

3. `phases/03-appliance-health-facade.md` - Complete
   - Consolidate readiness and diagnostics through a facade that composes narrow health probes.

4. `phases/04-backup-restore-service.md` - Index
   - Backup and restore are implemented through the 04x series; there is no separate monolithic Phase 04 implementation.

4a. `phases/04a-backup-governance-contract.md` - Complete
   - Define Node-owned backup/restore commands, policy, snapshots, schema, roles, and audit before execution.

4b. `phases/04b-manifest-archive-and-validation.md` - Complete
   - Defined manifest-backed archive validation, archive-level integrity, compatibility, exclusions, snapshot validation transitions, and path safety.

4c. `phases/04c-restore-safety-pipeline.md` - Complete
   - Added restore planning, archive revalidation, impact summaries, pre-restore backup gating, explicit confirmation, guarded restore command authorization, and audit. Raw restore I/O remains Phase 04D.

4d. `phases/04d-rust-backup-executor-integration.md` - Complete
   - Replaced the Rust backup prototype with the governed Node-owned command/data-boundary/manifest executor, safe restore staging, Docker supervision, health projection, and evidence.

4e. `phases/04e-admin-and-conversation-self-service.md` - Complete
   - Added backup/restore read models, shared self-service facade, admin UI/API, operator-only conversation tools, and Rust-boundary protections. Policy editing remains Phase 04F.

4f. `phases/04f-automatic-backup-policy-and-health.md` - Complete
   - Added configurable automatic latest backup, retention, overdue detection, scheduler supervision, policy update, admin/conversation controls, and real backup health integration.

5. `phases/05-docker-and-worker-verification-harness.md` - QA certified for single-image implementation
   - Move Docker/compose to one supported app image, then add repeatable local and Docker appliance smoke verification for fresh install, supervised workers, Rust executor, backup scheduler, manual/scheduled backup, restart, restore, health, and evidence.

6. `phases/06-admin-docs-and-closeout.md` - Planned
   - Expose the lifecycle state in admin surfaces, update install docs, and close the package with evidence.

## Dependency Rules

- Phase 01 must happen before making new diagnostics conversationally visible.
- Phase 03 depends on Phase 02 contracts.
- Phase 04A depends on Phase 02 data boundary decisions and Phase 01 prompt exposure rules.
- Phase 04B depends on Phase 04A contracts.
- Phase 04C depends on Phase 04A commands and Phase 04B archive validation.
- Phase 04D depends on Phase 04A-04C and the existing `crates/ordo-backup` prototype.
- Phase 04E depends on Phase 04A-04D and must keep backup/restore tools operator-only.
- Phase 04F depends on Phase 04A, Phase 04B, Phase 04D, and Phase 03 health.
- Phase 05 depends on Phases 03 and the complete 04x series.
- Phase 06 closes only after tests and evidence prove the contract.

## Implementation Bias

- Prefer small ports and composition roots over route-local logic.
- Keep backup/restore logic independent of Next.js route handlers.
- Add characterization tests before pruning lifecycle-adjacent code.
- Remove duplicate health or data-path helpers only after an equivalent lifecycle contract covers them.
