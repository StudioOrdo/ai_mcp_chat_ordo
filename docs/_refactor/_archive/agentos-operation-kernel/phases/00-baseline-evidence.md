# Phase 00: Baseline Evidence

Status: Implemented

## Goal

Capture the current state of Ordo's capability, chat, job, backup, media,
factory, Docker, health, role access, and Rust surfaces before changing the
architecture.

Start from `../evidence/initial-code-grounding.md`, then verify and extend it
against the current worktree before implementation.

This phase does not implement product behavior. It creates the evidence needed
to keep every later phase grounded in real code.

## Current Code Grounding

Research these files and record findings in `../evidence/phase-00-baseline.md`:

- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- `src/core/platform/facade/AgentPlatformFacade.ts`
- `src/core/platform/execution/ExecutionTimeline.ts`
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

## Tasks

- Inventory current capability count and execution targets.
- Inventory current DB tables used for jobs, media, factory, backup, restore,
  commands, messages, and embeddings.
- Capture how tool calls/results are persisted and replayed.
- Capture how chat buttons/actions dispatch today.
- Capture current backup/restore flow and Rust command contract.
- Capture current health probes and Docker runtime process model.
- Record exact gaps that later phases must close.

## Evidence Commands

Suggested commands:

```bash
rg "tool_call|tool_result" src/lib src/hooks src/frameworks
rg "ActionLinkType|onAction|sendMessage" src/frameworks src/types
rg "backup_snapshots|restore_plans|system_commands" src
rg "media_workflows|factory_work_orders|job_events" src
rg "CapabilityRuntime|ExecutionTimeline|AgentPlatformFacade" src
rg "ANONYMOUS|AUTHENTICATED|APPRENTICE|STAFF|ADMIN" src
rg "ordo-backup|backup.create|restore.request" crates src scripts Dockerfile
```

## Positive Use Cases

- Evidence identifies every subsystem that already models multi-step work.
- Evidence shows where existing code can be adapted instead of rewritten.
- Evidence captures current Rust/Docker behavior.

## Negative Use Cases

- Evidence must not rely on memory or conversation claims.
- Evidence must not assume obsolete command names are still valid.
- Evidence must not skip UI dispatch paths.

## Edge Use Cases

- Empty greenfield database.
- Local development versus Docker runtime.
- Missing Rust binary.
- Disabled provider/tool.
- Conversation refresh during a pending operation.

## Exit Criteria

- `../evidence/phase-00-baseline.md` exists.
- Evidence cites concrete file paths.
- Evidence includes current risks and greenfield pruning candidates.
- Later phases can reference the evidence without re-discovering baseline facts.

## Implementation Closeout

Completed: 2026-05-03

Evidence file:

- `../evidence/phase-00-baseline.md`

QA result:

- Passed. The evidence covers the required capability, database, chat, action,
  backup/restore, Rust, health, Docker, role, media, and factory surfaces.
- No product code was changed in this phase.
- Phase 01 can now use the baseline evidence as its source of truth.
