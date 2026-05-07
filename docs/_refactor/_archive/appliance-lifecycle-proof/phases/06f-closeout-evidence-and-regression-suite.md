# Phase 06F - Closeout Evidence And Regression Suite

Status: Planned

## Goal

Close the appliance lifecycle proof with evidence that the system is usable,
documented, role-gated, and regression-protected.

This is the final package closeout phase for appliance lifecycle proof.

## Scope

Closeout must cover:

- runtime help corpus
- role-gated content access
- custom help/action cards
- admin and staff help surfaces
- backup/restore self-service
- appliance health explanation
- Docker/image/runtime docs
- release and resource posture docs
- evidence index
- validation checklist

## Required Regression Proof

Run and record:

- typecheck
- focused corpus ACL tests
- focused custom-message/action tests
- focused appliance health tests
- focused backup/restore self-service tests
- Docker/compose contract tests
- release gate or documented release-gate dry run

## Required Access-Control Proof

For each protected documentation tier, prove:

- hidden docs are absent from summaries
- hidden docs are absent from search
- hidden docs are rejected by section fetch
- hidden docs cannot be opened through direct route aliases
- hidden docs are not cited in lower-role chat answers
- hidden docs do not produce lower-role action buttons

## Documentation Closeout

Update:

- `docs/_refactor/appliance-lifecycle-proof/phases/README.md`
- `docs/_refactor/appliance-lifecycle-proof/qa-review.md`
- validation checklist
- evidence directory
- README/help references if needed
- corpus book/chapter index

## Exit Criteria

- All 06x phases are complete.
- Product help reflects the current implemented appliance, not aspirational
  features.
- Role gates are tested across content, routes, search, chat, and actions.
- Admin/staff users have self-service operational help.
- The package can be handed to a future implementation agent without requiring
  tribal memory from this conversation.
