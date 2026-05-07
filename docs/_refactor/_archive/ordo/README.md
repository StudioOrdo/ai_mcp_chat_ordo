# Ordo Product Shape Refactor

Status: Planned
Created: 2026-05-04

## Purpose

This package defines the next product shape for Ordo: an agent-ready business
appliance for solopreneurs.

The goal is not to add more prompt-visible tools. The goal is to consolidate the
best current Ordo systems into a smaller, clearer product:

- a conversational homepage where the first assistant message is the hero,
- a public feed that shows real business output,
- offers that describe what the business can do next,
- workflow runs that make agent work durable and inspectable,
- assets that can be found and reused,
- reviews that improve work before publication,
- metrics that show whether the work helped,
- agent-readable public views of the same business.

## Product Thesis

Ordo is not a generic AI chat app, CMS, or media toy. Ordo is a governed
operating process made usable by conversation.

The founder workflow is the first proof:

1. collect research,
2. synthesize it,
3. produce useful content,
4. review and revise it,
5. publish it,
6. track whether it worked,
7. save the process as a repeatable workflow.

## Public Shape

The public site should stay small:

- `/` - conversational homepage and public operator entry point.
- `/feed` - public output stream for articles, audio, shorts, updates, and
  case studies.
- `/offers` - concrete offers and next actions.
- `/about` - mission, operating process, open-source/appliance story.
- `/library` - internal by default and optionally public by configuration.

## Core Product Objects

Future implementation should converge on these concepts:

- `BusinessProfile`
- `Offer`
- `Campaign`
- `ContentPillar`
- `PublicFeedItem`
- `Asset`
- `ResearchBundle`
- `SynthesisBrief`
- `Review`
- `WorkflowTemplate`
- `WorkflowVersion`
- `WorkflowRun`
- `Operation`
- `Metric`
- `Policy`

Existing code already contains partial versions of many of these. Build adapters
over current code first. Add new storage only when current tables cannot safely
represent the concept.

## Package Contents

- `product-shape.md` - the target product model.
- `decision-record.md` - product decisions made before this package was
  created.
- `rust-strategy.md` - where Rust belongs in this product shape.
- `code-grounding.md` - current code inventory and reuse/cleanup direction.
- `phase-plan.md` - phase sequence and dependency logic.
- `validation-checklist.md` - package-level QA checklist.
- `qa-review.md` - initial QA status for this planning package.
- `canonical-ux-governance/` - executable package for the canonical
  chat-first shell, section brief/evidence-index pattern, account/studio/today/
  offers/system convergence, and durable brief architecture.
- `ordo_rust/` - executable package for the Rust appliance runtime boundary,
  contract generation, supervisor, daemon, native jobs, realtime, search,
  scheduler, and local networking work.
- `evidence/` - snapshots of code research used to ground the package.
- `specs/` - feature-level specs with current-code anchors, required work,
  cleanup, and test expectations.
- `phases/` - implementation phase stubs to execute the refactor in small,
  reviewable steps.

## Implementation Rule

Do not big-bang rewrite Ordo.

Build the new product path beside the current system, migrate one flagship
workflow through it, prove parity with tests and eval artifacts, then prune old
feature-specific surfaces.

The first flagship workflow is:

`Research -> Synthesis -> Article -> Review -> Script -> Review -> Audio Episode -> Feed Publish -> Metrics -> Save Workflow`

After that path is reliable, extend it with:

`Image -> 30s Promo Short -> Feed/Shorts Publish`
