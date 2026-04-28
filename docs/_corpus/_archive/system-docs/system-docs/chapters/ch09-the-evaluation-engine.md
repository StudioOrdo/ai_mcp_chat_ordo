# Testing and Evaluations: Ensuring System Integrity

## Overview

Reliability in an agentic system is maintained through continuous, programmatic evaluation. The platform includes a comprehensive evaluation engine designed to verify reasoning quality, security boundaries, and overall system health automatically.

---

## Evaluation Infrastructure

The evaluation suite (located in `src/lib/evals/`) provides the tools necessary to audit the system's behavior across multiple dimensions.

### 1. Evaluation Runner (`runner.ts`)
The runner is the core orchestrator for programmatic tests. It simulates end-to-end user sessions in a controlled environment, capturing full conversational traces, tool execution logs, and retrieval signals for automated analysis.

### 2. Continuous Integrity Checks
The system performs deterministic audits of core architectural guardrails:
*   **Security Boundary Verification**: Automates tests to ensure RBAC rules are strictly enforced (e.g., verifying that a guest user cannot access admin-only tools).
*   **Capability Convergence**: Checks that all tools defined in the catalog are correctly bound to their runtime executors and available in the internal registry.
*   **Retrieval Fidelity**: Audits the search engine's performance against historical benchmarks to ensure consistent groundedness.

### 3. reasoning and Behavioral Scenarios
The system uses "scenarios" (`scenarios.ts`) to grade the agent's performance in complex situations:
*   **Information Synthesis**: Verifies if the agent can correctly synthesize an answer from multiple retrieved documents without hallucination.
*   **Error Recovery**: Tests how the agent handles tool failures or ambiguous user requests.
*   **Role Consistency**: Ensures the agent maintains the appropriate tone and behavioral constraints for its assigned role.

---

## Release Evidence and Quality Gates

Every major release requires the generation of **Release Evidence** (`release-evidence.ts`). This is a structured report that serves as the final quality gate:
*   **Performance Metrics**: Latency, token usage, and search relevance scores.
*   **Security Audits**: Pass/fail results for critical RBAC and isolation checks.
*   **Compliance Verification**: Ensures the codebase follows the defined architectural standards (Clean Architecture, registry-based tools).

---

## Developer Responsibility

Verification is an integral part of the development lifecycle. Developers are expected to:
1.  **Add Scenarios**: When implementing new features, creators must add corresponding test scenarios to `scenarios.ts`.
2.  **Run Evaluations**: Before submitting changes, the `npm run eval` command must be executed to ensure no regressions have been introduced.
3.  **Review Evidence**: The generated release evidence must be reviewed to ensure the system remains within performance and safety baselines.

**Summary**: The evaluation engine transforms system quality from a subjective assessment into a measurable engineering metric. By integrating automated evaluations into the development workflow, the platform ensures that it remains secure, reliable, and contextually accurate.
