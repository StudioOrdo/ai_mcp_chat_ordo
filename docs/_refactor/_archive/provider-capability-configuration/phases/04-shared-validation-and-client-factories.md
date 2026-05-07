# Phase 04 - Shared Validation And Client Factories

Status: complete as of 2026-05-02.

## Goal

Centralize provider SDK construction and external key/model validation without
yet migrating every runtime caller.

Phase 04 must remove duplicated install/admin validation logic, validate the
selected intelligence provider/model pair through one service, and introduce
client factories that later runtime phases can consume. It must not take over
tool availability pruning, direct route guards for optional capabilities, or
the full chat/blog runtime migration. Those belong to Phases 06 and 07.

## Current-Code Grounding

Phase 03 added the provider catalog and resolver:

- `src/lib/ai/providers/types.ts`
- `src/lib/ai/providers/provider-catalog.ts`
- `src/lib/ai/providers/provider-config-service.ts`
- `src/lib/ai/providers/provider-redaction.ts`

The remaining validation drift is concentrated in two routes:

- `src/app/api/install/validate-keys/route.ts`
  - imports `@anthropic-ai/sdk` and `openai` directly.
  - duplicates `extractApiErrorMessage`.
  - requires `anthropicKey`.
  - validates with hard-coded `claude-3-haiku-20240307`.
  - validates optional OpenAI with `openai.models.list()`.
- `src/app/api/admin/system/keys/route.ts`
  - imports `@anthropic-ai/sdk` and `openai` directly.
  - duplicates the same `extractApiErrorMessage`.
  - validates with hard-coded `claude-3-haiku-20240307`.
  - persists only `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.

The current runtime SDK construction surfaces are broader:

- `src/lib/chat/chat-turn.ts` constructs `new Anthropic({ apiKey })`.
- `src/lib/chat/anthropic-stream.ts` constructs `new Anthropic({ apiKey })`
  when no client is injected.
- `src/lib/chat/conversation-root.ts` creates `AnthropicSummarizer` with legacy
  Anthropic helper values.
- `src/adapters/AnthropicSummarizer.ts` constructs `new Anthropic({ apiKey })`
  inside `summarize`.
- `src/lib/blog/blog-production-root.ts` constructs Anthropic and OpenAI
  clients.
- `src/core/use-cases/tools/admin-web-search.tool.ts` constructs an OpenAI
  client.
- `mcp/admin-web-search-server.ts` constructs an OpenAI client.
- `src/app/api/e2e/media/generated-image/route.ts` constructs an OpenAI
  client for test/e2e image generation.
- `src/app/api/tts/route.ts` and
  `src/lib/audio/audio-generation-service.ts` call OpenAI speech through raw
  `fetch("https://api.openai.com/v1/audio/speech")`.

Phase 04 must create factories that can serve these runtime surfaces, but only
install/admin validation route internals are required migration targets in this
phase. Runtime integration and env-helper pruning remain Phase 06. Capability
availability and route/job disabled guards remain Phase 07.

## Target Modules

Add these files:

- `src/lib/ai/providers/provider-client-factory.ts`
- `src/lib/ai/providers/provider-validation-service.ts`

Optional helper extraction is allowed if it keeps the validation service small:

- `src/lib/ai/providers/provider-validation-errors.ts`

Do not add another configuration store. These modules must consume
`ProviderConfigService` outputs or explicit route input DTOs, not raw
`process.env`.

## Client Factory Contract

`ProviderClientFactory` is a small factory/facade over provider SDK
construction.

Required behavior:

- Build an Anthropic SDK client for `anthropic`.
- Build an Anthropic SDK client for `deepseek` with the resolved DeepSeek
  base URL, defaulting to `https://api.deepseek.com/anthropic` from the catalog.
  The installed Anthropic SDK option is `baseURL`.
- Build an OpenAI SDK client for optional OpenAI-backed capability validation
  and future image/web-search runtime consumers.
- Fail before SDK construction when a required key is missing.
- Never log or return raw secrets.

Suggested API shape:

```ts
ProviderClientFactory.createAnthropicCompatibleClient(config)
ProviderClientFactory.createOpenAiClient(key)
```

The concrete SDK classes may remain implementation details. Tests should mock
`@anthropic-ai/sdk` and `openai` constructors so no network call is needed to
prove option wiring.

## Validation Service Contract

`ProviderValidationService` owns external validation and normalized validation
results.

Required behavior:

- Validate the selected intelligence provider, model, key, and base URL.
- Accept an explicit validation input so routes can validate submitted values
  before those values are persisted.
- Use the selected model from request/resolved config. Never use a hard-coded
  deprecated validation model.
- Validate `anthropic` through the Anthropic Messages API shape.
- Validate `deepseek` through the Anthropic SDK transport with the DeepSeek base
  URL.
- Validate optional OpenAI key independently from chat readiness.
- Return structured results instead of throwing route-shaped errors.
- Normalize provider errors in one place.
- Preserve key-only and model-only admin update support at the service level.
- Avoid logging raw request bodies or secrets.

Suggested validation request/result shape:

```ts
interface IntelligenceProviderValidationInput {
  provider: "anthropic" | "deepseek";
  apiKey: string | null;
  model: string;
  baseUrl: string | null;
}

type ProviderValidationErrorCode =
  | "missing_key"
  | "invalid_key"
  | "invalid_model"
  | "provider_unreachable"
  | "unsupported_provider"
  | "unexpected_error";

interface ProviderValidationSuccess {
  ok: true;
  provider: "anthropic" | "deepseek" | "openai";
  model?: string;
  baseUrl?: string | null;
}

interface ProviderValidationFailure {
  ok: false;
  provider: "anthropic" | "deepseek" | "openai";
  model?: string;
  baseUrl?: string | null;
  code: ProviderValidationErrorCode;
  message: string;
  status?: number;
}
```

Routes may map these structured results into their existing JSON response
shape, but the service must not depend on `NextResponse`.

## Install/Admin Compatibility Contract

Phase 04 must improve internals while preserving the current external request
shape until Phase 05 updates the UI.

Current request compatibility:

- `/api/install/validate-keys` still accepts `{ anthropicKey, openAiKey }`.
- `/api/admin/system/keys` still accepts `{ anthropicKey, openAiKey }`.
- OpenAI remains optional.
- Admin updates still persist `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` exactly
  as before when those fields are supplied.

Internal behavior must change:

- Routes call `ProviderValidationService`, not SDK constructors directly.
- Routes build validation input by overlaying submitted request values onto
  resolved config. For the legacy Anthropic-only UI, that means:
  - `apiKey` comes from the submitted `anthropicKey`.
  - `model` comes from `ProviderConfigService.resolveAnthropicProviderConfig()`.
  - `baseUrl` comes from `ProviderConfigService.resolveAnthropicProviderConfig()`.
  - `provider` is `anthropic`.
- The validation service can already validate DeepSeek for Phase 05, even
  though the current UI does not submit DeepSeek fields yet.
- Duplicated route-local `extractApiErrorMessage` code is removed or replaced
  by the shared normalization helper.
- Production source no longer contains `claude-3-haiku-20240307`.

Phase 05 will expand the route request shape to provider/model/base URL and
capability toggles. Do not block Phase 04 on UI work.

## Clean Architecture

Use these boundaries:

- Routes are controllers. They parse request input, call the validation service,
  persist settings, and map service results to HTTP.
- `ProviderValidationService` is the application service/facade. It owns
  validation flow and result normalization.
- `ProviderClientFactory` is the factory. It owns SDK construction details and
  DeepSeek base URL wiring.
- `ProviderConfigService` remains the configuration resolver. It does not make
  external API calls.
- SDK clients are infrastructure dependencies injected or constructed through
  the factory only.

Design patterns that fit the current codebase:

- Factory Method / Abstract Factory for provider clients.
- Strategy for intelligence-provider validation, because Anthropic and DeepSeek
  share transport but differ by catalog config.
- Adapter for SDK error normalization.
- Facade for route-level validation use.

Avoid over-abstraction:

- Do not introduce a generic provider runtime replacement in Phase 04.
- Do not rewrite `ProviderRuntime`.
- Do not create a provider-specific tool pruning service here.
- Do not convert OpenAI speech raw fetch paths here unless needed for validation.

## Prune Targets

Remove or centralize during Phase 04:

- Route-local `extractApiErrorMessage` duplication in install/admin key routes.
- Direct SDK imports from install/admin validation routes.
- Hard-coded `claude-3-haiku-20240307` in production source.
- Any new route-local validation model constants.

Leave for later phases:

- Runtime `new Anthropic(...)` in chat/blog/summarization call sites: Phase 06.
- Runtime `new OpenAI(...)` in image/web-search call sites: Phase 07 unless
  touched by Phase 06 integration.
- Raw OpenAI speech `fetch` paths: Phase 07 capability guards and a later
  provider-specific audio transport cleanup.

## Implementation Steps

1. Add provider validation result types and shared error normalization.
2. Add `ProviderClientFactory` with Anthropic-compatible and OpenAI factory
   methods.
3. Add `ProviderValidationService` with intelligence and optional OpenAI
   validation methods.
4. Add focused unit tests for factory option wiring, missing-key handling,
   selected-model validation, DeepSeek base URL wiring, and structured errors.
5. Replace `/api/install/validate-keys` internals with the shared validation
   service while keeping the current request/response shape.
6. Replace `/api/admin/system/keys` internals with the shared validation service
   while keeping current persistence behavior.
7. Add source cleanup checks proving no production source contains
   `claude-3-haiku-20240307`.
8. Run focused provider, route, config, typecheck, and lint validation.

## Tests

Add or update focused tests for:

- `src/lib/ai/providers/provider-client-factory.test.ts`
  - Anthropic client receives the selected key.
  - DeepSeek client receives the selected key and base URL.
  - OpenAI client receives the optional OpenAI key.
  - Missing required key fails before SDK construction.
- `src/lib/ai/providers/provider-validation-service.test.ts`
  - Submitted API key values are validated before persistence.
  - Anthropic validation uses the selected model.
  - DeepSeek validation uses the selected model and DeepSeek base URL.
  - Missing key returns `missing_key` without an SDK call.
  - Invalid key/model/provider errors return structured failures.
  - OpenAI validation is optional and independent.
- Install/admin route tests or source cleanup tests proving:
  - route-local SDK construction is gone from validation routes.
  - duplicated route-local API error extraction is gone.
  - submitted keys are passed to the validation service instead of ignored in
    favor of persisted config.
  - current legacy request shapes still work.
  - no production source contains `claude-3-haiku-20240307`.

Validation command set:

```bash
npm run test -- src/lib/ai/providers/provider-client-factory.test.ts src/lib/ai/providers/provider-validation-service.test.ts tests/env-config.test.ts tests/env-centralization.test.ts
npm run typecheck
npx eslint src/lib/ai/providers/provider-client-factory.ts src/lib/ai/providers/provider-validation-service.ts src/app/api/install/validate-keys/route.ts src/app/api/admin/system/keys/route.ts
rg -n "claude-3-haiku-20240307" src --glob '!*.map'
```

The final `rg` command must return no production source matches.

## Done

- [x] Provider client factory builds Anthropic and DeepSeek Anthropic-compatible
      clients with correct key/base URL wiring.
- [x] Provider client factory builds OpenAI client for optional capability
      validation.
- [x] Shared validation service validates the selected provider/model and
      returns structured results.
- [x] Install/admin validation overlays submitted keys onto resolved
      model/base URL before persistence.
- [x] Install validation uses the shared service and selected Anthropic model
      while preserving the current request shape.
- [x] Admin validation uses the shared service and selected Anthropic model
      while preserving current key persistence behavior.
- [x] DeepSeek validation path uses DeepSeek model candidates and base URL.
- [x] OpenAI validation is optional and independent of chat readiness.
- [x] Duplicated install/admin API error extraction is removed or centralized.
- [x] No production source contains `claude-3-haiku-20240307`.

## Implementation Evidence

Added:

- `src/lib/ai/providers/provider-client-factory.ts`
- `src/lib/ai/providers/provider-validation-service.ts`
- `src/lib/ai/providers/provider-client-factory.test.ts`
- `src/lib/ai/providers/provider-validation-service.test.ts`
- `src/app/api/install/validate-keys/route.test.ts`
- `src/app/api/admin/system/keys/route.test.ts`

Updated:

- `src/app/api/install/validate-keys/route.ts`
- `src/app/api/admin/system/keys/route.ts`

Validation:

- `npm run test -- src/lib/ai/providers/provider-client-factory.test.ts src/lib/ai/providers/provider-validation-service.test.ts src/app/api/install/validate-keys/route.test.ts src/app/api/admin/system/keys/route.test.ts tests/env-config.test.ts tests/env-centralization.test.ts`
- `npm run test -- src/lib/ai/providers/provider-catalog.test.ts src/lib/ai/providers/provider-config-service.test.ts src/lib/ai/providers/provider-redaction.test.ts src/lib/ai/providers/provider-client-factory.test.ts src/lib/ai/providers/provider-validation-service.test.ts src/app/api/install/validate-keys/route.test.ts src/app/api/admin/system/keys/route.test.ts tests/env-config.test.ts tests/env-centralization.test.ts tests/chat/chat-policy.test.ts src/lib/config/ConfigurationService.test.ts tests/health-probes.test.ts tests/admin-processes.test.ts`
- `npm run typecheck`
- `npm run lint` (passes with existing repo warnings, 0 errors)
- `npx eslint src/lib/ai/providers/provider-client-factory.ts src/lib/ai/providers/provider-validation-service.ts src/lib/ai/providers/provider-client-factory.test.ts src/lib/ai/providers/provider-validation-service.test.ts src/app/api/install/validate-keys/route.ts src/app/api/install/validate-keys/route.test.ts src/app/api/admin/system/keys/route.ts src/app/api/admin/system/keys/route.test.ts`
- `rg -n "claude-3-haiku-20240307" src --glob '!*.map'`
- `rg -n "extractApiErrorMessage|new Anthropic|new OpenAI|models\\.list" src/app/api/install/validate-keys/route.ts src/app/api/admin/system/keys/route.ts`
