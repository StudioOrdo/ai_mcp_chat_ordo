# Jobs, Workflows, Operations, And Factory

## UX Intent

The user should understand work as:

- waiting
- in progress
- needs review
- ready
- needs repair

The system can keep jobs, media workflows, operations, and factory work orders
as separate runtime contracts. The UX should converge them into Work cards,
Studio runs, approvals, and provenance details.

## Existing Code Evidence

Jobs:

- `src/lib/jobs/**`
- `src/components/jobs/**`
- `src/app/jobs/page.tsx`
- `src/app/api/jobs/**`
- `job_requests`
- `job_events`

Operations:

- `src/core/entities/operation.ts`
- `src/core/use-cases/operations/**`
- `src/lib/operations/**`
- `src/components/operations/**`
- `src/app/operations/**`
- `operations`
- `operation_steps`
- `operation_events`
- `operation_actions`
- `operation_artifacts`

Media workflows:

- `src/lib/media/workflows/**`
- `media_workflows`
- `media_workflow_steps`
- `media_workflow_events`

Factory work:

- `src/lib/factory/**`
- `src/core/entities/work-order.ts`
- `src/core/entities/factory-constants.ts`
- `factory_work_orders`
- `factory_stage_runs`
- `factory_outputs`
- `factory_events`

Tests:

- `src/lib/jobs/**.test.ts`
- `src/components/jobs/**.test.tsx`
- `src/core/use-cases/operations/**.test.ts`
- `src/lib/operations/**.test.ts`
- `src/lib/media/workflows/**.test.ts`
- `src/lib/factory/**.test.ts`
- `src/app/jobs/page.test.tsx`
- `src/app/operations/**.test.tsx`

## Current Functionality

Jobs support:

- deferred execution
- queue ownership and anonymous-session visibility
- job events
- event streams
- status snapshots
- materialization registration
- retry/replay/cancel-style actions
- job publication to chat cards

Operations support:

- operation kinds: backup/restore, media workflow, factory work order,
  onboarding/help flow
- risk levels and confirmation policies
- visibility: conversation, user, staff, admin, system
- durable steps, actions, artifacts, and events
- action dispatch and policy
- prompt grounding for active operations

Media workflows support:

- higher-level workflow snapshots over linked jobs
- steps/events/final artifact
- operation launcher/reconciler
- read model for user and conversation workflows
- architecture guardrails to prevent duplicate user cards

Factory work supports:

- work orders and DAGs
- stage runs
- outputs/checkpoints/events
- research/draft/asset/QA/release stage executors
- QA checks and remediation
- pause/resume/cancel/retry controls through operation actions

## UX Mapping

| Runtime contract | UX object | Primary surface | Diagnostic surface |
| --- | --- | --- | --- |
| `job_requests` | Work run or production step | Today/Studio | `/jobs` |
| `media_workflows` | Workflow run | Studio | `/jobs` or workflow detail |
| `operations` | Approval/protected work | Today/Studio/Admin | `/operations` |
| `factory_work_orders` | Complex production run | Studio/Admin | Factory/admin diagnostics |
| `activity_receipts` | Read/ack state | Today/Attention | Admin/activity diagnostics |

## Product Requirements

1. Regular users should not need `/jobs`.
2. Normal work appears as a Work or Run card.
3. Media workflow cards should suppress duplicate linked job cards.
4. Operation actions should appear as clear approval cards/buttons.
5. Factory work should surface as one coherent production run, not as a stage
   table.
6. Every Work detail should expose provenance, history, source conversation,
   related media/content, and available actions.
7. Staff/admin can inspect raw job and operation diagnostics.

## Gaps

- Jobs page remains visually prominent in some navigation contexts.
- Factory work is powerful but not yet shaped into a regular Studio UX.
- Operations are correctly durable but still carry implementation language in
  several user-facing areas.
- Workflow templates and editable repeatable runs are not first class yet.

## Tests To Preserve Or Add

Existing:

- job runtime contracts
- job event stream and snapshot state
- media workflow read model and orchestration
- operation state machine and action policy
- factory operation executor/reconciler
- Studio projection tests that suppress linked job duplicates

Add:

- regular navigation cannot expose raw Jobs as primary UX
- Work cards use plain labels for job/workflow/operation state
- operation confirmations are keyboard/screen-reader accessible
- factory work order detail projects into one user-facing run card
- failed jobs/workflows show repair actions and preserve source material
