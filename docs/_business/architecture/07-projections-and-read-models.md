# Projections And Read Models

## Principle

Canonical write models should stay boring and durable. Projections make them
fast, searchable, inspectable, and useful.

All critical projection outputs should be readable from the conversation thread
as well as admin/business views.

Do not add cache tables as random optimizations. Add read models when a view has
a stable purpose.

## Projection Families

### Execution Projection

Used for timelines, stage boards, job status, work order summaries, and blocked
work.

### Artifact Projection

Used for conversation assets, generated media, source refs, citations,
derivatives, and reusable outputs.

### Search Projection

Used for local corpus, web-derived research packets, source lookup, FTS, and
vector search.

### Business Projection

Used for QR/referral, lead, consult, deal, delivery, funding, and feedback
process views.

### Admin Projection

Used for summary stats, operator queues, prioritization, and risk dashboards.

### Billing And Metering Projection

Used for storage, server-side processing usage, and hosted token consumption.

## Review Backlog Mapping

The files in `docs/_review` should be treated as projection backlog, not as
standalone architecture:

- admin stats materialization -> admin projection
- user storage accounting -> artifact projection
- job status snapshotting -> execution projection
- in-db vector search -> search projection
- FTS5 migration -> search projection
- prompt directive caching -> prompt/runtime optimization
- unified MCP registry -> capability core, not just projection
- work order hydration flattening -> execution projection
- server-side asset index -> artifact projection

## Rule For New Read Models

Before adding a read model, write:

- source write models
- projection purpose
- rebuild strategy
- invalidation strategy
- privacy boundary
- tests for consistency
- fallback path when projection is missing
