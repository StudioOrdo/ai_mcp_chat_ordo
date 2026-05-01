# Governance Contract

## Purpose

Governance is the set of controls around work.

## Source Of Truth Owner

Policy-specific services. Governance is a family of contracts, not one generic
settings object.

## Current Status

`partial`

## Current Anchors

- `src/lib/chat/prompt-runtime.ts`
- `src/lib/prompts/prompt-control-plane-service.ts`
- `src/core/entities/role-directive-assembler.ts`
- `src/core/capability-catalog/capability-definition.ts`
- `src/core/entities/conversation-continuity.ts`
- `src/core/entities/identity-migration.ts`
- `src/lib/db/tables.ts`
- `docs/_refactor/conversation/phases/phase-09-identity-migration-privacy-and-repair.md`

## Required Contract

Governance policy must define:

- policy id
- policy domain
- owner or scope
- applies-to refs
- allowed actions
- denied actions
- required approvals when applicable
- evidence or audit requirements
- retention and deletion behavior when applicable
- source policy when applicable
- funding priority rules when applicable
- created and updated timestamps

Policy domains:

- permission policy
- prompt policy
- privacy and deletion policy
- source policy
- audit and provenance policy
- funding priority policy
- contribution intake policy

## Current Implementation Coverage

Current governance pieces include:

- prompt runtime and prompt control plane
- role directive assembly
- capability role access
- continuity ownership and deletion lifecycle fields
- identity migration events
- database tables for prompt bindings, conversation events, user files,
  materialization records, and business workflow records

## Contract Additions

The platform still needs explicit policy contracts and enforcement boundaries for
each policy domain. Stage 13 should split these domains instead of creating one
broad governance table.

## Lifecycle

- `draft`
- `active`
- `deprecated`
- `suspended`
- `retired`

## Event And Projection Expectations

- Policy changes should be auditable.
- Permission and privacy outcomes should be projectable without exposing private
  policy internals unnecessarily.
- Funding priority projections should show ranking signals without bypassing QA
  or architecture authority.
- Prompt policy projections should show active policy status without making
  prompts workflow source-of-truth.
- Contribution intake projections should show why a request was accepted,
  rejected, or deferred.

## Boundaries

Governance controls work. It should not become the work.

## Must Not Absorb

- recipe definition
- work order state
- artifact payloads
- QA findings
- release records
- user-facing projection state

## Migration Notes

The current system already has pieces of governance across prompt control,
capability roles, identity/privacy work, continuity lifecycle fields, and
capability access. Stage 13 should split these into explicit policy domains
instead of introducing one broad governance table.

## Positive Cases

- A recipe requires approved sources for public research.
- A capability is available to admins but hidden from anonymous users.
- A release requires human approval when QA has warnings.
- Donation signals can prioritize review without bypassing QA.
- Token-funded requests are queued faster but still require reproducible QA
  evidence.
- Community members submit tests, repro harnesses, or evidence bundles without
  direct merge rights.

## Negative Cases

- Funding priority should not override privacy, safety, or architecture rules.
- Token holders should not receive direct merge authority.
- Prompt policy should not become workflow source-of-truth.
- Deletion policy should not be implemented only as UI hiding.
- Permission policy should not be inferred from projection visibility alone.

## Edge Cases

- One artifact can have public projection data and private evidence.
- One capability can be executable by the system but not directly by a user.
- A policy can preserve audit refs while deleting user-visible payloads.
- A funding signal can rank backlog items but still require technical approval.
