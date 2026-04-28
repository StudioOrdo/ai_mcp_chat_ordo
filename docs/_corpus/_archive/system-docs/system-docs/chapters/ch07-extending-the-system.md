# Extending the System: The Development Protocol

## Overview

The platform is designed to be highly extensible. Adding new features or capabilities follows a standardized development protocol to ensure that every addition is governed by the system's core architecture and security models.

---

## Extension Workflow

Adding a new capability to the platform follows a five-stage process:

### Stage 1: Capability Definition
Every new feature must be declared in the **Capability Catalog** (`src/core/capability-catalog/`).
1.  **Create a Family**: Group related capabilities into a "family" file in the `families/` directory.
2.  **Define Metadata**: Specify the `core` identity (name, label, category) and the `schema` (JSON Schema) for input validation.
3.  **Register**: Include the new family in the primary `catalog.ts` file.

### Stage 2: Domain Logic Implementation
To maintain the "shared logic" principle, implement the core functionality in a decoupled module.
*   **Location**: `src/lib/capabilities/shared/`
*   **Requirements**: Implement pure, testable functions that handle the domain task. This ensures the same logic can be exposed via the internal registry, browser workers, or external MCP sidecars.

### Stage 3: Execution Binding
Bind the capability to an execution surface based on its performance and security requirements:
*   **Internal**: Executed directly in the Node.js process.
*   **Browser**: Executed in a client-side Web Worker or WASM environment.
*   **MCP Sidecar**: Executed in an isolated process via the Model Context Protocol.

For multi-step or multi-agent workflows, the preferred binding is usually a **Deferred Job** rather than a synchronous tool call. This keeps orchestration observable, retryable, and auditable.

### Stage 4: UI Presentation
Define how the tool's result is projected into the user interface:
1.  **Card Kind**: Select a display template (e.g., `artifact_viewer`, `fallback`).
2.  **Surface**: specify the target surface (e.g., `conversation` or a sidepanel).
3.  **Execution Mode**: Define if the tool runs `inline` (interactive) or `deferred` (background).

### Stage 5: MCP Export
If the capability should be available to external clients, set the `mcpExport` flag in the catalog definition. The platform will automatically project the tool's schema into the MCP transport layer.

If future external protocols are added, apply the same principle: export shared workflow logic through protocol adapters at the boundary rather than moving the core business logic into the protocol layer itself.

---

## Technical Extension Points

For advanced developers, the platform provides several hook-points for deep customization.

### 1. UI Presentation Registry (`capability-presentation-registry.ts`)
To add a custom React component for a specific tool result:
*   Define a unique `cardKind` in the registry types.
*   Implement a **Tool Result Component** that accepts the tool's raw output.
*   Register the mapping in the `capabilityPresentationRegistry`, coupling the `cardKind` to your React component. This allows the system to perform a "blind dispatch" where the UI library resolves the renderer based on the tool's metadata.

### 2. Browser Runtime Bindings
Specialized capabilities (like Mermaid rendering or local data analysis) can be bound to the **Browser Runtime**:
*   **Web Workers**: Use the `browser` facet in the catalog to specify a script path. The system will offload the execution to a background worker to prevent UI thread blocking.
*   **WASM Modules**: The platform supports cross-boundary WASM execution for high-performance compute tasks. Bind your handler to the browser surface and initialize the module within the worker context.

### 3. Custom Execution Middlewares
You can extend the system's cross-cutting behavior by implementing `ToolExecutionHook`:
*   Create a class that implements `execute` or `onInboundClaim`.
*   Register the middleware in the `tool-composition-root.ts`.
*   This is the standard approach for adding system-wide features like **Caching**, **Rate Limiting**, or **Complex Auditing**.

### 4. Multi-Agent Workflow Design
When extending the system with multiple cooperating agents, model them as staged workflow responsibilities rather than free-floating personalities.
*   Put the orchestration contract in shared logic.
*   Represent long-running execution as a deferred job.
*   Emit explicit stage events, artifacts, and checkpoints.
*   Expose the resulting workflow through first-party tools and external protocols only after the internal contract is stable.

---

## Technical Checklist

Before finalizing an extension, verify the following:
*   [ ] Does the input schema strictly validate all arguments?
*   [ ] Is the logic residency in the `shared/` manifold for dual-surface accessibility?
*   [ ] Have the appropriate RBAC roles been assigned in the catalog definition?
*   [ ] Does the UI presentation follow the platform's architectural standards?
*   [ ] If the capability is multi-step, is it better modeled as a deferred job with explicit stage boundaries?

**Summary**: By following the development protocol, you can ensure that new features are integrated seamlessly into Studio Ordo's security, operational, and interoperability framework.
