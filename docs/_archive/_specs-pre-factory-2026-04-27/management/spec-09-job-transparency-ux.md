# Spec 09 — Job Transparency UX

## Goal

Surface hidden job system internals to the chat UI so users can distinguish between a stalled system, a resilient retry, a policy limit, and a catastrophic failure — without exposing raw infrastructure details.

The current `JobStatusMessagePart` already carries `failureClass`, `recoveryMode`, and `replayedFromJobId`, but the UI renders all non-terminal states as a generic spinner. This spec defines what to expose, how to present it, and where the data flows from.

---

## Problem Statement

The job system tracks rich operational state internally:

| Hidden Data | Current UX | User Perception |
|---|---|---|
| `attemptCount` (e.g., 3 of 5) | Generic "Queued" spinner | "Is it broken?" |
| `nextRetryAt` (backoff timer) | Nothing visible | "Why is nothing happening?" |
| `failureClass` (transient vs terminal vs policy) | Generic "Failed" message | "Was it my fault or the system's?" |
| `recoveryMode` + `lastCheckpointId` | Not shown | "Did it lose all my progress?" |
| `claimedBy` (worker identity) | Not shown | No sense of distributed execution |
| `lease_recovered` event | Mapped silently to "queued" | User unaware system self-healed |

Users who see an unexplained spinner for 90 seconds will cancel and retry, creating duplicate queue pressure and wasting compute.

---

## Architecture: Data Already Available

The key insight is that most of this data **already exists** in the `JobRequest` entity and the `JobStatusMessagePart` type. The work is primarily in the projection layer (`job-status.ts`) and the UI rendering layer.

### Source → Projection → UI

```
JobRequest (entity)
  ├── attemptCount          → new field on JobStatusMessagePart
  ├── nextRetryAt           → new field on JobStatusMessagePart
  ├── failureClass          → ALREADY on JobStatusMessagePart (not rendered)
  ├── recoveryMode          → ALREADY on JobStatusMessagePart (not rendered)
  ├── lastCheckpointId      → new field on JobStatusMessagePart
  ├── claimedBy             → new field on JobStatusMessagePart (admin only)
  ├── createdAt / startedAt → new fields for elapsed time calculation
  └── leaseExpiresAt        → used internally, not projected

JobEvent (event-sourced)
  ├── lease_recovered       → new UI state: "System recovered this job"
  ├── retry_scheduled       → new UI state: "Retrying in Xs..."
  └── requeued              → new UI state: "Re-queued after recovery"
```

---

## Feature 1: Resilience Indicator (Retry Visibility)

### Behavior

When `attemptCount > 1`, the job status card shows the attempt number.

```
Attempt 2 of 3 · Running
```

When `attemptCount` equals the max retry limit and the job fails, show:

```
All 3 attempts exhausted · Failed
```

### Data Flow

1. `buildJobStatusPartFromProjection()` in `job-status.ts` already receives the full `JobStatusProjection`. Add `attemptCount` to the projection type.
2. Add `attemptCount?: number` and `maxAttempts?: number` to `JobStatusMessagePart`.
3. The `maxAttempts` value comes from the capability registry's retry policy (already defined in `job-capability-registry.ts`).

### Test Cases

**Positive:**
- Job on attempt 1: no retry indicator shown.
- Job on attempt 2 of 5: shows "Attempt 2 of 5."
- Job on final attempt that fails: shows "All 5 attempts exhausted."

**Negative:**
- Job with `retryMode: "manual_only"`: never shows retry count (retries are not automatic).
- Job that succeeds on attempt 3: retry indicator disappears on success; summary says "Completed (after 3 attempts)."

**Edge:**
- Job with no retry policy defined: defaults to showing no indicator (same as attempt 1).

---

## Feature 2: Retry Countdown Timer

### Behavior

When a job is in `retry_scheduled` state with a `nextRetryAt` timestamp, show a live countdown:

```
Transient error detected · Retrying in 42s...
```

When the countdown reaches zero, transition to:

```
Retrying now...
```

### Data Flow

1. Add `nextRetryAt?: string | null` to `JobStatusMessagePart`.
2. The `retry_scheduled` event already carries the timestamp in its payload.
3. The UI component calculates the countdown client-side from `nextRetryAt` minus `Date.now()`.

### Test Cases

**Positive:**
- Job with `nextRetryAt` 60s in the future: shows countdown ticking from 60 to 0.
- Countdown reaches 0: label changes to "Retrying now..."
- Job transitions to "running" while countdown is active: countdown disappears, spinner resumes.

**Negative:**
- Job with no `nextRetryAt`: no countdown shown.
- Job that is canceled during countdown: countdown disappears, shows "Canceled."

**Edge:**
- `nextRetryAt` is in the past (clock skew or delayed SSE delivery): show "Retrying now..." immediately.

---

## Feature 3: Failure Class Differentiation

### Behavior

Instead of a generic "Failed" message, show failure-class-aware copy:

| `failureClass` | User-Facing Label | Icon/Color |
|---|---|---|
| `transient` | "Temporary system error. Retrying automatically." | Amber / warning |
| `terminal` | "A critical error occurred. This job cannot be retried." | Red / error |
| `policy` | "Job stopped: a usage limit or policy was reached." | Blue / info |
| `canceled` | "This job was canceled." | Gray / neutral |
| `unknown` | "An unexpected error occurred." | Red / error |

### Data Flow

1. `failureClass` is **already** on `JobStatusMessagePart` (line 38 of `message-parts.ts`).
2. The UI currently ignores it. The rendering component needs a switch statement to map `failureClass` to copy and visual treatment.

### Test Cases

**Positive:**
- `failureClass: "transient"` + `attemptCount < max`: shows amber warning with "Retrying automatically."
- `failureClass: "terminal"`: shows red error with no retry option.
- `failureClass: "policy"`: shows blue info banner with the policy message from `errorMessage`.

**Negative:**
- `failureClass: null` (legacy jobs before this field existed): falls back to generic "Failed" treatment.

**Edge:**
- `failureClass: "transient"` but `attemptCount === maxAttempts`: escalate to terminal-style display ("All retries exhausted").

---

## Feature 4: Checkpoint Resume Visibility

### Behavior

When a job resumes from a checkpoint (`recoveryMode === "checkpoint_resume"` and `lastCheckpointId` is set), show:

```
Resuming from saved checkpoint · 80% complete
```

When a job is replayed from a previous job (`replayedFromJobId` is set), show:

```
Re-running from previous job · Attempt fresh
```

### Data Flow

1. `recoveryMode` is **already** on `JobStatusMessagePart`.
2. Add `lastCheckpointId?: string | null` to `JobStatusMessagePart`.
3. `replayedFromJobId` is **already** on `JobStatusMessagePart`.
4. If `progressPercent` is available from the checkpoint, display it alongside the recovery message.

### Test Cases

**Positive:**
- Job with `recoveryMode: "checkpoint_resume"` and `lastCheckpointId`: shows "Resuming from saved checkpoint."
- Job with `replayedFromJobId`: shows link or reference to the original job.
- Job with `recoveryMode: "rerun"`: shows "Re-running from scratch" (no checkpoint advantage).

**Negative:**
- Job with `recoveryMode: null`: no recovery indicator shown (normal execution).

**Edge:**
- Job with `lastCheckpointId` but `recoveryMode: "rerun"`: checkpoint exists but was not used. Do not show checkpoint indicator.

---

## Feature 5: Worker Identity (Admin/Developer Mode)

### Behavior

For users with an admin or developer role, show a subtle indicator of which worker instance claimed the job:

```
Worker: sidecar-alpha-9 · Lease expires in 120s
```

This should be a collapsible detail, not a primary UI element. It appears in an expandable "System Details" section below the job card.

### Data Flow

1. Add `claimedBy?: string | null` to `JobStatusMessagePart` (projected only when the requesting user has admin privileges).
2. Add `leaseExpiresAt?: string | null` for the same audience.
3. The projection layer (`buildJobStatusPartFromProjection`) receives a flag indicating whether to include admin-level fields.

### Test Cases

**Positive:**
- Admin user viewing a running job: sees worker ID and lease timer.
- Admin user viewing a completed job: worker ID shown as historical fact, no lease timer.

**Negative:**
- Non-admin user: never sees worker identity or lease information.
- Job that has not been claimed yet (still queued): shows "Waiting for available worker."

**Edge:**
- `lease_recovered` event fired: admin sees "Recovered from worker sidecar-alpha-3 (lease expired)."

---

## Feature 6: Elapsed Time Display

### Behavior

For running jobs, show a live elapsed timer:

```
Running · 1m 23s elapsed
```

For completed jobs, show total duration:

```
Completed in 2m 47s
```

### Data Flow

1. Add `startedAt?: string | null` and `completedAt?: string | null` to `JobStatusMessagePart`.
2. The UI calculates elapsed time client-side for running jobs (`Date.now() - startedAt`).
3. For completed jobs, display `completedAt - startedAt`.

### Test Cases

**Positive:**
- Running job with `startedAt`: shows ticking elapsed timer.
- Completed job: shows static "Completed in Xm Ys."
- Failed job: shows "Failed after Xm Ys."

**Negative:**
- Queued job (no `startedAt`): shows "Waiting..." with no elapsed time.

**Edge:**
- `startedAt` is present but `completedAt` is null and status is `succeeded` (data inconsistency): use `updatedAt` as fallback for completion time.

---

## Implementation Phases

### Phase 1: Projection Layer (Backend)
- Extend `JobStatusProjection` in `job-status.ts` to include: `attemptCount`, `nextRetryAt`, `lastCheckpointId`, `startedAt`, `completedAt`.
- Extend `JobStatusMessagePart` in `message-parts.ts` with matching optional fields.
- Update `buildJobStatusPartFromProjection()` to populate the new fields.
- Admin-gated projection for `claimedBy` and `leaseExpiresAt`.

### Phase 2: UI Rendering
- Update the job status card component to render:
  - Retry indicator (Feature 1)
  - Failure class differentiation (Feature 3)
  - Elapsed time (Feature 6)
- These three are the highest-value, lowest-risk changes.

### Phase 3: Live Timers
- Implement client-side countdown for retry timer (Feature 2).
- Implement client-side elapsed timer for running jobs (Feature 6).
- Both use `requestAnimationFrame` or a 1-second `setInterval`, cleaned up on unmount.

### Phase 4: Recovery & Admin Features
- Checkpoint resume indicator (Feature 4).
- Worker identity panel for admin users (Feature 5).
- These are lower priority and depend on the admin role system being in place.

---

## Non-Goals

- This spec does not change the job execution engine, retry logic, or worker claim system.
- This spec does not add new API endpoints. All data flows through the existing SSE stream and `JobStatusMessagePart` type.
- This spec does not expose the `replaySnapshot` to the UI. That data is too large and remains for system-level debugging only.

---

## Success Criteria

1. A user watching a retrying job sees attempt count and countdown — not a mysterious spinner.
2. A user whose job hit a policy limit gets a clear, non-alarming explanation.
3. A user whose job recovered from a checkpoint sees that their progress was preserved.
4. An admin can identify which worker handled a job and whether a lease recovery occurred.
5. No new data is leaked to non-admin users that was previously internal-only.
