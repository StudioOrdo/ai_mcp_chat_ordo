# Spec 11 — Job Command Rail & In-Chat Job Controls

## Goal

Transform the progress strip rail from a passive, read-only notification bar into an actionable job command center. Add job bookmarking, scroll-to-message navigation, and full job lifecycle controls (cancel, retry) to both the strip and the in-message card.

---

## Problem Statement

### The Progress Strip Today

The strip above the composer currently:
- Shows bubbles for `queued`, `running`, `failed`, and `canceled` jobs.
- Clicking a bubble opens a detail panel with status, progress, and an optional "Retry whole job" button.
- Caps at 3 visible items (desktop) or 2 (mobile), with overflow collapsed into a "+N more" button.
- **Has no way to navigate to the job's message in the transcript.**
- **Has no cancel button** — only retry for failed/canceled jobs.
- **Disappears for succeeded jobs** — `isEligibleStatus` (line 146 of `resolve-progress-strip.ts`) excludes `succeeded`.
- **Has no bookmark/pin mechanism** — jobs vanish from the strip the moment they leave an eligible state.

### In-Message Job Cards Today

The `SystemJobCard` and `CapabilityErrorCard` components:
- Show a compact row with label, status, and expand toggle.
- The expand body shows header, progress bar, summary, context panel, and artifact rail.
- **Have no cancel button.** A running job cannot be stopped from its card.
- **Have no retry button on the card itself.** Retry only exists in the progress strip panel.
- The `CapabilityActionRail` can render action buttons, but no actions are currently computed for job lifecycle operations.

### What the API Already Supports

The backend is ahead of the frontend. `POST /api/chat/jobs/[jobId]` already handles:

| Action | Backend Support | Frontend Exposure |
|---|---|---|
| `cancel` | ✅ Full implementation with event projection | ❌ No button anywhere in chat |
| `retry` | ✅ Full manual replay with deduplication | ⚠️ Only in progress strip panel, not on cards |
| `GET` status | ✅ Full job snapshot endpoint | ❌ No polling or refresh from strip |

The guards are already in place:
- `isJobCancelable()`: only `queued` or `running` jobs can be canceled.
- `canManualReplayJob()`: only `failed` or `canceled` jobs can be retried, and only if the tool has a registered capability.

---

## Feature 1: Job Action Buttons on In-Message Cards

### Behavior

Every `SystemJobCard` and `CapabilityErrorCard` shows contextual action buttons based on the job's current status:

| Job Status | Available Actions |
|---|---|
| `queued` | Cancel |
| `running` | Cancel |
| `succeeded` | (none — download/view actions from existing artifact rail) |
| `failed` | Retry |
| `canceled` | Retry |

### Implementation

**A. Compute actions in `ToolPluginPartRenderer.tsx`**

Add a `computeJobActions()` function that reads the `part.status`, `descriptor.supportsRetry`, and `isJobCancelable()` to produce action nodes:

```typescript
function computeJobActions(part: JobStatusMessagePart, descriptor?: CapabilityPresentationDescriptor): InlineNode[] {
  const actions: InlineNode[] = [];

  if (part.status === "queued" || part.status === "running") {
    actions.push({
      type: "action-link",
      label: "Cancel",
      actionType: "job",
      value: part.jobId,
      params: { operation: "cancel" },
    });
  }

  if ((part.status === "failed" || part.status === "canceled")
    && descriptor?.supportsRetry === "whole_job") {
    actions.push({
      type: "action-link",
      label: "Retry",
      actionType: "job",
      value: part.jobId,
      params: { operation: "retry" },
    });
  }

  return actions;
}
```

**B. Wire into existing `CapabilityActionRail`**

The `CapabilityActionRail` already renders action buttons and calls `onActionClick`. The computed job actions are merged with any existing `computedActions` passed to the card.

**C. Handle the action in the chat hook**

The `onActionClick` handler already receives `(actionType, value, params)`. When `actionType === "job"`, it calls `POST /api/chat/jobs/${value}` with `{ action: params.operation }`.

### Confirmation Dialog for Cancel

Canceling a running job is destructive. Show a lightweight inline confirmation:

```
[Cancel] → clicks → "Cancel this job? [Yes, cancel] [No, keep running]"
```

This replaces the button inline — no modal.

### Test Cases

**Positive:**
- Running job card shows "Cancel" button. Clicking it cancels the job via API.
- Failed job card shows "Retry" button. Clicking it creates a replay job.
- After cancel: card transitions to `canceled` state, button disappears.
- After retry: original card shows "Superseded by [new job]", new card appears.

**Negative:**
- Succeeded job: no lifecycle actions shown (only artifact download).
- Tool without `supportsRetry`: no Retry button even when failed.
- Browser runtime jobs (`browser:*` prefix): no Retry button (handled client-side).

**Edge:**
- Double-click Cancel: second call returns 409 (already canceled), UI handles gracefully.
- Cancel during retry backoff: job is in `queued` state due to `retry_scheduled`, cancel still works.

---

## Feature 2: Scroll-to-Message Navigation

### Behavior

Every job bubble in the progress strip and every item in the overflow panel gets a "Go to message" action that scrolls the transcript to the message containing that job's card.

### Implementation

**A. Message ID resolution**

The job system already generates deterministic message IDs via `getJobMessageId(jobId)` → `"jobmsg_${jobId}"`. The projected message in the conversation has this ID.

**B. Scroll target**

Add a `data-chat-job-message` attribute to the message container in `AssistantBubble` when it contains a job status part:

```tsx
<div data-chat-message-role="assistant" data-chat-job-message={jobId}>
```

**C. Scroll action**

In the progress strip detail panel, add a "Go to message" button:

```tsx
<button onClick={() => scrollToJobMessage(selectedItem.jobId)}>
  Go to message
</button>
```

The scroll function:

```typescript
function scrollToJobMessage(jobId: string) {
  const messageId = `jobmsg_${jobId}`;
  const element = document.querySelector(`[data-chat-job-message="${jobId}"]`);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("ui-chat-message-highlight");
    setTimeout(() => element.classList.remove("ui-chat-message-highlight"), 2000);
  }
}
```

**D. Highlight animation**

A brief golden pulse animation on the target message:

```css
.ui-chat-message-highlight {
  animation: message-highlight-pulse 2s ease-out;
}

@keyframes message-highlight-pulse {
  0% { box-shadow: 0 0 0 2px var(--accent-interactive); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
```

### Test Cases

**Positive:**
- Click "Go to message" in strip panel: transcript scrolls to the job's message, golden pulse.
- Job message is off-screen above: scrolls up and highlights.
- Job message is off-screen below: scrolls down and highlights.

**Negative:**
- Job message no longer exists (pruned by compaction): button disabled or hidden.

**Edge:**
- Multiple jobs in the same message: scrolls to the message, highlights the entire bubble.

---

## Feature 3: Job Bookmarks (Persistent Strip Pins)

### Behavior

Users can "pin" a job to the progress strip so it remains visible even after it completes. This solves the problem of succeeded jobs vanishing from the strip.

### UX

- Each job bubble in the detail panel gets a pin toggle: 📌
- Pinned jobs stay in the strip regardless of status.
- Pinned jobs are visually distinguished with a subtle pin icon on the bubble.
- Unpinning removes the job from the strip (if it would otherwise be filtered out).

### Implementation

**A. Pinned jobs state**

Store pinned job IDs in `localStorage` scoped to the conversation:

```typescript
const PINNED_JOBS_KEY = "ordo:pinned-jobs";

function getPinnedJobIds(conversationId: string): Set<string> {
  const stored = localStorage.getItem(`${PINNED_JOBS_KEY}:${conversationId}`);
  return new Set(stored ? JSON.parse(stored) : []);
}

function togglePinnedJob(conversationId: string, jobId: string): void {
  const pinned = getPinnedJobIds(conversationId);
  if (pinned.has(jobId)) pinned.delete(jobId);
  else pinned.add(jobId);
  localStorage.setItem(`${PINNED_JOBS_KEY}:${conversationId}`, JSON.stringify([...pinned]));
}
```

**B. Strip filter modification**

In `resolve-progress-strip.ts`, modify `isEligibleStatus` to also include jobs whose IDs are in the pinned set:

```typescript
function isEligibleStatus(status: JobStatus, isPinned: boolean): boolean {
  if (isPinned) return true; // pinned jobs always show
  return status === "queued" || status === "running" || status === "failed" || status === "canceled";
}
```

**C. Visual treatment**

Pinned succeeded jobs use the `success` tone with a small 📌 icon in the bubble.
Pinned failed jobs keep the existing `failed` treatment.

### Test Cases

**Positive:**
- Pin a running job → job completes → job remains in strip as pinned succeeded item.
- Unpin the job → job disappears from strip (succeeded, no longer eligible).
- Pin persists across page reloads (localStorage).
- Pinned job shows pin icon on its bubble.

**Negative:**
- Unpinned succeeded job: does not appear in strip (current behavior preserved).
- Clear localStorage: all pins removed, strip reverts to default behavior.

**Edge:**
- Pin 20 jobs: overflow mechanism handles them normally (3 visible + "+17 more").
- Pin a job from a different conversation: pin is scoped, does not appear.

---

## Feature 4: Enhanced Strip Detail Panel

### Current Panel

```
┌──────────────────────────┐
│ COMPOSE MEDIA            │
│ Video Composition        │
│                          │
│ Status: Needs attention  │
│ Progress: Failed         │
│ Updated: 1:19 PM         │
│                          │
│ Error message here...    │
│                          │
│          [Retry whole job]│
└──────────────────────────┘
```

### Proposed Panel

```
┌──────────────────────────────────────┐
│ COMPOSE MEDIA                    📌  │
│ The Intelligence Explosion           │
│                                      │
│ Status: Failed · terminal            │
│ Attempt: 3 of 3                      │
│ Updated: 1:19 PM                     │
│                                      │
│ The browser_short_explainer mode     │
│ currently supports image-based       │
│ visual beats only.                   │
│                                      │
│ [Go to message]  [Retry]  [Cancel]   │
└──────────────────────────────────────┘
```

### Changes

1. Add `failureClass` display (from Spec 09 data).
2. Add `attemptCount` display (from Spec 09 data).
3. Add "Go to message" button (Feature 2).
4. Add pin toggle (Feature 3).
5. Show contextual action buttons (cancel for running, retry for failed).
6. Cancel button in the strip should also use inline confirmation.

---

## Implementation Phases

### Phase 1: In-Message Job Actions (Highest Value)
- Add `computeJobActions()` to compute cancel/retry buttons from job status.
- Wire into existing `CapabilityActionRail` on `SystemJobCard` and `CapabilityErrorCard`.
- Add inline cancel confirmation.
- **Files:** `ToolPluginPartRenderer.tsx`, `SystemJobCard.tsx`, `CapabilityErrorCard.tsx`
- **Risk:** Low — uses existing action infrastructure and API endpoints.

### Phase 2: Scroll-to-Message
- Add `data-chat-job-message` attributes to job-bearing messages.
- Add "Go to message" button to strip detail panel.
- Add highlight animation to CSS.
- **Files:** `AssistantBubble.tsx`, `ChatProgressStrip.tsx`, `chat.css`
- **Risk:** Low — DOM query + scrollIntoView, no state changes.

### Phase 3: Enhanced Strip Panel
- Add `failureClass`, `attemptCount`, and contextual actions to the detail panel.
- Add cancel button to strip panel (currently only retry exists).
- **Files:** `ChatProgressStrip.tsx`, `resolve-progress-strip.ts`
- **Risk:** Low — extends existing panel with more data.

### Phase 4: Job Bookmarks
- Add pinned jobs state (localStorage).
- Modify strip eligibility filter.
- Add pin toggle UI to panel and bubble.
- **Files:** `resolve-progress-strip.ts`, `ChatProgressStrip.tsx`, `ProgressStripBubble.tsx`
- **Risk:** Medium — changes the core filtering logic of the strip.

---

## Non-Goals

- This spec does not add server-side job scheduling (see Spec 06).
- This spec does not add a standalone "Jobs Dashboard" page (the `/jobs` page already exists).
- This spec does not change the job execution engine or worker claim system.
- This spec does not add WebSocket/SSE-based real-time updates to the strip (it currently relies on message-level SSE events which are already flowing).

---

## Dependencies

- **Spec 09 (Job Transparency UX):** The `attemptCount`, `failureClass`, and `nextRetryAt` fields on `JobStatusMessagePart` are required for the enhanced strip panel. Phase 3 of this spec should follow Phase 1 of Spec 09.
- **Existing API:** `POST /api/chat/jobs/[jobId]` with `{ action: "cancel" | "retry" }` is already implemented and tested.

---

## Success Criteria

1. A user can cancel a running job directly from its card in the chat transcript.
2. A user can retry a failed job directly from its card — not just from the progress strip.
3. Clicking a job in the strip scrolls the transcript to the job's message and highlights it.
4. A user can pin a completed job so it stays visible in the strip for easy reference.
5. The strip panel shows failure class, attempt count, and contextual actions.
6. Cancel requires inline confirmation to prevent accidental clicks.
7. All actions use the existing `POST /api/chat/jobs/[jobId]` endpoint — no new API routes.
