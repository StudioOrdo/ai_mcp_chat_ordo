# Ordo Core Kernel

The kernel is the smallest durable model that future workflows must reuse.

Detailed contract specs live in [Kernel Contract Specs](contracts/README.md).

## Core Primitives

### Capability

Something the system can do.

Current status: `exists and active`.

Current anchors:

- `src/core/capability-catalog/`
- `src/core/platform/capability-runtime/`
- `src/core/platform/execution/`

Examples:

- search local corpus
- search web
- fetch source
- extract claims
- generate chart
- generate audio
- compose article
- publish page
- create lead
- triage report

Capabilities own schema, role access, execution target, cost/rate policy,
presentation, and provenance behavior.

Gap:

- Recipes still need explicit capability classes and source policies. The
  current catalog has category, family, schema, role, execution, presentation,
  prompt hint, and MCP/runtime data, but not the full recipe-selection
  contract.

### Recipe

A configured workflow pattern.

Current status: `planned contract over existing systems`.

Current anchors:

- none as `Recipe`
- related pieces: `ProductBrief`, `ProductionDAG`, `WorkOrder`

Examples:

- scrollytelling production
- Ordo development
- QR funnel follow-up
- lesson and feedback loop

A recipe defines allowed stages, stage policies, default QA gates, artifact
types, and projection views.

Implementation rule:

- Introduce `Recipe` as a contract over existing factory workflow concepts, not
  as a separate execution engine.
- Do not treat prompts as recipe definitions.
- Do not treat recipe as the primary operator interface. The continuous
  conversation thread remains primary.

### WorkOrder

One durable run of workflow work.

Current status: `exists with upgrade path`.

Current anchors:

- `src/core/entities/work-order.ts`
- `src/core/use-cases/FactoryRepository.ts`

Current code shape:

- Work orders currently point at `briefId` and `currentDag`.
- Future work orders should point at a recipe id/version when the recipe
  contract exists.

A work order should answer:

- who owns this run
- what recipe is running
- what brief or report started it
- what stage is current
- what artifacts exist
- what QA gates are blocking release
- what revision history exists

### StageRun

One executed stage inside a work order.

Current status: `exists`.

Current anchors:

- `src/core/entities/stage-run-record.ts`

Stage runs own status, attempts, timing, result refs, error state, and event
history.

### Artifact

Anything produced, imported, reviewed, or released.

Current status: `partial with multiple active implementations`.

Current anchors:

- `src/core/entities/capability-result.ts`
- `src/core/use-cases/FactoryRepository.ts`
- `src/core/entities/blog-artifact.ts`
- `src/core/entities/media-asset.ts`
- `src/core/entities/materialization.ts`

Examples:

- research packet
- source ref
- claim set
- outline
- draft
- chart
- graph
- audio
- video
- QA report
- release
- donation-funded development item

Implementation rule:

- Do not create a new artifact store until factory outputs, capability
  artifacts, blog artifacts, media assets, and materialization outputs have a
  compatibility map.

## Operator Surface Rule

The kernel supports execution, but the product surface is the conversation
thread.

Kernel entities must always be projectable to that surface:

- status
- evidence
- outputs
- next action

### Evidence

The basis for a decision, claim, bug, or QA finding.

Current status: `partial`.

Current anchors:

- `src/core/entities/conversation-continuity.ts`
- `src/core/entities/research-packet.ts`
- `src/core/entities/materialization.ts`

Examples:

- citation
- source excerpt
- screenshot
- log
- browser/device data
- tool output
- human review note

Implementation rule:

- Evidence should be referenceable across research, QA, bug reports,
  materialization, and release records. It should not be trapped inside one
  artifact payload.

### QAReport

A structured judgment about quality.

Current status: `partial`.

Current anchors:

- `src/core/entities/qa-report.ts`
- `src/lib/blog/blog-article-production-service.ts`
- `src/core/entities/blog-artifact.ts`

QA reports should support:

- pass/fail/warn states
- severity
- affected artifact or stage
- required revision
- reviewer identity
- evidence refs

Implementation rule:

- Keep domain-specific QA payloads where they are useful, but wrap them in a
  generic QA envelope before making QA a cross-platform gate.

### Release

A durable published or shipped output.

Current status: `partial`.

Current anchors:

- `src/core/entities/release.ts`

Current code shape:

- Factory release exists.
- Platform release still needs mapping for article publish, scrollytelling pages,
  social derivatives, Ordo code releases, and partial destination failures.

Examples:

- published scrollytelling page
- released article
- audio episode
- social short
- merged Ordo change
- shipped business workflow improvement

### Projection

A view over durable state.

Current status: `exists`.

Current anchors:

- `src/core/platform/execution/ExecutionTimeline.ts`
- `src/core/platform/execution/ExecutionTimelineProjector.ts`
- `src/core/platform/business-workflow/BusinessWorkflowContextProjector.ts`

Examples:

- timeline
- kanban board
- admin queue
- public roadmap
- published page
- chat summary
- artifact index
- dashboard metric

Implementation rule:

- Projection is a contract family over durable state. It should not become a new
  write model unless a specific projection needs materialization.

### Governance

The controls around the work.

Current status: `partial`.

Current anchors:

- prompt runtime and prompt control plane
- role directives and capability roles
- continuity ownership/lifecycle fields
- identity migration, privacy, and repair planning docs

Examples:

- permissions
- identity
- privacy/deletion
- prompt policy
- source policy
- audit log
- funding priority rules

Implementation rule:

- Split governance into permission policy, prompt policy, privacy/deletion,
  source policy, audit/provenance, and funding-priority rules. These should not
  be collapsed into one generic settings object.

## Explicit Non-Kernels

### Prompt

Prompts are behavior controls. They are not durable workflow state.

### Generic Node

A generic node model should not absorb everything. Articles, work orders, leads,
assets, reports, and releases have different rules.

### UI Card

Cards are projections. They are not source-of-record state.

### Connector

Connectors are capability implementations. They are not workflow definitions.
