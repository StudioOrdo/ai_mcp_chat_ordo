# Browser Short Video Composer

**Status:** Active Specification Track
**Owner:** Media and browser runtime workstream
**Primary Goal:** Deliver a production-ready browser-first system that can generate reliable 30 to 60 second vertical videos from agent intent, charts, graphs, narration, subtitles, and reusable media assets.

**Economic Constraint:** Client-side video generation is a first-order affordability requirement. Server execution exists as a fallback for unsupported or out-of-budget cases, not as the normal operating model.

## Why This Exists

The current media stack contains useful primitives, but the orchestration surface is too broad and too drift-prone for a marquee feature. This spec track narrows the product to a browser-first short explainer system that is faster, easier to reason about, and easier to make reliable.

## Feature Deliverables

1. A locked product decisions record that defines the non-negotiable feature contract.
2. A feature specification plan that defines the product contract, scope cuts, and tool surface.
2. A phased implementation plan that removes dead or speculative branches before adding more behavior.
3. A final production-ready browser composition path optimized for short educational and short-form media.

## Documents

1. [Locked product decisions](./product-decisions.md)
2. [Compose media contract](./compose-media-browser-short-contract.md)
3. [Specification plan](./specification-plan.md)
4. [Implementation phases](./implementation-phases.md)
5. [Production readiness checklist](./production-readiness-checklist.md)

## Start Here

If you are entering this folder for the first time, read the documents in this order.

1. [Locked product decisions](./product-decisions.md)
   Use this to understand the non-negotiable product direction.
2. [Specification plan](./specification-plan.md)
   Use this to understand the intended feature shape, scope cuts, and open specification questions.
3. [Compose media contract](./compose-media-browser-short-contract.md)
   Use this to understand the intended request contract and the current implementation-truth gaps.
4. [Implementation phases](./implementation-phases.md)
   Use this to understand the staged delivery sequence and the Phase 7 through 10 reliability framing.
5. [Production readiness checklist](./production-readiness-checklist.md)
   Use this as the canonical tracker for progress, QA gates, blockers, and release readiness.

## Source Of Truth By Document

Each document has a different role.

1. [product-decisions.md](./product-decisions.md)
   Source of truth for locked product direction.
2. [specification-plan.md](./specification-plan.md)
   Source of truth for the intended feature specification and unresolved design questions.
3. [compose-media-browser-short-contract.md](./compose-media-browser-short-contract.md)
   Source of truth for the target `compose_media` browser-short contract, subject to open implementation blockers.
4. [implementation-phases.md](./implementation-phases.md)
   Source of truth for the staged delivery plan.
5. [production-readiness-checklist.md](./production-readiness-checklist.md)
   Source of truth for current execution status, QA state, blockers, and production readiness.

## Locked Direction

These points are locked unless explicitly revised in the product decisions document.

1. The marquee media feature is a browser-first short explainer generator, not a general-purpose video editor.
2. Client-side composition is the default operating model for affordability.
3. `compose_media` remains the canonical top-level orchestration tool.
4. The primary release contract uses strong defaults plus explicit overrides.
5. Dead, speculative, or partially implemented media branches should be removed rather than preserved.

## Current Implementation Snapshot

This folder tracks an active implementation, not a finished release.

The current implementation truth is:

1. `browser_short_explainer` now accepts `1` to `5` image beats, with `3` to `5` still treated as the richer default pattern.
2. The narrow browser-short plan constraints are implemented and covered by focused unit tests.
3. Burned-caption browser-short fallback to deferred server execution is implemented and covered by focused unit tests in the hook and server executor layers.
4. Canonical asset identity and storage-backed source rehydration work have meaningful implementation progress, but their end-to-end QA gates remain open.
5. The planner/browser-short mismatch at the old `3 to 5` beat boundary has been fixed in the contract layer.
6. A live planner eval now completes successfully for a one-image `browser_short_explainer` request and persists the expected single-beat plan plus governed video artifact.
7. That passing live eval used the server execution path, so browser-short is not yet proven end to end on the browser-first execution target.

## Active Workstream

The next work session should start with execution-target truth, not further contract expansion.

Priority order:

1. prove when `browser_short_explainer` should stay on the browser path versus when it should route to server execution in live runs
2. extend runtime-truth coverage from focused unit tests into explicit browser-proof and planner-proof evidence
3. only then return to higher-level composition model questions such as storyboard shape and canonical beat taxonomy

## Relationship To Existing Media Reliability Work

This feature folder builds on the cross-cutting reliability and anti-drift program captured in [docs/_refactor/media/specs/media-composition-reliability-and-anti-drift-spec.md](../../_refactor/media/specs/media-composition-reliability-and-anti-drift-spec.md). That refactor spec remains the architectural remediation baseline. This folder defines the product-specific contract and delivery path for the browser-short video feature.