# Media Platform Specs, Roadmap, And Phase Packets

Date: 2026-04-15

This folder organizes the media platform spec work into an execution package modeled after the refactor packet structure in `docs/_refactor/system-state-2026-04-12`.

## Scope

- Convert the media feature specs into a phased delivery program.
- Keep the work source-first and architecture-aware.
- Preserve the current clean separation between repository contracts, adapter implementations, loader modules, routes, and UI surfaces.
- Freeze a testing standard that covers positive, negative, and edge behavior across repository, route, loader, UI, browser, and architecture-audit layers.

## Source Specs

- [../specs/my-media-route.md](../specs/my-media-route.md): user-facing media browsing route.
- [../specs/media-storage-accounting.md](../specs/media-storage-accounting.md): shared accounting layer.
- [../specs/media-operations-workspace.md](../specs/media-operations-workspace.md): staff or admin operational workspace.
- [../specs/media-capacity-and-quotas.md](../specs/media-capacity-and-quotas.md): user quota and operator host-capacity reporting.
- [../specs/media-platform-phased-implementation-plan.md](../specs/media-platform-phased-implementation-plan.md): source-backed phase sequencing and implementation detail plan.

## Deliverables

- [implementation-roadmap.md](./implementation-roadmap.md): recommended delivery order and phase goals.
- [phases/README.md](./phases/README.md): packet workflow and packet usage rules.
- [phases/status-board.md](./phases/status-board.md): live status tracker for the media workstream.
- [phases/phase-0-query-contracts-and-guardrails.md](./phases/phase-0-query-contracts-and-guardrails.md): query seams, pagination contracts, and architecture guardrails.
- [phases/phase-1-storage-accounting-foundation.md](./phases/phase-1-storage-accounting-foundation.md): accounting summaries and reconciliation.
- [phases/phase-2-my-media-route-v1.md](./phases/phase-2-my-media-route-v1.md): user-facing media route.
- [phases/phase-3-operations-workspace-and-metadata-promotion.md](./phases/phase-3-operations-workspace-and-metadata-promotion.md): staff or admin workspace and schema promotion checkpoint.
- [phases/phase-4-capacity-and-quotas.md](./phases/phase-4-capacity-and-quotas.md): user quota and operator capacity surfaces.
- [phases/phase-5-enforcement-and-operational-hardening.md](./phases/phase-5-enforcement-and-operational-hardening.md): upload enforcement, cleanup hardening, and architecture audits.
- [phases/phase-6-portability-and-delivery-baseline.md](./phases/phase-6-portability-and-delivery-baseline.md): governed delivery continuity and cross-runtime artifact portability baseline.

## Reading Order

1. [implementation-roadmap.md](./implementation-roadmap.md)
2. [phases/README.md](./phases/README.md)
3. [phases/status-board.md](./phases/status-board.md)
4. the active phase packet

## Three-Part Summary

| Question | Answer |
| --- | --- |
| What is being delivered? | A user media route, an operator media workspace, a reusable storage-accounting layer, and quota or capacity reporting |
| What is the architectural risk? | Route-level convenience work could bypass repository seams, weaken RBAC, or reintroduce ad hoc metadata parsing |
| How should the work proceed? | Tighten query and accounting contracts first, ship the user route next, then add operator surfaces and quota controls on proven seams |

## Headline Assessment

| Area | Assessment |
| --- | --- |
| Product value | High. Users and operators both lack first-class media visibility today |
| Existing foundation | Strong. Governed storage, typed media metadata, upload ingestion, and secured asset delivery already exist |
| Main constraints | `user_files` aggregation is minimal, metadata is still JSON-backed, and the current `/admin` shell is admin-only |
| Best decisions to preserve | owner-gated `/api/user-files/[id]`, typed media vocabularies, loader-first route design, admin and journal RBAC split |
| Biggest drift risks | broadening `/admin` access, scanning the filesystem in request paths, inventing a second asset-delivery path, and duplicating metadata logic |

## Current Recommendation

Treat this as a phased delivery program, not one large feature branch. Phase 0 and Phase 1 create the query and accounting seams. Phase 2 delivers the user-facing value. Phase 3 handles the staff or admin workspace and the schema-promotion checkpoint. Later phases should stay additive and policy-driven.
