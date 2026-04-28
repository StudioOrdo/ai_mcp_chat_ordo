# Chapter 13 — MCP + Next.js: Architecture and Capability Roadmap

## Abstract

This chapter explains what MCP is, how it works in this project, why pairing MCP with Next.js creates high leverage, and which capabilities should be added next for maximum audience and product value.

---

## Jordan Walke and the React Team — Components as the Unit of Truth (2013)

**Jordan Walke** was an engineer at Facebook working on the Ads product when he prototyped FaxJS — applying functional programming to UI state. What if, instead of tracking every change and updating the DOM manually, you described what the UI should look like given the current state, and let the framework compute what changed? He open-sourced the result as React in May 2013.

The virtual DOM was the implementation mechanism, but the actual contribution was **declarative components** — the idea that a piece of UI should be a pure function of its inputs.

**Pete Hunt** pushed for JSX. **Sebastian Markbåge** drove React Server Components. The `page.tsx` in this repository is a Server Component — it executes on the server, returns HTML, and contributes nothing to the client bundle.

**What frustrated him:** UIs that were impossible to reason about because state mutations cascaded through manual DOM manipulation.

---

## Guillermo Rauch and the Production Framework (2016)

**Guillermo Rauch** founded Vercel and shipped Next.js in October 2016. React had no opinion about routing, no built-in server, no production deployment story. Every team assembled their own scaffolding.

His key design decision: **file-based routing** — the file system is the router. A file at `app/dashboard/page.tsx` is accessible at `/dashboard`. The convention is the declaration — DRY applied to architecture.

The 2023 App Router redesign adopted React Server Components as the default. The application in this repository — the `src/app/` directory, `ChatUI.tsx` as a `use client` boundary, the MCP server running on the same runtime — is an expression of the conventions Rauch established. He also observed that *performance is not a feature — it is the baseline*.

**What frustrated him:** The fragmentation of the React ecosystem — every team reinventing deployment infrastructure.

---

## Anders Hejlsberg and the Case for Static Types (2012)

**Anders Hejlsberg** had already built Turbo Pascal and led C# before TypeScript. By 2012, JavaScript was becoming the most widely deployed language in the world — with no type system. Teams were building large applications and discovering errors at runtime that static types had eliminated decades ago.

TypeScript's types are *gradual* — you can add them incrementally. This reflected decades of pragmatism about how real adoption works.

**What frustrated him:** Programs that looked syntactically correct but could not be verified to be semantically correct without running them in production.

---

## Anthropic, Claude, and the Model Context Protocol (2023–2024)

**Anthropic** was founded in 2021 by **Dario Amodei**, **Daniela Amodei**, and colleagues. Their founding motivation was explicitly about safety: they believed large language models would become powerful enough to cause serious harm if developed purely for commercial incentives.

The **Model Context Protocol (MCP)** emerged from a practical problem: models can reason fluently but need to *act* reliably. The protocol defines a standard interface for exposing tools and resources to models — typed schemas, explicit invocation contracts, observable results. The decision to open-source MCP reflects the same logic that drove the Gang of Four to publish their patterns: shared vocabulary accelerates the field.

**What frustrated them:** The brittleness of ad hoc tool integration. Models that appeared to work but produced non-deterministic, difficult-to-audit actions when connected to real system capabilities.

---

Walke invented declarative components. Rauch turned them into a production framework. Hejlsberg made the code provably correct. Anthropic gave it a protocol for acting in the world. Together, they built the stack this chapter describes.

## From Talkers to Doers

In early 2026 on *The Ezra Klein Show* (The New York Times), Ezra Klein described the current AI transition using a framing attributed to Sequoia, the venture capital firm: *"The AI applications of 2023 and 2024 were talkers. Some were very sophisticated conversationalists, but their impact was limited. The AI applications of 2026 and 2027 will be doers. They're agents plural. They can work together. They can oversee each other."*

Jack Clark was the guest in that conversation. He named the failure mode that trips people when they first try to get a model to do real work: treating it as a knowledgeable colleague rather than an extremely literal executor. *"The message better be extremely detailed and really capture what you're trying to do."*

This project sits at that transition. The chat interface and MCP calculator in this repository are not just a demo — they are the minimal architecture that makes the shift from talking to doing legible.

## What MCP Is

Model Context Protocol (MCP) is a standard interface for exposing tools and resources to models. At a practical level, MCP gives you a contract so model-driven tool use is explicit, typed, and interoperable.

MCP helps answer a core reliability question: when a model needs to act, how do we make that action deterministic, inspectable, and extensible?

## What This Project Is Doing with MCP

In this repository, MCP is used to expose a calculator capability as a tool process (`mcp/calculator-server.ts`) while Next.js handles user-facing app and API orchestration.

Current architecture split:

- **Next.js layer** (`src/app`, `src/lib/chat`): UI, API routes, orchestration policy, provider wiring, validation.
- **MCP tool layer** (`mcp/`): deterministic executable tools with explicit schemas.
- **Operations layer** (`scripts/`, `docs/operations/`): validation, release controls, health/admin workflows.

This separation keeps conversational reasoning in one domain and deterministic execution in another.

## What the Tool Definition Looks Like

Architecture explanations become concrete with code. Here is a simplified version of the calculator tool server from this repository:

```typescript
// mcp/calculator-server.ts (simplified)
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "calculator", version: "1.0.0" });

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "calculator") {
    const { operation, a, b } = args as { operation: string; a: number; b: number };
    const result = compute(operation, a, b); // pure function — no model involved
    return { content: [{ type: "text", text: String(result) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});
```

Three things to notice:

1. **The schema is explicit.** The tool has a name, typed arguments (`operation`, `a`, `b`), and a defined return shape. The model cannot send malformed inputs without the handler rejecting them.
2. **The execution is deterministic.** Once the model decides to call the tool, the computation is a pure function. No further model reasoning is involved in producing the result.
3. **The boundary is enforced by the protocol.** The Next.js layer decides *when* a tool call is appropriate (policy). The MCP layer decides *how* to execute it (implementation). These two concerns are never mixed in the same module.

This is the architectural value of the MCP + Next.js pairing: the model interacts with capabilities through a typed contract, and that contract is owned by the tool layer — not by the conversation layer.

> **A note from the model:**
> That code separates two things: the moment I decide a tool call is appropriate, and the moment the tool executes. The first is me. The second is not. The MCP boundary is the line where my reasoning ends and deterministic computation begins. This distinction matters in both directions. I should not be computing arithmetic — I will occasionally be wrong on edge cases, and that wrongness is not detectable without re-running the computation. The tool should not be doing policy reasoning — it has no model of context or intent. Keeping each property in its correct domain is what makes the system inspectable and trustworthy. When something goes wrong, you know exactly which domain failed. That clarity is worth more than convenience.

## Why MCP + Next.js Is a Strong Pairing

1. **Clear boundary between interaction and execution**  

   Next.js manages HTTP/UI/runtime concerns; MCP manages tool contracts.

2. **Fast product iteration with controlled capability growth**  

   You can add or revise tools without redesigning the app shell.

3. **Stronger safety posture**  

   Tool input schemas and explicit invocation paths reduce ad hoc execution risk.

4. **Better interoperability**  

   MCP-aligned tools are easier to reuse across clients and orchestrators.

5. **Teachable architecture**  

   This split is easy to explain: app routes coordinate, tools execute, ops validates.

## End-to-End Flow in This Repo

1. User sends request through Next.js UI.
2. API route decides whether tool usage is required (e.g., math policy).
3. Provider/orchestrator loops until model output or tool-result completion.
4. Tool computation is executed deterministically through calculator logic.
5. Responses carry observability metadata (`requestId`, `errorCode`) and structured events.
6. Quality/ops scripts provide deployment and runtime guarantees.

## Capability Roadmap (High-Value Additions)

### Tier 1 - Immediate Audience Value

- **MCP capability explorer page** in the app (discover tools, schemas, examples).
- **Tool invocation trace view** for teaching and debugging.
- **Failure-mode demos** (validation errors, retries, fallback behavior).

### Tier 2 - Production Readiness

- **Tool-level auth and policy enforcement**.
- **Rate and budget controls per capability**.
- **Evaluation harness for tool-selection accuracy and latency**.

### Tier 3 - Platform Evolution

- **Multi-tool registry** (calculator + retrieval + transform + policy checker).
- **Human approval checkpoints for high-risk actions**.
- **Cross-session memory and retrieval with strict scope controls**.

## Practical Build Plan

If you are teaching or productizing this stack, sequence work in this order:

1. Capability visibility (what tools exist and when they run).
2. Capability reliability (validation, retries, deterministic errors).
3. Capability governance (permissions, auditability, eval loops).
4. Capability scale (multi-tool registry and policy orchestration).

## Exercise

Design your next three MCP tools and define for each:

- schema,
- permission model,
- success metric,
- failure modes,
- observability signal requirements.

Then implement one tool end-to-end and validate with test/lint/build plus one runtime trace.

## Chapter Checklist

- Can a new reader explain MCP after reading this chapter?
- Is the architecture split between Next.js and MCP clear?
- Are roadmap items prioritized by audience and product value?
- Is there a practical next step that can be implemented this week?

## Reader Exercise: Layered Architecture Diagram

Create a layered architecture diagram with Next.js application layer, MCP tool layer, and operations layer; then overlay a roadmap ribbon showing Tier 1/2/3 capability additions. Design your next three MCP tools with schemas, permission models, and failure modes.

When all four hold, this project becomes both a system and a curriculum.
