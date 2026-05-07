# State Of The Project

Date: 2026-05-07

Status: Active development toward a July 31, 2026 alpha.

This document is the public truth ledger behind the README. It uses four labels: Implemented, Active refactor, Alpha track, and Vision.

## Project Shape

Ordo is an AGPL AI business appliance and operator system for solopreneurs.

The product is not just chat. Chat is the operating interface. Behind it, Ordo uses governed capabilities, durable jobs, workflow state, retrieval, media execution, QA contracts, local persistence, and backup/native boundaries so work can keep moving after the assistant stops talking.

The development method is software manufacturing:

Collect -> Decide -> Spec -> QA -> Ground -> Phase -> Implement -> QA -> Functional review -> Update

The same method governs public documentation. Claims should be useful, short,
and true.

The next operating step is to move active public work from markdown phase files
into GitHub issues and pull requests. Markdown remains the canon for doctrine,
architecture, and evidence. GitHub becomes the visible manufacturing ledger.

## Implemented

These claims are supported by current repo evidence.

### Governed Chat And Capability Routing

Ordo has authenticated and anonymous chat surfaces backed by an internal capability catalog and tool registry. Capabilities are projected into runtime surfaces with role-aware access instead of being treated as loose prompt text.

Evidence anchors:

- [src/core/capability-catalog/catalog.ts](../src/core/capability-catalog/catalog.ts)
- [src/core/tool-registry/ToolRegistry.ts](../src/core/tool-registry/ToolRegistry.ts)
- [src/lib/jobs/job-capability-registry.ts](../src/lib/jobs/job-capability-registry.ts)

### Deferred Jobs And Durable Events

The repo includes a deferred job runtime and worker path for background execution. Long-running work is represented as jobs and job events so product surfaces can recover state without relying on an open browser stream.

Evidence anchors:

- [src/lib/jobs/deferred-job-runtime.ts](../src/lib/jobs/deferred-job-runtime.ts)
- [src/lib/jobs/job-capability-registry.ts](../src/lib/jobs/job-capability-registry.ts)
- [package.json](../package.json)

### Factory And Work Orders

Ordo has staged production orchestration for work orders. This supports the larger product thesis: business work should move through contracts, stages, checkpoints, and QA rather than ad hoc assistant output.

Evidence anchors:

- [src/lib/factory/production-orchestrator.ts](../src/lib/factory/production-orchestrator.ts)
- [docs/_business/06_the_production_engine.md](./_business/06_the_production_engine.md)

### QA Reports

Structured QA reports exist as product artifacts. They can describe findings, criteria, asset checks, recommended fixes, and whether a user decision is required.

Evidence anchors:

- [src/core/entities/qa-report.ts](../src/core/entities/qa-report.ts)
- [src/lib/factory/qa-evaluator.ts](../src/lib/factory/qa-evaluator.ts)

### Browser/WASM Media Execution

The media system includes a browser/WASM FFmpeg executor that can run composition work in the browser runtime and upload governed artifacts back through the app.

Evidence anchors:

- [src/lib/media/browser-runtime/ffmpeg-browser-executor.ts](../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts)
- [package.json](../package.json)

### RAG, Vector Search, And Local Embeddings

The repo includes hybrid search with keyword retrieval, vector similarity, reciprocal rank fusion, SQLite-backed vector storage, and local embedding support.

Evidence anchors:

- [src/core/search/HybridSearchEngine.ts](../src/core/search/HybridSearchEngine.ts)
- [src/adapters/SQLiteVectorStore.ts](../src/adapters/SQLiteVectorStore.ts)
- [src/adapters/LocalEmbedder.ts](../src/adapters/LocalEmbedder.ts)

### Local Persistence And Appliance Runtime

The default runtime uses SQLite and local files under `.data`. The app is designed to run without a separate database server, queue broker, search cluster, or vector database for the default local footprint.

Evidence anchors:

- [package.json](../package.json)
- [src/lib/appliance/backup/backup-command-service.ts](../src/lib/appliance/backup/backup-command-service.ts)
- [src/lib/appliance/native/native-command-contract.ts](../src/lib/appliance/native/native-command-contract.ts)

### Backup And Rust Boundary

Backup/native command foundations exist. The TypeScript app can create governed backup commands, and the repo includes Rust crates for the native backup/executor boundary.

This should be read as a foundation, not a claim that every end-user restore path is complete.

Evidence anchors:

- [src/lib/appliance/backup/backup-command-service.ts](../src/lib/appliance/backup/backup-command-service.ts)
- [src/lib/appliance/native/native-command-contract.ts](../src/lib/appliance/native/native-command-contract.ts)
- [Cargo.toml](../Cargo.toml)
- [crates/ordo-backup](../crates/ordo-backup)
- [crates/ordo-daemon](../crates/ordo-daemon)

## Active Refactor

These areas have real foundations but should not be described as finished end-user promises.

- Backup and restore: command services, native contracts, Rust backup executor, capacity checks, and scheduler/runtime supervision exist; complete consumer-grade restore UX still needs careful verification before it is claimed broadly.
- Public documentation: the README, state ledger, docs index, contribution guide, and GitHub issue-template surface are in place; final closeout remains.
- GitHub contribution surface: runtime-integrity, alpha feedback, bug report,
  QA report, and docs feedback templates exist locally. The Studio Ordo
  organization repository is the target public home, with issues enabled and the
  initial manufacturing label set configured.
- Rust/TypeScript boundary: Rust backup and daemon foundations exist; Ordo is not being presented as a broad Rust rewrite.
- Software manufacturing loop: GitHub issues are becoming the visible intake
  and accepted-work ledger; pull requests will carry implementation evidence.

## Alpha Track

These are intended for the July 31, 2026 alpha but are not claimable as shipped product behavior yet.

- Turning QA reports into the durable intake layer for GitHub issues and
  agent-assisted triage.
- Continuing to refine the public path for QA volunteers, AI consultants, product engineers, and serious builders.
- More explicit release evidence around the end-to-end appliance lifecycle.
- Stronger archive manifests so old specs remain useful history without looking like current product truth.

## Vision

The larger direction is a governed intelligence layer for trust-based small businesses: a system that preserves relationship continuity, routes intent to capabilities, runs heavy execution through jobs, and returns results into the same conversation.

The north star is human authority plus machine follow-through:

Human decides. Assistant operates. Process governs.

## What Not To Claim Yet

Do not claim these as current shipped behavior:

- Ordo files GitHub issues from QA reports without human review.
- Ordo resolves GitHub issues without human review.
- The Studio Ordo organization repository is fully cut over before branch state,
  issues, labels, templates, and release posture are aligned.
- The whole platform is finished for every deployment context.
- Every idea in `docs/_business` is implemented product behavior.
- Archived specs are current roadmap unless a current phase reactivates them.

## How To Help Now

The most useful contribution path is evidence-rich QA.

Good reports include:

- what you tried
- the route or surface involved
- your role, if relevant
- expected behavior
- actual behavior
- screenshots, logs, command output, or failing tests when available
- enough detail to turn the report into a deterministic reproduction or docs correction

Start with [CONTRIBUTING.md](../CONTRIBUTING.md). The current issue templates
live in [.github/ISSUE_TEMPLATE](../.github/ISSUE_TEMPLATE).

## Follow Paths

The current local origin remains `kaw393939/ai_mcp_chat_ordo`. The Studio Ordo
organization repository `StudioOrdo/ai_mcp_chat_ordo` is reachable with admin
permission and is the target public home after cutover alignment.

No YouTube follow path was verified during this phase, so none is listed here.

## Source Of Truth

When docs disagree, use this order:

1. Current source code, tests, and release evidence.
2. This state-of-project ledger.
3. The root README.
4. Active business canon and current phase specs.
5. Archive material as historical context only.

Phase 00 evidence for this ledger lives in [docs/_documentation_project/evidence/00-inventory-and-editorial-map.md](./_documentation_project/evidence/00-inventory-and-editorial-map.md).
