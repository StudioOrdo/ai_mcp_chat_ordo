# Prompt Companion — Chapter 12: Future Directions

> This companion document pairs with [Chapter 12](../chapters/ch12-future-directions.md). Each prompt pair demonstrates how to turn forward-looking analysis into actionable roadmaps — and what happens when forecasting lacks grounding in present evidence.

---

## Prompt 1: Building a Near-Term Orchestration Roadmap

### Bad Prompt

```text
What should my AI strategy be for the next year?
```

### Behind the Curtain — What I Do with This

I produce a broad strategy document citing trends: "adopt agents," "invest in RAG," "establish AI governance." These recommendations are directionally correct and operationally useless. They do not connect to your current codebase, your team's capabilities, or your project's maturity. A strategy that could apply to any organization provides no guidance to yours.

### Good Prompt

```text
Using Chapter 12's three-horizon model, create a 12-month orchestration
roadmap for this specific project.

Current state (anchor all recommendations here):
- Architecture: Next.js + MCP + operations scripts
- Quality gates: TypeScript strict, ESLint, npm test, Lighthouse
- Prompt discipline: structured prompt contracts in sprint documents
- Team size: [specify your team size]
- Current maturity: [Phase 1–4 from Chapter 10 — which phase are you in?]

Near-term goals (months 1–4):
For each goal, provide:
- What specifically to build or adopt
- Which files or modules in the current codebase it touches
- How to validate it works (a command or measurable outcome)
- What the prerequisite is (what must already be true)

Constraints:
- Every recommendation must build on something that already exists in
  this codebase.
- No recommendations that require capabilities the team does not currently
  have — or explicitly flag the capability gap and define how to close it.
- Each item must have a one-sentence "we'll know this is working when"
  success signal.

Acceptance criteria:
1. Every roadmap item maps to a specific current-state capability.
2. Prerequisites are explicit — no item assumes unbuilt infrastructure.
3. The roadmap is sequenced (items are ordered by dependency, not priority
   alone).
```

### Behind the Curtain — What I Do with This

Anchoring the roadmap in the codebase's current state prevents me from recommending aspirational capabilities that have no connection to what exists. Instead of "adopt agents," I produce something like "extend the MCP tool registry with a second tool, using the calculator tool's schema pattern as template, and validate with the existing quality gate."

The prerequisite constraint is particularly valuable. It forces the roadmap to be sequenced by dependency: you cannot recommend "implement eval loops" if the prerequisite observability infrastructure does not exist yet. Each recommendation must either build on an existing capability or explicitly define the gap and the work to close it.

The "we'll know this is working when" success signal converts each roadmap item from a direction into a testable claim. This is the forecasting discipline Chapter 12 advocates: predictions grounded in present evidence with measurable validation.

---

## Prompt 2: Forecasting with Appropriate Uncertainty

### Bad Prompt

```text
What will AI development look like in 5 years?
```

### Behind the Curtain — What I Do with This

I produce confident predictions about a timeframe I have no reliable basis for predicting. My training data gives me extrapolation capability, not foresight. The predictions will sound plausible because I am good at producing plausible text, not because they are likely to be correct. Chapter 12 specifically warns about this: "the near-term predictions are more reliable than the long-term ones, and the reader should apply proportionally more skepticism as the time horizon extends."

### Good Prompt

```text
Apply Chapter 12's three-horizon model with explicit confidence calibration:

For each prediction:
- State the prediction.
- State the evidence from the current codebase or industry that supports it.
- Rate your confidence: HIGH (visible trajectory with current evidence),
  MEDIUM (plausible extrapolation), LOW (speculative).
- Describe the signal that would confirm or disconfirm this prediction
  within the next 12 months.

Near term (0–2 years) — expect HIGH confidence ratings:
1. How will prompt contracts evolve as engineering artifacts?
2. What will repository-integrated QA loops look like?
3. How will team playbooks for orchestration change?

Mid term (2–5 years) — expect MEDIUM confidence ratings:
4. How will tooling generate orchestration plans from intent?
5. What will continuous eval systems look like in delivery pipelines?

Long term (5+ years) — expect LOW confidence ratings:
6. What might intent compilers look like?
7. How will verification systems balance autonomy and human governance?

Important: if your confidence for any prediction is LOW, say so explicitly.
Do not present speculative predictions with the same tone as evidence-based
near-term ones.

Acceptance criteria:
1. Every prediction has an evidence citation.
2. Confidence ratings are honest — long-term predictions should mostly be LOW.
3. Each prediction has a specific disconfirmation signal.
```

### Behind the Curtain — What I Do with This

The confidence calibration framework prevents the most common forecasting failure: presenting all predictions at the same confidence level. By requiring me to rate HIGH/MEDIUM/LOW and cite evidence, the prompt makes my uncertainty visible and useful.

The disconfirmation signal is the most rigorous element. For each prediction, I have to state what would *disprove* it within 12 months. This converts predictions from assertions into hypotheses — testable claims that you can check against reality. A prediction without a disconfirmation signal is not a forecast; it is a story.

Chapter 12's own model note — "I am trained on a snapshot of the world... treat the forecasts below as structured hypotheses" — directly supports this approach. If the author of the forecasts says to treat them as hypotheses, the prompt should enforce hypothesis structure: evidence, confidence, disconfirmation.

---

## Prompt 3: Designing Adaptive Systems

### Bad Prompt

```text
How do I future-proof my architecture?
```

### Behind the Curtain — What I Do with This

I recommend abstraction layers, plugin systems, and modular design. These are generally good practices but they are not specific to the challenges Chapter 12 identifies: model capabilities changing faster than application code, evaluation criteria shifting as models improve, and team practices needing to evolve alongside tooling. Generic future-proofing addresses technical flexibility without addressing the specific dimensions of change in AI-assisted systems.

### Good Prompt

```text
Chapter 12 identifies three categories of change that AI-native systems
must absorb:

1. Model capability changes (models get better, APIs change, new models
   appear)
2. Evaluation criteria shifts (what "good output" means evolves)
3. Team practice evolution (how humans and models collaborate changes)

For each category, audit this codebase for adaptive capacity:

Category 1 — Model Capability Changes:
- Where is the model identifier configured? How many files would need to
  change if we switched models?
- Where are model-specific assumptions encoded? (Token limits, response
  format expectations, tool-calling conventions.)
- Is there a fallback mechanism for model unavailability?

Category 2 — Evaluation Criteria Shifts:
- What quality metrics are currently enforced? (Lighthouse scores, test
  thresholds, lint rules.)
- How hard is it to add a new quality metric? What would the process be?
- Are evaluation criteria versioned or are they implicit in config files?

Category 3 — Team Practice Evolution:
- Are sprint templates flexible enough to accommodate new ritual structures?
- Is the handoff contract template (Chapter 11) stored somewhere a team
  could modify it?
- Could a new team member add a verification step without modifying core
  infrastructure?

For each finding:
- Current adaptive capacity: HIGH (easy to change), MEDIUM (possible but
  requires work), LOW (would require significant refactoring).
- Recommended improvement (if capacity is MEDIUM or LOW).
- The specific file or module that should change.

Acceptance criteria:
1. Each category has at least two specific findings from the codebase.
2. Recommendations are implementable (not just "add abstraction").
3. Each recommendation names the file that would change.
```

### Behind the Curtain — What I Do with This

The three-category framework converts "future-proofing" from a vague aspiration into a structured audit. Instead of asking whether the system is flexible in general, I assess whether it can absorb the three specific categories of change that Chapter 12 identifies as most important.

Category 1 (model capability changes) is the most immediately practical. If the model identifier is hardcoded in multiple files, switching models requires a multi-file change with coordinated testing. If it is centralized in a config module with fallback logic, the change is a single-file update. This is a concrete, measurable dimension of adaptive capacity.

The rating system (HIGH/MEDIUM/LOW) prevents binary thinking. A system does not need to be perfectly adaptive everywhere — it needs to be highly adaptive in the dimensions that change most frequently. Model configuration should be HIGH because models change often. Sprint template structure can be MEDIUM because team practices change less frequently.

---

## Prompt 4: Strategic Recommendations for Your Context

### Bad Prompt

```text
What should I focus on next for my AI project?
```

### Behind the Curtain — What I Do with This

I suggest the most popular current AI feature: "add RAG," "implement agents," "build a vector database." These may or may not be relevant to your project. Without understanding your current maturity, your team's constraints, and your use case priorities, I recommend what is trending rather than what is strategically sound for your situation.

### Good Prompt

```text
Chapter 12 offers four strategic recommendations. Evaluate each one against
this project's current state and produce a prioritized implementation plan:

Recommendation 1: "Treat orchestration prompts as versioned artifacts."
- Are prompts currently stored as artifacts in this codebase?
- Where would a versioned prompt library live in the current structure?
- What is the smallest change that makes prompt versioning real?

Recommendation 2: "Build eval loops that reflect production behavior."
- What eval capabilities exist now? (Tests, lint, Lighthouse — any others?)
- What production behaviors are NOT captured by current evals?
- What is the gap between test-time eval and production-time behavior?

Recommendation 3: "Preserve architectural rationale in durable sprint and
QA records."
- How well does the current sprint archive preserve rationale?
- Can a new team member reconstruct WHY decisions were made (not just
  WHAT was decided) from the archive?
- What rationale is currently only in ephemeral conversation?

Recommendation 4: "Invest in team operating models as much as in model
capability."
- How much of the team operating model from Chapter 11 is currently
  practiced vs. documented vs. neither?
- What is the single highest-leverage operating model improvement?

For each recommendation:
- Current implementation: FULLY / PARTIALLY / NOT AT ALL
- Effort to reach FULLY: LOW (days) / MEDIUM (sprint) / HIGH (multiple sprints)
- Priority: FIRST / SECOND / THIRD / FOURTH
- Rationale for priority ranking

Output: a four-item implementation plan ordered by priority, with the
first item fully specified (scope, acceptance criteria, validation).

Acceptance criteria:
1. Prioritization is justified by effort-to-impact ratio.
2. The first item includes executable acceptance criteria.
3. Recommendations that are already FULLY implemented are acknowledged,
   not re-recommended.
```

### Behind the Curtain — What I Do with This

Evaluating each recommendation against the current state prevents generic advice. Instead of saying "version your prompts" to every project, I assess whether this project already versions its prompts (answer: partially, through sprint documents) and what the delta is to make it fully operational.

The priority ordering by effort-to-impact ratio ensures the implementation plan is strategically sequenced. A recommendation that is HIGH effort and LOW additional impact (because it is already partially implemented) should be lower priority than one that is LOW effort and HIGH impact (because it closes a significant gap).

Fully specifying the first item creates an immediately executable next step. The roadmap is not just strategic — it produces a sprint-ready work unit for the highest-priority recommendation.

---

*These prompts operationalize Chapter 12's core methodology: responsible forecasting starts from present evidence, separates predictions by confidence level, and produces adaptive systems rather than rigid bets. The three-horizon model is not a crystal ball — it is a structured planning tool that explicitly acknowledges uncertainty while still producing actionable roadmaps. Every prediction should have evidence, a confidence rating, and a disconfirmation signal. Every recommendation should be grounded in current capabilities and prioritized by effort-to-impact. That discipline is what separates strategic planning from speculation.*
