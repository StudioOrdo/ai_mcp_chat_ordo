# Provider Capability Configuration Refactor

This package tracks the refactor that makes tool and provider configuration
explicit, UI-managed, runtime-consistent, and capability-aware.

The core distinction:

- Intelligence providers run chat, reasoning, summarization, and article
  production. Initial providers: Anthropic and Anthropic-compatible DeepSeek.
- Capability providers run optional surfaces such as image generation, TTS,
  speech-to-text, and web search. OpenAI is an optional capability provider, not
  the default chat brain.
- Tool availability is a separate runtime control plane. Provider availability
  contributes to tool availability, but admins also need install profiles,
  static overrides, runtime toggles, and conversational controls for tools in
  general.

Current status: Phase 08 implemented and QA-verified as of 2026-05-02. The
runtime tool control plane exists, provider/capability surfaces have clear
ownership, the provider resolver/catalog provides effective provider truth with
source reporting, shared validation/client factories remove duplicated
install/admin SDK validation, install/admin provider settings are UI-managed,
runtime intelligence paths consume selected provider config, provider-backed
tools are pruned by capability availability, and admin/health/docs now report
effective provider, capability, and tool state.

## Package Contents

1. [contract-spec.md](contract-spec.md): implementation-ready product and
   technical contract.
2. [phase-plan.md](phase-plan.md): proposed execution sequence and closeout
   requirements.
3. [validation-checklist.md](validation-checklist.md): focused unit, route,
   registry, and install/admin proof matrix.
4. [qa-review.md](qa-review.md): code-grounded QA findings and cleanup
   requirements.
5. [systemic-audit.md](systemic-audit.md): repo-wide fragmentation watchlist
   for provider config, OpenAI optional capabilities, tools, MCP sidecars, and
   health pages.
6. [phases/](phases/README.md): detailed phase-by-phase implementation plan.

## Incident Grounding

This package is grounded in the May 1, 2026 system review and provider/code
inspection.

Observed issues:

- Install and admin validation hard-code `claude-3-haiku-20240307`.
- Runtime chat helpers read provider keys/models from `process.env` while
  install writes provider keys to SQLite through `ConfigurationService`.
- `ConfigurationService` already supports env-then-SQLite resolution, but the
  primary runtime paths bypass it.
- Admin system pages display raw env state instead of effective runtime config.
- OpenAI-backed image/audio/web-search tools can be registered even when
  `OPENAI_API_KEY` is absent.
- `config/tools.json` can statically enable/disable tools, but it is
  process-cached and has no admin UI or conversational runtime control.
- Role prompt hints are assembled from the full capability catalog, so disabled
  tools can still be described unless prompt assembly consumes effective
  availability.
- OpenAI's role is ambiguous in UI/docs: it is used for optional capabilities,
  not chat.
- There is not yet a first-class STT/Whisper provider surface.

## Target Decision

Use two explicit configuration planes:

1. Intelligence provider plane:
   - `AI_PROVIDER=anthropic|deepseek`
   - selected key, model, base URL, model candidates, timeout/retry policy
   - used by chat stream, direct chat, summarization, and article production
2. Capability provider plane:
   - `IMAGE_PROVIDER=disabled|openai`
   - `TTS_PROVIDER=disabled|openai`
   - `STT_PROVIDER=disabled|local_whisper|openai`
   - `WEB_SEARCH_PROVIDER=disabled|openai`
   - optional provider-specific model settings and key validation

Unavailable tools must be pruned before prompt/tool registration. The effective
tool policy must combine catalog declaration, install profile defaults, static
`config/tools.json`, SQLite admin toggles, provider availability, role access,
and request-scoped filtering. Direct routes and workers must still guard
execution and return explicit disabled or missing-configuration errors.

## Existing Code To Preserve

- [src/lib/config/ConfigurationService.ts](../../../src/lib/config/ConfigurationService.ts)
  already provides env-then-SQLite key/value configuration.
- [src/lib/chat/provider-runtime.ts](../../../src/lib/chat/provider-runtime.ts)
  already provides a shared retry/fallback attempt runner.
- [src/lib/chat/provider-policy.ts](../../../src/lib/chat/provider-policy.ts)
  already centralizes retry, timeout, fallback, and provider event reporting.
- [src/core/capability-catalog/](../../../src/core/capability-catalog)
  is the correct source of capability metadata.
- [src/lib/chat/tool-composition-root.ts](../../../src/lib/chat/tool-composition-root.ts)
  is the current registry composition point where runtime pruning can occur.
- [src/lib/config/instance.ts](../../../src/lib/config/instance.ts) and
  `config/tools.json` already support static enabled/disabled tool lists.
- [src/core/capability-catalog/capability-ownership.ts](../../../src/core/capability-catalog/capability-ownership.ts)
  already distinguishes core tools from extension packs.
- [src/core/entities/role-directive-assembler.ts](../../../src/core/entities/role-directive-assembler.ts)
  is the current prompt-hint assembly point and must consume effective
  availability before provider-specific pruning is complete.

## Desired Product Behavior

- First install can complete without editing env files.
- The installer lets the admin choose the intelligence provider, key, model,
  and optional base URL.
- Admin settings can change provider, model, key, base URL, and optional
  capability providers without redeploying the container.
- Admin settings can enable/disable toggleable tools and bundles without
  redeploying the container.
- Admins can conversationally ask Ordo to enable/disable tools, inspect why a
  tool is unavailable, and list protected tools.
- OpenAI is clearly labeled as optional support for image/audio/web-search
  capabilities, not as the chat provider.
- If no OpenAI key is configured, OpenAI-backed image/audio/web-search tools are
  disabled and absent from the model tool manifest.
- Existing generated audio/image assets remain viewable and reusable after
  generation providers are disabled.
- Health/admin pages report effective config source: env, SQLite, or default.
- DeepSeek can use the Anthropic SDK transport without inheriting Claude model
  fallback names.
- Future local Whisper can plug into the same capability-provider contract.

## Guardrails

- Do not create a second low-level configuration store.
- Do not create provider-only tool pruning before the general tool policy layer
  exists.
- Do not make routes read `process.env` directly for provider truth.
- Do not hide unavailable tools only in React. Prune before prompt/tool
  registration.
- Do not let disabled tools remain in role prompt hints.
- Do not let normal admin controls disable protected recovery tools such as
  `inspect_runtime_context`, `inspect_runtime_logs`, `inspect_theme`, and the
  future `configure_tool_availability`.
- Do not treat OpenAI as the chat provider unless a future explicit intelligence
  provider strategy is added.
- Do not send Claude fallback models to DeepSeek.
- Do not fail boot just because an optional capability provider is disabled.
- Do not hide old assets when generation is disabled.
- Do not rewrite `ProviderRuntime`; make it consume the new provider policy.
- Keep direct route/job guards even when registry pruning exists.

## Phase Status

| Phase | Goal | Status |
| --- | --- | --- |
| 00 | Baseline evidence | Complete |
| 01 | Runtime tool control plane | Complete |
| 02 | Provider contract and current-state inventory | Complete |
| 03 | Provider config resolver and catalog | Complete |
| 04 | Shared validation and client factories | Complete |
| 05 | Install and admin provider UI | Complete |
| 06 | Runtime integration and env-helper pruning | Complete |
| 07 | Provider capability availability and tool pruning | Complete |
| 08 | Health, diagnostics, docs, and closeout | Complete |

## Next Work

1. Use the provider diagnostics surface as the baseline for future local
   Whisper/STT and lifecycle health work.
