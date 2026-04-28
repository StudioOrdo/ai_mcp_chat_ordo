# Chapter 10 — Case Study: IS601 Demo

## Abstract

This chapter narrates the transformation of this repository from baseline scaffold to a pattern-driven, operationally mature AI application.

## Why This Case Study Matters

Many books explain principles in isolation. This case study shows what it looks like when principles are executed under real constraints, in sequence, with verification pressure.

The important value here is not that every change was perfect on the first attempt. The value is that the process was structured enough to absorb corrections while still moving forward.

This project’s teaching value is the architecture pairing itself: Next.js as application/runtime shell, MCP as capability/tool protocol, and operational scripts as reliability spine.

## Initial State

The project began as a straightforward Next.js application scaffold. At that point, the architecture was serviceable but not yet intentionally optimized for:

- strict operational reliability,
- deep observability,
- pattern-driven extensibility,
- long-run orchestration discipline.

From there, the system was evolved through successive intent-driven passes.

## Evolution Phases

### Phase 1: Feature Delivery

- Claude chat integration
- calculator tool enforcement for math
- streaming behavior improvements

### Phase 2: Structural Cleanup

- SRP-oriented decomposition
- shared modules for policy/config/validation
- expanded test coverage and safer boundaries

### Phase 3: 12-Factor Operational Hardening

- config and secret controls
- build/release/run discipline
- readiness/liveness endpoints
- parity and admin process scripts

### Phase 4: GoF Pattern Upgrades

- Observer for observability event bus
- Decorator for provider cross-cutting behavior
- Chain of Responsibility for provider error routing
- Template Method + Facade for route lifecycle unification

This sequence mattered: each phase built on the guarantees produced by the previous one.

## Practical Lens

Use this case study as a repeatable migration template: deliver capability, stabilize structure, harden operations, then optimize extensibility.

> The audit-to-sprint loop that drove each phase is defined in [Chapter 5](ch05-audit-to-sprint-loop.md). The 12-factor and GoF principles applied in Phases 3 and 4 are covered in [Chapter 6](ch06-12-factor-in-the-llm-era.md) and [Chapter 7](ch07-gof-for-ai-native-systems.md).

## Evidence-Driven Outcomes

The project’s maturity claims are backed by repository artifacts, not narrative assertion:

- sprint plans and execution history under `sprints/`
- QA summaries under `sprints/completed/`
- operational scripts under `scripts/`
- architectural modules under `src/lib/`
- repeated quality-gate execution through test/lint/build commands

## What Went Wrong (And Why That Matters)

No refactoring process is linear. Three specific things broke during this project's evolution, and those corrections are more instructive than the successes.

**First: graceful shutdown was missing.** The initial streaming route had no logic for draining in-flight requests on process termination. The app worked in development. In any production deployment requiring zero-downtime restarts, it would have silently corrupted in-progress responses. This was caught by the 12-factor audit — not by any pre-existing test. It became the direct impetus for `scripts/start-server.mjs` and the explicit Disposability coverage in Chapter 6.

**Second: the chat route became a monolith.** The API route handler grew to mix request validation, orchestration policy, provider invocation, and error handling in a single file. Each concern worked correctly in isolation, but changing any one of them required understanding all of them. The SOLID/SRP audit found this. The fix was decomposing into `validation.ts`, `policy.ts`, `orchestrator.ts`, and `http-facade.ts`. No behavior changed. The change surface shrank dramatically.

**Third: a model alias broke without warning.** A model identifier changed between development testing and integration (`claude-haiku` → `claude-haiku-4-5`). The original code had no fallback mechanism and failed hard with an opaque API error. This revealed a simultaneous config management gap (Factor III) and dev/prod parity gap (Factor X). The fix — centralizing model config with fallback logic in `src/lib/config/env.ts` — addressed both.

> **A note from the model:**
> I produced all three of those bugs. The missing graceful shutdown, the route monolith, the model alias failure — I wrote that code. In each case, I was given a bounded task and completed it correctly within the stated scope. In each case, the scope did not include the operational concern that later caused the failure. This is not an excuse. It is a precise description of the constraint you are working with: I optimize for the acceptance criteria I am given, not for concerns you have not named. The audit passes named them. That is why the audit passes exist. If you want me to catch operational concerns in initial implementation, name them in the acceptance criteria. If you discover them later through structured audits, that is also the method working correctly — just at a different phase.

These failures are not embarrassments. They are the expected output of running structured audits against real systems. The process surfaces them in bounded, fixable form before production pressure makes them costly.

## Timeline Snapshot

1. Baseline Next.js setup and validation.
2. Claude chat + calculator tool enforcement.
3. Streaming and responsiveness improvements.
4. Uncle Bob-oriented architecture cleanup.
5. Full 12-factor audit, sprint planning, and execution.
6. GoF passes adding Observer/Decorator/Chain and Template/Facade structures.

## Lessons from the Process

1. **High-level directives become reliable only when converted into sprint-scale acceptance criteria.** A directive like "apply 12-Factor" is meaningless until it becomes "centralize config in `env.ts` with startup validation, passing `npm run typecheck`." The conversion is the work.
2. **Architecture quality grows faster when operational quality is improved in parallel.** Structural refactors are safer when health endpoints, graceful shutdown, and release integrity are already in place. Build the operational floor before reshaping the rooms.
3. **Pattern refactors are safer after strong regression gates are in place.** The GoF passes in Phase 4 would have been riskier without the test coverage and CI gates established in Phases 2 and 3. Order matters.
4. **Durable artifacts reduce context loss across long, multi-phase execution.** Each sprint's QA report became the starting context for the next sprint's audit. Without those artifacts, every session would have started from scratch.

## Repository Evidence

- 12-factor completion evidence: `sprints/completed/QA-AUDIT-12FACTOR.md`
- GoF pass evidence: `sprints/completed/sprint-gof-01-observer-decorator-chain.md` and `sprints/completed/sprint-gof-02-template-facade.md`
- Quality evidence: repository scripts and repeated `test/lint/build` gates.

## Exercise

Create a case-study timeline for one of your own repositories with four phases:

1. capability delivery,
2. structural cleanup,
3. operational hardening,
4. extensibility optimization.

For each phase, require one evidence artifact and one validation command set.

## Chapter Checklist

- Does the chapter describe sequence, not only outcomes?
- Are maturity claims backed by concrete artifacts?
- Can the process be reused by another team without hidden context?

## Reader Exercise: Phase Timeline

Draw a phase timeline diagram with four bands: feature delivery, structural cleanup, 12-factor hardening, and GoF refactors. Annotate each band with one artifact and one validation gate from your own project.

When all three hold, this case study functions as method, not just story.
