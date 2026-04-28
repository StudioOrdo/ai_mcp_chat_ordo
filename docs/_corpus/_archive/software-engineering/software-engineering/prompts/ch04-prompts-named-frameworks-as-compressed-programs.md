# Prompt Companion — Chapter 4: Named Frameworks as Compressed Programs

> This companion document pairs with [Chapter 4](../chapters/ch04-named-frameworks-as-compressed-programs.md). Each example demonstrates the difference between invoking a framework name as a vague shorthand versus invoking it as a compressed program with local contracts.

---

## Prompt 1: The Bare Name vs. The Qualified Directive

### Bad Prompt

```text
Do a SOLID refactor of my chat module.
```

### Behind the Curtain — What I Do with This

"SOLID refactor" activates a large cluster of associated patterns in my training. I know what each letter stands for. I know the canonical examples. I also know five different interpretations of each principle, some of which contradict each other at the edges.

Without scope, invariants, or acceptance criteria, I pick the interpretation that produces the most visible changes. This usually means I decompose everything aggressively — splitting files, creating interfaces, adding abstraction layers. The output will look like a textbook SOLID example. It may also be over-engineered for your actual codebase, introduce unnecessary indirection, and change the public API in ways you did not intend.

The framework name loaded the program. The program ran without constraints. That is the failure mode Chapter 4 describes.

### Good Prompt

```text
Framework: SOLID (Robert C. Martin's five principles of object-oriented design)
Scope: src/lib/chat/ directory only — specifically the provider integration
  modules.
Local interpretation for this codebase:
  - SRP: Each module should have one reason to change. Currently,
    anthropic-client.ts mixes provider invocation, error handling, and retry
    logic. These are three reasons to change.
  - OCP: Adding a new provider should not require editing existing provider
    modules.
  - LSP: All providers must implement the same ChatProvider interface and be
    interchangeable without caller changes.
  - ISP: The ChatProvider interface should not force providers to implement
    methods they do not support.
  - DIP: Route handlers should depend on the ChatProvider interface, not on
    concrete provider implementations.

Acceptance criteria:
1. anthropic-client.ts is decomposed into modules where each has a single
   documented responsibility.
2. A new provider can be added by creating one new file without modifying
   existing files.
3. All existing tests pass without modification.
4. `npm run typecheck` and `npm run lint:strict` pass.
5. No provider module imports from another provider module.

Do not refactor code outside src/lib/chat/. Do not add new dependencies.
```

### Behind the Curtain — What I Do with This

The local interpretation section is what transforms "SOLID" from a vague aspiration into an executable contract. Instead of asking me to apply SOLID generically, you are telling me exactly what each principle means in *this* codebase. SRP in this context means splitting anthropic-client.ts into separate concerns. OCP means the file-addition test. LSP means interface conformance. ISP means a lean interface. DIP means interface-based imports.

This eliminates my "most impressive interpretation" bias. I do not need to decide what SOLID *should* mean here — you told me. My job is implementation, not interpretation. That is a much more tractable task for a language model.

The contract pattern from Chapter 4 (framework name + scope + local interpretation + acceptance checks) appears verbatim in this prompt. It is not ceremony. It is the mechanism that makes framework compression work.

---

## Prompt 2: 12-Factor as Semantic Macro

### Bad Prompt

```text
Make my app 12-factor compliant.
```

### Behind the Curtain — What I Do with This

I generate changes for all twelve factors simultaneously. Some will be meaningful. Some will be unnecessary for your architecture. Some will conflict with each other because I am making assumptions about your deployment environment, your config management, and your logging infrastructure — all of which I do not actually know.

The output will be too large to review, too scattered to verify, and too uncoordinated to ship. Twelve factors in one prompt is twelve concurrent tasks competing for my context window.

### Good Prompt

```text
Framework: 12-Factor App (Adam Wiggins, 2011 — operational contract between
  application and environment)
Scope: Factor III (Config) only.
Local interpretation: All runtime configuration — API keys, model identifiers,
  feature flags — must be read from environment variables, validated at startup,
  and centralized in one module: src/lib/config/env.ts.

Current state: ANTHROPIC_API_KEY and ANTHROPIC_MODEL are read in multiple
  places. Some reads check for undefined, some do not. There is no centralized
  validation.

Required changes:
1. Create or update src/lib/config/env.ts to:
   a. Read all env vars in one place.
   b. Validate that required vars are present and have expected shapes.
   c. Export typed config objects.
   d. Fail fast at startup with a clear error message if validation fails.
2. Update all consumers to import from env.ts instead of reading process.env
   directly.
3. Remove all direct process.env reads outside of env.ts.

Acceptance criteria:
1. `grep -r "process.env" src/ --include="*.ts" | grep -v "env.ts"` returns
   zero results.
2. `npm run typecheck` passes.
3. Starting the app without ANTHROPIC_API_KEY set produces a clear error on
   stderr and exits with code 1.
4. All existing tests pass.

Do not address any other 12-Factor factors in this sprint.
```

### Behind the Curtain — What I Do with This

"Factor III only" is the scope that makes this work. Instead of twelve concurrent tasks, I have one. My entire context window is dedicated to config centralization. The output is smaller, more coherent, and verifiable with the specific grep command provided.

The acceptance criteria include a *command* that proves compliance: `grep -r "process.env" src/ --include="*.ts" | grep -v "env.ts"` returning zero results. This is not a subjective assessment — it is a machine-checkable property. I generate code with that specific check in mind, which means I am more careful about catching every `process.env` usage.

The explicit "do not address any other factors" instruction prevents me from noticing, say, that the logging format could be improved (Factor XI) and "helpfully" including that change. This helpful expansion is the most common scope violation in framework-level prompts: the framework name activates all twelve factors, and without explicit scope restriction, I act on all of them.

---

## Prompt 3: GoF Pattern Names as Precision Tools

### Bad Prompt

```text
Use design patterns to improve my code.
```

### Behind the Curtain — What I Do with This

"Design patterns" is an enormous search space. I have 23 GoF patterns, plus dozens of other well-known patterns (Repository, Unit of Work, Service Locator, etc.), plus every pattern variant I encountered in training data. Without knowing what problem you are solving, I pick patterns that produce visible structure improvements — which often means adding abstraction that looks sophisticated but may not match the actual concerns in your code.

I am pattern-matching my training rather than diagnosing your codebase. The result looks professional. It may not be the right pattern.

### Good Prompt

```text
Framework: GoF Design Patterns — specifically Observer
Scope: Observability emission in src/lib/chat/http-facade.ts and
  src/app/api/chat/route.ts.

Problem diagnosis: Both files emit metrics and log events inline. The emission
  logic is duplicated. Adding a new metrics sink (e.g., a structured logger,
  a Prometheus endpoint) requires modifying every file that emits metrics.

Local interpretation of Observer for this codebase:
- Subject: A typed EventPublisher that accepts structured events.
- Observers: Metric sinks registered at startup. Adding a new sink means
  registering a new listener, not editing emission code.
- Events: Typed objects with discriminated unions (RequestCompleted,
  RequestFailed, ToolInvoked) — not generic strings.

Acceptance criteria:
1. Route files no longer directly import or call any metrics/logging function.
2. All metrics emission goes through EventPublisher.
3. Adding a mock observer in tests verifies that events are emitted correctly.
4. `npm run typecheck` passes with the typed event system.
5. Existing behavior is unchanged — same metrics are emitted for the same
   conditions.

Do not introduce any other GoF patterns in this sprint.
```

### Behind the Curtain — What I Do with This

This prompt uses the GoF pattern name as a compressed program — but immediately decompresses it into the local context. I know exactly what Subject means here (EventPublisher), what Observer means (metric sinks), and what Events look like (discriminated union types). I am not guessing which GoF pattern to apply or how to map its abstract roles to your concrete architecture.

The problem diagnosis tells me *why* Observer is the right pattern — the duplication and the sink-addition cost. This matters because it gives me a way to verify my implementation: if adding a new sink still requires modifying route code, the Observer implementation is wrong regardless of how "correct" the pattern structure looks.

"Do not introduce any other GoF patterns" prevents me from pattern-stacking. When I am in "patterns mode," I tend to see pattern opportunities everywhere. One pattern per sprint keeps the changes bounded and verifiable.

---

## Prompt 4: Recognizing When a Framework Name Is Misapplied

### Bad Prompt

```text
My code doesn't follow DRY. Fix it.
```

### Behind the Curtain — What I Do with This

I search for duplicated code and eliminate it. Every function that appears twice gets extracted into a shared utility. Every string literal that appears twice gets turned into a constant. The output has fewer lines and feels "cleaner."

But DRY — as Thomas and Hunt defined it — is about knowledge, not code. "Every piece of knowledge must have a single, unambiguous, authoritative representation within a system." Sometimes identical code represents different knowledge (two functions that happen to look the same today but serve different purposes and will evolve differently). Mechanically deduplicating them creates a coupling that is worse than the duplication.

My default interpretation of DRY is the shallow one: reduce line duplication. Without guidance, I will not make the distinction between knowledge duplication and incidental code similarity.

### Good Prompt

```text
Framework: DRY (Thomas and Hunt, 1999 — "Every piece of knowledge must have
  a single, unambiguous, authoritative representation within a system.")

I suspect there is knowledge duplication in my error handling: both the chat
API route and the MCP tool invocation path construct error response envelopes
with the same shape.

Analyze:
1. Are these two functions expressing the SAME business knowledge (error
   response contract for HTTP API consumers), or are they expressing
   DIFFERENT knowledge that happens to produce similar code (error handling
   for two genuinely different domains)?
2. If they express the same knowledge: propose a shared module with the
   authoritative representation.
3. If they express different knowledge: explain why extracting a shared module
   would create false coupling, and suggest how to document the intentional
   duplication.

Acceptance criteria:
- If shared: All error envelopes are constructed from one module, and changing
  the envelope shape requires editing one file.
- If separate: Each domain has its own error envelope construction, and a
  comment explains why the duplication is intentional.
- Either way: `npm run typecheck` and `npm run lint:strict` pass.
```

### Behind the Curtain — What I Do with This

This prompt asks me to make a *judgment call* before implementing. The option structure (same knowledge vs. different knowledge) forces me to reason about the domain semantics rather than the code syntax. I cannot just deduplicate — I have to justify *whether* deduplication is correct.

The "if separate" branch is particularly important. It gives me permission to say "the duplication is intentional" — which my training heavily discourages. In most code review contexts, pointing out duplication and recommending extraction is the safe, expected response. This prompt explicitly creates space for the opposite conclusion, which produces more honest analysis.

This is the framework-awareness Chapter 4 advocates: not just invoking DRY as a rule, but applying it as Thomas and Hunt intended it — as a knowledge-management principle with nuance.

---

## Prompt 5: Framework Compression in Team Communication

### Bad Prompt

```text
How should our team use design patterns in code review?
```

### Behind the Curtain — What I Do with This

I produce a process recommendation: "Create a pattern review checklist. Train the team on common patterns. Include pattern names in PR descriptions." These are reasonable suggestions with no operational specificity. They describe a team that does pattern review without describing what that team actually *does* differently.

### Good Prompt

```text
Our team has adopted the Chapter 4 contract pattern for framework references
in code reviews:
1. Framework name (semantic macro)
2. Scope boundary (where it applies in this PR)
3. Local interpretation (what the pattern means for this codebase)
4. Acceptance checks (how we know the pattern was applied correctly)

Write three realistic code review comments that demonstrate this pattern in
use — one for each framework:

1. A SOLID comment on a PR that decomposes a monolithic route handler.
2. A 12-Factor comment on a PR that adds environment variable handling.
3. A GoF comment on a PR that introduces the Decorator pattern for provider
   call instrumentation.

For each review comment:
- Include the 4-step contract.
- Write both the approval-path version (where the PR meets the contract) and
  the revision-request version (where the PR has a specific gap).
- Keep each comment under 150 words (realistic for a PR comment).

The comments should sound like a real senior engineer, not a textbook.
```

### Behind the Curtain — What I Do with This

Asking for both approval and revision versions of each review comment forces me to reason about what "correct application" and "incorrect application" look like for each framework — which is more useful than a single positive example. The revision-request versions are particularly valuable because they demonstrate how framework names enable *specific* feedback. Instead of "this could be better," the reviewer can say "this violates the local interpretation of ISP — the interface forces providers to implement streaming methods they do not support."

The 150-word limit and "sound like a real engineer" instruction prevent me from generating formal, academic comments. Real code review comments are terse and specific. The word ceiling enforces that quality.

---

*These prompts demonstrate Chapter 4's central insight: a framework name is a semantic macro. Without local contracts, the macro is underspecified. With scope, local interpretation, and acceptance criteria, the macro becomes an executable directive that produces predictable, verifiable output. The difference is not prompting technique — it is engineering discipline.*
