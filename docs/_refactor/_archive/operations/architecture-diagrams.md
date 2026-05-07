# Architecture Diagrams

This page gives students a visual map of how the repository is organized and how work flows through it. Read this after the root README and the agentic delivery playbook.

## 1. Delivery Workflow

This is the core project loop for shipping changes without letting the model drift away from the problem.

```mermaid
flowchart LR
    A[Problem Statement] --> B[Read Real Code]
    B --> C[Spec]
    C --> D[Sprint Docs]
    D --> E[Implementation]
    E --> F[QA Pass]
    F --> G[Deterministic Verification]
    G --> H[Runtime Verification]
    H --> I[Docs Updated]
    I --> J[Next Sprint or Closeout]
```

Key lesson: the chat history is not the source of truth. The spec, sprint docs, tests, and verification results are.

## 2. Runtime Architecture

This is the main request path for the application.

```mermaid
flowchart TB
    U[Browser UI] --> N[Next.js Routes and App Shell]
    N --> P[Chat Policy and Request Validation]
    P --> R[Tool Registry]
    R --> C[Core Use Cases]
    C --> A[Adapters and Repositories]
    A --> D[(SQLite and File System)]
    R --> M[MCP Tool Servers]
    R --> W[OpenAI or Anthropic Providers]
    A --> X[Corpus and Search Indexes]
```

Key lesson: MCP is one boundary inside the system, not the whole system. Policy, RBAC, validation, and storage still matter.

## 3. Tool Orchestration Model

The model does not call arbitrary code. It works through a constrained registry and explicit tool contracts.

```mermaid
sequenceDiagram
    participant User
    participant UI as Browser UI
    participant Route as Chat Route
    participant Policy as Policy Builder
    participant LLM as LLM
    participant Registry as Tool Registry
    participant Tool as Tool Command or MCP Server

    User->>UI: Ask question
    UI->>Route: Send message
    Route->>Policy: Build system prompt and role context
    Policy-->>Route: Prompt plus tool scope
    Route->>LLM: Prompt, history, tool schemas
    LLM->>Registry: Request tool call
    Registry->>Tool: Execute validated tool input
    Tool-->>Registry: Deterministic result
    Registry-->>LLM: Tool result
    LLM-->>Route: Final answer
    Route-->>UI: Stream response
```

Key lesson: tool orchestration is useful only when the tools are constrained, typed, and testable.

## 4. Docs Map

Use the docs tree by intent:

- `docs/_specs/`: feature contracts and sprint plans
- `docs/_refactor/`: multi-file remediation programs for known defects or integrity issues
- `docs/operations/`: workflow, runtime, and operational guidance
- `docs/_reference/`: external notes that inform work but do not define product behavior
- `docs/_corpus/`: content and corpus material used by the application

## Suggested Reading Order

1. `README.md`
2. `agentic-delivery-playbook.md`
3. `architecture-diagrams.md`
4. `../_specs/README.md`
5. one completed or active feature spec plus its sprint docs