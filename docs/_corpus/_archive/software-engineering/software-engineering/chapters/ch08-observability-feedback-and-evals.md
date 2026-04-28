# Chapter 8 — Observability, Feedback, and Evals

## Abstract

Without feedback loops, orchestration quality decays silently. This chapter defines how to instrument behavior and convert runtime signals into iterative improvements.

---

## Nicholas Zakas and the Case for Lint-as-Governance (2013)

**Nicholas Zakas** was a principal front-end engineer at Yahoo when he built ESLint. The existing tools — JSLint and JSHint — were not wrong. They were inflexible. JSLint enforced Douglas Crockford's opinions. JSHint was more configurable but still monolithic.

Zakas wanted something different: a linting framework where every rule was a plugin. No central authority on what "correct" JavaScript looked like. A team could install exactly the rules their codebase needed, write custom rules for their own conventions, and disable rules that didn't apply. The linter would become a policy engine, not an opinion.

This design decision matters more now than it did in 2013. In 2013, the concern was stylistic consistency. In the AI-assisted development era, the concern is verifying structural and a11y properties of code that was generated at machine speed and may never be manually reviewed line by line. ESLint is no longer primarily about semicolons. It is a governance mechanism — a deterministic gate that runs on every commit and can catch patterns that no AI reviewer will reliably flag.

**What frustrated him:** The assumption that a single person's opinion about code style should govern everyone's project. The realization that linting infrastructure should be owned by teams, not prescribed by tool authors.

---

Zakas built the tool that makes code *observable* at the policy level. The observability this chapter describes — structured signals, feedback loops, evals — is the broader architecture that tools like ESLint plug into.

## Why Observability Is a Design Primitive

In AI-native systems, the failure mode is often subtle degradation, not only hard crashes. Responses may become slower, less consistent, or more error-prone long before an outage is visible. Observability is therefore not just an SRE concern; it is an architecture concern.

If orchestration is your control surface, observability is your steering feedback.

> **A note from the model:**
> I cannot see my own outputs run. When I generate code, I produce it based on training and the context you give me. I do not know whether the function returns correctly under load, whether the latency is acceptable in production, or whether the fallback path triggers at the right threshold. Observability is your feedback loop — but it is also the only mechanism by which my outputs can be calibrated against real behavior. Without structured signals feeding back into your prompts and sprint artifacts, I am operating without a mirror. Every time you bring a runtime observation back into context — "this request is taking 3 seconds," "this error is appearing 4% of the time" — you are giving me information I could not have generated myself. That is not a limitation to route around. It is the architecture of a working human-AI system.

## The Signal Stack

Useful observability for orchestration-driven systems usually needs four signal classes:

1. **Correctness signals**: validation errors, tool-call failures, schema mismatches.
2. **Latency signals**: request duration, provider call duration, timeout incidence.
3. **Resilience signals**: retries, fallback path usage, non-transient failure rates.
4. **Governance signals**: config failures, startup guardrail triggers, release verification results.

Each class should map to structured events rather than ad hoc logs.

## Repository Example: Structured and Extensible Signals

This repository demonstrates the stack in concrete form:

- Route responses include `requestId` and `errorCode` for client-visible correlation.
- Observability emission flows through a typed publisher/listener model in `src/lib/observability/events.ts`.
- Route metrics emit as structured events via `src/lib/observability/metrics.ts`.
- Shared route orchestration in `src/lib/chat/http-facade.ts` centralizes lifecycle signal emission.

This design keeps route logic focused while maintaining consistent signal behavior.

## Practical Lens

Design observability to support both incident response and orchestration quality evolution. The Observer pattern from [Chapter 7](ch07-gof-for-ai-native-systems.md) provides the structural foundation; this chapter defines how the signals those observers emit are aggregated, evaluated, and acted on. The governance gates in [Chapter 9](ch09-risk-safety-and-governance.md) consume these signals as enforcement inputs.

## Evals as Operational Feedback

In this context, an "eval" is any repeatable measurement that assesses the quality of AI-assisted output against a defined standard. Evals are not limited to model benchmarks — they include runtime signal analysis, regression detection, and quality-gate verification.

Evaluation loops should be tied to real runtime characteristics, not only synthetic benchmarks. A practical pattern:

1. Capture structured runtime events (the signal stack above).
2. Define threshold-based alerts for regression classes — for example, if provider error rate exceeds 5% or p95 latency crosses 3 seconds.
3. Feed recurring regressions into sprint planning (see [Chapter 5](ch05-audit-to-sprint-loop.md) for the audit-to-sprint loop).
4. Validate fixes with the same observability signals that exposed the issue.

That closes the loop between observation and design improvement. The eval is not a separate activity — it is the feedback mechanism that connects runtime behavior to the next iteration of implementation.

## Anti-Patterns

- Logging without structure (hard to aggregate, harder to query).
- Signals without ownership (nobody responds to regressions).
- Metrics without action thresholds (vanity instrumentation).
- Separate eval workflows disconnected from production behavior.

## Exercise

Select one orchestration workflow and define:

- 3 correctness metrics,
- 2 latency metrics,
- 2 resilience metrics,
- 1 governance metric.

Then document who owns each metric and what action triggers when thresholds are violated.

## Chapter Checklist

- Are observability signals structured and queryable?
- Is correlation available across request boundaries?
- Do eval loops feed directly into execution planning?
- Can new signal sinks be added without route rewrites?

## Reader Exercise: Feedback Loop Diagram

Draw a closed-loop feedback diagram: runtime event emission -> aggregation/query -> threshold detection -> sprint backlog update -> implementation -> validation -> runtime re-measurement. Then define eight metrics for one of your workflows and assign ownership for each.

When all four hold, observability is functioning as a true engineering feedback system.
