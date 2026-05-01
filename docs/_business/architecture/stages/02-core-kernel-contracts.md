# Stage 02 - Core Kernel Contracts

## Goal

Define the smallest Ordo core contracts.

## Build

- Define shared contract rules.
- Define `Capability`.
- Define `Recipe`.
- Define `WorkOrder`.
- Define `StageRun`.
- Define `Artifact`.
- Define `Evidence`.
- Define `QAReport`.
- Define `Release`.
- Define `Projection`.
- Define `Governance`.
- Link each contract from `contracts/README.md`.

## Contract Specs

- [Contract Rules](../contracts/00-contract-rules.md)
- [Capability Contract](../contracts/01-capability-contract.md)
- [Recipe Contract](../contracts/02-recipe-contract.md)
- [Work Order Contract](../contracts/03-work-order-contract.md)
- [Stage Run Contract](../contracts/04-stage-run-contract.md)
- [Artifact Contract](../contracts/05-artifact-contract.md)
- [Evidence Contract](../contracts/06-evidence-contract.md)
- [QA Report Contract](../contracts/07-qa-report-contract.md)
- [Release Contract](../contracts/08-release-contract.md)
- [Projection Contract](../contracts/09-projection-contract.md)
- [Governance Contract](../contracts/10-governance-contract.md)

## Positive Cases

- A later implementation phase can cite a contract file before adding fields,
  repositories, tables, or projections.
- A partial concept, such as `Artifact` or `QAReport`, can keep current
  domain-specific payloads while gaining a shared envelope.
- A new concept, such as `Recipe`, can be introduced without pretending current
  code already has it.

## Negative Cases

- Do not add database tables during Stage 02.
- Do not convert all existing domain models into one generic object.
- Do not make recipe contracts depend on a single connector implementation.
- Do not let prompts become the only place workflow structure exists.

## Edge Cases

- A contract can be complete even when implementation is deferred to a later
  stage.
- A current entity can satisfy part of a contract without being renamed yet.
- A projection can be a live projector or materialized read model depending on
  later performance needs.
- A governance policy can apply to a recipe, capability, artifact, release, or
  projection without owning those records.

## Done

- Each contract has a clear source-of-truth owner.
- Each contract states what it must not absorb.
- Existing code has migration notes where names do not match.
- Each contract states current implementation coverage and target contract
  additions.
- Each contract states event and projection expectations.
- Positive, negative, and edge cases exist for the stage.
- Later stages can link to the specific contract they implement.

## Guardrails

- Do not create a generic `Node` that absorbs all domains.
- Do not make prompts source-of-record state.
- Do not create a second execution engine if factory work orders can be reused.
- Do not implement during contract definition.
