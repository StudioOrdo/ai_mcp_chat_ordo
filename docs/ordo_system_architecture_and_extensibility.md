# Ordo System Architecture & Extensibility Guide

This document synthesizes our entire architectural research into the Ordo system. It covers the core operating features discovered, deep dives into the Model Context Protocol (MCP) and Capability Catalog, and provides a guide on how to extend the platform.

---

## Part 1: Core System Features Discovered

The Ordo application is not a standard SaaS web app; it is a **Sovereign Web Node** designed as a localized AI operating system for a single user or "solopreneur".

### 1. The Front-Page "Viewport Stage"
The front page operates as a full-screen, non-scrolling app environment rather than a web page. The primary interface is the `ChatSurface`, which dynamically morphs into an embedded command-line interface or a floating global copilot depending on the user's route.

### 2. Generative UI (Plugins & Tools)
The chat interface doesn't just stream markdown. It uses a `ToolPluginRegistryProvider` to intercept AI tool calls (like `generate_chart` or `get_my_profile`) and render them as interactive React components (`CapabilityCardKind`). The UI is generated dynamically based on the AI's intent.

### 3. Enterprise RAG & Librarian Agent
The knowledge base (`docs/_corpus`) is managed by a hybrid search engine combining **BM25 (keyword)**, **Vector (semantic)**, and **Reciprocal Rank Fusion (RRF)**. Remarkably, the AI itself is the "Librarian"—it has tools to surgically modify, add, or delete files from the corpus, automatically syncing the SQLite vector store in the process.

### 4. Embedded SQLite & Data Mappers
The app rejects heavy ORMs and remote databases in favor of an embedded, hyper-optimized `better-sqlite3` instance configured with Write-Ahead Logging (WAL). It utilizes a strict Data Mapper / Repository pattern (`RepositoryFactory.ts`) to cleanly separate SQL from business logic.

### 5. Single-Tenant Role Simulation
Auth is built around strict roles (`ADMIN`, `STAFF`, `ANONYMOUS`). It features a unique `setMockSession` capability that allows the owner to hot-swap their security context (e.g., viewing the site as a public guest) without terminating their master session.

### 6. Event-Sourced FFmpeg Jobs
The app handles server-side media composition natively. The AI can author `MediaCompositionPlan`s containing video, audio, and burned-in subtitles. These plans are executed by a robust, event-sourced deferred background job engine (`src/lib/jobs`), which streams progress bars directly into the chat viewport.

---

## Part 2: Deep Dive: The Capability Catalog & Execution Modes

The beating heart of the Ordo AI is the **Capability Catalog** (`src/core/capability-catalog/capability-definition.ts`). Rather than hardcoding LLM function calling schemas into prompt files, Ordo uses a centralized registry of "Facets" to define every tool in the system.

### The Facet Architecture
A `CapabilityDefinition` is composed of several facets:
- **`core`**: The unique name, LLM description, and required RBAC roles.
- **`schema`**: The strict JSON Schema for the tool's inputs.
- **`presentation`**: How the tool renders in the chat UI (e.g., `cardKind`, `family`).
- **`executorBinding`**: Where and how the tool actually runs.
- **`localExecutionTargets`**: Instructions for routing the tool to background processes or sidecars.

### Execution Modes
Because Ordo is an operating system, an AI tool isn't just a synchronous API fetch. Tools are governed by **Execution Modes**:

1. **`inline`**: The standard mode. The AI calls the tool, the server executes it synchronously in the Next.js process, and the result is returned immediately to the LLM.
2. **`deferred`**: Used for heavy tasks (like FFmpeg video generation or massive DB queries). The tool call enqueues a job into the SQLite queue, returns an immediate "job started" receipt to the AI, and the background worker takes over. The UI polls the job status via server-sent events.
3. **`browser`**: The tool executes *client-side* inside the user's browser (e.g., manipulating the DOM, inspecting local state) rather than on the server.
4. **`hybrid`**: The tool starts inline to validate context, but hands off the heavy lifting to a deferred background job.

---

## Part 3: Deep Dive: Model Context Protocol (MCP)

Ordo does not just consume AI APIs; it acts as an **MCP Host and an MCP Server**.

### 1. The MCP Export Layer
Through the `CapabilityMcpExportFacet` (`mcpExport: { exportable: true }`), Ordo can export its own internal tools (like the Librarian search, SQLite access, or Admin intelligence) into a standard MCP JSON schema. This means external AI agents, local LLMs running on your desktop, or third-party clients can connect to Ordo and utilize your localized toolchain.

### 2. The MCP Stdio Adapter
Ordo includes a `McpProcessSessionPool` (`src/lib/capabilities/mcp-process-runtime.ts`) and a `StdioClientTransport`. This allows the Ordo Next.js app to spawn localized binary processes (e.g., a fast Rust daemon, an Anthropic sidecar, or Python scripts) and communicate with them over standard input/output using the MCP protocol.

### Why this matters
You have decoupled the *Tools* from the *LLM*. The capabilities live in the Ordo Catalog. Any AI (cloud-based or local) can connect to the Ordo environment via MCP and execute those tools securely.

---

## Part 4: How to Extend Ordo

Adding a new feature or AI capability to Ordo requires a systematic approach due to the strict architectural boundaries. Here is the step-by-step guide to extending the system.

### Step 1: Define the Capability Schema
Add a new object to a family file in `src/core/capability-catalog/families/` (e.g., `admin-capabilities.ts`).
You must define the `core` metadata, the JSON `schema`, the `presentation` card kind, and specify its roles.

```typescript
export const MY_NEW_TOOL = {
  core: { name: "my_new_tool", label: "Do Something", description: "...", roles: ["ADMIN"] },
  schema: { inputSchema: { type: "object", properties: { ... } } },
  presentation: { family: "system", cardKind: "fallback", executionMode: "inline" },
  executorBinding: { bundleId: "admin", executorId: "my_new_tool", executionSurface: "internal" },
  validationBinding: { validatorId: "my_new_tool", mode: "parse" }
}
```

### Step 2: Build the Interactor / Logic
Write the actual business logic inside `src/core/use-cases/tools/`. 
If your tool requires database access, it must interact with a Data Mapper (Repository) injected from `src/adapters/RepositoryFactory.ts`. **Do not write raw SQL inside the tool layer.**

### Step 3: Bind the Runtime Executor
Register your new tool in `src/core/capability-catalog/runtime-tool-binding.ts` under the `RUNTIME_BINDINGS` object. 
You must provide two things:
1. `parse`: A Zod parser or sanitization function to validate the LLM's raw JSON input.
2. `createExecutor`: A factory function that receives `CatalogToolBindingDeps` (your repositories) and returns the asynchronous function that executes your business logic.

### Step 4: Build the Generative UI (Optional)
If your tool needs a custom visual representation (instead of the generic `fallback` terminal output), build a React component in `src/frameworks/ui/chat/plugins/custom/`.
Then, map your tool's `cardKind` to your new React component inside `src/frameworks/ui/chat/registry/default-tool-registry.ts`.

### Step 5: Assign Execution Targets (Optional)
If your tool takes 5 minutes to run, change the execution mode to `deferred`. If your tool needs to run in a Python sidecar, configure the `localExecutionTargets.mcpStdio` facet in your Capability Definition to tell Ordo to route the execution to your custom binary via MCP.
