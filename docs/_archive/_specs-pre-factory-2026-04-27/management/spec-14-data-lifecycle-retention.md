# Spec 14 — Data Lifecycle & Retention Enforcement

## Goal

Implement a comprehensive data lifecycle system that enforces retention policies across all three data domains: conversations, job records, and media assets. Today, conversations have retention logic but jobs and media assets grow unbounded.

---

## Current State

### What Exists

**Conversations:** A full retention system is implemented:
- `ConversationDataMapper.softDelete()` sets a `purge_after` timestamp.
- `ConversationDataMapper.listPurgeEligible()` finds conversations past their purge date.
- `conversation-retention-worker.ts` runs a sweep that purges expired deleted conversations and anonymous conversations older than 30 days (with a cap of 10 per anonymous user).
- `conversation_purge_audits` table preserves metadata after hard delete.

**Jobs:** Type definitions exist but no enforcement:
- `JobResultRetentionMode` defines `"retain" | "prune_payload_keep_events"` but **no code reads this value**.
- Job records accumulate forever in the `job_requests` table.
- `job_events` accumulate forever — a single media job can generate 50+ progress events.
- There is no `purge_after` equivalent on job records.

**Media Assets:**
- `MediaAssetRetentionClass` defines `"ephemeral" | "conversation" | "durable"` but **no code enforces these classifications**.
- Generated media files (video, audio, charts, graphs) are stored as user files with no automatic cleanup.
- A conversation purge deletes the `conversations` row but **does not cascade to associated media assets**.

---

## Proposed Changes

### Feature A: Job Retention Sweep

Add `src/lib/jobs/job-retention-worker.ts`:

```typescript
export interface JobRetentionPolicy {
  /** How long to keep completed job records after completion. */
  completedJobTtlDays: number;
  /** How long to keep failed job records. */
  failedJobTtlDays: number;
  /** How long to keep individual job events after the job completes. */
  eventTtlDays: number;
  /** Whether to prune result payloads but keep the event skeleton. */
  prunePayloads: boolean;
}

export const DEFAULT_JOB_RETENTION: JobRetentionPolicy = {
  completedJobTtlDays: 90,
  failedJobTtlDays: 180,
  eventTtlDays: 30,
  prunePayloads: true,
};
```

The sweep:
1. Find jobs where `status IN ('succeeded', 'canceled')` and `completed_at < cutoff`.
2. If `prunePayloads` is true and `retention_mode = 'prune_payload_keep_events'`, null out `request_payload` and `result_payload` but keep the event skeleton for audit.
3. For jobs past the full TTL, delete the job row and all its events.
4. Respect `retention_mode = 'retain'` — these jobs are never auto-pruned.

### Feature B: Media Asset Retention Enforcement

Add `src/lib/media/media-retention-worker.ts`:

```typescript
export interface MediaRetentionPolicy {
  /** Ephemeral assets are deleted after this many days. */
  ephemeralTtlDays: number;
  /** Conversation-scoped assets are deleted when the conversation is purged. */
  cascadeOnConversationPurge: true;
  /** Durable assets are never auto-deleted. */
  durableTtl: "never";
}

export const DEFAULT_MEDIA_RETENTION: MediaRetentionPolicy = {
  ephemeralTtlDays: 7,
  cascadeOnConversationPurge: true,
  durableTtl: "never",
};
```

### Feature C: Cascade Conversation Purge to Jobs and Assets

Modify `ConversationDataMapper.purge()` to also:
1. Delete all `job_requests` where `conversation_id = ?`.
2. Delete all `job_events` where `conversation_id = ?`.
3. Delete all user files where `conversation_id = ?` (or mark them for async cleanup).

This should happen inside the existing `purgeConversation` transaction.

### Feature D: Unified Retention Sweep Coordinator

Create `src/lib/retention/retention-sweep-coordinator.ts` that orchestrates all three sweeps in order:

```
1. Conversation retention sweep (existing)
2. Job retention sweep (new)
3. Media asset retention sweep (new)
```

Expose as a single `POST /api/admin/retention/sweep` endpoint and/or a scheduled job.

---

## Files

| Action | File |
|---|---|
| **NEW** | `src/lib/jobs/job-retention-worker.ts` |
| **NEW** | `src/lib/media/media-retention-worker.ts` |
| **NEW** | `src/lib/retention/retention-sweep-coordinator.ts` |
| **MODIFY** | `src/adapters/ConversationDataMapper.ts` — cascade purge to jobs and assets |
| **MODIFY** | `src/adapters/JobQueueDataMapper.ts` — add purge/prune methods |

---

## Test Cases

**Positive:**
- Job completed 91 days ago with `completedJobTtlDays: 90`: deleted by sweep.
- Job completed 91 days ago with `retention_mode: 'retain'`: not deleted.
- Ephemeral media asset created 8 days ago: deleted by sweep.
- Conversation purged: all associated jobs, events, and media files also deleted.

**Negative:**
- Durable media asset: never deleted regardless of age.
- Job still running: never touched by sweep regardless of age.
- Failed job at 89 days with `failedJobTtlDays: 180`: not deleted.

**Edge:**
- Job with `prune_payload_keep_events`: payload nullified but event rows preserved.
- Conversation purge with 500 associated assets: transaction completes without timeout.

---

## Success Criteria

1. `JobResultRetentionMode` is actively enforced, not just a dead type.
2. `MediaAssetRetentionClass` is actively enforced, not just a dead type.
3. Conversation purge cascades to jobs and media — no orphaned data.
4. A self-hosted Ordo instance running for a year maintains a bounded database size.
