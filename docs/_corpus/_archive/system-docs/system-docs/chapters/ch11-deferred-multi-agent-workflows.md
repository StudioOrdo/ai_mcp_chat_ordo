# Deferred Multi-Agent Workflows: Governed Orchestration

## Overview

Studio Ordo's preferred path for heavier orchestration is not a swarm of invisible autonomous agents. It is a governed deferred workflow built on the existing job system.

This chapter explains the architectural rule behind that choice: when a workflow becomes long-running, staged, or coordination-heavy, it should become a deferred job with explicit contracts, observable state, and bounded stage responsibilities.

---

## Why Use Deferred Jobs

Multi-agent workflows create the same operational concerns as any other long-running computation:

* partial progress
* retries and transient failure handling
* resumability
* artifact persistence
* operator visibility
* access control

Studio Ordo already has a substrate for those concerns in the deferred job model. Reusing that substrate is preferable to inventing a second orchestration runtime that bypasses the platform's existing controls.

---

## Core Rule

Multiple agents should be modeled as staged workflow responsibilities inside a governed job, not as free-floating personalities with opaque internal behavior.

Typical stages might include:

* planner
* researcher
* analyst
* drafter
* reviewer
* publisher

Those roles are useful as implementation boundaries, but the **job** remains the primary unit of system control.

---

## Recommended Architecture

### 1. Shared Workflow Logic

Put the orchestration contract in shared logic so it can be reused across surfaces and protocols.

The shared layer should define:

* the workflow input contract
* stage order and allowed transitions
* artifact formats
* retry semantics
* terminal success and failure states

### 2. First-Party Capability Wrapper

Expose the workflow through the internal registry as a normal governed capability. The user or operator should request one named capability, not manually manage several hidden agents.

### 3. Deferred Job Binding

Bind the workflow to the deferred job system when execution is long-running or stageful.

That job should emit:

* stage-start events
* stage-success and stage-failure events
* progress updates
* generated artifacts
* retry and recovery metadata

### 4. Protocol Projection at the Boundary

If the workflow is exposed through MCP or a future agent-to-agent protocol, project it outward only after the internal contract is stable.

The external protocol should wrap the workflow. It should not become the place where the core business logic lives.

---

## Operational Benefits

Modeling multi-agent work as deferred jobs gives Studio Ordo several advantages:

* **Visibility**: Operators can inspect the workflow in the jobs UI.
* **Governance**: RBAC and capability policy still apply at invocation time.
* **Resilience**: Retries and checkpoints happen inside the existing job lifecycle.
* **Auditability**: Artifacts and state changes can be rendered, stored, and reviewed.
* **Portability**: The same orchestration can later be exported through MCP or future A2A boundaries.

---

## What To Avoid

The system should avoid several common multi-agent mistakes:

* hiding stage behavior inside one large prompt with no explicit lifecycle
* scattering orchestration across chat code, MCP sidecars, and workers at the same time
* treating agent identities as product theater instead of using narrow task contracts
* bypassing the job system for workflows that clearly need resumability and progress reporting

If a workflow cannot be inspected, retried, or explained, it is not aligned with Studio Ordo's governed operator model.

---

## Product Interpretation

For the operator, this design means background AI work behaves like a governed teammate rather than a mysterious automation.

The system can take on heavier work in the background, but the operator still has:

* a visible job record
* clear stage progression
* durable artifacts
* failure signals
* the ability to intervene or re-run work

That is the difference between AI spectacle and AI operations.

**Summary**: Studio Ordo should treat multi-agent orchestration as deferred job-defined workflow execution. This keeps more powerful AI behavior inside the same operational model that already governs tools, jobs, RBAC, and evidence.
