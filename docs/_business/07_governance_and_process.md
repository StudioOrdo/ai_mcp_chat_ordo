---
title: "Governance and Process: The Agentic Contract"
category: "business-strategy"
audience: "agent/human"
governing_principle: "AI success is determined by process, not by prompting."
---

## Why Governance Is Core

Ordo does not treat AI output as truth.

It treats AI output as proposed work that must pass contracts, evidence checks,
and review gates.

## Delivery Loop

The operating loop remains:

Collect -> Decide -> Spec -> QA -> Ground -> Phase -> QA -> Implement -> QA ->
Update -> Repeat

## Operating Rules

1. no edit before diagnosis
2. spec is executable contract
3. phases stay small and reviewable
4. verification is layered, with human functional review as final gate

## Intake And Prioritization Policy

Implementation intake is QA-report-first.

- change requests enter through structured QA reports or QA-backed issue bundles
- non-reproducible feature requests do not bypass QA intake
- each site can emit a linked GitHub issue from accepted QA evidence

Priority can be influenced by token funding signals, but funding is not an
override:

- tokens can increase review priority
- tokens cannot bypass safety, privacy, QA, or architecture gates
- final merge authority remains within governed StudioOrdo review

## Proof-First Strategy

The primary product proof is internal dogfooding.

If Ordo reliably improves the founder workflow with measurable outcomes, the
architecture claim is credible. If it does not, claims are revised before scale.

## Safety And Control Direction

Future execution surfaces (WASM scripting, agent-to-agent federation) should
follow the same governance rule:

- untrusted execution
- explicit permissions
- signed audit trails
- enforceable policy boundaries
