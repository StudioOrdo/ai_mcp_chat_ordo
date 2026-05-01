# Business Process Views

## Purpose

Business workflows should be visible and controllable as processes, not hidden
behind disconnected tables and admin pages.

The first process view should cover the current trust and sales loop:

```text
QR scan
-> attributed conversation
-> lead
-> consultation request
-> triage
-> deal or training path
-> delivery work
-> feedback
-> follow-up
```

## View Types

- funnel view
- timeline view
- kanban view
- queue view
- relationship view
- attribution view
- operator next-action view

## Durable Objects

Current objects to map:

- referral
- referral event
- conversation
- lead record
- consultation request
- deal record
- training path record
- business workflow context
- operator transition
- trust distribution context
- future booking or commitment record

## Workflow Rule

Business process views should project existing durable state. Do not turn
operations into fake content nodes.

## First MVP

Build a QR/referral funnel projection:

- scan and attribution state
- conversation state
- lead status
- consultation status
- deal/training outcome
- next recommended action
- blocked or stale items

## Future Views

- service delivery board
- feedback loop
- booking/commitment board
- student/apprentice referral ledger
- donor-funded development board
