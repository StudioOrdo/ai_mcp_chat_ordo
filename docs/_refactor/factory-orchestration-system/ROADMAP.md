# Factory Orchestration System — Implementation Roadmap

## Summary

This document is a complete roadmap for building a **multimodal publishing factory** — a greenfield system that enables solopreneurs to produce high-quality digital products (web pages, guides, reports) end-to-end with both batch automation and single-asset refinement capabilities.

## Architecture Overview

```text
ProductBrief (user intent)
    ↓
DAGPlanner (dynamic stage generation)
    ↓
ProductionDAG (execution plan)
    ↓
ProductionOrchestrator (execution engine)
    ├─ Research Stage → ResearchPacket
    ├─ Draft Stage → Draft
    ├─ Asset Generation (parallel) → Assets (chart, audio, video, image)
    ├─ Composition Stage → Composition (multi-asset page)
    ├─ QA Stage → QAReport
    ├─ QA Remediation → Auto-resolve or pause for user
    └─ Release Stage → Release
    
    ↓ (if QA fails or user wants to refine)
    
Pause → Checkpoint (saved to factory persistence)
    ↓
SingleAssetRefinement (user refines one asset)
    ↓
Resume → RestoreFromCheckpoint (continue from saved state)
    ↓
Release (versioned output)
```

## Phases Overview

| Phase | Focus | Duration | Deliverable |
| ------- | ------- | ---------- | ------------ |
| **Phase 0** | Research existing patterns | 1–2 days | Design decisions, architecture choices |
| **Phase 1** | Core types | 3–4 days | ProductBrief, ProductionDAG, WorkOrder, Asset, QA types |
| **Phase 2** | Persistence backing | 3–4 days | FactoryRepository, SQLite schema, checkpoints |
| **Phase 3** | Orchestration engine | 5–7 days | DAGPlanner, ProductionOrchestrator, stage executors |
| **Phase 4** | QA gates | 3–5 days | QA checks, remediation, asset-level + page-level QA |
| **Phase 5** | Revision loops | 4–6 days | Pause/resume, checkpoint, single-asset refinement |
| **Phase 6** | UI & monitoring | 5–8 days | Batch monitor, single-asset editor, mode switching |

**Total estimate:** 24–37 days (5–7 weeks) for fully functional factory

## Phase Details

### Phase 0: Research & Design

- [x] Document existing patterns (job orchestration, blog article pipeline, media composition)
- [x] Identify codebase foundation (DeferredJobWorker, BlogArticleProductionService, ChatStreamPipeline)
- [x] Make key architecture decisions:
  - **Dynamic DAG generation** (not static templates)
  - **Persistence-first lineage** (dedicated factory tables first, future graph projection optional)
  - **Sequential execution with within-stage parallelization** (not cross-stage)
  - **Pause between stages** (coarse-grained checkpoints)
  - **Auto-retry once, then pause** (QA failure handling)
- [x] Create Phase 0 documentation

Status: complete. One critical output from Phase 0 is that there is no existing `src/core/graph/` subsystem to extend, so Phase 2 needs to introduce the factory persistence contract explicitly rather than assuming a ready-made graph package.

**Deliverable:** `/docs/_refactor/factory-orchestration-system/phase-0-research-design.md`

---

### Phase 1: Core Factory Types

- [x] Create entity types:
  - `ProductBrief` — user input (topic, asset types, QA criteria, preferences)
  - `ProductionStage` — immutable plan node (dependencies + config only)
  - `ProductionDAG` — execution plan (stages + dependency graph)
  - `StageRunRecord` — runtime stage state separate from plan nodes
  - `WorkOrder` — runtime aggregate root with coarse-grained lifecycle
  - `ResearchPacket` — research stage output (sources, claims)
  - `Draft` — structured narrative output before composition
  - `FactoryAsset` — individual generated media (type, URI, QA status, revision)
  - `Composition` — multi-asset page (HTML, assets embedded, lineage)
  - `QAReport` — quality assessment (findings, status, remediation)
  - `Release` — versioned output (version, published URLs, metadata)
  - `Outcome` — post-release observation metrics
- [x] Create TypeScript interfaces for each type
- [x] Add invariant-first validation tests with positive, negative, and edge-case coverage

Status: complete. Phase 1 now exists in `src/core/entities/` with a focused test suite in `tests/factory/types.test.ts`, and the model is ready for Phase 2 persistence work.

**Deliverable:** `/docs/_refactor/factory-orchestration-system/phase-1-core-types.md`

---

### Phase 2: Persistence Backing

- [ ] Add dedicated factory tables in `src/lib/db/tables.ts` for work orders, DAGs, stage runs, artifacts, checkpoints, events, and composition asset membership
- [ ] Preserve `WorkOrder.previousWorkOrderIds` with a queryable multi-parent lineage table instead of collapsing to a single parent column
- [ ] Add only the additive migrations and indexes needed for existing databases
- [ ] Create `FactoryRepository` interface in `src/core/use-cases/`
- [ ] Implement a SQLite-backed factory data mapper in `src/adapters/`
- [ ] Wire repository access through `src/adapters/RepositoryFactory.ts`
- [ ] Give `StageRunRecord` a durable persistence identity and use canonical domain ids for output references
- [ ] Model checkpoint save/resume explicitly with immutable checkpoint rows plus work-order checkpoint pointers
- [ ] Add focused repository tests for positive, negative, and edge cases

**Deliverable:** `/docs/_refactor/factory-orchestration-system/phase-2-graph-backing.md`

---

### Phase 3: Orchestration Engine

- [ ] Build `DAGPlanner` (ProductBrief → ProductionDAG)
  - Use the Phase 1 entity contract: `key`, `kind`, `dependencyKeys`,
    `timeoutMs`, `autoParallelize`
  - Generate deterministic stage keys and one asset-generation stage per
    `ProductBrief.assetKinds` entry
  - Keep the DAG immutable and free of runtime status fields

- [ ] Build `ProductionOrchestrator` (execute persisted work orders against the DAG)
  - Drive runtime state through `StageRunRecord` rows rather than mutating plan
    nodes
  - Persist outputs via `FactoryRepository.appendOutput(...)` and stage
    transitions via `upsertStageRun(...)`
  - Pause with durable checkpoints on failure and map progress into
    deferred-job updates

- [ ] Implement stage executor seams and the minimal concrete executors
  - `ResearchExecutor` — search + extract claims
  - `DraftExecutor` — compose narrative from research
  - `AssetGenerationExecutor` — route to chart/audio/video/image generators
  - `CompositionExecutor` — assemble assets into page
  - `ReleaseExecutor` — version + publish
  - Preserve clean `qa` and `qa_resolution` seams without forcing Phase 4 logic
    early

- [ ] Integrate with the deferred job system (`ProduceProductDeferredJobHandler`)
  - Reuse the existing jobs and chat progress surfaces instead of inventing a
    parallel runner

- [ ] Add comprehensive tests (planner, orchestrator, executor, and
  deferred-job integration)

**Deliverable:** `/docs/_refactor/factory-orchestration-system/phase-3-orchestration.md`

---

### Phase 4: QA Gates

- [x] Reuse the shipped Phase 3 seams: `qa_asset`, `qa_page`, and
  `qa_resolution`
  - Do not collapse them into a new monolithic QA stage
  - Reuse the existing `QACriterion`, `QAFinding`, and `QAReport` entities

- [x] Build a registry-driven QA check layer
  - Asset checks keyed by `FactoryAsset.kind`
  - Page checks keyed by composition plus brief policy
  - Fail closed if requested criteria are unimplemented

- [x] Implement the initial deterministic check set
  - Asset accessibility
  - Asset performance
  - Chart accuracy
  - Composition completeness
  - Composition performance
  - Composition tone or brand checks where a stable analyzer exists

- [x] Deepen `QAExecutor` and `QAResolutionExecutor`
  - `qa_asset` runs asset checks only
  - `qa_page` runs page checks only
  - `qa_resolution` merges reports and applies bounded remediation policy

- [x] Preserve the current orchestrator lifecycle model
  - Keep retry, pause, and checkpoint logic in `ProductionOrchestrator`
  - Keep release blocked on `qa_resolution.status !== "passed"`
  - Extend the stage result contract only if remediation must persist
    supplemental outputs

- [x] Add focused positive, negative, and edge coverage
  - Registry tests
  - Check tests
  - `qa-executor` tests
  - `qa-resolution` remediation tests
  - Orchestrator pause and retry regression tests
  - Deferred-job worker and runtime regression tests

**Deliverable:** `/docs/_refactor/factory-orchestration-system/phase-4-qa-gates.md`

---

### Phase 5: Revision Loops

- [x] Reuse the existing pause and resume runtime instead of inventing a second one
  - `ProductionOrchestrator` remains the only lifecycle controller
  - `FactoryRepository.createCheckpoint`, `findLatestActiveCheckpoint`, and `markCheckpointConsumed` remain the durable resume seams
  - Revision loops still do not mutate `ProductionDAG` nodes to track runtime state

- [x] Add an operator-facing revision control layer
  - Explicit user pause requests for running work orders
  - Safe resume requests for already paused work orders
  - Policy for when pause is immediate, deferred to the next stage boundary, or rejected

- [x] Build single-asset refinement on top of immutable outputs and lineage
  - Regenerate one asset with bounded parameter overrides through the production-root asset-generation handler seam
  - Replace one asset with a user-uploaded file through the existing user-file system
  - Persist revised assets via `supersedesEntityId` and `FactoryAsset.provenance.previousAssetId`
  - Recompute the downstream resume frontier from the refined asset

- [x] Add resume frontier planning
  - Restart from the failed stage when no refinement occurred
  - Restart from `composition` for asset substitutions that affect rendered output
  - Allow earlier-or-equal explicit overrides relative to the safe frontier
  - Preserve already-succeeded upstream stage runs and outputs by resetting the chosen frontier and downstream dependents to `pending`

- [x] Build revision-history and lineage queries
  - Same-work-order checkpoint resumes are captured through revision events, superseded outputs, and checkpoint consumption
  - New work-order branch lineage continues to reuse `WorkOrder.previousWorkOrderIds`
  - Revision history is queryable from the existing event, output, stage-run, and checkpoint persistence seams

- [x] Create API and end-to-end coverage
  - The shipped app transport is `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`, backed directly by the revision root
  - Positive, negative, and edge coverage exists for pause semantics, revision-history reads, asset refinement, frontier planning, and pause -> refine -> resume flows through the route layer
  - Deferred-job and release-gating interactions stay covered through the orchestrator-backed revision tests

**Deliverable:** `/docs/_refactor/factory-orchestration-system/phase-5-revision-loops.md`

---

### Phase 6: UI & Monitoring (Sketch)

- [ ] **Batch Monitor Page**
  - WorkOrder timeline (stages + status)
  - Current stage details (what's running, progress)
  - QA findings (with remediation actions)
  - Pause/Cancel buttons
  
- [ ] **Single-Asset Editor Page**
  - Asset preview (chart, audio, video, image)
  - Parameter adjustment UI (per asset type)
  - Regenerate / Upload buttons
  - QA findings for this asset
  - Back to batch button
  
- [ ] **Revision History Page**
  - Timeline of WorkOrder revisions
  - Compare versions
  - Rollback option
  
- [ ] **Mode Switching**
  - Seamless transition from batch → single-asset → batch
  - Inline refinement without leaving batch monitor
  
- [ ] **Integration with existing chat UI**
  - Batch automation triggered from chat
  - Progress streamed to conversation
  - Links to batch monitor

**Deliverable:** Phase 6 UI design + components (estimated, not yet detailed)

---

## Codebase Integration Points

### Reuse Existing

| Component | Current Use | Factory Use |
| ----------- | ------------- | ------------ |
| `JobQueueRepository` | Draft, publish jobs | Batch automation queuing |
| `DeferredJobWorker` | Job execution | ProduceProduct orchestration |
| `ChatStreamPipeline` | Chat routing | Progress event emission |
| `BlogArticleProductionService` | Article orchestration | Template for ProductionOrchestrator |
| `HybridSearchEngine` | Chat search | Research stage |
| `MediaCompositionService` | Video generation | Asset generation stage |
| `AudioGenerationService` | TTS | Audio asset generation |
| SQLite data-mapper + RepositoryFactory seams | Existing persistence style | Factory entity storage |

### New Components

| Component | Purpose | Location |
| ----------- | --------- | ---------- |
| ProductBrief, ProductionDAG, WorkOrder | Core types | `src/core/entities/` |
| FactoryRepository | Factory persistence | `src/core/use-cases/` |
| FactoryDataMapper | SQLite-backed implementation | `src/adapters/` |
| DAGPlanner | Stage generation | `src/lib/factory/` |
| ProductionOrchestrator | Orchestration engine | `src/lib/factory/` |
| Stage executors | Stage-specific logic | `src/lib/factory/stage-executors/` |
| QA checks | Quality assessment | `src/lib/factory/qa-checks/` |
| Revision workflow | Pause/resume/refine | `src/lib/factory/revision-workflow.ts` |
| Factory REST API | User-facing endpoints | `src/app/api/factory/` |

---

## Key Success Metrics

### Functional MVP

- [ ] Generate a multi-asset page (chart + audio + video + image) via batch automation
- [ ] Run per-asset + page-level QA
- [ ] Auto-resolve simple QA findings
- [ ] Pause mid-batch, refine single asset (e.g., regenerate chart), resume
- [ ] Track full revision history

### Code Quality

- [ ] No duplicate stage orchestration logic (blog + factory share patterns)
- [ ] All stages testable in isolation
- [ ] FactoryRepository provides durable checkpoint/resume
- [ ] 80%+ test coverage

### Performance

- [ ] Asset generation parallelized (not sequential)
- [ ] Checkpoint save < 100ms
- [ ] Resume from checkpoint < 500ms
- [ ] QA checks on 4-asset page < 30s

### User Experience

- [ ] Batch automation feels automatic (user writes brief, system produces result)
- [ ] Single-asset refinement feels immediate (user sees live regeneration)
- [ ] Pause/resume feels seamless (user doesn't lose context)

---

## Known Unknowns / Future Work

1. **Cross-stage parallelization** — currently sequential; could parallelize independent asset generation + composition
2. **User-defined stage insertion** — currently fixed stages; could allow user to add custom stages (e.g., "add watermark")
3. **DAG branching** — currently linear; could support conditional stages (e.g., skip video if brief says "text only")
4. **Distributed execution** — currently assumes single-process; could distribute stages to multiple workers
5. **Cost optimization** — no cost awareness; could prioritize expensive stages first in queue
6. **Interactive refinement loops** — currently user pauses + refines; could stream QA findings in real-time

---

## References

**Existing codebase patterns:**

- Blog article orchestration: `src/core/use-cases/tools/blog-production.tool.ts`
- Job orchestration: `src/lib/jobs/deferred-job-worker.ts`
- Stream pipeline: `src/lib/chat/stream-pipeline.ts`
- Media composition: `src/lib/media/ffmpeg/`
- SQLite-backed persistence and provenance: `src/lib/`, `src/adapters/`

**Documentation:**

- Deferred Job Orchestration spec: `docs/_archive/_specs/deferred-job-orchestration/spec.md`
- Blog Article Production spec: `docs/_archive/_specs/blog-article-production-pipeline/spec.md`
- Platform V1 spec: `docs/_archive/_specs/platform-v1/spec.md`

---

## Next Action

**Start Phase 0 (already complete)** → Review architecture decisions with team → Begin Phase 1 type definitions

---

*Last updated: 2026-04-27*
*Phase roadmap ready for implementation*
