# Provider Capability Configuration Validation Checklist

## Phase 05 Evidence

The Phase 05 install/admin provider UI slice closed on 2026-05-02 with these
focused checks:

```bash
npm run test -- src/lib/config/ConfigurationService.test.ts src/lib/ai/providers/provider-settings-service.test.ts src/app/api/install/validate-keys/route.test.ts src/app/api/install/setup/route.test.ts src/app/api/admin/system/keys/route.test.ts src/app/admin/system/keys/KeysManager.test.tsx src/app/install/InstallWizard.test.tsx
```

Result: 7 files passed, 38 tests passed.

```bash
npm run typecheck
```

Result: passed.

```bash
npx eslint src/lib/ai/providers/provider-settings-service.ts src/lib/ai/providers/provider-settings-service.test.ts src/lib/config/ConfigurationService.ts src/lib/config/ConfigurationService.test.ts src/app/api/install/validate-keys/route.ts src/app/api/install/validate-keys/route.test.ts src/app/api/install/setup/route.ts src/app/api/install/setup/route.test.ts src/app/api/admin/system/keys/route.ts src/app/api/admin/system/keys/route.test.ts src/app/admin/system/keys/page.tsx src/app/admin/system/keys/KeysManager.tsx src/app/admin/system/keys/KeysManager.test.tsx src/app/install/InstallWizard.tsx src/app/install/InstallWizard.test.tsx
```

Result: passed.

```bash
rg -n "process\\.env\\.(ANTHROPIC|OPENAI|DEEPSEEK|AI_PROVIDER|IMAGE_PROVIDER|TTS_PROVIDER|STT_PROVIDER|WEB_SEARCH_PROVIDER)" src/app/admin/system/keys src/app/install src/app/api/install src/app/api/admin/system/keys
```

Result: no matches.

## Phase 06 Closeout Evidence

Phase 06 was implemented and QA'd against the runtime code on 2026-05-02. The
implementation spec is:

- [phases/06-runtime-integration-and-env-helper-pruning.md](phases/06-runtime-integration-and-env-helper-pruning.md)

Runtime drift closed:

- chat stream resolves the selected intelligence provider through the provider
  runtime.
- direct chat uses provider client factory construction.
- provider policy resolves provider-specific model candidates.
- conversation summarization uses the selected intelligence provider.
- blog article production uses the selected intelligence provider for article
  text generation.
- health readiness and admin process diagnostics report selected-provider
  readiness instead of Anthropic-only state.

## Edge Parity Evidence

The post-phase QA cleanup closed remaining edge paths on 2026-05-02:

- `mcp/admin-web-search-server.ts` delegates dependency construction to
  `createAdminWebSearchDeps`.
- `src/lib/capabilities/shared/web-search-tool.ts` no longer reads OpenAI env
  settings or owns provider key preflight.
- `src/app/api/e2e/media/generated-image/route.ts` gates generated-image
  execution through `assertProviderBackedToolAvailable("generate_blog_image")`
  before constructing an OpenAI image provider.

Regression coverage:

- `tests/provider-capability-edge-parity.test.ts`

## Unit Tests

- Tool default profile classifies core, default optional, provider-gated
  optional, and business-feature optional tools.
- Protected tool list includes `inspect_runtime_context`,
  `inspect_runtime_logs`, `inspect_theme`, `set_theme`, `adjust_ui`, and
  `configure_tool_availability` when introduced.
- Static `config/tools.json` overrides are applied before SQLite admin runtime
  overrides.
- SQLite runtime tool overrides are applied before provider capability
  availability.
- Effective tool availability reports stable reason codes.
- Provider catalog returns separate Anthropic and DeepSeek defaults.
- DeepSeek model candidates never include Claude model names.
- Env values override SQLite settings.
- SQLite values are used when env values are absent.
- Empty env values are treated as absent.
- Alias keys such as `API__ANTHROPIC_API_KEY` and `API__OPENAI_API_KEY` still
  resolve during migration.
- Provider config reports source for provider, key, model, and base URL.
- Redaction hides secrets but preserves configured/missing status.
- Provider settings DTOs report env-sourced fields as operator locked.
- Provider settings persistence writes selected provider, selected model, base
  URL, OpenAI key when supplied, and capability provider/model settings.
- DeepSeek selected provider counts as initialized when `DEEPSEEK_API_KEY` is
  configured.

## Validation Service Tests

- Provider client factory builds Anthropic clients without route-local SDK
  construction.
- Provider client factory builds DeepSeek clients with the resolved DeepSeek
  base URL.
- Provider client factory builds OpenAI clients for optional capability
  validation.
- Missing required provider key fails before SDK construction.
- Anthropic validation uses the selected model.
- DeepSeek validation uses the DeepSeek base URL and selected DeepSeek model.
- Invalid API key returns a structured provider error.
- Invalid model returns a structured model error.
- OpenAI key validation is optional and independent of chat readiness.
- Model-only admin update does not require key rotation.
- Key-only admin update preserves current model.

## Install Route Tests

- Legacy `{ anthropicKey, openAiKey }` validation request shape is preserved
  until the install UI phase expands it.
- Fresh install accepts provider, key, model, base URL, optional OpenAI key, and
  capability toggles.
- Fresh install persists provider settings to SQLite.
- Fresh install revalidates provider settings during setup before persistence.
- Fresh install can select DeepSeek without requiring Anthropic.
- Install rejects missing primary intelligence key.
- Install can complete without OpenAI key.
- Install rejects OpenAI-backed capability selections without an OpenAI key.
- Install cannot run after system initialization.

## Admin Route Tests

- Legacy `{ anthropicKey, openAiKey }` key update request shape is preserved
  until the admin UI phase expands it.
- Admin provider settings GET returns redacted effective provider config.
- Admin can list effective tool availability grouped by bundle.
- Admin can enable/disable a toggleable tool.
- Admin can enable/disable a toggleable bundle.
- Admin cannot disable protected recovery tools through normal controls.
- Admin can update provider/model/base URL.
- Admin can rotate key without changing model.
- Admin can switch intelligence provider.
- Admin can enable/disable image, TTS, STT, and web search.
- Admin can set STT to `local_whisper` without OpenAI.
- Admin cannot unknowingly override env-sourced provider fields.
- Non-admin cannot update provider settings.
- Admin status reports effective provider config from SQLite when env is absent.

## Runtime Tests

- Selected intelligence runtime factory builds Anthropic and DeepSeek runtimes.
- Selected intelligence runtime factory uses `ProviderClientFactory` for
  Anthropic-compatible client construction.
- Selected intelligence runtime factory rejects missing selected provider keys
  with a stable error.
- Provider policy resolves selected-provider timeout, retry attempts, retry
  delay, and model candidates.
- DeepSeek provider policy contains no Claude model names.
- Runtime tool registry excludes tools disabled by admin runtime settings.
- Runtime tool registry excludes tools disabled by static config.
- Runtime tool registry keeps protected tools available.
- Role directive prompt hints do not mention tools absent from the effective
  runtime manifest.
- `inspect_runtime_context` reports the effective manifest, not the static full
  catalog.
- Chat stream resolves key/model from SQLite when env is absent.
- Direct chat resolves key/model from SQLite when env is absent.
- Summarization uses the selected intelligence provider model.
- Blog article production uses the selected intelligence provider model.
- Health readiness uses the selected intelligence provider instead of
  Anthropic helper wrappers.
- Admin process diagnostics report selected intelligence provider/model
  metadata instead of `anthropicModel`.
- Provider fallback candidates are provider-specific.
- Provider events include selected provider, selected model, and surface.

## Capability Availability Tests

- Provider-backed capability availability feeds the general tool availability
  service instead of bypassing it.
- With no OpenAI key, `generate_audio` is not registered.
- With no OpenAI key, `generate_blog_image` is not registered.
- With no OpenAI key, `admin_web_search` is not registered.
- With OpenAI key but `TTS_PROVIDER=disabled`, `generate_audio` is not
  registered.
- With OpenAI key but `IMAGE_PROVIDER=disabled`, `generate_blog_image` is not
  registered.
- With OpenAI key but `WEB_SEARCH_PROVIDER=disabled`, `admin_web_search` is not
  registered.
- Existing audio/image assets remain discoverable through
  `list_conversation_media_assets` after generation is disabled.

## Route And Worker Guard Tests

- `configure_tool_availability` is admin-only.
- `configure_tool_availability` cannot disable protected tools through normal
  requests.
- `/api/tts` returns a clear disabled/missing-provider response when TTS is
  disabled or missing config.
- `/api/chat/jobs` cannot enqueue `generate_audio` when TTS is disabled or
  missing config.
- Catalog runtime binding cannot enqueue `generate_audio` when TTS is disabled
  or missing config.
- `generate_audio` deferred job handler fails with a stable reason when TTS is
  disabled.
- `/api/web-search` returns a clear disabled/missing-provider response when web
  search is disabled.
- MCP sidecars report missing provider config clearly.

## Source Cleanup Checks

- No production source contains `claude-3-haiku-20240307`.
- Install/admin key validation routes do not import provider SDKs directly.
- Install/admin provider UI and provider routes do not read raw provider env
  values.
- No provider runtime caller reads raw `process.env.ANTHROPIC_MODEL`.
- Runtime intelligence surfaces do not import `getAnthropicApiKey`.
- Runtime intelligence surfaces do not import `getAnthropicModel`.
- Health/admin intelligence diagnostics do not import `getAnthropicApiKey` or
  `getAnthropicModel`.
- Provider policy does not import `getModelFallbacks`.
- Direct selected-provider SDK construction is centralized in
  `ProviderClientFactory`.
- Tool registry composition no longer relies only on static `config/tools.json`.
- Role directive assembly does not project prompt hints from disabled tools.
- Admin system page does not use raw env as the provider truth.
- Duplicated install/admin API error extraction is removed or centralized.
