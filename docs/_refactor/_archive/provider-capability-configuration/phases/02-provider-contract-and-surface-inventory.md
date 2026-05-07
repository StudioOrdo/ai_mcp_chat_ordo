# Phase 02 - Provider Contract And Surface Inventory

Status: complete as a research-grounded implementation contract on 2026-05-02.

## Goal

Assign one responsibility to every provider configuration surface before writing
the resolver, validation, UI, and runtime integrations.

This phase depends on Phase 01. Provider-backed capability availability must map
onto the general runtime tool control plane instead of bypassing it.

The output of this phase is the implementation boundary for Phases 03-08.

## Contract Decisions

### Intelligence Providers

Intelligence providers power chat, direct chat turns, summarization, article
production, review, prompt design, and any future model-backed planning surface.

Initial supported providers:

- `anthropic`
- `deepseek`

Both initial providers use an Anthropic Messages-compatible runtime shape.
DeepSeek must be treated as a separate provider strategy with its own key, base
URL, model defaults, and fallback candidates. Do not send Claude fallback model
names to DeepSeek.

Required effective fields:

- `AI_PROVIDER`
- provider API key
- selected model
- optional base URL
- provider-specific timeout and retry policy
- provider-specific model fallback candidates
- source reporting: `env`, `sqlite`, or `default`

OpenAI is not an intelligence provider in this package.

### Capability Providers

Capability providers power optional user-facing or admin-facing features. They
must not affect chat readiness unless the selected intelligence provider is
missing.

Initial capability provider slots:

| Capability | Provider Values | Current Runtime State |
| --- | --- | --- |
| Image generation | `disabled`, `openai` | OpenAI-backed blog image generation exists. |
| TTS | `disabled`, `openai` | OpenAI-backed audio generation exists in route and worker paths. |
| STT | `disabled`, `local_whisper`, `openai` | Reserved slot only; no first-class runtime STT implementation in this phase. |
| Web search | `disabled`, `openai` | OpenAI Responses API-backed admin web search exists. |

OpenAI keys must be optional. Missing OpenAI config disables OpenAI-backed
capability tools and direct generation routes, but must not block core chat.

## Current Code Inventory

### Existing Configuration Primitive

`src/lib/config/ConfigurationService.ts` remains the low-level env-then-SQLite
key/value primitive. Do not create a second storage backend.

`src/lib/config/env.ts` is currently a runtime truth source and exposes:

- `getAnthropicApiKey`
- `getOpenaiApiKey`
- `getAnthropicModel`
- `getModelFallbacks`
- timeout and retry helpers

Target responsibility: convert these into compatibility wrappers around the new
provider config service, then prune direct production use where practical.

### Intelligence Runtime Surfaces

These surfaces currently read Anthropic config directly or construct Anthropic
clients directly:

- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/chat-turn.ts`
- `src/lib/chat/anthropic-client.ts`
- `src/lib/chat/anthropic-stream.ts`
- `src/lib/chat/conversation-root.ts`
- `src/lib/chat/provider-policy.ts`
- `src/adapters/AnthropicSummarizer.ts`
- `src/adapters/AnthropicBlogArticlePipelineModel.ts`
- `src/lib/blog/blog-production-root.ts`

Target responsibility: consume a resolved intelligence provider config and
clients from provider factories. These files should not own provider selection,
model fallback selection, API key lookup, base URL selection, or validation.

### Optional Capability Runtime Surfaces

Image generation:

- `src/adapters/OpenAiBlogImageProvider.ts`
- `src/lib/blog/blog-image-generation-service.ts`
- `src/lib/blog/blog-production-root.ts`
- `src/core/use-cases/tools/blog-image.tool.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/app/api/e2e/media/generated-image/route.ts`

TTS:

- `src/lib/audio/audio-generation-service.ts`
- `src/lib/audio/audio-generation-provider.ts`
- `src/app/api/tts/route.ts`
- `src/core/use-cases/tools/generate-audio.tool.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/lib/jobs/generate-audio-deferred-job.ts`
- `src/lib/jobs/deferred-job-handler-factories.ts`
- `src/app/api/chat/jobs/route.ts`
- `mcp/generate-audio-server.ts`

Web search:

- `src/core/use-cases/tools/admin-web-search.tool.ts`
- `src/lib/capabilities/shared/web-search-tool.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/app/api/web-search/route.ts`
- `mcp/admin-web-search-server.ts`

Target responsibility: capability-specific services receive an effective
capability config and provider client. They should not hard-code OpenAI as
available, hard-code model defaults, or perform independent key gating.

### Catalog, Routing, And Prompt Surfaces

These surfaces currently decide which tools exist, which tools appear in prompt
hints, and which execution binding is used:

- `src/core/capability-catalog/families/*`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/core/capability-catalog/capability-ownership.ts`
- `src/lib/chat/tool-composition-root.ts`
- `src/lib/chat/tool-capability-routing.ts`
- `src/lib/chat/runtime-manifest.ts`
- `src/core/entities/role-directive-assembler.ts`

Target responsibility: consume the effective tool manifest from Phase 01 plus
provider capability facts from later phases. These files should not invent a
second provider-gating rule and should not describe provider-disabled tools in
prompt hints.

### Install, Admin, Health, And Diagnostics Surfaces

These surfaces currently expose Anthropic/OpenAI as key-only configuration or
read raw env state:

- `src/app/install/InstallWizard.tsx`
- `src/app/api/install/validate-keys/route.ts`
- `src/app/api/install/setup/route.ts`
- `src/app/admin/system/keys/page.tsx`
- `src/app/admin/system/keys/KeysManager.tsx`
- `src/app/api/admin/system/keys/route.ts`
- `src/app/admin/system/page.tsx`
- `src/lib/admin/processes.ts`
- `src/lib/operator/loaders/admin-health-loaders.ts`
- `src/lib/health/probes.ts`

Known defects:

- Install and admin validation hard-code `claude-3-haiku-20240307`.
- Install requires Anthropic instead of selected intelligence provider config.
- Admin key UI cannot choose provider, model, base URL, or optional capability
  providers.
- Admin system pages report raw env values instead of effective config.
- Health readiness is coupled to Anthropic rather than selected intelligence
  provider readiness.

Target responsibility: install/admin/health consume shared provider validation
and effective provider config services.

### Tool Availability Plane

Phase 01 added the runtime tool control plane:

- `src/lib/tools/tool-availability-service.ts`
- `src/lib/tools/tool-settings-service.ts`
- `src/lib/tools/tool-default-profile.ts`
- `src/app/admin/system/tools/*`
- `src/core/use-cases/tools/configure-tool-availability.tool.ts`

Current provider key gating is intentionally simple and OpenAI-key based. It
should become a consumer of capability availability, not the owner of provider
truth.

Target responsibility: `ToolAvailabilityService` keeps combining catalog,
install profile, static config, admin toggles, protected-tool policy, role
filtering, and request filters. A new capability availability service supplies
provider-backed availability facts.

### Scripts, Evals, And Tests

Several scripts and eval runners read provider env directly. These are lower
priority handoffs unless they are used by install/admin/runtime paths:

- `scripts/run-live-eval.ts`
- `scripts/run-staging-canary.ts`
- `scripts/run-sprint-6-qa.ts`
- `src/lib/evals/config.ts`
- `src/lib/evals/live-runner.ts`

Tests currently encode some Claude/OpenAI assumptions. Update tests in the
phase that changes the corresponding production code.

### Out-Of-Scope But Preserved Surfaces

These surfaces mention provider-backed media outputs but should not become
provider config owners:

- Existing audio/image materialization and user-file reuse paths.
- Existing blog hero image candidate selection/rejection routes.
- Existing media composition and browser-runtime read models.
- Existing transcript/result summarizers for generated audio/image payloads.

Target responsibility: keep generated assets discoverable and reusable even
when generation providers are disabled.

## Ownership Matrix

| Responsibility | Owner After Refactor | Notes |
| --- | --- | --- |
| Env/SQLite primitive reads and writes | `ConfigurationService` | Keep as storage primitive only. |
| Effective intelligence provider config | `ProviderConfigService` | Resolves selected provider, key, model, base URL, fallbacks, source. |
| Effective capability provider config | `ProviderConfigService` | Resolves image, TTS, STT, and web-search provider slots. |
| Provider defaults and supported values | `ProviderCatalog` | Owns Anthropic, DeepSeek, OpenAI capability defaults. |
| SDK/fetch client construction | `ProviderClientFactory` | Owns Anthropic-compatible and OpenAI client creation. |
| Install/admin validation | `ProviderValidationService` | Owns key/model/base URL validation and normalized errors. |
| Capability readiness facts | `CapabilityAvailabilityService` | Maps effective capability config to availability reason codes. |
| Effective tool states | `ToolAvailabilityService` | Consumes capability facts; does not validate keys or construct clients. |
| Prompt/tool registry pruning | Tool composition and routing roots | Consume effective manifest from `ToolAvailabilityService`. |
| Direct route/job guardrails | Route, catalog binding, and worker handlers | Guard execution even when registry pruning exists. |
| Health/admin reporting | Health/admin loaders | Show effective provider config source and readiness. |
| Existing generated asset reuse | Media/blog/user-file services | Preserve reads and selection flows when generation is disabled. |

## Clean Architecture Shape

Use the existing folder structure, but keep dependencies pointing inward:

- Core contracts define provider IDs, capability IDs, resolved configs,
  validation results, and availability facts.
- Application services resolve config, validate config, and project capability
  availability.
- Adapters create SDK clients and normalize provider-specific errors.
- Routes, UI, job handlers, MCP sidecars, and chat roots consume services.

Recommended patterns:

- Facade: `ProviderConfigService` gives callers one effective config API.
- Strategy: provider-specific validation and client behavior for Anthropic,
  DeepSeek, OpenAI, disabled capabilities, and future local Whisper.
- Factory: `ProviderClientFactory` owns SDK/fetch client construction.
- Repository: provider config reads/writes use `ConfigurationService` through a
  narrow settings repository, not scattered raw env reads.
- Chain of responsibility: resolve `env -> SQLite -> catalog default` with
  explicit source reporting.
- Specification: validation rules for required keys, supported models, base URL
  format, disabled capability state, and optional provider readiness.

SOLID constraints:

- Single responsibility: routes must not validate, resolve, and construct
  clients in the same file.
- Open/closed: adding a future provider should add a strategy/catalog entry, not
  edit every runtime surface.
- Interface segregation: chat code should depend on intelligence provider
  contracts; TTS/image/web-search code should depend on capability contracts.
- Dependency inversion: high-level chat/blog/tool services depend on provider
  abstractions, not SDK constructors.

## Prune And Simplify Targets

Remove or replace these patterns during implementation phases:

- Hard-coded validation model `claude-3-haiku-20240307`.
- Duplicated `extractApiErrorMessage` logic in install and admin key routes.
- Direct `new Anthropic(...)` and `new OpenAI(...)` in routes/root composers.
- Runtime provider truth from raw `process.env`.
- Admin pages that display raw env state as effective config.
- OpenAI key checks inside shared web-search execution.
- Hard-coded optional capability models such as `gpt-5`, `gpt-image-1`, and
  `tts-1` outside the provider catalog or explicit caller overrides.
- Anthropic fallback arrays reused for non-Anthropic providers.
- Provider availability checks embedded directly in `ToolAvailabilityService`.

Do not remove:

- `ConfigurationService`.
- Existing generated assets or cache lookup paths.
- Direct route/job guardrails.
- Phase 01 protected recovery tools.
- Existing media materialization, blog hero image selection, or user-file reuse
  flows.

## Phase Boundaries

Phase 02 is documentation and design only. Implementation belongs to later
phases:

- Phase 03: provider type definitions, catalog, resolver, source reporting, and
  compatibility wrappers.
- Phase 04: shared validation service and client factories; removes deprecated
  validation model.
- Phase 05: install/admin provider and capability UI.
- Phase 06: chat, summarization, blog, and provider-policy runtime integration.
- Phase 07: capability availability projection into tool manifests plus direct
  route/job guardrails.
- Phase 08: health, diagnostics, docs, and closeout.

## QA Evidence

Phase 02 was checked against:

- Parent package contract and validation checklist.
- Production searches for provider env helpers, SDK constructors, hard-coded
  model names, OpenAI API calls, and provider-backed tool names.
- Direct route, MCP sidecar, catalog binding, deferred enqueue, deferred worker,
  admin health, install/admin validation, chat, summarization, blog, TTS, image,
  and web-search surfaces.
- Phase boundaries for scripts/evals and generated asset reuse paths.

## Acceptance Criteria

- [x] Intelligence provider surfaces are explicit.
- [x] Optional capability provider surfaces are explicit.
- [x] Provider-gated tools map onto Phase 01 effective tool states.
- [x] STT/Whisper is reserved as a future provider slot, not implemented here.
- [x] Install, admin, health, MCP, script/eval, and test boundaries are named.
- [x] Pruning targets are code-grounded and assigned to later phases.
