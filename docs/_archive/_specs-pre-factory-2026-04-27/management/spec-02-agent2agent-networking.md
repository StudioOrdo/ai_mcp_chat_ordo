# Specification 02: Agent2Agent (A2A) Networking & Marketplaces

## 1. Goal
To allow distinct Sovereign Ordo Nodes to discover one another, authenticate securely, and execute MCP capabilities across network boundaries, forming a decentralized marketplace.

## 2. Core Architecture

### 2.1 The Root Directory (Discovery)
Establish a protocol for Ordo nodes to register themselves with a Root Directory Node.
-   Nodes broadcast their public-facing `mcpExport` capabilities to the registry.
-   Other nodes can query the directory (e.g., "Find me an available UI designer node").

### 2.2 Secure MCP over HTTPS/WSS
-   Upgrade the MCP transport layer to support secure remote connections (HTTPS or WebSockets) between nodes, rather than just local `stdio`.

### 2.3 Cryptographic Trust Model
-   Implement mutual authentication (e.g., mTLS or cryptographic signed JWTs) to verify node identities during handshakes.
-   Public tools (like `request_quote`) can be called by any authenticated node. Private tools (like `admin_search`) are strictly blocked via RBAC.

## 3. User Interface
-   **Marketplace Hub**: A UI where the Ordo owner can search the Root Directory for services.
-   **Connection Ledger**: A dashboard showing all active A2A connections and a log of remote tool executions for auditing.

## 4. Test Cases
1.  **Authentication**: Node A requests an execution on Node B. Node B successfully validates Node A's cryptographic signature.
2.  **Execution Isolation**: Node A successfully executes a public `submit_lead` tool on Node B, but is rejected with a `403 Forbidden` when attempting to call `admin_web_search`.
