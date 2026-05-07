# Initial Code Grounding

Status: Captured during package creation

This is not the full Phase 00 evidence set. It records the concrete source facts
that justify creating the AgentOS operation kernel package.

## Verified Source Anchors

The package references were verified to exist:

- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- `src/core/platform/facade/AgentPlatformFacade.ts`
- `src/core/platform/execution/ExecutionTimeline.ts`
- `src/lib/tools/tool-availability-service.ts`
- `src/lib/chat/stream-execution.ts`
- `src/hooks/chat/chatSendPolicy.ts`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx`
- `src/frameworks/ui/chat/plugins/custom/ApplianceBackupCard.tsx`
- `src/lib/appliance/backup/backup-self-service.ts`
- `src/lib/appliance/health-facade.ts`
- `src/lib/media/workflows/types.ts`
- `src/lib/media/workflows/orchestrator.ts`
- `src/lib/factory/production-orchestrator.ts`
- `src/lib/appliance/install/install-state.ts`
- `src/core/entities/user.ts`
- `src/lib/access/content-access.ts`
- `Dockerfile`
- `scripts/start-server.mjs`
- `crates/ordo-backup/src/command.rs`

## Chat Evidence Gap

`src/lib/chat/stream-execution.ts` persists tool evidence into assistant message
parts:

- line 481 pushes `tool_call`
- line 494 pushes `tool_result`

`src/hooks/chat/chatSendPolicy.ts` then drops those same part types from backend
history:

- line 56 handles `tool_call`
- line 57 handles `tool_result`

This is a core reason Phase 05 exists. The fix should not be another prompt
instruction. The fix should be operation-grounded current-thread truth.

## Action Dispatch Gap

`src/frameworks/ui/useChatSurfaceState.tsx` has a structured job action path,
but also sends some action text back through chat:

- line 32 defines `postJobAction`
- line 73 defines `ACTION_HANDLERS`
- line 95 calls `deps.sendMessage(text)`
- line 120 posts job action payloads
- line 211 calls `sendMessage(txt)`

This is a core reason Phase 03 exists. Dangerous or multi-step actions need
typed operation action APIs rather than natural-language re-entry.

## Existing Durable Ledgers

The current system already has several subsystem ledgers that should be unified
or projected through operations:

- `src/adapters/JobQueueDataMapper.ts` uses `job_requests` and `job_events`.
- `src/lib/media/workflows/sqlite-media-workflow-repository.ts` uses
  `media_workflows` and `media_workflow_steps`.
- `src/adapters/FactoryDataMapper.ts` uses `factory_work_orders` and
  `factory_stage_runs`.
- `src/lib/db/tables.ts` defines job tables around lines 544-602, factory tables
  around lines 634-706, backup/restore tables around lines 799-919.

This is why Phase 02 defines operation storage and read models before migrating
backup, media, and factory flows.

## Backup And Rust Baseline

The backup/restore work already has strong raw ingredients:

- `src/lib/appliance/backup/types.ts` defines command names
  `backup.create` and `restore.request`.
- `src/lib/appliance/backup/backup-command-validation.ts` validates command
  payloads.
- `src/lib/appliance/backup/backup-self-service.ts` exposes conversational
  backup/restore behavior.
- `crates/ordo-backup/src/command.rs` parses `backup.create` and
  `restore.request`.
- `crates/ordo-backup/src/command_store.rs` works against `system_commands`,
  `backup_snapshots`, and `restore_plans`.

The missing piece is not another backup-specific state machine. The missing
piece is operation-aware execution where Rust receives `operationId` and
`stepId`, and TypeScript projects the result into one operation ledger.

## Greenfield Conclusion

Because the product has no production users to preserve, the operation kernel
should replace weak flows cleanly:

- no long-lived compatibility layer for text-only dangerous actions,
- no duplicate backup command names,
- no separate confirmation contract per subsystem,
- no model-only memory of active work,
- no subsystem-specific UI cards that cannot be derived from operation state.

