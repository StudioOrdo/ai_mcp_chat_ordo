# Phase 03 - Provider Config Resolver And Catalog

Status: complete as of 2026-05-02.

## Goal

Create one source of effective provider truth without rewiring runtime provider
call sites yet.

Phase 03 must add the provider catalog, provider config types, resolver, source
reporting, redaction helpers, and backward-compatible env helper wrappers. It
must not validate provider keys against external APIs and must not construct SDK
clients. Those responsibilities belong to Phase 04.

## Current-Code Grounding

The existing system already has a useful storage primitive:

- `src/lib/config/ConfigurationService.ts`

`ConfigurationService.getString(key)` resolves non-empty `process.env[key]`
first, then SQLite `system_settings`, then `null`. This is the correct storage
primitive and must be retained.

The current drift is that provider helpers bypass that primitive:

- `src/lib/config/env.ts`
  - `getAnthropicApiKey()` reads only `ANTHROPIC_API_KEY` and
    `API__ANTHROPIC_API_KEY`.
  - `getOpenaiApiKey()` reads only `OPENAI_API_KEY` and `API__OPENAI_API_KEY`.
  - `getAnthropicModel()` reads only `ANTHROPIC_MODEL`.
  - `getModelFallbacks()` hard-codes Claude fallback candidates.
  - timeout/retry helpers read only raw env.
- `src/lib/config/env-config.ts`
  - validates a narrow env schema and currently knows Anthropic/OpenAI only.
- `ConfigurationService.isSystemInitialized()` checks only
  `ANTHROPIC_API_KEY`.

Phase 03 must introduce the resolver behind these surfaces. Later phases will
move runtime code off legacy helpers.

## Target Modules

Add these files:

- `src/lib/ai/providers/types.ts`
- `src/lib/ai/providers/provider-catalog.ts`
- `src/lib/ai/providers/provider-config-service.ts`
- `src/lib/ai/providers/provider-redaction.ts`

Defer these files to later phases:

- `src/lib/ai/providers/provider-client-factory.ts` belongs to Phase 04.
- `src/lib/ai/providers/provider-validation-service.ts` belongs to Phase 04.
- `src/lib/ai/providers/capability-availability-service.ts` belongs to Phase
  07.

## Provider Catalog Contract

### Intelligence Providers

Initial provider IDs:

- `anthropic`
- `deepseek`

Both use Anthropic Messages-compatible request semantics, but they must have
separate defaults, env keys, base URL keys, and fallback candidates.

Required catalog fields:

| Field | Anthropic | DeepSeek |
| --- | --- | --- |
| Provider ID | `anthropic` | `deepseek` |
| Display label | `Anthropic` | `DeepSeek` |
| API key setting | `ANTHROPIC_API_KEY` | `DEEPSEEK_API_KEY` |
| API key aliases | `API__ANTHROPIC_API_KEY` | none initially |
| Model setting | `ANTHROPIC_MODEL` | `DEEPSEEK_MODEL` |
| Base URL setting | `ANTHROPIC_BASE_URL` | `DEEPSEEK_BASE_URL` |
| Base URL default | SDK default / `null` | `https://api.deepseek.com/anthropic` |
| Default model | existing Anthropic default | `deepseek-v4-flash` |
| Model candidates | Claude-only list | DeepSeek-only list |
| Timeout setting | `ANTHROPIC_REQUEST_TIMEOUT_MS` | `DEEPSEEK_REQUEST_TIMEOUT_MS` |
| Retry attempts setting | `ANTHROPIC_RETRY_ATTEMPTS` | `DEEPSEEK_RETRY_ATTEMPTS` |
| Retry delay setting | `ANTHROPIC_RETRY_DELAY_MS` | `DEEPSEEK_RETRY_DELAY_MS` |

The existing Anthropic defaults must remain backward-compatible for Phase 03:

- default model: `claude-haiku-4-5`
- fallback candidates: `claude-haiku-4-5`, `claude-sonnet-4-6`,
  `claude-opus-4-6`
- timeout: `45000`
- retry attempts: `3`
- retry delay: `150`

DeepSeek defaults must not include Claude model names. Initial DeepSeek
candidates:

- `deepseek-v4-flash`
- `deepseek-v4-pro`

DeepSeek's official Anthropic API documentation lists
`https://api.deepseek.com/anthropic` as the Anthropic-compatible base URL and
shows `deepseek-v4-pro` in the Anthropic SDK example. The official models page
lists `deepseek-v4-flash` and `deepseek-v4-pro`, and notes that older
`deepseek-chat` and `deepseek-reasoner` model names are future-deprecated
compatibility aliases. Use `deepseek-v4-flash` as the conservative default and
keep all model names in the catalog as constants so they can be changed without
hunting runtime code.

### Capability Provider Slots

Initial capability slots:

- `image`
- `tts`
- `stt`
- `web_search`

Initial provider values:

- Image: `disabled`, `openai`
- TTS: `disabled`, `openai`
- STT: `disabled`, `local_whisper`, `openai`
- Web search: `disabled`, `openai`

Required catalog fields and defaults:

| Capability | Provider setting | Model setting | Required key setting | Key aliases | Default provider | Default model |
| --- | --- | --- | --- | --- | --- | --- |
| Image | `IMAGE_PROVIDER` | `IMAGE_MODEL` | `OPENAI_API_KEY` when provider is `openai` | `API__OPENAI_API_KEY` | `openai` when key exists, otherwise `disabled` | `gpt-image-1` |
| TTS | `TTS_PROVIDER` | `TTS_MODEL` | `OPENAI_API_KEY` when provider is `openai` | `API__OPENAI_API_KEY` | `openai` when key exists, otherwise `disabled` | `tts-1` |
| STT | `STT_PROVIDER` | `STT_MODEL` | `OPENAI_API_KEY` when provider is `openai`; no key for `local_whisper` or `disabled` | `API__OPENAI_API_KEY` for `openai` | `disabled` | provider-specific later |
| Web search | `WEB_SEARCH_PROVIDER` | `WEB_SEARCH_MODEL` | `OPENAI_API_KEY` when provider is `openai` | `API__OPENAI_API_KEY` | `openai` when key exists, otherwise `disabled` | `gpt-5` |

Phase 03 only resolves these settings. It does not enforce tool availability;
that belongs to Phase 07.

Capability catalog entries must expose the required key metadata so Phase 07 can
derive provider-backed tool availability without re-encoding provider rules.

If a capability provider setting is absent, the resolver may choose an
auto-default such as `openai` when the required key exists or `disabled` when it
does not. If an admin/operator explicitly configures a capability provider such
as `TTS_PROVIDER=openai` and the key is missing, Phase 03 must preserve the
configured provider and report the key as missing. It must not silently rewrite
an explicit provider choice to `disabled`.

## Type Contract

Define explicit types instead of passing raw strings:

- `IntelligenceProviderId = "anthropic" | "deepseek"`
- `AnthropicCompatibleProviderId = IntelligenceProviderId`
- `CapabilitySlotId = "image" | "tts" | "stt" | "web_search"`
- `CapabilityProviderId = "disabled" | "openai" | "local_whisper"`
- `ProviderConfigSource = "env" | "sqlite" | "default" | "missing"`
- `ResolvedConfigField<T>`
- `ResolvedIntelligenceProviderConfig`
- `ResolvedCapabilityProviderConfig`
- `ResolvedProviderConfigSnapshot`
- `ProviderResolutionWarning`

Each resolved secret field must expose configured/missing status without
returning a secret in admin-facing snapshots.

## Resolver Contract

Add a `ProviderConfigService` facade with these responsibilities:

- Resolve selected intelligence provider from `AI_PROVIDER`, defaulting to
  `anthropic`.
- Resolve the selected provider key, model, base URL, model candidates, timeout,
  retry attempts, retry delay, and source for each field.
- Resolve optional capability provider slots independently from intelligence
  provider readiness.
- Treat empty env and empty SQLite strings as absent.
- Preserve env precedence over SQLite.
- Preserve alias support for `API__ANTHROPIC_API_KEY` and
  `API__OPENAI_API_KEY`.
- Preserve existing Anthropic helper behavior while adding SQLite fallback.
- Return warnings for unknown provider values and fall back to catalog defaults.
- Expose a redacted snapshot for admin/health pages.

Implementation shape:

- Preserve `ConfigurationService` as the storage primitive, but add a small
  source-aware read helper inside the provider config module because
  `ConfigurationService.getString()` intentionally returns only a value.
- For a field with aliases, resolve in source-order, not key-order:
  1. non-empty env primary key
  2. non-empty env aliases in catalog order
  3. non-empty SQLite primary key
  4. non-empty SQLite aliases in catalog order
  5. catalog default
- This preserves env precedence over SQLite while retaining primary-key
  preference within the same source.
- Do not add another storage backend.

## Source Reporting

Every resolved field must report:

- `key`
- `value`
- `source`
- optional `aliasOf`

Secret values must support two views:

- internal view: includes the actual value for runtime compatibility wrappers.
- redacted view: exposes `configured: boolean`, `source`, `key`, and optional
  `last4` or equivalent non-secret diagnostic marker.

Do not put raw provider keys into admin-facing DTOs.

## Backward-Compatible Helper Wrappers

Phase 03 should update `src/lib/config/env.ts` so legacy callers still compile
and behavior improves:

- `getAnthropicApiKey()`
  - use `ProviderConfigService` for Anthropic key resolution.
  - preserve error text compatibility enough that existing tests can be updated
    deliberately, not surprised by unrelated wording churn.
- `getOpenaiApiKey()`
  - use optional capability/OpenAI key resolution.
  - preserve `API__OPENAI_API_KEY` alias.
- `getAnthropicModel()`
  - use Anthropic catalog/model resolution.
- `getModelFallbacks()`
  - for default Anthropic behavior, preserve existing fallback order.
  - add a new provider-aware API for selected intelligence provider candidates.
- timeout/retry helpers
  - keep existing function names and defaults.
  - add provider-aware equivalents in `ProviderConfigService`.
- `validateRequiredRuntimeConfig()`
  - validate selected intelligence provider key presence through the resolver,
    but do not perform external API validation.

Do not update chat, blog, TTS, image, or web-search runtime callers in Phase 03
except through the compatibility wrappers above.

## `env-config.ts` Contract

Update the env schema so deployment-time validation knows the new optional
provider keys without requiring them:

- `AI_PROVIDER`
- `ANTHROPIC_BASE_URL`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_REQUEST_TIMEOUT_MS`
- `DEEPSEEK_RETRY_ATTEMPTS`
- `DEEPSEEK_RETRY_DELAY_MS`
- `IMAGE_PROVIDER`
- `IMAGE_MODEL`
- `TTS_PROVIDER`
- `TTS_MODEL`
- `STT_PROVIDER`
- `STT_MODEL`
- `STT_BASE_URL`
- `WEB_SEARCH_PROVIDER`
- `WEB_SEARCH_MODEL`
- alias keys that are still supported during migration

The schema should reject malformed enum values only if that does not break
current deployment boot. If strict enum validation risks blocking existing
installs, keep env schema permissive and let `ProviderConfigService` warn and
fallback.

## Initialization Boundary

`ConfigurationService.isSystemInitialized()` currently checks only
`ANTHROPIC_API_KEY`.

Phase 03 may add a provider-aware initialization helper, but should be careful
about changing install redirects before Phase 05 updates the installer. The
safe path is:

- Keep existing `isSystemInitialized()` behavior for current install flow.
- Add `isProviderConfigured()` or equivalent on `ProviderConfigService`.
- Document that Phase 05 will switch install/admin flow to selected provider
  readiness.

## GOF, SOLID, And Clean Architecture

Use these patterns deliberately:

- Facade: `ProviderConfigService` is the single API for effective provider
  truth.
- Catalog/Registry: `provider-catalog.ts` owns supported provider IDs, defaults,
  settings keys, labels, and fallback candidates.
- Chain of Responsibility: source-aware resolver checks env primary/aliases,
  SQLite primary/aliases, then catalog default.
- Strategy-ready shape: catalog entries and resolved config should be shaped so
  Phase 04 can add provider-specific validation/client strategies without
  rewriting Phase 03.
- Value Objects: explicit provider IDs, capability slots, sources, resolved
  fields, and redacted secrets.

SOLID constraints:

- `ConfigurationService` remains a storage primitive; it does not know provider
  semantics.
- `ProviderConfigService` resolves config only; it does not call provider APIs
  and does not construct clients.
- `provider-catalog.ts` owns defaults; runtime helpers should not duplicate
  model names or provider setting keys.
- Capability config resolution stays independent from intelligence provider
  resolution.
- Future providers require adding catalog/strategy entries, not editing every
  caller.

## Prune And Simplify Targets

Phase 03 should remove or reduce:

- Raw provider default duplication in `src/lib/config/env.ts`.
- Env-only behavior in legacy provider helper functions.
- Untracked provider/model keys in `src/lib/config/env-config.ts`.

Phase 03 should not remove yet:

- Runtime imports of `getAnthropicApiKey`, `getOpenaiApiKey`,
  `getAnthropicModel`, or `getModelFallbacks`.
- SDK constructors in runtime roots.
- Hard-coded validation model `claude-3-haiku-20240307`; Phase 04 owns that.
- Admin/install key-only UI; Phase 05 owns that.
- Provider capability gating in `ToolAvailabilityService`; Phase 07 owns the
  replacement.

## Test Plan

Add focused tests for the new provider modules:

- Catalog contains Anthropic and DeepSeek intelligence providers.
- Catalog contains image, TTS, STT, and web-search capability slots.
- Anthropic defaults preserve existing model/fallback behavior.
- DeepSeek model candidates never include Claude model names.
- `AI_PROVIDER` defaults to `anthropic`.
- Env `AI_PROVIDER=deepseek` selects DeepSeek.
- Unknown `AI_PROVIDER` returns a warning and falls back to `anthropic`.
- Env values override SQLite values.
- Env aliases override SQLite primary-key values.
- SQLite values are used when env values are absent.
- Empty env values and empty SQLite values are treated as absent.
- `API__ANTHROPIC_API_KEY` and `API__OPENAI_API_KEY` aliases still resolve.
- OpenAI capability key resolves independently from intelligence provider key.
- Absent capability provider settings default to `disabled` when the required
  key is missing.
- Explicit capability provider settings are preserved even when their required
  key is missing.
- Redacted snapshots never contain raw API keys.
- Legacy wrappers preserve current Anthropic defaults and gain SQLite fallback.
- `env-config.ts` accepts new optional provider settings.
- DeepSeek catalog defaults are `https://api.deepseek.com/anthropic`,
  `deepseek-v4-flash`, and `deepseek-v4-pro`.

Recommended test files:

- `src/lib/ai/providers/provider-catalog.test.ts`
- `src/lib/ai/providers/provider-config-service.test.ts`
- `src/lib/ai/providers/provider-redaction.test.ts`
- update `tests/env-config.test.ts`
- update `tests/env-centralization.test.ts`

## Implementation Sequence

1. Add provider types.
2. Add provider catalog with defaults and setting-key metadata.
3. Add source-aware config field resolver.
4. Add `ProviderConfigService`.
5. Add redaction helpers.
6. Update `env-config.ts` optional schema fields.
7. Convert `env.ts` legacy provider helpers to call the resolver.
8. Add and update tests.
9. Run focused typecheck/test/lint for touched files.

## Acceptance Criteria

- [x] Anthropic config resolves from env or SQLite.
- [x] DeepSeek config resolves from env or SQLite.
- [x] OpenAI optional capability config resolves independently.
- [x] Capability provider slots resolve with source reporting.
- [x] Model candidates are provider-specific.
- [x] Empty env and SQLite values are treated as absent.
- [x] Alias keys remain supported.
- [x] Redacted snapshots do not expose secrets.
- [x] Legacy env helper wrappers still satisfy current runtime callers.
- [x] Phase 04 responsibilities are not implemented in Phase 03.

## Implementation Evidence

Added:

- `src/lib/ai/providers/types.ts`
- `src/lib/ai/providers/provider-catalog.ts`
- `src/lib/ai/providers/provider-config-service.ts`
- `src/lib/ai/providers/provider-redaction.ts`
- `src/lib/ai/providers/provider-catalog.test.ts`
- `src/lib/ai/providers/provider-config-service.test.ts`
- `src/lib/ai/providers/provider-redaction.test.ts`

Updated:

- `src/lib/config/env.ts`
- `src/lib/config/env-config.ts`
- `tests/env-config.test.ts`
- `tests/env-centralization.test.ts`

Validation:

- `npm run test -- src/lib/ai/providers/provider-catalog.test.ts src/lib/ai/providers/provider-config-service.test.ts src/lib/ai/providers/provider-redaction.test.ts tests/env-config.test.ts tests/env-centralization.test.ts tests/chat/chat-policy.test.ts`
- `npm run test -- src/lib/ai/providers/provider-catalog.test.ts src/lib/ai/providers/provider-config-service.test.ts src/lib/ai/providers/provider-redaction.test.ts tests/env-config.test.ts tests/env-centralization.test.ts tests/chat/chat-policy.test.ts src/lib/config/ConfigurationService.test.ts tests/health-probes.test.ts tests/admin-processes.test.ts`
- `npm run typecheck`
- `npx eslint src/lib/ai/providers/types.ts src/lib/ai/providers/provider-catalog.ts src/lib/ai/providers/provider-config-service.ts src/lib/ai/providers/provider-redaction.ts src/lib/ai/providers/provider-catalog.test.ts src/lib/ai/providers/provider-config-service.test.ts src/lib/ai/providers/provider-redaction.test.ts src/lib/config/env.ts src/lib/config/env-config.ts tests/env-config.test.ts tests/env-centralization.test.ts`

## External Source Evidence

- DeepSeek Anthropic API docs
  (`https://api-docs.deepseek.com/guides/anthropic_api`):
  Anthropic-compatible base URL is
  `https://api.deepseek.com/anthropic`, and the example model is
  `deepseek-v4-pro`.
- DeepSeek Models & Pricing docs
  (`https://api-docs.deepseek.com/quick_start/pricing`): current API model names include
  `deepseek-v4-flash` and `deepseek-v4-pro`; `deepseek-chat` and
  `deepseek-reasoner` are compatibility aliases marked for future deprecation.
