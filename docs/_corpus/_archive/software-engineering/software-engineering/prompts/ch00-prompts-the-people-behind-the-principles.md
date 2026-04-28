# Prompt Companion — Chapter 0: The People Behind the Principles

> This companion document pairs with [Chapter 0](../chapters/ch00-the-people-behind-the-principles.md). Each example shows a good prompt and a bad prompt for a task related to the chapter's core ideas, followed by a candid explanation of what the model does differently with each.

---

## Prompt 1: Learning Practitioner History for Applied Use

### Bad Prompt

```text
Tell me about design patterns and who invented them.
```

### Behind the Curtain — What I Do with This

I give you a Wikipedia-grade summary. Four names — Gamma, Helm, Johnson, Vlissides. The year 1994. A mention of "23 patterns." Maybe a list of the most famous ones. The output will be accurate, shallow, and useless for anything beyond cocktail-party trivia.

I do this because the prompt has no scope, no purpose, and no acceptance criteria. "Tell me about" activates my broadest, safest, most generic response pattern. I am trying to be helpful to someone whose intent I cannot determine, so I produce something that would be inoffensive to the widest possible audience. That is not the same as producing something useful for *your* work.

### Good Prompt

```text
I am building a Next.js application with server components and API routes that
call external AI providers. I need to understand the Gang of Four design
patterns well enough to recognize when my route handlers are accumulating
structural problems.

For each of these patterns — Observer, Decorator, Chain of Responsibility,
Template Method, and Facade — explain:

1. What specific codebase failure the pattern was designed to prevent.
2. The practitioner frustration that motivated it (who saw the problem, in what
   kind of system).
3. One concrete scenario in a Next.js + AI provider architecture where the
   absence of that pattern causes a real maintenance or reliability problem.

Do not list all 23 patterns. Focus only on the five I named. Be specific about
failure modes, not just benefits.
```

### Behind the Curtain — What I Do with This

The scope narrows my search space dramatically. Instead of constructing a generic overview from the entire GoF pattern inventory, I am working with five specific patterns, a specific technology stack, and a specific concern (structural problems in route handlers). Each response I generate gets evaluated against three explicit criteria — the failure mode, the practitioner story, the concrete scenario.

The instruction "be specific about failure modes, not just benefits" is doing more work than it looks like. My default training incentivizes positive, helpful framing. "Observer decouples producers from consumers" is the kind of sentence I generate fluently because it appears in thousands of tutorials. "Without Observer, adding a new metrics sink requires editing every route handler that emits events" is harder to generate — it requires me to reason about the *absence* of a pattern, which means modeling a codebase that does not have it. The explicit instruction to focus on failures overrides my default toward benefits.

The practitioner history grounding also changes my output quality. When I connect a pattern to Gamma's specific observation about duplicated structure, I am giving you the *why* beneath the pattern — which is what Chapter 0 argues makes principles stick.

---

## Prompt 2: Understanding Technical Debt for Code Review

### Bad Prompt

```text
What is technical debt?
```

### Behind the Curtain — What I Do with This

I produce Cunningham's metaphor, probably with the financial analogy, probably with a mention that it accumulates interest. It will read well. It will teach you nothing you could not have learned from the first paragraph of any article on the topic. I have no idea what you intend to do with the information, so I optimize for completeness over applicability.

### Good Prompt

```text
Ward Cunningham coined "technical debt" in 1992. He was precise about the
distinction between deliberate debt (shipping imperfect code to learn from
usage) and debt incurred through ignorance (shipping code you do not fully
understand).

I am reviewing AI-generated code in a Next.js project. The code works — tests
pass, types check — but I suspect some of it is the second kind of debt: code
that is structurally unsound in ways that will become expensive to change later.

Give me a checklist of 8–10 specific signals that distinguish debt-through-
ignorance in AI-generated TypeScript code from code that is genuinely well-
structured. For each signal, explain:

1. What to look for in the code.
2. Why AI generation tends to produce this specific form of debt.
3. What the long-term cost looks like if it is not addressed.

Ground the checklist in Cunningham's original distinction. Do not include
generic code-quality advice.
```

### Behind the Curtain — What I Do with This

This prompt does something unusual: it asks me to critique my own output patterns. The instruction "why AI generation tends to produce this specific form of debt" forces me to reason about my own failure modes — which I can do, because I have enough training data about AI code quality discussions to model the pattern.

The Cunningham grounding is not decorative. It forces every checklist item through a filter: is this deliberate debt (which is fine) or ignorance debt (which is expensive)? That distinction eliminates generic advice like "use meaningful variable names" — which is valid but is not about debt classification. The filter keeps the output focused on the specific judgment call Chapter 0 argues is the hardest part of working with AI-generated code.

The numbered structure (8–10 items, three sub-points each) gives me a clear completion target. Without it, I either produce too few items (stopping when the output "feels complete") or too many (generating until I run out of plausible-sounding entries). Explicit count constraints make the output more useful and more honest — I am less likely to pad with weak entries when there is a defined ceiling.

---

## Prompt 3: Researching a Practitioner's Contribution Deeply

### Bad Prompt

```text
Tell me about Barbara Liskov.
```

### Behind the Curtain — What I Do with This

Biography mode. Turing Award in 2008. Invented data abstraction. The substitution principle. Maybe a mention of CLU. The output will be a respectful summary that does not connect to anything you are building. It is the kind of text that fills an "about" sidebar and then never gets read again.

### Good Prompt

```text
Barbara Liskov formalized the substitution principle in 1987: if S is a subtype
of T, then objects of type T may be replaced with objects of type S without
altering any of the desirable properties of the program.

I am working on a TypeScript codebase where we have multiple provider
implementations behind a shared interface (e.g., different AI model providers
that implement the same ChatProvider interface). I want to understand Liskov's
principle deeply enough to:

1. Write an interface contract that truly respects substitutability — not just
   type-compatible signatures, but behavioral guarantees.
2. Identify violations that TypeScript's structural type system will NOT catch
   (i.e., places where the types match but the runtime behavior diverges).
3. Design tests that verify substitutability at the behavioral level, not just
   the type level.

Explain each point with reference to Liskov's original formalization. Then give
me one concrete example of a provider implementation that passes TypeScript
strict-mode checking but violates LSP at runtime, and show me how to write a
test that catches the violation.
```

### Behind the Curtain — What I Do with This

This prompt does three things my training strongly responds to:

First, it quotes the actual principle. This is not just for your benefit — it focuses my attention on the formal definition rather than the simplified version that circulates in most tutorials. The phrase "without altering any of the desirable properties of the program" is doing heavy lifting: it means behavioral substitutability, not just signature compatibility. Quoting it pulls my generation toward the formal interpretation.

Second, it asks me to find the gap between what TypeScript catches and what it misses. This is a genuinely interesting question because TypeScript's structural type system is powerful but not behavioral — two implementations can have identical type signatures and completely different runtime behavior. My training contains enough LSP discussion to reason about this well, but only if the prompt asks for it explicitly. The generic "tell me about Liskov" prompt will never surface this nuance.

Third, the concrete example request forces generation instead of description. I cannot produce a code example that violates LSP at runtime but passes TypeScript checking without actually reasoning about the failure mode — I have to construct a specific scenario. That construction is more useful than any amount of explanation.

---

## Prompt 4: Using Practitioner Stories for Team Communication

### Bad Prompt

```text
How do I explain to my team why we should care about software engineering
principles?
```

### Behind the Curtain — What I Do with This

I generate a motivational speech. "Principles reduce technical debt." "Good architecture scales better." "Teams that follow best practices deliver faster." These statements are true in the way that horoscopes are true — vaguely correct and specifically useless. I am activating my "persuasive professional communication" training patterns, which produce polished text with no operational content.

### Good Prompt

```text
I am preparing a 15-minute presentation for my engineering team about why
we are adopting structured AI-assisted development practices. The team is
skeptical — they think "prompt engineering" is a fad and that real engineers
just write code.

I need three practitioner stories from the history of software engineering that
each illustrate one principle we are adopting:

1. A story about why specification before implementation matters (connect to our
   practice of writing acceptance criteria before prompting).
2. A story about why shared vocabulary for structural patterns matters (connect
   to our adoption of GoF pattern names in code reviews).
3. A story about why automated verification gates matter more when code is
   generated at machine speed (connect to our TypeScript/ESLint/Lighthouse
   quality pipeline).

For each story:
- Name the practitioner and the specific frustration that produced the insight.
- State the principle in one sentence.
- Draw the explicit connection to our current AI-assisted practice.
- Keep each story under 200 words so I can present all three in 15 minutes.

Tone: direct, not academic. These are engineers who respect evidence, not
authority.
```

### Behind the Curtain — What I Do with This

The constraint "15-minute presentation" and "under 200 words each" completely changes my generation. Without word limits, I default to comprehensive coverage — which produces something too long to present and too dense to absorb. The word ceiling forces compression, which forces me to select the most impactful detail rather than listing everything I know.

The audience description ("skeptical... think prompt engineering is a fad") changes which stories I select and how I frame them. I am not going to lead with abstract principles for this audience. I am going to lead with credibility — practitioners who were solving real problems, not academics theorizing. Kent Beck working on the Chrysler payroll system. The Gang of Four cataloging what already worked in production codebases. Torvalds building Git in two weeks because the existing tools were inadequate. These are practitioner stories that resonate with engineers who respect practice over theory.

The explicit connection requirement ("connect to our practice of...") prevents me from telling the story and leaving the application as an exercise for the reader. It forces me to close the loop between history and current workflow in each story, which is exactly what Chapter 0 argues makes the difference between trivia and applicable knowledge.

---

## Prompt 5: Understanding the Thread Across Practitioners

### Bad Prompt

```text
What do all these software engineering people have in common?
```

### Behind the Curtain — What I Do with This

I produce a list of platitudes. "They were all passionate about quality." "They all cared about making software better." "They all contributed foundational ideas." These are technically true and operationally empty. The prompt gives me no frame for what "in common" means to you, so I generate the most universally agreeable commonalities — which are also the least informative.

### Good Prompt

```text
Chapter 0 of this book identifies a thread connecting practitioners from Hoare
(1965) through Anthropic (2023): they were all practitioners first, they all
solved vocabulary problems (not just technical ones), they were all responding
to complexity outpacing tools, and they were all honest about limits.

I want to test this thesis against my own engineering experience. Give me a
structured exercise:

1. For each of the four thread properties, provide two specific examples from
   the chapter's practitioners that illustrate it most sharply.
2. For each property, write one diagnostic question I can ask about my current
   team or project to determine whether we are exhibiting the same pattern or
   its opposite.
3. Identify one property that is most likely to be missing in a team that is
   adopting AI-assisted development for the first time, and explain why.

Format as a table with columns: Thread Property | Practitioner Examples |
Diagnostic Question | AI-Adoption Risk.
```

### Behind the Curtain — What I Do with This

The table format is important. It constrains my output into a structure that prevents rambling and makes gaps visible. If I cannot fill a cell, the table makes that absence obvious — which means I either reason harder or admit the gap rather than burying it in prose.

The diagnostic questions force generalization from historical examples to present practice. This is higher-quality generation because I am reasoning about *patterns* across practitioners rather than *summarizing* individual stories. My training is better at pattern recognition than at summary — summary tends to reproduce common framings, while pattern recognition across multiple examples produces genuinely useful insights.

The final question — "which property is most likely missing" — asks for a judgment call. This is where I am most useful and most likely to produce something you could not have easily generated yourself, because it requires synthesizing across all four properties and predicting which one a specific team composition would struggle with. The answer (it is usually "honest about limits") is defensible and actionable.

---

*These prompts are not templates. They are demonstrations of how the practitioner knowledge in Chapter 0 translates into operational prompt quality. Adapt the scope, constraints, and acceptance criteria to your own codebase and team. The mechanism — not the wording — is what matters.*
