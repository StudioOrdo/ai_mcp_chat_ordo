# Provider Capability Configuration Phase Plan

This file is the executive phase overview. Detailed implementation steps live in
[phases/](phases/README.md).

## Detailed Phase Index

0. [Phase 00 - Baseline Evidence](phases/00-baseline-evidence.md)
1. [Phase 01 - Runtime Tool Control Plane](phases/01-runtime-tool-control-plane.md)
2. [Phase 02 - Provider Contract And Surface Inventory](phases/02-provider-contract-and-surface-inventory.md)
3. [Phase 03 - Provider Config Resolver And Catalog](phases/03-provider-config-resolver-and-catalog.md)
4. [Phase 04 - Shared Validation And Client Factories](phases/04-shared-validation-and-client-factories.md)
5. [Phase 05 - Install And Admin Provider UI](phases/05-install-and-admin-provider-ui.md)
6. [Phase 06 - Runtime Integration And Env Helper Pruning](phases/06-runtime-integration-and-env-helper-pruning.md)
7. [Phase 07 - Provider Capability Availability And Tool Pruning](phases/07-provider-capability-availability-and-tool-pruning.md)
8. [Phase 08 - Health Diagnostics Docs And Closeout](phases/08-health-diagnostics-docs-and-closeout.md)

## Phase 0: Baseline Evidence

Goal: lock current behavior and prove the drift before changing it.

Tasks:

- Record every production source that reads `ANTHROPIC_*`, `OPENAI_API_KEY`,
  or hard-coded model defaults.
- Record install/admin validation behavior and hard-coded model use.
- Record which OpenAI-backed capabilities are registered with and without
  `OPENAI_API_KEY`.
- Record current static tool config behavior, registry caching, and prompt-hint
  leakage risk.
- Record admin system page effective-config mismatch.

Exit criteria:

- A baseline inventory exists with code anchors and expected removal targets.

## Phase 1: Runtime Tool Control Plane

Goal: create the general runtime tool policy layer before provider-specific
tool pruning.

Tasks:

- Define effective tool policy order: catalog, install profile, static config,
  SQLite admin override, provider availability, role access, and request filter.
- Add DB-backed tool settings and an effective tool availability service.
- Add admin screen and admin-only conversational tool for toggling tools and
  bundles.
- Protect recovery/basic tools such as theme and runtime inspection tools.
- Make prompt-hint assembly consume effective availability, not the full static
  catalog.

Exit criteria:

- Admins can turn toggleable tools on/off at runtime, and the model manifest
  and role prompt hints agree about which tools are available.

## Phase 2: Provider Contract And Surface Inventory

Goal: assign one responsibility to every provider/config surface.

Tasks:

- Define intelligence provider and capability provider contracts.
- Map provider dependencies onto the general tool availability contract.
- Map install, admin, chat, summarization, blog, media, web-search, MCP, and
  health surfaces.
- Decide which surfaces are in scope for first implementation.

Exit criteria:

- No new config, validation, or registry path is introduced without an assigned
  owner.

## Phase 3: Provider Config Resolver And Catalog

Goal: create one source of effective provider truth.

Tasks:

- Add provider catalog and type definitions.
- Add env-then-SQLite resolver with source reporting.
- Add backward-compatible helper wrappers.
- Add tests for env override, SQLite fallback, defaults, aliases, and DeepSeek
  fallback separation.

Exit criteria:

- Runtime can resolve Anthropic or DeepSeek config without reading raw env in
  callers.

## Phase 4: Shared Validation And Client Factories

Goal: remove duplicated install/admin SDK validation.

Tasks:

- Add provider client factory for Anthropic-compatible providers and OpenAI.
- Add validation service for intelligence and optional OpenAI key validation.
- Replace install/admin validation route internals with shared service calls.
- Remove hard-coded deprecated model validation.
- Preserve the current install/admin request shapes until Phase 5 updates UI.
- Treat chat/blog/summarization runtime migration as a Phase 6 consumer of the
  new factory, not as Phase 4 scope.

Exit criteria:

- Install/admin validate the selected provider/model pair.
- No production code uses `claude-3-haiku-20240307`.
- DeepSeek validation uses the Anthropic-compatible base URL.

## Phase 5: Install And Admin Provider UI

Goal: expose provider choices clearly to operators.

Status: complete as of 2026-05-02.

Tasks:

- Update install provider step with intelligence provider, model, key, base URL,
  and optional OpenAI capability key.
- Update admin settings to show and update effective provider config.
- Add provider-backed capability toggles for image, TTS, STT, and web search.
- Persist provider-backed capability toggles so the Phase 7 runtime tool
  control plane can consume them.
- Preserve existing keys when fields are left blank.
- Fix install readiness so the selected intelligence provider, including
  DeepSeek, defines initialized state.
- Stop provider settings UI from reading raw provider env values.

Exit criteria:

- A non-env SQLite-backed install can configure and later edit provider settings
  through UI.
- DeepSeek-only install can complete and be treated as initialized.
- Admin provider settings show source/configured state without exposing raw
  secrets.

Closeout evidence:

- Provider settings service, install/admin routes, install wizard, admin
  provider UI, and selected-provider initialization are implemented.
- Focused Phase 05 tests passed: 7 files, 38 tests.
- Typecheck and focused ESLint passed.
- Scoped source cleanup found no raw provider env reads in install/admin
  provider UI/routes.

## Phase 6: Runtime Integration And Env Helper Pruning

Goal: make runtime paths consume effective config.

Status: complete as of 2026-05-02.

Tasks:

- Update chat stream, direct chat, summarization, and blog production roots.
- Update provider policy to consume resolved model candidates.
- Update health/admin diagnostics.
- Keep compatibility wrappers only where migration is incomplete.

Exit criteria:

- Core chat works from SQLite-stored provider config with no env API key.
- Direct chat, summarization, and blog article production use selected provider
  config.
- DeepSeek fallback policy contains no Claude model names.
- Runtime intelligence paths no longer import Anthropic env helper wrappers.
- Health readiness and admin process diagnostics no longer report
  Anthropic-only intelligence provider state.

## Phase 7: Provider Capability Availability And Tool Pruning

Goal: feed provider-backed capability availability into the general runtime tool
control plane.

Status: complete as of 2026-05-02.

Tasks:

- Add provider capability availability service.
- Project OpenAI-backed availability into the tool policy layer when disabled
  or missing config.
- Guard direct routes and deferred job handlers with clear disabled/missing-key
  errors.
- Keep existing assets reusable after generation is disabled.

Exit criteria:

- Missing `OPENAI_API_KEY` means `generate_audio`, `generate_blog_image`, and
  `admin_web_search` are unavailable in prompt/tool manifests unless explicitly
  configured with a working provider.

## Phase 8: Health, Diagnostics, Docs, And Closeout

Goal: make provider and tool state visible and prune obsolete paths.

Status: complete as of 2026-05-02.

Tasks:

- Update admin system page and readiness probes.
- Update admin tool settings diagnostics.
- Update README/compose/install docs.
- Remove duplicated validation helpers, stale env-only diagnostics, and
  static-only tool diagnostics.
- Record validation evidence.

Exit criteria:

- Provider and tool state are visible, test-backed, documented, and not split
  across hidden env-only/static-only paths.

Closeout evidence:

- Provider diagnostics now compose selected intelligence provider state,
  optional capability provider state, and effective tool policy state.
- Admin system and tool settings pages now show effective provider/capability
  state instead of stale env-only/OpenAI-only diagnostics.
- Health readiness distinguishes required intelligence readiness from optional
  capability degradation.
- README, Compose, `.env.example`, and package docs explain `AI_PROVIDER`,
  Anthropic, DeepSeek, optional OpenAI capability slots, and tool policy layers.
