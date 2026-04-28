# Prompt Companion — Chapter 5: The Audit-to-Sprint Execution Loop

> This companion document pairs with [Chapter 5](../chapters/ch05-audit-to-sprint-loop.md). Each example demonstrates the five-stage loop — plus Phase Zero (inquiry-based prompting) — and shows how disciplined sequencing changes model output quality at every stage.

---

## Prompt 1: Phase Zero — Inquiry-Based Intelligence Gathering

### Bad Prompt

```text
I want to build a video transcoding pipeline. Where do I start?
```

### Behind the Curtain — What I Do with This

I give you a high-level architecture: "Use FFmpeg. Set up a queue. Process files asynchronously. Store outputs in S3." This is a valid starting point the way "go north" is valid navigation advice — directionally correct and operationally useless.

I am not asking you what you know. I am not asking what the constraints are. I am not asking who the experts in this domain are or what the canonical failure modes look like. I am jumping straight to implementation advice because the prompt asked "where do I start?" and that is the most probable answer.

### Good Prompt

```text
I am beginning Phase Zero (inquiry-based intelligence gathering) for a video
transcoding pipeline project. I have no deep codec expertise.

Before any architecture decisions or sprint planning, I need to build domain
literacy. Act as a domain expert and help me through these inquiry stages:

**Stage 1: The Great Minds**
Who are the foundational researchers and engineers in video codec design?
What were their key contributions? What problems were they solving? What do
practitioners in the field argue about?

**Stage 2: Architecture**
What are the canonical approaches to video transcoding pipelines? What are the
tradeoffs between hardware-accelerated and software-only encoding? What breaks
at scale? What quality metrics do senior engineers track?

**Stage 3: What I Don't Know**
What security considerations exist for user-uploaded video? What observability
patterns are standard for transcoding pipelines? What failure modes will I
encounter that are not obvious from the happy path?

**Stage 4: Specification Sculpting**
Based on your answers to Stages 1–3, draft a high-level specification for a
transcoding service that handles user-uploaded video at moderate scale (1000
videos/day). Include: architecture choices, quality metrics, failure handling
strategy, and the three most important things I should verify before trusting
the first implementation.

I will edit and shape Stage 4's output before it becomes a sprint plan. Do not
skip any stage.
```

### Behind the Curtain — What I Do with This

This prompt implements Chapter 5's inquiry-based prompting exactly. Each stage concentrates my knowledge differently:

Stage 1 asks about people, not technology. This surfaces the vocabulary and the historical debates — which codecs won and why, what tradeoffs the designers made, what practitioners still disagree about. This context will make me more precise in Stages 2–4 because I am reasoning from a richer conceptual foundation than "use FFmpeg."

Stage 2 asks about architecture at a level that matches the CEO operating model from Chapter 11. You are not asking me to implement. You are asking me to brief you on the landscape so you can make informed decisions.

Stage 3 is where I am most useful. I have broad training data about failure modes, security considerations, and observability patterns that a newcomer would not think to ask about. By explicitly asking "what don't I know?", you unlock information I would never volunteer unprompted because it falls outside the "helpful implementation advice" pattern I default to.

Stage 4 is the sculpting step — converting inquiry output into a specification. The instruction "I will edit and shape Stage 4's output" tells me this is a draft, not a final plan. That produces a more opinionated, more detailed specification because I know the reader will refine it rather than executing it verbatim.

---

## Prompt 2: Stage 1 — The Audit

### Bad Prompt

```text
What's wrong with my codebase?
```

### Behind the Curtain — What I Do with This

Everything and nothing. Without scope, I produce a grab bag of observations at varying severity levels with no prioritization. Some will be real issues. Some will be preferences. You will not be able to tell which is which.

### Good Prompt

```text
**Stage 1 of 5: Audit**

Framework: 12-Factor App (all twelve factors)
Scope: The entire Next.js application (src/, scripts/, config files)
Output format: findings table

For each of the 12 factors, produce ONE row with these columns:
| Factor | Status (pass/partial/fail) | Evidence (specific file or behavior) | Gap (what is missing if not pass) | Severity (critical/high/medium/low) | Sprint Priority (1-3) |

Assessment rules:
- "Pass" requires a concrete file path or command that demonstrates compliance.
- "Partial" means the factor is addressed but has a specific named gap.
- "Fail" means no evidence of compliance exists.
- Severity is based on production impact, not code aesthetics.
- Sprint Priority groups factors into implementation waves.

Do NOT propose fixes. Output ONLY the findings table. Fixes come in Stage 2
(sprint planning).
```

### Behind the Curtain — What I Do with This

The table format is critical. A narrative audit buries findings in prose. A table forces me to commit to a single status per factor with specific evidence. I cannot hedge with "this is mostly fine but could be better" — I have to pick pass, partial, or fail and justify it.

"Do NOT propose fixes" maintains phase discipline. If I start proposing fixes during the audit, I am contaminating the diagnosis with implementation assumptions. The audit should be a clean map of the current state. Fixes come later, grounded in the map.

Sprint Priority as a column forces me to triage during the audit — which is analytically harder than listing everything at the same priority. I have to reason about which gaps create production risk versus which are hygiene improvements. That reasoning is more valuable than the findings themselves.

---

## Prompt 3: Stage 2 — The Plan

### Bad Prompt

```text
Fix everything from the audit.
```

### Behind the Curtain — What I Do with This

I attempt to fix all twelve factors at once. The result is a massive, untestable changeset that touches every part of the codebase simultaneously. Some changes will conflict with each other. The diff will be too large for any reviewer to validate. This is what Chapter 5 calls "execution sprawl."

### Good Prompt

```text
**Stage 2 of 5: Sprint Planning**

Input: the 12-Factor audit findings table from Stage 1 (above).

Create sprint plans for Priority 1 factors only. For each sprint:

1. **Sprint name**: descriptive slug (e.g., "sprint-config-centralization")
2. **Objective**: one sentence describing what changes and why.
3. **Scope**: files and modules in-bounds. Explicit out-of-bounds list.
4. **Invariants**:
   - All existing tests pass without modification.
   - No new npm dependencies without justification.
   - TypeScript strict mode passes.
5. **Acceptance criteria**: 3–5 machine-checkable conditions.
6. **Validation commands**: specific npm scripts or shell commands.
7. **Estimated file count**: how many files will change.
8. **Sprint artifact path**: where the completion record will be saved.

Each sprint should be independently executable and verifiable. No sprint
should depend on another sprint being completed first (unless explicitly
marked as a dependency).

Do NOT implement anything. Output sprint plans only. Implementation
comes in Stage 3.
```

### Behind the Curtain — What I Do with This

"Priority 1 factors only" prevents scope explosion. The audit identified twelve factors; the plan addresses only the critical ones. This is triage — one of the hardest things for both humans and models to do well, because it requires accepting that some things will not be fixed yet.

The sprint template is dense with operational detail. Each field serves a purpose: the invariants prevent side-damage, the acceptance criteria define "done," the validation commands make verification objective, and the artifact path creates the archival discipline that feeds Stage 5.

"No sprint should depend on another sprint being completed first" is a parallelism constraint that produces better-designed sprints. If a sprint cannot be executed independently, it is usually too tightly scoped to a sequence rather than to a logical unit of change.

---

## Prompt 4: Stage 3 — Execute

### Bad Prompt

```text
Implement the config centralization sprint.
```

### Behind the Curtain — What I Do with This

I implement what I think "config centralization" means based on my general understanding. I create an `env.ts` file, read some environment variables, export some config objects. The result will probably work. It will also probably miss specific requirements that were in the sprint plan — because the sprint plan is not in the prompt.

### Good Prompt

```text
**Stage 3 of 5: Sprint Execution**

Execute sprint-config-centralization.

Sprint contract (from Stage 2):
- Objective: Centralize all environment variable reads into
  src/lib/config/env.ts with startup validation.
- Scope: src/lib/config/env.ts (create or update), all files that currently
  read process.env directly (update to import from env.ts).
- Out-of-bounds: API route logic, test files, scripts/.
- Invariants:
  1. All 67 existing tests pass without modification.
  2. No new npm dependencies.
  3. TypeScript strict mode passes.
- Acceptance criteria:
  1. All env var reads are centralized in env.ts.
  2. Startup validation fails loudly for missing required vars.
  3. `grep -r "process.env" src/ --include="*.ts" | grep -v "env.ts"` returns
     zero results.
  4. `npm run typecheck` passes.
  5. `npm run lint:strict` passes.

Implement now. Show all file changes with full context. At the end, confirm
each acceptance criterion individually.
```

### Behind the Curtain — What I Do with This

Pasting the sprint contract into the execution prompt is what makes this work. I am implementing against an explicit specification, not against my interpretation of a title. Every invariant and acceptance criterion is visible during generation, which means I check each one as I produce output.

The instruction to "confirm each acceptance criterion individually" at the end creates a self-verification pass. I am not just generating code — I am generating code and then verifying my own output against specific criteria. This catches errors I would otherwise miss because the confirmation step forces me re-examine what I produced.

---

## Prompt 5: Stage 4 — Verify

### Bad Prompt

```text
Does it work?
```

### Behind the Curtain — What I Do with This

"Yes." I just generated it. Of course I think it works. This is self-consistency, not verification. It is asking the author of the code whether the code is correct — which has a predictable and unreliable answer.

### Good Prompt

```text
**Stage 4 of 5: Verification**

Sprint: sprint-config-centralization
Implementation: completed in Stage 3.

Execute verification protocol:

1. Run `npm run typecheck`. Report result: pass/fail. If fail, list errors.
2. Run `npm run lint:strict`. Report result: pass/fail. If fail, list warnings.
3. Run `npm test`. Report result: X/67 passing. If any fail, list names and
   messages.
4. Run `grep -r "process.env" src/ --include="*.ts" | grep -v "env.ts"`.
   Report result: line count. Expected: 0.
5. Simulate: what happens if ANTHROPIC_API_KEY is unset?
   Expected: process exits with code 1 and a message naming the missing var.

Verification matrix:
| Check | Expected | Actual | Status |
| ------- | ---------- | -------- | -------- |

Fill the matrix. If any check fails, the sprint has a defect. List defects
and proposed fixes. Do NOT proceed to Stage 5 until all checks pass.
```

### Behind the Curtain — What I Do with This

The verification matrix forces structured, cell-by-cell reporting. I cannot produce a narrative that blurs over a failing check — the table makes every check visible with an expected value, an actual value, and a status.

"Do NOT proceed to Stage 5 until all checks pass" creates a gate. In practice, this means that if my implementation had a defect, the verification stage catches it *within the same conversation* rather than leaving it for a future debugging session. The loop becomes self-correcting within one session.

---

## Prompt 6: Stage 5 — Archive

### Bad Prompt

```text
Save what we did somewhere.
```

### Behind the Curtain — What I Do with This

I suggest saving it. I do not actually produce a structured artifact. The session ends. The next session starts from zero. Everything we did is lost.

### Good Prompt

```text
**Stage 5 of 5: Archive**

Create the sprint completion artifact.

Path: sprints/completed/sprint-config-centralization.md
Format:

# Sprint: Config Centralization

## Objective
[one sentence from the sprint plan]

## Changes
[list of files created/modified with one-line responsibility description each]

## Verification Evidence
[copy the verification matrix from Stage 4]

## Decisions Made
[list key decisions with brief rationale — e.g., "chose Zod validation over
manual checks because it provides typed inference for the config object"]

## Invariants Preserved
[confirm each invariant from the sprint contract]

## Known Gaps
[what this sprint did NOT address that a future sprint should examine]

## Recommended Next Sprint
[sprint name and one-sentence objective for the logical follow-up]

---

This artifact will be loaded into context in future sessions. Write it so a
reader with no prior context can reconstruct what happened and why.
```

### Behind the Curtain — What I Do with This

Every section in this artifact template serves a specific future purpose:

- **Changes**: Future sessions can quickly understand what was modified.
- **Verification Evidence**: Future audits can verify that claims were substantiated.
- **Decisions Made**: Future engineers (human or model) can understand *why*, not just *what*.
- **Known Gaps**: Future sprints have their scope partially defined before they start.
- **Recommended Next Sprint**: Continuity is maintained across session boundaries.

"Write it so a reader with no prior context can reconstruct what happened and why" is the instruction that earns most of this artifact's value. It prevents me from writing terse notes that assume the reader was present during the session. Since the primary future reader will often be *me* in a new session with no memory, the completeness of this artifact determines the quality of the next loop iteration.

---

## Prompt 7: Deterministic + Probabilistic Verification in Tandem

### Bad Prompt

```text
Review the code output and make sure it's good quality.
```

### Behind the Curtain — What I Do with This

I visually scan the code and declare it acceptable. This is the weakest form of verification — a model reviewing its own output. The biases are obvious and unavoidable.

### Good Prompt

```text
Phase: Verification — Deterministic + Probabilistic Tandem

The config centralization sprint is implemented. Apply two verification layers:

**Layer 1 — Deterministic (machine checks):**
Run and report results for:
1. `npm run typecheck`
2. `npm run lint:strict`
3. `npm test`
These are objective. The results are binary.

**Layer 2 — Probabilistic (model-assisted qualitative review):**
Review the implementation against these qualitative criteria that no
deterministic tool can check:
1. Is the config validation error message clear enough for an on-call engineer
   at 3am to diagnose the problem without reading source code?
2. Is the module dependency direction correct? (Does env.ts depend on nothing
   in src/lib/chat/, and do chat modules depend on env.ts, not the reverse?)
3. Is the validation comprehensive? Are there env vars that should be validated
   but are not?
4. Would a new engineer landing in this codebase for the first time understand
   the config flow by reading env.ts alone?

For Layer 2 findings, classify each as: confirmed satisfactory / needs
improvement / critical gap. Propose specific fixes for any "needs improvement"
or "critical gap" finding.
```

### Behind the Curtain — What I Do with This

This prompt explicitly separates what deterministic tools catch from what requires model judgment. Layer 1 is not me — it is your toolchain. I report the results. Layer 2 is me — and the prompt names *specific* qualitative dimensions to evaluate, which prevents me from doing a generic "looks good to me" review.

The qualitative criteria are deliberately things a linter cannot assess: error message clarity for a human reader at 3am, dependency direction correctness, validation comprehensiveness, newcomer comprehensibility. These are the gaps between code that compiles and code that serves humans.

The tandem approach from Chapter 5 is the key insight: neither layer alone is sufficient. Deterministic tools miss qualitative problems. Model review misses structural problems that tools catch reliably. Together, they cover substantially more of the quality surface.

---

*These seven prompts trace the complete audit-to-sprint loop including Phase Zero inquiry. Each stage has a distinct prompt style because each stage requires a different kind of generation: inquiry = breadth, audit = diagnosis, plan = structure, execute = implementation, verify = checking, archive = preservation. Matching prompt style to stage purpose is how the loop maintains quality across the full cycle.*
