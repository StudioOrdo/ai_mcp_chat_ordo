# Phase 00 Baseline Evidence

Status: Complete
Captured: 2026-05-03
Package: `docs/_refactor/agentos-operation-kernel`

## QA Of Phase 00 Spec

Phase 00 is accurate and implementable as an evidence phase. It requires no
product code change. The phase exit criteria are:

- create this baseline evidence file,
- cite concrete source paths,
- record current risks and greenfield pruning candidates,
- leave later phases with enough grounding to avoid rediscovery.

This file satisfies those criteria.

## Commands Run

Capability inventory:

```bash
npx tsx -e "import { CAPABILITY_CATALOG } from './src/core/capability-catalog/catalog'; ..."
npx tsx -e "import { projectAllCapabilityRuntimes } from './src/core/platform/capability-runtime/CapabilityRuntime'; ..."
```

Database inventory:

```bash
sqlite3 .data/local.db "SELECT name FROM sqlite_master WHERE type='table' AND name IN (...);"
sqlite3 .data/local.db "SELECT 'backup_snapshots', COUNT(*) FROM backup_snapshots UNION ALL ..."
sqlite3 .data/local.db "SELECT target, command, status, COUNT(*) FROM system_commands GROUP BY target, command, status;"
sqlite3 .data/local.db "SELECT COUNT(*) FROM messages WHERE parts LIKE '%tool_call%' OR parts LIKE '%tool_result%';"
sqlite3 .data/local.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'operation%';"
```

Source inventory:

```bash
rg "tool_call|tool_result" src/lib src/hooks src/frameworks
rg "ActionLinkType|onAction|sendMessage" src/frameworks src/types src/core
rg "backup_snapshots|restore_plans|system_commands" src crates
rg "media_workflows|factory_work_orders|job_events" src
rg "ANONYMOUS|AUTHENTICATED|APPRENTICE|STAFF|ADMIN" src
rg "ordo-backup|backup.create|restore.request" crates src scripts Dockerfile
```

## Capability Runtime Inventory

Current source:

- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- `src/core/capability-catalog/catalog.ts`
- `src/core/capability-catalog/execution-planning-policy.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`

Findings:

- `CapabilityRuntime.ts:22-26` derives runtime names from
  `CAPABILITY_CATALOG`.
- `CapabilityRuntime.ts:98-113` projects descriptor, schema, presentation, job,
  browser, MCP export, binding, local execution targets, and prompt exposure.
- `CapabilityRuntime.ts:116-127` adds execution planning and explanation.
- `AgentPlatformFacade.ts:125-143` discovers role-filtered capabilities.
- `AgentPlatformFacade.ts:152-174` executes a named capability through the tool
  execution surface.

Current catalog counts:

```text
capabilities: 69
category:
  content: 31
  system: 31
  math: 1
  ui: 6
presentation execution mode:
  inline: 54
  deferred: 12
  browser: 2
  hybrid: 1
primary targets:
  host_ts: 50
  deferred_job: 12
  browser_wasm: 2
  mcp_stdio: 5
candidate targets:
  host_ts: 67
  deferred_job: 13
  mcp_stdio: 6
  browser_wasm: 3
  native_process: 1
  mcp_container: 1
localExecutionTargets facet:
  mcpStdio: 7
  nativeProcess: 1
  mcpContainer: 1
```

Conclusion:

The capability system is already a strong registry and planning layer. It should
feed the operation kernel. It should not itself become the operation source of
truth.

## Existing Execution Timeline

Current source:

- `src/core/platform/execution/ExecutionTimeline.ts`
- `src/core/platform/facade/AgentPlatformFacade.ts`

Findings:

- `ExecutionTimeline.ts:4` supports `job`, `work_order`, `tool`, `chat_turn`,
  and `observability`.
- `ExecutionTimeline.ts:8-16` defines lifecycle states from `planned` through
  `unknown`.
- `ExecutionTimeline.ts:18` defines next action kinds as `job`, `route`, `send`,
  `factory`, and `unsupported`.
- `ExecutionTimeline.ts:73-91` already has execution id, kind, state, events,
  artifacts, checkpoints, and next actions.
- `AgentPlatformFacade.ts:176-182` reads timelines and performs revision actions.

Conclusion:

This is the closest existing shape to the target operation model, but it is not
yet universal. It lacks first-class operation actions, operation events,
operation artifacts, backup/restore kinds, media workflow projection, and
canonical state transitions.

## Database And Durable Ledger Inventory

Current source:

- `src/lib/db/tables.ts`
- `src/adapters/JobQueueDataMapper.ts`
- `src/lib/media/workflows/sqlite-media-workflow-repository.ts`
- `src/adapters/FactoryDataMapper.ts`
- backup mappers under `src/adapters`

Relevant schema anchors:

- `tables.ts:40-63` defines `conversations` and `messages`, with message
  `parts` JSON at line 57.
- `tables.ts:90-116` defines `prompt_bindings`.
- `tables.ts:120-142` defines `relationship_memory_records`.
- `tables.ts:320-341` defines `embeddings`.
- `tables.ts:544-602` defines `job_requests` and `job_events`.
- `tables.ts:634-778` defines factory work orders, stages, outputs,
  checkpoints, and events.
- `tables.ts:799-919` defines `system_commands`, `backup_snapshots`,
  `backup_policy`, `backup_restore_audit_events`, and `restore_plans`.

Current local `.data/local.db` counts:

```text
backup_snapshots: 5
conversations: 6
embeddings: 275
factory_stage_runs: 0
factory_work_orders: 0
job_events: 60
job_requests: 11
media_workflow_steps: 3
media_workflows: 1
messages: 100
prompt_bindings: 127
relationship_memory_records: 14
restore_plans: 2
system_commands: 10
```

Operation tables:

```text
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'operation%';
-- no rows
```

Current `system_commands` distribution in the local dev database:

```text
rust_daemon | backup          | complete  | 3
rust_daemon | backup          | running   | 1
rust_daemon | backup.create   | succeeded | 5
rust_daemon | restore.request | succeeded | 1
```

Current `backup_snapshots` distribution:

```text
manual      | succeeded | 3
pre_restore | succeeded | 2
```

Current `restore_plans` distribution:

```text
confirmed | 1
succeeded | 1
```

Conclusion:

The system already has durable ledgers, but they are separate. Phase 02 should
create canonical operation tables and then migrate or project jobs, media,
factory, and backup/restore into those read models. Because this is greenfield,
the legacy dev rows using `backup` should be pruned or ignored once tests prove
the new command names are canonical.

## Chat Tool Evidence

Current source:

- `src/lib/chat/stream-execution.ts`
- `src/hooks/chat/chatSendPolicy.ts`

Findings:

- `stream-execution.ts:480-484` pushes and streams `tool_call` parts.
- `stream-execution.ts:493-497` pushes and streams `tool_result` parts.
- `stream-execution.ts:499-504` emits deferred job stream events when a tool
  result is a deferred job payload.
- `chatSendPolicy.ts:27-61` summarizes message parts for backend history.
- `chatSendPolicy.ts:56-58` returns `null` for `tool_call` and `tool_result`.
- Local `.data/local.db` has 37 messages whose `parts` include `tool_call` or
  `tool_result`.

Conclusion:

The system persists tool evidence, but the backend prompt path drops raw tool
call/result evidence. Phase 05 must replace this with an operation-grounded
current-thread truth block. Prompt instructions alone will not fix this class of
failure.

## Chat Button And Action Dispatch

Current source:

- `src/core/entities/rich-content.ts`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx`
- `src/frameworks/ui/chat/plugins/custom/ApplianceBackupCard.tsx`
- `src/core/use-cases/tools/appliance-backup.tool.ts`

Findings:

- `rich-content.ts:9-11` supports action types:
  `conversation`, `route`, `send`, `tool`, `corpus`, `external`, `job`.
- There is no `operation` action type.
- `useChatSurfaceState.tsx:32-49` has a structured job action API path.
- `useChatSurfaceState.tsx:73-123` centralizes action handlers.
- `useChatSurfaceState.tsx:89-99` handles `tool` actions by calling
  `sendMessage(text)` when available.
- `useChatSurfaceState.tsx:206-212` sends suggestions directly as chat text.
- `CapabilityActionRail.tsx:47-59` renders action links as buttons.
- `ApplianceBackupCard.tsx:74-83` extracts action links from backup records.
- `ApplianceBackupCard.tsx:125`, `148`, and `157` render backup/restore
  actions through `CapabilityActionRail`.
- `appliance-backup.tool.ts:74-84` creates appliance actions with
  `actionType: "tool"` and natural-language `value` text.
- `appliance-backup.tool.ts:87-153` creates backup, restore, command status, and
  list actions as text-producing tool actions.

Conclusion:

The UI can render custom messages and buttons, but important appliance actions
still route through chat text. Phase 03 must add typed operation action dispatch
and reserve natural-language `tool` actions for low-risk suggestions only.

## Backup And Restore Flow

Current source:

- `src/lib/appliance/backup/backup-self-service.ts`
- `src/lib/appliance/backup/backup-command-service.ts`
- `src/lib/appliance/backup/restore-plan-service.ts`
- `src/lib/appliance/backup/restore-command-service.ts`
- `src/lib/appliance/backup/restore-confirmation-service.ts`
- `src/lib/appliance/backup/types.ts`
- `src/lib/appliance/backup/backup-command-validation.ts`
- `src/core/use-cases/tools/appliance-backup.tool.ts`
- `src/app/api/admin/system/backups/route.ts`
- `src/app/api/admin/system/backups/[snapshotId]/restore-plans/route.ts`
- `src/app/api/admin/system/restore-plans/[planId]/confirm/route.ts`
- `src/app/api/admin/system/restore-plans/[planId]/pre-restore-backup/route.ts`
- `src/app/api/admin/system/restore-plans/[planId]/execute/route.ts`

Findings:

- `backup-self-service.ts:140-160` creates a manual backup by checking executor
  availability, checking resources, creating a `backup.create` command, and
  returning queued state.
- `backup-self-service.ts:198-210` creates a restore plan and returns
  `confirmation_required`.
- `backup-self-service.ts:212-233` queues a pre-restore safety backup.
- `backup-self-service.ts:235-250` confirms a restore plan.
- `backup-self-service.ts:253-278` executes a confirmed restore by authorizing a
  `restore.request` command.
- `backup-self-service.ts:390-393` enforces admin-only self-service.
- `backup-command-service.ts:21-40` creates a pending manual backup snapshot and
  enqueues `target: "rust_daemon"`, `command: "backup.create"`.
- `restore-plan-service.ts:43-123` validates archive integrity, creates a plan,
  marks it confirmation-required, and records audit events.
- `restore-plan-service.ts:125-170` creates the pre-restore backup command.
- `restore-command-service.ts:25-72` authorizes restore execution and enqueues
  `restore.request`.
- `restore-command-service.ts:74-96` blocks restore execution until the
  pre-restore backup command and linked pre-restore backup snapshot have
  succeeded.
- Admin APIs already expose structured backup/restore endpoints:
  - backup create: `backups/route.ts:36-45`
  - restore plan create: `backups/[snapshotId]/restore-plans/route.ts:11-29`
  - restore confirm: `restore-plans/[planId]/confirm/route.ts:15-37`
  - safety backup: `restore-plans/[planId]/pre-restore-backup/route.ts:21-39`
  - execute restore: `restore-plans/[planId]/execute/route.ts:21-39`
- Conversation backup actions still enter through `actionType: "tool"` text in
  `appliance-backup.tool.ts:74-153`.

Conclusion:

Backup/restore already has the right safety pipeline, but it is not a canonical
operation. Phase 06 should migrate this first because it is the clearest proof
case: dangerous, multi-step, admin-only, asynchronous, Rust-backed, and
artifact-producing.

## Rust Backup Executor

Current source:

- `crates/ordo-backup/src/command.rs`
- `crates/ordo-backup/src/command_store.rs`
- `crates/ordo-backup/src/backup_executor.rs`
- `crates/ordo-backup/src/restore_executor.rs`
- `crates/ordo-backup/tests/governed_executor.rs`
- `Dockerfile`
- `scripts/start-server.mjs`

Findings:

- `command.rs:11-24` supports only `backup.create` and `restore.request`.
- `command.rs:27-61` defines typed backup/restore payloads.
- `command.rs:63-87` validates backup payloads.
- `command.rs:89-108` validates restore payloads.
- `command.rs:162-166` explicitly rejects old command names `backup` and
  `restore`.
- `command_store.rs:43-56` recovers expired running commands.
- `command_store.rs:58-104` claims the next pending `rust_daemon` command and
  marks unsupported commands failed.
- `command_store.rs:150-170` verifies required Node-owned tables:
  `system_commands`, `backup_snapshots`, `restore_plans`,
  `backup_restore_audit_events`.

Conclusion:

Rust is already the right direction for deterministic local I/O. It is not yet
operation-aware: command payloads include snapshot/plan IDs but not canonical
`operationId`, `stepId`, or `actionId`. Phase 10 should extend the Rust boundary
through operation IDs rather than adding more ad hoc command tables.

## Health And Runtime Process Model

Current source:

- `src/lib/appliance/health-facade.ts`
- `src/lib/appliance/probes/*`
- `src/lib/appliance/probes/backup-restore-probe.ts`
- `scripts/start-server.mjs`

Findings:

- `health-facade.ts:39-54` runs default probes for runtime profile, data
  boundary, SQLite, provider, network, security, resources, tool availability,
  media worker, deferred worker, search index, and backup/restore.
- `health-facade.ts:66-84` marks runtime/data/sqlite/provider/network/security
  and resources as required, backup/restore as informational, and others as
  optional.
- `health-facade.ts:164-191` aggregates probe results into an appliance health
  report.
- `backup-restore-probe.ts:23-59` reports disabled or missing backup executor
  state.
- `backup-restore-probe.ts:61-123` counts pending/running/failed backup/restore
  commands and projects backup policy health.
- `scripts/start-server.mjs:32-85` creates a single-instance `.server.lock` and
  validates writable `DATA_DIR`.
- `scripts/start-server.mjs:87-100` configures main port, workers, backup
  executor/scheduler, and SQLite path.
- `scripts/start-server.mjs:136-179` supervises the deferred job worker.
- `scripts/start-server.mjs:181-224` supervises the media worker.
- `scripts/start-server.mjs:226-285` supervises the Rust backup executor.
- `scripts/start-server.mjs:287-330` supervises the backup scheduler.
- `scripts/start-server.mjs:374-414` drains children on shutdown.

Conclusion:

The appliance process model is strong enough to support operation-backed work.
The next missing piece is to report operation queue/executor state as first-class
health, not only per-subsystem worker status.

## Docker Appliance Shape

Current source:

- `Dockerfile`
- `package.json`

Findings:

- `Dockerfile:1-8` uses Node 22.22.2 Alpine and installs dependencies with
  `npm ci`.
- `Dockerfile:10-16` builds the Rust `ordo-backup` binary.
- `Dockerfile:18-23` builds Next.js.
- `Dockerfile:26-37` creates the production runner with `DATA_DIR`,
  `STUDIO_ORDO_DB_PATH`, blog asset root, and media worker port.
- `Dockerfile:39-40` creates a non-root `nextjs` user.
- `Dockerfile:42-55` copies the Next build, docs corpus, config, scripts, MCP,
  source, and Rust binary into one image.
- `Dockerfile:57-60` creates `/app/.data`, runtime logs, image cache, and
  declares `/app/.data` as the volume.
- `Dockerfile:62-65` runs as `nextjs` and starts `scripts/start-server.mjs`.
- `package.json` has runtime checks and appliance scripts:
  `native:check`, `appliance:smoke`, `appliance:release`, `backup:executor`,
  `backup:scheduler`, `rust:test`, `rust:clippy`, and release manifest scripts.

Conclusion:

The image is already shaped like a one-container appliance. Operation-kernel
work should preserve this boundary and should not introduce external database,
queue, search, or worker services.

## Tool Availability And Provider Gates

Current source:

- `src/lib/tools/tool-availability-service.ts`

Findings:

- `tool-availability-service.ts:80-173` computes effective availability from
  the catalog, default install profile, static config, admin overrides, protected
  tools, and provider capability gates.
- `tool-availability-service.ts:193-197` lists enabled tool names.
- `tool-availability-service.ts:199-238` applies role filtering.
- `tool-availability-service.ts:271-278` unregisters disabled tools from the
  registry.

Conclusion:

Operation creation and action exposure must consume this service. A disabled
tool or missing provider should produce blocked operation state, not a failed
model guess or hidden missing button.

## Role, Content Access, And Install State

Current source:

- `src/core/entities/user.ts`
- `src/lib/access/content-access.ts`
- `src/lib/appliance/install/install-state.ts`

Findings:

- `user.ts:1` defines roles:
  `ANONYMOUS`, `AUTHENTICATED`, `APPRENTICE`, `STAFF`, `ADMIN`.
- `content-access.ts:5-12` defines audiences:
  `public`, `member`, `account`, `premium`, `apprentice`, `staff`, `admin`.
- `content-access.ts:16-24` maps audiences to roles.
- `content-access.ts:80-117` computes user audience access.
- `install-state.ts:18-56` resolves first-boot/install state using DB schema,
  owner configuration, network mode, and install token requirement.

Conclusion:

The role and content access primitives are sufficient for role-gated operations,
role-gated system documentation, and first-user onboarding operations.

## Media Workflow Inventory

Current source:

- `src/lib/media/workflows/types.ts`
- `src/lib/media/workflows/orchestrator.ts`
- `src/lib/media/workflows/sqlite-media-workflow-repository.ts`

Findings:

- `types.ts:1-7` defines workflow statuses.
- `types.ts:9-16` defines step statuses.
- `types.ts:18-23` defines step kinds for chart, audio, image, compose, and
  reused assets.
- `types.ts:27-43` defines `MediaWorkflow`.
- `types.ts:45-60` defines `MediaWorkflowStep`.
- `types.ts:62-69` defines `MediaWorkflowEvent`.
- `orchestrator.ts:124-139` resolves step dependencies.
- `orchestrator.ts:141-169` binds deferred jobs to workflow steps.
- `orchestrator.ts:222-231` wires repository, job queue, and materialization
  repository dependencies.
- `orchestrator.ts:260-395` advances workflows, maps job success/failure into
  workflow state, and enqueues compose jobs.
- `sqlite-media-workflow-repository.ts:171-225` persists workflows and steps.

Conclusion:

Media already has a workflow/state model. Phase 07 should project this through
canonical operations rather than invent a second media-specific UX contract.

## Factory Workflow Inventory

Current source:

- `src/lib/factory/production-orchestrator.ts`
- `src/adapters/FactoryDataMapper.ts`
- `docs/_business/ordo_process.md`

Findings:

- `production-orchestrator.ts:43-46` defines a production orchestrator around a
  repository and stage executor registry.
- `production-orchestrator.ts:75-245` runs stages, handles pause requests,
  retries, failures, checkpoints, progress, and completion.
- `production-orchestrator.ts:247-330` executes a stage and records outputs and
  events.
- `FactoryDataMapper.ts:199-227` creates durable work orders.
- `FactoryDataMapper.ts:371-440` upserts durable stage runs.
- `tables.ts:634-778` defines durable factory work-order tables.

Conclusion:

Factory orchestration is already operation-like. Phase 08 should map work
orders, stages, checkpoints, events, and outputs into the operation kernel.

## Architectural Gaps For Later Phases

1. There is no canonical operation schema or repository.
2. Existing `ExecutionTimeline` is close but not universal and does not own
   state transitions.
3. Backend chat history currently drops raw `tool_call` and `tool_result`
   evidence.
4. Rich buttons exist, but dangerous appliance actions still use text-based
   `tool` actions.
5. Backup/restore has a solid safety pipeline but remains its own state machine.
6. Rust backup execution is governed but not operation-aware.
7. Jobs, media, factory, backup, restore, prompt, and message evidence live in
   separate ledgers.
8. Health has strong probes but no canonical operation queue/executor health.
9. Operation action authorization and stale-button handling do not exist as a
   shared contract.
10. The intent compiler/router does not exist as a validated layer; tool
    invocation can still depend on model interpretation of text.

## Greenfield Pruning Candidates

These should be removed or collapsed after operation-backed replacements pass
tests:

- `actionType: "tool"` for backup, restore, publish, configuration, and other
  dangerous or multi-step actions.
- Natural-language action strings such as `Execute appliance restore ...` as
  command dispatch.
- Backup-specific action eligibility embedded in `appliance-backup.tool.ts`.
- Any compatibility with old `system_commands.command` values `backup` and
  `restore`.
- Duplicate confirmation semantics outside operation actions.
- Prompt replay paths that silently drop operation-relevant tool evidence.
- Subsystem-specific cards that cannot be rendered from operation read models.

## Positive Use Cases Covered

- Capability runtime inventory identifies 69 capabilities and all execution
  target families.
- DB inventory identifies the existing durable ledgers that can seed operation
  read models.
- Chat inventory identifies exactly where tool evidence is persisted and where
  it is dropped from replay.
- UI inventory identifies the exact action dispatch gap.
- Backup/Rust inventory confirms the current safety pipeline and native
  executor contract.
- Docker/runtime inventory confirms one-image appliance constraints.

## Negative Use Cases Covered

- Evidence does not rely on conversation claims.
- Evidence distinguishes current code from local dev database legacy rows.
- Evidence does not assume obsolete Rust command names are valid.
- Evidence does not skip UI action paths.
- Evidence records structured admin APIs separately from chat text actions.

## Edge Cases Captured For Later Phases

- Empty greenfield database has no operation tables yet.
- Local dev database contains legacy `backup` command rows even though current
  code rejects old command names.
- Missing Rust binary is already detected by the backup/restore probe and
  startup supervisor.
- Disabled providers/tools are represented in tool availability and must block
  operation action exposure.
- Conversation refresh can lose exact tool evidence unless operation grounding
  replaces backend history filtering.

## Phase 00 Conclusion

Phase 00 is complete. The next correct phase is Phase 01:
`phases/01-operation-kernel-contract.md`.

The most important implementation decision for Phase 01 is to treat the
operation kernel as a new canonical domain, not as another projection bolted onto
backup, jobs, media, or factory. Those systems already contain useful evidence,
but they should become operation-backed adapters or read-model projections.

