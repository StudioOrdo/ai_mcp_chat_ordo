# Stage Index

This folder breaks the architecture plan into small development stages.

Each stage should be reviewed independently. If a stage exposes a wrong
assumption, update the architecture docs before continuing.

## Stages

0. [Business Docs And Vocabulary](00-business-docs-and-vocabulary.md)
1. [Current System Inventory](01-current-system-inventory.md)
2. [Core Kernel Contracts](02-core-kernel-contracts.md)
3. [Artifact And Evidence Model](03-artifact-and-evidence-model.md)
4. [Work Order Consolidation](04-work-order-consolidation.md)
5. [Capability And Connector Contracts](05-capability-and-connector-contracts.md)
6. [QA Gate System](06-qa-gate-system.md)
7. [Projection And Read Model Package](07-projection-and-read-model-package.md)
8. [Scrollytelling Recipe MVP](08-scrollytelling-recipe-mvp.md)
9. [Scrollytelling Publishing And Derivatives](09-scrollytelling-publishing-and-derivatives.md)
10. [Ordo Development Report Intake](10-ordo-development-report-intake.md)
11. [Ordo Development Work Order Loop](11-ordo-development-work-order-loop.md)
12. [Business Process Views](12-business-process-views.md)
13. [Governance, Privacy, And Funding](13-governance-privacy-and-funding.md)
14. [Cleanup And Cutover](14-cleanup-and-cutover.md)
15. [Recipe Generalization](15-recipe-generalization.md)

## Stage Template

Each stage uses:

```text
Goal
Build
Done
Guardrails
```

This keeps the plan easy to scan and easy to turn into later specs or phase
documents.

Stage 02 expands this template with [Kernel Contract Specs](../contracts/README.md)
because each kernel primitive needs its own reviewable boundary.

Stage 03 expands this template with the [Artifact And Evidence Model](../artifact-evidence/README.md)
because artifact and evidence compatibility must be reviewed before
implementation.
