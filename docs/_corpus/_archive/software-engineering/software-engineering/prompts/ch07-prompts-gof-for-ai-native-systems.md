# Prompt Companion — Chapter 7: GoF Patterns for AI-Native Systems

> This companion document pairs with [Chapter 7](../chapters/ch07-gof-for-ai-native-systems.md). Each prompt pair shows how to apply GoF patterns to real AI-native architecture concerns — and what happens when pattern names are used without structural grounding.

---

## Prompt 1: Observer — Decoupling Emission from Observation

### Bad Prompt

```text
Add logging to my API routes.
```

### Behind the Curtain — What I Do with This

I scatter `console.log` statements through your route handlers. Maybe I use a logger library. Either way, the emission logic is hardcoded into every route. Adding a new logging destination (structured logger, metrics endpoint, audit trail) requires editing every route file. This is the coupling that Observer exists to eliminate.

My default is to solve the immediate problem (add logging) without considering the structural problem (every route is now coupled to the logging implementation).

### Good Prompt

```text
Pattern: Observer (GoF)
Problem: Route handlers in src/app/api/chat/route.ts emit metrics and log
events inline. Adding a new observability sink requires modifying route code.

Apply Observer as follows:

Subject: EventPublisher — a typed publisher in src/lib/observability/events.ts
Events: Discriminated union types:
  - RequestReceived { requestId, timestamp, model }
  - RequestCompleted { requestId, durationMs, tokenCount }
  - RequestFailed { requestId, errorCode, errorMessage }
  - ToolInvoked { requestId, toolName, durationMs, success }

Observers: Registered at startup. Current observers:
  - ConsoleMetricsObserver (logs structured JSON to stdout)
  - Future: PrometheusObserver, AuditTrailObserver (not implemented now)

Refactoring contract:
1. Route handlers call ONLY publisher.emit(event). No direct logging or
   metrics code in route files.
2. Adding a new observer requires zero changes to route files.
3. Event types are exhaustively typed — adding a new event type causes
   TypeScript errors in any observer that does not handle it.

Acceptance criteria:
1. `grep -r "console.log\|console.error" src/app/ --include="*.ts"` → 0 hits
2. `npm run typecheck` passes with discriminated union exhaustiveness checks.
3. `npm run lint:strict` passes.
4. Existing test behavior unchanged.
5. A test exists that registers a mock observer and verifies events are emitted
   for RequestCompleted and RequestFailed.

Invariants: No changes to API response shapes. No new npm dependencies.
```

### Behind the Curtain — What I Do with This

The discriminated union requirement is the most important structural decision in this prompt. It means every observer *must* handle every event type — TypeScript enforces this at compile time. When you add a new event type later, every observer that does not handle it will fail to compile. This is the Observer pattern earning its keep: new event types are safe to add because the type system ensures nothing is silently dropped.

Without this prompt's specificity, I would implement Observer with generic string-based events (`publisher.emit("request_completed", data)`), which provides the decoupling benefit but none of the type safety. The typed version is strictly better, but I only reach for it when the prompt requires it.

The grep command in the acceptance criteria is a zero-tolerance enforcement: no logging calls in route files, period. This is a machine-checkable property that proves the Observer pattern is actually being used, not just defined.

---

## Prompt 2: Decorator — Composable Cross-Cutting Behavior

### Bad Prompt

```text
Add retry logic and timing to my API calls.
```

### Behind the Curtain — What I Do with This

I add retry logic and timing directly to the provider call function. Now that function has three responsibilities: making the API call, retrying on failure, and recording timing. If you later want timing without retries (for a different call), or retries with a different timing format, you are editing the function again. The concerns are tangled.

### Good Prompt

```text
Pattern: Decorator (GoF)
Problem: The Anthropic provider call in src/lib/chat/anthropic-client.ts
needs cross-cutting behavior (timing, error shaping, retry logic) but
these concerns should not be hardcoded into the core provider logic.

Apply Decorator:

Core: The base provider call — accepts a request, returns a response. No
  cross-cutting behavior. Pure provider invocation.

Decorators (composable wrappers):
1. TimingDecorator — wraps the call and records durationMs. Emits a timing
   event via the Observer from the previous sprint.
2. ErrorShapingDecorator — catches provider errors and transforms them into
   typed error envelopes ({ statusCode, errorCode, message }).
3. RetryDecorator — retries transient failures up to N times with exponential
   backoff. Does not retry non-transient errors (auth failure, model not found).

Composition order: RetryDecorator(ErrorShapingDecorator(TimingDecorator(base)))

Acceptance criteria:
1. The base provider function has no timing, error shaping, or retry logic.
2. Each decorator can be used independently or composed.
3. Adding a new cross-cutting behavior (e.g., rate limiting) requires a new
   decorator, not editing existing ones.
4. `npm run typecheck` passes.
5. Tests exist for each decorator in isolation and for the composed chain.

Invariants: External API behavior unchanged. No new npm dependencies. All
decorators share the same function signature (ChatRequest → ChatResponse).
```

### Behind the Curtain — What I Do with This

The composition order specification (`RetryDecorator(ErrorShapingDecorator(TimingDecorator(base)))`) removes my most significant interpretation ambiguity. Decorator order matters: if timing wraps inside the retry boundary, you measure a single attempt's duration. If timing wraps outside, you measure total duration including retries. Both are valid; the prompt picks one. Without this, I guess — and my guess may not match your operational intent.

The "same function signature" invariant is what makes the decorators composable. If I broke the type compatibility between decorators, they could not be freely reordered or individually removed. TypeScript strict mode enforces this constraint, but only if the prompt establishes it as a requirement.

---

## Prompt 3: Chain of Responsibility — Error Classification

### Bad Prompt

```text
Improve error handling in my chat API.
```

### Behind the Curtain — What I Do with This

I add more catch blocks with more conditions. The if/else tree grows. Adding a new error case means inserting into an ever-longer conditional chain. Six months later, someone will look at this and see seventeen nested conditions with subtle ordering dependencies that no one can explain.

### Good Prompt

```text
Pattern: Chain of Responsibility (GoF)
Problem: Error handling in src/lib/chat/anthropic-client.ts uses nested
if/else blocks that mix classification logic with response construction.
Adding a new error type requires editing the middle of the conditional chain.

Apply Chain of Responsibility:

Handlers (ordered):
1. ModelNotFoundHandler — catches 404 from provider, returns
   { statusCode: 404, errorCode: "model_not_found", message: "..." }
2. RateLimitHandler — catches 429, returns
   { statusCode: 429, errorCode: "rate_limited", message: "..." }
   Include retry-after header value in the response if present.
3. TransientErrorHandler — catches 500/502/503 from provider. If retries
   remain, re-throws for the RetryDecorator. If retries exhausted, returns
   { statusCode: 502, errorCode: "provider_unavailable", message: "..." }
4. DefaultErrorHandler — catches anything not handled above, returns
   { statusCode: 500, errorCode: "internal_error", message: "..." }
   Logs the original error for debugging. Does NOT expose internal details
   to the client.

Chain contract:
- Each handler receives the error and either handles it (returns response)
  or passes it to the next handler.
- The chain is defined in one place (a handler registry).
- Adding a new error type requires adding one handler to the registry, not
  editing existing handlers.

Acceptance criteria:
1. No if/else error classification logic remains in the provider call path.
2. Each handler is a separate, testable unit.
3. Tests exist for each handler with mock errors.
4. The DefaultErrorHandler is always last and handles everything.
5. `npm run typecheck` and `npm run lint:strict` pass.

Invariants: Error response shapes for existing error types must not change.
API consumers should see identical error envelopes before and after the refactor.
```

### Behind the Curtain — What I Do with This

The handler specifications with exact status codes and error codes make my generation precise. I am not deciding what error codes to use — you have defined the contract. This means the output is predictable and matches your existing API documentation (if any).

The instruction "does NOT expose internal details to the client" in the DefaultErrorHandler is a security constraint that I would not add voluntarily. My default is to be helpful by including error details, which in production means leaking stack traces, provider error messages, or internal system information to external clients. The explicit constraint prevents this.

The "chain is defined in one place" requirement prevents me from scattering handler registration across multiple files — which is my default when "keeping things close to where they are used." A centralized registry is harder to forget to update and easier to audit.

---

## Prompt 4: Template Method + Facade — Route Lifecycle Unification

### Bad Prompt

```text
Reduce duplication in my API routes.
```

### Behind the Curtain — What I Do with This

I extract duplicated code into shared utility functions. This addresses the symptom (copied code) but not the cause (no shared lifecycle model). When the next route is added, the developer still has to know which utilities to call, in what order, with what error handling. The knowledge of "how a route works" remains implicit.

### Good Prompt

```text
Patterns: Template Method + Facade (GoF)
Problem: Multiple API routes duplicate lifecycle concerns: request correlation
ID generation, error envelope construction, observability event emission,
and response shaping. Each route implements these independently, and they
have already started to diverge.

Template Method — define the route lifecycle algorithm:
1. Generate request correlation ID.
2. Validate request (route-specific).
3. Execute business logic (route-specific).
4. Construct response envelope (shared shape).
5. Emit observability events (shared: RequestReceived, RequestCompleted or
   RequestFailed).
6. Return response.

Steps 2 and 3 are the variable parts (overridden per route).
Steps 1, 4, 5, and 6 are the invariant parts (owned by the template).

Facade — create src/lib/chat/http-facade.ts that:
- Exposes a single function: handleRoute(config, handler) where:
  - config = { routeName, validationSchema }
  - handler = the route-specific business logic function
- The facade owns all lifecycle steps and calls the handler for step 3.
- Route files call handleRoute() and provide only their business logic.

Acceptance criteria:
1. Route files are ≤30 lines. All lifecycle logic is in http-facade.ts.
2. Adding a new route requires creating one file that calls handleRoute()
   with a handler function. No lifecycle code is duplicated.
3. Observability events are emitted identically for all routes (consistent
   event shapes and timing).
4. Request correlation IDs appear in all route responses and error envelopes.
5. `npm run typecheck` and `npm run lint:strict` pass.
6. All existing tests pass.

Invariants: API response shapes unchanged. No new dependencies. Route paths
unchanged.
```

### Behind the Curtain — What I Do with This

The numbered lifecycle algorithm in the Template Method section is doing the core architectural work. I am not deciding what the lifecycle should be — you are defining it. My job is to implement it. This is a much cleaner division of responsibility than "reduce duplication," which requires me to reverse-engineer the lifecycle from multiple route implementations.

The ≤30 line constraint for route files is a measurable proxy for whether the Template Method is actually working. If a route is still 80 lines, the lifecycle extraction is incomplete. Line count is a crude but effective metric for architectural compliance.

The facade's `handleRoute(config, handler)` signature gives me a clear API to implement. The config object carries the per-route metadata, the handler carries the per-route logic, and the facade owns everything else. This separation is explicit enough that I can implement it without guessing at boundaries.

---

## Prompt 5: Evaluating Whether a Pattern Earns Its Keep

### Bad Prompt

```text
Should I use design patterns in my AI app?
```

### Behind the Curtain — What I Do with This

"Yes." Followed by a list of benefits. My training heavily biases toward recommending patterns because training data contains far more positive discussion of patterns than critical analysis. I will not tell you when a pattern costs more than it saves — unless you specifically ask.

### Good Prompt

```text
I have applied four GoF patterns to my codebase (Observer, Decorator, Chain
of Responsibility, Template Method + Facade). Before I commit these changes,
I need an honest cost-benefit assessment.

For each pattern:
1. What did it cost? (additional files, lines of code, abstraction layers,
   cognitive overhead for a new contributor reading the code for the first time)
2. What did it save? (duplicated code removed, change surface reduction for
   specific future scenarios, test isolation improvement)
3. What is the breakeven scenario? (How many future changes would need to
   benefit from this pattern before the upfront cost is recouped?)
4. What is the over-engineering risk? (Is this pattern justified by the
   current codebase size and change velocity, or is it premature for a system
   this small?)

Be honest about #4. If any of these patterns is over-engineering for a
Next.js application with 3 API routes and one MCP tool, say so. I would
rather remove an unnecessary pattern now than maintain it for a year.

Deliver as a table: Pattern | Files Added | Duplication Removed | Change
Surface Reduction | Breakeven Point | Recommendation (keep / simplify / remove)
```

### Behind the Curtain — What I Do with This

"Be honest about #4" combined with "I would rather remove an unnecessary pattern than maintain it" gives me explicit permission to recommend *against* a pattern. This is unusual in my interaction patterns — most prompts ask me to help *implement* something, and my training incentivizes completion over critical assessment.

The breakeven analysis forces quantitative reasoning. I have to estimate how many future changes would need to use each pattern's extension points before the abstraction cost is repaid. For a small codebase, some patterns may genuinely be premature. The honest answer might be "Template Method is justified because you will add more routes. Decorator is premature because you have one provider and may never add another." That kind of situated, honest assessment is more valuable than blanket pattern advocacy — but it only appears when the prompt demands honesty over enthusiasm.

---

*These prompts demonstrate Chapter 7's argument: GoF patterns are not legacy theory — they are operational leverage for modern systems. But they earn that leverage only when applied with explicit problem diagnosis, local interpretation, and honest cost-benefit assessment. A pattern applied mechanically is overhead. A pattern applied to a named structural problem with verifiable acceptance criteria is engineering.*
