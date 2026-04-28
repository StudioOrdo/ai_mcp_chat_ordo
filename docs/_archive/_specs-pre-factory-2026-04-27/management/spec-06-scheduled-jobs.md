# Specification 06: Scheduled Jobs (Time Travel)

## 1. Goal
To allow the AI or Admin to schedule deferred jobs to execute at a specific future date and time, enabling automation like follow-up emails, maintenance tasks, or delayed publishing.

## 2. Core Architecture

### 2.1 The `executeAt` Parameter
-   Rename or extend the existing `nextRetryAt` column in the `JobQueue` schema to support a generalized `executeAt` timestamp.
-   When enqueueing a job (`enqueueDeferredToolJob`), accept an optional `executeAt: string (ISO-8601)` parameter.

### 2.2 Worker Polling Logic
-   Update the SQLite query in `claimNextQueuedJob` to only return jobs where `status === 'queued'` AND `(executeAt IS NULL OR executeAt <= CURRENT_TIMESTAMP)`.

### 2.3 LLM Tool Upgrades
-   Update the capability schemas for communication tools (e.g., `send_email`, `publish_post`) to optionally accept a `schedule_for` datetime parameter, passing it down to the enqueue step.

## 3. Realistic Use Case
**Lead Follow-Up**: The AI reviews a new lead consultation request. It decides to wait before responding. It executes the `send_email` tool but provides `schedule_for: "2026-04-28T10:00:00Z"`. The job sits safely in SQLite until the exact moment arrives, at which point a worker claims and executes it.

## 4. Test Cases
1.  **Temporal Isolation**: Verify that a worker calling `claimNextQueuedJob` ignores a job scheduled for 5 minutes in the future.
2.  **Execution Trigger**: Advance the system clock (or use mock timers) past the `executeAt` threshold and verify the worker immediately claims the job.
