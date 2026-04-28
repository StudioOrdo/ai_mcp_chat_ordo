# Phase 0 — Research & Design: Existing Patterns & Factory Architecture

## Objective

Document existing job orchestration, media generation, and QA patterns in the codebase. Ground the factory design in production-proven infrastructure. Clarify architecture decisions before implementation.

## Status

- Research: Complete
- Completion date: 2026-04-27
- Exit criterion met: existing orchestration, media, and runtime patterns verified and mapped to factory requirements

## Key Findings

### 1. Job Orchestration Foundation

**File:** `src/core/entities/job.ts`, `src/lib/jobs/`

**Current state:**
- Jobs have explicit lifecycle: `queued → running → succeeded/failed/canceled`
- Each job has retry policy, recovery mode, result retention mode
- Job events are append-only (audit trail)
- Progress tracked via `JobProgressPhaseDefinition` (ordered stages with status)
- Job results streamed back to conversation via `buildJobPublication()`

**Factory implication:**
- ProductionDAG stages map naturally to job phases
- Each stage result is a job event; save to append-only log
- Progress labels already implemented for chat feedback

**Code pattern:**
```typescript
// From src/lib/jobs/job-capability-types.ts
export interface JobCapabilityDefinition {
  toolName: string;
  retryPolicy: JobRetryPolicy;
  recoveryMode: JobRecoveryMode; // 'rerun' or 'checkpoint_resume'
  progressPhases?: readonly JobProgressPhaseDefinition[];
}

// From src/core/entities/job.ts
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type JobEventType = "queued" | "started" | "progress" | "result" | "failed" | ... ;
```

**Reuse strategy:**
- Extend `JobCapabilityDefinition` to support multi-stage workflows
- Use existing `progressPhases` to track production stages
- Leverage `DeferredJobWorker` for batch execution

---

### 2. Blog Article Orchestration (Reference Implementation)

**File:** `src/core/use-cases/tools/blog-production.tool.ts`, `src/lib/blog/blog-article-production-service.ts`

**Current pattern:**
- Single orchestration tool (`produce_blog_article`) composes discrete stage tools
- Deterministic sequencing:
  1. Draft content
  2. QA review
  3. Resolve QA findings
  4. Generate image prompt
  5. Generate hero image
  6. Persist draft

- Each stage is a separate service; orchestrator delegates
- Progress labels at each stage
- Full artifact trail persisted (lineage)

**Factory implication:**
- This is exactly the pattern we need for multi-asset products
- Already handles sequential + QA + remediation
- Can extend from article → generic WorkOrder

**Verified execution pattern:**
```typescript
// From blog-article-production-service.ts
async produceArticle(input, context, reportProgress) {
  const composed = await this.composeArticle(input);
  const qaReport = await this.reviewArticle(composed);
  const resolved = qaReport.findings.length > 0
    ? await this.resolveQa(composed, qaReport)
    : { ...composed, resolutionSummary: "No QA changes were required." };
  const imagePrompt = await this.designHeroImagePrompt(resolved);
  const generatedImage = await this.imageService.generate({ ...imagePrompt });
  const draft = await executeDraftContent(...);
}
```

**Reuse strategy:**
- Extract this into a generic `ProductionOrchestrator`
- Make stages pluggable (chart, video, audio, etc. not just article + image)
- Support user-defined stage sequences from ProductBrief

---

### 3. Media Composition (Video, Audio, Chart Generation)

**File:** `src/lib/media/`, `src/app/e2e/media-lab/`

**Current capability:**
- FFmpeg browser worker for video composition
- Server-side media workers for processing
- Audio generation (TTS)
- Chart generation via API
- Media asset provenance tracked

**Example workflow:**
```typescript
// From MediaE2ELab.tsx
const image = await generateImage();
const audio = await generateAudio(image);
const video = await composeVideo(image, audio);
```

**Factory implication:**
- All multi-media asset types already available
- Can parallelize asset generation (chart, video, audio independently)
- Provenance tracking already in place

**Reuse strategy:**
- Wrap each media type as a stage in ProductionDAG
- Parallelize within DAG execution
- Reuse asset provenance storage

---

### 4. Stream Pipeline & Modular Stages

**File:** `src/lib/chat/stream-pipeline.ts`, `src/lib/chat/stream-*.ts`

**Current pattern:**
- `ChatStreamPipeline` is an orchestrator class
- Each concern is a separate file:
  - `stream-intake.ts` — validate/parse input
  - `stream-preparation.ts` — build execution context
  - `stream-execution.ts` — run tool logic
  - `stream-short-circuits.ts` — special cases (math, etc.)
  
- Each stage is pluggable, testable independently

**Factory implication:**
- Factory stages should follow same modular pattern
- One orchestrator class, many stage services
- Easy to test each stage in isolation

**Code pattern:**
```typescript
// From stream-pipeline.ts
export class ChatStreamPipeline {
  async prepareStreamContext(...) { ... }
  async executeStreamResponse(...) { ... }
  async completeStreamResponse(...) { ... }
}
// Each method delegates to a separate module
```

**Reuse strategy:**
- Create `ProductionOrchestrator` class
- Each stage (research, draft, asset generation, QA, etc.) is a separate service
- Orchestrator manages execution order and checkpoints

---

### 5. Tool Registry & Capability Manifest

**File:** `src/core/tool-registry/`, `src/core/capability-catalog/`

**Current state:**
- Tools registered with metadata (name, family, label, roles, retry policy, etc.)
- RBAC layer controls who can execute which tools
- Capability definitions drive UI and execution

**Factory implication:**
- ProductionDAG stages should be discoverable like tools
- Future: Expose factory stages as MCP tools for automation

**Reuse strategy:**
- Register factory stages in tool registry
- Respect RBAC layer for batch automation permissions
- Use same capability definition pattern

---

### 6. Graph Storage (Emerging)

**File:** No dedicated factory graph package exists yet.

**Current state:**
- There is no verified `src/core/graph/` implementation in the current repository.
- The closest reusable foundations today are SQLite-backed application storage, job event histories, and media provenance/materialization flows.
- Factory graph backing remains a planned capability rather than an existing subsystem.

**Factory implication:**
- Phase 2 must introduce the factory persistence contract explicitly.
- Checkpoint, lineage, and revision queries should be designed against a new repository surface rather than assumed from existing code.
- We should preserve append-only semantics already used in job and artifact histories.

**Reuse strategy:**
- Reuse current SQLite operational patterns and append-only job history semantics.
- Introduce factory-specific nodes and edges in Phase 2 instead of coupling to a nonexistent graph package.
- Keep current file and media storage intact while factory persistence is added alongside it.

---

## Architecture Decisions

### Decision 1: DAG Definition — Static Templates vs. Dynamic Generation

**Options:**
- A. **Static templates** — predefined workflows like "Article with 3 charts", "Guide with video"
- B. **Dynamic generation** — ProductBrief → planner service → DAG

**Decision:** **Dynamic generation (Option B)**

**Rationale:**
- Solopreneurs have diverse needs; templating gets rigid
- ProductBrief is already a structured input; generator can be deterministic
- Easier to add new asset types (just add to planner, not templates)

**Implementation:**
```typescript
interface ProductBrief {
  title: string;
  topic: string;
  asset_types: ('chart' | 'graph' | 'audio' | 'video' | 'image')[];
  qa_criteria: string[];
  // ... more fields
}

function generateProductionDAG(brief: ProductBrief): ProductionDAG {
  const stages = [];
  stages.push(researchStage());
  
  if (brief.asset_types.includes('chart')) stages.push(chartGenerationStage());
  if (brief.asset_types.includes('video')) stages.push(videoGenerationStage());
  // ... etc
  
  stages.push(compositionStage());
  stages.push(qaStage());
  stages.push(releaseStage());
  
  return new ProductionDAG(stages);
}
```

---

### Decision 2: Graph Backing — When & How to Migrate Corpus

**Options:**
- A. Keep file-based corpus, add graph layer on top
- B. Migrate corpus to graph-backed storage
- C. Dual-write during transition (eventual consistency)

**Decision:** **Add graph layer first (Option A), migrate corpus later**

**Rationale:**
- Minimal disruption to existing search/retrieval
- Graph becomes checkpoint store for factory
- Can run parallel for performance comparison
- Migrate when convinced of correctness

**Implementation:**
```typescript
// Phase 2: Add factory-specific graph nodes
interface WorkOrderNode {
  id: string;
  type: 'work_order';
  brief: ProductBrief;
  status: ProductionStage;
  createdAt: string;
  updatedAt: string;
}

interface StageResultNode {
  id: string;
  type: 'stage_result';
  workOrderId: string;
  stageName: string; // 'research', 'chart_gen', 'qa', etc.
  result: unknown; // stage-specific result
  status: 'pending' | 'running' | 'success' | 'failed';
}
```

---

### Decision 3: Pause/Resume Protocol — Checkpoint Granularity

**Options:**
- A. Only pause between stages (coarse)
- B. Pause within stages, save partial results (fine-grained)
- C. Both — pause between stages by default, fine-grained on demand

**Decision:** **Pause between stages (Option A), expand to fine-grained later**

**Rationale:**
- Simpler to implement first
- Covers 90% of use case (pause after chart gen, refine, resume)
- Can add fine-grained checkpointing if needed

**Implementation:**
```typescript
interface WorkOrderCheckpoint {
  workOrderId: string;
  pausedAt: string;
  currentStageIndex: number; // which stage to resume from
  stageResults: Map<string, unknown>; // results so far
  userPauseReason?: string;
}
```

---

### Decision 4: Parallel Execution — Within-Stage vs. Cross-Stage

**Options:**
- A. Execute stages sequentially; parallelize within each stage (chart gen in parallel)
- B. Parallelize compatible stages (research + chart gen in parallel if independent)
- C. Both — default sequential, user can specify parallelize

**Decision:** **Sequentially with within-stage parallelization (Option A)**

**Rationale:**
- Blog article orchestration (existing) is sequential
- Within-stage parallelization (3 charts in parallel) is already implemented
- Avoids DAG complexity; can add cross-stage parallelization later
- Easier to reason about checkpoint/resume

---

### Decision 5: QA Failure Handling — Auto-retry vs. Pause

**Options:**
- A. Auto-retry failed asset with backoff, then pause if all retries exhausted
- B. Pause immediately on QA failure, ask user for guidance
- C. Configurable per-QA-criterion (auto-retry data issues, pause on tone)

**Decision:** **Auto-retry once, pause on second failure (Option A variant)**

**Rationale:**
- Handles transient failures (API timeouts) automatically
- Avoids endless retries (one retry only)
- User gets clear visibility when they need to intervene

---

## Codebase Gaps

| Gap | Impact | Timing |
|-----|--------|--------|
| No explicit ProductBrief type | Batch automation needs structured input | Phase 1 |
| No DAG planner service | Dynamic stage generation needed | Phase 1 |
| No generic multi-asset orchestrator | Only blog article orchestration exists | Phase 3 |
| Graph schema missing factory entities | Checkpoint/resume needs graph storage | Phase 2 |
| No QA remediation loop | Blog has it; needs generalization | Phase 4 |
| No UI for batch monitoring | Batch automation invisible to user | Phase 6 |
| No pause/resume mechanism | Factory can't be interrupted | Phase 5 |

---

## Phase 0 Exit Output

- Verified reusable anchors:
  - Job lifecycle and progress definitions in `src/core/entities/job.ts` and `src/lib/jobs/job-capability-types.ts`
  - Deferred execution runtime in `src/lib/jobs/deferred-job-worker.ts`
  - Reference orchestration in `src/lib/blog/blog-article-production-service.ts`
  - Modular runtime orchestration in `src/lib/chat/stream-pipeline.ts`
  - Media generation and provenance surfaces in `src/lib/media/` and `src/lib/audio/`
- Verified gaps:
  - No factory entity model yet
  - No generic production DAG planner or orchestrator yet
  - No dedicated graph persistence package exists yet
- Implementation handoff:
  - Phase 1 should start with the core entity model because every later phase depends on stable factory types

---

## Next Steps

1. **Phase 1**: Define ProductBrief, ProductionDAG, WorkOrder types
2. **Phase 2**: Extend graph schema for factory entities
3. **Phase 3**: Build ProductionOrchestrator class (multi-asset generalization)
4. **Phase 4**: Implement QA gates + remediation logic
5. **Phase 5**: Add pause/resume + inline refinement
6. **Phase 6**: Build UI (batch monitor + single-asset editor)

---

## References

- Blog article orchestration: `src/core/use-cases/tools/blog-production.tool.ts`
- Job orchestration: `src/lib/jobs/deferred-job-worker.ts`
- Stream pipeline: `src/lib/chat/stream-pipeline.ts`
- Media composition: `src/lib/media/ffmpeg/`
- SQLite-backed persistence and provenance: `src/lib/`, `src/adapters/`
