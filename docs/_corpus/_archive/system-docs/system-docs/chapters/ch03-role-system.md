# Security and RBAC: Identity-Based Governance

## Overview

Security in the platform is built on the principle of **explicit permission**. Every action taken by an agent is governed by the authenticated role of the user, ensuring that the system operates within a strictly defined boundary.

## The Role Hierarchy

The environment supports a structured hierarchy of roles, each with a specific functional scope:

| Role | Purpose | Functional Scope |
| :--- | :--- | :--- |
| **Anonymous** | Guest access | Navigation and limited knowledge base search. |
| **Authenticated** | Registered user | Feature access, preference persistence, and session history. |
| **Apprentice** | Educational/Student | Standard features with enhanced learning-oriented directives. |
| **Staff** | Operator | Advanced operational tools and analytics access. |
| **Admin** | System Governor | Full control over content, configuration, and system oversight. |

---

## Technical Enforcement Mechanisms

Governance is enforced through a combination of middleware-level gates and dynamic instruction assembly.

### 1. RBAC Middleware (`RbacGuardMiddleware.ts`)
The system utilizes a `HookPipeline` to intercept tool execution. The `RbacGuardMiddleware` is the primary enforcer:
*   **Source Filtering**: Before a request is sent to the Large Language Model, the system filters the available tool descriptors based on the user's role.
*   **Runtime Prevention**: If an unauthorized tool call is attempted, the middleware throws an error before execution begins.

### 2. Dynamic Instruction Assembly (`assembleRoleDirective`)
System instructions (the system prompt) are dynamically composed based on the user's role.
*   **Role Framing**: Sets the behavioral tone and operational perspective for the agent.
*   **Capability Hints**: Injects specific directives for the tools available to that role.
*   **State-Aware Guidelines**: Adds runtime instructions based on active system states (e.g., job status reporting).

### 3. Retrieval Gating
Access to the knowledge base (the corpus) is also role-sensitive. The retrieval tools filter results based on document-level and section-level permissions, preventing sensitive information from being projected into unauthorized contexts.

**Summary**: The platform ensures security by making permission a structural invariant. By coupling execution and retrieval to verified identities, the system establishes a predictable and governed operating environment.
