# Prompt Companion — Chapter 13: MCP + Next.js Architecture and Capability Roadmap

> This companion document pairs with [Chapter 13](../chapters/ch13-mcp-nextjs-architecture-and-capability-roadmap.md). Each prompt pair demonstrates how to design MCP tools, extend the architecture, and plan capability growth — and what happens when tool definitions lack the precision that makes model-driven execution reliable.

---

## Prompt 1: Designing an MCP Tool Schema

### Bad Prompt

```text
Add a new tool to the MCP server that can fetch URLs.
```

### Behind the Curtain — What I Do with This

I write a tool handler that fetches URLs. The schema will have the minimum viable shape: a name, an input, and a return value. It will work for simple cases. It will not handle: authentication requirements, timeout behavior, content-type restrictions, error classification, rate limiting, or the boundary between what the tool should do (fetch) and what the orchestration layer should do (decide when to fetch). The tool becomes a convenience function rather than a governed capability.

### Good Prompt

```text
Design an MCP tool for fetching and extracting content from URLs, following
the architectural principles in Chapter 13.

STEP 1 — Schema Design (the "message in a bottle"):
Define the tool schema with:
- Tool name (following the naming convention of the existing calculator tool)
- Input schema:
  - url (string, required) — the URL to fetch
  - extract_mode (enum: "full_html" | "text_only" | "metadata", required)
    — what to return
  - timeout_ms (number, optional, default 5000) — maximum wait time
- Output schema:
  - content (string) — extracted content
  - status_code (number) — HTTP status
  - content_type (string) — response content type
  - truncated (boolean) — whether content was cut to fit size limits

STEP 2 — Boundary Definition (Chapter 13's architecture split):
- What does the tool do? (Deterministic execution only.)
- What does the tool NOT do? (No policy decisions, no caching decisions,
  no retries — those belong to the orchestration layer.)
- What does the orchestration layer decide before calling this tool?

STEP 3 — Error Classification:
Define typed error responses for:
- Invalid URL format
- DNS resolution failure
- Connection timeout
- HTTP error status (4xx, 5xx)
- Content too large for extraction
Each error must have a distinct error code the model can interpret.

STEP 4 — Implementation:
Implement the tool in mcp/url-fetcher-server.ts using the same Server
pattern as calculator-server.ts.

Acceptance criteria:
1. Schema is fully typed — no `any` types.
2. Every error case returns a structured error, not a thrown exception.
3. The tool does not make policy decisions (no "should I fetch this?" logic).
4. A test file validates: valid URL, invalid URL, timeout, each error type.
5. npm run typecheck and npm run lint pass after adding the tool.

Invariants:
- calculator-server.ts is not modified.
- All existing tests continue to pass.
```

### Behind the Curtain — What I Do with This

The four-step structure mirrors Chapter 13's architecture: schema first, boundary second, errors third, implementation last. This sequencing ensures the design is complete before code is written.

The schema design (Step 1) is what Clark called the "message in a bottle" — the typed contract that makes the tool invocation precise. The `extract_mode` enum is a critical design decision: without it, the tool returns "whatever it gets" and the model has to parse unpredictable content. With it, the extraction behavior is explicit in the contract.

The boundary definition (Step 2) enforces Chapter 13's core architectural principle: the tool does deterministic execution, the orchestration layer does policy reasoning. If the tool decides whether to retry on failure, it is mixing execution with policy. If the orchestration layer decides whether to retry and calls the tool again, each component stays in its domain.

The error classification (Step 3) gives the model structured signals rather than opaque failures. When the tool returns `ERROR_DNS_RESOLUTION`, the model can reason about the error type (the URL might be wrong). When the tool throws a generic exception, the model can only say "something went wrong."

---

## Prompt 2: Extending the Architecture Without Breaking the Split

### Bad Prompt

```text
Add authentication to the MCP tools.
```

### Behind the Curtain — What I Do with This

I add authentication logic inside each tool handler. This puts authentication — a policy concern — in the execution layer. The tool now checks "should this caller be allowed to use me?" alongside "how do I perform my computation." The architecture split from Chapter 13 is violated: the tool layer is now doing orchestration work.

### Good Prompt

```text
Capability: Add authentication to MCP tool invocations, preserving the
architecture split described in Chapter 13.

The architecture split says:
- Next.js layer: orchestration, policy, user-facing concerns
- MCP tool layer: deterministic execution with typed schemas
- Operations layer: validation, deployment, runtime controls

QUESTION: Where should authentication live?

Analyze three options:
1. **Inside each tool handler** — the tool checks auth before executing.
2. **In the Next.js API route** — the route validates auth before forwarding
   to the MCP tool.
3. **In an MCP middleware/wrapper** — a layer between the route and the tool
   that checks auth without the tool knowing about it.

For each option:
- Does it preserve or violate the architecture split?
- What happens when you add a new tool — does auth come free or does it
  need to be re-implemented?
- What happens when auth requirements change — how many files change?
- Can the tool be unit-tested without an auth context?

Recommend the option that:
a. Keeps tools as pure executors (no policy logic in tools).
b. Makes auth automatic for new tools (not per-tool implementation).
c. Allows tools to be tested independently of auth.

Then implement the recommended option with:
- Typed auth context interface
- Policy enforcement at the correct architectural layer
- A test demonstrating that an unauthenticated request is rejected
  before reaching the tool

Acceptance criteria:
1. The tool handler code contains zero auth logic.
2. Auth is enforced — removing it causes a test to fail.
3. Adding a new tool does NOT require adding auth code to that tool.
4. npm run typecheck and npm run lint pass.
```

### Behind the Curtain — What I Do with This

The three-option analysis forces me to reason about architectural consequences rather than just implementing the first workable approach. Option 1 (auth in the tool) works but violates the split. Option 2 (auth in the route) preserves the split but couples auth to Next.js. Option 3 (middleware) is usually the best fit because it enforces auth at the boundary without either the tool or the route needing to implement it directly.

The four evaluation questions — does it preserve the split, does auth come free for new tools, how many files change when auth requirements change, can tools be tested without auth — are architectural criteria, not functional ones. All three options provide authentication. The difference is in how they affect the system's maintainability, testability, and extensibility.

Acceptance criterion 1 — "the tool handler code contains zero auth logic" — is the hard test. It proves the architecture split is preserved. If I can show that the tool handler is identical with and without auth enabled, the separation is clean.

---

## Prompt 3: Building the Capability Roadmap

### Bad Prompt

```text
What features should I add to my MCP project next?
```

### Behind the Curtain — What I Do with This

I suggest adding more tools: a weather API, a database query tool, a file system tool. These are popular MCP tool examples. They may or may not be relevant to this project's goals, audience, or architectural constraints. The suggestions are drawn from my training distribution of common tool implementations, not from an analysis of what this specific project needs next.

### Good Prompt

```text
Chapter 13 defines a three-tier capability roadmap. Evaluate this project's
current state against each tier and produce a prioritized build plan.

Current capabilities:
- MCP calculator tool (deterministic math)
- Claude chat integration with streaming
- Quality gate pipeline (typecheck, lint, test, Lighthouse)
- Sprint-based development workflow

TIER 1 — Immediate Audience Value:
Chapter 13 specifies: capability explorer, invocation trace view, failure-mode
demos.

For each Tier 1 item:
a. Does it exist in the current codebase? (FULLY / PARTIALLY / NOT AT ALL)
b. What specifically would be built? (Pages, components, API routes.)
c. What is the user-facing value? (What can a visitor do that they can't now?)
d. Estimate: files to create, files to modify.

TIER 2 — Production Readiness:
Chapter 13 specifies: tool-level auth, rate/budget controls, evaluation
harness.

For each Tier 2 item:
a. What prerequisite from Tier 1 must be complete first?
b. What architectural changes are needed?
c. What is the risk of skipping this tier? (What breaks in production?)

TIER 3 — Platform Evolution:
Chapter 13 specifies: multi-tool registry, human approval checkpoints,
cross-session memory.

For each Tier 3 item:
a. Which Tier 2 capabilities are prerequisites?
b. What is the governance risk? (Chapter 9 concerns that apply.)
c. Is this tier appropriate for this project's current maturity?

Build Plan:
Select the top 3 items across all tiers, ordered by:
1. Dependency sequence (prerequisites first)
2. Effort-to-value ratio
3. Alignment with the project's educational purpose

For the #1 item, produce a full sprint plan with scope, acceptance criteria,
and validation commands.

Acceptance criteria:
1. Every Tier 1 item has a concrete implementation description.
2. Tier dependencies are explicit (no Tier 2 item assumes unbuilt Tier 1).
3. The sprint plan for item #1 is immediately executable.
```

### Behind the Curtain — What I Do with This

The tier structure prevents the roadmap from being a flat feature list. By evaluating current state against each tier, I identify where the project actually is (not where it aspires to be) and what the genuine next steps are.

The prerequisite analysis between tiers is critical. Auth (Tier 2) cannot be evaluated without a capability explorer (Tier 1) because you need to see what capabilities exist before governing access to them. The multi-tool registry (Tier 3) cannot be built without the evaluation harness (Tier 2) because you need to measure tool-selection accuracy before expanding the selection space. These dependencies determine the build sequence.

Chapter 13's emphasis on "audience value" for Tier 1 reflects the project's dual nature: it is both a system and a curriculum. The capability explorer is not just a development tool — it is a teaching interface that makes MCP visible to learners. Prioritizing audience value first ensures the project serves its educational purpose while building toward production capabilities.

---

## Prompt 4: The Talkers-to-Doers Transition

### Bad Prompt

```text
How do I make my AI app actually do things instead of just chat?
```

### Behind the Curtain — What I Do with This

I suggest adding API integrations and tool calls. This is mechanically correct and conceptually inadequate. The talkers-to-doers transition from Chapter 13 is not about adding features — it is about separating reasoning from execution and governing the boundary between them. Adding tool calls without the MCP architecture split produces a chatbot that happens to call APIs, not an agentic system with an inspectable execution boundary.

### Good Prompt

```text
Chapter 13 frames the transition from "talkers" to "doers" using the
Klein-Clark interview: AI applications that just converse are talkers;
AI applications that take governed, observable actions are doers.

Analyze this project's current position on the talker-doer spectrum and
design the next step toward "doer" capabilities.

CURRENT STATE ANALYSIS:
1. Where does this project currently sit?
   - The chat interface is a "talker" capability.
   - The calculator tool is a "doer" capability.
   - Map each current feature to talker or doer.

2. What makes the calculator tool a "doer" and not just a function call?
   - Typed schema (the "message in a bottle")
   - Deterministic execution boundary
   - Inspectable tool invocation
   - Structured result format
   Verify: does the current implementation satisfy all four properties?

3. What is missing from "doer" maturity?
   - Can a user see when a tool was invoked? (Observability)
   - Can a user see why a tool was invoked? (Policy transparency)
   - Can a user see what the tool returned? (Result inspection)
   - If any of these are missing, the action is governed but not observable.

NEXT STEP DESIGN:
Design one new "doer" capability that:
a. Has a typed MCP schema with explicit inputs and outputs
b. Performs deterministic execution (no model reasoning in the tool)
c. Produces observable signals (the invocation is logged and inspectable)
d. Has policy separation (the orchestration layer decides *when*, the
   tool decides *how*)

For the designed capability:
- Full schema definition
- Boundary specification (what the tool does / does not do)
- Error classification (typed errors for each failure mode)
- Observability integration (what signals are emitted)
- One test scenario that validates the talker/doer boundary is maintained

Acceptance criteria:
1. The analysis correctly classifies current features as talker or doer.
2. The designed capability satisfies all four "doer" properties.
3. The policy/execution boundary is explicit in the design.
```

### Behind the Curtain — What I Do with This

The talker-doer framework gives me a classification lens that is more nuanced than "does it have tools?" The four properties — typed schema, deterministic execution, inspectable invocation, structured results — define what makes tool use *governed* rather than just *possible*.

The current-state analysis forces me to assess the existing calculator tool against all four properties, rather than assuming it satisfies them. This might reveal gaps: if the tool invocation is not observable to the user, the action is happening but is not inspectable — which means the human governance layer from Chapter 9 has a blind spot.

The "next step" design constraint — "produces observable signals" — connects the Chapter 13 architecture to Chapter 8's observability framework. A doer capability that cannot be observed is a capability that cannot be governed. The prompt ensures the new tool is designed with both execution and observability from the start, rather than bolting observability on after the fact.

---

## Prompt 5: Clark's "Message in a Bottle" — Designing for Autonomous Execution

### Bad Prompt

```text
Write a detailed prompt for the AI to complete a task.
```

### Behind the Curtain — What I Do with This

I write a long prompt with lots of instructions. Length is not precision. A long prompt without structure is like a long email without sections — the model processes it linearly and may lose context or emphasis in the middle. Clark's "message in a bottle" metaphor is not about length. It is about *completeness under autonomy*: the message must contain everything the executor needs because there is no opportunity to ask follow-up questions.

### Good Prompt

```text
Apply Clark's "message in a bottle" principle from Chapter 13 to design
a self-contained task specification for a model that will execute
autonomously (no human checkpoints during execution).

Task: Refactor the error handling in the chat API route to use the Chain
of Responsibility pattern from Chapter 7.

The "bottle" must contain:

1. **Complete context** (what the executor needs to know):
   - Current file: src/app/api/chat/route.ts
   - Current error handling approach: [describe or reference]
   - Target pattern: Chain of Responsibility (Chapter 7)
   - Related modules that must not be modified: [list them]

2. **Precise scope** (what to touch and what not to touch):
   - Files to create: [enumerate]
   - Files to modify: [enumerate]
   - Files that must NOT be modified: [enumerate]

3. **Invariants** (what must remain true throughout):
   - All existing tests pass at every stage
   - TypeScript strict mode passes
   - No new `any` types introduced
   - No warnings from ESLint
   - The chat endpoint produces identical responses for identical inputs

4. **Acceptance criteria** (how to verify when done):
   - [ ] Error classification uses typed handler chain
   - [ ] Each handler type is in its own module
   - [ ] Adding a new error type requires adding one handler, not modifying
         existing ones (Open/Closed Principle)
   - [ ] Test coverage for each error handler independently
   - [ ] Integration test proving the chain routes errors correctly

5. **Verification commands** (the executor runs these before declaring done):
   - npm run typecheck
   - npm run lint (or lint:strict)
   - npm test
   - Manual test: send a request that triggers each error type

6. **Failure protocol** (what to do if something goes wrong):
   - If an invariant is violated, stop and report which invariant broke.
   - If an acceptance criterion cannot be met without violating an
     invariant, stop and report the conflict.
   - Do NOT weaken invariants to satisfy acceptance criteria.

This specification should be complete enough that you could hand it to
a model, walk away, and return to find the work done correctly — or
clearly documented as blocked with the specific reason.
```

### Behind the Curtain — What I Do with This

The six-section structure implements Clark's "message in a bottle" as an engineering specification rather than a prose prompt. Each section addresses a specific concern that autonomous execution requires:

- **Context** ensures I understand the current state (not just the desired state).
- **Scope** prevents me from touching files outside the task boundary.
- **Invariants** give me continuous constraints to check against during implementation.
- **Acceptance criteria** define the target state precisely.
- **Verification commands** give me the exact validation protocol.
- **Failure protocol** tells me what to do when things go wrong — which is the section most "messages in a bottle" omit.

The failure protocol is the most important section for autonomous execution. Without it, when I hit a problem, I either silently work around it (potentially violating invariants) or stop without explanation. With it, I know to report the specific conflict. This is the difference between autonomous execution that is governed and autonomous execution that is unsupervised.

The final sentence — "complete enough that you could hand it to a model, walk away, and return" — is the test for whether the bottle contains a complete message. If you would feel uncomfortable walking away, the specification has a gap. Identify the gap, add it to the specification, and test again.

---

*These prompts operationalize Chapter 13's architecture: MCP is not just a protocol — it is the engineering discipline that makes the transition from talkers to doers safe, observable, and extensible. The tool schema is the "message in a bottle" that makes model-driven execution precise. The architecture split between Next.js (orchestration) and MCP (execution) keeps policy and computation in their correct domains. The capability roadmap sequences growth from visibility to reliability to governance to scale. At every layer, the principle is the same: typed contracts, deterministic boundaries, and human-governed oversight.*
