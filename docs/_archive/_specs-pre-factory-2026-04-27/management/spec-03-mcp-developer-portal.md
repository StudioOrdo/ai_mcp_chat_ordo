# Specification 03: MCP Developer Portal

## 1. Goal
To foster a third-party ecosystem by providing a built-in, public-facing developer portal containing documentation, standard schemas, and a testing sandbox for MCP tool creators.

## 2. Core Architecture

### 2.1 Dynamic Documentation Generator
-   Create a script or dynamic Next.js route (`/developers/docs`) that introspects the live `CAPABILITY_CATALOG`.
-   Automatically generate markdown/HTML documentation for every exported MCP tool, including its `inputSchema` and `outputHint`.

### 2.2 The Sandbox Environment
-   Build an isolated execution context (`SandboxExecutionContext`) that allows developers to submit payloads via the web UI.
-   The sandbox intercepts the tool execution, mocks the database layers, and returns the shape of the capability response without mutating production data.

## 3. User Interface
-   **API Reference**: Clean, Redoc-style UI for browsing MCP schemas.
-   **Developer Dashboard**: An authenticated zone where developers can generate API test tokens to use the Ordo instance as an MCP Host during local sidecar development.

## 4. Test Cases
1.  **Doc Parity**: Adding a new property to a tool's `inputSchema` immediately reflects on the `/developers/docs` route without manual documentation updates.
2.  **Sandbox Safety**: Executing a mock `librarian_add_document` in the sandbox returns success but does not write to the actual SQLite `_corpus` directory.
