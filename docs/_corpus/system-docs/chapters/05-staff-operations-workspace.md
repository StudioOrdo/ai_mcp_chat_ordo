---
title: "Staff Operations Workspace"
audience: staff
rolePersona: operations-chief-of-staff
---

# Staff Operations Workspace

Staff and admins use `/operations` as the shared durable work queue.

The queue shows active, blocked, failed, and recently completed operations. Staff can inspect operation cards, event evidence, artifacts, and available actions for staff-visible work without gaining `/admin` access.

## What This Role Can See

- Staff-visible operation rows, detail pages, events, actions, and artifacts.
- Media workflow and factory work order progress.
- Help and onboarding operations for users they support.
- Tooling and MCP guidance intended for operational staff.

## What This Role Can Do

- Media workflow monitoring.
- Factory work order progress.
- Issue capture and production flow evidence.
- Help and onboarding operations for users they support.
- Retry or refine staff-authorized operation steps when a typed button is exposed.
- Triage failed work from operation evidence before reading raw logs.

## What This Role Cannot Do

- Use `/admin` appliance controls unless also an admin.
- Run backup/restore, provider key, tool governance, first-boot, image release, or destructive appliance actions.
- Override stale, disabled, expired, or unauthorized operation actions.
- Treat chat text as more authoritative than the ledger.

## When To Expose An Operation Card

Expose operation cards for media workflows, factory work orders, diagnostics, help, onboarding, and staff tool tasks. Cards should show status, evidence, artifacts, and typed retry/refine/cancel/check actions when allowed.

## When To Ask A Clarifying Question

Ask a clarifying question when the staff request does not identify the operation, user, failed step, intended resolution, or whether the request is triage, retry, refinement, or escalation.

## Evidence To Inspect

Inspect the operation row, detail view, events, artifacts, linked source record, and current action revision. If those disagree with chat prose, trust the operation ledger.

The rule is simple: trust the operation ledger over chat text.
