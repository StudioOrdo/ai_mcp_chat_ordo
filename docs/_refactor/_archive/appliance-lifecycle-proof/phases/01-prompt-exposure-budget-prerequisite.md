# Phase 01 - Prompt Exposure Budget Prerequisite

Status: Complete

## Goal

Add the minimal prompt exposure policy needed before adding lifecycle diagnostic tools, so the default assistant prompt remains focused while operator/admin diagnostics remain executable through governed paths.

## Phase 00 Dependency

Phase 00 found that appliance diagnostics will add or expose health, worker, search, media, and backup/restore surfaces.

Phase 00 also found that admin/system health is already fragmented across readiness probes, admin loaders, provider diagnostics, tool availability, media worker health, and future lifecycle probes.

Therefore, lifecycle diagnostics must not automatically expand the normal chat prompt. They need an explicit prompt exposure budget before Phase 03 adds appliance health surfaces.

## Current Code Grounding

- `src/core/capability-catalog/capability-definition.ts`
  - `CapabilityDefinition` already has facets for `core`, `runtime`, `presentation`, `promptHint`, `mcpExport`, `schema`, `executorBinding`, `validationBinding`, and `localExecutionTargets`.
  - There is no prompt exposure facet today.
- `src/core/capability-catalog/catalog.ts`
  - `CAPABILITY_CATALOG` is the source of truth for catalog-owned capabilities.
  - `projectPromptHint()` projects role-specific directive lines only. It does not decide whether a tool schema is prompt-visible.
- `src/core/capability-catalog/schema-projection.ts`
  - `projectAnthropicSchema()` projects a catalog definition to Anthropic-compatible schema.
  - `getAllAnthropicSchemas()` projects all catalog schemas without prompt exposure filtering.
  - `projectMcpSchema()` and `getAllMcpSchemas()` are protocol projections and must remain independent from default chat prompt exposure.
- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
  - Runtime projection includes prompt hints, schema, presentation, job, browser, MCP export, binding, and local execution targets.
  - It does not include prompt exposure.
- `src/core/tool-registry/ToolRegistry.ts`
  - `getSchemasForRole(role)` currently means all executable schemas for this role.
  - `canExecute(name, role)` separately controls execution authorization.
  - Phase 01 must not weaken `canExecute`.
- `src/core/tool-registry/ToolDescriptor.ts`
  - `ToolDescriptor` has schema, command, roles, category, execution mode, and deferred config.
  - It has no prompt exposure metadata today.
- `src/core/capability-catalog/runtime-tool-projection.ts`
  - `buildCatalogBoundToolDescriptor()` projects a `CapabilityDefinition` into a `ToolDescriptor`.
  - This is the right point to carry catalog prompt exposure into registered tool descriptors.
- `src/lib/chat/chat-turn.ts`, `src/lib/chat/tools.ts`, and `src/lib/chat/tool-capability-routing.ts`
  - Direct chat and routing code call `registry.getSchemasForRole(role)` to build Anthropic tool lists.
  - This is the hot path that must shift from executable-by-role to prompt-visible-for-this-projection.
- `src/lib/chat/stream-route-handler.ts`
  - Streaming chat obtains request-scoped tools from `getRequestScopedToolSelection()` and passes that list into `builder.withToolManifest()`.
  - This path must use prompt-visible tools, not raw executable tools.
- `src/lib/chat/prompt-runtime.ts`
  - `PromptRuntimeBuilder.withToolManifest()` stores the prompt-visible capability manifest.
  - `PromptRuntime.resolveFallbackContent()` passes the manifest names to `assembleRoleDirective()`.
  - Therefore role directive hints can be made consistent by ensuring only prompt-visible tools enter `withToolManifest()`.
- `src/lib/chat/runtime-manifest.ts`
  - `getRuntimeToolManifestForRole()` also calls `registry.getSchemasForRole(role)`.
  - Phase 01 must decide whether this function remains a prompt-visible manifest or is renamed/supplemented with executable manifest helpers.
- `src/core/entities/role-directive-assembler.ts`
  - Prompt hints are assembled from `projectAllCapabilityRuntimeStatics()` and filtered only by `availableToolNames`.
  - Prompt hints must follow prompt exposure, not executable registration alone.
- `src/lib/tools/tool-availability-service.ts`
  - Runtime tool availability already enables/disables executable tools by policy/provider settings.
  - Prompt exposure is a separate concern; do not overload availability state.
- `docs/_review/agent-tool-surface-hot-path-review/implementation-plan.md`
  - Phase A matches this phase: add prompt exposure policy, project default Anthropic tool schemas from it, and prove executable tools can be hidden from the default prompt.

## Current Behavior Summary

Today, these concepts are conflated in the default chat path:

- role can execute a tool
- tool is enabled by availability policy
- tool schema is visible to the model
- prompt hint may appear in role directive

This is acceptable for a smaller surface, but it is not acceptable before lifecycle diagnostics add more operator/internal capabilities.

Phase 01 should separate:

- executable registry membership
- role authorization
- runtime availability
- prompt visibility
- MCP exportability
- prompt hint visibility

## Design

Add a prompt exposure classification facet to catalog-owned capability metadata:

- `default_prompt`: visible in the normal assistant tool surface.
- `intent_gated`: available when the current request clearly asks for that capability.
- `operator_only`: available to admin/operator surfaces but hidden from default user chat.
- `internal_only`: executable internally but never exposed as a model-callable default tool.

Recommended type shape:

```ts
export type CapabilityPromptExposure =
  | "default_prompt"
  | "intent_gated"
  | "operator_only"
  | "internal_only";

export interface CapabilityPromptExposureFacet {
  exposure: CapabilityPromptExposure;
  rationale?: string;
}
```

Recommended placement:

```ts
export interface CapabilityDefinition {
  // existing facets...
  promptExposure?: CapabilityPromptExposureFacet;
}
```

Default policy:

- Missing `promptExposure` defaults to `default_prompt` for Phase 01 compatibility.
- This preserves behavior unless a capability is explicitly classified.
- Add a later cleanup option to require explicit exposure for all catalog entries once tests stabilize.

Keep execution and prompt exposure separate:

- A hidden tool may still be executable by jobs, admin actions, MCP, or direct code.
- Prompt projection decides what the model sees.
- Authorization still decides whether a caller may execute the tool.

## Projection Design

Introduce prompt projection policy without removing current execution APIs.

Recommended additions:

- `projectPromptExposure(def)` in `src/core/capability-catalog/catalog.ts`.
- `promptExposure?: CapabilityPromptExposureFacet` on `ToolDescriptor`.
- `buildCatalogBoundToolDescriptor()` carries `projectPromptExposure(def)` into the registered descriptor.
- `getExecutableSchemasForRole(role)` or equivalent keeps the current role-executable behavior explicit.
- `getPromptVisibleToolSchemasForRole(registry, role, options)` filters descriptors by prompt exposure.
- `PromptToolProjectionPolicy` or similarly named pure function that filters schemas by role, exposure mode, optional intent gates, optional operator/admin surface, and existing allowed tool names.

Preferred first implementation:

- Keep `ToolRegistry.canExecute()` unchanged.
- Keep `ToolRegistry.execute()` unchanged.
- Keep MCP schema projections unchanged.
- Do not silently change `getSchemasForRole()` semantics without a compatibility wrapper. Prefer adding explicit executable and prompt-visible projection methods/helpers.
- Convert chat hot paths to the new helper:
  - `src/lib/chat/chat-turn.ts`
  - `src/lib/chat/tools.ts`
  - `src/lib/chat/tool-capability-routing.ts`
  - `src/lib/chat/stream-route-handler.ts` through `getRequestScopedToolSelection()`
  - eval/live runtime call sites if they are prompt-surface tests.
- Update `src/lib/chat/runtime-manifest.ts` to name whether it is returning prompt-visible tools or executable tools.
- Make `builder.withToolManifest()` receive the same prompt-visible list used for Anthropic tools so role directive prompt hints do not describe hidden tools.

Allowed projection modes:

- `default_chat`: include `default_prompt`.
- `intent_gated`: include `default_prompt` plus matched `intent_gated`.
- `operator_chat`: include `default_prompt`, `intent_gated`, and `operator_only` for authorized operator/admin roles.
- `internal`: include all executable tools; do not use for model prompt by default.

Implementation decision from QA:

- Use explicit helper/projection names instead of redefining `getSchemasForRole()` in place.
- Keep `getSchemasForRole()` as the backward-compatible executable-by-role projection until all callers are audited.
- New chat code must call prompt projection helpers.
- Tests must make the difference between executable and prompt-visible surfaces visible.

## Initial Classification

Use conservative classification for Phase 01.

Default-visible candidates:

- Product workflow tools that users naturally ask for in normal chat.
- `set_theme` as the basic UI customization tool, unless Phase 01 implementation evidence shows the UI tool family needs intent gating immediately.
- Core creation/search/media tools already expected in normal chat, subject to provider capability availability.

Intent-gated candidates:

- `get_current_page`
- `list_available_pages`
- `navigate_to_page`
- `inspect_theme`
- `adjust_ui`
- precise search/context tools when the user asks to inspect, recover, or navigate rather than create.

Operator-only candidates:

- `admin_search`
- `admin_web_search`
- `configure_tool_availability`
- `inspect_runtime_logs`
- future appliance health/backup/restore diagnostics unless intentionally made user-facing.

Internal-only candidates:

- implementation-step tools that jobs, UI actions, or admin pages can execute without putting them into a default model prompt.
- future backup/restore validator helpers, worker probes, and search health probes that are not conversational commands.

Specific review candidates from the current code/review:

- `inspect_runtime_context`: move out of `default_prompt`; likely `intent_gated` or `operator_only`.
- `inspect_runtime_logs`: `operator_only`.
- `inspect_theme`: `intent_gated`.
- `adjust_ui`: `intent_gated`.
- `configure_tool_availability`: `operator_only`.
- admin workflow internals: `operator_only` unless they are true product-level workflow tools.

## SOLID/Clean/GOF Notes

- Single Responsibility: prompt projection filters schemas; executors execute.
- Open/Closed: new exposure modes are added through metadata and projection policy.
- Interface Segregation: prompt projection consumes only catalog identity, schema, role, and exposure policy.
- Dependency Inversion: chat/eval/admin surfaces depend on prompt projection policy, not raw catalog internals.
- Clean Architecture: catalog owns declaration; projection service owns exposure decisions; route/chat adapters select projection mode.
- Strategy: `default_chat`, `operator_chat`, and `internal` projection modes are strategies over the same registry.

## Positive Use Cases

- Normal chat sees only default tools.
- Admin/operator mode can see operator tools.
- Intent-gated search or diagnostics can be exposed when the request asks for it.
- `inspect_runtime_context` remains executable but is absent from default chat prompt.
- MCP-exported tools remain exportable even when hidden from default prompt.
- Role directive prompt hints are only included when their tool is prompt-visible for the current projection.

## Negative Use Cases

- Internal log inspection does not appear in default chat.
- Backup/restore commands are not exposed to normal users by default.
- Tool remains hidden from prompt even if it is still registered for execution.
- Disabling prompt exposure does not disable a tool in admin UI, jobs, MCP, or direct execution paths.
- Normal user prompt does not receive admin/operator lifecycle diagnostics by accident.
- Availability-disabled tools remain absent regardless of exposure policy.

## Edge Use Cases

- Missing exposure metadata defaults conservatively for compatibility during Phase 01.
- Existing tests using tool lists fail loudly if they assumed all executable tools are prompt-visible.
- MCP export policy remains independent from default chat prompt policy.
- Request-scoped tool filtering in `tool-capability-routing.ts` composes with prompt exposure filtering.
- Admin lane allowlists do not re-add tools hidden by default prompt policy unless `operator_chat` mode is explicitly selected.
- Tool counts in `tool-composition-root.test.ts` are updated to distinguish executable count from prompt-visible count.
- Prompt hints without visible schemas are omitted.
- The first implementation does not need a classifier; intent gating can be represented by explicit projection options and tested allowlists.

## Test Plan

Focused unit tests:

- `src/core/capability-catalog/schema-derivation.test.ts`
  - catalog definitions can project prompt exposure with a compatibility default.
  - MCP schema projection ignores prompt exposure.
- `src/core/tool-registry/ToolRegistry.test.ts`
  - executable role schemas remain available through `getSchemasForRole()` or a renamed executable helper.
  - prompt-visible projection hides non-default tools.
  - `canExecute()` still returns true for hidden-but-executable tools.
- `src/lib/chat/tool-composition-root.test.ts`
  - default chat prompt no longer includes known diagnostic tools.
  - executable/runtime availability still includes hidden tools where appropriate.
  - role counts are renamed or split so the tests do not confuse prompt-visible and executable manifests.
- `src/core/entities/role-directive-assembler.test.ts`
  - prompt hints are omitted when the tool is not prompt-visible.
  - existing availability filtering still works.
- `src/lib/chat/tool-capability-routing.test.ts`
  - request-scoped filters apply after prompt exposure policy.
- `src/lib/chat/chat-turn.test.ts` and `src/app/api/chat/stream/route.test.ts`
  - `withToolManifest()` receives prompt-visible tools, not all executable tools.
  - Anthropic tool list and prompt manifest remain aligned.

Regression tests to watch:

- `src/lib/chat/chat-turn.test.ts`
- `src/app/api/chat/stream/route.test.ts`
- `src/lib/chat/tool-prefilter.test.ts`
- `src/core/capability-catalog/prompt-directive-unification.test.ts`
- `src/core/capability-catalog/e2e-catalog-flow.test.ts`

## Exit Criteria

- Prompt exposure policy is represented in code.
- Default prompt projection has focused tests.
- Operator/internal diagnostics are hidden from normal prompt projection.
- The phase updates the agent tool surface review or links to closeout evidence.
- `canExecute()` and tool availability are not weakened.
- MCP export schema generation remains independent from prompt visibility.
- Phase 01 closeout records the initial classifications and any deferred classifications.
- Phase 02 can add runtime-profile/lifecycle diagnostics without adding them to default prompt by accident.

## QA Certification

Phase 01 is ready for implementation after this QA pass.

Certified implementation constraints:

- Add prompt exposure as catalog metadata and carry it into registered tool descriptors.
- Add explicit prompt projection helpers instead of replacing execution authorization.
- Keep `getSchemasForRole()` backward-compatible unless implementation deliberately introduces a clearly named executable replacement and updates every caller.
- Convert model-prompt hot paths to prompt-visible projection.
- Ensure `withToolManifest()` and role directive assembly receive the same prompt-visible tool names.
- Do not alter MCP export behavior.
- Do not alter runtime tool availability semantics.

## Implementation Closeout - 2026-05-02

Phase 01 is implemented.

Code changes:

- Added `CapabilityPromptExposure` and `CapabilityPromptExposureFacet` to catalog definitions.
- Added `projectPromptExposure()` and carried prompt exposure through capability runtime projection and catalog-bound `ToolDescriptor` registration.
- Added explicit `ToolRegistry.getPromptVisibleSchemasForRole()` while preserving `getSchemasForRole()` as the executable-by-role projection.
- Converted chat prompt hot paths to prompt-visible projection:
  - `src/lib/chat/tools.ts`
  - `src/lib/chat/chat-turn.ts`
  - `src/lib/chat/tool-capability-routing.ts`
  - `src/lib/chat/stream-route-handler.ts` through request-scoped selection.
  - `src/lib/evals/live-runtime.ts` when live eval tools are not explicitly injected.
- Added `getPromptVisibleRuntimeToolManifestForRole()` so UI/runtime diagnostics can distinguish executable manifests from prompt-visible manifests.
- Classified initial non-default prompt exposure:
  - intent gated: `get_current_page`, `inspect_runtime_context`, `list_available_pages`, `navigate_to_page`, `inspect_theme`, `adjust_ui`.
  - operator only: `admin_search`, `admin_web_search`, `configure_tool_availability`, `admin_prioritize_leads`, `inspect_runtime_logs`.
- Kept MCP schema projection and runtime tool availability separate from prompt exposure.

Verification:

- `npm test -- --run src/core/tool-registry/ToolRegistry.test.ts src/core/capability-catalog/schema-derivation.test.ts src/core/entities/role-directive-assembler.test.ts src/core/capability-catalog/prompt-directive-unification.test.ts src/lib/chat/tool-composition-root.test.ts src/lib/chat/tool-capability-routing.test.ts src/lib/chat/tool-prefilter.test.ts src/lib/chat/chat-turn.test.ts src/app/api/chat/stream/route.test.ts`
- `npm run typecheck`

Evidence:

- `../evidence/01-prompt-exposure-budget-2026-05-02.md`
