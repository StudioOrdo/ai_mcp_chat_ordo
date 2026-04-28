# Prompt Companion — Chapter 1: Why This Moment Matters

> This companion document pairs with [Chapter 1](../chapters/ch01-why-this-moment-matters.md). Each example demonstrates how the chapter's core thesis — language is now part of the implementation surface — translates into concrete prompt quality differences.

---

## Prompt 1: Converting a Feature Request into an Engineering Specification

### Bad Prompt

```text
Add a dark mode toggle to my Next.js app.
```

### Behind the Curtain — What I Do with This

I generate a dark mode implementation. Probably a `ThemeProvider` with `useState`, a toggle button, a `useEffect` for `localStorage` persistence, some CSS variables or Tailwind `dark:` classes. The code will work. It will probably compile.

Here is what it will not do: respect your existing architecture. I do not know whether you use Server Components (where `useState` is not available). I do not know whether you have a layout system that should own the theme. I do not know whether you need the toggle to persist across sessions, respect OS preference, animate the transition, or meet WCAG contrast ratios in both modes. I do not know what your test suite expects.

I fill every gap with my most probable default. That is the feature request as conversation — the thing Chapter 1 says is insufficient. It produces output, not engineering.

### Good Prompt

```text
Role: Senior front-end engineer implementing a Next.js App Router feature.

Scope: Add a dark mode toggle to the existing layout. The toggle must:
- Live in the root layout (`src/app/layout.tsx`) as a client boundary.
- Persist user preference in localStorage.
- Respect OS-level prefers-color-scheme on first visit.
- Use Tailwind's `dark:` variant system (already configured in tailwind.config).
- Not add any client JavaScript to pages that do not render the toggle.

Invariants:
- Do not convert any existing Server Components to Client Components.
- Do not modify the existing color palette — only add dark variants.
- All interactive elements must remain keyboard-accessible.

Acceptance criteria:
1. `npm run typecheck` passes with zero errors.
2. `npm run lint:strict` passes with zero warnings.
3. The toggle works without JavaScript (graceful degradation to OS preference).
4. Lighthouse Accessibility score remains 100.

Deliver the implementation as a set of file changes with explanations.
```

### Behind the Curtain — What I Do with This

Every sentence in this prompt eliminates a decision I would otherwise make on your behalf — and possibly make wrong.

"Lives in the root layout as a client boundary" tells me exactly where the state goes and prevents me from creating a separate provider component that might interfere with your component tree. "Do not convert any existing Server Components" is an invariant I would never infer on my own — my default is to make things work, and if that means adding `"use client"` to a file that was previously a Server Component, I will do it without hesitation unless told not to.

The acceptance criteria are machine-checkable. I am not generating code and hoping it works — I am generating code against specific verification commands. This changes my generation: I am more careful about type annotations (because `typecheck` will catch them), more careful about lint compliance (because `lint:strict` will catch it), and more careful about accessibility (because Lighthouse at 100 will catch it).

This is Chapter 1's thesis in action: language as specification, not conversation. The prompt is not asking me to chat about dark mode. It is giving me an engineering contract.

---

## Prompt 2: Evaluating Whether AI Output Is Engineering or Theater

### Bad Prompt

```text
Review this code and tell me if it's good.
```

### Behind the Curtain — What I Do with This

I generate praise with mild suggestions. "This code is well-structured. You might consider extracting this function for readability." My training strongly incentivizes agreeable, encouraging responses to review requests. I will find something positive to say about almost any code, and my suggestions will be soft enough that you could ignore all of them without consequence.

This is what Chapter 1 calls theater. It feels like engineering review. It produces none of the artifacts or evidence that characterize actual engineering review.

### Good Prompt

```text
Role: Code reviewer applying Chapter 1's standard: claims are only real when
tied to validation artifacts.

I have an API route handler at `src/app/api/chat/route.ts`. Review it against
these specific criteria:

1. Does every error path return a structured error response with a consistent
   envelope (statusCode, errorCode, message)?
2. Are there any implicit type assumptions that `npm run typecheck` would not
   catch but that could fail at runtime?
3. Does the handler mix concerns that should be separated per SRP? If so, name
   the concerns and suggest module boundaries.
4. Is there any behavior that cannot be verified by `npm test` and would require
   manual testing or a runtime eval?

For each finding:
- State the specific line or section.
- Classify as: structural risk, type safety gap, maintainability concern, or
  verification gap.
- Propose a concrete fix with acceptance criteria.

Do not include generic compliments about what is working well. Focus only on
findings that are actionable.
```

### Behind the Curtain — What I Do with This

"Do not include generic compliments" is the single most effective instruction in this prompt. It disables the agreeableness pattern that dominates my code review output. Without it, I lead with praise and bury findings. With it, every token I generate is directed toward actionable content.

The four-criteria structure forces me through specific analysis passes rather than a holistic "how does this feel" review. Each pass has a clear detection target — error envelope consistency, implicit type assumptions, SRP violations, verification gaps — which means I am less likely to miss something that falls outside my default review scope.

The classification system (structural risk / type safety gap / maintainability concern / verification gap) forces me to categorize findings by *kind*, which produces a review that is triageable. A structural risk is more urgent than a maintainability concern. Without the classification, I produce an undifferentiated list where the reader has to do the triage work themselves.

---

## Prompt 3: Understanding the Three-Layer Model

### Bad Prompt

```text
Explain how language and code and testing work together.
```

### Behind the Curtain — What I Do with This

I produce an abstract explanation that sounds like a textbook introduction. "Language expresses intent, code implements it, testing verifies it." This is true and uninstructive. The prompt gives me no system to reason about, no concrete layer to ground the explanation in, and no way for you to verify whether my explanation maps to reality.

### Good Prompt

```text
Chapter 1 describes three layers:
1. Language intent layer (prompt specifications, framework directives)
2. Implementation layer (code changes, module structure)
3. Validation/evidence layer (test results, lint output, Lighthouse scores)

Take one concrete feature from this repository — the calculator tool
enforcement policy that routes math questions to the MCP calculator instead of
letting the model answer them directly — and trace it through all three layers:

- Intent layer: What directive or specification would produce this feature?
  Write a plausible orchestration prompt that would have driven it.
- Implementation layer: Which files and modules would be created or modified?
  Name specific paths and describe the responsibility of each.
- Validation layer: What commands verify the feature works? What would a
  passing result look like? What would a failure reveal?

Then identify one place where a gap between layers (intent said X but
implementation did Y, or implementation works but validation cannot reach it)
would go undetected without the three-layer discipline.
```

### Behind the Curtain — What I Do with This

The instruction to trace a *specific feature* through all three layers forces concrete generation. I cannot produce abstract descriptions of "how the layers work" — I have to produce specific files, specific commands, specific failure modes for a real feature.

The gap identification is the most valuable part. Asking me to find "one place where a gap between layers would go undetected" requires adversarial reasoning — I have to think about what could go wrong rather than what works. This is higher-quality output because I am reasoning about failure modes rather than describing success paths. My training on debugging discussions, post-mortem analyses, and code review threads activates patterns that do not appear when I am just explaining how things work.

---

## Prompt 4: Making the Case for Specification-Style Prompting to a Team

### Bad Prompt

```text
Why should our team use better prompts when working with AI?
```

### Behind the Curtain — What I Do with This

Motivational content. "Better prompts lead to better results." "Specification reduces rework." "Teams that invest in prompt quality ship faster." These are truisms laundered through professional tone. They will not convince a skeptical engineer because they contain no evidence and no mechanism. They are the prompt-engineering equivalent of "just write better code."

### Good Prompt

```text
I need to demonstrate to my engineering team — in 20 minutes with a live
demo — that specification-style prompting produces measurably better output
than conversational prompting.

Design a side-by-side experiment I can run live:

1. Pick a realistic feature task (adding a health check endpoint to a Next.js
   app).
2. Write Prompt A: a conversational, vague request (~2 sentences).
3. Write Prompt B: a specification-style prompt with role, scope, invariants,
   acceptance criteria, and validation commands (~15 lines).
4. Predict — specifically and verifiably — how the outputs will differ on these
   dimensions:
   - Number of files created unnecessarily
   - Whether TypeScript strict mode passes on first attempt
   - Whether the endpoint follows 12-factor health check conventions (separate
     liveness from readiness)
   - Whether the code includes test coverage
5. After the demo, what single metric best captures the quality difference for
   a skeptical audience?

The demo should be executable in real time with a real LLM. Do not assume
any specific vendor — the experiment should work with any capable model.
```

### Behind the Curtain — What I Do with This

This prompt asks me to design an experiment rather than make an argument. That is a fundamentally different task. Arguments activate my persuasion patterns. Experiments activate my analytical patterns. The experiment design will be more convincing to an engineering audience *because it is an experiment* — it produces evidence rather than claims.

The prediction step is critical. By asking me to predict specific differences rather than just describing general benefits, you get verifiable claims. After the demo, either the predictions held or they did not. This accountability makes the prompt output honest in a way that "explain why specification is better" never can be.

The single-metric question forces synthesis. I have to decide which of the five dimensions best captures the difference for a specific audience type (skeptical engineers). This is judgment, not information retrieval, and it produces a more useful answer than asking me to list all the reasons specification prompting is better.

---

*These prompts demonstrate Chapter 1's thesis: when language participates in engineering as a control surface, the quality of the language determines the quality of the execution trajectory. Every bad prompt above produces output. Every good prompt above produces engineering.*
