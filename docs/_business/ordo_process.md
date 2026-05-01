# Ordo Operating Process

This document defines the execution process used to build and run Ordo.

## Core Claim

AI leverage is determined by process quality, not prompt cleverness.

## Delivery Loop

Collect -> Decide -> Spec -> QA -> Ground -> Phase -> Implement -> QA ->
Functional review -> Update

## Rules

1. No edit before diagnosis.
2. Specs are contracts.
3. Keep phases small and independently reviewable.
4. Validate at code, test, integration, and functional levels.
5. Preserve evidence and provenance for every meaningful change.

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
