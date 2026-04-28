# System Architecture: Layers, Footprint, and Containerization

## Architectural Framework

Studio Ordo is designed with a focus on modularity, isolation, security, and a deliberately small operational footprint. It can be containerized for consistency and isolation, but its core architecture is intentionally compact enough to avoid the service sprawl common in AI applications.

### 1. Clean Architecture Patterns

We maintain architectural integrity by separating domain logic from orchestration, storage, and delivery.

* **Core Layer (`src/core`)**: The central domain logic. Contains entities, use-cases, and port interfaces. This layer is independent of any external frameworks.
* **Adapter Layer (`src/adapters`)**: Concrete implementations of repositories, data mappers, local vector stores, and provider bindings.
* **Application/Orchestration Layer (`src/lib`)**: Composition roots, search pipelines, admin loaders, chat runtime orchestration, and cross-cutting policy.
* **Presentation Layer (`src/frameworks`, `src/app`, `src/components`)**: The user interface and delivery mechanism. Contains React components, Next.js routes, and platform-specific hooks.

### 2. Core Data Models

The system operates on a structured set of entities that define the state of the platform:

* **Conversation**: The primary container for session history and lineage.
* **Message**: The fundamental unit of interaction, consisting of typed parts (Text, ToolCall, ToolResult).
* **Job**: A record of asynchronous operations, including progress, results, and retry policies.
* **Capability**: A formal definition of a system power, including its schemas, presentation metadata, and execution bindings.

### 3. Application Stack

* **Frontend/API**: Next.js 16 + React 19 + TypeScript.
* **Styling**: Vanilla CSS + Tailwind CSS 4.
* **Persistence**: SQLite via `better-sqlite3`.

### 4. Small-Footprint Systems Design

Studio Ordo is intentionally built to collapse several traditionally separate services into one deployable unit.

* **Transactional State**: SQLite stores conversations, jobs, prompts, preferences, and workflow records.
* **Deferred Work**: The background job system is stored and coordinated inside the same application/runtime footprint rather than depending on a separate queue service.
* **Search and Retrieval**: BM25 indexes and vector search are hosted locally rather than requiring an external search cluster or vector database server.

This design choice trades some horizontal-scale headroom for radically simpler deployment, lower cost, and easier self-hosting.

### 5. Integration Layers

* **Reasoning**: Integrated with Large Language Models (e.g., Anthropic, OpenAI) for core inference.
* **Retrieval**: A local engine supporting hybrid search (Vector + BM25) and RRF fusion.
* **Interoperability**: MCP serves as a standardized export boundary for selected capabilities. Additional protocols can be layered beside it without displacing the internal governed runtime.

## Why This Footprint Matters

In a more traditional AI application stack, the same product shape might require several separately managed services:

* a web application runtime
* a database server
* a queue broker and worker fleet
* a search service
* a vector database

Studio Ordo deliberately compresses those responsibilities into one governed system. The result is not infinite scale; the result is dramatically simpler deployment, lower operating cost, and a hosting model that a solo operator can realistically own.

This is one of the system's primary product advantages, not just a technical convenience.

---

## The Persistence Manifold

The system manages data durability through a rigorous **Persistence Manifold** that separates domain entities from the underlying database technology.

### 1. The Repository Factory (`RepositoryFactory.ts`)

We utilize the **Service Locator pattern** for the adapter/application boundary. The `RepositoryFactory` provides a centralized point for accessing stateful stores. To ensure performance and resource efficiency, it utilizes a **Process-Cached Singleton** pattern—lazy-loading repositories on first access and maintaining them for the lifetime of the process.

### 2. Data Mappers and structured storage

Individual repositories are implemented as **Data Mappers**. These components transform pure domain entities into the relational structures required by **SQLite** (via `better-sqlite3`). This ensures that the domain layer remains "ignorant" of database constraints like primary keys or JSON serialization of message parts.

### 3. Unified Semantic Storage (`SQLiteVectorStore.ts`)

Semantic memory is managed through a specialized **SQLite Vector Store**. This component extends the standard relational model to include high-dimensional embeddings, allowing for unified queries that combine structural metadata with semantic similarity.

### 4. Persistence Policy Recap

* **Structured Storage**: SQLite for conversations, messages, jobs, prompts, and system state.
* **Vector Storage**: Local SQLite-backed storage for corpus and session embeddings.
* **Lifecycle**: Auto-initialized singletons with shared connection management.

## System Orchestration and Composition

The platform utilizes a structured orchestration layer to manage the lifecycle and execution of agentic capabilities.

### 1. The Composition Root (`tool-composition-root.ts`)

We utilize the **Composition Root pattern** to centralize the instantiation and wiring of the system's core components. This module is responsible for:

* Initializng the `ToolRegistry` with all permitted capability bundles.
* Configuring the `HookPipeline` with global middlewares (Logging, RBAC, etc.).
* Exporting the `getToolComposition()` singleton, ensuring that throughout a single runtime, the same governed registry and executor are utilized.

### 2. The Tool Registry (`ToolRegistry.ts`)

The `ToolRegistry` serves as the primary repository for all system powers. It manages:

* **Descriptor Storage**: A map of all registered `ToolDescriptor` objects, including their schemas and roles.
* **Access Control**: A centralized check (`canExecute`) that gates tool usage based on the user's role before any execution logic is triggered.
* **Bundle Management**: Grouping tools into logical bundles for bulk registration and selective enablement.

### 3. The Middleware Hook Pipeline

Cross-cutting concerns are handled via a **Hook Pipeline** (`ToolMiddleware.ts`). Every tool execution passes through a series of hooks that can intercept, modify, or block the request:

* **Inbound Claiming**: Resolving session context and user identity.
* **Pre-Execution**: Validating schemas and checking RBAC permissions.
* **Post-Execution**: Formatting results and persisting metrics.

### 4. The Execution Context (`ToolExecutionContext`)

To maintain the "pure" nature of the core layer, all stateful information is passed through the `ToolExecutionContext`. This object carries the user's roles, the session ID, and the `userId` through every layer of the architecture, ensuring that infrastructure-level decisions (like search filtering or database access) are always identity-aware.

## Containerization and Environment

The system is deployed as a containerized environment to ensure security and auditability.

### Multi-Stage Build Pipeline

1. **Dependencies**: Resolution of all system and project dependencies.
2. **Builder**: Compilation and optimization of the production bundle.
3. **Runner**: The final runtime environment, stripped of build-chain tools to minimize the attack surface.

### Runtime Guardrails

* **Least Privilege**: The process operates as a restricted system user with no root access.
* **Immutable Filesystem**: The container runs with a read-only root filesystem. Global state changes are prohibited; persistence is limited to a strictly defined volume (`/.data`).
* **Capability Stripping**: Unnecessary Linux kernel capabilities are removed to ensure host isolation.

**Summary**: The architecture prioritizes security through isolation, maintainability through separation of concerns, and ease of hosting through deliberate system consolidation. By leveraging multi-stage builds and strict runtime policies, Studio Ordo provides a production-grade environment without requiring a production-grade service sprawl.
