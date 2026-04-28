# Prompt Companion — Chapter 2: A Brief History of Control Surfaces

> This companion document pairs with [Chapter 2](../chapters/ch02-history-of-control-surfaces.md). Each example shows how understanding the control-surface evolution — from machine code to natural language — changes how you construct prompts and where you place rigor.

---

## Prompt 1: Mapping Your Current Control Surface

### Bad Prompt

```text
Help me improve my development workflow.
```

### Behind the Curtain — What I Do with This

I produce a generic productivity list. "Use a linter." "Write tests." "Automate your CI pipeline." "Review code before merging." These are real advice in the same way that "eat well and exercise" is real health advice — true, unsituated, and unlikely to change behavior.

The problem is that "improve my workflow" gives me no information about what your workflow *is*. I generate the most universally applicable suggestions because I have no specificity to work with. The output will apply to almost any developer, which means it is optimized for almost no developer in particular.

### Good Prompt

```text
Chapter 2 identifies five control surface layers in software history:
machine code → assembly → high-level languages → frameworks → orchestration
language.

Map my current development workflow to these layers. Here is my stack:

- Language: TypeScript (high-level language layer)
- Framework: Next.js App Router with React Server Components (framework layer)
- Build tooling: npm scripts for typecheck, lint, test, build (framework layer)
- Orchestration: I use AI assistants for code generation but write prompts
  ad hoc — no structured contracts, no sprint artifacts, no validation gates
  tied to prompt intent.

Based on this mapping:
1. Which control surface transition am I currently navigating?
2. Where does rigor currently live in my stack? (Be specific — name the tools
   and what they enforce.)
3. Where is rigor MISSING because I haven't yet operationalized the
   orchestration layer?
4. What three specific practices would move me from "ad hoc prompting" to
   "orchestration as engineering surface"?

For each practice, include the acceptance criterion that proves I have
adopted it.
```

### Behind the Curtain — What I Do with This

The explicit stack description transforms this from a generic advice query into a situated analysis. I am no longer retrieving "good development practices" — I am reasoning about a *specific* system at a *specific* point in the control surface timeline.

The Chapter 2 framework gives me a conceptual scaffold to organize the analysis. Instead of listing random improvements, I am diagnosing which *transition* the developer is navigating — from framework-layer rigor to orchestration-layer rigor — and that diagnosis produces targeted recommendations rather than a firehose of best practices.

The question "where is rigor MISSING" is doing heavy lifting. It asks me to reason about absence, which is harder than reasoning about presence. I have to model what the workflow *would* look like with orchestration rigor and identify the delta. That delta is the actionable output.

---

## Prompt 2: Understanding Where Rigor Moves at Each Transition

### Bad Prompt

```text
Why do we need structure in AI prompts?
```

### Behind the Curtain — What I Do with This

I produce an argument for structured prompts that sounds like a blog post introduction. "Structured prompts improve output quality." "They reduce ambiguity." "They save time." The reasoning is circular: structure is good because unstructured is bad. No mechanism is explained. No evidence is cited. The output does not connect to any theory about *why* structure matters at this particular moment in software history.

### Good Prompt

```text
Chapter 2 argues that at every control surface transition, rigor does not
disappear — it moves. When we went from assembly to high-level languages,
rigor moved from register management to type systems. When we went from raw
code to frameworks, rigor moved from boilerplate management to configuration
and convention.

Now we are transitioning to natural-language orchestration. Rigor needs to
move again.

For each of these five rigor domains, explain:
1. Where the rigor lived BEFORE orchestration language (i.e., in the framework
   or code layer).
2. Where it needs to live NOW in the orchestration layer.
3. What specific failure mode appears when teams do NOT relocate the rigor.

Domains:
- Input validation and type safety
- Error handling and failure recovery
- Scope management (preventing unintended changes)
- Verification and testing
- Knowledge preservation (documentation, rationale)

Give concrete examples from a Next.js + AI provider architecture. Do not
use abstract language — name specific files, commands, or patterns.
```

### Behind the Curtain — What I Do with This

This prompt gives me five specific analysis tracks, each with the same three-part structure (before / now / failure mode). That structure prevents me from writing a single narrative that meanders between topics. Instead, I produce five parallel analyses that are individually verifiable and collectively comprehensive.

The "rigor moves" framing from Chapter 2 is the key insight. It reframes the question from "why do we need structure in prompts?" (which produces tautological answers) to "where does this specific type of rigor need to relocate?" (which produces mechanistic answers). The difference is that the second question has a *wrong answer* — rigor could be relocated to the wrong place, or not relocated at all — and my response has to address what happens in both cases.

The instruction "do not use abstract language — name specific files, commands, or patterns" prevents me from retreating into generality when a specific analysis would be more useful but harder to generate. Abstract answers are my path of least resistance; concrete examples require more computation.

---

## Prompt 3: Building a Migration Note for Your Team

### Bad Prompt

```text
How should our team start using AI in our development process?
```

### Behind the Curtain — What I Do with This

I generate a phased adoption plan that reads like a consultant's slide deck. "Phase 1: Education. Phase 2: Pilot project. Phase 3: Broader adoption." Each phase has three to five bullet points that are individually reasonable and collectively meaningless because they are not grounded in your team's actual stack, constraints, or failure modes.

### Good Prompt

```text
I am writing a migration note for my team as part of the exercise in Chapter 2.
The note should document our transition from framework-level control surfaces to
orchestration-level control surfaces.

Our current state:
- We use Next.js with TypeScript strict mode, ESLint, and Jest.
- We have CI/CD that runs typecheck + lint + test on every PR.
- We have started using AI assistants for code generation but have no formal
  practices around prompt quality, sprint contracts, or artifact discipline.
- We have no archival system for decisions made during AI-assisted sessions.
- We have no way to distinguish AI-generated code from human-written code
  in our git history.

The migration note should cover three sections:

1. **Current control surface** — What rigor exists and where it lives.
   Be specific about which tools enforce which properties.

2. **Control surface gap** — What new rigor is required for the orchestration
   layer that our current tools do not provide. For each gap, explain the
   failure mode we are currently exposed to.

3. **Migration actions** — For each gap, one specific action with:
   - What to implement (tool, practice, or artifact)
   - How to verify it is working (command or measurable signal)
   - What "done" looks like (acceptance criterion)

Keep the note under 800 words. It should be presentable in a team standup.
```

### Behind the Curtain — What I Do with This

The specific current-state description is what makes this prompt work. Instead of generating advice for a generic team, I am reasoning about *this* team: one with strong deterministic tooling (TypeScript, ESLint, Jest, CI/CD) but no orchestration practices. The gap analysis becomes precise because I know what is present and only need to identify what is absent.

The 800-word limit forces compression. A migration note that is comprehensive but too long to present is worse than one that is focused and presentable. The word ceiling makes me prioritize the three most impactful gaps rather than listing every possible improvement.

The acceptance criteria for each migration action are meta-level good practice — the migration note itself follows the same specification discipline it is advocating for. This self-referential quality makes the note more credible to a skeptical team: the document practices what it preaches.

---

## Prompt 4: Analyzing Whether Your Orchestration Layer Is Engineering or Ad Hoc

### Bad Prompt

```text
Are we doing AI development the right way?
```

### Behind the Curtain — What I Do with This

I have no way to answer this. I do not know who "we" is, what you are building, what your constraints are, what your quality targets are, or what you mean by "right way." I generate a reassuring non-answer that touches on common themes — test your code, review your outputs, iterate — and leaves you exactly where you started.

### Good Prompt

```text
Chapter 2 defines a maturity signal: "whether language directives can be traced
to reproducible outcomes."

Audit my current orchestration practices against this signal. Here is what I
currently do:

- I use ChatGPT/Claude for code generation during development.
- I do not preserve prompts after the session.
- I do not write acceptance criteria before prompting.
- I manually review AI output and copy what "looks right."
- I run tests after integrating AI output, but the tests were not designed to
  verify the specific intent of the prompt.
- No one else on my team can reconstruct what I asked the model or why.

For each practice, assess:
1. Can this be traced to a reproducible outcome? (yes/no with explanation)
2. What is the operational risk of continuing this way?
3. What is the minimum change that would make it traceable?

Then give me an overall maturity score on a 5-point scale:
1 = fully ad hoc, 5 = fully traceable orchestration.

Be honest. I want the real score, not encouragement.
```

### Behind the Curtain — What I Do with This

"Be honest. I want the real score, not encouragement." This single instruction changes my output more than any other sentence in the prompt. My default training strongly incentivizes supportive, balanced responses. When someone describes their practices, I tend to find redeeming qualities even in weak workflows. The explicit instruction to prioritize honesty over encouragement disables that pattern and produces a genuinely diagnostic response.

The six-practice breakdown gives me specific targets to evaluate. Each one is a yes/no question (is it traceable?) followed by risk + minimum change. This structure prevents me from producing a general assessment that blurs the distinction between strong and weak practices. Practice by practice, the gaps become visible.

The maturity score forces a bottom-line judgment. Most prompt outputs avoid definitive assessments because they risk being wrong. The explicit request for a score on a named scale gives me permission to commit to a judgment — which is what makes the output useful as a decision-making input rather than a discussion starter.

---

*These prompts operationalize Chapter 2's core insight: natural-language orchestration is not a break from software history — it is the latest control surface transition. The rigor does not disappear. It relocates. These prompts show what that relocation looks like in practice, and what happens when it does not happen.*
