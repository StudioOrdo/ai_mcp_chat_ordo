# Appliance Lifecycle Proof QA Review

Status: Open after Phase 01 closeout

Phase 00 closeout:

- Baseline evidence is complete in `evidence/00-baseline-evidence-2026-05-02.md`.
- The findings below remain open for implementation phases.

Phase 01 closeout:

- Prompt exposure budgeting is complete in `evidence/01-prompt-exposure-budget-2026-05-02.md`.
- The prior risk that lifecycle diagnostics would automatically expand the default assistant prompt is resolved for catalog-owned tools.

## Current Findings

1. The durable data boundary exists but is not yet proven as a lifecycle contract.
   - Evidence: `Dockerfile` declares `/app/.data`; `compose.yaml` mounts `./.data:/app/.data`; `README.md` documents named volumes.
   - Risk: documentation claims restore portability before a backup/restore harness proves it.

2. Runtime shape is partially implicit.
   - Evidence: `scripts/start-server.mjs` supervises a media worker, while `compose.yaml` can run `media-worker` as its own service.
   - Risk: health and support conversations may not know which worker profile is active.

3. Health exists in fragments.
   - Evidence: provider diagnostics, install checks, admin health, media worker health, job status, and data path checks exist in separate surfaces.
   - Risk: operators get partial answers instead of one appliance-level readiness result.

4. Backup/restore is not visible as a first-class capability.
   - Evidence: source search shows `.data` documentation and volume handling but no obvious manifest-backed backup/restore service.
   - Risk: a user can preserve a Docker volume, but cannot verify a portable archive or restore procedure.

5. Tool diagnostics have an explicit prompt exposure policy.
   - Evidence: `evidence/01-prompt-exposure-budget-2026-05-02.md`.
   - Status: resolved for catalog-owned tool projection; future lifecycle diagnostics should use `operator_only` or `internal_only` unless intentionally user-facing.

## QA Gate

This package should not be considered implemented until:

- the lifecycle contract is represented in code, not only docs;
- backup/restore has positive, negative, and edge tests;
- health readiness uses one shared facade across API/admin/CLI paths;
- the Docker or non-Docker lifecycle harness proves fresh install, restart, and restored data behavior;
- phase docs contain closeout evidence rather than planned-only statements.
