# Admin Processes Runbook

All one-off admin commands run in the same codebase/runtime as the app via `tsx`.

This document is intentionally narrow: these are operational commands, not feature-delivery commands. Students should pair this with `agentic-delivery-playbook.md` so they understand the difference between runtime diagnostics and implementation QA.

## Commands

- `npm run admin:validate-env`
  - Validates required runtime configuration.
  - Exits with status `1` on failure.

- `npm run admin:health`
  - Runs liveness/readiness sweep and emits JSON output.
  - Exits with status `1` if readiness fails.

- `npm run admin:diagnostics`
  - Emits a diagnostics JSON snapshot (app/runtime/version/model/release-manifest presence/metrics).

## Incident Usage

1. Run `npm run admin:validate-env` to detect config drift.
2. Run `npm run admin:health` to verify readiness.
3. Run `npm run admin:diagnostics` and attach output to incident notes.

## Teaching Notes

- `admin:validate-env` is for configuration correctness, not business-logic testing.
- `admin:health` is for service readiness, not UI acceptance.
- `admin:diagnostics` is for runtime state snapshots, not architecture documentation.

This distinction matters because LLM-assisted teams often over-claim verification by mixing operational checks with product QA.

## Related Docs

- Referral and affiliate operations: `docs/operations/referral-affiliate-runbook.md`

## CI/Automation

- Commands are non-interactive and shell-friendly.
- Parse outputs as JSON for alerting and diagnostics pipelines.
