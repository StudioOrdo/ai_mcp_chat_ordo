# Kernel Contract Specs

These files define the Stage 02 kernel contracts.

They are contract specs, not implementation instructions. A contract describes
the stable boundary future code should honor. Later stages decide database
tables, repository methods, migrations, and UI projections.

## Contract Files

1. [Contract Rules](00-contract-rules.md)
2. [Capability Contract](01-capability-contract.md)
3. [Recipe Contract](02-recipe-contract.md)
4. [Work Order Contract](03-work-order-contract.md)
5. [Stage Run Contract](04-stage-run-contract.md)
6. [Artifact Contract](05-artifact-contract.md)
7. [Evidence Contract](06-evidence-contract.md)
8. [QA Report Contract](07-qa-report-contract.md)
9. [Release Contract](08-release-contract.md)
10. [Projection Contract](09-projection-contract.md)
11. [Governance Contract](10-governance-contract.md)

## Stage 02 Output

Stage 02 is complete when:

- each kernel primitive has a source-of-truth owner
- each kernel primitive states required data, boundaries, and exclusions
- each kernel primitive states current implementation coverage and target
  contract additions
- each kernel primitive states event and projection expectations
- each partial/new concept names current-code migration pressure
- each contract has positive, negative, and edge cases
- no implementation stage can claim a primitive without linking to its contract
