# AgentOS Operation Kernel Validation Checklist

Status: Implemented and used for Phase 11 closeout on 2026-05-03

## Code-Level Validation

- Operation domain tests cover allowed status transitions and invalid
  transitions.
- Operation action authorization covers anonymous, authenticated, apprentice,
  staff, and admin roles.
- Action payload validation rejects missing IDs, stale revisions, malformed
  payloads, disabled actions, unauthorized actions, and expired actions.
- Intent compiler output is schema-validated before operation creation.
- Prompt grounding tests prove current operation state and relevant tool
  evidence enter backend model input.
- Chat projection tests prove operation cards/buttons are rendered from
  operation state and do not execute through synthetic chat text.

## Integration Validation

- Operation tables migrate cleanly on a greenfield SQLite database.
- Backup/restore operation flow creates steps, actions, events, artifacts, and
  native reconciliation evidence.
- Media workflow operation flow projects worker status into operation state.
- Factory work order operation flow projects stages/checkpoints into operation
  state.
- Help and onboarding flows are operation-backed and role-aware.
- Operation action API advances state through dispatch, not chat message sends.
- Admin, operations workspace, and conversation UI read the same operation read
  model.
- Health facade reports operation queue/native executor posture.

## Functional Validation

- User asks for a backup and gets a clear operation card with a primary button.
- Admin asks for restore and cannot execute until the plan and safety pipeline
  are complete.
- User starts a media workflow and can see progress, retry, cancel, and
  artifacts.
- Staff starts or triages a factory work order and sees stages, decisions, and
  issue/output evidence.
- Public, member, apprentice, staff, and admin help paths return role-appropriate
  documentation.
- Public behavior presents the CEO chief-of-staff public face, not a sales
  personality.

## Negative Validation

- Stale restore button fails safely and displays current operation state.
- Unauthorized roles cannot run admin/system actions.
- Disabled or missing tools/providers block action creation or dispatch with a
  clear disabled reason.
- Missing Rust binary blocks native execution and records health/evidence.
- Failed jobs/tools/native commands cannot be summarized as success.
- Ambiguous user request becomes a clarifying question, not a guessed action.
- Anonymous corpus search cannot reveal member, apprentice, staff, or admin
  system docs.

## Edge Validation

- Two browser tabs pressing the same action do not double-execute it.
- Server restart preserves operation state in SQLite.
- Reconciler replays are idempotent.
- Operation state remains correct across conversation refresh.
- Role changes between card render and action click fail closed.
- Mixed-audience corpus results are filtered by role for search and full-section
  reads.
- Docker image has app code plus executable native binary; missing binary is a
  visible health problem.
- Release evidence is generated with redaction and no local secret leakage.

## Docker, Rust, And Appliance Validation

- Single Docker image includes Node runtime, Rust `ordo-backup`, workers, MCP
  server code, corpus docs, health checks, and entrypoint.
- Container runs with the hardened runtime contract created in the appliance
  lifecycle package.
- `/app/.data` remains the durable data boundary.
- Local development and Docker share the same native binary contract.
- Rust checks are part of the release gate:
  `cargo fmt --check`, `cargo test -p ordo-backup`, and
  `cargo clippy -p ordo-backup -- -D warnings`.

## Evidence

Final command outcomes and guardrail searches are recorded in:

- `docs/_refactor/agentos-operation-kernel/evidence/phase-11-closeout.md`
