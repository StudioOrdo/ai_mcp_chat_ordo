# Prompt Companion — Chapter 8: Observability, Feedback, and Evals

> This companion document pairs with [Chapter 8](../chapters/ch08-observability-feedback-and-evals.md). Each prompt pair shows how to build feedback loops that make AI-assisted system behavior observable and improvable — and what happens when observability is treated as an afterthought.

---

## Prompt 1: Defining a Signal Stack

### Bad Prompt

```text
Add monitoring to my AI app.
```

### Behind the Curtain — What I Do with This

I add a health endpoint and some `console.log` statements. Maybe a request counter. The signals are ad hoc, unstructured, and not connected to any operational response. When something goes wrong, you will have data points but no diagnosis framework — like having a thermometer without knowing what temperature indicates a fever.

### Good Prompt

```text
Design an observability signal stack for the chat API route using Chapter 8's
four signal classes.

Architecture context: Next.js App Router, streaming AI responses via Anthropic
API, MCP calculator tool integration, Observer event bus already in place
(from Chapter 7 sprint).

For each signal class, define 2–3 concrete signals:

1. **Correctness signals**: What tells us the system is producing correct
   output?
   - Examples: tool-call validation pass/fail, schema conformance, response
     completeness.

2. **Latency signals**: What tells us the system is responding within
   acceptable bounds?
   - Examples: end-to-end request duration, provider API call duration,
     tool execution duration.

3. **Resilience signals**: What tells us the system handles failure
   gracefully?
   - Examples: retry count per request, fallback path activation rate,
     provider error rate by type.

4. **Governance signals**: What tells us the system is operating within
   policy bounds?
   - Examples: config validation pass/fail at startup, TypeScript/ESLint
     gate results, release manifest verification.

For each signal:
- Name (machine-readable, e.g., `chat.provider.latency_ms`)
- Type (counter, histogram, gauge, event)
- Emission point (which module/function emits it)
- Threshold (at what value does this signal indicate a problem?)
- Owner (who responds when the threshold is breached?)

Acceptance criteria:
1. All signals emit through the Observer event bus (no direct logging in
   routes).
2. Each signal has a named threshold.
3. The signal set covers all four classes.
4. `npm run typecheck` passes with typed event definitions.
```

### Behind the Curtain — What I Do with This

The four-class structure from Chapter 8 forces comprehensive coverage. My default is to focus on the signals I think are most useful (usually latency and errors), which leaves correctness and governance signals unaddressed. The class structure ensures no category is skipped.

Thresholds are the most important part of this prompt. A signal without a threshold is a number without meaning. "Provider latency is 2.3 seconds" means nothing until you know the threshold is 3 seconds (acceptable) or 1 second (problem). Explicit thresholds make every signal actionable.

The owner requirement addresses the anti-pattern Chapter 8 calls "signals without ownership." A signal that nobody is responsible for responding to is noise, not observability. By requiring an owner per signal, the prompt produces an operational assignment, not just a monitoring configuration.

---

## Prompt 2: Building an Eval Loop

### Bad Prompt

```text
How do I know if my AI app is working well?
```

### Behind the Curtain — What I Do with This

I list quality indicators: response accuracy, user satisfaction, error rates. These are conceptically correct and operationally useless because I have not connected them to any measurement mechanism, threshold, or response action. Knowing that "response accuracy matters" does not help you measure it today.

### Good Prompt

```text
Design an eval loop for the chat API that converts runtime signals into
iterative improvements.

The loop should follow Chapter 8's four-step pattern:
1. **Capture**: Structured runtime events from the Observer event bus.
2. **Threshold**: Regression detection rules.
3. **Feed into planning**: How regressions enter the sprint backlog.
4. **Validate fixes**: How the same signals verify that fixes work.

Implement for this specific scenario:

Regression type: Provider error rate has increased from 2% to 8% over the
past week. The errors are a mix of 429 (rate limit) and 500 (provider
internal error).

Design the eval loop steps:
1. **Capture**: Which events from the signal stack detect this? What
   aggregation (per-hour, per-day, rolling window)?
2. **Threshold**: At what error rate does an alert fire? Who receives it?
   What information does the alert contain?
3. **Sprint input**: Write the audit finding and sprint acceptance criteria
   that would address this regression.
4. **Validation**: After the fix sprint, which signal returning to what
   value proves the fix worked?

Deliver as a runbook: a step-by-step document an on-call engineer could
follow at 2am.
```

### Behind the Curtain — What I Do with This

The specific regression scenario (2% to 8% error rate, mixed 429/500s) grounds the eval loop in a real situation. Instead of designing an abstract feedback system, I am designing a response to a concrete problem. This produces a dramatically more useful output because every step is grounded in specific signals and specific actions.

The runbook format changes my generation from "here is how eval loops work" to "here is what to do when this specific thing happens." The runbook is immediately operational — it can be used tonight if the regression appears. That is the difference between documentation and tooling.

The four-step pattern creates a closed loop. Step 4 (validation) feeds back to step 1 (capture) by requiring the same signal to confirm the fix. This closure is what makes the loop self-correcting rather than one-shot.

---

## Prompt 3: Feeding Observations Back into Prompts

### Bad Prompt

```text
My AI responses are sometimes slow. How do I fix this?
```

### Behind the Curtain — What I Do with This

I suggest caching, model selection, or prompt optimization without knowing what "slow" means in your context, where the latency is occurring, or what your baseline expectations are. My suggestions will be generically reasonable and specifically unjustified.

### Good Prompt

```text
Observability data shows that 12% of chat API requests exceed 5 seconds
end-to-end. The breakdown:
- Provider API call: 3.2s average (p95 = 4.8s)
- Request validation: 15ms
- Response serialization: 50ms
- Tool invocation (when used): 200ms

The latency is dominated by the provider call. The model is claude-haiku-4-5.

Given this observability data:

1. What prompt-level changes could reduce provider response time?
   (Be specific about which prompt characteristics affect latency:
   prompt length, system prompt complexity, response token count,
   tool schema size.)

2. What architecture-level changes could reduce perceived latency?
   (Streaming, request prioritization, async processing.)

3. What operational changes could keep the current latency but make
   the user experience acceptable? (Loading states, progressive
   rendering, timeout handling.)

For each recommendation, estimate the expected improvement in p95 latency
and the implementation effort (hours). Do not recommend changes that would
reduce response quality to improve speed.

Acceptance criteria:
1. At least one recommendation per category.
2. Each recommendation has an estimated p95 improvement.
3. No recommendation trades quality for speed without flagging the tradeoff.
```

### Behind the Curtain — What I Do with This

The observability breakdown transforms this from a vague "it's slow" complaint into a situated performance analysis. I know the bottleneck is provider call latency, not validation or serialization. This eliminates 80% of the possible recommendations and focuses me on the 20% that would actually affect the dominant cost.

The three-category structure (prompt-level, architecture-level, operational) ensures I do not fixate on one approach. A common failure is recommending only prompt changes when the real solution is streaming — or recommending only streaming when the real issue is an oversized system prompt.

"Do not recommend changes that would reduce response quality to improve speed" is a constraint that prevents me from suggesting the easiest optimization (shorter responses, simpler model) when the actual requirement is maintaining quality while improving speed. Without it, "use a smaller model" would be my first suggestion.

---

## Prompt 4: Correlation IDs and Request Tracing

### Bad Prompt

```text
Help me debug issues in my API.
```

### Behind the Curtain — What I Do with This

I suggest `console.log` statements. The industry has spent decades building observability infrastructure to move beyond this approach, and "help me debug" sends me straight back to it. My most probable response to vague debugging requests is the most primitive debugging technique.

### Good Prompt

```text
Implement request correlation across the chat API request lifecycle.

Requirements:
1. Generate a unique requestId (UUID v4) at the start of every API request.
2. The requestId must appear in:
   a. Every observability event emitted during the request lifecycle.
   b. The response envelope (both success and error).
   c. Every log line emitted during the request.
   d. The error envelope if the request fails.
3. If the request includes a tool invocation, the tool invocation event
   must include the parent requestId.
4. If the request triggers a provider call, the provider call event must
   include the parent requestId.

Implementation constraint: requestId propagation should use function
parameters, not global state or AsyncLocalStorage (keep it explicit and
traceable).

Acceptance criteria:
1. A single request produces events that can be aggregated by requestId.
2. The response includes the requestId so the client can reference it in
   support requests.
3. Error responses include requestId for incident correlation.
4. `npm run typecheck` and `npm run lint:strict` pass.
5. A test verifies that events emitted during a request share the same
   requestId.

Deliver: Module changes with full requestId propagation path documented.
```

### Behind the Curtain — What I Do with This

The explicit propagation path (where requestId must appear) prevents me from implementing correlation halfway. My default would be to add requestId to the response and maybe one log line — but skip the tool invocation events and provider call events, which are exactly where correlation is most valuable for debugging.

"Use function parameters, not global state or AsyncLocalStorage" is an architectural decision that keeps the correlation path explicit. AsyncLocalStorage is convenient but makes the propagation invisible — you cannot trace how the requestId gets from point A to point B by reading the code. Function parameters make the data flow visible.

---

## Prompt 5: Designing Observability That Survives the Next Model Update

### Bad Prompt

```text
How do I make sure things don't break when the model changes?
```

### Behind the Curtain — What I Do with This

I suggest version pinning and testing. These are correct but incomplete. The deeper problem — detecting behavioral changes that do not cause errors but alter output quality — requires observability infrastructure, not just deployment configuration.

### Good Prompt

```text
Chapter 8 describes orchestration drift risk: prompt contracts, model
behavior, and process assumptions evolving at different speeds.

Design an observability strategy that detects orchestration drift after
a model version update.

Scenario: We upgrade from claude-haiku-4-5 to a newer model version.
The API does not break. Types still check. Tests pass. But the model's
tool-selection behavior has changed subtly: it now calls the calculator
tool 30% less often for math questions, preferring to answer math directly.

Signal design:
1. What metric would detect this drift? (Define it precisely: name, source,
   aggregation window, baseline value, drift threshold.)
2. Where does this metric get emitted? (Specific module and event type.)
3. What does the alert message look like when drift is detected?
4. What sprint artifact does the alert produce? (Write the audit finding.)

Then design an activation-based eval that can be run on-demand after any
model update:
- A set of 10 test prompts that should trigger tool invocation.
- Expected behavior for each (tool called / tool not called).
- A pass/fail threshold (e.g., ≥8/10 triggers tool use → pass).
- The command to execute the eval and the output format.

Acceptance criteria:
1. The drift-detection metric is implementable with the existing Observer
   event bus.
2. The activation eval can be run as a single command.
3. Both mechanisms work for any model version change, not just this specific
   upgrade.
```

### Behind the Curtain — What I Do with This

The specific scenario (calculator tool usage dropping 30% after model update) makes the drift concrete rather than theoretical. I am not designing a generic monitoring system — I am designing detection for a specific behavioral change that passes all deterministic tests. This is precisely the gap between what automated tools catch and what observability must catch.

The activation eval design (10 test prompts with expected tool behavior) is a lightweight regression suite for model behavior — not code. This is what Chapter 8 means by "evals as operational feedback": measuring the system's behavior against expectations that cannot be encoded in TypeScript or ESLint.

The requirement that mechanisms "work for any model version change" prevents me from overfit my drift-detection to the specific scenario. The strategy needs to generalize. This produces a more robust design.

---

*These prompts operationalize Chapter 8's core argument: without feedback loops, orchestration quality decays silently. Observability is not an add-on — it is the mechanism by which model outputs, system behavior, and operational health become visible, measurable, and improvable. Every signal needs a name, a threshold, an owner, and a response action. Everything else is noise.*
