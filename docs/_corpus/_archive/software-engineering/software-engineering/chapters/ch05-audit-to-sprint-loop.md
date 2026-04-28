# Chapter 5 — The Audit-to-Sprint Execution Loop

## Abstract

Reliable orchestration turns abstract critiques into concrete implementation cycles. This chapter presents the operating loop: audit findings, sprint plans, execution, verification, and archival.

---

## Ward Cunningham and the Debt Metaphor (1992)

**Ward Cunningham** coined the term *technical debt* in 1992. He also invented the Wiki — the first one, in 1995, as part of the Portland Pattern Repository, a collaborative space for recording software patterns. The idea that became Wikipedia started as an engineering knowledge tool.

The technical debt metaphor emerged from a conversation he was having with non-technical stakeholders about why software slows down over time. He needed a way to explain the cost of accumulated shortcuts without using engineering vocabulary. Debt was the bridge: like financial debt, technical shortcuts have interest. The longer you carry them, the more expensive they become to service.

Crucially, he was precise about what counted as debt. In his original framing, *deliberate* debt — shipping something you know is imperfect in order to learn from real usage — was legitimate. The debt was worth taking because the knowledge gained would let you pay it off correctly later. What was *not* legitimate was debt incurred through ignorance: writing code you don't understand fully, in patterns you haven't learned yet, and hoping it works out.

This distinction matters enormously for how you work with AI-generated code. AI produces output quickly. Some of that output is structurally sound. Some of it is the second kind of debt — code that works today and will cost significantly more to change tomorrow. The craft layer is what lets you tell the difference.

**What frustrated him:** The inability to have honest conversations with non-engineers about why the cost of change in software systems grows over time — and the absence of a shared vocabulary for naming and planning around that cost.

---

## Dave Thomas, Andrew Hunt, and the Pragmatic Philosophy (1999)

**Dave Thomas** and **Andy Hunt** published *The Pragmatic Programmer* in 1999. Their central argument: programming is a craft, not an assembly line. A pragmatic programmer takes responsibility for their tools, their environment, and their decisions.

The most quoted concept from the book is **DRY** — *Don't Repeat Yourself*. The full principle is more precise than most restatements give it credit for: *"Every piece of knowledge must have a single, unambiguous, authoritative representation within a system."* The emphasis is on *knowledge*, not just code. Duplicated logic is a symptom; duplicated *understanding* is the disease.

Their second most recognized concept is the **broken windows theory** applied to code: a codebase accumulates quality signals. A single uncaught linting warning sends a message to the next engineer — *things are allowed to slip here*. Quality is not a threshold you cross once; it is a discipline you maintain every commit.

They also introduced **tracer bullets** as a development philosophy: rather than building each layer completely before moving to the next, fire a thin slice all the way through the system end-to-end as early as possible. You learn more from a thin working path through real code than from a thick design that has never met a runtime.

**What frustrated them:** The prevalence of passive engineering — programmers who waited for requirements to be defined, tools to be chosen, and problems to be assigned, rather than taking active ownership of the quality and direction of their work.

---

Cunningham gave us the vocabulary for managing accumulated shortcuts. Thomas and Hunt gave us the attitude: own the craft, maintain the windows, fire tracer bullets. The audit-to-sprint loop that follows is the operational expression of both philosophies — sprint in bounded increments, verify each change, manage debt deliberately.

## Why This Loop Exists

Large refactors fail less from lack of ideas and more from loss of continuity. Teams often produce strong audits that never become structured execution. Or they implement aggressively without preserving rationale and evidence.

The audit-to-sprint loop solves that gap by converting diagnosis into controlled delivery.

---

## Phase Zero: Inquiry-Based Intelligence Gathering

The loop is usually described starting at audit. But reliable audits require a prior phase: gathering the expert-level context you do not yet have.

This technique is called **inquiry-based prompting**. Before writing a single sprint or acceptance criterion, you engage the model as a domain expert and systematically ask it the questions you would ask a senior practitioner if you had access to one.

The sequence looks like this:

1. **Ask about the great minds in the domain.** Who invented the foundational approaches? What were their concerns? What did they disagree about? This is not trivia — it surfaces the vocabulary and the failure modes that practitioners discovered before you arrived. For a video rendering system, you ask about the people who wrote video codec standards, the engineers who shipped the first hardware accelerators, the researchers who defined perceptual quality metrics.

2. **Ask about architecture.** What are the canonical approaches? What are the tradeoffs? What breaks at scale? What do senior engineers argue about? The goal is not to memorize answers — it is to develop enough vocabulary to evaluate options and spot problems in generated output.

3. **Ask about everything you don't know.** The model has breadth you don't have yet. The inquiry phase is where you extract it. Ask about security considerations, observability patterns, known failure modes, relevant standards, adjacent domains.

4. **Sculpt the output into a specification.** You are not accepting the model's responses wholesale — you are editing and shaping, like a sculptor removing material rather than adding it. You take the expert-level context, make decisions, and compress it into the high-level specification that will drive the audit and sprint work.

The key insight is that **intelligence is concentrated per phase**. Large language models have broad training but dispersed focus. By asking precise questions at the inquiry stage, you force concentration: the model brings its knowledge about video codec experts, or distributed systems failure modes, or WCAG accessibility standards, to bear on *your specific question* at the moment you need it. Each subsequent phase — audit, sprint plan, implementation, verification — narrows further. The specification is more focused than the inquiry. The sprint is more focused than the specification. The acceptance criteria are more focused than the sprint.

This is not a compression of intelligence — it is a *concentration* of it. You start at maximum breadth and work toward maximum specificity through successive sculpting passes.

### Deterministic and Probabilistic Verification in Tandem

Once execution begins, quality verification operates at two levels:

**Deterministic:** TypeScript, ESLint, test suites, Lighthouse. These gates are consistent, machine-speed, and objective. They answer the same question the same way every time. They are the floor — necessary but not sufficient.

**Probabilistic / qualitative:** AI-assisted review of artifacts the deterministic tools cannot evaluate. For a video rendering pipeline, this means using a multimodal model to actually watch the rendered output and provide technical analysis — frame rate consistency, color banding, encoding artifacts, perceptual quality across different content types. This is verification a human reviewer would take hours to do manually and a static linter cannot do at all.

The combination is the point. Deterministic tools enforce what can be formalized. Probabilistic review catches what requires interpretation. Neither alone is sufficient for complex output. Used together, they create a quality gate that matches the sophistication of the system being built.

A video rendering system built this way does not require you to be a codec engineer. It requires you to ask a codec engineer's questions at the inquiry stage, sculpt the answers into specifications, and then apply the appropriate verification at each layer of output.

> **A note from the model:**
> The inquiry phase is where I am most useful and most dangerous simultaneously. When you ask me about great minds in a domain, I will give you accurate names, contexts, and framings — but I will also give you confident-sounding answers about things I may have half-right. The discipline of the inquiry phase is not to accept the output but to use it as a starting map that you verify and sculpt. Ask me who the experts are, then look some of them up. Ask me what the canonical approaches are, then check whether the approach I named is the one the current field actually uses. What I give you in the inquiry phase is a high-quality first draft of the domain model — not the final specification. The quality of everything downstream depends on how carefully you edit that draft before it becomes a constraint.

---

## The Five-Stage Loop

1. **Audit**  

	Identify architectural and operational gaps with explicit findings. The audit is not a vague assessment — it is a structured review that names specific problems, cites evidence, and assigns severity. In this repository, the 12-Factor audit and GoF audit each produced a findings document with concrete gap descriptions.

2. **Plan**  

	Convert findings into sprint-sized units with acceptance criteria and sequence. Each sprint should be small enough to complete and verify in one session. The plan names what will change, what must not change (invariants), and how completion will be measured.

3. **Execute**  

	Implement one sprint at a time, preserving focus and minimizing cross-sprint drift. Resist the temptation to fix adjacent problems during execution — side-fixes bypass the plan, skip verification, and introduce untracked changes.

4. **Verify**  

	Run objective gates and collect evidence artifacts. In this project, verification means running `npm run typecheck`, `npm run lint:strict`, and `npm test` at minimum. The results are the evidence, not the narrative claim that "everything works."

5. **Archive**  

	Record outcome, move artifacts, and leave a reconstructable trail. Completed sprints move to `sprints/completed/` with their QA reports. This archive is not documentation for its own sake — it is the literal context that future sessions (human or AI) will need to understand what happened and why.

This is not ceremony for its own sake. It is memory architecture for complex change.

> Building high-quality sprint contracts requires precision in how you frame scope, invariants, and acceptance criteria. Those primitives are defined in [Chapter 3](ch03-prompt-orchestration-primitives.md).

## Repository Example: Loop in Action

This repository exercised the full loop in visible artifacts:

- `sprints/planning` stored scoped plans.
- `sprints/active` marked current execution focus.
- `sprints/completed` preserved implemented sprint records and QA audit outputs, including `QA-AUDIT.md` and `QA-AUDIT-12FACTOR.md` as objective evidence after each implementation wave.

The 12-factor wave and GoF wave both followed this model. The loop enforced continuity over many refactors without losing architectural intent.

## Why Validation Is Non-Negotiable

The loop is only trustworthy when verification is objective. In this repo, recurring quality gates acted as completion checks:

- `npm test`
- `npm run lint`
- `npm run build`

Narrative claims were accepted only when these gates passed.

## Practical Lens

Use this loop whenever work spans multiple files, concepts, or operational domains.

## Anti-Patterns

- **Audit theater**: writing findings without implementation path.
- **Execution sprawl**: doing many unrelated changes in one sprint.
- **Evidence debt**: claiming completion without repeatable validation outputs.
- **Context amnesia**: losing rationale because decisions stayed only in chat.

> **A note from the model:**
> Context amnesia is not a metaphor. I have no memory between conversations. Each session, I begin fresh — no recall of what we decided last week, no awareness of what broke during the last sprint, no knowledge of what the architecture looked like before your last refactor. Everything this project captured in sprint documents, QA reports, and audit artifacts is not just documentation for humans. It is the literal memory I can access when you load it into context. When you hand me a completed sprint archive, you are giving me my own history. When you skip that step, I am reasoning from a blank slate while you are working with accumulated knowledge. That asymmetry explains most of the correction cycles teams experience.

## Exercise

Take one active architectural concern and run a miniature loop:

1. Write a one-page audit.
2. Break it into 2–3 sprint files with acceptance criteria.
3. Execute exactly one sprint.
4. Validate with your standard gates.
5. Archive results in a completed artifact.

Repeat once. By the second cycle, your team will feel the reduction in ambiguity.

## Reader Exercise: The Loop Diagram

Draw the five-stage loop (Audit -> Plan -> Execute -> Verify -> Archive) and annotate each stage with one concrete repository artifact path from your own project. Then trace one real change through all five stages.

## Chapter Checklist

- Are all five stages present and operationalized?
- Can each stage be traced to a repository artifact?
- Do completion claims include objective validation evidence?

When the loop is disciplined, orchestration scales without losing engineering rigor.
