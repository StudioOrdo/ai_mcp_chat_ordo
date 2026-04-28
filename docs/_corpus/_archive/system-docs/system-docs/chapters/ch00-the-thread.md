# Introduction: Studio Ordo Operational Guidelines

## Overview

This documentation serves as the canonical technical specification for Studio Ordo. It defines the architectural principles, security models, and operational workflows required to deploy and maintain the system as a governed, agent-native operator environment.

## Design Principles

Studio Ordo is built on several core principles to ensure stability, security, extensibility, and a small operational footprint:

- **Clean Architecture**: Separation of domain logic from infrastructure and delivery mechanisms.
- **Identity-Based Security**: Strict Role-Based Access Control (RBAC) enforced at the middleware level.
- **Hybrid Retrieval**: A robust search engine combining semantic and lexical analysis for grounded inference.
- **Extensibility**: A multi-facet capability model that allows for the rapid integration of new tools and UI surfaces.
- **All-In-One Deployment**: Core product capabilities run in one compact application without requiring a separate database server, queue broker, search cluster, or vector database service.

### Asset Portability and Sovereignty

For the **business owner** (solopreneur), Studio Ordo is intended to be a high-fidelity software asset: a documented, portable command center rather than a black box SaaS dependency. Its architecture is designed so one operator can host, extend, and govern the system without inheriting the infrastructure burden of a larger distributed stack.

---

## Documentation Structure

This manual is organized into eleven chapters, covering the entire operational lifecycle of the system:

- **Ch. 01 — Platform Overview**: Key value pillars, solopreneur value, and system capacities.
- **Ch. 02 — System Architecture**: Layered architecture, data models, and containerization.
- **Ch. 03 — Security and RBAC**: The identity-based permission model and prompt assembly.
- **Ch. 04 — Capabilities and MCP**: The tool registry, deferred job system, MCP integration, and future protocol boundaries.
- **Ch. 05 — Getting Started**: Installation, prerequisites, and essential commands.
- **Ch. 06 — Development Workflow**: The four-phase lifecycle for AI-native development.
- **Ch. 07 — Extension Guide**: A developer's manual for adding new capabilities.
- **Ch. 08 — Retrieval Engine**: Technical details on hybrid search and session memory.
- **Ch. 09 — Testing and Evaluations**: Automated QA, integrity checks, and release evidence.
- **Ch. 10 — Data Lifecycle and Governance**: Compaction, retention, and audit governance.
- **Ch. 11 — Deferred Multi-Agent Workflows**: How heavier orchestrations should be modeled as governed background jobs.

---

## Intended Audience

- **Systems Architects**: Focus on **Architecture (Ch. 2)** and **Retrieval (Ch. 8)**.
- **Security Engineers**: Focus on **Security and RBAC (Ch. 3)**.
- **Developers**: Focus on **Extension (Ch. 7)** and **Workflow (Ch. 6)**.
- **Operators / Solopreneurs**: Focus on **Platform Overview (Ch. 1)** and **Getting Started (Ch. 5)**.
- **DevOps/SRE**: Focus on **Getting Started (Ch. 5)** and **Evaluations (Ch. 9)**.

**Conclusion**: Comprehensive documentation is essential for maintaining a reliable and secure agentic operator system. This book provides the roadmap for keeping Studio Ordo portable, governable, and easy to operate.
