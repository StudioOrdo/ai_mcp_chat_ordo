# Development Workflow: The Four-Phase Protocol

## Overview

To ensure the reliability and predictability of an agentic system, we follow a rigorous four-phase development protocol. This method separates the planning and specification stages from implementation and verification, minimizing architectural drift and ensuring high-fidelity delivery.

---

## The Four Phases of Development

### Phase I: Specification (`spec.md`)
**Objective**: Define requirements and constraints.
Every feature begins with a formal specification. The `spec.md` outlines the problem, the business logic, the architectural impact, and the testing strategy. No implementation begins until the specification is finalized.

### Phase II: Engineering Blueprint (`sprint-N.md`)
**Objective**: Calibration and technical planning.
The blueprint transforms the specification into an actionable execution path for an agent or developer. It identifies relevant existing assets (entities, services, hooks) and defines the exact tasks required to complete the feature. Every task is coupled with a verification step.

### Phase III: Implementation
**Objective**: Execution of the blueprint.
Development follows the blueprint's task list sequentially. During this phase, the primary focus is on implementing the defined logic and verifying each step with unit or integration tests. If structural roadblocks are encountered, the blueprint is updated before proceeding.

### Phase IV: Quality Assurance (QA)
**Objective**: Verification of integrity.
The final phase involves a programmatic audit of the implementation. We use the **Evaluation Engine** (see [Ch. 9](ch09-the-evaluation-engine.md)) to execute deterministic integrity checks and reasoning scenarios. This phase ensures that:
*   The implementation matches the original specification.
*   Security and RBAC boundaries remain intact.
*   The new functionality does not introduce regressions into existing system capacities.

---

## Professional Alignment: The Owner-Developer Contract

For a **business owner** hiring a **developer**, the Four-Phase Protocol acts as a formal bridge of communication and trust. It ensures that custom tools are built to exact requirements and verified before deployment.

### 1. The Specification as a Business Contract
Stage 1 (Spec) ensures that the developer and owner are in perfect alignment on the **"What"** and **"Why"** of a new tool. It eliminates the "black box" syndrome by making requirements and success metrics explicit before any code is written.

### 2. Implementation with Guardrails
Stage 3 (Implementation) within a "clean" environment ensures that custom work doesn't degrade the existing system. The owner can be confident that the new tool is isolated and governed by existing RBAC and architectural standards.

### 3. Proof of Value via Automated QA
Stage 4 (QA) provides the owner with **verifiable proof** that the tool works as intended. Instead of a developer saying "it's done," the system generates **Release Evidence** (see [Ch. 9](ch09-testing-and-evaluations.md)) that documents the tool's performance and integrity.

---

## Continuous Integrity

By prioritizing planning and automated verification, the platform maintains a high standard of quality across the entire development lifecycle. This protocol transforms the often stochastic nature of AI-assisted development into a deterministic and manageable engineering process.

**Summary**: The Four-Phase Protocol is the standard for building on this platform. It provides a structured framework for innovation while ensuring that every addition meets the system's requirements for security, stability, and interoperability.
