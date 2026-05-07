# Phase 01 Evidence - Prompt Exposure Budget

Date: 2026-05-02

Status: Complete

## Summary

Phase 01 added an explicit prompt exposure budget for catalog-owned tools.

The implementation separates executable tool registration from model-visible prompt projection. This lets future appliance lifecycle diagnostics remain executable by admin pages, jobs, MCP adapters, or direct governed paths without automatically expanding the default assistant prompt.

## Implemented Boundaries

- Catalog metadata now supports `promptExposure`.
- Missing exposure metadata defaults to `default_prompt` for compatibility.
- `ToolDescriptor` carries prompt exposure after catalog-bound projection.
- `ToolRegistry.getSchemasForRole()` remains executable-by-role.
- `ToolRegistry.getPromptVisibleSchemasForRole()` is the model prompt projection.
- `canExecute()` and `execute()` continue to use role authorization, not prompt exposure.
- MCP schema projection remains independent from prompt exposure.
- Runtime availability remains independent from prompt exposure.

## Initial Classifications

Intent gated:

- `get_current_page`
- `inspect_runtime_context`
- `list_available_pages`
- `navigate_to_page`
- `inspect_theme`
- `adjust_ui`

Operator only:

- `admin_search`
- `admin_web_search`
- `configure_tool_availability`
- `admin_prioritize_leads`
- `inspect_runtime_logs`

Default prompt:

- All unclassified capabilities retain compatibility default visibility.
- `set_theme` remains default prompt-visible as the basic user-facing theme command.

## Hot Paths Converted

- Direct chat: `src/lib/chat/chat-turn.ts`
- Shared chat tool accessor: `src/lib/chat/tools.ts`
- Stream route request-scoped selection: `src/lib/chat/tool-capability-routing.ts`
- Stream route prompt manifest alignment: `src/lib/chat/stream-route-handler.ts`
- Live eval default runtime surface: `src/lib/evals/live-runtime.ts`
- Runtime manifest split: `src/lib/chat/runtime-manifest.ts`

## Tests

Passed:

```bash
npm test -- --run src/core/tool-registry/ToolRegistry.test.ts src/core/capability-catalog/schema-derivation.test.ts src/core/entities/role-directive-assembler.test.ts src/core/capability-catalog/prompt-directive-unification.test.ts src/lib/chat/tool-composition-root.test.ts src/lib/chat/tool-capability-routing.test.ts src/lib/chat/tool-prefilter.test.ts src/lib/chat/chat-turn.test.ts src/app/api/chat/stream/route.test.ts
```

Result:

- 9 test files passed.
- 86 tests passed.

QA correction:

- The Phase 01 QA pass found that `src/lib/evals/live-runtime.ts` still used executable schemas when tools were not explicitly injected.
- It now uses `getPromptVisibleSchemasForRole()` with `default_chat` or `operator_chat` projection mode.
- `tests/evals/eval-live-runner.test.ts` includes a regression test that verifies the default live eval model surface uses prompt-visible tools and does not call `getSchemasForRole()`.

Passed:

```bash
npm test -- --run tests/evals/eval-live-runner.test.ts src/core/tool-registry/ToolRegistry.test.ts src/core/capability-catalog/schema-derivation.test.ts src/core/entities/role-directive-assembler.test.ts src/core/capability-catalog/prompt-directive-unification.test.ts src/lib/chat/tool-composition-root.test.ts src/lib/chat/tool-capability-routing.test.ts src/lib/chat/tool-prefilter.test.ts src/lib/chat/chat-turn.test.ts src/app/api/chat/stream/route.test.ts tests/chat/chat-stream-route.test.ts
```

Result:

- 11 test files passed.
- 140 tests passed.

Passed:

```bash
npm run typecheck
```

Passed:

```bash
npm test -- --run
```

Result:

- 687 test files passed.
- 4961 tests passed.
- 2 tests skipped.

## Deferred Work

- Intent detection remains explicit via projection options. A later phase can add a request classifier that supplies `intentToolNames`.
- Full catalog classification is deferred. Unclassified tools remain `default_prompt` to avoid accidental prompt surface breakage during this phase.
- Future lifecycle diagnostics should default to `operator_only` or `internal_only` unless intentionally designed as user-facing tools.
