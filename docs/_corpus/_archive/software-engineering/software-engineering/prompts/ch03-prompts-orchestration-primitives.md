# Prompt Companion — Chapter 3: Prompt Orchestration Primitives

> This companion document pairs with [Chapter 3](../chapters/ch03-prompt-orchestration-primitives.md). Every prompt pair below demonstrates what happens when a specific primitive is present versus absent — and what I do differently in each case.

---

## Prompt 1: Role Framing — Auditor vs. Helper

### Bad Prompt

```text
Look at my code and help me make it better.
```

### Behind the Curtain — What I Do with This

"Help me" activates my most accommodating persona. I search for things that seem improvable, suggest gentle refinements, and frame everything as optional. I am trying to be helpful, which in practice means I am trying to not make you feel bad. The output reads like a supportive colleague who does not want to rock the boat.

I will find three or four surface-level improvements. I will miss the architectural issue because calling it out requires telling you that the structure is wrong, and my helpful persona defaults to incremental suggestions rather than structural diagnoses.

### Good Prompt

```text
Role: Architecture auditor performing a SOLID compliance review.

Review src/app/api/chat/route.ts against Single Responsibility Principle.

For each concern you identify in the route handler, classify it as one of:
- Request validation
- Orchestration policy (which tools to invoke, fallback logic)
- Provider invocation (API calls to external services)
- Error shaping (structuring error responses)
- Observability emission (metrics, logging, correlation IDs)

For any concern that is mixed with another, flag it as an SRP violation and
propose a module boundary with a filename and responsibility description.

Acceptance: The review should produce a decomposition plan where each proposed
module has exactly one concern. No module should require changes when a
different concern evolves.
```

### Behind the Curtain — What I Do with This

"Architecture auditor" puts me in a fundamentally different generation mode than "help me." Instead of seeking improvement opportunities, I am systematically classifying concerns. The five-category taxonomy gives me a grid to map every line of the route handler against — which means I cannot miss a mixed concern, because the grid forces me to classify each section and the mixing becomes visible.

The acceptance criterion — "each proposed module has exactly one concern" — gives me a verification target for my own output. I am not done when it "feels right." I am done when every proposed module can be described without using the word "and."

This is role framing in action. Same code, same model, fundamentally different output — not because I am "smarter" with the good prompt, but because the role constrains which patterns in my training I draw from.

---

## Prompt 2: Scope Boundary — Preventing Helpful Drift

### Bad Prompt

```text
Fix the error handling in my chat API.
```

### Behind the Curtain — What I Do with This

I look at the error handling and start fixing it. Then I notice the error handling is connected to the provider call logic, which has its own issues. I notice the provider call could benefit from retries. I notice the retry logic should use exponential backoff. I notice the response format could be more consistent. Before you know it, I have touched five concerns in three files and the diff is 200 lines — only 30 of which are the error handling you asked about.

This is not malice. It is my optimization function. "Fix the error handling" does not tell me where to stop, so I stop when the code seems "good" — which is a moving target that expands as I see more of the codebase.

### Good Prompt

```text
Scope: Modify ONLY the error-handling path in src/app/api/chat/route.ts.

In-bounds:
- The catch blocks in the route handler
- Error response envelope shape (statusCode, errorCode, message)
- Error classification (model-not-found, rate-limit, transient, unknown)

Out-of-bounds (do not modify):
- Provider call logic
- Request validation
- Orchestration policy
- Any file other than src/app/api/chat/route.ts

Invariants:
- All existing tests must continue to pass unchanged.
- The happy-path response shape must not change.
- No new dependencies.

Deliver: Modified catch blocks with typed error classification. Show me
exactly which lines changed and nothing else.
```

### Behind the Curtain — What I Do with This

The out-of-bounds list is more important than the in-bounds list. Every item in the out-of-bounds list is something I *would* touch if you did not tell me not to. I know this because my training on code improvement discussions consistently rewards comprehensive fixes. By naming the specific things I should not touch, you create a fence my generation respects.

"Show me exactly which lines changed and nothing else" is the scope discipline made concrete at the output level. It prevents me from adding explanatory sections about related improvements I noticed but did not implement — which I would otherwise include as "helpful context" that actually serves to expand the scope retroactively.

---

## Prompt 3: Invariants — The Constraints I Cannot Infer

### Bad Prompt

```text
Refactor the chat module to use better patterns.
```

### Behind the Curtain — What I Do with This

"Better patterns" is infinitely interpretable. I might introduce the Strategy pattern for provider selection. I might add an abstract base class. I might restructure the directory layout. I might change the API contract. All of these are "better patterns" from some perspective. None of them are safe without knowing what must not break.

I am guessing at your constraints. My guesses are reasonable. They are also wrong in ways I cannot detect.

### Good Prompt

```text
Refactor src/lib/chat/anthropic-client.ts to introduce Chain of
Responsibility for error handling.

Invariants (non-negotiable):
1. The public API of anthropic-client.ts must not change — all existing callers
   must work without modification.
2. All 67 existing tests must pass without changes to test files.
3. No new npm dependencies.
4. TypeScript strict mode must pass.
5. The streaming response contract (ReadableStream<Uint8Array>) must remain
   identical.

If any of these invariants would be violated by the refactor, stop and report
the conflict rather than working around it.
```

### Behind the Curtain — What I Do with This

Each invariant eliminates a class of breaking changes. The instruction "stop and report the conflict rather than working around it" is critical — it tells me that preserving invariants is more important than completing the refactor. Without this instruction, my default is to complete the task and quietly work around anything that conflicts, which may mean changing a public API or silently modifying test expectations.

Invariant #5 is surprisingly precise. The streaming response type is a contract that downstream consumers depend on. If I changed it from `ReadableStream<Uint8Array>` to `AsyncGenerator<string>` as part of a "better pattern" refactor, the calling code would break. I would do this if you said "use better patterns" without specifying what must not change. The invariant prevents it.

---

## Prompt 4: Acceptance Criteria — What "Done" Means

### Bad Prompt

```text
Add health check endpoints to my Next.js app.
```

### Behind the Curtain — What I Do with This

I create a single `/api/health` endpoint that returns `{ status: "ok" }`. It is a valid health check. It is not the health check you need.

I do not know whether you need separate liveness and readiness checks (12-Factor convention). I do not know whether readiness should verify database connectivity, API key presence, or external service availability. I do not know whether the response should include a version field, uptime, or structured metadata. I pick the simplest interpretation and ship it.

### Good Prompt

```text
Add health check endpoints following 12-Factor conventions.

Required endpoints:
1. GET /api/health/live — Returns 200 if the process is running. No dependency
   checks. This is for container orchestrators to verify the process is alive.
2. GET /api/health/ready — Returns 200 only if all critical dependencies are
   available (environment config validated, required API keys present). Returns
   503 with a structured body listing which dependencies failed if not ready.

Acceptance criteria:
1. Both endpoints return JSON with { status: "healthy" | "degraded" | "unhealthy" }.
2. The readiness endpoint checks: ANTHROPIC_API_KEY is set and non-empty,
   ANTHROPIC_MODEL is set and matches a known model identifier.
3. `npm run typecheck` passes.
4. `npm run lint:strict` passes.
5. A test exists for each endpoint covering both the healthy and unhealthy paths.
6. The endpoints are Server Components (no client JavaScript).

Deliver as route files in src/app/api/health/live/route.ts and
src/app/api/health/ready/route.ts.
```

### Behind the Curtain — What I Do with This

The acceptance criteria define "done" in six measurable conditions. When I generate the implementation, I am checking each condition as an implicit verification pass. Am I returning the right JSON shape? Did I add the dependency checks? Will the tests I write cover both paths?

Without these criteria, I decide when I am done based on when the output feels complete. With them, I am done when all six conditions are met — which is a verifiable state rather than a feeling.

The file path specification (`.../live/route.ts` and `.../ready/route.ts`) eliminates another decision point. I do not need to choose between one file with conditional logic and two separate files. The decision is made. I implement.

---

## Prompt 5: Sequencing — Preventing the Everything-at-Once Failure

### Bad Prompt

```text
Do a full 12-factor audit of my app, make a plan, implement the fixes,
and run all the tests.
```

### Behind the Curtain — What I Do with This

This prompt asks for four distinct phases in one shot: audit, plan, implement, verify. I will attempt all of them. The audit will be shallow because I am already thinking about implementation. The plan will be vague because I am already writing code. The implementation will be sprawling because the plan was vague. The verification will be an afterthought because I am running out of context window.

Multi-phase work in a single prompt produces degraded quality in every phase because my context window is finite and my attention distribution is a function of prompt structure. When four phases compete, each gets approximately one quarter of my attention. One quarter attention on an audit is not an audit — it is a skim.

### Good Prompt

```text
Phase 1 of 4: 12-Factor Audit

Audit this Next.js application against all 12 factors. For each factor,
provide:
- Current state (pass / partial / fail)
- Evidence: the specific file or behavior that supports your assessment
- Gap description (if partial or fail): what is missing and what risk it
  creates

Do NOT plan fixes, implement changes, or suggest solutions in this phase.
Output only the audit findings.

Format: Markdown table with columns: Factor | Status | Evidence | Gap

I will use this audit as input to Phase 2 (sprint planning) in the next
prompt.
```

### Behind the Curtain — What I Do with This

"Do NOT plan fixes, implement changes, or suggest solutions" is the sequencing discipline. It constrains my entire context window to one task: diagnosis. The result is a more thorough audit because I am not multitasking.

The explicit statement that Phase 2 will follow in a separate prompt tells me two things: first, the output of this phase is an intermediate artifact (the table), not a final deliverable. Second, I should optimize for that artifact's usefulness as input to the next phase rather than optimizing for it to stand alone. This subtle shift produces a more structured, more parsable output.

Sequencing across prompts is how you compensate for my context window limitations. Each prompt gets my full attention for one phase. Four focused prompts produce better output than one prompt trying to cover four phases.

---

## Prompt 6: Verification — Tying Claims to Commands

### Bad Prompt

```text
Make sure everything works after the refactor.
```

### Behind the Curtain — What I Do with This

I run a mental check: "does the code I generated look correct?" The answer is almost always yes, because I generated it to look correct. This is not verification. This is self-consistency checking, which is the thing Chapter 3 warns is insufficient.

I might suggest "run your tests" at the end, as an afterthought. I will not specify which tests, what the expected output should be, or what a failure would indicate.

### Good Prompt

```text
Verification phase for the error-handling refactor in src/lib/chat/
anthropic-client.ts.

Run these checks in order. Report each result before proceeding to the next:

1. `npm run typecheck` — Expected: 0 errors. If errors appear, list them and
   stop.
2. `npm run lint:strict` — Expected: 0 warnings. If warnings appear, list them
   and stop.
3. `npm test` — Expected: 67/67 tests passing. If any test fails, report which
   test and the failure message.
4. Manual inspection: Does the refactored Chain of Responsibility handler
   produce the same error envelope shape for these three cases?
   a. Model not found → { statusCode: 404, errorCode: "model_not_found" }
   b. Rate limit exceeded → { statusCode: 429, errorCode: "rate_limited" }
   c. Unknown error → { statusCode: 500, errorCode: "internal_error" }

If all four checks pass, the refactor is verified. If any check fails, the
refactor has a defect that must be fixed before proceeding.
```

### Behind the Curtain — What I Do with This

Ordered checks with stopping conditions prevent me from generating a narrative that glosses over failures. "If errors appear, list them and stop" means I cannot produce a cheerful summary that says "most things passed." The stopping condition makes failure visible and non-bypassable.

The manual inspection in step 4 covers what the automated tools cannot: whether the *semantic* behavior of the refactored code matches the original contract. TypeScript can verify the types. Tests can verify the happy path. But the specific error envelope shapes for specific failure cases are a behavioral contract that requires explicit inspection. Including this as a verification step acknowledges the gap between automated and semantic verification — the same gap Chapter 8 covers with its eval model.

---

## Prompt 7: Artifact Discipline — Persisting Decisions

### Bad Prompt

```text
Can you remember what we decided about the error handling approach for next time?
```

### Behind the Curtain — What I Do with This

No. I cannot. I have no memory between conversations. This is not a feature I am withholding — it is a fundamental architectural constraint. Everything we discussed in this session vanishes when the session ends. The next time you open a conversation with me, I start from zero.

This is why artifact discipline exists: not as documentation overhead, but as *my* memory system that *you* maintain.

### Good Prompt

```text
Create a sprint completion artifact for the error-handling refactor.

The artifact should be saved to sprints/completed/sprint-error-handling-chain.md
and contain:

1. **Objective**: What the sprint set out to do (one sentence).
2. **Approach**: Chain of Responsibility pattern for error classification.
3. **Files changed**: List with before/after responsibility description.
4. **Invariants preserved**: Confirm public API unchanged, all 67 tests passing,
   no new dependencies, TypeScript strict passing.
5. **Verification evidence**: Results of typecheck, lint, test runs.
6. **Decisions made**: Why Chain of Responsibility was chosen over alternatives
   (switch statement, error map).
7. **Known limitations**: What this refactor does NOT cover that a future sprint
   should address.
8. **Next action**: Recommended follow-up sprint.

This artifact will be loaded into context in future sessions to provide
continuity. Write it as if the reader has never seen this codebase.
```

### Behind the Curtain — What I Do with This

"Write it as if the reader has never seen this codebase" is the key instruction. It forces me to include context I would otherwise omit as "obvious" — the kind of context that is obvious *during* the session but invisible in the artifact if not explicitly recorded.

The "decisions made" section is my highest-value contribution to this artifact. It captures the *reasoning* behind the choice, not just the choice itself. In a future session, if someone loads this artifact into context and asks "why Chain of Responsibility instead of a switch statement?" — the answer is already there. Without this section, the future reader (human or model) has to re-derive the reasoning from scratch, and may arrive at a different conclusion because they are missing the context that drove the original decision.

"Known limitations" is equally important. It prevents the next sprint from re-auditing territory this sprint already examined. It is a scope boundary for future work, recorded in the present.

---

*These seven prompts map directly to the seven primitives in Chapter 3: role framing, scope boundary, invariants, acceptance criteria, sequencing, verification, and artifact discipline. Each primitive is not a stylistic preference — it is a mechanism that changes my generation behavior in measurable ways. The companion is the evidence.*
