# Ordo Operating Process

This document defines the execution process used to build and run Ordo.

## Core Claim

AI leverage is determined by process quality, not prompt cleverness.

## Delivery Loop

Collect -> Decide -> Spec -> QA -> Ground -> Phase -> Implement -> QA ->
Functional review -> Update

## GitHub Manufacturing Loop

The early markdown phase loop was useful for private architecture shaping. The
public open-source project now needs GitHub to become the visible work ledger.

The operating loop becomes:

Collect evidence -> File issue -> Triage -> Accept scope -> Implement branch ->
Pull request -> QA evidence -> Functional review -> Merge -> Release evidence

Markdown remains the canon for product doctrine, architecture contracts, and
deep evidence. GitHub issues and pull requests carry active work.

## Rules

1. No edit before diagnosis.
2. Specs are contracts.
3. Keep phases small and independently reviewable.
4. Validate at code, test, integration, and functional levels.
5. Preserve evidence and provenance for every meaningful change.
6. Use issues for visible intake and accepted work.
7. Use pull requests for implementation evidence and review.
8. Do not close accepted work without tests, evidence, and functional review.

## Product-Level Application

The same discipline applies to runtime product behavior:

- requests are grounded in context
- capabilities are selected through governed contracts
- execution state is durable and inspectable
- outcomes are projected back into the conversation thread

## Strategy Rule

Use founder workflow proof as the first success criterion.

If Ordo materially improves the founder workflow with measurable evidence,
expand the same primitives to additional use cases.

## Public Work Rules

1. A GitHub issue is the public manufacturing unit after it is accepted.
2. Accepted issues should name the goal, evidence, code anchors, non-goals,
   acceptance criteria, tests, and closeout evidence.
3. Pull requests should link the issue and include files changed, tests run, QA
   findings, visual evidence when relevant, and remaining risks.
4. Humans keep final authority over acceptance, merge, and release.
5. Do not claim automatic GitHub issue filing or automatic resolution until that
   path is implemented and validated.

The detailed public work-ledger contract is
[Software Manufacturing Loop](08_software_manufacturing_loop.md).
