# Prompt Companion — Chapter 9: Risk, Safety, and Operational Governance

> This companion document pairs with [Chapter 9](../chapters/ch09-risk-safety-and-governance.md). Each prompt pair demonstrates how to build executable governance — and what happens when governance is policy on paper rather than gates in code.

---

## Prompt 1: Setting Up the Composite Quality Gate

### Bad Prompt

```text
Set up some quality checks for my code.
```

### Behind the Curtain — What I Do with This

I add a linter and maybe a test runner. They will be configured with defaults. The linter allows warnings. The tests run but nothing blocks on them. You now have quality tools that provide information without enforcement. This is governance theater — the tools exist but nothing prevents bad code from shipping.

### Good Prompt

```text
Implement the three-layer composite governance gate described in Chapter 9.

Layer 1 — TypeScript Strict Mode:
- Verify tsconfig.json has "strict": true.
- Create/update npm script "typecheck": "tsc --noEmit"
- This catches: type mismatches, implicit any, null safety violations.
- Gate: build fails if typecheck fails.

Layer 2 — ESLint at Zero-Warnings Tolerance:
- Create/update npm script "lint:strict": "eslint . --max-warnings 0"
- Configuration must include:
  - @typescript-eslint/no-explicit-any: error
  - no-unused-vars: error
  - import type enforcement
  - jsx-a11y rules at error level (not warning)
- Gate: build fails if any warning exists.

Layer 3 — Lighthouse at Score Thresholds:
- .lighthouserc.js must enforce:
  - Performance ≥ 90
  - Accessibility = 100
  - Best Practices ≥ 95
  - SEO ≥ 90
- Gate: CI fails if any threshold is not met.

Composite script — npm script "quality":
- Runs typecheck, then lint:strict, then test sequentially.
- Fails on the first failure (short-circuit).
- Lighthouse runs separately via "lhci:dev" against a live server.

Acceptance criteria:
1. `npm run quality` runs all three deterministic gates.
2. Introducing an `any` type causes quality to fail.
3. Introducing an unused import causes quality to fail.
4. Removing an aria-label from a form input causes Lighthouse Accessibility
   to drop below 100.
5. Each gate produces machine-readable output (exit codes, not just text).

Invariants: Existing code must pass all gates before any changes. If current
code fails any gate, fix the code first — do not weaken the gate.
```

### Behind the Curtain — What I Do with This

The three-layer structure maps directly to Chapter 9's governance model: source structure (TypeScript), policy compliance (ESLint), runtime delivery (Lighthouse). Each layer catches failures the others cannot see.

The acceptance criteria test the gates *as gates* — not just as tools. Criteria 2, 3, and 4 verify that violations are actually caught and fail the build. This is the difference between having quality tools and having governance: governance *enforces*, tools *inform*.

The final invariant — "fix the code, do not weaken the gate" — prevents the most common governance failure: when existing code does not pass a new gate, the gate gets weakened to match the code. The invariant establishes that the gate defines the standard, and the code must rise to meet it.

---

## Prompt 2: Secret and Config Risk Assessment

### Bad Prompt

```text
Make sure my API keys are safe.
```

### Behind the Curtain — What I Do with This

I suggest `.env` files and `.gitignore`. This is the bare minimum and does not address the operational risks: keys that are set in some environments but not others, keys that are committed and then removed (still in git history), keys that are valid in development but expired in production.

### Good Prompt

```text
Risk domain: Secret and Config Risk (Chapter 9, domain 1)

Perform a security audit of secret handling in this codebase:

1. **Committed secrets scan**: Run `grep -rn "sk-ant\|ANTHROPIC_API_KEY=\|api_key.*=" src/ scripts/ --include="*.ts" --include="*.mjs" --include="*.env"` and report any hardcoded secrets.

2. **Git history exposure**: Is there a risk that secrets were committed in previous commits and removed? (Check for .env files in git log.)

3. **Validation audit**: Does the application validate that required secrets exist at startup? What happens if ANTHROPIC_API_KEY is:
   a. Missing entirely
   b. Set to an empty string
   c. Set to an invalid value (wrong format)

4. **Rotation readiness**: If a secret needs to be rotated in production, what is the process? How many files need to change? Is there downtime?

For each finding:
- Classify as: critical (active exposure) / high (potential exposure) /
  medium (operational risk) / low (hygiene)
- Propose a specific fix
- Define the verification command that proves the fix works

Create a governance artifact: scripts/scan-secrets.mjs that can be run
in CI to detect hardcoded secrets. The script should:
- Scan all source files for patterns matching API key formats
- Exit 0 if clean, exit 1 if any matches found
- Be executable as part of the quality gate
```

### Behind the Curtain — What I Do with This

The specific grep pattern in step 1 gives me a concrete starting point rather than a vague "check for secrets." The pattern includes Anthropic-specific key prefixes and common assignment patterns, which catches the most probable exposure in this codebase.

The three empty/invalid/missing scenarios in step 3 test the validation boundary comprehensively. Most implementations validate for "missing" but not for "empty string" or "wrong format" — leaving operational gaps that only surface in production when a config change goes wrong.

The scan-secrets.mjs script converts a one-time audit into a repeatable governance gate. This is the Chapter 9 principle: governance that runs once is an audit; governance that runs on every commit is a gate.

---

## Prompt 3: Orchestration Drift Detection

### Bad Prompt

```text
How do I prevent my AI prompts from drifting?
```

### Behind the Curtain — What I Do with This

I suggest versioning your prompts and testing them. These are real practices, but the answer is shallow because the prompt does not define what "drift" means in the context of your system. Drift is not one thing — it is a category of risks that Chapter 9 breaks into specific failure modes.

### Good Prompt

```text
Risk domain: Orchestration Drift Risk (Chapter 9, domain 4)

Orchestration drift occurs when prompt contracts, model behavior, and process
assumptions evolve at different speeds.

Audit this system for drift risk across three dimensions:

1. **Prompt-model drift**: The system prompt was written for claude-haiku-4-5.
   If the model is upgraded, which prompt assumptions might break?
   - Analyze the system prompt for model-specific assumptions (token limits,
     tool-calling format, response structure expectations).
   - For each assumption, classify as: model-independent (safe) or
     model-dependent (drift risk).

2. **Contract-implementation drift**: The MCP calculator tool schema defines
   expected inputs and outputs. Does the implementation match the schema
   exactly, or are there undocumented behaviors?
   - Compare the tool schema to the actual implementation.
   - Flag any behavior not captured in the schema.

3. **Artifact-reality drift**: Sprint artifacts in sprints/completed/ describe
   the system's expected state. Does the current code match the most recent
   sprint's claims?
   - Take the most recent completed sprint. Does the verification evidence
     still hold? Run the commands and compare.

For each drift finding:
- Name the specific drift type.
- Assess severity (the probability and impact of the drift causing a
  production issue).
- Propose a control mechanism (a repeatable check that detects this drift
  automatically).

Acceptance criteria:
1. Audit covers all three drift dimensions.
2. Each finding has a specific control mechanism.
3. At least one control mechanism is implementable as a CI check.
```

### Behind the Curtain — What I Do with This

The three-dimension structure prevents me from treating "drift" as a monolithic concept. Prompt-model drift, contract-implementation drift, and artifact-reality drift are different failure modes with different detection mechanisms. Separating them produces targeted controls instead of a generic "test your prompts" recommendation.

The artifact-reality drift analysis is particularly valuable because it turns existing sprint archives into regression baselines. If the most recent sprint claimed "all 67 tests pass" and that claim no longer holds, the drift is detected. This gives the archive system from Chapter 5 a governance function — it is not just documentation, it is a drift-detection mechanism.

---

## Prompt 4: Deploying AI-Generated Code Safely

### Bad Prompt

```text
How do I make sure AI-generated code is safe to deploy?
```

### Behind the Curtain — What I Do with This

I list general practices: code review, testing, CI gates. These are correct for any code. They do not address the specific risks of AI-generated code at velocity — the scale problem Jack Clark described in Chapter 9: more change, faster, with less human review per line.

### Good Prompt

```text
A team member used an AI assistant to generate 400 lines of code across
4 files in 20 minutes. The code compiles, tests pass, and a cursory manual
review shows nothing obviously wrong.

Apply Chapter 9's governance framework to determine whether this code is
safe to merge:

1. **Deterministic gates — already run:**
   - TypeScript strict: passed
   - ESLint zero-warnings: passed
   - npm test: 67/67 passing

2. **Deterministic gates — additional checks needed:**
   - What specific checks should be run that the standard gates might miss
     for AI-generated code? (Think: dependency changes, bundle size impact,
     accessibility of new UI elements, import graph changes.)

3. **Probabilistic review — what a model-assisted review should assess:**
   - Which of these 400 lines need human attention most? (Rank by risk.)
   - What patterns in AI-generated TypeScript are most likely to introduce
     subtle bugs that pass type checking?
   - What questions should the reviewer ask that the tools cannot answer?

4. **Governance artifact:**
   - Write the PR review checklist for AI-generated code (distinct from the
     normal review checklist). 8–10 items, each testable.

Acceptance criteria:
1. The additional deterministic checks are executable commands.
2. The review priorities identify specific risk patterns, not generic advice.
3. The PR checklist is usable by a reviewer who is not the code's author and
   did not see the generation session.
```

### Behind the Curtain — What I Do with This

The specific scenario (400 lines, 4 files, 20 minutes) makes the velocity problem concrete. This is not abstract governance — it is a real situation with a real decision: should this code merge?

Step 3 — "which of these 400 lines need human attention most" — asks me to triage the review effort. This is the governance response to velocity: you cannot review every line at the same depth, so the governance system should direct human attention to the highest-risk areas.

The AI-specific PR checklist in step 4 is the operational artifact. A normal review checklist asks "does this code work?" An AI-specific checklist asks additional questions: "does this code introduce unnecessary abstraction?", "does this code duplicate logic that already exists in a module the generator did not see?", "are the variable names meaningful or are they LLM-plausible but contextually wrong?" These questions address failure modes specific to AI generation.

---

## Prompt 5: Clark's Governance Principle in Practice

### Bad Prompt

```text
What does AI governance look like?
```

### Behind the Curtain — What I Do with This

I describe policy frameworks, ethics boards, and organizational practices. These are valid at the enterprise level and useless at the codebase level. The prompt does not specify which level of governance it is asking about, so I default to the broadest, most policy-oriented interpretation.

### Good Prompt

```text
Jack Clark's governance thesis from Chapter 9: as AI systems generate more
code, governance must shift from "did a human review this?" to "can the
system make AI output observable enough for meaningful human oversight?"

Apply this thesis to this repository. Design a governance dashboard (even
if conceptual) that answers these questions for a project lead:

1. **Velocity visibility**: How much code was generated by AI vs. written by
   humans in the last sprint? (Even approximate signals.)
2. **Quality signal**: What is the composite quality gate pass rate? Has it
   changed since AI-assisted development began?
3. **Drift signal**: Are there sprint artifacts that describe a state the
   codebase no longer matches?
4. **Coverage gap**: Which areas of the codebase have NO deterministic
   governance coverage? (No types, no lint rules, no tests.)
5. **Human bottleneck**: Per Clark's O-ring model, which part of the
   development process is the current human bottleneck? Where should the
   next investment in human attention go?

For each question:
- Data source (what to measure and where to get it)
- Visualization (what the dashboard widget shows)
- Action threshold (when does this signal require human intervention?)

Acceptance criteria:
1. Every dashboard question maps to a measurable data source.
2. At least 3 of 5 can be implemented with existing repository data
   (git log, test results, lint results).
3. The O-ring bottleneck analysis identifies one specific process stage.
```

### Behind the Curtain — What I Do with This

Connecting Clark's macro-level governance thesis to a specific repository makes it practical. Instead of discussing what governance should be in general, I am designing what it looks like *here* — with data sources that actually exist (git log, npm test output, lint results).

The O-ring bottleneck analysis in question 5 applies Clark's automation framework directly. I have to reason about which phase of the development process is least automated and therefore most constraining. This is a strategic question that produces actionable insight: invest human attention (and tool investment) at the bottleneck, not uniformly across all phases.

The requirement that at least 3 of 5 questions can be answered with existing data prevents me from designing an aspirational dashboard that requires infrastructure you do not have. Practical governance works with what exists.

---

*These prompts operationalize Chapter 9's core argument: governance for AI-generated code is not bureaucratic overhead — it is the engineering discipline that makes velocity sustainable. Deterministic tools (TypeScript, ESLint, Lighthouse) provide the machine-speed gate. Structured observability provides the drift-detection layer. Human attention, directed by the O-ring principle to the current bottleneck, provides the judgment layer. All three together make AI-assisted development accountable.*
