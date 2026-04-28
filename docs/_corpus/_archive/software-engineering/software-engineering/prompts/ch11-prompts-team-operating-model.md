# Prompt Companion — Chapter 11: Team Operating Model

> This companion document pairs with [Chapter 11](../chapters/ch11-team-operating-model.md). Each prompt pair demonstrates how to make team structure, role separation, and the CEO operating model concrete in your prompts — and what happens when these structures remain implicit.

---

## Prompt 1: Explicit Role Separation in Solo Work

### Bad Prompt

```text
Help me plan and build a new feature for my app.
```

### Behind the Curtain — What I Do with This

I simultaneously play architect, implementer, verifier, and operations steward — without telling you which role is driving which decision. The architecture choices, implementation tradeoffs, testing strategy, and deployment considerations all blend together in a single response. You cannot inspect which role was active when I made a particular judgment call. If the architecture was wrong, you will not discover it until implementation is underway — because by then, I have already committed to one approach.

### Good Prompt

```text
I'm working solo on this project and need to add a new MCP tool (a URL
shortener). I'll use explicit role switching as described in Chapter 11.

PHASE 1 — Architecture Lead role:
- What are the architectural options for adding a URL shortener as an
  MCP tool?
- Which option best fits the existing architecture split between Next.js
  (orchestration) and MCP (deterministic execution)?
- What system boundaries should this tool respect?
- What should this tool NOT do? (Define the negative scope.)

Do NOT begin implementation. Output only the architecture decision and
its rationale.

I will review your architecture recommendation before switching to the
Orchestration Lead role to define the sprint.
```

### Behind the Curtain — What I Do with This

The explicit role constraint — "Architecture Lead only, do NOT begin implementation" — forces me to hold one perspective at a time. When I am in architecture mode, I evaluate options, consider system boundaries, and define constraints. I am not tempted to jump into code because the prompt forbids it.

The "I will review before switching roles" statement introduces a checkpoint. In a team, this would be a handoff between people. For a solo practitioner, it is a handoff between phases. The review moment is where you assess the architecture decision on its own terms before committing to implementing it.

The negative scope question — "what should this tool NOT do?" — is architecture work that implementation does not naturally produce. If you skip the architecture role and go straight to building, you discover the boundary violations after the code exists.

---

## Prompt 2: Sprint Decomposition with the Orchestration Lead Role

### Bad Prompt

```text
Break this feature into tasks.
```

### Behind the Curtain — What I Do with This

I produce a task list: "Create file X, add function Y, write tests for Z, update config." This is a to-do list, not a sprint plan. It has no acceptance criteria, no invariants, no validation commands, and no handling for what should happen if something fails. It decomposes the *work* without decomposing the *verification*.

### Good Prompt

```text
Role: Orchestration Lead (Chapter 11)

The Architecture Lead decided: the URL shortener will be an MCP tool in
mcp/url-shortener-server.ts with explicit schema, validation, and
deterministic execution. It will NOT store URLs persistently (stateless
shortening using a hash function).

Convert this architecture decision into a sprint plan:

1. **Scope**: What files will be created or modified? Enumerate them.
2. **Invariants**: What must remain true throughout implementation?
   - All existing tests continue to pass.
   - TypeScript strict mode passes.
   - ESLint zero-warnings passes.
   - The existing calculator tool is not affected.
3. **Acceptance Criteria** (each must be testable):
   a. MCP tool schema defines input (url: string) and output (short_url: string).
   b. Invalid URLs are rejected with a typed error, not a generic failure.
   c. The same URL always produces the same short URL (deterministic).
   d. The tool handles edge cases: empty string, non-URL string, extremely
      long URLs.
   e. A new test file validates all four edge cases.
4. **Validation Commands**:
   - `npm run typecheck` — passes
   - `npm run lint:strict` — passes (if available) or `npm run lint` — passes
   - `npm test` — all tests pass including new ones
5. **Handoff to Verifier**: What evidence must the implementer produce for
   the Verifier to validate completion?

Output format: Sprint document matching the structure in sprints/.
```

### Behind the Curtain — What I Do with This

The architecture decision is passed as context — I did not make it in this prompt. This simulates the handoff from Architecture Lead to Orchestration Lead. The decision is fixed; my job is to decompose it into executable acceptance criteria.

The invariants section defines what MUST NOT break. This is different from acceptance criteria (what must be true when done). Invariants constrain the implementation path: I cannot satisfy criterion (a) in a way that violates invariant "all existing tests continue to pass." This dual constraint — acceptance criteria plus invariants — produces sprint plans that are both constructive and protective.

The handoff-to-Verifier question at the end defines what "done" means in terms another role can evaluate. It is not "I finished the code." It is "here is the evidence you need to confirm completion." This is the artifact discipline from Chapter 3 applied to team process.

---

## Prompt 3: The CEO Operating Model — Building in an Unfamiliar Domain

### Bad Prompt

```text
Build me a video transcoding service. I don't know much about video codecs.
```

### Behind the Curtain — What I Do with This

I build a video transcoding service using reasonable defaults. The codec choices, quality parameters, and encoding settings will be technically valid but optimized for my training distribution, not for your specific use case. You will not know whether the choices are optimal because you skipped the inquiry phase. The service will work. Whether it works *well for your audience* is a question neither of us can answer without the domain context that the inquiry phase would have provided.

### Good Prompt

```text
I need to build a video transcoding service but I don't have deep codec
expertise. I'll use the CEO operating model from Chapter 11.

PHASE 1 — Inquiry (I'm the CEO; you're the domain expert):
Before any implementation, I need you to brief me on:

1. What are the key codec choices (H.264, H.265, AV1) and what are the
   tradeoffs between them? (compatibility vs. compression vs. quality)
2. Which researchers and engineers defined the perceptual quality metrics
   I should care about? (SSIM, VMAF — who created them and why?)
3. What breaks in practice? (High-motion scenes, dark content, mixed-content
   streams — where do codecs typically fail?)
4. What are the 3 most important parameters I need to specify in a
   transcoding pipeline? (The ones that, if wrong, produce visibly bad output.)
5. What should I test that I wouldn't think to test without domain expertise?

Do not build anything yet. I need to understand the domain before I write
the specification.

After I process your briefing, I'll write the specification myself and bring
it back for the implementation phase.
```

### Behind the Curtain — What I Do with This

The CEO operating model prompt makes me the domain expert being consulted, not the autonomous implementer. This is the critical distinction from Chapter 11: the CEO gathers domain knowledge through structured inquiry, then writes the specification, then has the work executed to that specification.

By asking me for a domain briefing first, you build the literacy required to evaluate my implementation later. If you skipped this and said "just build it," you would have no basis for assessing whether my codec choices, quality parameters, and failure handling were appropriate. The inquiry phase earns the standing to evaluate the work.

The question about researchers and engineers (question 2) applies the Chapter 0 philosophy: understanding who built these tools and why gives you better intuition for how to use them. VMAF was created by Netflix engineers to model human perception of streaming video quality — knowing that context tells you it is the right metric for streaming use cases and possibly wrong for other use cases.

---

## Prompt 4: Handoff Contracts Between Roles

### Bad Prompt

```text
I finished the implementation. Please review it.
```

### Behind the Curtain — What I Do with This

I review whatever code I can see, looking for obvious issues. Without a handoff contract, I do not know: what the code was supposed to do, what constraints it was supposed to respect, what acceptance criteria it was supposed to meet, or where the validation evidence should be. My review becomes a general code review rather than a verification of a specific contract. I may catch bugs, but I cannot verify intent.

### Good Prompt

```text
Role: Verifier (Chapter 11)

I'm handing off the URL shortener implementation for verification.
Here is the handoff package per Chapter 11's template:

**Objective**: Add MCP URL shortener tool per the sprint plan in
sprints/sprint-url-shortener.md.

**Non-negotiable constraints**:
- All existing tests still pass.
- TypeScript strict mode passes.
- ESLint zero-warnings passes.
- Calculator tool unaffected.

**Acceptance criteria**:
1. Schema defines input (url: string) and output (short_url: string).
2. Invalid URLs rejected with typed error.
3. Same URL → same short URL (deterministic).
4. Edge cases handled: empty string, non-URL, extremely long URL.
5. Test file covers all four edge cases.

**Validation commands**:
- npm run typecheck
- npm run lint:strict (or npm run lint)
- npm test

**Files to verify**: mcp/url-shortener-server.ts, __tests__/url-shortener.test.ts

Please verify:
1. Run each validation command mentally (or identify what would fail).
2. Check each acceptance criterion against the implementation.
3. For any criterion that is NOT met, state exactly what is missing.
4. For any criterion that IS met, cite the specific code that satisfies it.
5. Overall verdict: PASS, PASS WITH NOTES, or FAIL.
```

### Behind the Curtain — What I Do with This

With the full handoff contract, my verification is *structural*, not impressionistic. I check each acceptance criterion against the code. I run each validation command (or reason about whether they would pass). I can give a binary verdict per criterion rather than a vague "looks good."

The distinction between PASS, PASS WITH NOTES, and FAIL gives the verification three outcomes instead of two. "Pass with notes" means: the acceptance criteria are met, but I noticed something the criteria did not cover that is worth addressing. This prevents the verification from being either a rubber stamp (everything is fine) or a blocker (I found something so you cannot merge). Notes capture observations without blocking progress.

This is the Verifier role operating as described in Chapter 11: owning objective validation gates and quality evidence collection. The handoff contract gives the Verifier everything needed to do the job without needing to reconstruct the implementation context.

---

## Prompt 5: Running a Complete Ritual Cycle

### Bad Prompt

```text
Help me run a sprint for my project.
```

### Behind the Curtain — What I Do with This

I create a list of things to build and help you build them. This is a work session, not a sprint. A sprint in the Chapter 11 sense has four ritual checkpoints — audit review, sprint kickoff, validation checkpoint, archive review — and each produces a durable artifact. Without the ritual structure, the work gets done but the method is not captured, and the next sprint starts from scratch.

### Good Prompt

```text
Guide me through a complete Chapter 11 ritual cycle for this project.
We will execute all four rituals in sequence.

RITUAL 1 — Audit Review:
Examine the current codebase and identify 3–5 findings that warrant
attention. For each finding:
- Severity (critical / high / medium / low)
- Category (structural, operational, testing, documentation)
- One-line description
Prioritize by severity. We will select the top findings for the sprint.
Output: prioritized findings list.

[I will review and select which findings to address]

RITUAL 2 — Sprint Kickoff:
For the selected findings, produce a sprint document with:
- Scope and non-scope
- Invariants
- Acceptance criteria (testable)
- Validation commands
- Estimated effort
Output: sprint document following the template in sprints/.

[I will review and approve the sprint plan]

RITUAL 3 — Validation Checkpoint:
After implementation, run validation:
- Execute all validation commands from the sprint plan
- Compare results against acceptance criteria
- Report: which criteria pass, which fail, what needs correction
Output: validation report with pass/fail per criterion.

RITUAL 4 — Archive Review:
After all criteria pass:
- Move the sprint document to sprints/completed/
- Add a summary section: what was decided, what was deferred, what surprised us
- Note any unresolved questions for the next audit
Output: completed sprint artifact.

Begin with Ritual 1. Perform the audit review now.
```

### Behind the Curtain — What I Do with This

The four-ritual structure maps directly to Chapter 11's core rituals. Each ritual has a defined output artifact, and each depends on the previous ritual's output as input. This creates a chain of accountability: the audit produces findings → the kickoff converts findings into acceptance criteria → the validation checks criteria → the archive preserves the record.

The checkpoints between rituals — "[I will review and select]", "[I will review and approve]" — maintain human governance at each transition. These are the moments where you exercise judgment: which findings are worth addressing, whether the sprint plan's scope is right, whether to continue or adjust. Without these checkpoints, I would run the entire cycle without your input, which is execution without governance.

The archive review (Ritual 4) is the ritual most teams skip and the one that compounds most. Each archived sprint becomes starting context for the next audit. Over multiple cycles, the archive becomes a decision history that prevents repeated mistakes and provides onboarding context. Skip the archive and every sprint starts from zero.

---

*These prompts operationalize Chapter 11's core structure: team effectiveness in AI-assisted engineering comes from explicit role boundaries, structured handoffs, and ritual checkpoints that produce durable artifacts. The CEO operating model extends this to unfamiliar domains — you do not need mastery, you need structured inquiry, specification discipline, and layered verification. Whether you are a team of four or a solo practitioner, the discipline is the same: separate the roles, define the handoffs, and let each phase produce the artifact that the next phase needs.*
