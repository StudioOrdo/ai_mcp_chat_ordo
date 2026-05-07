# Current Code Grounding

Status: initial map

This document names what already exists. It is not a full audit. The archaeology
phase will verify each item in detail.

## Rust

### Existing crates

- `crates/ordo-backup`
- `crates/ordo-daemon`

### Backup command worker

Evidence:

- `crates/ordo-backup/src/daemon.rs`
- `crates/ordo-backup/src/command_store.rs`
- `crates/ordo-backup/src/native_contract.rs`
- `crates/ordo-backup/tests/governed_executor.rs`

Current shape:

- Rust opens the SQLite database.
- Rust claims pending `system_commands` rows targeting `rust_daemon`.
- Rust executes backup or restore commands.
- Rust marks commands succeeded or failed.
- Commands use a lease and expired leases can be recovered.

Important detail:

`crates/ordo-backup/src/command_store.rs` already proves the basic command loop
we want to reuse:

```text
claim pending command -> lease it -> execute -> write result -> recover expired work
```

### Native result contract

Evidence:

- `crates/ordo-backup/src/native_contract.rs`
- `src/lib/appliance/native/native-command-contract.ts`
- `src/lib/appliance/native/native-result-reconciler.ts`

Current shape:

- TypeScript and Rust both define a native command result shape.
- Rust serializes `schemaVersion`, `commandId`, operation metadata, status,
  summary, artifacts, metrics, and error.
- TypeScript parses and validates the result.
- TypeScript reconciles results into operation events and artifacts.

Risk:

The TypeScript/Rust schema is still manually mirrored. The Rust planning docs
already call this out as a drift risk.

### Ordo daemon crate

Evidence:

- `crates/ordo-daemon/src/main.rs`
- `crates/ordo-daemon/src/http.rs`
- `crates/ordo-daemon/src/health.rs`
- `crates/ordo-daemon/src/executor_harness.rs`
- `crates/ordo-daemon/src/crash_report.rs`

Current shape:

The crate exists and has early runtime structure, health, fixture, and harness
work. It is not yet the one runtime that owns realtime, backup/restore, media,
and background processing.

## TypeScript Runtime

### Chat and conversations

Evidence:

- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/active/route.ts`
- `src/app/api/chat/events/route.ts`
- `src/core/use-cases/ConversationInteractor.ts`
- `src/frameworks/ui/ChatSurface.tsx`
- `src/frameworks/ui/useChatSurfaceState.tsx`

Current shape:

- Conversations are real.
- The signed-in home surface now has a Conversations selector.
- `/api/chat/events` streams job-related events for the active conversation.

Problem:

The event stream is still based on polling jobs, not one shared product event
stream.

### Jobs and event streaming

Evidence:

- `src/lib/jobs/job-event-stream.ts`
- `src/lib/jobs/job-event-history.ts`
- `src/lib/jobs/job-event-bus.ts`
- `src/app/api/jobs/events/route.ts`
- `src/app/api/jobs/[jobId]/events/route.ts`

Current shape:

- Jobs have event history and streamable events.
- `createJobEventStreamResponse` uses SSE and polling.
- `jobEventBus` is an in-process Node `EventEmitter` for cancellation signals.

Problem:

This is useful but too narrow. It is jobs-first, Node-memory-first, and not a
system-wide event spine.

### Briefs

Evidence:

- `src/core/entities/brief.ts`
- `src/core/entities/brief-execution.ts`
- `src/lib/briefs/brief-update-executor.ts`
- `src/lib/briefs/brief-update-reconciler.ts`
- `src/lib/briefs/section-brief-resolver.ts`

Current shape:

- Brief entities exist.
- Durable brief update requests and results exist.
- Brief execution has a request/result/reconcile flow.
- Failed brief results do not overwrite the current brief.
- There is a deterministic fallback brief generator.

Problem:

Briefs are not yet wired into a complete app-wide event, stale-marking, and UI
refresh system.

### Today

Evidence:

- `src/lib/dashboard/today-brief-read-model.ts`
- `src/lib/dashboard/load-user-dashboard.ts`
- `src/components/dashboard/UserDashboard.tsx`

Current shape:

- Today has a read model with intents like decide, watch, inspect, learn, fix.
- Recent work reduced some raw job language in owner UI.

Problem:

The Today UI still reads like a reshuffled dashboard unless the backend supplies
better brief state, evidence, and live updates.

### Studio

Evidence:

- `src/app/studio/page.tsx`
- `src/lib/studio/load-studio-workspace.ts`
- `src/components/studio/StudioWorkspace.tsx`
- `src/app/studio/media/[assetId]/page.tsx`
- `src/components/media/MediaAssetDetail.tsx`
- `src/lib/media/workflows/*`
- `src/lib/jobs/*`

Current shape:

- Studio loads media, workflows, content, campaigns, and job/work cards.
- `/my/media` has been retired from primary IA and redirects into Studio media.
- Selected media detail can play media.

Problem:

Studio still depends on several donor read models and needs a cleaner produced
work model with provenance and actions per object type.

### People and referrals

Evidence:

- `src/lib/business/people-read-model.ts`
- `src/lib/business/load-business-workspace.ts`
- `src/components/business/BusinessWorkspace.tsx`
- `src/lib/referrals/load-referrals-workspace.ts`
- `src/components/referrals/ReferralsWorkspace.tsx`

Current shape:

- People merges relationship evidence.
- Referral source evidence can appear in People.
- `/referrals` owns the affiliate dashboard.

Problem:

The frontend shape is closer, but relationship intelligence still depends on
read models that need stronger event updates and source trails.

### Offers

Evidence:

- `src/lib/offers/load-offers-workspace.ts`
- `src/components/offers/OfferSurfaces.tsx`
- `src/core/entities/offer.ts`
- `src/core/entities/offer-event.ts`

Current shape:

- Offers have public/private/draft/accepted/purchased concepts in code.
- Offer events exist.

Problem:

Accepted-offer lifecycle needs to be proven as durable event-backed evidence,
not just labels in the UI.

## Current Root Problem

The app has many partial read models, but it does not yet have one shared change
system.

That means the UI can be clean and still feel stale.

The next product jump comes from the backend path:

```text
durable event -> read model update/stale marker -> realtime invalidation -> UI refetch
```
