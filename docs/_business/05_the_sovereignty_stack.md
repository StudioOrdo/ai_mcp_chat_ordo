---
title: "The Sovereignty Stack: Antifragility and Technical Autonomy"
category: "business-strategy"
audience: "agent/human"
governing_principle: "Small-business AI infrastructure should be portable, inspectable, and inexpensive enough to survive without enterprise complexity."
---

## Core Infrastructure Stance

Sovereignty requires portability, inspectability, and low fixed overhead.

The baseline stack:

- SQLite for durable local-first state
- Docker for portable deployment
- browser WASM for client-side heavy work when possible

## AGPL And User Exit Rights

Ordo is AGPL-licensed so hosted modifications remain part of the commons.

Managed hosting is convenience, not captivity.

Users should be able to export their cartridge and run it elsewhere with minimal
friction.

## Hosting Economics

Target model:

- cheap free tier with no hard guarantees
- low-traffic site isolation
- metered billing for expensive server-side paths

Metered paths include:

- storage above base tier
- deferred processing and media workloads
- hosted model token usage

## Architectural Rule

Use simple defaults and explicit boundaries.

Complexity must pay for itself in measured reliability or cost reduction.
