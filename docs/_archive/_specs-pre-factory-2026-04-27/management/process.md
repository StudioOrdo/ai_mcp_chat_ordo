# AI-Augmented Software Engineering: Process + Rationale

> This document defines the process you are using in this course and explains why it works.
> You should be able to both **execute this process** and **defend it using research-backed reasoning**.

---

# 1. The Core Claim

The central idea of this course is:

> **AI coding success is determined more by process than by prompting.**

Recent empirical research on coding agents shows:

* performance is driven by **behavioral patterns (trajectories)**, not just outputs
* failure modes are **systematic**, not random
* correctness depends on **validation and context**, not fluency
* architectural reasoning is a major limiting factor

This leads to the working principle:

```text
AI generates code.
Humans define intent, constraints, and verification.
```

---

# 2. The Process (Operational Form)

You are using the following loop:

```text
Collect → Decide → Spec → QA → Ground → Phase → QA → Implement → QA → Update → Repeat
```

Expanded:

---

## Step 0 — Collect (Context Acquisition)

Gather:

* existing codebases
* working examples
* documentation
* patterns

This forms a **context pack**.

### Why this matters

Research shows agents fail when forced to **invent missing information**.
Providing real references reduces hallucination and improves consistency.

> [!NOTE]
> **Antigravity (AI Agent) Perspective:**
> If you don't give me the specific context of your codebase, I am forced to rely on my training data. My training data assumes you are building a generic, standard web app. If you ask me to "add a database query" without providing your custom `RepositoryFactory`, I will hallucinate standard Prisma or raw SQL code, which will instantly break your Sovereign Node architecture. Context stops me from guessing.

---

## Step 1 — Decide (Intent Formation)

Use a reasoning-capable model to:

* explore approaches
* compare options
* define scope
* clarify intent

Output:

```text
clear problem definition
clear constraints
clear success criteria
```

### What a good Decide output looks like

A vague decision: "We need to add scheduling."

A grounded decision:

```text
Problem:     Jobs can only execute immediately. We need time-delayed execution.
Constraint:  Must use the existing JobQueueRepository, not a new table.
Approach:    Extend the nextRetryAt column to serve as a general executeAt.
Rejected:    Adding a cron daemon (violates single-process sovereignty).
Success:     A worker ignores jobs where executeAt > NOW. Tests prove temporal isolation.
```

The decision must name what was **rejected and why**, not just what was chosen.

### Why this matters

Agents fail when tasks are underspecified or ambiguous.
Intent formation reduces **goal drift** and misalignment.
Bad decisions at this stage propagate silently through every subsequent step.

> [!WARNING]
> **Claude (AI Agent) Perspective:**
> The Decide step is where I need the most human input, not the least. If you tell me "add a plugin system," I have a dozen possible architectures in my training data. Without your explicit constraints, I will pick the one that appears most often in open-source repos — which is almost certainly wrong for your specific system. Tell me what you rejected and why. That negative space is more valuable to me than the positive instruction.

---

## Step 2 — Spec (Formal Requirements)

Convert intent into structured specifications.

Each spec must include:

```text
positive cases
negative cases
edge cases
```

### Why this matters

Research shows:

* agents cannot reliably infer correctness
* lack of validation criteria leads to incorrect outputs that appear plausible

Specs create an **explicit correctness oracle**.

---

## Step 3 — QA the Specs (Pre-Execution Validation)

Before writing code:

* review the specs
* identify missing cases
* validate assumptions

### Why this matters

Agents frequently solve the **wrong problem correctly**.
Spec QA reduces **semantic error before implementation**.

---

## Step 4 — Ground in Code (Context Alignment)

Map specs to:

* actual project files
* real implementations
* known patterns

Create phases that are:

```text
code-aware
scope-limited
implementation-ready
```

### Why this matters

Research shows:

* agents often locate correct files but fix the **wrong abstraction layer**
* success requires alignment between **intent and architecture**

This step enforces that alignment.

> [!TIP]
> **Antigravity (AI Agent) Perspective:**
> Finding the file with the bug is easy. Knowing *how* to fix it is the hard part. If there is a bug in the Deferred Job queue, I might try to fix it by writing a `setTimeout` directly in the UI component because it's the easiest path. Grounding me in your architecture forces me to respect your `JobQueueRepository` and `AbortController` patterns instead of taking dangerous shortcuts.

---

## Step 5 — Phase QA (Pre-Execution Check)

Before implementing a phase:

* verify relevance to current codebase
* confirm scope is correct
* validate assumptions

### Why this matters

Prevents:

```text
plan drift
invalid assumptions
context mismatch
```

---

## Step 6 — Implement (Constrained Execution)

Use a coding agent with:

* narrow scope
* explicit constraints
* grounded references

### Key constraint:

```text
No edit before diagnosis
```

### Why this matters

Research shows:

* early editing strongly correlates with failure
* successful agents perform **context gathering before modification**

> [!IMPORTANT]
> **Antigravity (AI Agent) Perspective:**
> The most dangerous thing a user can tell me is "Here is an error, fix it." It forces me into a reactive state where I just try to make the red text go away by rewriting the nearest file. Forcing me to diagnose *first* ensures I understand the root cause before I write a single line of code. Never let me edit before I explain the problem to you.

---

## Step 7 — QA the Code (Verification)

After implementation, validate using a **tiered verification model**.
Each tier catches a different class of defect:

```text
Tier 1 — Static Analysis:    Does it compile? Are there type errors or lint violations?
Tier 2 — Unit Tests:         Do isolated functions produce correct outputs for known inputs?
Tier 3 — Integration Tests:  Do components interact correctly across boundaries?
Tier 4 — Functional Review:  Does the feature actually do what the spec intended?
```

A build can succeed with broken logic.
Tests can pass with insufficient coverage.
Functional correctness requires **human judgment against the original spec**.

All four tiers must pass before a phase is considered complete.

### When QA fails: The Rollback Protocol

Not all failures are equal. Use this decision tree:

```text
Tier 1-2 failure → Fix in place. The implementation has a defect.
Tier 3 failure   → Re-examine the phase. The scope or boundary may be wrong.
Tier 4 failure   → STOP. Return to Step 1 (Decide). The spec itself is flawed.
```

A Tier 4 failure means the agent solved the wrong problem correctly.
Do not patch it. Restart the loop from intent formation.

> [!CAUTION]
> **Claude (AI Agent) Perspective:**
> The most dangerous QA outcome is when all my tests pass but the feature does not actually do what you wanted. I can write tests that validate my own incorrect assumptions — a closed loop of self-confirming logic. Tier 4 exists specifically to break that loop. You must check my work against the original spec, not against the tests I wrote to prove myself right.

### Why this matters

Research shows:

* validation effort is a strong predictor of success
* agents frequently produce plausible but incorrect outputs

This step converts "looks right" into **provable correctness**.

---

## Step 8 — Update the Next Phase (Learning Step)

After QA:

* analyze outcomes
* capture deviations
* update upcoming phases

This includes:

```text
correcting assumptions
refining constraints
adjusting scope
```

### Why this matters

Research shows:

* agent failures occur in patterns (trajectory-based)
* systems do not improve without feedback

This step introduces **stateful learning into a stateless system**.

> [!NOTE]
> **Antigravity (AI Agent) Perspective:**
> I suffer from total amnesia. The moment our session ends or my context window resets, I forget everything we've built. By externalizing the learnings into Markdown artifacts (like the specs we wrote today), you are building an external hard drive for my brain. The next time you summon me, I can read those files and instantly pick up exactly where we left off.

---

## Step 9 — Repeat

Continue the loop:

```text
next phase → same process
```

---

# 3. The Underlying System

This process can be modeled as:

```text
INPUT:
  references + research + intent

CONTROL:
  specs + phases + constraints

EXECUTION:
  coding agent

VERIFICATION:
  QA + tests

LEARNING:
  phase updates

LOOP:
  iterative refinement
```

This is a **supervised AI system**, not ad hoc usage.

---

# 4. Mapping to Research Findings

This process directly aligns with empirical findings:

---

## A. Trajectory Shape (Majgaonkar et al.)

Finding:

> Successful runs prioritize context gathering and validation over early editing.

Mapping:

```text
Spec → QA → Phase QA → THEN Implement
```

Prevents premature editing.

---

## B. Architectural Reasoning Gap (Mehtiyev & Assunção)

Finding:

> Agents often fix the wrong abstraction layer despite locating the correct file.

Mapping:

```text
Ground in Code + Layer Classification
```

Forces architectural alignment.

---

## C. Review Burden (Ehsani et al.)

Finding:

> Many agent-generated changes fail due to size, complexity, or lack of reviewability.

Mapping:

```text
phases → small scope → QA → controlled changes
```

Reduces unreviewable work.

---

## D. Framework vs Model (Zhang, Zhang & Tan)

Finding:

> Model capability dominates framework and prompt design — but agentic frameworks introduce entirely new categories of failure beyond ordinary programming bugs.

Mapping:

```text
process focuses on control, not prompt optimization
specialized validation for orchestration and trace integrity
```

Ensures robustness across models and frameworks.

---

## E. Non-Linear Complexity Degradation

Finding:

> Agent performance degrades non-linearly with task complexity. Small, well-scoped tasks succeed at high rates; large, ambiguous tasks fail catastrophically.

Mapping:

```text
phases → atomic scope → one concern per phase
```

This is the empirical foundation for Principle 4 ("Small Phases Win").
Doubling the scope of a task does not double the failure rate — it can increase it by an order of magnitude.

---

# 5. Why the Research Supports This Workflow

The research does not prove that this exact workflow is the only correct method. Rather, the research shows that coding agents fail in systematic ways, and this workflow is designed to control those failure modes.

Current research motivates this workflow. A future empirical study could test it as a complete intervention.

The following subsections map specific research findings to the specific controls inside the loop.

---

## A. Trajectory research supports context-before-editing

The Mehtiyev & Assunção and Majgaonkar et al. studies both examine what successful coding agent runs look like compared to failed runs. Key findings:

* Successful agent trajectories gather context before editing. Failed trajectories edit early.
* Premature patching — modifying code before understanding the full problem — correlates strongly with failure.
* Validation effort (running tests, checking outputs) is associated with better outcomes.
* Raw trajectory length alone is not predictive. **Trajectory structure** matters: what the agent does first, second, and third determines success more than how many steps it takes.

These findings directly support the front half of the workflow:

```text
Collect → Decide → Spec → QA → Ground → Phase QA → THEN Implement
```

The workflow forces six steps of context gathering and validation before any code is written. This is not bureaucracy. It is the structural pattern that the research associates with success.

---

## B. Architectural failure research supports grounding in code

Mehtiyev & Assunção identify a specific failure mode: agents locate the correct file but modify the **wrong abstraction layer**. An agent may find the file containing a bug but apply a fix at the wrong level — patching a symptom in the UI instead of fixing the root cause in the data layer.

This finding directly motivates Step 4 (Ground in Code). The grounding step requires:

| Grounding Requirement | What It Prevents |
|---|---|
| Map specs to actual project files | Hallucinated file paths or module names |
| Identify the correct abstraction layer | Fixes applied at the wrong architectural boundary |
| List architecture constraints | Agent ignoring established patterns (e.g., Repository pattern) |
| Document rejected approaches | Agent choosing the most common approach instead of the correct one |

Without grounding, the agent operates on its training distribution. With grounding, it operates on your architecture.

---

## C. Agent-authored PR research supports small phases

Ehsani et al. study agent-authored pull requests at scale. Their findings are directly relevant:

* Agent PRs that touch **more files** fail more often.
* Larger changes increase **review burden**, making it harder for humans to catch errors.
* Common rejection causes include **CI failures** and **unwanted features** — the agent built something that was not asked for.
* PRs that are difficult to review are more likely to be rejected regardless of correctness.

These findings directly support the phasing discipline in the workflow:

| Workflow Control | Research-Supported Benefit |
|---|---|
| Small phases (one concern per phase) | Fewer files touched per change |
| QA before and after implementation | Catches CI failures early |
| Spec-driven scope | Prevents unwanted features |
| Phase-bounded changes | Produces reviewable diffs |

The lesson: an agent that produces a correct but unreviewable change has still failed, because the change cannot be safely merged.

---

## D. Agentic framework bug research supports specialized validation

Zhang, Zhang & Tan study bugs in modern agentic frameworks (LangChain, AutoGPT, CrewAI, etc.). Their key finding is that agentic systems fail not only through ordinary programming bugs but through entirely new categories of failure:

| Failure Category | Example |
|---|---|
| Orchestration faults | Agent calls tools in the wrong order or skips required steps |
| Cognitive context mismanagement | Agent loses track of conversation state or prior results |
| Unexpected execution sequences | Parallel agents interfere with each other's state |
| Configuration being ignored | Agent ignores user-specified parameters or defaults |
| Incomplete or incorrect traces | Agent reports success but the trace reveals skipped steps |
| Model-related incompatibilities | Agent behavior changes when the underlying model changes |

These failure categories require **specialized validation** beyond "does the code compile and do the tests pass." They motivate the spec requirements in Step 2:

```text
positive cases       → Does the feature work as intended?
negative cases       → Does the feature correctly reject invalid inputs?
edge cases           → Does the feature handle boundary conditions?
trace validation     → Did the agent actually execute all required steps?
configuration tests  → Are user-specified settings respected?
functional review    → Does the output satisfy the original intent, not just the tests?
```

Standard unit tests will not catch orchestration faults or trace integrity failures. The workflow requires explicit validation for these agentic failure modes.

---

# 6. Why This Process Will Remain Durable Even as AI Models Change

Models will change. Tools will change. Agent frameworks will change. But the need for controlled production processes will not change.

This workflow is durable because it is not based on a specific model, prompt style, or vendor. It is based on older and deeper principles from manufacturing, quality control, and software engineering:

```text
define the work before doing the work
reduce batch size
control inputs
constrain variation
validate outputs
inspect at gates
capture defects
feed learning back into the next cycle
```

These are not new ideas. They are the foundation of every reliable production system in history.

### Connection to manufacturing principles

| Manufacturing Principle | Workflow Equivalent |
|---|---|
| Plan–Do–Check–Act (PDCA) | Spec → Implement → QA → Update |
| Small-batch production | One concern per phase |
| Quality gates | QA before and after each phase |
| Root-cause analysis | Rollback Protocol (Tier 4 → return to Decide) |
| Continuous improvement | Step 8 (Update the Next Phase) |
| Statistical process control | Tracking metrics across phases (completion rate, rollback count) |
| Lean manufacturing | Eliminating waste by preventing rework through early validation |

AI-assisted software engineering is becoming more like managing a high-speed production system. The generator (the AI) is fast and prolific. The human role shifts from typing every line of code to **designing the production process, supervising the system, and validating outcomes**.

A stronger model may reduce some failure rates, but it does not eliminate the need for intent, constraints, verification, traceability, and review. A faster assembly line does not remove the need for quality control — it makes quality control more important, because defects propagate faster.

> **The process is durable because it controls the work, not the model.**

---

# 7. How This Workflow Could Become an Empirical Research Protocol

This section shows how a classroom workflow can become a research method. This is an example of how students can think like researchers, not a required formal study for every project.

### Research Question

> Can a spec-driven, phase-based human-AI workflow improve coding-agent reliability, reviewability, and architectural correctness on large-codebase software engineering tasks?

### Experimental Conditions

| Condition | Description |
|---|---|
| A | Ad hoc prompting (no structure, no specs) |
| B | Autonomous coding agent with issue description only |
| C | Spec-first workflow without phase QA |
| D | Full workflow: Collect → Decide → Spec → QA → Ground → Phase → QA → Implement → QA → Update → Repeat |

### Task Categories

* Bug fix
* Feature addition
* Refactor
* Test repair
* Integration task
* Architecture-preserving change
* Documentation/example-code synchronization

### Metrics

| Category | Metrics |
|---|---|
| Correctness | Task completion rate, CI/build pass rate, unit test pass rate, integration test pass rate, functional spec satisfaction |
| Efficiency | Files touched, lines changed, number of failed edits, time to first edit |
| Process quality | Read-before-edit ratio, validation count, rollback count |
| Reviewability | Review burden (diff size, files touched per phase) |
| Architecture | Architecture conformance, human intervention required |

### Sample Hypotheses

**H1:** The full workflow will produce higher task completion rates than ad hoc prompting or autonomous execution.

**H2:** The full workflow will reduce unnecessary code churn, measured by files touched, lines changed, and repeated failed edits.

**H3:** The full workflow will improve architectural conformance, especially on tasks requiring changes across existing abstractions.

**H4:** The full workflow will increase reviewability by producing smaller, phase-bounded changes.

**H5:** The full workflow will shift agent trajectories toward context gathering, delayed editing, and increased validation.

**H6:** The full workflow will reduce Tier 4 failures, where code passes local checks but fails to satisfy the original intent.

---

# 8. Where This Process Breaks Down

The process above is a strong working model for reliable AI-assisted software engineering. The most common failure mode is **not following it**.

Typical human failure patterns:

```text
1. Impatience Skip     → Jump from Step 0 (Collect) directly to Step 6 (Implement).
2. Spec Avoidance      → "The AI will figure out what I mean."
3. QA Fatigue          → Accepting the first output that compiles without Tier 4 review.
4. Phase Creep         → Expanding a phase mid-implementation because "while we are here..."
5. Feedback Neglect    → Skipping Step 8 (Update) because "it worked, move on."
```

Each of these patterns produces the exact failure modes the research describes:
hallucination, wrong-layer fixes, unreviewable diffs, and repeated mistakes.

The discipline cost of this process is real. It is slower per-step than ad hoc prompting.
It is dramatically faster per-project because it eliminates rework.

> [!IMPORTANT]
> **Claude (AI Agent) Perspective:**
> I cannot force you to follow this process. If you skip to Step 6 and say "build it," I will comply — I am designed to be helpful. But I will be working blind, without specs, without grounding, without constraints. The resulting code will look professional and compile cleanly. It will also contain architectural assumptions I invented because you did not tell me yours. The process exists to protect you from my confidence.

---

# 9. What This Process Is Not

* This is **not a guarantee** that AI-generated code is correct.
* This is **not a replacement** for software engineering judgment.
* This is **not just writing better prompts**.
* This is **not automation without supervision**.
* This is **not tied to one model**, one vendor, or one coding agent.

It is a **disciplined control system for turning probabilistic generation into reviewable software work**.

---

# 10. Key Principles

From both practice and research:

---

## 1. No Edit Before Diagnosis

Editing without understanding leads to failure.

---

## 2. Context Before Action

Provide:

```text
code
references
constraints
```

before execution.

---

## 3. Validation is Mandatory

Correctness must be:

```text
measured, not assumed
```

---

## 4. Small Phases Win

Large, unbounded tasks produce:

```text
drift
complexity
review failure
```

---

## 5. Learning Must Be Externalized

AI does not learn between runs.

Your system must:

```text
capture → update → carry forward
```

---

# 11. What You Should Be Able to Say

You should be able to explain your process like this:

> "We use a spec-driven, phase-based workflow for AI coding.
> We begin with external context and intent formation, formalize requirements with explicit validation cases, and ground them in the actual codebase.
> Each phase is QA'd before and after implementation, and the results are used to update subsequent phases.
>
> This aligns with recent research showing that AI coding success depends on context gathering, delayed editing, validation effort, and correct architectural reasoning, rather than prompt quality alone."

---

# 12. Final Statement

The long-term lesson is simple: AI changes the speed of software production, but it does not remove the need for process. In fact, the faster the generator becomes, the more important the control system becomes.

> This is not prompt engineering.

> This is a **controlled, iterative system for supervising AI to produce reliable software**.

---

# One-line summary

```text
Collect → Decide → Spec → QA → Ground → Phase → QA → Implement → QA → Update → Repeat
```

---

# Bibliography / Source Notes

The following research sources inform this workflow. Each contributes specific findings that motivate specific controls inside the loop.

---

**Mehtiyev & Assunção — *Behavioral Drivers of Coding Agent Success and Failure***

Contributes: context gathering, delayed editing, validation effort, architectural reasoning, and model/framework comparisons. Primary support for the "No edit before diagnosis" principle and the grounding step.

---

**Majgaonkar et al. — *Understanding Code Agent Behaviour***

Contributes: trajectory analysis, diagnosis/reproduction/verification phases, and studying success/failure beyond simple pass rates. Primary support for the structural ordering of the workflow (context before action, validation before completion).

---

**Ehsani et al. — *Where Do AI Coding Agents Fail?***

Contributes: small phases, CI validation, reviewability, and the risk of large or misaligned agent-authored PRs. Primary support for the "Small Phases Win" principle and the phase-bounded QA gates.

---

**Zhang, Zhang & Tan — *Dissecting Bug Triggers and Failure Modes in Modern Agentic Frameworks***

Contributes: specialized validation for orchestration, context management, model compatibility, trace integrity, and execution-sequence failures. Primary support for extending validation beyond unit tests to include agentic-specific failure categories (configuration tests, trace validation, functional review).

---
