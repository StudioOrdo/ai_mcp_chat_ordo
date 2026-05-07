# Phase 07 - Provider Capability Availability And Tool Pruning

Status: implemented and QA-verified as of 2026-05-02.

## QA Certification

QA status: implementation verified as of 2026-05-02.

Code-grounded checks performed:

- Verified current key-only gating in
  `src/lib/tools/tool-availability-service.ts`,
  `src/lib/tools/tool-default-profile.ts`, and
  `src/lib/tools/tool-policy-types.ts`.
- Verified provider capability slots, providers, defaults, and required-key
  metadata in `src/lib/ai/providers/provider-catalog.ts` and
  `src/lib/ai/providers/provider-config-service.ts`.
- Verified chat/prompt pruning entry points in
  `src/lib/chat/tool-composition-root.ts`,
  `src/core/entities/role-directive-assembler.ts`, and
  `src/core/entities/role-directives.ts`.
- Verified direct/runtime bypasses in `src/app/api/tts/route.ts`,
  `src/lib/audio/audio-generation-service.ts`,
  `src/core/use-cases/tools/admin-web-search.tool.ts`,
  `src/lib/blog/blog-production-root.ts`,
  `src/lib/blog/blog-image-generation-service.ts`, and
  `src/lib/jobs/deferred-job-handler-factories.ts`.
- Verified admin tool UI currently exposes `providerKey` metadata in
  `src/app/admin/system/tools/ToolsManager.tsx`, not capability-slot state.

QA corrections applied:

- Clarified that admin/runtime overrides may persist enable intent, but cannot
  make provider-disabled tools effectively available.
- Split the design so provider availability stays in the provider layer while
  tool-to-slot mapping and shared execution guards live in the tool layer.
- Added an explicit STT guardrail: no Phase-07 tool maps to `stt` until a real
  transcription runtime exists.
- Added MCP/shared execution surfaces to the guard requirement for exported
  provider-backed tools.
- Added a post-implementation QA correction so planned catalog dispatch guards
  provider-backed tools before MCP stdio, native process, remote service,
  browser, or deferred target execution.

Implementation closeout evidence:

- Added provider capability availability resolution in
  `src/lib/ai/providers/provider-capability-availability.ts`.
- Added the tool-layer mapping and shared guard in
  `src/lib/tools/tool-provider-capability-policy.ts`.
- Replaced key-only manifest gating in
  `src/lib/tools/tool-availability-service.ts`.
- Added provider capability metadata to effective tool manifests and the admin
  tool UI.
- Guarded TTS, stored audio generation, blog image generation, admin web
  search, and deferred catalog-bound provider-backed jobs.
- Guarded planned catalog dispatch so provider-backed tools cannot bypass
  capability checks through non-host execution targets.
- Preserved cached audio, existing hero-image selection, media asset discovery,
  media composition, chart generation, and graph generation paths.

Validation:

- `npm run test -- src/lib/ai/providers/provider-capability-availability.test.ts src/lib/tools/tool-provider-capability-policy.test.ts src/lib/tools/tool-availability-service.test.ts src/lib/chat/tool-composition-root.test.ts src/core/entities/role-directive-assembler.test.ts src/app/api/tts/route.test.ts src/lib/audio/audio-generation-service.test.ts src/lib/blog/blog-production-root.test.ts src/core/use-cases/tools/admin-web-search.tool.test.ts src/lib/jobs/deferred-job-handler-factories.test.ts tests/system-prompt-assembly.test.ts tests/compatibility-layer-sunset.test.ts tests/job-visibility-patterns.test.ts tests/jobs-system-dashboard.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/lib/jobs/deferred-job-runtime.test.ts src/core/capability-catalog/catalog.test.ts`
  passed: 17 files, 168 tests, 2 skipped.
- `npm run test -- src/core/capability-catalog/runtime-tool-binding.test.ts`
  passed after the planned-dispatch guard correction: 29 tests, 2 skipped.
- `npm run typecheck` passed.
- Targeted `npx eslint ...` passed with no warnings or errors.
- Source cleanup check for
  `getProviderKeyForTool|providerKeys|OPENAI_API_KEY` in the tool control-plane
  paths returned no matches.
- Remaining `getOpenaiApiKey()`/`new OpenAI` matches are after shared guards in
  direct OpenAI execution surfaces.

## Goal

Feed optional provider-backed capability availability into the runtime tool
control plane so unavailable provider-backed tools are not shown to the model,
cannot be effectively enabled by admin/runtime overrides, and fail closed in
direct routes or worker handlers.

Phase 07 is about optional capability providers:

- image generation
- text to speech
- speech to text
- web search

It must preserve Phase 06 intelligence-provider behavior. Chat, direct turns,
conversation summarization, and blog article text production continue to use
the selected intelligence provider runtime.

## Non-Goals

- Do not remove OpenAI support.
- Do not implement a full local Whisper runtime yet.
- Do not require OpenAI for installs that only use Anthropic or DeepSeek chat.
- Do not hide existing generated assets, existing blog image candidates, audio
  artifacts, or media composition from users.
- Do not make static `config/tools.json` or SQLite tool toggles obsolete.

## Current-Code Grounding

Provider capability config exists after Phases 03-05:

- `src/lib/ai/providers/provider-catalog.ts`
  - defines capability slots: `image`, `tts`, `stt`, `web_search`.
  - supports `disabled`, `openai`, and `local_whisper` for STT.
  - maps slot setting keys:
    - `IMAGE_PROVIDER`
    - `TTS_PROVIDER`
    - `STT_PROVIDER`
    - `WEB_SEARCH_PROVIDER`
- `src/lib/ai/providers/provider-config-service.ts`
  - resolves each capability slot through
    `resolveCapabilityProviderConfig(slot)`.
  - defaults OpenAI-backed slots to `disabled` when no OpenAI key is configured.
  - preserves explicit OpenAI provider selection even when the key is missing,
    exposing `requiredKey.configured=false`.
- `src/lib/ai/providers/provider-settings-service.ts`
  - persists provider/capability settings from install and admin UI.
  - validates OpenAI only when an OpenAI-backed capability is enabled or a new
    OpenAI key is submitted.
- `src/app/admin/system/keys/KeysManager.tsx`
  - lets admins choose optional capability providers and models.
- `src/app/install/InstallWizard.tsx`
  - lets installs choose optional capability providers without making OpenAI
    mandatory.

The runtime tool control plane exists after Phase 01 and Phase 05:

- `src/lib/tools/tool-availability-service.ts`
  - applies catalog defaults, static config, admin SQLite overrides, protected
    tool rules, role filters, and request filters.
  - unregisters unavailable tools from `ToolRegistry`.
  - currently gates provider-backed tools through `getProviderKeyForTool()`.
- `src/lib/tools/tool-default-profile.ts`
  - marks `generate_audio`, `generate_blog_image`, and `admin_web_search` as
    provider-gated optional tools.
  - maps every provider-gated optional tool to `OPENAI_API_KEY`.
- `src/lib/chat/tool-composition-root.ts`
  - builds the registry and applies `createRegistryAvailability()`.
- `src/core/entities/role-directive-assembler.ts`
  - accepts `availableToolNames` and omits prompt hints for unavailable tools.
- `src/core/entities/role-directives.ts`
  - builds fallback directives from effective role tool availability.
- `src/lib/chat/stream-route-handler.ts`
  - calls `registry.getSchemasForRole(role)` after registry pruning.
  - sends the resulting tool manifest into the prompt builder.
- `src/lib/chat/chat-turn.ts`
  - uses `registry.getSchemasForRole(role)` for direct chat tools.

Current gaps:

- `ToolAvailabilityService` only checks provider keys, not selected capability
  provider slots. If `TTS_PROVIDER=disabled` while `OPENAI_API_KEY` exists,
  `generate_audio` can still be enabled.
- `getProviderKeyForTool()` hardcodes provider-gated tools to
  `OPENAI_API_KEY`. It cannot express `IMAGE_PROVIDER=disabled`,
  `WEB_SEARCH_PROVIDER=disabled`, or future `STT_PROVIDER=local_whisper`.
- `ToolAvailabilityService` has no structured provider-capability reason like
  `tts_provider_disabled` or `web_search_provider_missing_key`.
- Admin runtime toggles can request-enable a provider-backed tool whose
  capability slot is disabled. The final manifest may still say enabled if the
  OpenAI key exists.
- Direct route `src/app/api/tts/route.ts` reads `getOpenaiApiKey()` directly.
  It allows cached audio hits before provider access, which is good, but it
  does not check `TTS_PROVIDER`.
- Worker path `src/lib/audio/audio-generation-service.ts` checks cache before
  calling OpenAI, which is good, but it does not check `TTS_PROVIDER`.
- Web search tool `src/core/use-cases/tools/admin-web-search.tool.ts`
  constructs `new OpenAI({ apiKey: getOpenaiApiKey() })` and does not check
  `WEB_SEARCH_PROVIDER`.
- Blog image generation root `src/lib/blog/blog-production-root.ts` lazily
  constructs an OpenAI image provider and does not check `IMAGE_PROVIDER`.
- Blog image generation service has selection/list/reject flows for existing
  assets. These should remain available even when image generation is disabled.
- `src/lib/jobs/deferred-job-handler-factories.ts` creates worker handlers for
  `generate_audio` and catalog-bound `generate_blog_image`/`admin_web_search`
  without provider-capability guards at worker execution time.

## Target Architecture

Use a small capability-availability policy service and a tool-layer capability
policy as the bridge between provider config and tool availability. Keep the
provider layer unaware of runtime tool names; tool policy owns tool-to-slot
mapping.

Recommended new module:

- `src/lib/ai/providers/provider-capability-availability.ts`
- `src/lib/tools/tool-provider-capability-policy.ts`

Provider capability availability responsibilities:

- Resolve capability slot state from `ProviderConfigService`.
- Return redaction-safe availability records.
- Avoid SDK construction and avoid live provider calls.

Tool provider capability policy responsibilities:

- Map runtime tools to provider capability slots.
- Provide assertion helpers for direct routes, tool handlers, MCP/shared
  exports, and worker handlers.
- Translate provider capability state into tool availability state/reason.
- Keep the mapping in one place for `ToolAvailabilityService`, direct guards,
  worker guards, and tests.

Recommended contracts:

```ts
type ProviderCapabilityAvailabilityState =
  | "available"
  | "disabled"
  | "missing_key"
  | "unsupported";

interface ProviderCapabilityAvailability {
  slot: "image" | "tts" | "stt" | "web_search";
  provider: "disabled" | "openai" | "local_whisper";
  state: ProviderCapabilityAvailabilityState;
  reason:
    | "provider_configured"
    | "provider_disabled"
    | "missing_required_key"
    | "unsupported_provider";
  model: string | null;
  requiredKeyConfigured: boolean | null;
  requiredKeySource: "env" | "sqlite" | "default" | "missing" | null;
}

interface ToolProviderCapabilityRequirement {
  toolName: string;
  slot: "image" | "tts" | "stt" | "web_search";
  operation: "generate" | "search" | "transcribe";
}
```

Initial tool-to-slot mapping:

- `generate_audio` -> `tts`
- `generate_blog_image` -> `image`
- `admin_web_search` -> `web_search`

Explicit non-mappings:

- `select_journal_hero_image` is not gated by `image`; it manages existing
  blog assets and must remain usable.
- `list_conversation_media_assets` is not gated by any provider; it discovers
  existing assets.
- `compose_media` is not gated by OpenAI image/TTS/STT; it composes existing
  media and local/generated assets.
- `generate_blog_image_prompt` is not gated by `image`; it uses the selected
  intelligence provider and should remain Phase-06 governed.
- `generate_chart` and `generate_graph` are local/runtime media tools, not
  OpenAI capability tools.
- No initial Phase-07 tool maps to `stt`. `local_whisper` may resolve as
  config-available, but it must not expose a transcription tool until a local
  STT runtime exists.

## Design Principles

GOF patterns:

- Facade/Application Service:
  `ProviderCapabilityAvailabilityService` exposes capability readiness without
  leaking provider-config internals to tool/runtime callers.
- Strategy:
  provider catalog entries determine whether a provider needs a key and what
  model/default applies.
- Adapter:
  OpenAI image, TTS, and web-search implementations stay behind existing
  adapters/tools; Phase 07 adds guard policy around them, not provider logic
  duplication.

SOLID/Clean boundaries:

- `ProviderConfigService` remains the source of provider/capability config.
- `ProviderCapabilityAvailabilityService` owns config-to-availability
  interpretation.
- `tool-provider-capability-policy.ts` owns tool-to-capability mapping and
  shared assertions.
- `ToolAvailabilityService` owns tool policy composition and registry pruning.
- Direct routes and workers own request/cache/job behavior, but call a shared
  guard before new provider generation/search.
- Asset discovery, asset selection, and composition remain separate from
  provider generation availability.

DRY rule:

- Do not repeat `"OPENAI_API_KEY"` checks in each tool/route/worker.
- Do not maintain separate provider-gated tool lists in multiple modules.
- The tool-to-capability mapping should live in
  `src/lib/tools/tool-provider-capability-policy.ts` and be imported by
  `ToolAvailabilityService`, route guards, worker guards, MCP/shared tool
  exports, and tests.

## Implementation Plan

### 1. Add Provider Capability Availability Service

Add:

- `src/lib/ai/providers/provider-capability-availability.ts`
- `src/lib/ai/providers/provider-capability-availability.test.ts`

Core API:

```ts
class ProviderCapabilityAvailabilityService {
  getCapabilityAvailabilitySnapshot(): Record<CapabilitySlotId, ProviderCapabilityAvailability>;
  getCapabilityAvailability(slot: CapabilitySlotId): ProviderCapabilityAvailability;
}
```

Behavior:

- `provider=disabled` -> `state="disabled"`.
- provider with required key and configured key -> `state="available"`.
- provider with required key and missing key -> `state="missing_key"`.
- provider without required key, such as `local_whisper`, -> `state="available"`
  for config purposes. Runtime implementation is still required before a tool
  can map to that slot.
- unknown providers should not occur after `ProviderConfigService`, but helper
  output should fail closed if it receives unsupported state.

Errors:

- Add a typed error such as `ProviderCapabilityUnavailableError`.
- Error message must name the capability slot and provider, not a secret value.
- Example: `tts capability is disabled. Enable TTS_PROVIDER or use an existing audio asset.`

### 2. Replace Key-Only Tool Gating

Add:

- `src/lib/tools/tool-provider-capability-policy.ts`
- `src/lib/tools/tool-provider-capability-policy.test.ts`

Update:

- `src/lib/tools/tool-default-profile.ts`
- `src/lib/tools/tool-availability-service.ts`
- `src/lib/tools/tool-policy-types.ts`
- `src/lib/tools/tool-availability-service.test.ts`

Prune/simplify:

- Replace `getProviderKeyForTool()` with a provider capability requirement
  lookup from `tool-provider-capability-policy.ts`, or keep a thin
  compatibility function only if no callers remain.
- Remove direct `providerKeys` dependence from normal production flow.
  Tests may still inject a provider capability snapshot for deterministic
  coverage.
- Move the provider-gated optional tool set out of
  `tool-default-profile.ts` unless that module imports it from the new policy
  module.

Effective manifest changes:

- Add fields to `EffectiveToolAvailability`:
  - `providerCapabilitySlot: CapabilitySlotId | null`
  - `providerCapabilityState: ProviderCapabilityAvailabilityState | null`
  - `providerCapabilityProvider: CapabilityProviderId | null`
- Keep `providerKey` only if needed for UI compatibility; prefer deprecating it
  in favor of capability slot metadata.
- If capability slot is disabled, state should be `provider_disabled` with
  reason `provider_capability_disabled`.
- If OpenAI capability is selected but key is missing, state should be
  `missing_provider_key` with reason `missing_openai_key`.

Precedence:

1. protected tools stay enabled.
2. install profile/static config can disable tools.
3. admin runtime can disable tools.
4. provider capability gates must prevent effective enablement when the
   required slot is disabled or missing a key.

That means admin `enable_tool generate_audio` can persist as an intent, but the
effective manifest still reports provider-disabled/missing-key until the
provider capability is configured.

### 3. Ensure Prompt And Registry Pruning Use Effective Availability

Existing code should mostly continue to work after step 2:

- `createToolRegistry()` calls `createRegistryAvailability()`.
- `getToolComposition()` cache key uses manifest version.
- `registry.getSchemasForRole()` only sees registered tools.
- stream/direct chat prompt manifests are built from registry schemas.
- `assembleRoleDirective()` already accepts `availableToolNames`.

Add tests proving:

- missing OpenAI key removes `generate_audio`, `generate_blog_image`, and
  `admin_web_search` from role tool schemas.
- `TTS_PROVIDER=disabled` removes `generate_audio` even when OpenAI key exists.
- `IMAGE_PROVIDER=disabled` removes `generate_blog_image` even when OpenAI key
  exists.
- `WEB_SEARCH_PROVIDER=disabled` removes `admin_web_search` even when OpenAI key
  exists.
- prompt directive assembly omits provider-disabled tool hints.

### 4. Guard Direct Routes And Workers

Add a shared guard helper, preferably from
`tool-provider-capability-policy.ts`:

```ts
assertProviderBackedToolAvailable("generate_audio");
assertProviderBackedToolAvailable("generate_blog_image");
assertProviderBackedToolAvailable("admin_web_search");
```

Update direct/runtime surfaces:

- `src/app/api/tts/route.ts`
  - keep cache lookup before the provider guard.
  - after cache miss, assert `generate_audio` capability before calling OpenAI.
  - return a provider-disabled response without exposing OpenAI key details.
  - prefer extracting/reusing the shared audio provider path instead of keeping
    a second raw OpenAI TTS implementation if that can be done without changing
    response behavior.
- `src/lib/audio/audio-generation-service.ts`
  - keep user-file cache lookup before the provider guard.
  - after cache miss, assert `generate_audio` capability before calling OpenAI.
- `src/core/use-cases/tools/admin-web-search.tool.ts`
  - assert `admin_web_search` capability before constructing OpenAI deps.
  - the same guard must protect any host/MCP/shared execution surface that
    invokes the catalog-bound web-search tool.
- `src/lib/blog/blog-production-root.ts` or
  `src/lib/blog/blog-image-generation-service.ts`
  - assert `generate_blog_image` capability before constructing/calling the
    OpenAI image provider.
  - do not guard `selectHeroImage()`, `listHeroCandidates()`,
    `rejectHeroImage()`, or `publishHeroAssetForPost()`.
- `src/lib/jobs/deferred-job-handler-factories.ts`
  - ensure deferred `generate_audio`, `generate_blog_image`, and
    `admin_web_search` executions fail closed if the capability became
    unavailable after job enqueue.

### 5. Preserve Existing Asset Use

Tests must prove provider-disabled state does not break existing asset flows:

- cached audio can still be returned by `/api/tts` without OpenAI.
- `generateStoredAudioArtifact()` can return a cached user-file artifact before
  asserting provider availability.
- `list_conversation_media_assets` remains enabled when image/TTS providers are
  disabled.
- `compose_media` remains enabled when image/TTS providers are disabled.
- `select_journal_hero_image` remains enabled when image provider is disabled.

### 6. Update Admin Tool UI Metadata

Update:

- `src/app/admin/system/tools/ToolsManager.tsx`

UI should show capability slot state, not just `OPENAI_API_KEY`.

Suggested labels:

- `tts: disabled`
- `tts: missing OpenAI key`
- `image: available`
- `web_search: disabled`

The UI should allow admins to persist enable intent for a provider-gated tool,
but it must make clear the effective state remains provider-disabled/missing-key
until provider settings are fixed.

## Dead Code And Simplification Targets

Remove or reduce:

- `getProviderKeyForTool()` as a policy source. It is too weak because provider
  capability state is no longer equivalent to one key.
- `providerKeys` as the primary production input for `ToolAvailabilityService`.
  Keep only a test seam if needed.
- Repeated direct OpenAI-key checks in route/tool/worker code where a
  provider-capability guard should be used.
- Any prompt/directive special casing for provider-backed tools outside the
  effective manifest path.

Do not remove:

- `getOpenaiApiKey()` compatibility wrapper yet. OpenAI providers still need it
  after the capability guard passes.
- OpenAI image/TTS/web-search adapters.
- asset discovery, selection, media composition, chart, or graph tools.

## Acceptance Tests

Add or update:

- `src/lib/ai/providers/provider-capability-availability.test.ts`
  - disabled provider -> disabled state.
  - OpenAI provider with key -> available state.
  - OpenAI provider without key -> missing-key state.
  - local whisper provider -> available config state without key.
- `src/lib/tools/tool-provider-capability-policy.test.ts`
  - tool-to-slot mappings are complete for provider-backed tools.
  - no STT tool is mapped until a transcription runtime exists.
  - non-generation asset/media tools are explicitly not provider-gated.
- `src/lib/tools/tool-availability-service.test.ts`
  - `TTS_PROVIDER=disabled` disables `generate_audio` even with OpenAI key.
  - `IMAGE_PROVIDER=disabled` disables `generate_blog_image` even with OpenAI
    key.
  - `WEB_SEARCH_PROVIDER=disabled` disables `admin_web_search` even with OpenAI
    key.
  - admin enable intent cannot override provider-disabled effective state.
- `src/lib/chat/tool-composition-root.test.ts`
  - provider-disabled tools are unregistered from the runtime registry.
  - role schemas omit provider-disabled tools.
- `src/core/entities/role-directive-assembler.test.ts` or existing prompt
  directive tests
  - provider-disabled tools do not contribute role prompt hints.
- `src/app/api/tts/route.test.ts`
  - cached audio still returns when TTS provider is disabled.
  - cache miss fails before OpenAI fetch when TTS provider is disabled.
- `src/lib/audio/audio-generation-service.test.ts`
  - cached audio returns before provider guard.
  - cache miss fails before OpenAI fetch when TTS provider is disabled.
- `src/lib/blog/blog-production-root.test.ts` or
  `src/lib/blog/blog-image-generation-service.test.ts`
  - image generation fails before OpenAI provider call when image provider is
    disabled.
  - hero asset selection/listing remains available.
- `src/core/use-cases/tools/admin-web-search.tool.test.ts`
  - disabled web search fails before OpenAI construction.
- `src/lib/jobs/deferred-job-handler-factories.test.ts`
  - deferred provider-backed generation/search fails closed when provider
    capability is disabled at worker execution time.

## Validation Command Set

Minimum focused validation after implementation:

```bash
npm run test -- src/lib/ai/providers/provider-capability-availability.test.ts src/lib/tools/tool-provider-capability-policy.test.ts src/lib/tools/tool-availability-service.test.ts src/lib/chat/tool-composition-root.test.ts src/core/entities/role-directive-assembler.test.ts src/app/api/tts/route.test.ts src/lib/audio/audio-generation-service.test.ts src/lib/blog/blog-production-root.test.ts src/core/use-cases/tools/admin-web-search.tool.test.ts src/lib/jobs/deferred-job-handler-factories.test.ts
npm run typecheck
npx eslint src/lib/ai/providers/provider-capability-availability.ts src/lib/tools/tool-provider-capability-policy.ts src/lib/tools/tool-availability-service.ts src/lib/tools/tool-default-profile.ts src/lib/tools/tool-policy-types.ts src/lib/chat/tool-composition-root.ts src/core/entities/role-directive-assembler.ts src/app/api/tts/route.ts src/lib/audio/audio-generation-service.ts src/lib/blog/blog-production-root.ts src/lib/blog/blog-image-generation-service.ts src/core/use-cases/tools/admin-web-search.tool.ts src/lib/jobs/deferred-job-handler-factories.ts src/app/admin/system/tools/ToolsManager.tsx
```

Source cleanup checks:

```bash
rg -n "getProviderKeyForTool|providerKeys|OPENAI_API_KEY" src/lib/tools src/lib/chat/tool-composition-root.ts src/app/admin/system/tools src/core/use-cases/tools/configure-tool-availability.tool.ts
rg -n "getOpenaiApiKey\\(|new OpenAI" src/app/api/tts src/lib/audio src/lib/blog src/core/use-cases/tools/admin-web-search.tool.ts
```

Expected cleanup interpretation:

- `getProviderKeyForTool` should be gone or only be a deprecated compatibility
  shim with no production policy use.
- `providerKeys` should not be the production capability-gating path.
- `getOpenaiApiKey()`/`new OpenAI` can remain inside OpenAI adapters/routes
  only after shared capability guards.

## Done

- [x] Capability slot availability is resolved from provider settings, not raw
      OpenAI key presence alone.
- [x] Missing OpenAI key removes OpenAI-backed provider tools from manifests.
- [x] Disabled TTS removes `generate_audio`.
- [x] Disabled image generation removes `generate_blog_image`.
- [x] Disabled web search removes `admin_web_search`.
- [x] Admin enable/runtime overrides cannot make provider-disabled tools
      effectively available.
- [x] Provider-disabled tools are absent from role tool schemas and prompt
      hints.
- [x] Direct TTS route and audio worker fail closed on cache miss when TTS is
      disabled.
- [x] Blog image generation fails closed when image generation is disabled.
- [x] Admin web search fails closed when web search is disabled.
- [x] Planned catalog dispatch fails closed for provider-backed tools before
      MCP/native/remote/deferred target execution.
- [x] Existing generated audio cache, media asset discovery, media composition,
      and hero image selection remain usable.
- [x] Static config and SQLite admin tool toggles remain active policy layers.
