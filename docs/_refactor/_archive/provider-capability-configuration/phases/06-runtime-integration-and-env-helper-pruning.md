# Phase 06 - Runtime Integration And Env Helper Pruning

Status: implemented and QA-certified as of 2026-05-02.

## Goal

Make runtime intelligence-provider paths consume the effective selected provider
configuration created in Phases 03-05.

After Phase 06, chat stream, direct chat, conversation summarization, and blog
article production must work from SQLite-stored provider settings with no
provider API key in env. Anthropic remains supported. DeepSeek must work through
the Anthropic-compatible transport without inheriting Claude model fallbacks.

Phase 06 must not implement optional capability-provider pruning. Image
generation, TTS, STT, and web-search availability remain Phase 07.

## QA Certification

Phase 06 is certified complete against the phase contract as of 2026-05-02.

Verified outcomes:

- Runtime chat stream, direct chat, summarization, and blog article production
  compose from `createSelectedIntelligenceRuntime()`.
- Selected intelligence clients are created through
  `ProviderClientFactory.createAnthropicCompatibleClient()`.
- `ProviderResiliencePolicy` carries selected provider identity and provider
  model candidates.
- DeepSeek policy coverage proves no Claude fallback candidates are used.
- Provider lifecycle events include provider and model identity.
- Health readiness and admin diagnostics use selected provider config instead
  of Anthropic-only helper assumptions.
- Optional OpenAI image/audio/search capability pruning remains intentionally
  out of scope for Phase 06.

No open Phase 06 implementation gaps were found in the final QA pass.

## Baseline Grounding

This section records the pre-implementation state that Phase 06 was designed to
replace. It is preserved as provenance, not as current runtime behavior.

Phase 03 introduced provider config truth:

- `src/lib/ai/providers/provider-catalog.ts`
- `src/lib/ai/providers/provider-config-service.ts`
- `src/lib/ai/providers/provider-redaction.ts`

Phase 04 introduced provider client and validation factories:

- `src/lib/ai/providers/provider-client-factory.ts`
- `src/lib/ai/providers/provider-validation-service.ts`

Phase 05 made install/admin settings persist:

- `AI_PROVIDER`
- selected provider key/model/base URL
- optional capability provider settings

Runtime model paths still used Anthropic-shaped construction and env helper
names:

- `src/lib/chat/stream-route-handler.ts`
  - imports `getAnthropicApiKey()`.
  - resolves `apiKey` before the request pipeline has built the model runtime.
  - passes only `apiKey` to `createStreamResponse()`.
- `src/lib/chat/stream-execution.ts`
  - `CreateStreamResponseOptions` requires `apiKey: string`.
  - calls `runClaudeAgentLoopStream({ apiKey, ... })`.
- `src/lib/chat/anthropic-stream.ts`
  - constructs `new Anthropic({ apiKey })` when no client is injected.
  - defaults `modelCandidates`, retry, delay, and timeout from
    `providerRuntime.resolvePolicy("stream")`.
  - function name is Claude-specific even though the transport can serve
    Anthropic-compatible providers.
- `src/lib/chat/chat-turn.ts`
  - imports `Anthropic` and `getAnthropicApiKey()`.
  - constructs `new Anthropic({ apiKey })` directly.
  - calls `createAnthropicProvider()`.
  - uses `resolveProviderPolicy()` with Anthropic fallbacks.
- `src/lib/chat/anthropic-client.ts`
  - direct-turn provider adapter is named Anthropic-specific.
  - no-model error says `Set ANTHROPIC_MODEL`.
- `src/lib/chat/provider-policy.ts`
  - imports `getAnthropicRequestTimeoutMs()`,
    `getAnthropicRequestRetryAttempts()`,
    `getAnthropicRequestRetryDelayMs()`, and `getModelFallbacks()`.
  - `resolveProviderPolicy()` always uses Anthropic config/fallbacks.
  - provider events report `surface`, `model`, and `attempt`, but not provider.
- `src/lib/chat/provider-runtime.ts`
  - delegates to `resolveProviderPolicy()` and therefore inherits Anthropic
    fallbacks.
- `src/lib/chat/conversation-root.ts`
  - imports `AnthropicSummarizer`.
  - creates summarizer from `getAnthropicApiKey()` and `getModelFallbacks()[0]`.
- `src/adapters/AnthropicSummarizer.ts`
  - constructs `new Anthropic({ apiKey })` inside `summarize()`.
  - accepts only raw `apiKey` and `model`.
  - emits provider events with model but not provider.
- `src/lib/blog/blog-production-root.ts`
  - imports `Anthropic`.
  - creates `AnthropicBlogArticlePipelineModel` with
    `new Anthropic({ apiKey: getAnthropicApiKey() })` and
    `getAnthropicModel()`.
  - image generation still lazily uses OpenAI; capability gating for that
    remains Phase 07.
- `src/adapters/AnthropicBlogArticlePipelineModel.ts`
  - adapter name and error text are Anthropic-specific even though it only
    requires an Anthropic SDK-compatible client and model.
- `src/lib/health/probes.ts`
  - imports `getAnthropicApiKey()` and `getAnthropicModel()`.
  - readiness still reports the Anthropic helper contract instead of selected
    provider readiness.
- `src/lib/admin/processes.ts`
  - imports `getAnthropicModel()`.
  - diagnostics still expose `anthropicModel` instead of selected intelligence
    provider/model metadata.
- `src/lib/config/env.ts`
  - `getAnthropicApiKey()`, `getAnthropicModel()`,
    `getAnthropicRequestTimeoutMs()`, `getAnthropicRequestRetryAttempts()`,
    `getAnthropicRequestRetryDelayMs()`, and `getModelFallbacks()` are now
    compatibility wrappers around provider config, but runtime callers still
    consume the Anthropic-specific names.

Tests also encoded Anthropic/env assumptions:

- `src/app/api/chat/stream/route.test.ts`
- `src/lib/chat/chat-turn.test.ts`
- `src/lib/chat/provider-policy.test.ts`
- `src/lib/chat/anthropic-stream.test.ts`
- `src/adapters/AnthropicSummarizer.test.ts`
- `src/lib/blog/blog-production-root.test.ts`

## Implemented Grounding

Current runtime composition now lands in these selected-provider paths:

- `src/lib/ai/providers/selected-intelligence-runtime.ts`
  - resolves `ProviderConfigService.resolveSelectedIntelligenceProviderConfig()`.
  - requires the selected provider key.
  - constructs the Anthropic-compatible SDK client through
    `ProviderClientFactory`.
  - returns selected provider, client, model, base URL, redaction-safe metadata,
    and `ProviderResiliencePolicy`.
- `src/lib/chat/provider-policy.ts`
  - resolves policy from selected provider config.
  - includes provider identity in `ProviderResiliencePolicy`.
  - requires provider identity in provider lifecycle events.
- `src/lib/chat/stream-route-handler.ts` and
  `src/lib/chat/stream-execution.ts`
  - pass selected runtime client/policy into the stream adapter.
- `src/lib/chat/chat-turn.ts`
  - uses selected runtime client/policy for direct chat.
- `src/lib/chat/conversation-root.ts` and
  `src/adapters/AnthropicSummarizer.ts`
  - construct summarization with selected runtime client/provider/model.
- `src/lib/blog/blog-production-root.ts` and
  `src/adapters/AnthropicBlogArticlePipelineModel.ts`
  - construct article production with selected runtime client/provider/model.
- `src/lib/health/probes.ts`
  - checks selected intelligence provider readiness without live API calls.
- `src/lib/admin/processes.ts`
  - reports selected intelligence provider metadata instead of `anthropicModel`.

## Target Architecture

Keep the existing ports and orchestration. Replace construction and policy
resolution with selected-provider configuration.

Clean boundaries:

- `ProviderConfigService`
  - owns selected provider, key, model candidates, base URL, timeout/retry
    values, and source truth.
- `ProviderClientFactory`
  - owns construction of Anthropic-compatible SDK clients for Anthropic and
    DeepSeek.
- Runtime model factory/service
  - owns mapping resolved provider config to concrete runtime adapters.
  - should be small and dependency-injectable in tests.
- Chat stream/direct-turn adapters
  - own request/response/tool-loop mechanics only.
  - should accept a client/config/policy instead of reading env or constructing
    raw SDK clients from env.
- Summarizer and blog article adapters
  - implement existing domain ports.
  - should accept an Anthropic-compatible client, selected provider id, and
    selected model.
- `provider-policy.ts`
  - owns retry/fallback/error/event policy for the selected provider.
  - must use selected provider config, not Anthropic helper wrappers.

Recommended design patterns:

- Facade/Application Service: runtime provider factory that returns selected
  provider runtime dependencies for a surface.
- Adapter: Anthropic-compatible chat stream, direct-turn, summarizer, and blog
  model adapters.
- Strategy: provider catalog entry determines key/model/base URL/retry values.
- Dependency Inversion: routes and composition roots depend on provider
  runtime abstractions, not env helpers or raw SDK construction.

Avoid:

- Creating a second provider config store.
- Passing raw `process.env` into runtime model paths.
- Forking separate Anthropic and DeepSeek chat orchestration loops.
- Sending Claude fallback model names to DeepSeek.
- Renaming every domain port just because the first implementation used
  Anthropic.
- Changing optional OpenAI image/audio/web-search availability in Phase 06.

## Proposed Runtime Contracts

Add a small selected-provider runtime contract in `src/lib/ai/providers/` or
`src/lib/chat/`:

```ts
interface SelectedIntelligenceRuntime {
  provider: "anthropic" | "deepseek";
  client: Anthropic;
  model: string;
  baseUrl: string | null;
  policy: ProviderResiliencePolicy;
}
```

`ProviderResiliencePolicy` should be extended from:

```ts
interface ProviderResiliencePolicy {
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  modelCandidates: string[];
}
```

to:

```ts
interface ProviderResiliencePolicy {
  provider: "anthropic" | "deepseek";
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  modelCandidates: string[];
}
```

Provider lifecycle events should include provider identity:

```ts
interface ProviderAttemptEvent {
  provider: "anthropic" | "deepseek";
  surface: ProviderSurface;
  model: string;
  attempt: number;
  // existing fields unchanged
}
```

Phase 06 should make provider identity required on runtime intelligence events.
That gives operations a stable way to distinguish Anthropic vs DeepSeek
attempts when both use the same Anthropic SDK-compatible transport.

## Implementation Plan

### 1. Add Selected Provider Runtime Factory

Add a runtime factory such as:

- `src/lib/ai/providers/selected-intelligence-runtime.ts`

Responsibilities:

- Resolve `ProviderConfigService.resolveSelectedIntelligenceProviderConfig()`.
- Require a configured selected provider key.
- Build an Anthropic-compatible client through
  `ProviderClientFactory.createAnthropicCompatibleClient()`.
- Build selected-provider resilience policy from the resolved config, either
  directly or by delegating to `resolveProviderPolicy()` after that function is
  selected-provider aware:
  - provider id
  - model candidates
  - timeout
  - retry attempts
  - retry delay
  - base URL
- Return only redaction-safe metadata to logs/errors.

This factory should be the only new construction point for selected
intelligence provider clients.

### 2. Update Provider Policy

Change `resolveProviderPolicy()` so it reads selected provider config directly:

- `ProviderConfigService.resolveSelectedIntelligenceProviderConfig()`
- `config.timeoutMs.value`
- `config.retryAttempts.value`
- `config.retryDelayMs.value`
- `config.modelCandidates`
- `config.provider.value`

Remove its dependency on:

- `getAnthropicRequestTimeoutMs()`
- `getAnthropicRequestRetryAttempts()`
- `getAnthropicRequestRetryDelayMs()`
- `getModelFallbacks()`

Tests must prove:

- Anthropic policy uses Anthropic model candidates.
- DeepSeek policy uses DeepSeek model candidates.
- DeepSeek policy contains no Claude model names.
- Timeout/retry values are provider-specific.

### 3. Update Stream Runtime

Preferred shape:

- `executeChatStreamRoute()` obtains selected runtime once per request.
- `CreateStreamResponseOptions` accepts selected runtime or client/policy
  instead of `apiKey`.
- `createStreamResponse()` passes the selected client/policy into the stream
  loop.
- The stream loop no longer needs to construct `new Anthropic({ apiKey })` for
  normal runtime operation.

Implementation options:

- Rename `runClaudeAgentLoopStream()` to
  `runAnthropicCompatibleAgentLoopStream()` and export a compatibility alias
  during the migration.
- Or keep the file/function name temporarily but remove env/key ownership from
  it. If kept, record it as a rename debt for Phase 08.

Required behavior:

- Chat stream works with `AI_PROVIDER=deepseek` and SQLite `DEEPSEEK_API_KEY`.
- Chat stream emits selected model events.
- Chat stream retry/fallback policy is provider-specific.

### 4. Update Direct Chat Runtime

Update `src/lib/chat/chat-turn.ts` so it:

- does not import `Anthropic`.
- does not call `getAnthropicApiKey()`.
- obtains selected runtime through the new factory.
- passes selected client and selected policy to the direct-turn provider
  adapter.

Update `src/lib/chat/anthropic-client.ts`:

- Prefer a provider-neutral name such as
  `anthropic-compatible-chat-provider.ts`.
- Keep a temporary re-export if tests or callers need a small migration step.
- Replace Anthropic-specific errors with selected-provider language.

Required behavior:

- Direct chat works from SQLite-selected provider config.
- DeepSeek direct chat uses DeepSeek base URL and DeepSeek model candidates.

### 5. Update Conversation Summarization

Update `src/lib/chat/conversation-root.ts` so
`createConversationSummarizer()` uses selected runtime instead of
`getAnthropicApiKey()` and `getModelFallbacks()[0]`.

Update `src/adapters/AnthropicSummarizer.ts`:

- Prefer renaming to `AnthropicCompatibleSummarizer`.
- Constructor should accept an Anthropic-compatible client, provider id, and
  model, not raw `apiKey`.
- Keep the `LlmSummarizer` port unchanged.
- Event emission should use selected provider/model.
- Error text should not say "No valid Anthropic model" for DeepSeek.

Required behavior:

- Summarization works from SQLite-selected provider config.
- DeepSeek summarization does not use Claude fallbacks.

### 6. Update Blog Article Production

Update `src/lib/blog/blog-production-root.ts` so article-production model
construction uses selected runtime:

- no direct `new Anthropic(...)`
- no `getAnthropicApiKey()`
- no `getAnthropicModel()`

Update `src/adapters/AnthropicBlogArticlePipelineModel.ts`:

- Prefer renaming to `AnthropicCompatibleBlogArticlePipelineModel`.
- Constructor should accept an Anthropic-compatible client, provider id, and
  model.
- Keep the `BlogArticlePipelineModel` port unchanged.
- Error text should be provider-neutral.
- Provider events should use selected provider/model.

Do not change lazy OpenAI image provider behavior in Phase 06 except where
needed to keep tests compiling. Provider-backed image availability is Phase 07.

Required behavior:

- Article composition/review/QA/prompt design use selected provider config.
- DeepSeek article production uses DeepSeek base URL/model candidates.

### 7. Prune Env Helper Usage

After the runtime paths move, `src/lib/config/env.ts` should retain only helper
wrappers still used by non-Phase-06 surfaces.

Phase 06 removal/compatibility targets:

- Runtime chat stream should not import `getAnthropicApiKey()`.
- Direct chat should not import `getAnthropicApiKey()`.
- Conversation summarization should not import `getAnthropicApiKey()` or
  `getModelFallbacks()`.
- Blog article production should not import `getAnthropicApiKey()` or
  `getAnthropicModel()`.
- `provider-policy.ts` should not import Anthropic helper wrappers.

Do not remove OpenAI env helper usage for capability providers in this phase.

### 8. Update Health/Admin Diagnostics

Full diagnostics redesign belongs to Phase 08, but Phase 06 must remove
Anthropic-only runtime intelligence diagnostics from the specific readiness and
admin process paths that currently use the old helpers.

Update:

- `src/lib/health/probes.ts`
  - readiness should inspect selected-provider configuration, not
    `getAnthropicApiKey()` or `getAnthropicModel()`.
  - readiness must not perform a live provider API call.
  - readiness details should name the selected provider key/model source
    without leaking secrets.
- `src/lib/admin/processes.ts`
  - diagnostics should expose selected intelligence provider/model metadata,
    not `anthropicModel`.
  - preserve OpenAI optional capability diagnostics as Phase 07/08 work unless
    required for compile/test cleanup.

Do not add new raw-env provider diagnostics.

## Prune Targets

Remove or replace:

- `getAnthropicApiKey()` imports from runtime intelligence surfaces.
- `getAnthropicModel()` imports from blog article production.
- `getModelFallbacks()` imports from provider policy and summarizer creation.
- Direct `new Anthropic({ apiKey })` construction in runtime composition roots.
- Anthropic-only no-model error messages in runtime paths.
- Claude fallback defaults for DeepSeek.
- Anthropic-only readiness checks in `src/lib/health/probes.ts`.
- `anthropicModel` diagnostics in `src/lib/admin/processes.ts`.

Keep for now:

- Anthropic-compatible SDK usage. DeepSeek uses this transport.
- Domain ports:
  - `LlmSummarizer`
  - `BlogArticlePipelineModel`
  - chat orchestrator/provider abstractions
- OpenAI capability helpers and direct OpenAI capability routes until Phase 07.
- Temporary compatibility exports if renaming adapter files would create too
  much one-phase churn.

## Tests

Add or update focused tests for:

- `src/lib/ai/providers/selected-intelligence-runtime.test.ts`
  - builds Anthropic runtime from env and SQLite.
  - builds DeepSeek runtime from SQLite with DeepSeek base URL.
  - rejects missing selected provider key with a stable error.
  - returns provider-specific model candidates, timeout, retry attempts, and
    retry delay.
- `src/lib/chat/provider-policy.test.ts`
  - selected Anthropic policy has Claude candidates.
  - selected DeepSeek policy has only DeepSeek candidates.
  - selected DeepSeek policy includes no `claude` names.
  - provider events include selected provider/model.
- `src/lib/chat/anthropic-stream.test.ts` or replacement stream adapter test
  - accepts an injected Anthropic-compatible client.
  - uses passed selected-provider policy/model candidates.
  - does not require raw API key when client is injected.
- `src/app/api/chat/stream/route.test.ts`
  - no longer mocks `getAnthropicApiKey()`.
  - proves selected provider runtime is requested.
  - proves stream response receives selected runtime/client/policy.
- `src/lib/chat/chat-turn.test.ts`
  - no longer mocks `getAnthropicApiKey()` or raw `Anthropic`.
  - proves direct chat uses selected runtime client/policy.
  - proves tool manifest and prompt runtime behavior remain unchanged.
- `src/adapters/AnthropicSummarizer.test.ts` or renamed adapter test
  - accepts injected client.
  - emits selected provider/model.
  - has provider-neutral missing-model error text.
- `src/lib/chat/conversation-root.test.ts`
  - proves summarizer construction uses selected provider runtime.
- `src/lib/blog/blog-production-root.test.ts`
  - no longer mocks `getAnthropicApiKey()` or `getAnthropicModel()`.
  - proves article model construction is lazy and selected-provider-backed.
  - preserves lazy OpenAI image key behavior.
- `src/lib/health/probes.test.ts`
  - proves readiness succeeds for selected Anthropic config.
  - proves readiness succeeds for selected DeepSeek config.
  - proves readiness fails with a selected-provider missing-key message.
- `src/lib/admin/processes.test.ts`
  - proves diagnostics report selected intelligence provider/model metadata
    instead of `anthropicModel`.
- `src/adapters/AnthropicBlogArticlePipelineModel.test.ts` or renamed adapter
  test
  - emits selected provider/model.
  - keeps JSON repair behavior unchanged.

Integration-style proof:

- SQLite `AI_PROVIDER=deepseek`, `DEEPSEEK_API_KEY`, and `DEEPSEEK_MODEL`
  should allow chat stream/direct turn construction without
  `ANTHROPIC_API_KEY`.
- SQLite `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_MODEL`
  should remain backward-compatible.

## Source Cleanup Checks

Run these after implementation:

```bash
rg -n "getAnthropicApiKey|getAnthropicModel|getModelFallbacks|new Anthropic" src/lib/chat src/lib/blog src/lib/health src/lib/admin src/adapters/AnthropicSummarizer.ts src/adapters/AnthropicBlogArticlePipelineModel.ts
```

Expected result:

- no runtime composition root imports `getAnthropicApiKey()`.
- no runtime composition root imports `getAnthropicModel()`.
- no health/admin selected-provider diagnostic path imports
  `getAnthropicApiKey()` or `getAnthropicModel()`.
- no provider policy path imports `getModelFallbacks()`.
- direct SDK construction remains only inside `ProviderClientFactory` or
  adapter tests.

```bash
rg -n "claude" src/lib/ai/providers src/lib/chat src/adapters src/lib/blog
```

Expected result:

- Claude names are allowed in Anthropic catalog defaults/tests.
- DeepSeek policy/tests must not include Claude candidates.

## Validation Command Set

Minimum focused validation:

```bash
npm run test -- src/lib/ai/providers/provider-config-service.test.ts src/lib/ai/providers/provider-client-factory.test.ts src/lib/ai/providers/selected-intelligence-runtime.test.ts src/lib/chat/provider-policy.test.ts src/lib/chat/anthropic-stream.test.ts src/lib/chat/chat-turn.test.ts src/app/api/chat/stream/route.test.ts src/adapters/AnthropicSummarizer.test.ts src/lib/blog/blog-production-root.test.ts src/lib/health/probes.test.ts src/lib/admin/processes.test.ts
npm run typecheck
npx eslint src/lib/ai/providers src/lib/chat/provider-policy.ts src/lib/chat/provider-runtime.ts src/lib/chat/anthropic-stream.ts src/lib/chat/anthropic-client.ts src/lib/chat/chat-turn.ts src/lib/chat/stream-route-handler.ts src/lib/chat/stream-execution.ts src/lib/chat/conversation-root.ts src/adapters/AnthropicSummarizer.ts src/adapters/AnthropicBlogArticlePipelineModel.ts src/lib/blog/blog-production-root.ts src/lib/health/probes.ts src/lib/admin/processes.ts
```

Adjust filenames if adapters are renamed, but keep the same behavioral proof.

## Done

- [x] Chat stream uses selected provider config and works without env provider
      key when SQLite provider settings are present.
- [x] Direct chat uses selected provider config and works without env provider
      key when SQLite provider settings are present.
- [x] Conversation summarization uses selected provider config.
- [x] Blog article production uses selected provider config.
- [x] Provider policy resolves selected-provider model candidates, timeout,
      retry attempts, and retry delay.
- [x] DeepSeek fallback policy contains no Claude model names.
- [x] Provider events show selected provider and selected model.
- [x] Runtime intelligence surfaces no longer import Anthropic env helper
      wrappers.
- [x] Health readiness and admin process diagnostics no longer expose
      Anthropic-only intelligence provider assumptions.
- [x] Raw SDK construction for selected intelligence providers is centralized
      in `ProviderClientFactory`.
- [x] Optional OpenAI capability pruning is not claimed as complete.

## Implementation QA Closeout

Verified on 2026-05-02:

```bash
rg -n "getAnthropicApiKey|getAnthropicModel|getModelFallbacks|new Anthropic" src/lib/chat src/lib/blog src/lib/health src/lib/admin src/adapters/AnthropicSummarizer.ts src/adapters/AnthropicBlogArticlePipelineModel.ts
npm run typecheck
npm run test -- src/lib/ai/providers/provider-config-service.test.ts src/lib/ai/providers/provider-client-factory.test.ts src/lib/ai/providers/selected-intelligence-runtime.test.ts src/lib/chat/provider-policy.test.ts src/lib/chat/anthropic-stream.test.ts src/lib/chat/chat-turn.test.ts src/app/api/chat/stream/route.test.ts src/adapters/AnthropicSummarizer.test.ts src/lib/chat/conversation-root.test.ts src/lib/blog/blog-production-root.test.ts src/lib/health/probes.test.ts src/lib/admin/processes.test.ts tests/chat/provider-runtime.test.ts tests/chat/provider-parity.test.ts tests/chat/anthropic-stream.test.ts tests/chat/chat-timeout-and-corruption.test.ts tests/chat/chat-error-placeholder.test.ts tests/stream-pipeline.test.ts tests/anthropic-client.test.ts tests/health-probes.test.ts tests/admin-processes.test.ts tests/chat/chat-route.test.ts tests/evals/eval-live-runner.test.ts
npx eslint src/lib/ai/providers src/lib/chat/provider-policy.ts src/lib/chat/provider-runtime.ts src/lib/chat/anthropic-stream.ts src/lib/chat/anthropic-client.ts src/lib/chat/chat-turn.ts src/lib/chat/stream-route-handler.ts src/lib/chat/stream-execution.ts src/lib/chat/conversation-root.ts src/adapters/AnthropicSummarizer.ts src/adapters/AnthropicBlogArticlePipelineModel.ts src/lib/blog/blog-production-root.ts src/lib/health/probes.ts src/lib/admin/processes.ts src/lib/evals/live-runtime.ts
```

Final QA results:

- source cleanup grep: no matches.
- `npm run typecheck`: passed.
- focused and impacted tests: 23 files passed, 177 tests passed.
- eslint on Phase 06 runtime surface: passed.
