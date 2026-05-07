# Specification: Job Scheduler & Recurring Tasks

**Audience:** Implementation AI Agent
**Context:** This specification defines how the Sovereign Appliance handles recurring background tasks (e.g., daily briefs, automated backups, nightly garbage collection) without compromising the GoF execution patterns established in `ordo-jobs`.

## 1. The Anti-Pattern
A common mistake in background workers is tying the *scheduling* of a job directly to its *execution* (e.g., a `setInterval` that directly fires off a database cleanup script). If the script fails, or the container restarts mid-execution, the task is lost and has no observability.

## 2. The Solution: Decoupled Scheduler
We will strictly decouple the scheduling clock from the execution engine.

*   **The Cron Thread:** The `ordo-daemon` will spawn a dedicated Tokio task using a lightweight library like `tokio-cron-scheduler`.
*   **The Action:** When a cron expression triggers (e.g., `0 0 * * *` for midnight), the scheduler thread does exactly one thing: **It inserts a JSON payload into the SQLite `job_queue` table.**
*   **The Execution:** The existing `ordo-jobs` engine immediately picks up the newly enqueued job, acquires the lease, and executes it using the standard `JobStrategy`.

## 3. Advantages
By treating scheduled tasks identically to user-triggered on-demand tasks, we achieve:
1.  **Observability:** The Next.js UI automatically sees the scheduled job start, progress, and complete because it flows through the same SQLite table and Pub/Sub broker.
2.  **Resilience:** If the container crashes while executing a nightly backup, the job's lease expires. Upon reboot, the `ordo-jobs` engine automatically recovers the job and retries it.
3.  **DRY Architecture:** You do not need to write custom error handling or retry logic for scheduled tasks.

## Agent Research Directives
1. Evaluate `tokio-cron-scheduler` or similar Rust cron crates for reliability.
2. Design the SQLite schema or configuration file mechanism for defining recurring schedules (should cron strings be hardcoded in Rust, or configurable via the Next.js UI?).
3. Implement a "Singleton Cron" lock: Ensure that if multiple `ordo-daemon` instances are ever accidentally booted, they do not duplicate cron insertions.
