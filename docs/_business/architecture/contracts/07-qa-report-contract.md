# QA Report Contract

## Purpose

A QA report is a structured judgment about whether work satisfies declared
criteria.

It is also the required intake object for implementation work entering the
governed delivery pipeline.

## Source Of Truth Owner

QA gate system.

## Current Status

`partial`

## Current Anchors

- `src/core/entities/qa-report.ts`
- `src/core/entities/factory-asset.ts`
- `src/lib/blog/blog-article-production-service.ts`
- `src/core/entities/blog-artifact.ts`

## Required Contract

A QA report must record:

- QA report id
- schema version
- target ref
- target type
- work order id when applicable
- stage run id when applicable
- disposition
- lifecycle state
- criteria evaluated
- findings
- reviewer actor or process
- evidence refs
- required revisions
- auto-resolvable count or flag
- requires human decision flag
- supersedes report id when applicable
- created timestamp

Each finding must record:

- finding id
- severity
- criterion
- message
- affected ref
- evidence refs
- recommended action
- auto-resolvable flag

## Current Implementation Coverage

Current factory QA already records:

- id
- schema version
- work order id
- status
- total findings
- passed and failed criteria
- asset reports
- page findings
- recommended fixes
- auto-resolvable count
- requires user decision flag
- created timestamp

Blog QA is currently persisted as blog artifacts.

## Contract Additions

The platform contract still needs:

- target ref and target type
- stage run id when applicable
- reviewer actor or process
- evidence refs
- required revisions
- supersedes report id
- a split between QA disposition and report lifecycle

## Disposition

- `passed`
- `passed_with_warnings`
- `failed`
- `needs_review`

## Lifecycle

- `active`
- `resolved`
- `superseded`

## Event And Projection Expectations

- QA report creation, resolution, supersession, and human decision should be
  projectable.
- Blocking findings should appear as work-order next actions.
- QA projections should show disposition, target, severity, and evidence refs
  without requiring consumers to parse domain-specific payloads.
- A resolved QA report should remain linked to the report it superseded or
  resolved.
- QA-accepted reports should be able to emit or link to a GitHub issue id for
  StudioOrdo execution tracking.

## Boundaries

QA reports judge work. They should not perform the revision themselves.

## Must Not Absorb

- artifact payloads
- recipe definition
- release record
- implementation patch
- business funding priority

## Migration Notes

Current factory QA is asset/page-oriented. Blog QA is persisted as blog artifacts.
The generic contract should wrap these existing payloads rather than forcing
every domain into one flat finding model immediately.

## Positive Cases

- A draft fails QA for unsupported claims and records evidence refs.
- A generated image passes accessibility but warns on brand consistency.
- A development report becomes a QA report with repro steps and logs.

## Negative Cases

- A QA report should not be just a prose paragraph.
- A QA report should not require release to know why it failed.
- A QA report should not erase failed findings after automatic repair.
- A feature request should not bypass QA by entering as an unstructured comment
  thread.

## Edge Cases

- A report can pass with warnings.
- A report can require human review without an automated failure.
- A report can supersede an older report after revision.
- A QA stage can produce no artifact except the QA report.
