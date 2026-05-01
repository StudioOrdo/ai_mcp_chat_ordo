# Ordo Development Workflow

## Purpose

The development of Ordo should be a first-class workflow inside Ordo.

This dogfoods the platform thesis: AI can generate implementation quickly, but
QA, evidence, prioritization, and release confidence are the bottlenecks.

## Workflow

```text
problem report
-> evidence capture
-> triage and dedupe
-> QA report
-> decision record
-> spec or phase
-> work order
-> implementation
-> verification
-> release note
-> reporter or donor follow-up
-> learning update
```

## Report Types

- bug
- regression
- UX confusion
- missing feature
- documentation gap
- performance issue
- security or privacy issue
- architectural debt
- roadmap request

## Evidence Fields

- what happened
- what should have happened
- reproduction steps
- route or workflow
- screenshots or attachments
- logs or error text
- browser/device/runtime context
- severity
- user impact
- suspected duplicates
- privacy sensitivity

## Funding Signal

Donations can fund priority, not architecture.

Rules:

- users can donate toward problems, themes, or roadmap items
- maintainers keep final scope and architecture authority
- every funded item still passes QA, spec, implementation, and verification
- public status should show progress without exposing private data

## Projection Views

- public report board
- private sensitive report queue
- maintainer work queue
- funded priority list
- active work orders
- QA gate board
- release history
- unresolved risk register

## Current Code To Reuse

- QA reporting tool
- conversation continuity and evidence refs
- work orders and stage runs
- job and execution timelines
- prompt governance
- admin/operator surfaces

## Do Not Build Yet

- open-ended public issue tracker clone
- donor control over technical design
- automatic merge without human Tier 4 review
- private/security data in public projections
