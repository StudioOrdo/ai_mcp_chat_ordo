# Current System Map

Product direction has evolved, but this is not a greenfield codebase.

The current system already implements most of the runtime spine needed for the
vision.

## Existing Foundations

### Capability Catalog And Runtime Binding

Current anchors:

- `src/core/capability-catalog/`
- `src/core/platform/capability-runtime/`
- `src/core/platform/execution/`
- `mcp/operations-server.ts`

Current behavior:

- catalog is the source of truth for identity, schema, role access, execution,
  presentation, and MCP-facing export metadata
- runtime bindings map capability plans to execution adapters

### Stream Routing, Execution, And Work Orders

Current anchors:

- `src/core/entities/work-order.ts`
- `src/core/entities/production-dag.ts`
- `src/core/entities/stage-run-record.ts`
- `src/core/use-cases/FactoryRepository.ts`
- `src/adapters/FactoryDataMapper.ts`
- `src/lib/factory/`

Current behavior:

- stream path prepares context and prompt assembly
- selected capabilities execute inline, deferred, MCP, browser, or remote
- factory entities provide durable stage/work-order representation for complex
  workflows

### Jobs, Timelines, And User-Facing Status

Current anchors:

- `src/core/entities/job.ts`
- `src/lib/jobs/`
- `src/core/platform/execution/ExecutionTimeline.ts`
- `src/core/platform/execution/ExecutionTimelineProjector.ts`

Jobs currently act as execution envelopes and projection inputs. Work orders are
workflow aggregates.

Primary gap: keep status presentation and durable job/work-order state fully
reconciled across chat and admin surfaces.

### Artifacts, Assets, And Materialization

Current anchors:

- `src/core/entities/materialization.ts`
- `src/core/entities/asset-catalog.ts`
- `src/core/entities/media-asset.ts`
- `src/adapters/UserFileDataMapper.ts`
- `src/lib/media/`
- `src/lib/blog/`

The artifact layer should unify generated outputs, user files, blog assets,
factory assets, research packets, QA reports, releases, and derivatives.

### Blog And Journal

Current anchors:

- `src/core/entities/blog.ts`
- `src/core/entities/blog-revision.ts`
- `src/core/entities/blog-artifact.ts`
- `src/core/entities/blog-asset.ts`
- `src/lib/blog/`
- `src/lib/journal/`

Blog and journal should become content-production recipes, not isolated workflow
engines.

### Prompt Governance And Continuity

Current anchors:

- `src/lib/chat/prompt-runtime.ts`
- `src/lib/prompts/prompt-control-plane-service.ts`
- `src/core/entities/role-directive-assembler.ts`
- `src/lib/db/tables.ts`

Prompt runtime already governs behavior and voice through slot composition.

Guardrail remains: prompts do not become workflow truth or permission truth.

### Business Processes

Current anchors:

- `src/core/entities/business-workflow-context.ts`
- `src/core/entities/conversation-continuity.ts`
- `src/core/entities/operator-transition.ts`
- `src/core/entities/trust-distribution.ts`
- lead, consultation, deal, training path, referral tables in
  `src/lib/db/tables.ts`

The QR/referral/funnel system should be visible as a business process, not just
admin tables.

## Main Architectural Risk

The risk is architectural drift between:

- the implemented runtime spine
- older forward-looking docs
- new product positioning

If docs lag reality, teams reintroduce duplicate concepts.

Before adding major systems, map work to:

- existing capability catalog
- existing work order and stage model
- existing artifact/materialization model
- existing prompt and continuity governance
- existing business object refs
- existing projection surfaces and business views

## Kernel Primitive Inventory

Status labels:

- `exists`: the concept already has a durable code model.
- `partial`: the concept exists, but only for one domain or without all needed
  platform fields.
- `exists under another name`: the code has the pieces, but not the target
  kernel name or boundary.
- `new concept`: the architecture needs a new contract before implementation.

| Kernel primitive | Current status | Current anchors | Notes |
| --- | --- | --- | --- |
| `Capability` | exists | `src/core/capability-catalog/`, `src/core/platform/capability-runtime/`, `src/core/platform/execution/` | Strongest existing kernel candidate. Missing explicit capability class/source policy fields for recipe selection. |
| `Recipe` | new concept | none | Should be introduced as a contract over current `ProductBrief` and `ProductionDAG`, not as a separate runner. |
| `WorkOrder` | partial | `src/core/entities/work-order.ts`, `src/core/use-cases/FactoryRepository.ts` | Exists as factory aggregate. Missing `recipeId`, `recipeVersion`, visibility, and generic start-input linkage. |
| `StageRun` | exists | `src/core/entities/stage-run-record.ts` | Good durable unit for attempts, result refs, status, and timing. |
| `Artifact` | partial | `src/core/entities/capability-result.ts`, `src/core/use-cases/FactoryRepository.ts`, `src/core/entities/blog-artifact.ts`, `src/core/entities/materialization.ts` | Several artifact shapes exist. Stage 03 must define compatibility before creating new storage. |
| `Evidence` | partial | `src/core/entities/conversation-continuity.ts`, `src/core/entities/research-packet.ts`, `src/core/entities/materialization.ts` | Evidence exists as source refs, canonical evidence refs, sources, claims, and materialization evidence. Needs one common reference model. |
| `QAReport` | partial | `src/core/entities/qa-report.ts`, `src/lib/blog/blog-article-production-service.ts`, `src/core/entities/blog-artifact.ts` | Current QA is factory/blog-specific. Needs generic envelope with affected target, reviewer, evidence, revision requirement, and disposition. |
| `Release` | partial | `src/core/entities/release.ts` | Exists for factory outputs. Needs mapping for article publish, social derivative, and Ordo code release. |
| `Projection` | exists | `src/core/platform/execution/ExecutionTimeline.ts`, `src/core/platform/business-workflow/BusinessWorkflowContextProjector.ts` | Should remain read-model/projector contracts, not a new source-of-record table by default. |
| `Governance` | partial | prompt runtime/control plane, role directives, identity/privacy docs, deletion/lifecycle fields | Split into permission, prompt, privacy, source policy, audit, and funding-priority subdomains before implementation. |

## Duplicate Concept Watchlist

These areas need consolidation or adapters before new abstractions are added.

- `ProductBrief` and `ProductionDAG` already describe much of what `Recipe`
  runs should need, but they are factory-oriented.
- Blog/journal production has its own stage sequence and artifact persistence.
  It should become a proof workflow for recipe migration.
- Factory outputs, blog artifacts, capability artifacts, media assets, and
  materialization records all overlap with the planned `Artifact` primitive.
- `ResearchPacket.sources`, `ResearchPacket.claims`, `CanonicalEvidenceRef`,
  and `MaterializationRecord.evidenceRefs` overlap with the planned `Evidence`
  primitive.
- Factory QA reports and blog QA reports overlap with the planned generic
  `QAReport`.
- Business workflow context already projects lead, consultation, deal, training,
  and referral process state. Business process views should reuse that projector
  model.

## Inventory Decision

Stage 01 should not implement new contracts. It should finish when each planned
kernel primitive has:

- a current-code status label
- at least one code anchor or an explicit `new concept` label
- known duplicate concepts listed
- migration pressure documented
- the next implementation stage scoped tightly enough for spec QA
