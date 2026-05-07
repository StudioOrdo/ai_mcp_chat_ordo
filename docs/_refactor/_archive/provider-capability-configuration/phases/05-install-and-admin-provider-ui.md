# Phase 05 - Install And Admin Provider UI

Status: complete as of 2026-05-02.

## Goal

Expose provider and optional capability configuration through install and admin
UI while keeping all persistence, validation, and source reporting grounded in
the provider services added in Phases 03 and 04.

Phase 05 must replace the Anthropic-key-only operator experience with an
explicit provider settings surface. It must also fix install readiness so a
DeepSeek-only workspace can complete setup. It must not migrate runtime chat,
summarization, or blog production to the selected provider; that is Phase 06.
It must not implement provider-backed tool pruning or direct route/job disabled
guards; that is Phase 07.

## Current-Code Grounding

Phase 03 added effective provider resolution and redaction:

- `src/lib/ai/providers/provider-catalog.ts`
- `src/lib/ai/providers/provider-config-service.ts`
- `src/lib/ai/providers/provider-redaction.ts`

Phase 04 added reusable provider validation:

- `src/lib/ai/providers/provider-client-factory.ts`
- `src/lib/ai/providers/provider-validation-service.ts`

Current install/admin UI is still legacy Anthropic/OpenAI key-only:

- `src/app/install/InstallWizard.tsx`
  - stores `anthropicKey` and `openAiKey` as the only provider state.
  - says Anthropic is required as the primary intelligence engine.
  - posts `{ anthropicKey, openAiKey }` to
    `/api/install/validate-keys`.
  - posts `{ anthropicKey, openAiKey, adminEmail, adminPassword }` to
    `/api/install/setup`.
- `src/app/api/install/validate-keys/route.ts`
  - still accepts only the legacy key body.
  - validates Anthropic through `ProviderValidationService`, using the
    resolved Anthropic model/base URL.
  - does not validate DeepSeek yet.
- `src/app/api/install/setup/route.ts`
  - persists only `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.
  - does not persist `AI_PROVIDER`, model, base URL, or capability provider
    settings.
  - does not revalidate full provider settings before persistence.
- `src/app/admin/system/keys/KeysManager.tsx`
  - only rotates Anthropic/OpenAI keys.
  - has no provider/model/base URL controls.
  - has no optional capability provider controls.
- `src/app/admin/system/keys/page.tsx`
  - determines configured state from raw `process.env`, not
    `ProviderConfigService`.
- `src/app/api/admin/system/keys/route.ts`
  - still accepts only `{ anthropicKey, openAiKey }`.
  - persists only `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.
- `src/app/admin/system/page.tsx`
  - still displays raw env-oriented runtime config and hard-coded Anthropic
    model policy. Full health/admin diagnostics cleanup remains Phase 08, but
    Phase 05 should stop adding new raw-env provider UI.

Current initialization is provider-specific in the wrong layer:

- `src/lib/config/ConfigurationService.ts`
  - `isSystemInitialized()` returns true only when `ANTHROPIC_API_KEY` is
    configured.
- `src/app/install/page.tsx`, `src/app/api/install/validate-keys/route.ts`,
  `src/app/api/install/setup/route.ts`, and `src/app/welcome/page.tsx` depend
  on that check.

If Phase 05 allows `AI_PROVIDER=deepseek` without an Anthropic key, this must
be fixed in Phase 05 or installation will not be correct.

The general runtime tool settings screen already exists from Phase 01:

- `src/app/admin/system/tools/ToolsManager.tsx`
- `src/app/api/admin/system/tools/route.ts`
- `src/lib/tools/tool-settings-service.ts`
- `src/lib/tools/tool-availability-service.ts`

Phase 05 must not duplicate that general tool toggle surface. Capability
provider settings are provider config; per-tool toggles remain tool settings.

## Target Modules

Add an application service for provider settings:

- `src/lib/ai/providers/provider-settings-service.ts`

Allowed route/UI updates:

- `src/app/install/InstallWizard.tsx`
- `src/app/api/install/validate-keys/route.ts`
- `src/app/api/install/setup/route.ts`
- `src/app/admin/system/keys/KeysManager.tsx`
- `src/app/admin/system/keys/page.tsx`
- `src/app/api/admin/system/keys/route.ts`
- `src/lib/config/ConfigurationService.ts`
- `src/lib/config/ConfigurationService.test.ts`

Optional small UI extraction is allowed if it prevents duplication:

- `src/app/admin/system/keys/ProviderSettingsForm.tsx`
- `src/app/install/ProviderSetupForm.tsx`

Do not add another configuration store. Use `ConfigurationService.setString()`
for persistence and `ProviderConfigService` for read/source truth.

## Provider Settings Service Contract

`ProviderSettingsService` is the application service/facade for install/admin
provider settings.

Responsibilities:

- Build redacted provider settings DTOs for admin UI and optional install
  defaults.
- Overlay submitted values onto resolved config before validation.
- Validate selected intelligence provider through
  `ProviderValidationService`.
- Validate OpenAI only when submitted or required by an enabled OpenAI-backed
  capability.
- Persist `AI_PROVIDER`, provider key, model, base URL, optional OpenAI key,
  and capability provider/model settings.
- Clear SQLite-backed optional model/base URL settings when the submitted value
  is intentionally blank and the field is not env-locked.
- Preserve key rotation semantics: blank key fields mean keep existing key.
- Support model-only and base-URL-only updates without key rotation by using
  the currently resolved provider key for validation.
- Report source and configured/missing status without exposing raw secrets.
- Respect env precedence by treating env-sourced fields as operator locked in
  the DTO.

Non-responsibilities:

- It does not execute chat, summarization, article production, image
  generation, TTS, STT, or web search.
- It does not prune tools from the model manifest.
- It does not replace `ToolSettingsService`.

Suggested route DTO:

```ts
interface ProviderSettingsUpdateInput {
  intelligence: {
    provider: "anthropic" | "deepseek";
    apiKey?: string;
    model: string;
    baseUrl?: string | null;
  };
  openAiKey?: string;
  capabilities: {
    image: { provider: "disabled" | "openai"; model?: string | null };
    tts: { provider: "disabled" | "openai"; model?: string | null };
    stt: { provider: "disabled" | "local_whisper" | "openai"; model?: string | null };
    web_search: { provider: "disabled" | "openai"; model?: string | null };
  };
}
```

The exact API shape can differ, but the implementation must use typed request
parsing instead of ad hoc unchecked objects.

## Install Contract

Install provider step must collect:

- Intelligence provider: `anthropic` or `deepseek`.
- Provider API key.
- Model select plus manual model entry.
- Advanced base URL field.
- Optional OpenAI key clearly labeled as powering optional image/audio/search
  capabilities, not chat.
- Capability provider toggles:
  - image: `disabled` or `openai`
  - TTS: `disabled` or `openai`
  - STT: `disabled`, `local_whisper`, or `openai`
  - web search: `disabled` or `openai`

Install may use static catalog defaults for the first render. It does not need
to fetch a redacted provider snapshot before any settings exist.

Install validation behavior:

- `/api/install/validate-keys` must accept the new provider settings payload.
- The route may keep legacy `{ anthropicKey, openAiKey }` compatibility while
  the UI is being replaced, but the new UI must use the new payload.
- It validates the selected intelligence provider/model/base URL/key pair.
- It validates OpenAI when an OpenAI key is submitted.
- It rejects OpenAI-backed capability selections when no OpenAI key is
  submitted or already configured.
- It does not require OpenAI for core chat readiness.

Install setup behavior:

- `/api/install/setup` must accept the same provider settings plus admin
  identity.
- It must revalidate provider settings before persistence so setup cannot be
  bypassed by skipping the validation step.
- It persists all effective install provider settings to SQLite:
  - `AI_PROVIDER`
  - selected provider API key (`ANTHROPIC_API_KEY` or `DEEPSEEK_API_KEY`)
  - selected provider model (`ANTHROPIC_MODEL` or `DEEPSEEK_MODEL`)
  - selected provider base URL (`ANTHROPIC_BASE_URL` or `DEEPSEEK_BASE_URL`)
  - `OPENAI_API_KEY` when supplied
  - `IMAGE_PROVIDER`, `IMAGE_MODEL`
  - `TTS_PROVIDER`, `TTS_MODEL`
  - `STT_PROVIDER`, `STT_MODEL`
  - `WEB_SEARCH_PROVIDER`, `WEB_SEARCH_MODEL`
- It preserves generated admin/session/lifecycle behavior already in the route.

Initialization behavior:

- `ConfigurationService.isSystemInitialized()` must become selected-provider
  aware. A workspace is initialized when the selected intelligence provider has
  a configured key.
- If `AI_PROVIDER` is absent, the existing Anthropic behavior remains
  backward-compatible.
- DeepSeek-only install must make `/install` redirect away after setup and
  `/welcome` treat the system as installed.

## Admin Provider Settings Contract

Admin provider settings must replace the key-only UI with a provider settings
surface.

Required admin behavior:

- Server page loads effective redacted provider config from
  `ProviderConfigService.resolveRedactedProviderConfigSnapshot()`, not
  `process.env`.
- UI shows provider, model, base URL, key configured/missing, and source for
  the intelligence provider.
- UI shows capability providers, models, required key configured/missing, and
  source for image, TTS, STT, and web search.
- UI labels OpenAI as optional capabilities, not chat.
- Admin can rotate a key without changing model/base URL.
- Admin can update provider/model/base URL without rotating a key.
- Admin can enable/disable optional capabilities.
- Admin can set STT to `local_whisper` without requiring OpenAI.
- Fields sourced from env are shown as operator locked. The UI must not imply a
  SQLite update will override an env value. Route-level behavior may either
  reject env-locked field updates with 409 or accept them with a warning that
  the effective value remains env-owned; choose one behavior and test it.
- Blank optional model/base URL fields mean clear the SQLite override when the
  field is not env-locked. Blank secret fields mean keep the existing key.

Route behavior:

- `GET /api/admin/system/keys` returns a redacted provider settings DTO for UI
  refreshes.
- `POST /api/admin/system/keys` accepts provider settings updates.
- Legacy `{ anthropicKey, openAiKey }` key rotation can remain supported during
  migration, but the new UI should use the provider settings DTO.
- Non-admin access remains blocked by `requireAdminPageAccess`.
- Raw secrets are never returned.

## Capability Settings Boundary

Phase 05 persists capability provider choices. It does not prove final runtime
tool pruning.

Phase 05 should ensure:

- `ProviderConfigService.resolveCapabilityProviderConfig()` reflects admin and
  install changes.
- Admin UI can set a capability to `disabled`, `openai`, or `local_whisper`
  where supported.
- OpenAI-backed capability selections require a configured/submitted OpenAI key.
- The existing tool settings screen is not duplicated.

Phase 07 will ensure:

- Provider capability state feeds `ToolAvailabilityService`.
- Missing/disabled provider capabilities remove tools from prompt/tool
  manifests.
- Direct routes and deferred job handlers return disabled/missing-provider
  errors.

The current `ToolAvailabilityService` still gates tools mostly through required
provider keys. That is not enough for final provider toggles and should not be
claimed as complete in Phase 05.

## Clean Architecture

Use these boundaries:

- React components own presentation state only.
- Routes are controllers: parse, authorize, call service, map service result to
  HTTP.
- `ProviderSettingsService` owns validation orchestration and persistence.
- `ProviderValidationService` owns external API validation.
- `ProviderConfigService` owns effective read/source truth.
- `ConfigurationService` remains the low-level key/value persistence facade.

Design patterns that fit:

- Facade/Application Service for provider settings.
- Strategy for provider-specific validation and persistence keys.
- Adapter/DTO mapping from redacted provider config to UI state.
- Command object for provider settings updates.

Avoid:

- Reading raw `process.env` in provider settings UI.
- Duplicating validation logic in React or routes.
- Persisting secrets into UI state after successful save.
- Building provider-specific tool pruning before Phase 07.
- Rewriting runtime chat/blog provider callers before Phase 06.

## Prune Targets

Remove or replace during Phase 05:

- `src/app/install/InstallWizard.tsx` Anthropic-required copy and state shape.
- `src/app/api/install/setup/route.ts` key-only persistence.
- `src/app/admin/system/keys/KeysManager.tsx` key-only form.
- `src/app/admin/system/keys/page.tsx` raw `process.env` configured checks.
- `ConfigurationService.isSystemInitialized()` Anthropic-only readiness.
- Route-local unchecked provider request parsing in install/admin provider
  routes.

Leave for later phases:

- Runtime chat/direct/summarization/blog integration with selected provider:
  Phase 06.
- Provider-backed tool pruning and direct route/job guards: Phase 07.
- Full admin system diagnostics cleanup in `src/app/admin/system/page.tsx`:
  Phase 08, except do not add new raw-env provider UI in Phase 05.

## Implementation Steps

1. Add provider settings request/response types and parser helpers.
2. Add `ProviderSettingsService` for DTO creation, validation orchestration,
   env-lock reporting, and persistence.
3. Update `ConfigurationService.isSystemInitialized()` and tests to be
   selected-provider aware.
4. Expand `/api/install/validate-keys` to validate the new payload while
   preserving legacy compatibility if useful.
5. Expand `/api/install/setup` to revalidate and persist the full provider
   settings payload before creating the admin user/session.
6. Replace install provider step UI with provider/model/base URL/OpenAI
   optional capability controls.
7. Add `GET` and expanded `POST` behavior to `/api/admin/system/keys`.
8. Replace admin key manager UI with provider settings UI sourced from the
   redacted snapshot.
9. Add focused unit/route/component tests.
10. Run focused provider/install/admin validation, typecheck, lint, and source
    cleanup checks.

## Tests

Add or update focused tests for:

- `src/lib/ai/providers/provider-settings-service.test.ts`
  - Builds redacted admin DTO without raw secrets.
  - Validates selected Anthropic settings using submitted key.
  - Validates selected DeepSeek settings using submitted key/model/base URL.
  - Supports model-only update with existing resolved key.
  - Supports key-only update preserving current model/base URL.
  - Rejects OpenAI-backed capability selection when no OpenAI key exists.
  - Allows OpenAI-backed capability selection when OpenAI key is submitted or
    configured.
  - Allows STT `local_whisper` without OpenAI key.
  - Persists only relevant provider keys and settings.
  - Clears SQLite optional model/base URL overrides when submitted blank and
    not env-locked.
  - Reports env-sourced fields as operator locked.
- `src/lib/config/ConfigurationService.test.ts`
  - Anthropic default initialization remains backward-compatible.
  - DeepSeek selected provider initializes when `DEEPSEEK_API_KEY` exists.
  - Missing selected provider key returns not initialized.
- Install route tests:
  - New payload validates Anthropic.
  - New payload validates DeepSeek.
  - OpenAI is optional when all OpenAI-backed capabilities are disabled.
  - OpenAI-backed capability without key is rejected.
  - Setup persists provider/model/base URL/capability settings.
  - Setup revalidates provider settings before persistence.
  - Install cannot run after initialization.
- Admin route tests:
  - `GET` returns redacted effective config.
  - Admin can update model without key rotation.
  - Admin can rotate key without changing model.
  - Admin can switch provider with key/model/base URL.
  - Admin can disable optional capabilities.
  - Non-admin cannot update provider settings.
  - Raw secrets are never returned.
- UI tests where local patterns make them practical:
  - Install wizard labels OpenAI as optional capability provider.
  - Install wizard can submit DeepSeek settings.
  - Admin provider form shows source/configured status.
  - Env-sourced fields render as locked.

Validation command set:

```bash
npm run test -- src/lib/ai/providers/provider-settings-service.test.ts src/lib/config/ConfigurationService.test.ts src/app/api/install/validate-keys/route.test.ts src/app/api/install/setup/route.test.ts src/app/api/admin/system/keys/route.test.ts
npm run typecheck
npx eslint src/lib/ai/providers/provider-settings-service.ts src/app/install/InstallWizard.tsx src/app/api/install/validate-keys/route.ts src/app/api/install/setup/route.ts src/app/admin/system/keys/KeysManager.tsx src/app/admin/system/keys/page.tsx src/app/api/admin/system/keys/route.ts src/lib/config/ConfigurationService.ts
rg -n "process\\.env\\.(ANTHROPIC|OPENAI|DEEPSEEK|AI_PROVIDER|IMAGE_PROVIDER|TTS_PROVIDER|STT_PROVIDER|WEB_SEARCH_PROVIDER)" src/app/admin/system/keys src/app/install src/app/api/install src/app/api/admin/system/keys
```

The final `rg` command should return no provider UI/route raw-env reads.

## Implementation Evidence

Implemented production changes:

- Added `src/lib/ai/providers/provider-settings-service.ts` as the application
  service for provider settings DTOs, typed request parsing, validation
  orchestration, env locks, redacted source reporting, and SQLite persistence.
- Updated `src/lib/config/ConfigurationService.ts` so initialization follows
  the selected intelligence provider key instead of hard-coding Anthropic.
- Updated install validation and setup routes to accept the provider settings
  payload, preserve legacy key payload compatibility, and revalidate before
  setup persistence.
- Updated the install wizard to collect intelligence provider, provider key,
  model, base URL, optional OpenAI key, and capability provider choices.
- Updated the admin provider settings API with redacted `GET` and expanded
  `POST` behavior.
- Replaced the admin key-only form with a provider settings UI sourced from the
  provider config DTO instead of raw env reads.
- Phase 05 QA found and fixed one admin UI contract gap: capability rows now
  show provider source, model source, and required-key status/source.

Focused test evidence:

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

## Done

- [x] Install can choose and persist Anthropic or DeepSeek provider settings.
- [x] Install can persist provider model and base URL.
- [x] Install setup revalidates provider settings before persistence.
- [x] DeepSeek-only install counts as initialized.
- [x] Admin settings read effective config from `ProviderConfigService`, not raw
      env.
- [x] Admin can update model/base URL without key rotation.
- [x] Admin can rotate key without changing model/base URL.
- [x] Admin can switch intelligence provider.
- [x] Admin can enable/disable optional capability providers.
- [x] OpenAI is labeled as optional capability provider, not chat.
- [x] Env-sourced provider fields are shown as operator locked.
- [x] Raw secrets are never returned to install/admin UI.
- [x] Phase 05 does not claim runtime chat migration or provider-backed tool
      pruning as complete.
