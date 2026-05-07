# Phase 01 - Runtime Tool Control Plane

Status: complete as of 2026-05-02.

## Goal

Create the general runtime tool availability control plane before
provider-specific capability pruning is implemented.

Provider configuration should not become a one-off OpenAI or Anthropic switch.
The system needs one effective tool policy that combines product defaults,
static operator config, SQLite-backed admin changes, provider availability,
role permissions, and request-scoped filtering.

This phase should leave the system simpler than it is now: one policy service,
one effective manifest, one admin surface, and one conversational admin tool.

## Phase 00 Evidence Inputs

Grounding file:

- `docs/_refactor/provider-capability-configuration/evidence/00-baseline-evidence-2026-05-02.md`

Important facts from the baseline:

- The active registry still exposes OpenAI-backed tools when `OPENAI_API_KEY`
  is unset.
- Static `config/tools.json` can remove a tool from the registry, but prompt
  directive text can still advertise that disabled tool.
- `admin_web_search` can be absent from the registry while the admin role
  directive still mentions it.
- `ConfigurationService` already supports env first, then SQLite
  `system_settings`; use this path for runtime tool settings in this phase.
- Theme tools are the correct provider-free baseline proof: they are local,
  visible, useful, and should stay default-on.

## Current Code Findings

### Static Config

Current files:

- `src/lib/config/defaults.ts`
- `src/lib/config/instance.schema.ts`
- `src/lib/config/instance.ts`

`DEFAULT_TOOLS` is currently `{}`. The static schema only supports:

- `enabled`
- `disabled`

`getInstanceTools()` reads `config/tools.json` through the cached instance
config loader. This is useful as an operator/deployment override, but it is not
a runtime product control plane.

Decision:

- Keep `config/tools.json`.
- Treat it as an operator-locked layer.
- Do not write admin UI changes back to `config/tools.json`.

### Registry Composition

Current files:

- `src/lib/chat/tool-composition-root.ts`
- `src/lib/chat/tool-bundle-composition.ts`
- `src/core/tool-registry/ToolRegistry.ts`
- `src/lib/chat/runtime-manifest.ts`

`tool-composition-root.ts` registers all bundles, then mutates the registry by
unregistering tools from static config. It caches the result in module state.

The registry already supports execution and schema visibility. However,
`ToolRegistry.unregister()` deletes from `tools` only. Bundle metadata remains
unchanged, so bundle expansion can still return names for tools that were
disabled earlier.

Decision:

- Stop treating registry mutation as the source of truth.
- Build an effective tool availability manifest first.
- Use that manifest to decide what enters model-visible schemas, prompt hints,
  admin UI, and conversational runtime inspection.
- Keep registry execution strict: unavailable tools must not execute.

### Prompt Directives

Current files:

- `src/core/entities/role-directives.ts`
- `src/core/entities/role-directive-assembler.ts`
- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- `src/lib/chat/prompt-runtime.ts`

`ROLE_DIRECTIVES` is assembled at module load from the full capability catalog.
`prompt-runtime.ts` falls back to those static constants. That makes runtime
tool changes incomplete because prompt hints can remain stale.

Decision:

- Add an availability-aware directive assembly path.
- Preserve the current static exports only as compatibility/default baseline
  while migrating call sites.
- Prompt fallback for chat should use effective availability, not the full
  static catalog.

### Existing Good Consumer

Current files:

- `src/lib/chat/runtime-manifest.ts`
- `src/core/use-cases/tools/inspect-runtime-context.tool.ts`

`inspect_runtime_context` already reads role-visible tools from the runtime
registry and supports request-scoped filtering. This is the right inspection
pattern. Phase 01 should extend the shape so it can expose effective state and
reasons, not just currently registered schemas.

### Persistence

Current files:

- `src/adapters/SystemSettingsDataMapper.ts`
- `src/core/ports/SystemSettingsRepository.ts`
- `src/lib/config/ConfigurationService.ts`
- `src/app/api/admin/system/keys/route.ts`

`system_settings` already supports JSON values. The admin key route already
uses `ConfigurationService` to persist runtime config.

Decision:

- Use `system_settings` for Phase 01.
- Store one JSON setting for tool overrides.
- Do not add a migration or new table yet.

Suggested setting keys:

- `TOOL_AVAILABILITY_OVERRIDES`
- `TOOL_AVAILABILITY_PROFILE`

A future phase can normalize this into tables if audit history, per-tenant
policies, or per-user policies become necessary.

### Admin Surface

Current files:

- `src/app/admin/system/page.tsx`
- `src/app/admin/system/keys/page.tsx`
- `src/app/admin/system/keys/KeysManager.tsx`
- `src/app/api/admin/system/keys/route.ts`

The system page already shows registered tools by category. It should become a
summary with a link to a dedicated tool control page.

Decision:

- Add `/admin/system/tools`.
- Add `GET /api/admin/system/tools`.
- Add `POST /api/admin/system/tools`.
- Reuse `requireAdminPageAccess()`.

## Architecture Decision

Create an effective availability service outside the registry.

The registry should execute tools. It should not own product policy,
installation policy, provider gating, admin override persistence, prompt
projection, and UI explanations.

## Policy Order

Build the effective tool policy in this order:

1. Catalog declaration: known tool names, roles, categories, prompt hints.
2. Protected system guard: tools required for local recovery and control.
3. Product/install profile default: core/default optional/business feature.
4. Static operator override from `config/tools.json`.
5. SQLite-backed admin runtime override.
6. Provider/capability availability: initially stubbed, fully implemented in
   later provider phases.
7. Role permission filtering.
8. Request/lane-scoped filtering.

Earlier layers define coarse availability. Later layers narrow visibility or
execution.

Protected tools are not disabled by normal admin controls. Static operator
config may still be allowed to disable them only if we explicitly document that
as an emergency operator override; otherwise the implementation should reject
protected-tool static disables with a warning.

## Effective States

Every known tool should project a stable state:

- `enabled`
- `disabled_by_install_profile`
- `disabled_by_static_config`
- `disabled_by_admin`
- `missing_provider_key`
- `provider_disabled`
- `role_denied`
- `request_filtered`
- `system_reserved`
- `unknown_tool`

Admin UI and conversational inspection should show both final state and reason.

## Protected Tools

Protected admin/recovery set:

- `inspect_runtime_context`
- `inspect_runtime_logs`
- `inspect_theme`
- `set_theme`
- `adjust_ui`
- `configure_tool_availability` when introduced

Rationale:

- The system needs a local, provider-free inspection path.
- The theme tools are the basic local tool proof.
- Runtime logs and runtime context are necessary for bug triage and recovery.
- The tool that changes tool availability must not be able to disable itself
  through normal admin controls.

These tools can still be role-limited. Protected means "not disableable through
normal runtime controls", not "visible to every role".

## Initial Install Groups

### Core Default

Default on for every install:

- `inspect_theme`
- `set_theme`
- `adjust_ui`
- `calculator`
- `get_current_page`
- `list_available_pages`
- `navigate_to_page`
- `inspect_runtime_context`
- `inspect_runtime_logs`
- `search_corpus`
- `get_corpus_summary`
- `get_section`
- `get_checklist`
- `get_my_profile`
- `update_my_profile`
- `set_preference`
- `get_my_job_status`
- `list_my_jobs`

### Default Optional

Default on for Ordo alpha, visible and toggleable:

- `search_relationship_memory`
- `search_my_conversations`
- `get_my_referral_qr`
- `get_my_affiliate_summary`
- `list_my_referral_activity`
- `list_conversation_media_assets`
- `generate_chart`
- `generate_graph`
- `compose_media`

### Provider-Gated Optional

Default off when required provider configuration is missing:

- `generate_audio`
- `generate_blog_image`
- `admin_web_search`

Provider gating should eventually support:

- OpenAI audio/Whisper/image capability
- Anthropic-compatible chat capability
- DeepSeek Anthropic-compatible endpoint capability
- local Whisper capability

### Business-Feature Optional

Install-profile or admin-toggleable by site type:

- blog/journal publishing tools
- admin prioritization tools
- referral admin tools
- `produce_product`

## Clean Architecture Shape

### Domain Types

Add:

```text
src/lib/tools/tool-policy-types.ts
```

Required value objects:

- `ToolAvailabilityState`
- `ToolAvailabilityReason`
- `ToolPolicyLayer`
- `ToolAvailabilityOverride`
- `EffectiveToolAvailability`
- `EffectiveToolManifest`
- `ToolInstallGroup`

Rules:

- Types should be plain data.
- No DB imports.
- No Next.js imports.
- No registry mutation.

### Default Profile

Add:

```text
src/lib/tools/tool-default-profile.ts
```

Responsibilities:

- Declare protected tools.
- Declare default install groups.
- Map existing ownership from
  `src/core/capability-catalog/capability-ownership.ts` into install groups
  where possible.
- Keep explicit overrides where product policy differs from ownership, such as
  treating referral QR as default optional even if ownership currently marks it
  as core.

### Settings Repository Adapter

Add:

```text
src/lib/tools/tool-settings-service.ts
```

Responsibilities:

- Read/write JSON from `system_settings`.
- Validate unknown tool names against the catalog or registry manifest.
- Return structured warnings for unknown/stale overrides.
- Avoid coupling callers to raw `ConfigurationService` string values.

Pattern:

- Repository/Adapter over `SystemSettingsDataMapper`.

### Availability Service

Add:

```text
src/lib/tools/tool-availability-service.ts
```

Responsibilities:

- Compose policy layers in the documented order.
- Return effective availability for all known tools.
- Return role-filtered manifests.
- Return request-filtered manifests.
- Return admin explanations.
- Provide pure functions that are easy to unit test.

Pattern:

- Chain of Responsibility for policy layers.
- Strategy for future provider capability layers.

### Registry Integration

Update:

```text
src/lib/chat/tool-composition-root.ts
src/lib/chat/runtime-manifest.ts
src/core/tool-registry/ToolRegistry.ts
```

Responsibilities:

- Registry construction consumes effective policy.
- Disabled tools are not executable.
- Model-visible schemas are filtered by effective policy.
- Bundle expansion should not reintroduce disabled names.
- Cache invalidation happens after admin tool settings changes.

Implementation note:

- Keep `tool-composition-root.ts` lean. Existing tests assert this file stays
  small.
- Prefer a small `createEffectiveToolRegistry()` helper over adding policy
  logic directly to the composition root.

### Prompt Integration

Update:

```text
src/core/entities/role-directive-assembler.ts
src/core/entities/role-directives.ts
src/lib/chat/prompt-runtime.ts
```

Responsibilities:

- Role prompt hints must be built from effective availability.
- Disabled provider tools must not be mentioned as callable.
- Static `ROLE_DIRECTIVES` can remain as a compatibility baseline, but chat
  runtime should use an availability-aware assembler.

### Admin API and UI

Add:

```text
src/app/admin/system/tools/page.tsx
src/app/admin/system/tools/ToolsManager.tsx
src/app/api/admin/system/tools/route.ts
```

Responsibilities:

- Show bundle, tool name, category, roles, provider dependency, state, reason.
- Toggle individual tools.
- Toggle bundles.
- Show protected tools as locked.
- Show static config locks separately from admin overrides.
- Show provider-gated tools as unavailable when keys/capabilities are missing.

### Conversational Admin Tool

Add:

```text
src/core/use-cases/tools/configure-tool-availability.tool.ts
```

Tool name:

- `configure_tool_availability`

Supported actions:

- enable tool
- disable tool
- enable bundle
- disable bundle
- explain tool
- list protected tools
- summarize effective manifest

Rules:

- Admin-only.
- Cannot disable protected tools.
- Cannot bypass static operator locks.
- Returns updated manifest summary and warnings.
- Invalid tool names must be non-destructive and explain the issue.

## SOLID / GOF Notes

- Single Responsibility: registry executes tools; availability service decides
  policy; settings service persists overrides; prompt assembler projects
  instructions.
- Open/Closed: provider capability gating should be a new policy strategy, not
  a rewrite of registry construction.
- Liskov: any provider capability layer must return the same policy result
  shape.
- Interface Segregation: admin UI should not need registry executors; it only
  needs manifests and commands.
- Dependency Inversion: use services/ports around settings and provider
  capability checks instead of importing concrete UI or route code into domain
  policy.
- GOF patterns: Repository, Adapter, Strategy, Chain of Responsibility,
  Factory, Command.

## Simplification / Pruning Targets

Remove or reduce:

- Inline static tool filtering in `tool-composition-root.ts`.
- Prompt fallback paths that use full catalog directives for active chat.
- Any admin/system page logic that treats "registered tools" as equivalent to
  "effective available tools".
- Bundle expansion behavior that can return disabled tool names.
- Tests that assume `tools.json` is the only tool policy source.

Keep:

- Existing `config/tools.json` compatibility.
- Existing runtime manifest role ordering.
- Existing `inspect_runtime_context` behavior, extended with effective-state
  details.
- Existing `system_settings` persistence path.

## Implementation Slices

1. Add policy types and default profile.
2. Add tool settings service using `system_settings`.
3. Add effective availability service with static config and admin overrides.
4. Integrate effective policy into registry construction and cache reset.
5. Make runtime manifest and `inspect_runtime_context` expose effective states.
6. Make prompt directive assembly availability-aware.
7. Add admin API and `/admin/system/tools`.
8. Add `configure_tool_availability`.
9. Add the initial provider-gating layer for OpenAI-backed optional tools.
10. Prune stale filtering/prompt assumptions and update tests.

## Test Plan

Unit tests:

- Default profile classifies protected/core/default optional/provider-gated
  tools.
- Admin override enables/disables toggleable tools.
- Protected tool disable attempts are rejected.
- Static config disables override admin enables.
- Unknown tool overrides are reported and ignored.
- Provider-gated OpenAI-backed tools return stable missing-key state.

Integration tests:

- Registry excludes disabled tools from schemas and execution.
- Bundle expansion does not expose disabled tools.
- `inspect_runtime_context` reports effective tool state and reasons.
- Role manifests still respect role permissions.
- Request-scoped filtering still narrows manifests.
- Prompt directives do not mention disabled tools.
- Admin API requires admin access.
- Conversational admin tool is admin-only and cannot disable protected tools.

Regression tests:

- Existing `tools.json` enabled/disabled behavior remains compatible.
- Theme tools remain default-on and provider-free.
- `OPENAI_API_KEY` missing disables OpenAI-backed optional tools through the
  initial provider capability layer.

## Acceptance Criteria

- [x] Tool policy order is implemented and tested.
- [x] Static `config/tools.json` remains supported as an operator override.
- [x] SQLite-backed runtime tool settings exist.
- [x] Admin tool settings screen exists.
- [x] Admin conversational tool can enable/disable toggleable tools.
- [x] Protected tools cannot be disabled through normal admin controls.
- [x] Runtime registry, runtime manifest, runtime inspection, and role prompt
      hints reflect the same effective policy.
- [x] Bundle expansion cannot reintroduce disabled tools.
- [x] Theme tools remain default-on as the provider-free basic tool proof.
- [x] Existing registry composition tests remain meaningful after refactor.

## Implementation Evidence

Implemented code:

- `src/lib/tools/tool-policy-types.ts`
- `src/lib/tools/tool-default-profile.ts`
- `src/lib/tools/tool-settings-service.ts`
- `src/lib/tools/tool-availability-service.ts`
- `src/app/admin/system/tools/page.tsx`
- `src/app/admin/system/tools/ToolsManager.tsx`
- `src/app/api/admin/system/tools/route.ts`
- `src/core/use-cases/tools/configure-tool-availability.tool.ts`
  now refuses protected-tool changes and static operator-locked changes without
  writing ignored runtime overrides.

Integrated code:

- `src/lib/chat/tool-composition-root.ts` now builds the registry from the
  effective availability policy and refreshes the cached composition when the
  policy version changes.
- `src/core/tool-registry/ToolRegistry.ts` now removes disabled tools from
  bundle lookup and filters bundle expansion through currently registered
  tools.
- `src/lib/chat/runtime-manifest.ts` now projects effective tool state metadata
  alongside role-visible schemas.
- `src/core/use-cases/tools/inspect-runtime-context.tool.ts` now returns
  effective tool state details when tools are included.
- `src/core/entities/role-directive-assembler.ts`,
  `src/core/entities/role-directives.ts`, and
  `src/lib/chat/prompt-runtime.ts` now support availability-aware role
  directive assembly.
- `src/core/capability-catalog/families/admin-capabilities.ts`,
  `src/core/capability-catalog/catalog-input-schemas.ts`, and
  `src/core/capability-catalog/runtime-tool-binding.ts` now include the
  admin-only `configure_tool_availability` tool.
- `src/app/admin/system/page.tsx` now links to the dedicated tool settings
  surface and reports effective policy counts.
- `src/app/api/admin/system/tools/route.ts` now rejects statically locked
  single-tool changes and skips locked/protected tools for bundle changes.

QA run:

- `npm run typecheck`
- `npm test -- src/lib/tools/tool-availability-service.test.ts src/lib/tools/tool-settings-service.test.ts src/app/api/admin/system/tools/route.test.ts src/core/use-cases/tools/configure-tool-availability.tool.test.ts src/lib/chat/tool-composition-root.test.ts tests/tool-manifest-contract.test.ts tests/core-policy.test.ts tests/prompt-runtime.test.ts tests/chat/chat-stream-route.prompt-runtime-seam.test.ts tests/registry-executor-unification.test.ts tests/tool-registry.integration.test.ts src/core/capability-catalog/prompt-directive-unification.test.ts tests/architecture-cohesion-audit.test.ts tests/solid-architecture-audit.test.ts tests/composition-root-structure.test.ts tests/composition-root-decomposition.test.ts`
- `npx eslint src/app/admin/system/tools/ToolsManager.tsx src/app/api/admin/system/tools/route.ts src/app/api/admin/system/tools/route.test.ts src/lib/tools/tool-availability-service.ts src/lib/tools/tool-settings-service.ts src/core/use-cases/tools/configure-tool-availability.tool.ts src/core/use-cases/tools/configure-tool-availability.tool.test.ts`

Final closeout QA:

- 16 focused test files passed.
- 184 focused tests passed.
- Static operator-locked tool changes are explicitly refused or skipped by both
  admin API and conversational admin control.

Repo-wide strict lint note:

- `npm run lint -- --max-warnings 0` still fails on pre-existing repository
  warnings outside this phase. The changed Phase 01 files listed above pass
  file-scoped ESLint.

## Code Anchors

- `config/tools.json`
- `src/lib/config/defaults.ts`
- `src/lib/config/instance.schema.ts`
- `src/lib/config/instance.ts`
- `src/lib/config/ConfigurationService.ts`
- `src/adapters/SystemSettingsDataMapper.ts`
- `src/core/ports/SystemSettingsRepository.ts`
- `src/app/admin/system/page.tsx`
- `src/app/admin/system/keys/KeysManager.tsx`
- `src/app/api/admin/system/keys/route.ts`
- `src/lib/chat/tool-composition-root.ts`
- `src/lib/chat/tool-bundle-composition.ts`
- `src/lib/chat/runtime-manifest.ts`
- `src/lib/chat/prompt-runtime.ts`
- `src/core/tool-registry/ToolRegistry.ts`
- `src/core/entities/role-directives.ts`
- `src/core/entities/role-directive-assembler.ts`
- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- `src/core/capability-catalog/capability-ownership.ts`
- `src/core/capability-catalog/families/theme-capabilities.ts`
- `src/lib/chat/tool-bundles/theme-tools.ts`
- `src/core/use-cases/tools/inspect-runtime-context.tool.ts`
