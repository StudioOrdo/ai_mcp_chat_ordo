# Factory Orchestration System — Multi-Asset Publishing Pipeline

## Overview

This is a greenfield design for a **multimodal publishing factory** that enables solopreneurs to produce high-quality digital products (web pages, guides, reports) end-to-end, with both:

1. **Single-asset refinement** — user focuses on one artifact with immediate feedback
2. **Batch automation** — user describes a high-level product; system produces it end-to-end

## Core Principles

- **Dynamic DAG generation** — ProductBrief → production stages (not static templates)
- **Persistence-first lineage** — durable factory records use repo-native SQLite tables first, with lineage preserved explicitly and future graph projection left optional
- **Parallel execution** — asset generation parallelized by default
- **Checkpoint & resume** — pause mid-workflow, refine single asset, resume from checkpoint
- **Unified lifecycle** — all artifacts (text, chart, audio, video, image, page) follow same state machine
- **QA gates** — per-asset and page-level quality checks with remediation loops

## Existing Foundation

The codebase has production-quality infrastructure we build on:

| Component | Location | Capability |
| ----------- | ---------- | ----------- |
| Job orchestration | `src/lib/jobs/` | `JobQueueRepository`, `DeferredJobWorker`, progress tracking |
| Blog article pipeline | `src/lib/blog/`, `src/core/use-cases/tools/blog-production.tool.ts` | Full orchestration with QA + image generation (reference implementation) |
| Media composition | `src/lib/media/` | FFmpeg integration, video/audio generation, asset provenance |
| Stream pipeline | `src/lib/chat/stream-pipeline.ts` | Modular stage services, progress labels, event streaming |
| Tool registry | `src/core/tool-registry/` | Capability manifest, RBAC, tool composition |
| SQLite-backed persistence surfaces | `src/lib/`, `src/adapters/` | Existing SQLite patterns and media provenance; factory graph backing is still a Phase 2 gap |

## Phase Sequence

| Phase | Goal | Dependencies |
| ------- | ------ | -------------- |
| **Phase 0** | Research & design grounded in existing patterns | — |
| **Phase 1** | Core factory types (ProductBrief, ProductionDAG, WorkOrder) | Phase 0 |
| **Phase 2** | Add durable factory persistence backing and checkpoint storage | Phase 1 |
| **Phase 3** | Multi-asset orchestrator (parallel generation) | Phase 2 |
| **Phase 4** | QA gates (per-asset + page-level) | Phase 3 |
| **Phase 5** | Revision loops (pause/resume, inline refinement) | Phase 4 |
| **Phase 6** | UI & monitoring (batch mode + single-asset editor) | Phase 5 |

## Current Status

- Phase 0 is complete as a research and design deliverable.
- The concrete output is [phase-0-research-design.md](/Users/kwilliams/Projects/ordoSite/docs/_refactor/factory-orchestration-system/phase-0-research-design.md).
- Phase 1 is implemented: core factory entity types, pure validators, and invariant-first tests now exist in `src/core/entities/` and `tests/factory/types.test.ts`.
- The next implementation step is Phase 2: implement the factory persistence contract and SQLite-backed storage model described in [phase-2-graph-backing.md](/Users/kwilliams/Projects/ordoSite/docs/_refactor/factory-orchestration-system/phase-2-graph-backing.md).

## Key Design Questions

1. **DAG definition**: Should stages be code-based (templates) or generated from ProductBrief?
2. **Persistence backing**: What is the smallest durable schema that supports lineage, checkpoints, and rehydration without inventing a fake graph subsystem?
3. **Pause/resume**: Checkpoint protocol — what state needs to be saved?
4. **Failure recovery**: Retry strategy — auto-retry with backoff, or pause and ask user?
5. **Cost optimization**: How to prioritize expensive stages in queue?

## Success Criteria

- Build a page with chart + video + audio + image using batch automation
- All assets individually QA'd, page-level QA'd, revisions applied
- Pause batch mid-workflow, refine single asset, resume automatically
- Single-asset refinement with immediate feedback (no batch overhead)
