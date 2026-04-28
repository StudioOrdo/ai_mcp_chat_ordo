# Specification 08: Event-Driven Cancellation

## 1. Goal
To replace the 250ms SQLite polling loop for job cancellation with a zero-latency, event-driven in-memory architecture, saving database read overhead and instantly aborting expensive processes.

## 2. Core Architecture

### 2.1 The Global Job Event Bus
-   Instantiate an in-memory `EventEmitter` (e.g., `globalJobBus`) alongside the `JobQueueRepository`.

### 2.2 Event Emission on Write
-   Modify the database mutation that cancels a job (e.g., when the UI sends an abort signal or `updateJobStatus(id, { status: 'canceled' })` is called). After the SQLite write succeeds, call `globalJobBus.emit('job_canceled', jobId)`.

### 2.3 Worker Subscription
-   In `deferred-job-worker.ts`, remove the `startCancellationMonitor` `setInterval` loop.
-   Instead, attach a listener: `globalJobBus.on('job_canceled', handler)`.
-   If the emitted `jobId` matches the currently executing job, instantly trigger the `AbortController.abort()`.

## 3. Realistic Use Case
**Instant FFmpeg Termination**: A user accidentally starts a 10-minute video generation. They click "Cancel". The UI hits an API endpoint, which updates SQLite and fires the event bus. The worker instantly receives the event, fires the `AbortSignal`, and the underlying FFmpeg WASM process is killed in less than 5 milliseconds, freeing up CPU instantly.

## 4. Test Cases
1.  **Zero-Latency Abort**: Verify that emitting the `job_canceled` event causes the `AbortSignal.aborted` property to become true immediately.
2.  **Resource Cleanup**: Verify the listener is properly detached (`globalJobBus.off`) when the job naturally succeeds or fails, preventing memory leaks in the Node process.
