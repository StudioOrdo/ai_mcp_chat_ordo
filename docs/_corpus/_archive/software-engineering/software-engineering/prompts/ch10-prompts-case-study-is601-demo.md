# Prompt Companion — Chapter 10: Case Study — IS601 Demo

> This companion document pairs with [Chapter 10](../chapters/ch10-case-study-is601-demo.md). Each prompt pair demonstrates how to extract methodology from lived project history — turning a repository's evolution into a repeatable migration template.

---

## Prompt 1: Building a Phase Timeline from Repository History

### Bad Prompt

```text
Summarize what happened in this project.
```

### Behind the Curtain — What I Do with This

I read whatever files I have access to and produce a narrative summary. The summary will be accurate to the surface level — features were built, refactoring happened, tests were added. It will not organize the history into phases, will not identify the dependencies between phases, and will not distinguish between changes that built on previous guarantees and changes that happened to come in sequence. You get a changelog, not methodology.

### Good Prompt

```text
Analyze this repository's evolution using the four-phase model from
Chapter 10:

Phase 1 — Feature Delivery: What capabilities were added first?
Phase 2 — Structural Cleanup: What decomposition and boundary work followed?
Phase 3 — Operational Hardening: What 12-factor and reliability work came next?
Phase 4 — Extensibility Optimization: What pattern-driven refactors built on
           the hardened foundation?

For each phase:
1. List the specific commits, files, or sprint artifacts that belong to it.
2. Identify the prerequisite guarantee from the previous phase that this
   phase depends on. (Phase 1 has none; Phases 2–4 each depend on something.)
3. Name one thing that would have been riskier or impossible if this phase
   had been attempted before its prerequisite.

Evidence sources:
- sprints/completed/ for sprint artifacts
- git log --oneline for commit history
- src/lib/ for architectural modules
- scripts/ for operational scripts

Acceptance criteria:
1. Every phase has at least one concrete artifact cited.
2. The dependency chain between phases is explicit.
3. The "would have been riskier" analysis is specific, not generic.

Output format: A four-row table with columns: Phase | Key Artifacts |
Prerequisite Guarantee | Risk Without Prerequisite.
```

### Behind the Curtain — What I Do with This

The four-phase model gives me a classification framework that transforms a flat commit history into a structured methodology. Without it, I would describe events chronologically. With it, I can explain *why* they happened in that order.

The "prerequisite guarantee" question is the most valuable part. It forces me to articulate the dependency relationship: Phase 4's GoF refactors were safe *because* Phase 3 had established test coverage and CI gates. Phase 3's operational hardening was manageable *because* Phase 2 had decomposed the monolithic route. Stating these dependencies explicitly converts a project narrative into a repeatable method.

The "would have been riskier" analysis adds a counterfactual that makes the sequencing argument concrete rather than theoretical. Instead of saying "order matters," I have to explain what specifically breaks if the order changes.

---

## Prompt 2: Learning from Failures

### Bad Prompt

```text
What went wrong in this project?
```

### Behind the Curtain — What I Do with This

I scan for error-related files, test failures, or comments mentioning problems. If I find them, I list what went wrong. If I do not, I say "the project appears to be working correctly." Neither response is useful — the first is a list without analysis, and the second misunderstands that every project has failures worth studying.

### Good Prompt

```text
Chapter 10 identifies three specific failures in this project's evolution:

1. Graceful shutdown was missing from the streaming route.
2. The chat API route became a monolith mixing validation, orchestration,
   policy, and error handling.
3. A model alias change (claude-haiku → claude-haiku-4-5) broke without
   warning due to no fallback logic.

For each failure:
a. Which audit or sprint process detected it? (What structured activity
   found the problem?)
b. What was the fix? (Cite the specific file or module that was created
   or modified.)
c. What category of failure is it? Map to the risk domains in Chapter 9:
   secret/config risk, release integrity, runtime safety, or orchestration
   drift.
d. What acceptance criterion, if it had existed in the original task, would
   have prevented this failure from being introduced?
e. Write that acceptance criterion now — phrased so it can be added to
   future sprint templates.

Acceptance criteria:
1. Each failure maps to a specific risk domain.
2. Each preventive acceptance criterion is concrete and testable.
3. The analysis distinguishes between "found by a structured audit" and
   "found by accident."
```

### Behind the Curtain — What I Do with This

Naming the three failures explicitly gives me a bounded analytical task rather than a vague search. The five-part analysis (detection method, fix, risk category, missing criterion, future criterion) creates a structured retrospective that converts each failure into a preventive measure.

The question "what acceptance criterion would have prevented this?" is the pivot point. It turns retrospective analysis into prospective engineering. Instead of just understanding what went wrong, you produce an artifact — a new acceptance criterion — that prevents the same class of failure in future work.

The Chapter 9 risk-domain mapping connects this case study to the governance framework, showing that the failures are not random — they fall into predictable categories that structured governance is designed to catch.

---

## Prompt 3: Creating a Case Study for Your Own Repository

### Bad Prompt

```text
Help me write a case study for my project.
```

### Behind the Curtain — What I Do with This

I ask what the project does and produce a narrative description: it was built, challenges were encountered, outcomes were achieved. This is a project summary, not a case study. A case study in the Chapter 10 sense is a structured analysis of *method* — how the process worked, where it failed, and what the methodology teaches that the outcomes alone do not show.

### Good Prompt

```text
I want to create a Chapter 10-style case study for my project: [describe
project briefly — stack, team size, timeline].

Guide me through this analysis using Chapter 10's structure:

1. **Initial State**: What was the codebase's maturity posture at the start?
   Ask me about:
   - Type safety (any type checking? strict mode?)
   - Test coverage (any tests? what kind?)
   - Operational controls (health checks? graceful shutdown? config management?)
   - Deployment discipline (CI gates? release process?)

2. **Evolution Phases**: Help me classify the changes I've made into the
   four-phase model:
   - Phase 1: Feature Delivery (what capabilities were added?)
   - Phase 2: Structural Cleanup (what decomposition happened?)
   - Phase 3: Operational Hardening (what reliability/12-factor work?)
   - Phase 4: Extensibility (what pattern-driven refactors?)

   If my project didn't follow this exact order, identify what order it
   actually followed and whether the sequencing created any problems.

3. **What Went Wrong**: Ask me about 2-3 specific things that broke, were
   harder than expected, or required correction. For each, help me classify
   the failure and write a preventive acceptance criterion.

4. **Evidence Inventory**: What artifacts exist that prove these claims?
   (Test results, sprint docs, git history, CI logs, quality reports.)

5. **Lessons**: Based on the analysis, what are 3 process-level lessons
   (not code-level fixes) that could transfer to another project?

Format the final output as a case study document with the same section
structure as Chapter 10.
```

### Behind the Curtain — What I Do with This

The guided inquiry structure ensures the case study analysis is thorough without requiring you to know the Chapter 10 framework by heart. Each section maps directly to the chapter's structure while being phrased as questions I can ask you or help you answer.

The "if my project didn't follow this exact order" instruction in section 2 is critical. Real projects rarely follow the ideal phase sequence. By asking me to identify the actual order *and* whether the sequencing caused problems, you get an honest analysis rather than one that forces your project into a structure it doesn't match.

The evidence inventory (section 4) applies Chapter 10's core principle: maturity claims backed by artifacts, not narrative assertion. If you claim your project went through operational hardening, the case study should cite the specific health check endpoint, the graceful shutdown implementation, or the config validation module — not just say "we hardened operations."

---

## Prompt 4: Extracting Transferable Methodology

### Bad Prompt

```text
What lessons can I learn from this project?
```

### Behind the Curtain — What I Do with This

I generate broad lessons: "testing is important," "refactoring should be incremental," "documentation helps." These are true and useless. They are the kind of advice that applies to every project and therefore provides no specific guidance for any project.

### Good Prompt

```text
Chapter 10 identifies four process-level lessons from this repository's
evolution. Evaluate whether each lesson holds in this codebase's current
state, and propose a fifth lesson based on evidence I haven't considered:

Lesson 1: "High-level directives become reliable only when converted into
sprint-scale acceptance criteria."
- Find one example in sprints/completed/ where a high-level directive was
  successfully decomposed into specific acceptance criteria.
- Find one example (if it exists) where a directive remained vague and the
  outcome suffered.

Lesson 2: "Architecture quality grows faster when operational quality is
improved in parallel."
- Does the current codebase show operational controls (health endpoints,
  graceful shutdown, release scripts) that existed *before* the GoF pattern
  refactors?
- Would the GoF refactors have been riskier without them? Why specifically?

Lesson 3: "Pattern refactors are safer after strong regression gates."
- What regression gates existed before Phase 4? (Tests, lint, type checking.)
- Can I verify this claim? What command would I run to see the gate?

Lesson 4: "Durable artifacts reduce context loss across multi-phase execution."
- Do the sprint archives in sprints/completed/ provide enough context for
  a new contributor to understand what happened and why?
- What is missing from the archives that would help?

Lesson 5 (proposed):
- Based on your analysis of the full codebase, what process-level lesson
  is visible in the evidence but NOT named in Chapter 10?
- State the lesson, cite the evidence, and explain why it transfers.

Acceptance criteria:
1. Each lesson evaluation cites specific files or artifacts.
2. The "would have been riskier" analysis in Lesson 2 is concrete.
3. Lesson 5 is genuinely different from Lessons 1–4.
```

### Behind the Curtain — What I Do with This

Evaluating each lesson against specific evidence converts abstract principles into testable claims. Instead of taking the lessons on faith, you are asking me to verify them — treating the methodology chapter as a set of hypotheses that the codebase either supports or challenges.

Lesson 5 — "propose a lesson I haven't named" — is the most challenging part. It asks me to reason about the codebase independently rather than confirming what the chapter already says. This is where the companion prompt produces genuinely new insight rather than restating existing material.

The acceptance criterion that Lesson 5 "is genuinely different from Lessons 1–4" prevents me from rephrasing an existing lesson. I have to find a distinct process-level insight — something like "the model's own failure notes (the 'notes from the model' in Chapters 10 and 11) serve as debugging aids for future prompt construction" or "the four-phase model works as a diagnostic tool for identifying which phase a struggling project is stuck in."

---

## Prompt 5: Using Case Studies for Team Onboarding

### Bad Prompt

```text
How do I onboard new team members to this project?
```

### Behind the Curtain — What I Do with This

I create a standard onboarding guide: clone the repo, install dependencies, run the dev server, read the README. This gets someone set up to run the project. It does not help them understand *why* the project is structured the way it is, what constraints shaped the architecture, or what they should not change without understanding the dependency chain between evolution phases.

### Good Prompt

```text
Design a case-study-based onboarding document for a new contributor to
this repository, using Chapter 10's methodology.

The document should answer these questions in this order:

1. **Where are we now?**
   - Current architecture: Next.js layer, MCP tool layer, operations layer.
   - Current quality posture: what does `npm run quality` check?
   - Current maturity: which of the four evolution phases is complete?

2. **How did we get here?**
   - Phase timeline: feature delivery → structural cleanup → operational
     hardening → extensibility optimization.
   - For each phase, one artifact the new contributor should read to
     understand the decisions made.

3. **What went wrong and how was it fixed?**
   - Three specific failures from Chapter 10.
   - For each: what it taught, and what preventive criterion now exists.

4. **What should you not change without understanding the dependency?**
   - List 3–5 architectural decisions that depend on guarantees from
     earlier phases. For each, name the guarantee and the file/module
     that depends on it.

5. **How to contribute safely:**
   - Run the quality gate before and after every change.
   - Follow the sprint template in sprints/ for non-trivial changes.
   - Add validation evidence to the sprint artifact.

Keep the document under 800 words. Use bullet points. Link to specific
files, not general directories.

Acceptance criteria:
1. A new contributor can read this document in 10 minutes.
2. The dependency warnings in section 4 are specific enough to prevent
   accidental breakage.
3. The "how to contribute" section includes executable commands.
```

### Behind the Curtain — What I Do with This

This prompt converts Chapter 10's retrospective case study into a *prospective* onboarding tool. Instead of telling the project's story for its own sake, it uses the story to orient a new contributor's behavior.

Section 4 — "what should you not change without understanding the dependency" — is the highest-leverage part. It names the non-obvious couplings: the GoF patterns in Phase 4 depend on the test coverage from Phase 3, which depends on the module decomposition from Phase 2. A new contributor who refactors the module structure without understanding this chain could silently weaken the test coverage that the patterns depend on for safe refactoring.

The 800-word limit forces the document to be concise enough to actually be read. Long onboarding documents are not read; short ones with links to specific files give the contributor a fast orientation and let them go deeper on demand.

---

*These prompts operationalize Chapter 10's core insight: a case study's value is not in what happened — it is in what the process teaches. The four-phase model, the failure analysis, the evidence-backed lessons, and the dependency chain between phases convert a project narrative into a repeatable methodology. Every repository has this story inside it. These prompts help you extract it.*
