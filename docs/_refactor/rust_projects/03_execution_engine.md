# Specification: Shared Core Execution Engine (`ordo-jobs`)

**Audience:** Implementation AI Agent
**Context:** This specification defines the unified background job execution engine. It replaces the current Node.js deferred job workers with a highly concurrent, memory-safe Rust execution engine, enforcing GoF patterns and SOLID principles.

## 1. The "Why": Memory Safety
Processing media (FFmpeg composition, ElevenLabs audio streaming) inside Node.js fragments the V8 Garbage Collector. Rust drops memory the instant a buffer goes out of scope, allowing the appliance to process large binary files strictly within the 2GB Docker container limit.

## 2. Strict Execution Parity (Zero TS Protocol Changes)
We utilize the Database as the integration layer to avoid massive rewrites:
*   **Enqueueing:** Next.js continues to insert jobs into the `job_queue` SQLite table exactly as it does today. Node.js understands the domain models perfectly.
*   **Deserialization:** Rust must parse the exact existing JSON schemas using `serde_json`. Do not force TypeScript to change its payloads.
*   **Failure Classification:** The Rust engine must classify failures identically to Node.js (`transient`, `terminal`, `policy`) to ensure the existing automatic retry logic functions correctly.
*   **Cancellation:** Rust must monitor SQLite for job cancellation and instantly send a `SIGKILL` to active FFmpeg subprocesses to save compute.

## 3. Clean Architecture Boundaries
The engine must be strictly layered:
*   **Domain:** `JobRequest`, `JobLease`, `ProgressUpdate`.
*   **Adapters:** `SqliteJobStore` (for DB access), `BrokerObserver` (for IPC Pub/Sub).
*   **Dependency Rule:** The core execution daemon must depend only on Traits (`JobStore`, `EventPublisher`), never on `sqlx` directly.

## 4. Gang of Four (GoF) Patterns
*   **Template Method:** The `WorkerDaemon` implements the immutable skeleton of a job:
    1. Acquire Lease from SQLite (`UPDATE ... SET status = 'running'`).
    2. Emit 'started' event to the Pub/Sub broker.
    3. Execute the specific algorithm (Delegated).
    4. Handle Result & Emit 'completed' or 'failed' event.
*   **Strategy Pattern:** Specific workers implement a `JobStrategy` trait.
    *   `ComposeMediaStrategy`: Spawns `std::process::Command` for FFmpeg.
    *   `BriefExecutionStrategy`: Gathers local filesystem manifests.
*   **Observer Pattern:** The daemon accepts `JobObserver` traits to stream NDJSON (for legacy HTTP fallback) or direct broadcast events to the UI.
