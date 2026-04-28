# Relationship Conversation Continuity

**Status:** Active Specification Track
**Owner:** Chat memory, continuity, and operator experience workstream
**Primary Goal:** Preserve the product's single visible conversation model while replacing hard conversation limits with transparent archival rollover, durable memory, and retrieval-backed continuity grounded in the current architecture.

## Why This Exists

The system already behaves more like an ongoing business relationship than a generic chat app. It restores one active conversation, summarizes long histories, archives completed threads, embeds archived conversations for search, and records conversation lifecycle events for analytics.

The current gap is not missing primitives. The gap is that persistence still applies a hard message-count wall to the active conversation even though the runtime already uses summaries and a bounded prompt window.

This spec track defines how to turn the current architecture into a true relationship-memory system:

1. one visible conversation flow per user
2. transparent rollover from one active span to the next
3. durable archived history with auditability and exportability
4. automatic retrieval-backed continuity across prior spans
5. clean architecture boundaries that reuse existing entities, use cases, ports, and adapters

## Documents

1. [Ultimate architecture spec](./spec.md)
2. [Implementation plan](./implementation-plan.md)

## Locked Direction

These points are treated as the default product direction unless explicitly revised.

1. The product should remain conversation-first, not thread-dashboard-first.
2. One visible active relationship thread per user is the default user experience.
3. The hard 200-message persistence limit should be removed as a product constraint.
4. Continuity should be delivered through active-span context, summaries, archived-history retrieval, and durable transcript/event records.
5. Existing conversation architecture should be reused and extended rather than replaced wholesale.

## Relationship To Existing Specs

This folder builds directly on the archived conversation-memory and conversation-operations work already captured in:

1. [docs/_archive/_specs/conversation-memory/spec.md](../../_archive/_specs/conversation-memory/spec.md)
2. [docs/_archive/_specs/conversation-operations-and-retention/spec.md](../../_archive/_specs/conversation-operations-and-retention/spec.md)

Those documents explain how the current system evolved. This folder is the active feature-owned spec for finishing the design into a durable relationship-memory implementation.