# Current Database Map

Issue: https://github.com/StudioOrdo/ai_mcp_chat_ordo/issues/1

Status: initial archaeology evidence

## Summary

SQLite already stores most product domains. The problem is not lack of tables.
The problem is that events and read state are split by domain, and there is no
single ordered product event log.

Schema anchors:

- `src/lib/db/tables.ts`
- `src/lib/db/migrations.ts`
- mapper tests in `src/adapters/*.test.ts`
- Rust test schema in `crates/ordo-backup/tests/governed_executor.rs`

## Existing Tables By Area

### Conversations

Schema anchors:

- `src/lib/db/tables.ts`
  - `conversations`
  - `messages`

Runtime anchors:

- `src/adapters/ConversationDataMapper.ts`
- `src/adapters/MessageDataMapper.ts`
- `src/adapters/ConversationEventDataMapper.ts`
- `src/lib/chat/conversation-root.ts`

Status: implemented

Gap:

Conversation changes are not projected into one shared event log.

### Jobs

Schema anchors:

- `src/lib/db/tables.ts`
  - `job_requests`
  - `job_events`

Runtime anchors:

- `src/adapters/JobQueueDataMapper.ts`
- `src/lib/jobs/*`

Status: implemented

Important detail:

`job_events.sequence` is conversation-local. `listUserEvents` maps rows into a
user-scoped sequence using `rowid`.

Gap:

There is no global sequence across all product events.

### Activity receipts

Schema anchors:

- `src/lib/db/tables.ts`
  - `activity_receipts`

Runtime anchors:

- `src/adapters/ActivityReceiptDataMapper.ts`
- `src/lib/activity/*`

Status: implemented

What it does:

- Tracks read, acknowledged, dismissed, and pinned state per user/source.

Gap:

This is close to the needed read-state model, but it is source-item based and
not yet section-cursor based.

### Briefs

Schema anchors:

- `src/lib/db/tables.ts`
  - `brief_read_models`
  - `brief_events`
  - `brief_update_requests`
  - `brief_update_results`
- `src/lib/db/migrations.ts`
  - same brief tables

Runtime anchors:

- `src/adapters/BriefReadModelDataMapper.ts`
- `src/adapters/BriefUpdateRequestDataMapper.ts`
- `src/core/entities/brief.ts`
- `src/core/entities/brief-execution.ts`

Status: implemented, not fully wired to every section

What it does:

- Stores current and prior section briefs.
- Stores brief events.
- Stores durable brief update requests and results.
- Supports leases for brief update requests.

Gap:

Brief freshness is not yet driven by one product event log.

### Native commands and backup/restore

Schema anchors:

- `src/lib/db/tables.ts`
  - `system_commands`
  - `backup_snapshots`
  - `backup_policy`
  - `backup_restore_audit_events`
  - `restore_plans`
- `src/adapters/BackupGovernanceDataMapper.test.ts`
- `crates/ordo-backup/tests/governed_executor.rs`

Runtime anchors:

- `src/adapters/BackupSystemCommandDataMapper.ts`
- `src/adapters/BackupSnapshotDataMapper.ts`
- `src/adapters/RestorePlanDataMapper.ts`
- `crates/ordo-backup/src/command_store.rs`

Status: implemented for backup/restore

What it does:

- Stores durable commands for Rust.
- Stores backup snapshot state.
- Stores restore plan state.
- Stores backup/restore audit events.

Gap:

This pattern is not yet generalized to all long-running work.

### Operations

Schema anchors:

- `src/lib/db/tables.ts`
  - `operations`
  - `operation_steps`
  - `operation_events`
  - `operation_actions`
  - `operation_artifacts`

Runtime anchors:

- `src/adapters/OperationDataMapper.ts`
- `src/core/use-cases/operations/*`
- `src/lib/operations/*`

Status: implemented

What it does:

- Stores operation-local events and sequence.
- Stores steps, actions, and artifacts.

Gap:

Operation events are operation-local, not global product events.

### Media workflows

Schema anchors:

- `src/lib/db/migrations.ts`
  - `media_workflows`
  - `media_workflow_steps`
  - `media_workflow_events`

Runtime anchors:

- `src/lib/media/workflows/sqlite-media-workflow-repository.ts`
- `src/lib/media/workflows/*`

Status: implemented

Gap:

Media workflow events are not yet projected into one event/inbox spine.

### Offers

Schema anchors:

- `src/lib/db/tables.ts`
  - `offers`
  - `offer_events`
- `src/lib/db/migrations.ts`
  - `offers`
  - `offer_events`

Runtime anchors:

- `src/lib/offers/load-offers-workspace.ts`
- `src/core/entities/offer.ts`
- `src/core/entities/offer-event.ts`

Status: implemented

Gap:

Offer lifecycle evidence is domain-specific and not yet part of a shared event
stream.

### Referrals

Schema anchors:

- `src/lib/db/tables.ts`
  - `referrals`
  - `referral_events`
- `src/lib/db/migrations.ts`
  - `referral_events`

Runtime anchors:

- `src/lib/referrals/*`
- `src/components/referrals/ReferralsWorkspace.tsx`

Status: implemented

Gap:

Referral evidence appears in People and referrals, but it is not globally
sequenced for realtime updates.

## Missing Tables

These target tables do not appear to exist yet:

- `system_events`
- `user_section_cursors`
- `user_inbox_items`

## Database Conclusion

The schema already has several local event tables:

- `job_events`
- `operation_events`
- `media_workflow_events`
- `offer_events`
- `referral_events`
- `brief_events`
- `backup_restore_audit_events`

The next schema step should not replace these immediately. It should add a
small global event layer that can reference them.
