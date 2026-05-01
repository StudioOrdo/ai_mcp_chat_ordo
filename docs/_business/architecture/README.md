# Ordo Architecture And Development Plan

This directory translates the business canon into architecture contracts.

The core product model is now explicit:

one continuous assistant thread with factory access.

The thread is the operator surface. The factory is the execution floor.
Capabilities, policy, memory, and projections connect the two.

## North Star

Ordo is a governed intelligence layer for solo operators.

The product is not a chat app, prompt pack, or disconnected toolset. It is one
continuous assistant that can run business work through governed execution:

```text
intent or report
-> context and evidence
-> decision and plan
-> execution target
-> artifacts and events
-> QA gates
-> revision and release
-> follow-up and learning
```

Current proof points are:

- scrollytelling production with research, multimedia generation, QA, and
  release
- Ordo development workflow run inside Ordo itself
- relationship and funnel visibility across referral, lead, consult, deal,
  delivery, and follow-up

## Architecture Docs

1. [North Star](00-north-star.md)
2. [Current System Map](01-current-system-map.md)
3. [Ordo Core Kernel](02-ordo-core-kernel.md)
4. [Workflow And Recipe Model](03-workflow-recipe-model.md)
5. [Scrollytelling Production](04-scrollytelling-production.md)
6. [Ordo Development Workflow](05-ordo-development-workflow.md)
7. [Business Process Views](06-business-process-views.md)
8. [Projections And Read Models](07-projections-and-read-models.md)
9. [Stage Roadmap](08-stage-roadmap.md)
10. [Kernel Contract Specs](contracts/README.md)
11. [Artifact And Evidence Spec](artifact-evidence/README.md)

## Current State Rule

These docs must describe what exists and what is next.

Do not describe built systems as future concepts. Mark clearly:

- implemented now
- partially implemented
- planned contract

## Stage Index

The implementation plan is split into small stage files:

- [Stage 00 - Business Docs And Vocabulary](stages/00-business-docs-and-vocabulary.md)
- [Stage 01 - Current System Inventory](stages/01-current-system-inventory.md)
- [Stage 02 - Core Kernel Contracts](stages/02-core-kernel-contracts.md)
- [Stage 03 - Artifact And Evidence Model](stages/03-artifact-and-evidence-model.md)
- [Stage 04 - Work Order Consolidation](stages/04-work-order-consolidation.md)
- [Stage 05 - Capability And Connector Contracts](stages/05-capability-and-connector-contracts.md)
- [Stage 06 - QA Gate System](stages/06-qa-gate-system.md)
- [Stage 07 - Projection And Read Model Package](stages/07-projection-and-read-model-package.md)
- [Stage 08 - Scrollytelling Recipe MVP](stages/08-scrollytelling-recipe-mvp.md)
- [Stage 09 - Scrollytelling Publishing And Derivatives](stages/09-scrollytelling-publishing-and-derivatives.md)
- [Stage 10 - Ordo Development Report Intake](stages/10-ordo-development-report-intake.md)
- [Stage 11 - Ordo Development Work Order Loop](stages/11-ordo-development-work-order-loop.md)
- [Stage 12 - Business Process Views](stages/12-business-process-views.md)
- [Stage 13 - Governance, Privacy, And Funding](stages/13-governance-privacy-and-funding.md)
- [Stage 14 - Cleanup And Cutover](stages/14-cleanup-and-cutover.md)
- [Stage 15 - Recipe Generalization](stages/15-recipe-generalization.md)

## Non-Negotiables

- Prompts customize behavior. Prompts do not own durable workflow truth.
- Capabilities are registered once and projected into chat, jobs, MCP, browser,
  and admin surfaces.
- The conversation thread is the primary operator interface.
- Work orders and stage runs are the durable execution backbone.
- Artifacts carry lineage, evidence, source refs, and QA state.
- Every workflow has a projection surface: timeline, board, dashboard, published
  page, or chat summary.
- Keep canonical write models boring. Add read models only when a projection
  needs speed, indexing, or cross-object joins.
- Contract specs are the source of truth for kernel boundaries before
  implementation starts.
