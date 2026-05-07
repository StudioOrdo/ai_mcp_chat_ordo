# Provider Capability Configuration Contract Spec

## Purpose

Make tool and provider configuration governed product surfaces instead of
scattered env lookups and static file switches. The system must support a
self-contained install where provider choices and runtime tool settings are
persisted in SQLite, overridden by env/static files when intentionally supplied,
visible in admin health, and used consistently by runtime chat, prompt hints,
and optional capability tools.

## Product Contract

### Intelligence Provider

The intelligence provider powers:

- chat stream
- direct chat
- summarization
- article generation/review
- model-backed planning surfaces that use the Anthropic Messages shape

Initial supported values:

- `anthropic`
- `deepseek`

Anthropic and DeepSeek both use Anthropic-compatible Messages transport, but
they must have separate model defaults and fallback candidates.

### Capability Providers

Capability providers power optional tools:

| Capability | Initial providers | Required key | Tool/API surfaces |
| --- | --- | --- | --- |
| Image generation | `disabled`, `openai` | `OPENAI_API_KEY` | `generate_blog_image`, E2E generated-image harness |
| Text-to-speech | `disabled`, `openai` | `OPENAI_API_KEY` | `generate_audio`, `/api/tts`, `/api/chat/jobs`, deferred worker, audio MCP sidecar |
| Speech-to-text | `disabled`, `local_whisper`, `openai` | provider-specific | future `transcribe_audio`, future `/api/stt` |
| Web search | `disabled`, `openai` | `OPENAI_API_KEY` | `admin_web_search`, `/api/web-search`, web-search MCP sidecar |

OpenAI is optional. Missing OpenAI config must not prevent core chat readiness
when the intelligence provider is valid.

### Runtime Tool Control Plane

Tool availability is broader than provider availability. The effective tool
manifest must combine:

1. Capability catalog declaration.
2. Protected system guard.
3. Install profile defaults.
4. Static operator override from `config/tools.json`.
5. SQLite-backed admin runtime override.
6. Provider/capability availability.
7. Role permission filtering.
8. Request/lane-scoped filtering.

Provider availability is only one policy layer. It should not own the full tool
toggle system.

Protected tools:

- `inspect_runtime_context`
- `inspect_runtime_logs`
- `inspect_theme`
- `set_theme`
- `adjust_ui`
- future `configure_tool_availability`

These must remain available through normal admin controls so the site keeps a
local provider-free inspection and recovery path.

## Configuration Contract

Resolution order:

1. Environment variable, when non-empty.
2. SQLite `system_settings`.
3. Provider catalog default, only for non-secret defaults.

Required keys:

```text
AI_PROVIDER
ANTHROPIC_API_KEY
ANTHROPIC_MODEL
ANTHROPIC_BASE_URL
DEEPSEEK_API_KEY
DEEPSEEK_MODEL
DEEPSEEK_BASE_URL
OPENAI_API_KEY
IMAGE_PROVIDER
IMAGE_MODEL
TTS_PROVIDER
TTS_MODEL
STT_PROVIDER
STT_MODEL
STT_BASE_URL
WEB_SEARCH_PROVIDER
WEB_SEARCH_MODEL
TOOL_PROFILE
TOOL_OVERRIDES
```

Backward compatibility:

- `AI_PROVIDER` defaults to `anthropic`.
- Existing `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, and `OPENAI_API_KEY` env
  behavior continues to work.
- Existing `API__ANTHROPIC_API_KEY` and `API__OPENAI_API_KEY` aliases remain
  supported until all callers migrate.

## Proposed Modules

```text
src/lib/ai/providers/types.ts
src/lib/ai/providers/provider-catalog.ts
src/lib/ai/providers/provider-config-service.ts
src/lib/ai/providers/provider-client-factory.ts
src/lib/ai/providers/provider-validation-service.ts
src/lib/ai/providers/capability-availability-service.ts
src/lib/ai/providers/provider-redaction.ts
src/lib/tools/tool-policy-types.ts
src/lib/tools/tool-default-profile.ts
src/lib/tools/tool-availability-service.ts
src/lib/tools/tool-settings-service.ts
src/core/use-cases/tools/configure-tool-availability.tool.ts
```

### ToolAvailabilityService

Responsibilities:

- Resolve effective availability for every catalog tool.
- Apply static `config/tools.json` and SQLite runtime overrides.
- Apply provider capability availability without owning provider resolution.
- Report stable reason codes for disabled/unavailable tools.
- Provide pruning inputs for registry composition and prompt-hint assembly.

Non-responsibilities:

- It does not validate provider keys.
- It does not execute tools.
- It does not replace role checks or request-scoped filtering.

### ProviderConfigService

Responsibilities:

- Resolve effective intelligence provider config.
- Resolve effective optional capability provider config.
- Report config source for each field.
- Redact secrets for admin display.
- Expose backward-compatible helper values while legacy call sites migrate.

Non-responsibilities:

- It does not call external provider APIs.
- It does not register tools.
- It does not own retry/fallback execution.

### ProviderClientFactory

Responsibilities:

- Build Anthropic SDK client for Anthropic.
- Build Anthropic SDK client with DeepSeek base URL for DeepSeek.
- Build OpenAI client for optional capability providers.

Non-responsibilities:

- It does not validate admin input.
- It does not choose tools.

### ProviderValidationService

Responsibilities:

- Validate selected intelligence provider/model/key/baseURL.
- Validate optional OpenAI key.
- Validate capability provider selections.
- Return structured success/error payloads for install/admin.

Validation must use the selected model, not a hard-coded deprecated model.

### CapabilityAvailabilityService

Responsibilities:

- Report capability availability by tool/API surface.
- Explain unavailable capabilities with stable reason codes.
- Provide provider-backed availability inputs to `ToolAvailabilityService`.
- Provide admin health summaries.

Example output:

```ts
{
  generate_audio: { available: false, reason: "tts_provider_disabled" },
  generate_blog_image: { available: false, reason: "missing_openai_key" },
  admin_web_search: { available: true, provider: "openai", model: "gpt-5" },
  transcribe_audio: { available: false, reason: "stt_provider_disabled" }
}
```

## Runtime Contract

- `resolveProviderPolicy()` must consume `ProviderConfigService`, not env-only
  helpers.
- Chat stream and direct chat must receive a provider client/config from the
  provider factory or equivalent resolved config.
- Summarization and article production must use the selected intelligence
  provider when the provider is Anthropic-compatible.
- Optional OpenAI capability routes must guard direct execution with explicit
  `FEATURE_DISABLED`, `MISSING_PROVIDER_KEY`, or `PROVIDER_VALIDATION_FAILED`
  responses.
- Deferred job enqueue and worker paths for provider-backed tools must guard
  execution with the same provider/capability state as direct routes.
- Tool registry composition must consume `ToolAvailabilityService` before
  prompt/tool manifests are built.
- Role directive and prompt-hint assembly must consume the same effective tool
  policy as the registry.
- Admin runtime tool changes must invalidate cached registry/prompt projections
  or use a versioned effective policy.

## UI Contract

Install provider step:

- Intelligence provider select.
- API key input.
- Model select plus manual model input.
- Advanced base URL field.
- Optional OpenAI key section clearly labeled "optional capabilities".
- Capability toggles may default to disabled until a key is present.

Admin provider settings:

- Show effective provider, model, base URL, key configured status, and source.
- Update provider/model/base URL without rotating the key.
- Rotate key without changing model.
- Enable/disable image, TTS, STT, and web search independently.
- Show unavailable capability reasons.

Admin tool settings:

- Show every tool grouped by bundle/extension pack.
- Show role access, provider dependency, effective state, and reason.
- Allow admins to enable/disable toggleable tools and bundles.
- Prevent disabling protected recovery/basic tools through normal admin
  controls.
- Show static file overrides as operator-locked when present.

Conversational admin control:

- `configure_tool_availability` lets admins enable/disable toggleable tools or
  bundles and ask why a tool is unavailable.
- The tool must be admin-only and protected from normal disablement.

## Prune Contract

Remove or replace:

- hard-coded `claude-3-haiku-20240307`
- duplicated install/admin provider validation logic
- runtime provider reads that bypass `ConfigurationService`
- admin provider display that reads raw `process.env`
- OpenAI-backed tools being offered when unavailable
- static-only tool configuration as the only tool control surface
- prompt hints for tools absent from the effective runtime manifest

Retain:

- `ConfigurationService`
- `ProviderRuntime`
- capability catalog metadata
- static `config/tools.json` as an operator override layer
- direct route/job guardrails
- theme tools as the default provider-free proof that tools work
