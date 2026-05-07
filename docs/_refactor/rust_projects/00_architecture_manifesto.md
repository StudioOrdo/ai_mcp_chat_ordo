# Architecture Manifesto: The Sovereign Appliance

**Audience:** Implementation AI Agent
**Context:** This document is the ultimate source of truth for the Rust integration into OrdoSite. It defines the constraints, the philosophy, and the macro-architecture required to build a high-performance, AGPL-licensed "Sovereign Appliance."

## 1. The Constraints
OrdoSite is not a typical cloud-native web application. It is an appliance designed to run locally, offline, and privately.
*   **The Memory Limit:** The entire stack (Node.js, SQLite, Rust, Vector Embeddings) must run within a strict 2GB Docker container limit.
*   **The Single Image:** For simplicity of distribution, there is only one Docker image.
*   **Data Sovereignty:** No heavy external cloud dependencies (e.g., Pinecone, Datadog, RabbitMQ). Everything must run locally.

## 2. The Rust Boundary
We utilize the "Strangler Fig" pattern to maintain the speed of TypeScript for business logic, while strictly offloading computationally dangerous tasks to Rust.

**Rust is mandated for:**
1.  **Memory-Intensive Processes:** V8/Node.js suffers severe memory fragmentation during large binary operations. FFmpeg media composition, ElevenLabs audio streaming, and ONNX model inference must execute in Rust to prevent OOM crashes.
2.  **Concurrency-Heavy Processes:** Long-lived WebSocket connections (Pub/Sub) block the Node.js event loop. They must be managed by Tokio in Rust.
3.  **Process Supervision:** Managing child processes and guaranteeing SQLite database integrity during abrupt shutdowns requires system-level control.

**TypeScript (Next.js) is mandated for:**
1.  **UI & Governance:** React Server Components, Read Models, and UI rendering.
2.  **Business Rules:** Enqueueing jobs, verifying access control, and defining data schemas via Zod.

## 3. The Unified Daemon Architecture
Because of the 2GB constraint and to prevent `SQLITE_BUSY` contention, we will **not** build 5 separate Rust microservices.

*   There will be exactly **one** monolithic Rust binary: `ordo-daemon`.
*   This single binary will share a highly optimized SQLite connection pool.
*   Internally, `ordo-daemon` will spawn separate Tokio tasks for the Pub/Sub Broker, the Job Execution Engine, the Backup System, and the RAG/Vector Search API.

## 4. The Engineering Standards
Every line of Rust code must adhere to:
*   **Clean Architecture:** Strict separation between Domain (Entities), Use Cases (Interactors), and Interface Adapters (SQLite/HTTP).
*   **SOLID Principles:** Dependency Inversion (relying on Traits, not concrete structs) and Single Responsibility.
*   **GoF Patterns:** Strategy pattern for job execution, Template Method for the core engine loops, and Observer for Pub/Sub events.
