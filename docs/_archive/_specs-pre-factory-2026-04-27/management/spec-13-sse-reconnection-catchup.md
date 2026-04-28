# Spec 13 — SSE Reconnection & Event Catch-Up

## Goal

Ensure that when a browser connection drops during a job's execution, the UI recovers to the correct state without user intervention. Today, the system has partial reconnection logic but no sequence-based catch-up, meaning users can see stale "Running" spinners indefinitely.

---

## Current Architecture

### What Works

The `useChatJobEvents` hook (line 100) opens an `EventSource` to `/api/chat/events?conversationId=...` for real-time job updates. It has three recovery mechanisms:

1. **`onerror` handler** (line 121): When the SSE connection errors, it calls `reconcile()` — a full fetch of all active job snapshots from `/api/chat/jobs?conversationId=...&limit=50`.
2. **`focus` listener** (line 135): When the tab regains focus, it reconciles.
3. **`visibilitychange` listener** (line 129): When the tab becomes visible, it reconciles.

### What Doesn't Work

1. **No sequence tracking.** The reconciliation fetches all jobs but has no concept of "the last event I saw was sequence N, give me everything after N." If 5 events fired during a 30-second disconnect, the reconciliation may return the job's current state, but the UI has no way to detect whether intermediate events (like progress phases completing) were missed.

2. **EventSource has native retry, but no `Last-Event-Id`.** The browser's `EventSource` will automatically reconnect, but the server endpoint doesn't support the `Last-Event-Id` header for resumable streams. On reconnect, the EventSource opens a fresh connection and the client must re-reconcile.

3. **The main chat stream (`ChatStreamAdapter`) has zero reconnection.** It's a `fetch()` with a `ReadableStream` reader. If the connection drops mid-stream, the async iterator exits with a `done: true` or catches the error — either way, the stream ends and there's no retry. The user sees a truncated response.

4. **Reconciliation backoff is too aggressive for missing conversations.** `MISSING_CONVERSATION_RETRY_DELAY_MS` is 5 seconds, which is fine, but there's no maximum retry count. An EventSource pointed at a nonexistent conversation will reconcile forever.

---

## Proposed Changes

### Feature A: Sequence-Aware Reconciliation

Add a `since` parameter to the job snapshot endpoint:

```
GET /api/chat/jobs?conversationId=...&since=42
```

This returns only events with `sequence > 42`, allowing the client to catch up precisely rather than re-fetching everything.

**Client-side:** Track the highest event sequence seen per conversation in the `useChatJobEvents` hook:

```typescript
const highWaterMark = useRef(0);

source.onmessage = (message) => {
  const raw = JSON.parse(message.data);
  const event = parser.parse(raw);
  if (event && "sequence" in event) {
    highWaterMark.current = Math.max(highWaterMark.current, event.sequence);
  }
  // ...existing processing
};

// On reconcile, pass the high water mark
const result = await reconcileDeferredJobs(conversationId, dispatch, highWaterMark.current);
```

### Feature B: Server-Side `Last-Event-Id` Support

Add `id:` fields to SSE events on the server:

```
id: evt_12345_42
data: {"type":"job_progress","sequence":42,...}
```

When EventSource reconnects, the browser sends `Last-Event-Id: evt_12345_42`. The server uses this to replay missed events instead of starting from scratch.

### Feature C: Chat Stream Resilience

The main `ChatStreamAdapter.fetchStream()` currently has no retry. For the chat stream (which is a one-shot LLM response), full reconnection is not appropriate — but we should:

1. **Detect premature disconnection**: If the stream ends without a `done` event, emit a `generation_interrupted` event with `reason: "connection_lost"`.
2. **Show a reconnection CTA**: Display a "Connection lost. Retry?" action chip rather than silently truncating the response.

### Feature D: Reconciliation Bounds

Add a maximum retry count and exponential backoff:

```typescript
const MAX_RECONCILIATION_RETRIES = 5;
const RECONCILIATION_BACKOFF_BASE_MS = 2_000;

let retryCount = 0;

source.onerror = () => {
  if (retryCount >= MAX_RECONCILIATION_RETRIES) {
    dispatch({ type: "SET_CONNECTION_STATE", state: "disconnected" });
    return;
  }
  const delay = RECONCILIATION_BACKOFF_BASE_MS * Math.pow(2, retryCount);
  retryCount++;
  setTimeout(() => void reconcile(), delay);
};
```

---

## Files

| Action | File |
|---|---|
| **MODIFY** | `src/hooks/chat/useChatJobEvents.ts` — sequence tracking, bounded retries |
| **MODIFY** | `src/app/api/chat/events/route.ts` — add `id:` to SSE events |
| **MODIFY** | `src/app/api/chat/jobs/route.ts` — add `since` query parameter |
| **MODIFY** | `src/adapters/ChatStreamAdapter.ts` — detect premature disconnection |

---

## Test Cases

**Positive:**
- SSE drops for 10s, reconnects: client sends `Last-Event-Id`, server replays missed events.
- Tab backgrounded for 60s, foregrounded: `reconcile()` fetches only events since high water mark.
- Chat stream drops without `done` event: UI shows "Connection lost. Retry?" chip.

**Negative:**
- 5 consecutive reconciliation failures: UI shows "disconnected" state, stops retrying.
- `since` parameter is 0 (first load): returns all events (same as current behavior).

**Edge:**
- Server restarts during SSE connection: `Last-Event-Id` references an event the new server instance doesn't have → falls back to full reconciliation.
- Two tabs open on same conversation: each tracks its own high water mark independently.

---

## Success Criteria

1. A user who backgrounds a tab during a 2-minute media render sees the correct final state when they return.
2. No infinite reconciliation loops for missing or deleted conversations.
3. Premature chat stream disconnection produces a visible, actionable error — not a silent truncation.
