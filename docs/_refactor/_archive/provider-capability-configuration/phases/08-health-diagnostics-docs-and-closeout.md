# Phase 08 - Health Diagnostics Docs And Closeout

Status: implemented and QA-verified as of 2026-05-02.

## QA Certification

QA status: implementation verified as of 2026-05-02.

Code-grounded checks performed:

- Verified pre-implementation stale admin display paths in
  `src/app/admin/system/page.tsx`: raw `ANTHROPIC_MODEL`/`OPENAI_API_KEY` rows,
  hardcoded `Anthropic`, and the OpenAI-only feature integration card.
- Verified pre-implementation OpenAI-only admin diagnostics in
  `src/lib/admin/processes.ts`: `getOpenAiFeatureDiagnostics()` and
  `integrations.openai`.
- Verified pre-implementation `src/lib/health/probes.ts` already checked
  selected intelligence provider readiness but did not expose optional
  capability status.
- Verified `src/lib/tools/tool-policy-types.ts` state names so Phase-08
  diagnostics use actual manifest states such as `missing_provider_key` and
  `provider_disabled`.
- Verified `.env.example` exists and still documents Anthropic-only defaults,
  so it is a required docs target.
- Verified diagnostics must support sync callers because
  `getDiagnosticsReport()` and `getReadinessProbe()` are currently synchronous.

QA corrections applied:

- Added explicit async and sync diagnostics contracts:
  `getProviderDiagnosticsReport()` and `getProviderDiagnosticsReportSync()`.
- Replaced vague tool summary fields with state names aligned to
  `ToolAvailabilityState`.
- Made `.env.example` a required update target.
- Removed optional/vague wording around the capability providers card and tool
  summary UI.
- Added tests proving sync diagnostics match the async diagnostics shape.

Implementation closeout evidence:

- Added `src/lib/ai/providers/provider-diagnostics.ts` as the redaction-safe
  diagnostics read model for selected intelligence provider state, capability
  provider state, and effective tool policy state.
- Updated `src/lib/admin/processes.ts` so diagnostics use
  `providerDiagnostics` and no longer expose OpenAI-only `integrations.openai`.
- Updated `src/lib/health/probes.ts` so readiness reports selected
  intelligence provider readiness plus optional capability provider degradation.
- Updated `src/app/admin/system/page.tsx` so it shows effective provider
  configuration and capability providers instead of raw env-only provider rows
  and hardcoded Anthropic/OpenAI-only diagnostics.
- Updated `src/app/admin/system/tools/ToolsManager.tsx` so tool settings show
  effective state summaries for enabled, provider-disabled, missing-key,
  admin-disabled, static-disabled, and install-profile-disabled tools.
- Removed stale `providerKey` metadata from the tool availability manifest.
- Updated `README.md`, `compose.yaml`, `.env.example`,
  `docs/_review/system-priorities-2026-05-01.md`,
  `docs/_refactor/provider-capability-configuration/README.md`, and
  `docs/_refactor/provider-capability-configuration/phase-plan.md`.

Validation:

- `npm run test -- src/lib/ai/providers/provider-diagnostics.test.ts tests/admin-processes.test.ts src/lib/admin/processes.test.ts tests/health-probes.test.ts src/lib/health/probes.test.ts tests/jobs-system-dashboard.test.ts src/lib/tools/tool-availability-service.test.ts src/app/admin/system/keys/KeysManager.test.tsx`
  passed: 8 files, 61 tests.
- `npm run typecheck` passed.
- `npx eslint src/lib/ai/providers/provider-diagnostics.ts src/lib/admin/processes.ts src/lib/health/probes.ts src/app/admin/system/page.tsx src/app/admin/system/tools/ToolsManager.tsx`
  passed with no reported issues.
- Cleanup search for stale admin/health OpenAI-only or raw env diagnostics
  returned no matches.
- Cleanup search for old key-only tool policy metadata in the tool control
  plane returned no matches.

Residual risks:

- `STT_PROVIDER=local_whisper` is still configuration-only until a speech worker
  is implemented.
- Anthropic-named adapter classes remain where the name describes the SDK
  message schema rather than the selected provider; renaming those is outside
  Phase 08.

## Goal

Make the completed provider/capability/tool configuration system visible,
diagnostic, documented, and pruned of obsolete env-only or OpenAI-only paths.

Phase 08 is the closeout phase for the provider-capability configuration
package. It must make the operator-facing system page, tool diagnostics, health
checks, install/runtime docs, and validation evidence agree with the architecture
implemented in Phases 01-07:

- Intelligence provider config drives chat, direct turns, summarization, and
  blog article text production.
- Optional capability provider config drives image generation, TTS, STT, and
  web search availability.
- Tool availability is the effective result of catalog defaults, install
  profile, static config, SQLite admin settings, provider capability state,
  protected-tool rules, role policy, and request filters.

## Non-Goals

- Do not add another provider runtime.
- Do not implement local Whisper/STT execution in this phase.
- Do not remove OpenAI support.
- Do not remove legacy helper wrappers that still have compatibility tests
  unless every caller and test in scope has already moved.
- Do not make optional capability degradation fail core liveness.
- Do not redesign the whole admin shell.

## Current-Code Grounding

Phase 08 starts from these implemented foundations:

- `src/lib/ai/providers/provider-catalog.ts`
  - defines `AI_PROVIDER=anthropic|deepseek`.
  - defines capability slots `image`, `tts`, `stt`, and `web_search`.
  - treats OpenAI as an optional capability provider, not chat provider.
- `src/lib/ai/providers/provider-config-service.ts`
  - resolves provider settings from env first, then SQLite, then defaults.
  - exposes source reporting and redacted snapshots through
    `resolveRedactedProviderConfigSnapshot()`.
- `src/lib/ai/providers/provider-settings-service.ts`
  - owns install/admin provider settings DTOs, source locking, validation, and
    persistence.
- `src/lib/ai/providers/provider-capability-availability.ts`
  - resolves capability slot state as `available`, `disabled`, `missing_key`,
    or `unsupported`.
- `src/lib/tools/tool-provider-capability-policy.ts`
  - maps provider-backed tools to capability slots.
  - owns shared provider-capability execution guards.
- `src/lib/tools/tool-availability-service.ts`
  - projects provider capability state into effective tool availability.
  - exposes `providerCapabilitySlot`, `providerCapabilityState`, and
    `providerCapabilityProvider` in the manifest.
- `src/app/admin/system/keys/KeysManager.tsx`
  - exposes provider and capability configuration in the admin UI.
- `src/app/admin/system/tools/ToolsManager.tsx`
  - displays row-level provider capability labels from the effective manifest.

Pre-implementation gaps resolved by Phase 08:

- `src/app/admin/system/page.tsx`
  - rendered a raw env-style "Runtime configuration" table with
    `ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY`, and `OPENAI_API_KEY`.
  - hardcoded the model policy provider as `Anthropic`.
  - fell back to `claude-sonnet-4-20250514` directly.
  - rendered a "Feature integrations" card sourced from OpenAI-only diagnostics.
- `src/lib/admin/processes.ts`
  - exported `getOpenAiFeatureDiagnostics()`.
  - returned `integrations.openai` instead of capability-slot diagnostics.
  - imported `getOpenaiApiKey()` only to build admin diagnostics.
- `src/lib/health/probes.ts`
  - validated selected intelligence provider readiness, which was correct.
  - did not expose optional capability status, so operators could not distinguish
    core readiness from disabled/missing optional capability providers.
- `src/lib/operator/loaders/admin-health-loaders.ts`
  - consumed `getDiagnosticsReport()` and health sweeps, so its warning model
    had to remain compatible when diagnostics moved from OpenAI-only integration
    state to provider/capability state.
- `tests/jobs-system-dashboard.test.ts`
  - asserted the old "Runtime configuration" and "Model policy"
    section names.
- `tests/admin-processes.test.ts`, `src/lib/admin/processes.test.ts`, and
  `tests/health-probes.test.ts`
  - already proved selected intelligence-provider behavior, but did not prove
    optional capability degradation reporting.
- `README.md`
  - presented `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` as the required
    normal chat setup.
  - mentioned optional OpenAI but did not document `AI_PROVIDER`, DeepSeek, or
    capability provider slots clearly.
- `compose.yaml`
  - defaulted `ANTHROPIC_MODEL` directly and did not surface
    `AI_PROVIDER`, `DEEPSEEK_*`, or capability slot env keys.

## Target Architecture

Add one redaction-safe diagnostics read model that composes the provider,
capability, and tool policy services for admin, health, and tests.

Recommended module:

- `src/lib/ai/providers/provider-diagnostics.ts`

Recommended responsibilities:

- Use `ProviderConfigService.resolveRedactedProviderConfigSnapshot()` for
  selected intelligence provider and source/configured metadata.
- Use `ProviderCapabilityAvailabilityService` for slot availability.
- Use `ToolAvailabilityService.getEffectiveManifestFromSettings()` for RSC/API
  callers that can await SQLite-backed tool settings.
- Use `ToolAvailabilityService.getEffectiveManifestSync()` for existing sync
  diagnostics/health callers that cannot become async without changing route
  contracts.
- Use `getToolProviderCapabilityRequirement()` from
  `src/lib/tools/tool-provider-capability-policy.ts` to associate impacted
  tools with capability slots.
- Return a redaction-safe read model that can be consumed by RSC pages, admin
  loaders, health probes, CLI diagnostics, and tests without exposing secrets.

Recommended shape:

```ts
interface ProviderDiagnosticsReport {
  intelligence: {
    provider: string;
    providerSource: string;
    model: string;
    modelSource: string;
    apiKeyConfigured: boolean;
    apiKeySource: string;
    baseUrlConfigured: boolean;
    baseUrlSource: string;
    warningCodes: string[];
  };
  capabilities: Array<{
    slot: "image" | "tts" | "stt" | "web_search";
    provider: string;
    state: "available" | "disabled" | "missing_key" | "unsupported";
    reason: string;
    model: string | null;
    requiredKeyConfigured: boolean | null;
    requiredKeySource: string | null;
    impactedTools: string[];
  }>;
  toolSummary: {
    total: number;
    byState: Partial<Record<
      | "enabled"
      | "disabled_by_install_profile"
      | "disabled_by_static_config"
      | "disabled_by_admin"
      | "missing_provider_key"
      | "provider_disabled"
      | "role_denied"
      | "request_filtered"
      | "system_reserved"
      | "unknown_tool",
      number
    >>;
    protectedCount: number;
    staticLockedCount: number;
    providerGatedCount: number;
    warnings: number;
  };
}
```

The implementation may add fields, but it must keep the responsibility boundary
intact: provider diagnostics is a facade/read model over existing services, not a
new source of truth.

Design patterns and clean-architecture boundaries:

- Facade/Application Service:
  - provider diagnostics composes provider config, capability availability, and
    tool availability.
- Adapter:
  - admin pages, health probes, and CLI diagnostics adapt the read model into
    their own display/transport shape.
- Strategy:
  - provider/capability decisions remain catalog-driven through
    `provider-catalog.ts` and `tool-provider-capability-policy.ts`.
- Presenter/View Model:
  - React pages should format labels and layout, but should not decide provider
    readiness policy.
- Single Responsibility:
  - `ProviderConfigService` resolves config.
  - `ProviderCapabilityAvailabilityService` resolves capability state.
  - `ToolAvailabilityService` resolves tool state.
  - diagnostics composes and summarizes those states.

## Implementation Plan

### 1. Add Provider Diagnostics Read Model

Create `src/lib/ai/providers/provider-diagnostics.ts`.

It should expose:

- `getProviderDiagnosticsReport()`
- `getProviderDiagnosticsReportSync()`
- `summarizeProviderDiagnostics(report)`
- Types for the report.

Rules:

- Do not call remote providers.
- Do not construct SDK clients.
- Do not read raw `process.env` directly.
- Do not include full secret values.
- Preserve source reporting: `env`, `sqlite`, `default`, or `missing`.
- Include impacted provider-backed tools per capability slot.
- Keep async and sync report shapes identical so admin pages, admin process
  diagnostics, health probes, and tests do not drift.

### 2. Update Admin System Page

Modify `src/app/admin/system/page.tsx` so the main system page reports effective
provider/capability/tool state instead of raw env fragments.

Required changes:

- Replace "Runtime configuration" env key table with an effective provider
  configuration card.
- Replace hardcoded "Model policy" provider text with selected intelligence
  provider, model, key configured/source, base URL configured/source, and
  warning codes.
- Replace OpenAI-only "Feature integrations" with a card titled
  "Capability providers".
- Show each slot: provider, state, model, required key state/source, and
  impacted tools.
- Keep the existing health, referral diagnostics, registered tools, active
  workers, and Manage Tools link.
- Add links to `/admin/system/keys` and `/admin/system/tools`.
- Remove local `redactValue()` if no raw env table remains.

The admin page must not claim OpenAI is chat. It should explicitly present
OpenAI only as an optional capability provider when selected.

### 3. Update Admin Tool Settings Diagnostics

Improve `src/app/admin/system/tools/ToolsManager.tsx` without changing the tool
policy source of truth.

Required behavior:

- Keep row-level tool state/reason labels.
- Add a top-level summary by state using the manifest received from the API or
  derived client-side from `manifest.tools`.
- Make provider-disabled and provider-missing-key states obvious in the summary.
- Keep protected and static-locked tools visibly distinct.
- Keep normal admin toggles blocked for protected/static-locked tools.

Required UI states:

- Show summary chips or counters for `enabled`, `provider_disabled`,
  `missing_provider_key`, `disabled_by_admin`, `disabled_by_static_config`, and
  `disabled_by_install_profile`.
- Do not add filters unless they can reuse the same manifest state strings
  without creating a separate client-side policy vocabulary.

### 4. Update Admin Process Diagnostics

Modify `src/lib/admin/processes.ts`.

Required changes:

- Remove `getOpenAiFeatureDiagnostics()` or stop exporting/using it.
- Remove `integrations.openai` from the primary diagnostics report.
- Add `providerDiagnostics` from the new diagnostics read model.
- Keep existing release manifest, runtime audit, referral, metrics, and health
  sweep behavior intact.
- Keep `getEnvValidationReport()` focused on required intelligence-provider
  readiness through `validateRequiredRuntimeConfig()`.

Compatibility:

- If any test or loader still needs `diagnostics.intelligenceProvider`, keep it
  as a thin alias to `providerDiagnostics.intelligence` for one phase.
- Do not keep duplicate OpenAI-only integration state.
- Keep `getDiagnosticsReport()` sync by using `getProviderDiagnosticsReportSync()`
  unless every caller is migrated in the same phase.

### 5. Update Health And Readiness Diagnostics

Modify `src/lib/health/probes.ts`.

Required behavior:

- Liveness stays process-local and should not depend on remote provider keys.
- Readiness fails when the selected intelligence provider lacks required key or
  model.
- Optional capability states are exposed as details/warnings/degraded metadata
  but do not fail core readiness merely because a slot is disabled or missing a
  key.
- Health output must make this distinction explicit:
  - required intelligence readiness
  - optional capability status

The exact shape can extend `ProbeResult`, but existing callers must remain
compatible or be updated in the same phase.

### 6. Update Docs And Compose Notes

Update operator-facing docs so they match actual behavior.

Required files:

- `README.md`
- `compose.yaml`
- `.env.example`
- `docs/_review/system-priorities-2026-05-01.md`, only to mark the provider
  configuration priority as implemented/closed if the update stays concise
- `docs/_refactor/provider-capability-configuration/README.md`
- `docs/_refactor/provider-capability-configuration/phase-plan.md`

Required documentation points:

- `AI_PROVIDER=anthropic|deepseek` selects the chat/intelligence provider.
- Anthropic settings:
  - `ANTHROPIC_API_KEY`
  - `ANTHROPIC_MODEL`
  - `ANTHROPIC_BASE_URL` if explicitly used
- DeepSeek settings:
  - `DEEPSEEK_API_KEY`
  - `DEEPSEEK_MODEL`
  - `DEEPSEEK_BASE_URL`
- OpenAI is optional and powers selected capability slots, not chat.
- Capability slots:
  - `IMAGE_PROVIDER=disabled|openai`
  - `TTS_PROVIDER=disabled|openai`
  - `STT_PROVIDER=disabled|local_whisper|openai`
  - `WEB_SEARCH_PROVIDER=disabled|openai`
  - slot model keys: `IMAGE_MODEL`, `TTS_MODEL`, `STT_MODEL`,
    `WEB_SEARCH_MODEL`
- A missing `OPENAI_API_KEY` should be documented as a valid install for
  chat-only operation.
- `local_whisper` is a configuration contract for future/local STT support;
  Phase 08 does not implement a speech worker.
- Tool policy layers:
  - protected tools
  - install/default profile
  - static `config/tools.json`
  - SQLite admin runtime toggles
  - provider capability gates
  - role and request filters

Compose should not force a Claude model default in a way that contradicts the
provider catalog. Prefer documenting optional env overrides and first-run UI
configuration over requiring env keys for normal install.

### 7. Prune Obsolete Paths

Remove or rewrite stale paths only after the replacement diagnostics are in
place.

Required cleanup targets:

- Raw env-only display in `src/app/admin/system/page.tsx`.
- Hardcoded `Provider: Anthropic` and direct `process.env.ANTHROPIC_MODEL`
  fallback in admin system page.
- OpenAI-only `Feature integrations` card.
- `getOpenAiFeatureDiagnostics()` and `integrations.openai` in
  `src/lib/admin/processes.ts`, unless a temporary compatibility alias is
  required and explicitly documented in tests.
- Static-only tool diagnostics that ignore SQLite/provider layers.
- Duplicate secret redaction helpers when `provider-redaction.ts` already owns
  redaction.

Do not remove:

- `getOpenaiApiKey()` compatibility helper.
- Anthropic-named adapter classes whose names reflect SDK message shape and are
  outside Phase 08 scope.
- Existing OpenAI-backed capability implementations.

## Test Plan

Focused tests to add or update:

- `src/lib/ai/providers/provider-diagnostics.test.ts`
  - reports selected intelligence provider without secrets.
  - reports capability slots and impacted provider-backed tools.
  - marks OpenAI-backed slots disabled when no OpenAI key exists.
  - marks explicit OpenAI slots as missing-key when selected without key.
- `tests/admin-processes.test.ts`
  - diagnostics report includes provider diagnostics.
  - diagnostics no longer exposes `integrations.openai`.
  - sync diagnostics include the same intelligence/capability/tool summary shape
    as the async diagnostics report.
- `src/lib/admin/processes.test.ts`
  - DeepSeek diagnostics still report selected provider/model/source.
- `tests/health-probes.test.ts`
  - readiness succeeds for selected provider with key/model.
  - readiness fails for missing selected provider key/model.
  - optional disabled/missing capability providers appear as details but do not
    fail readiness.
- `tests/jobs-system-dashboard.test.ts`
  - source-level page assertions are updated from old section names to the new
    provider/capability/tool diagnostics sections.
- `src/app/admin/system/keys/KeysManager.test.tsx`
  - only if doc/UI copy changes affect existing admin settings assertions.
- `src/lib/tools/tool-availability-service.test.ts`
  - only if summary behavior changes in the service rather than just UI.

## Validation Commands

Run at minimum:

```bash
npm run test -- \
  src/lib/ai/providers/provider-diagnostics.test.ts \
  tests/admin-processes.test.ts \
  src/lib/admin/processes.test.ts \
  tests/health-probes.test.ts \
  src/lib/health/probes.test.ts \
  tests/jobs-system-dashboard.test.ts \
  src/lib/tools/tool-availability-service.test.ts \
  src/app/admin/system/keys/KeysManager.test.tsx

npm run typecheck

npx eslint \
  src/lib/ai/providers/provider-diagnostics.ts \
  src/lib/admin/processes.ts \
  src/lib/health/probes.ts \
  src/app/admin/system/page.tsx \
  src/app/admin/system/tools/ToolsManager.tsx
```

Cleanup searches:

```bash
rg -n "getOpenAiFeatureDiagnostics|integrations\\.openai|OpenAI-backed audio|Provider[[:space:]]*</dt>|<dd>Anthropic</dd>|process\\.env\\.ANTHROPIC_MODEL|process\\.env\\.OPENAI_API_KEY" \
  src/app/admin/system src/lib/admin src/lib/health

rg -n "providerKey|providerKeys|getProviderKeyForTool" \
  src/lib/tools src/app/admin/system src/core/use-cases/tools/configure-tool-availability.tool.ts
```

Expected result:

- No stale admin/health OpenAI-only diagnostics remain.
- No raw env-only provider display remains in the admin system page.
- No removed key-only tool policy helpers return in the tool control plane.

## Done

- [x] Provider diagnostics read model exists and is redaction-safe.
- [x] Admin system page shows selected intelligence provider config and source.
- [x] Admin system page shows capability provider state and impacted tools.
- [x] Admin system page no longer shows stale env-only provider rows.
- [x] Admin system page no longer hardcodes Anthropic as provider.
- [x] Admin tool settings show effective state summaries and provider-capability
  reasons.
- [x] Health distinguishes required intelligence readiness from optional
  capability degradation.
- [x] Docs explain `AI_PROVIDER`, Anthropic, DeepSeek, and optional OpenAI
  capability providers.
- [x] Docs explain tool profiles, static overrides, admin runtime toggles,
  provider gates, role filters, request filters, and protected tools.
- [x] Compose/env docs no longer imply OpenAI is required for chat-only use.
- [x] Obsolete OpenAI-only admin diagnostics are removed.
- [x] Package closeout records validation commands and residual risks.
