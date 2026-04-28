# Specification 07: Dead Letter Queue (DLQ)

## 1. Goal
To ensure heavy or expensive jobs that fail terminally (exhausting all automatic retries) are not lost, providing the Admin a way to inspect, repair, and manually requeue them.

## 2. Core Architecture

### 2.1 DLQ State
-   Introduce a distinct `dead_letter` status in the `JobStatus` enum.
-   When a job exhausts its automatic retries in `deferred-job-worker.ts`, update its status to `dead_letter` instead of just `failed`.

### 2.2 Manual Replay Tool
-   Expose a new `requeue_dead_letter_job` tool to the Admin catalog. It takes a `jobId`, resets the `attemptCount` to 0, sets the status back to `queued`, and clears the `errorMessage`.

## 3. User Interface
Create an Admin Dashboard (`/admin/jobs/dlq`):
-   List all jobs with `status === 'dead_letter'`.
-   Display the full `errorMessage`, `failureClass`, and the payload that was attempted.
-   Provide a "Retry Job" button.
-   (Bonus) Allow the Admin to manually edit the `requestPayload` JSON before hitting retry, fixing broken inputs (e.g., a typoed asset ID).

## 4. Test Cases
1.  **State Transition**: Verify a job transitions to `dead_letter` after `attemptCount >= maxAttempts`.
2.  **Requeue Integrity**: Verify clicking "Retry Job" successfully increments the `JobEvent` stream with a `manually_requeued` event and a worker subsequently claims the job.
