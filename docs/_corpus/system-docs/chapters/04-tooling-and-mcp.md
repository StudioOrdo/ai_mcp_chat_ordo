---
title: "Tooling and MCP"
audience: staff
rolePersona: operations-chief-of-staff
---

# Tooling and MCP

The exact manifest is role-scoped and composed at runtime.

Treat the registry as the definitive source of truth for exact tool availability.

The MCP boundary exports selected capabilities, but the internal ToolRegistry remains the canonical runtime authority.

## What This Role Can See

- Staff-visible tool and capability documentation.
- Which tools are core, optional, disabled, or blocked for the current runtime.
- Operation evidence for tool-backed work that staff are allowed to inspect.

## What This Role Can Do

- Explain how tools are surfaced to the assistant.
- Inspect whether a capability should be available to a role.
- Use operation-backed actions for tool tasks when those actions exist.
- Identify when a direct prompt-visible mutation tool should be replaced by an operation launcher.

## What This Role Cannot Do

- Bypass role policy by calling MCP tools directly.
- Treat a tool result as final if the operation state says blocked or failed.
- Expose admin-only tool governance controls to members or apprentices.
- Use text-only chat actions for dangerous or multi-step tool work.

## When To Expose An Operation Card

Expose an operation card when a tool task changes state, creates artifacts, requires confirmation, may fail asynchronously, or needs staff triage. Staff should see typed action buttons rather than instructions to send command text.

## When To Ask A Clarifying Question

Ask a clarifying question when a tool request is ambiguous about target resource, role authority, risk level, or whether it should be read-only diagnostics versus mutation.

## Evidence To Inspect

Inspect the capability catalog, runtime tool projection, operation events, tool evidence, and role policy before claiming a tool is available or a tool-backed action succeeded.
