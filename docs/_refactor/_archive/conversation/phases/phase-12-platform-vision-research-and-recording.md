# Phase 12: Platform Vision Research And Recording

## Objective

Research and record the broader Ordo platform vision that sits above the
conversation refactor so the next batch of work starts from a grounded platform
model instead of ad hoc extrapolation.

This phase is intentionally not a code-implementation phase. Its job is to
capture the architectural direction suggested by the completed conversation
package and stress-test that direction against richer product scenarios such as:

- governed mixed-media publishing
- journal and blog editorial workflows
- teaching, lesson, submission, and feedback flows
- business templates driven by prompt packs and workflow composition
- operational businesses such as scheduling and service delivery

Phase 12 exists to answer one question cleanly: what is the smallest durable
platform shape that can support these future domains without forcing the
conversation package to absorb all of them retroactively?

## Source Specs

- [../target-architecture.md](../target-architecture.md)
- [../domain-model-spec.md](../domain-model-spec.md)
- [../jobs-assets-materialization-spec.md](../jobs-assets-materialization-spec.md)
- [../relationship-memory-and-search-spec.md](../relationship-memory-and-search-spec.md)
- [../governance-identity-and-migration-spec.md](../governance-identity-and-migration-spec.md)
- [phase-01-canonical-domain-contracts.md](phase-01-canonical-domain-contracts.md)
- [phase-05-asset-catalog-and-reusable-outputs.md](phase-05-asset-catalog-and-reusable-outputs.md)
- [phase-11-release-hardening-and-learning-loop.md](phase-11-release-hardening-and-learning-loop.md)

## Collect

Research the actual completed package and the current product/domain surfaces:

- conversation runtime and restore control plane
- materialization registry and asset catalog seams
- journal/blog editorial workflows
- mixed-media rendering and document surfaces
- prompt governance and template seams
- identity, access, migration, and deletion boundaries
- current business/operations surfaces already present in the repo

Stress-test the architecture against concrete future scenarios, not generic CMS
theory:

- lecture ingest to lesson, student interaction, submission, and feedback
- mixed-media document authoring with charts, graphs, video, and reusable
  assets
- prompt-driven business templates
- service operations such as scheduling and work execution

## Decide

Decide the broader platform kernel boundaries.

Required decisions:

- which future abstractions are true cross-domain kernels versus conversation-
  package-local models
- whether a shared `Node` kernel is needed, and where it stops
- whether `Document`, `Asset`, `Workflow`, `Template`, `Projection`,
  `Commitment`, `WorkOrder`, `Submission`, and `Feedback` should be separate
  kernels or subdomains
- what Drupal-inspired ideas are worth adopting and what should be rejected
- which existing conversation-package phases already provide reusable substrate
  and which are intentionally slice-specific

Rejected approaches must include:

- retroactively forcing the entire future platform into Phase 01 through Phase
  05 contracts
- treating prompts as the durable source of truth for permissions, workflow
  truth, or scheduling truth
- turning every future concept into one generic node/blob model
- turning operations problems into fake content problems
- starting the next package without a written kernel map and phase sequence

## Spec QA

The research record must answer these explicitly:

- what remains inside the conversation package
- what becomes shared substrate for later packages
- what requires a new platform package rather than a conversation phase edit
- what a business template is allowed to customize via prompts
- what prompts must never control directly
- how mixed-media documents relate to assets, nodes, workflows, and templates
- how operational domains fit without collapsing into CMS abstractions

## Ground

Before writing the vision record, map the completed phases to future platform
concerns:

- Phase 01 through Phase 04 as conversation/control-plane substrate
- Phase 05 as shared governed-asset substrate
- Phase 06 through Phase 10 as conversation product/runtime continuation
- Phase 11 as current-package closeout and next-batch planning handoff

Any future platform concept should be mapped to one of these outcomes:

- already solved here
- enabled here but implemented later
- out of scope for this package and belongs to the next one

## Build

Expected deliverables:

- a platform vision document that records the future Ordo shape in grounded
  terms
- a kernel map for content, assets, documents, workflows, templates,
  projections, and operational domains
- a fit assessment explaining where Phases 06 through 11 align with the bigger
  plan and where they stop
- a clear statement of whether any completed phases need doc amendments versus
  code rework
- inputs for the next-batch specs and phase docs created in Phase 11

## Phase QA

Before closing Phase 12, verify that the vision record does not mutate the
current package scope by accident.

The document should clarify the future, not silently reopen completed work.

## Implementation QA

Required validation:

- document review against actual completed package behavior and phase outcomes
- consistency review against Phase 01 through Phase 11 docs
- explicit check that future abstractions are grounded in current repo surfaces
  and stress-tested scenarios rather than generic platform language

## Update

After completion, update the next-batch architecture docs and roadmap to point
at this phase as the recorded platform-vision source of truth.
