# Agentic Delivery Playbook

This document explains how this repository turns LLM assistance into a controlled engineering workflow. It is written for students, instructors, and future contributors who need a practical method for shipping real changes without accepting hallucinated or weakly verified work.

## Why This Playbook Exists

LLMs are useful, but they fail in repeatable ways:

- they invent files, APIs, or behaviors
- they silently expand scope
- they lose important constraints in long conversations
- they mistake passing structural tests for working software
- they produce plausible explanations that are not grounded in the codebase

The workflow in this repository exists to counter those problems with explicit artifacts and deterministic checks.

## Core Principle

The model is allowed to accelerate discovery, drafting, implementation, and QA. It is not allowed to replace source-of-truth artifacts, runtime verification, or engineering judgment.

## The Delivery Loop

### 1. Clarify the problem

Start with a concrete problem statement, not a vague aspiration.

Good:

- the homepage chat should keep the composer pinned while only the message list scrolls
- admin-only web search should return citations and stay hidden from anonymous users

Weak:

- improve the UI
- make the chat smarter

### 2. Read the real code first

Before writing a spec or sprint doc:

- inspect the relevant files
- verify actual function signatures and import paths
- identify the existing tests, scripts, and runtime constraints

This is the first defense against hallucination.

### 3. Write or update the spec

The spec defines the contract:

- what problem is being solved
- what constraints matter
- what architecture and boundaries apply
- what testing strategy is required
- what future work is intentionally out of scope

The spec is the source of truth for the feature. It should not contain guessed APIs or imagined file structures.

### 4. Break the work into sprints

Each sprint should be small enough that an implementing agent can finish it with high confidence.

A good sprint doc includes:

- specific files to create or modify
- verified assets already in the repo
- numbered tasks
- concrete verification commands
- a completion checklist
- a QA deviations section

Why this matters:

- smaller chunks reduce context loss
- explicit tasks reduce drift
- verify steps make completion measurable

### 5. Implement one sprint at a time

Implementation should follow the sprint doc, not improvise around it.

Rules:

- do not add unrelated scope
- do not refactor adjacent code unless the sprint requires it
- do not assume a passing typecheck means the feature is correct
- run the verify command after each meaningful task

### 6. QA as a separate pass

QA is not the same as implementation. The QA pass should review the work against both the spec and the sprint doc.

The QA reviewer checks:

- signatures and imports are real
- the implementation actually satisfies the documented contract
- tests cover the promised scenarios
- no shortcuts weakened security, RBAC, or runtime boundaries
- the docs still match the system after the change

### 7. Verify live behavior when the user experience matters

UI work needs more than structural tests.

Examples of failure that can survive unit coverage:

- a scroll container with `overflow-y-auto` but no real height constraint
- a dialog that looks correct in jsdom but clips on mobile Safari
- a pinned composer that still gets pushed below the fold in the actual browser

For UI and interaction changes, runtime verification is mandatory.

### 8. Update the documentation immediately

After the implementation and QA pass:

- update the spec if the contract changed
- update sprint docs with completion notes or deviations
- move verification artifacts into the feature-owned folder
- refresh any top-level docs that students or future agents will read first

Good docs are not a postscript. They are part of context management.

## LLM Failure Modes And Countermeasures

### Hallucination

Risk:

- invented APIs
- fake file paths
- wrong assumptions about architecture

Countermeasures:

- read code before writing
- verify every referenced asset
- prefer targeted searches and real file reads over open-ended reasoning

### Drift

Risk:

- the agent gradually changes the task into a different task

Countermeasures:

- spec first
- sprint doc second
- explicit QA deviations instead of silent scope changes

### Context loss

Risk:

- important constraints disappear during long sessions

Countermeasures:

- small sprint docs
- ordered artifacts
- frequent updates to the source-of-truth docs
- deterministic verification commands recorded in the sprint doc

### False confidence

Risk:

- the agent reports success because tests passed, while the user-visible system is still wrong

Countermeasures:

- QA by a separate pass
- runtime verification for UX work
- compare the live system to the spec, not just to the code

### Over-trusting prose

Risk:

- long explanations sound correct but are not tied to executable evidence

Countermeasures:

- use tests, builds, lint, and targeted scripts as the final check
- treat prose as guidance and deterministic tools as proof

### Secret exposure

Risk:

- keys leak into docs, screenshots, logs, or commits

Countermeasures:

- never paste live secrets into documentation
- keep `.env` files local
- run `npm run scan:secrets`
- rotate exposed credentials immediately

## Deterministic Tooling In This Repo

These commands are the backbone of trustworthy agentic work:

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Type safety |
| `npm run lint:strict` | Zero-warning lint discipline |
| `npm run test` | Full regression suite |
| `npm run quality` | Typecheck + lint + test |
| `npm run browser:verify` | Browser-focused and homepage-shell verification |
| `npm run build` | Production build correctness |
| `npm run validate:env` | Environment validation |
| `npm run admin:health` | Liveness and readiness sweep |
| `npm run admin:diagnostics` | Runtime diagnostic snapshot |
| `npm run scan:secrets` | Secret leak detection |
| `npm run check:stateless` | Stateless runtime assertions |

Use these tools to reduce ambiguity. If a claim about the system cannot survive these checks, it is not ready.

## MCP In The Teaching Model

Students should treat MCP as a transport and orchestration boundary, not as magic.

In this repository:

- MCP servers expose tool capabilities over a protocol boundary
- extracted tool modules keep logic testable outside the transport layer
- application-level tool orchestration still needs RBAC, validation, and QA

The lesson is that MCP expands what an agent can do, but it does not remove the need for contracts and verification.

## Recommended Student Workflow

1. Read the root README.
2. Read this playbook.
3. Read [../_specs/README.md](../_specs/README.md).
4. Pick one feature spec and trace it through its sprint docs.
5. Study the tests associated with that feature.
6. Make one small change and verify it with deterministic commands.
7. Only then attempt larger agentic tasks.

## Anti-Patterns

- Starting implementation before reading the codebase
- Writing sprint docs with unverified imports or signatures
- Treating `the tests passed` as the same thing as `the feature works`
- Letting one huge chat session substitute for explicit artifacts
- Leaving important verification notes in conversation history instead of docs
- Mixing feature artifacts into the top level of `docs/`

## What Success Looks Like

A good change in this repository has all of the following:

- a clear contract
- bounded implementation scope
- matching tests
- QA against the written plan
- runtime verification when needed
- updated documentation that the next person can trust

That is the standard students should learn from this project.