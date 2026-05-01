# Contract Rules

These rules apply to every kernel contract.

## Contract Status

Each contract should carry one current-code status:

- `exists`: current code already has the durable model.
- `partial`: current code has a domain-specific or incomplete model.
- `exists under another name`: current code has the behavior under a different
  boundary.
- `new concept`: current code needs a new contract before implementation.

## Required Sections

Every kernel contract should state:

- source-of-truth owner
- current-code status
- current anchors
- current implementation coverage
- contract additions
- required fields or references
- lifecycle states
- event/projection expectations
- boundaries
- exclusions
- migration notes
- positive cases
- negative cases
- edge cases

## Cross-Cutting Requirements

Every durable contract should support:

- stable id
- schema version
- owner or scope
- lifecycle state
- created and updated timestamps when persisted
- source refs or provenance refs when generated
- evidence refs when used for decisions or claims
- retention or privacy policy where user data is involved
- projection-friendly summaries

## Record And Ref Rule

Contracts should distinguish records from refs:

- A record is the durable source-of-truth object.
- A ref is a small pointer to a durable object.
- A ref should not be forced to carry every field from the record.
- A record may embed refs to other records when the other record owns its own
  lifecycle.

This matters most for artifacts and evidence. Stage 03 should define adapter
shapes that can reference existing records without flattening all payloads into
one generic object.

## Non-Negotiables

- Prompts can influence behavior, but prompts are not source-of-record state.
- UI cards are projections, not canonical write models.
- Connectors are capability implementations, not recipe definitions.
- Work orders and stage runs are the default execution backbone.
- New tables require a migration reason that existing repositories cannot satisfy.
- New abstractions must name the current code they reuse or intentionally replace.
