# Capabilities, Deferred Work, and Protocol Boundaries

## The Multi-Facet Capability Model

Capabilities (tools) in Studio Ordo are defined by a structured, multi-faceted model. This ensures that every tool is predictable, testable, and properly projected into both the user interface and the Large Language Model context.

* **Core Metadata**: Identity, label, and organizational category.
* **Input Schema**: A strict JSON Schema definition for all input parameters.
* **Executor Binding**: Specifies the execution surface (Internal/Node.js, Browser/Worker, or MCP Sidecar).
* **Presentation Facet**: UI metadata including Card Kind, Execution Mode (inline/deferred), and target display surface.
* **Job Configuration**: Defines behavior for background processing, including retry policies and recovery modes.
* **Browser Runtime**: Metadata for client-side execution using Web Workers or WASM.
* **MCP Export**: Identifies if the capability is available through the Model Context Protocol transport layer.

The key architectural rule is that external protocols are **boundaries**, not the center of the system. Studio Ordo's internal governed runtime remains the source of truth for policy, RBAC, jobs, and provenance.

---

## Tool Execution Pathways

### 1. Synchronous Execution

Direct, in-memory execution within the Node.js main process or the user's browser. Used for high-speed, interactive operations where low latency is critical.

### 2. Asynchronous (Deferred) Job System

For operations with high latency or significant resource requirements, the system utilizes a background job queue.

1. **Enqueue**: The agent emits a tool call; the system validates the input and enqueues a `JobRequest`.
2. **Worker Processing**: A background worker claims the job, executes the bound handler, and reports progress.
3. **Completion**: Upon success or failure, the system emits a terminal event, updating the UI and notifying the user.
4. **Resilience**: The system supports automatic retries with exponential backoff for transient failures.

Deferred jobs are also the preferred substrate for future multi-stage and multi-agent workflows. Instead of treating multiple agents as invisible autonomous actors, Studio Ordo models heavy orchestration as observable jobs with explicit stages, artifacts, retries, and checkpoints.

---

## Model Context Protocol (MCP) Integration

Studio Ordo implements the **Model Context Protocol (MCP)** to facilitate standardized interoperability between the core runtime and external tools.

* **Server Orchestration**: MCP servers are defined as managed sidecars. The platform handles server lifecycle and stdio-based communication.
* **Canonical Export**: Core system capabilities can be marked as `mcpExport`. The platform's transport layer automatically projects these tools into the MCP schema format, making them available to external MCP-compliant clients.
* **Shared Logic Manifold**: To ensure consistency, all domain logic resides in `src/lib/capabilities/shared/`. This allows the same logic to serve internal tool calls and external MCP requests without duplication.

MCP should be understood as one boundary protocol. It does not replace the internal registry, job system, or policy layer.

## Future Protocol Boundaries

The architecture leaves room for additional interoperability standards, including future agent-to-agent transports. When those protocols are introduced, they should be layered beside MCP rather than replacing the internal capability model.

The recommended pattern is:

* define workflow logic in shared modules
* expose it through the internal registry for first-party use
* wrap it with deferred jobs when long-running orchestration is required
* project it into MCP or future external protocols only at the system boundary

## Multi-Agent Work As Deferred Jobs

When Studio Ordo grows into heavier multi-agent workflows, the preferred pattern is to model them as deferred jobs rather than as invisible synchronous tool calls.

That means:

* the user invokes one governed capability
* the system creates a job with a clear orchestration contract
* worker stages handle planning, research, drafting, review, or publishing responsibilities
* each stage emits explicit events, progress, artifacts, and retry boundaries

This keeps the workflow observable and governable. "Multiple agents" should therefore be understood as staged workflow roles inside the job model, not as free-floating personalities that bypass the system's operational controls.

**Summary**: Studio Ordo's capability model provides a unified framework for extending agentic power. By combining strict schemas with versatile execution surfaces, deferred workflow orchestration, and standardized boundary protocols, the system keeps new power governable rather than magical.
