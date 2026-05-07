# Specification: Supervisor & Container Lifecycle

**Audience:** Implementation AI Agent
**Context:** This specification defines the process management, health monitoring, and crash-recovery strategy for the Sovereign Appliance's single Docker container.

## 1. The Core Philosophy: "Crash-Only"
The appliance must never attempt internal "soft restarts" of deadlocked processes, which leads to zombie processes, orphaned ports, and SQLite corruption. Instead, the container uses a **Fail-Fast & Co-Dependent Lifecycle**. If any critical component fails, the entire container exits, allowing Docker's daemon (`restart: always`) to perform a perfectly clean, known-good reboot.

## 2. The Supervisor (`ENTRYPOINT`)
A dedicated, lightweight Rust binary (`ordo-supervisor`) becomes PID 1 inside the Docker container.
*   **Execution:** It boots the Node.js server (`start-server.mjs`) and the consolidated Rust daemon (`ordo-daemon`) as its children.
*   **Signal Trapping:** It traps `SIGTERM` and `SIGINT` from the OS. It passes these signals to its children to ensure SQLite Write-Ahead Logs (WAL) are flushed gracefully before exit.

## 3. Crash Telemetry & GitHub Integration
If any child process (Node.js or `ordo-daemon`) exits with a non-zero code (e.g., an OOM panic):
1.  The supervisor scrapes the final 100 lines of the child's `stderr` buffer.
2.  **Strict Redaction:** It executes a bulletproof regex redactor to strip any environment variables, PII, or API keys (specifically `ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY`).
3.  **Reporting:** It automatically posts the deduplicated crash signature to the project's GitHub Issues via the GitHub API.
4.  **Fail-Fast:** The supervisor then intentionally exits with a fatal code, forcing Docker to restart the entire appliance.

## 4. Mutual Watchdog (Heartbeat)
Event loop deadlocks in Node.js or thread panics in Rust might not trigger an OS-level process exit.
*   **Node.js checking Rust:** Node.js implements a lightweight internal fetch to the Rust daemon's `GET /health` endpoint. If it fails 3 consecutive times (e.g., 5-second intervals), Node.js calls `process.exit(1)`.
*   **Rust checking Node.js:** The Rust daemon pings `GET /api/health`. If Node.js is deadlocked and cannot respond, Rust logs the deadlock and panics.
*   **Result:** The supervisor detects the exit and crashes the container, auto-recovering the appliance.
