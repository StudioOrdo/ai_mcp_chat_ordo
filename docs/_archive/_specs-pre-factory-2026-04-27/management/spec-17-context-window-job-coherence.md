# Spec 17 — Context Window & Job State Coherence

## Goal

Ensure that the context window trimming strategy does not silently drop job state that the progress strip, bookmarks, or job action buttons depend on. Today, when older messages are trimmed from the LLM context, any job status parts embedded in those messages become invisible to downstream consumers that rely on the full message list.

---

## Current Architecture

### Context Window

`context-window.ts` manages how many messages are sent to the LLM:

- **Max messages:** 40
- **Max characters:** 80,000
- **Strategy:** Trim from the front (oldest messages first)
- **Summary support:** If a `meta_summary` or `summary` part exists in a system message, only messages after that summary are sent to the LLM, with the summary injected as context.

### The Problem

The context window operates on `Message[]` from the database. The progress strip's `resolveProgressStrip()` operates on `PresentedMessage[]` from the UI state. These are different views of the same data — but they trim differently:

1. **LLM context:** Trims old messages entirely. A job that was queued 30 messages ago is gone from the prompt.
2. **UI state:** `PresentedMessage[]` holds all messages loaded into the chat transcript — which may or may not include trimmed messages depending on how the chat hook hydrated.
3. **Progress strip:** Scans `toolRenderEntries` across ALL `PresentedMessage[]` to find active jobs. If a job's status message was in a trimmed message that the UI no longer has, the strip can't show it.

### Concrete Failure Scenario

```
Message 1:  [Job A queued]          ← trimmed from context after 40 more messages
Message 5:  [Job A running, 45%]    ← trimmed
Message 41: [User asks new question]
```

At this point:
- The LLM has no memory of Job A.
- If the UI transcript was loaded from a page refresh, messages 1 and 5 may not be in the `PresentedMessage[]` array.
- The progress strip shows nothing for Job A — even though Job A is still running on the server.

### Why This Matters Now

Specs 09, 11, and 14 all add features that depend on job state being visible in the UI:
- **Spec 09:** Retry count, elapsed time — requires the job's status messages.
- **Spec 11:** Job bookmarks — a pinned job must remain visible even if its messages are old.
- **Spec 14:** Retention sweep — must not delete jobs that the UI thinks are still active.

---

## Proposed Changes

### Feature A: Decouple Progress Strip from Message List

The progress strip should **not** depend on scanning `PresentedMessage[]` for job status parts. Instead, it should be backed by a dedicated job state store that is hydrated independently.

Create `src/hooks/chat/useJobStateStore.ts`:

```typescript
interface JobStateEntry {
  jobId: string;
  toolName: string;
  status: JobStatus;
  label: string;
  title: string | null;
  progressPercent: number | null;
  progressLabel: string | null;
  updatedAt: string;
  messageId: string;
  sequence: number;
  // ... other fields from JobStatusMessagePart
}

interface JobStateStore {
  entries: Map<string, JobStateEntry>;
  upsert(entry: JobStateEntry): void;
  getActive(): JobStateEntry[];
  getPinned(): JobStateEntry[];
}
```

This store is populated by:
1. The initial reconciliation in `useChatJobEvents` (`reconcileDeferredJobs`).
2. SSE events as they arrive.
3. The chat stream processor when it encounters job status events.

The progress strip reads from this store instead of scanning messages.

### Feature B: Job-Aware Context Trimming

When `trimToLimits()` trims messages that contain job status parts, it should preserve job state metadata in the summary. Modify the summary generation to include:

```
Active jobs at time of compaction:
- Job abc123 (compose_media): running, 45% complete
- Job def456 (generate_chart): queued
```

This ensures the LLM retains awareness of active jobs even after their status messages are trimmed.

### Feature C: Reconciliation as Single Source of Truth

The `reconcileDeferredJobs()` function already fetches all active job snapshots from the server. Make this the authoritative source for the progress strip, not the message list:

```typescript
// Current: progress strip reads from messages
const stripItems = resolveProgressStrip(messages, lookupDescriptor);

// Proposed: progress strip reads from job state store
const stripItems = resolveProgressStripFromStore(jobStateStore, lookupDescriptor);
```

This completely eliminates the dependency on messages containing job parts.

---

## Files

| Action | File |
|---|---|
| **NEW** | `src/hooks/chat/useJobStateStore.ts` |
| **MODIFY** | `src/hooks/chat/useChatJobEvents.ts` — populate job state store |
| **MODIFY** | `src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts` — read from store |
| **MODIFY** | `src/lib/chat/context-window.ts` — include active job summary in compacted context |

---

## Test Cases

**Positive:**
- Job queued in message 1, 50 messages later: progress strip still shows the job via reconciliation.
- Tab refresh on a 200-message conversation: job state store hydrated from server, strip shows all active jobs.
- Context trimmed: LLM summary includes active job state.

**Negative:**
- Job succeeded 100 messages ago, not pinned: does not appear in strip or store (expected).

**Edge:**
- Server reports job as `running` but the last SSE event said `queued`: store uses server snapshot (higher authority).
- Two jobs with same tool name: store keys by `jobId`, not `toolName`.

---

## Success Criteria

1. The progress strip shows correct job state regardless of how many messages have been trimmed.
2. The LLM's context includes a summary of active jobs even after their status messages are trimmed.
3. A page refresh followed by immediate progress strip inspection shows all active/failed jobs.
4. The store is the single source of truth — no component scans `PresentedMessage[]` for job state.
