# Phase 11: QA, Docs, And Product Closeout

Status: Implemented and QA closed on 2026-05-03

Closeout evidence:
`docs/_refactor/agentos-operation-kernel/evidence/phase-11-closeout.md`

## QA Certification

This phase was rewritten after Phases 00 through 10 were implemented and QA
verified. It is grounded in the current operation domain, SQLite ledger,
operation action dispatch, prompt grounding, backup/restore migration, media
workflow migration, factory migration, admin/conversation surfaces, role-gated
system handbook, Docker appliance runtime, and Rust native boundary.

Key corrections from the original Phase 11 draft:

- Phase 11 is not a broad feature phase. It is the package closeout phase: prove
  the operation kernel is canonical, document how to use it, prune replaced
  paths, and preserve final evidence.
- Role-gated system documentation already exists in `docs/_corpus/system-docs`;
  this phase should harden and expand that book instead of inventing a second
  docs channel.
- Operation cards and buttons already exist as first-class rich-content UI.
  Phase 11 should use them for help/onboarding and final product QA, not fall
  back to plain text action prompts.
- The Rust boundary is already operation-aware through native command/result
  contracts. Closeout must verify Rust remains a deterministic executor and does
  not become a second product brain.
- The closeout evidence must be repeatable. A future maintainer should be able
  to rerun the listed commands and confirm the same contract.

## Goal

Close the AgentOS operation kernel package with evidence, documentation, runtime
QA, dead-code pruning, and product-level proof.

The net result should be:

- every implemented complex workflow is either operation-backed or explicitly
  documented as out of scope,
- conversation and admin surfaces project the same operation truth,
- role-appropriate help and onboarding use the role-gated corpus and operation
  action buttons,
- dangerous work cannot execute through chat text,
- Docker still ships a single-image appliance,
- Rust native execution remains behind structured operation-aware contracts,
- package docs accurately describe the current implementation.

## Inputs From Phase 00 Through Phase 10

- Phase 00 captured baseline evidence and the failure mode: chat text, tool
  results, jobs, logs, and subsystem records could drift.
- Phase 01 defined the operation domain, state machine, actions, events,
  artifacts, visibility, risk, and kind registry.
- Phase 02 implemented the SQLite operation ledger and read models.
- Phase 03 implemented typed operation action dispatch and stale-action safety.
- Phase 04 implemented deterministic operation intent compilation and routing.
- Phase 05 made operation state and tool evidence part of chat grounding.
- Phase 06 migrated backup/restore onto operation actions and native result
  reconciliation.
- Phase 07 projected media workflows and media worker state through operations.
- Phase 08 projected factory work orders, stages, retry/refinement, and outputs
  through operations.
- Phase 09 added operation-backed conversation/admin surfaces, help flows, and
  onboarding flows with visible operation cards and buttons.
- Phase 10 hardened the Rust boundary with native command/result contracts,
  native result reconciliation, and binary registry checks.

Phase 11 must prove the package works as a whole.

## Current Code Grounding

### Operation Domain And Storage

Use these as the canonical operation model:

- `src/core/entities/operation.ts`
- `src/core/entities/operation.test.ts`
- `src/core/use-cases/operations/OperationStateMachine.ts`
- `src/core/use-cases/operations/OperationKindRegistry.ts`
- `src/core/use-cases/operations/OperationActionPolicy.ts`
- `src/core/use-cases/operations/OperationRepository.ts`
- `src/core/use-cases/operations/OperationReadModel.ts`
- `src/adapters/OperationDataMapper.ts`
- `src/adapters/OperationDataMapper.test.ts`
- `src/lib/db/migrations.ts`
- `src/lib/db/tables.ts`

The implemented storage contract includes:

- `operations`
- `operation_steps`
- `operation_events`
- `operation_actions`
- `operation_artifacts`

Phase 11 must verify those tables remain the only operation source of truth.

### Operation APIs And Action Dispatch

Use:

- `src/app/api/operations/route.ts`
- `src/app/api/operations/[operationId]/route.ts`
- `src/app/api/operations/[operationId]/actions/[actionId]/route.ts`
- `src/app/api/operations/[operationId]/events/route.ts`
- `src/app/api/operations/[operationId]/artifacts/route.ts`
- `src/lib/operations/operation-action-api.ts`
- `src/lib/operations/operation-action-dispatch-root.ts`
- `src/core/use-cases/operations/OperationActionDispatch.ts`

The important contract is:

- user-visible transitions go through `OperationActionDispatchService`,
- route handlers parse and validate typed action payloads,
- action policy enforces role, revision, status, expiry, confirmation,
  idempotency, and payload schema,
- action dispatch records evidence before/after execution.

Phase 11 must search for dangerous legacy routes or chat actions that bypass
this path.

### Intent, Prompt Truth, And Chat Projection

Use:

- `src/lib/operations/operation-intent-root.ts`
- `src/lib/operations/operation-intent-compiler.ts`
- `src/lib/operations/operation-intent-schema.ts`
- `src/lib/operations/operation-intent-ingress.ts`
- `src/lib/operations/operation-intent-projection.ts`
- `src/lib/operations/operation-prompt-grounding-root.ts`
- `src/lib/operations/operation-prompt-grounding.ts`
- `src/lib/operations/operation-tool-evidence.ts`
- `src/lib/chat/stream-preparation.operation-grounding.test.ts`
- `tests/chat/chat-stream-route.prompt-runtime-seam.test.ts`

The current contract is:

- the intent compiler may draft or classify but cannot execute,
- complex requests become operation drafts or clarifying questions,
- operation state and relevant tool evidence are injected into backend prompt
  grounding,
- the assistant is not allowed to summarize failed/blocked operations as
  completed.

Phase 11 must prove chat projection is a view of operation state, not the source
of truth.

### Rich Operation Cards And Buttons

Use:

- `src/lib/operations/operation-presentation.ts`
- `src/lib/operations/operation-action-view-model.ts`
- `src/lib/operations/operation-action-markdown.ts`
- `src/frameworks/ui/operations/OperationCard.tsx`
- `src/frameworks/ui/operations/OperationActionButton.tsx`
- `src/frameworks/ui/operations/OperationActionConfirmationDialog.tsx`
- `src/frameworks/ui/RichContentRenderer.tsx`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/MessageList.tsx`

The current UI contract is:

- operation cards are first-class rich-content blocks,
- operation actions render as actual buttons,
- destructive/high-risk actions collect confirmation through UI state,
- disabled and stale actions remain visible but non-dispatching,
- operation buttons post to the typed operation action API and never send
  synthetic chat text.

Phase 11 must verify these controls remain visually obvious and behaviorally
authoritative in chat, admin, and operations workspaces.

### Backup And Restore Operation Family

Use:

- `src/core/use-cases/operations/BackupRestoreOperationActions.ts`
- `src/lib/appliance/backup/backup-restore-operation-executor.ts`
- `src/lib/appliance/backup/backup-restore-operation-reconciler.ts`
- `src/lib/appliance/backup/backup-command-service.ts`
- `src/lib/appliance/backup/backup-command-validation.ts`
- `src/lib/appliance/backup/backup-self-service.ts`
- `src/lib/appliance/backup/restore-plan-service.ts`
- `src/lib/appliance/backup/restore-command-service.ts`
- `src/lib/appliance/native/native-command-contract.ts`
- `src/lib/appliance/native/native-result-reconciler.ts`
- `crates/ordo-backup/src/command.rs`
- `crates/ordo-backup/src/native_contract.rs`
- `crates/ordo-backup/src/backup_executor.rs`
- `crates/ordo-backup/src/restore_executor.rs`

Closeout must verify:

- manual backup, restore prepare, pre-restore backup, restore execute, restore
  cancel, and backup validation are operation-backed,
- restore execute remains phrase-gated,
- safety backup is a separate step/action,
- Rust result payloads append `executor_event_received`,
- scheduled backup remains the documented operation-null exception until it is
  explicitly migrated.

### Media Workflow Operation Family

Use:

- `src/core/use-cases/operations/MediaWorkflowOperationActions.ts`
- `src/lib/media/workflows/media-workflow-operation-launcher.ts`
- `src/lib/media/workflows/media-workflow-operation-executor.ts`
- `src/lib/media/workflows/media-workflow-operation-reconciler.ts`
- `src/lib/media/workflows/media-workflow-read-model.ts`
- `src/lib/media/workflows/media-workflow-turn-hook.ts`
- `src/lib/media/workflows/media-workflow-architecture-guardrails.test.ts`
- `src/components/media/MediaOperationsWorkspace.tsx`
- `tests/browser-ui/operations-media.spec.ts`

Closeout must verify:

- prompt-visible media tools create or reference operations through the launcher,
- media worker state projects into operation steps and artifacts,
- retry/cancel actions are typed operation actions,
- old direct media job controls are either pruned or explicitly treated as
  diagnostics/read-only surfaces.

### Factory Work Order Operation Family

Use:

- `src/core/use-cases/operations/FactoryWorkOrderOperationActions.ts`
- `src/lib/factory/factory-work-order-operation-launcher.ts`
- `src/lib/factory/factory-work-order-operation-executor.ts`
- `src/lib/factory/factory-work-order-operation-reconciler.ts`
- `src/lib/factory/factory-work-order-operation-architecture-guardrails.test.ts`
- `src/adapters/FactoryDataMapper.ts`
- `src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts`

Closeout must verify:

- factory work orders link to operation ids,
- staff/admin factory actions route through operation dispatch,
- stage retry/refinement/progress project into operation state,
- direct `produce_product`-style paths are not prompt-visible mutation tools.

### Help, Onboarding, And Role-Gated Corpus

Use:

- `src/core/use-cases/operations/HelpFlowOperationActions.ts`
- `src/core/use-cases/operations/OnboardingFlowOperationActions.ts`
- `src/lib/operations/help-flow-operation.ts`
- `src/lib/operations/onboarding-flow-operation.ts`
- `docs/_corpus/system-docs/book.json`
- `docs/_corpus/system-docs/chapters/00-public-chief-of-staff.md`
- `docs/_corpus/system-docs/chapters/01-proof-story-and-value.md`
- `docs/_corpus/system-docs/chapters/02-member-workspace-basics.md`
- `docs/_corpus/system-docs/chapters/03-apprentice-guided-practice.md`
- `docs/_corpus/system-docs/chapters/04-tooling-and-mcp.md`
- `docs/_corpus/system-docs/chapters/05-staff-operations-workspace.md`
- `docs/_corpus/system-docs/chapters/06-admin-appliance-operations.md`
- `src/lib/corpus-library.ts`
- `src/lib/corpus-access.ts`
- `src/lib/corpus-library.test.ts`

The role documentation shape already exists:

- public visitor: CEO chief-of-staff public face,
- member/authenticated user: workspace basics,
- apprentice: guided practice,
- staff: operations workspace and tooling,
- admin: appliance operations.

Phase 11 must turn these into product-quality system help material and prove
content access controls by role.

### Admin And Conversation Surfaces

Use:

- `src/components/operations/OperationsWorkspace.tsx`
- `src/components/operations/OperationDetailWorkspace.tsx`
- `src/components/admin/system/SystemOperationsManager.tsx`
- `src/app/admin/system/operations/page.tsx`
- `src/app/admin/system/operations/page.test.tsx`
- `src/app/admin/system/backups/BackupSelfServiceManager.tsx`
- `src/app/admin/system/backups/page.tsx`
- `src/lib/operations/operation-workspace-loader.ts`
- `src/lib/operations/operation-read-api.ts`
- `src/lib/operations/operations-access.ts`

Closeout must verify:

- `/operations` is limited to staff/admin,
- `/admin/system/operations` is admin-governed,
- chat cards, operations workspace, admin operations, and backup admin all
  display consistent status/actions for the same operation id,
- role denial is explicit and fails closed.

### Appliance, Docker, Release, And Rust Boundary

Use:

- `Dockerfile`
- `compose.yaml`
- `scripts/start-server.mjs`
- `scripts/dev.mjs`
- `src/lib/appliance/health-facade.ts`
- `src/lib/appliance/probes/backup-restore-probe.ts`
- `src/lib/appliance/probes/resource-pressure-probe.ts`
- `src/lib/appliance/native/native-binary-registry.ts`
- `src/lib/appliance/release/appliance-image-release.ts`
- `src/lib/appliance/verification/lifecycle-smoke.ts`
- `tests/docker-runtime-contract.test.ts`
- `tests/docker-appliance-lifecycle.contract.test.ts`
- `tests/image-runtime-bundle-contract.test.ts`
- `tests/appliance-lifecycle-smoke.test.ts`
- `tests/appliance-image-release-cli.test.ts`

Closeout must verify:

- the app remains a single-image appliance,
- `ordo-backup` is packaged and supervised,
- local development and Docker share the same runtime contract,
- release gates include Rust fmt/test/clippy and image bundle checks,
- missing native binaries or executor failures surface as health/operation state.

### Existing Evidence And Package Docs

Current package evidence:

- `docs/_refactor/agentos-operation-kernel/evidence/initial-code-grounding.md`
- `docs/_refactor/agentos-operation-kernel/evidence/phase-00-baseline.md`

Current package docs to update during closeout:

- `docs/_refactor/agentos-operation-kernel/README.md`
- `docs/_refactor/agentos-operation-kernel/contract-spec.md`
- `docs/_refactor/agentos-operation-kernel/phase-plan.md`
- `docs/_refactor/agentos-operation-kernel/validation-checklist.md`
- `docs/_refactor/agentos-operation-kernel/qa-review.md`
- `docs/_refactor/agentos-operation-kernel/rust-strategy-addendum.md`
- `docs/_refactor/agentos-operation-kernel/systemic-audit.md`

Phase 11 must add:

- `docs/_refactor/agentos-operation-kernel/evidence/phase-11-closeout.md`

Optional if the evidence gets long:

- `docs/_refactor/agentos-operation-kernel/evidence/final-test-matrix.md`
- `docs/_refactor/agentos-operation-kernel/evidence/final-dead-code-pruning.md`
- `docs/_refactor/agentos-operation-kernel/evidence/final-product-review.md`

## Architecture Posture

Use the operation kernel as the product-level Facade for complex work.

Patterns:

- Command: `OperationAction` is the user-visible command object.
- State: `OperationStateMachine` owns status transitions.
- Strategy: operation executors are selected by operation kind/action type.
- Adapter: backup, media, factory, Rust, and corpus surfaces stay behind
  feature-specific adapters.
- Observer/Projection: chat, admin, health, logs, and docs display operation
  state without becoming state owners.
- Anti-Corruption Layer: `native-command-contract` and
  `native-result-reconciler` isolate Rust executor results from product policy.

Clean Architecture rule:

- domain contracts stay in `src/core`,
- infrastructure adapters stay in `src/adapters`, `src/lib`, `src/app`, or
  Rust crates,
- React and markdown rendering stay projections,
- Rust stays deterministic executor/runtime substrate,
- prompts and docs can explain operation truth but cannot create their own truth.

## Implementation Slices

### 1. Build Final Evidence Inventory

Create `evidence/phase-11-closeout.md` with:

- phase-by-phase implemented status,
- exact test commands and outcomes,
- code grounding by subsystem,
- known residual warnings or intentionally deferred work,
- high-risk guardrail search results,
- final product behavior summary.

The evidence must distinguish:

- passed tests,
- skipped tests with reason,
- known lint warnings,
- documented intentional exceptions,
- actual open findings.

### 2. Run Full Operation Kernel Test Matrix

Run the focused suites listed in this phase plus the package-level repository
checks. Record command, result, and any failures in `phase-11-closeout.md`.

If any focused suite fails, fix the issue and rerun the failed suite plus any
adjacent guardrail suite.

### 3. Verify Contract Spec Against Current Code

Update `contract-spec.md` from `Status: Planned` to the correct closeout status.

Check:

- operation kinds match `OperationKindRegistry`,
- status lists match `operation.ts`,
- API contract matches actual routes,
- Rust boundary matches Phase 10 native contract,
- chat projection contract matches operation cards/buttons,
- scheduled backup operation-null exception is explicitly documented.

Do not leave the package docs claiming planned work that is implemented.

### 4. Update Package-Level Docs And Statuses

Update:

- `README.md`
- `phase-plan.md`
- `validation-checklist.md`
- `qa-review.md`
- `rust-strategy-addendum.md`
- `systemic-audit.md`

Expected closeout posture:

- Phases 00 through 10 implemented and QA verified.
- Phase 11 implemented after final evidence is captured.
- Open findings should be downgraded, closed, or moved to a clearly named future
  backlog section with severity and rationale.
- The docs should call the operation kernel the canonical AgentOS layer for
  complex work.

### 5. Harden The System Handbook

Update `docs/_corpus/system-docs` into a usable role-gated help book.

Minimum chapter responsibilities:

- public chief of staff: explain Ordo without private/system authority,
- proof/story/value: public proof and product shape,
- member workspace basics: how a normal user works with operation cards,
- apprentice guided practice: learning path and safe guided execution,
- tooling/MCP: staff-facing tool and capability explanation,
- staff operations workspace: `/operations`, triage, evidence, artifacts,
- admin appliance operations: providers, tools, backups, restore, health,
  release, image/runtime, and risk language.

Each role chapter must include:

- what this role can see,
- what this role can do,
- what this role cannot do,
- when the assistant should expose an operation card,
- when the assistant should ask a clarifying question,
- what evidence the role should inspect before trusting a result.

Add corpus tests if any access rule changes.

### 6. Prove Role-Gated Documentation Access

Use and extend:

- `src/lib/corpus-library.test.ts`
- `src/lib/corpus-access.test.ts`
- `tests/corpus/book-discovery.test.ts`
- `tests/corpus/librarian-tools.test.ts`
- `tests/corpus/librarian-security.test.ts`

Required proof:

- anonymous users can see public `system-docs` help and cannot see member,
  apprentice, staff, or admin `system-docs` sections,
- authenticated users can see member help,
- apprentices can see apprentice material,
- staff can see tooling and operations material,
- admins can see appliance operations material,
- search results and full section reads apply the same access rules,
- help-flow operations use the current role in action payloads.

### 7. Product QA For Help And Onboarding

Verify that help and onboarding flows are real operation flows:

- help requests create or project `help_flow` operations,
- onboarding requests create or project `onboarding_flow` operations,
- buttons are operation actions,
- completing help/onboarding appends `executor_event_received` and
  `operation_completed` evidence,
- role-specific help never exposes admin-only controls to lower roles,
- anonymous/public behavior presents the CEO chief-of-staff public face rather
  than a sales-personality flow.

### 8. Cross-Surface Product QA

For at least one operation from each implemented family, verify:

- chat card status,
- `/operations` row/card status,
- operation detail view,
- `/admin/system/operations` view where role allows it,
- admin feature page where applicable,
- operation events,
- operation artifacts,
- available/disabled actions.

Families:

- `backup_create`
- `restore_execute`
- `media_workflow`
- `factory_work_order`
- `help_flow`
- `onboarding_flow`

If `system_diagnostic`, `tool_task`, or `content_publish` are not fully migrated,
document them as future operation kinds with current behavior and risk.

### 9. Dead-Code And Legacy Path Pruning

Search for replaced behavior and prune it when safe.

Targets:

- synthetic chat text action execution for dangerous operations,
- direct restore/backup mutation routes that bypass operation dispatch,
- prompt-visible factory/media mutation tools that bypass operation launchers,
- duplicate operation card serialization paths,
- obsolete command names rejected by Rust,
- unused compatibility adapters from pre-operation backup/restore cards,
- stale docs that instruct users to say phrases instead of clicking operation
  buttons.

Do not remove:

- read-only diagnostics,
- admin pages that now dispatch operation actions,
- scheduler paths intentionally documented as operation-null,
- tests that prove old command names are rejected,
- migration scaffolding still required for greenfield schema setup.

### 10. Final Product Review

Do a human-level review of the product shape:

- Does a new user understand what Ordo is allowed to do?
- Do operation cards look like real controls?
- Can a staff/admin user find failed work without reading logs?
- Can an admin understand backup/restore risk before clicking?
- Can the assistant answer "what happened?" from operation evidence?
- Does the app behave like a trustworthy appliance rather than a chat wrapper?

Record findings in `phase-11-closeout.md`; fix any high-severity product issue
before marking the phase implemented.

## Positive Use Cases

- User asks for a backup; Ordo creates or projects a `backup_create` operation
  with a visible action button and later shows Rust executor evidence.
- Admin prepares a restore; Ordo exposes plan, safety backup, execute, cancel,
  and status actions from operation state.
- User asks for media; Ordo creates a media workflow operation and projects job
  progress, retry, cancel, and artifacts.
- Staff starts a factory work order; operation state shows stages, progress,
  retry/refinement actions, and outputs.
- Public visitor asks what Ordo is; the assistant uses public chief-of-staff
  help content without exposing private controls.
- Staff asks how to monitor work; help flow searches staff-visible system docs
  and exposes `/operations` guidance.
- Admin asks how to restore safely; help flow can retrieve admin-only appliance
  docs while lower roles cannot.

## Negative Use Cases

- Button click with stale `operationRevision` fails safely.
- Disabled operation action is visible but cannot dispatch.
- Restore execute without phrase confirmation fails.
- Non-admin user cannot execute backup/restore appliance actions.
- Chat text such as `fire it` cannot bypass operation action dispatch.
- Model cannot claim backup/restore/media/factory success when operation status
  is failed or blocked.
- Rust cannot write operation ledger tables directly.
- Missing `ordo-backup` binary is health/operation state, not hidden chat prose.
- Anonymous corpus search cannot reveal staff/admin system docs.
- Prompt-visible tool lists do not expose direct factory/media mutation paths
  that bypass operation launchers.

## Edge Cases

- Two browser tabs click the same action.
- Two browser tabs click the same action id with different idempotency keys.
- Operation completes while an old card is still visible.
- Operation is cancelled while a Rust command is running.
- Reconciler runs twice for the same command or workflow event.
- Tool evidence exists without an operation id.
- Operation prompt grounding read fails.
- Role changes between card render and action click.
- Corpus search returns mixed public/admin material.
- Docker image has app code but missing or non-executable native binary.
- Release evidence is generated with redaction and no local secret/path leakage.
- Existing scheduled backup command has no operation metadata.

## Tests Required

### Core Operation Matrix

```bash
npx vitest run \
  src/core/entities/operation.test.ts \
  src/core/use-cases/operations/OperationStateMachine.test.ts \
  src/core/use-cases/operations/OperationKindRegistry.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationActionDispatch.test.ts \
  src/core/use-cases/operations/OperationIntentPolicy.test.ts \
  src/core/use-cases/operations/OperationIntentRouter.test.ts \
  src/core/use-cases/operations/OperationDraftFactory.test.ts \
  src/core/use-cases/operations/OperationPromptGrounding.test.ts \
  src/core/use-cases/operations/OperationStatusMapping.test.ts \
  src/adapters/OperationDataMapper.test.ts
```

### Operation API, Chat, And UI Matrix

```bash
npx vitest run \
  src/app/api/operations/route.test.ts \
  src/app/api/operations/[operationId]/route.test.ts \
  src/app/api/operations/[operationId]/actions/[actionId]/route.test.ts \
  src/app/api/operations/[operationId]/events/route.test.ts \
  src/app/api/operations/[operationId]/artifacts/route.test.ts \
  src/lib/operations/operation-action-api.test.ts \
  src/lib/operations/operation-action-dispatch-root.test.ts \
  src/lib/operations/operation-action-view-model.test.ts \
  src/lib/operations/operation-action-markdown.test.ts \
  src/lib/operations/operation-intent-ingress.test.ts \
  src/lib/operations/operation-intent-projection.test.ts \
  src/lib/operations/operation-prompt-grounding.test.ts \
  src/lib/operations/operation-tool-evidence.test.ts \
  src/lib/operations/operation-presentation.test.ts \
  src/frameworks/ui/RichContentRenderer.test.tsx \
  src/frameworks/ui/useChatSurfaceState.test.tsx \
  src/frameworks/ui/MessageList.test.tsx \
  src/frameworks/ui/chat/bubbles/AssistantBubble.test.tsx \
  src/frameworks/ui/operations/OperationCard.test.tsx \
  src/frameworks/ui/operations/OperationActionButton.test.tsx
```

### Feature Operation Matrix

```bash
npx vitest run \
  src/lib/appliance/backup/backup-command-service.test.ts \
  src/lib/appliance/backup/backup-command-validation.test.ts \
  src/lib/appliance/backup/backup-restore-operation-executor.test.ts \
  src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts \
  src/lib/appliance/backup/backup-self-service.test.ts \
  src/lib/appliance/backup/restore-safety-pipeline.test.ts \
  src/lib/appliance/native/native-command-contract.test.ts \
  src/lib/appliance/native/native-result-reconciler.test.ts \
  src/lib/appliance/native/native-binary-registry.test.ts \
  src/lib/media/workflows/media-workflow-operation-executor.test.ts \
  src/lib/media/workflows/media-workflow-operation-reconciler.test.ts \
  src/lib/media/workflows/media-workflow-architecture-guardrails.test.ts \
  src/lib/media/workflows/media-workflow-turn-hook.test.ts \
  src/lib/factory/factory-work-order-operation-executor.test.ts \
  src/lib/factory/factory-work-order-operation-reconciler.test.ts \
  src/lib/factory/factory-work-order-operation-launcher.test.ts \
  src/lib/factory/factory-work-order-operation-architecture-guardrails.test.ts \
  src/lib/operations/help-flow-operation.test.ts \
  src/lib/operations/onboarding-flow-operation.test.ts
```

### Admin, Corpus, Appliance, And Release Matrix

```bash
npx vitest run \
  src/app/operations/page.test.tsx \
  src/app/operations/[operationId]/page.test.tsx \
  src/app/operations/media/page.test.tsx \
  src/app/admin/system/operations/page.test.tsx \
  src/app/admin/system/backups/page.test.tsx \
  src/lib/operations/operations-access.test.ts \
  src/components/media/MediaOperationsWorkspace.test.tsx \
  src/lib/media/media-operations.test.ts \
  src/lib/corpus-library.test.ts \
  src/lib/corpus-access.test.ts \
  tests/corpus/book-discovery.test.ts \
  tests/corpus/librarian-tools.test.ts \
  tests/corpus/librarian-security.test.ts \
  src/lib/appliance/health-facade.test.ts \
  src/lib/appliance/probes/backup-restore-probe.test.ts \
  src/lib/appliance/probes/resource-pressure-probe.test.ts \
  tests/docker-runtime-contract.test.ts \
  tests/docker-appliance-lifecycle.contract.test.ts \
  tests/image-runtime-bundle-contract.test.ts \
  tests/appliance-lifecycle-smoke.test.ts \
  tests/appliance-image-release-cli.test.ts
```

### Browser Smoke Where Available

```bash
npx playwright test tests/browser-ui/operations-media.spec.ts
```

Run additional browser tests only if the local environment has the required
server and browser dependencies already healthy.

### Rust Checks

```bash
cargo fmt --check
cargo test -p ordo-backup
cargo clippy -p ordo-backup -- -D warnings
```

### Repository Checks

```bash
npm run typecheck -- --pretty false
npm run lint
git diff --check
```

## Guardrail Searches

Record results in `evidence/phase-11-closeout.md`.

```bash
rg -n "operation_events|operation_steps|operations" crates/ordo-backup
rg -n "fire it|say \\\"fire|Create safety backup|Execute restore" src docs --glob '!docs/_refactor/**'
rg -n "actionType: \\\"message\\\"|sendMessage\\(|append\\(.*operation" src/frameworks src/lib src/components
rg -n "produce_product|compose_media|restore.request|backup.create" src/core/use-cases/tools src/lib/chat tests/mcp
rg -n "operation-card|data-operation-action|OperationActionButton" src/frameworks src/components
rg -n "system-docs|audience: admin|audience: staff|rolePersona" docs/_corpus src/lib/corpus* tests/corpus
rg -n "ORDO_BACKUP_EXECUTOR_PATH|bin/ordo-backup|ordo-runtime" Dockerfile scripts src/lib tests
```

Expected outcomes:

- Rust crates do not write operation ledger tables directly.
- Dangerous instructions do not tell users to execute by chat phrase when a
  button/action exists.
- Operation actions are rendered through operation button/card paths.
- Prompt-visible mutation tools route to operation launchers or are removed.
- Role-gated corpus docs are discoverable only through the right access level.
- Native binary references are centralized except intentional Docker,
  supervisor, release, and test contract references.

## Final QA Cases

- A complex request cannot complete without operation evidence.
- A button cannot execute a dangerous action through chat text.
- The model cannot claim completion when operation state is failed or blocked.
- Admin, operations workspace, and conversation cards agree on state.
- Role-gated help returns the right documentation for the current role.
- Anonymous/public behavior uses the CEO chief-of-staff public face.
- Docker image runs the operation-backed appliance.
- Rust executor failures are visible and recoverable.
- Final package docs describe implemented code rather than planned architecture.

## Exit Criteria

- `evidence/phase-11-closeout.md` exists and includes final command evidence.
- Package QA review has no open high-severity findings.
- `contract-spec.md`, `phase-plan.md`, `validation-checklist.md`, `qa-review.md`,
  `README.md`, and `rust-strategy-addendum.md` match the implemented system.
- Role-gated `system-docs` material is product-quality and tested.
- Operation-backed help/onboarding, backup/restore, media, and factory flows have
  passing positive, negative, and edge tests.
- Dead-code searches either produce no unsafe hits or each hit is documented as
  intentional.
- Lint, typecheck, Rust checks, focused Vitest suites, and Docker/release
  contract tests pass.
- Docs and code reference the operation kernel as the canonical AgentOS layer
  for complex work.
