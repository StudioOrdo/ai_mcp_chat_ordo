# UX Architecture Archeology

Status: Initial archeology pass

Evidence date: 2026-05-04

This folder maps the existing Ordo codebase to the UX canon in
`docs/_business/ux`. The goal is to uncover functionality that already exists,
decide how it should appear in the product, and avoid inventing new surfaces
when current code can be reframed.

The product target for this archeology is the
`docs/_business/ux/08-product-kernel-contract.md` contract and
`docs/_business/ux/09-canonical-ux-architecture.md`. Architecture docs provide
evidence; the product kernel and canonical UX architecture decide what the
evidence should become in the owner-facing UX.

## Method

This pass used code and tests as evidence:

- route inventory under `src/app`
- component/read-model inventory under `src/components`, `src/lib`, and
  `src/core/platform`
- durable table inventory from `src/lib/db/tables.ts` and
  `src/lib/db/migrations.ts`
- capability catalog and tool executors under `src/core/capability-catalog` and
  `src/core/use-cases/tools`
- prompt runtime/provenance code under `src/lib/chat`, `src/lib/prompts`, and
  `src/adapters`
- workflow/job/operation/factory/media code under `src/lib/jobs`,
  `src/lib/operations`, `src/lib/factory`, and `src/lib/media`
- tests under `src/**.test.ts`, `src/**.test.tsx`, and browser/eval scripts

## Document Set

1. [Public Shell, Routes, And Navigation](01-public-shell-routes-and-navigation.md)
2. [Conversation Runtime, Chat, And Actions](02-conversation-runtime-chat-and-actions.md)
3. [Capabilities, Tools, And Routing](03-capabilities-tools-and-routing.md)
4. [Prompts, Provenance, And Grounding](04-prompts-provenance-and-grounding.md)
5. [Jobs, Workflows, Operations, And Factory](05-jobs-workflows-operations-and-factory.md)
6. [Studio, Media, Assets, And Content Production](06-studio-media-assets-and-content-production.md)
7. [People, Referrals, Relationships, And Results](07-people-referrals-relationships-and-results.md)
8. [Offers, Commerce, And Private Proposals](08-offers-commerce-and-private-proposals.md)
9. [Corpus, Research, Search, And Visibility](09-corpus-research-search-and-visibility.md)
10. [Admin, Observability, Appliance, And Governance](10-admin-observability-appliance-and-governance.md)
11. [Tests, Evals, And Regression Evidence](11-tests-evals-and-regression-evidence.md)
12. [Capability Certification And Complete Inventory](12-capability-certification-and-complete-inventory.md)

## Disposition Vocabulary

- **Keep**: directly supports the UX canon.
- **Reframe**: useful code, wrong user-facing language or surface.
- **Hide**: keep available through details/admin, remove from primary product
  navigation.
- **Prune candidate**: likely removable after donor functionality is absorbed.
- **Gap**: needed for the product shape but not sufficiently implemented.

## Cross-System Product Rule

Every user-visible system object should answer:

1. What is it?
2. Who can see it?
3. What should the user do next?
4. How was it produced or how did it get here?
5. What result did it create?

If a subsystem cannot answer those questions, it should remain diagnostic until
the read model can project it into an obvious object.
