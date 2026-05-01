# Phase 01 - Product Foundation And Prompt Exposure

## Objective
Make catalog prompt exposure explicit so Ordo can keep current capabilities while
showing fewer, more relevant tools per role/context.

## Current Code Grounding
- `src/core/capability-catalog/capability-definition.ts` defines catalog facets.
- `src/core/platform/capability-runtime/CapabilityRuntime.ts` projects runtime
  metadata.
- `src/lib/chat/tool-composition-root.ts` builds the tool registry by role.
- `src/core/tool-registry/ToolRegistry.ts` returns schemas for role.
- `src/core/use-cases/SystemPromptBuilder.ts` and prompt assembly tests govern
  prompt tool exposure.

## Architecture
- Add a catalog-owned prompt exposure policy facet or projection.
- Separate execution permission from prompt visibility.
- Keep role enforcement in `ToolCapabilityMiddleware`/RBAC.
- Filter prompt-visible tool schemas by role, context, and exposure class.

## Exposure Classes
- `default`: visible in normal conversations for eligible role.
- `intent_gated`: visible only when the user request/context needs it.
- `operator_only`: visible only in staff/admin operations mode.
- `admin_only`: visible only to admin.
- `internal_only`: executable by UI/system but not prompt-visible.

## Product Rules
- Theme/accessibility tools must remain easy for all users.
- Authenticated users get paid knowledge/media/profile/jobs/referral surfaces.
- Staff gets support/operations context without logs by default.
- Admin gets logs, prompt governance, config, and full operations.
- Bug-report/support flows must not expose logs to authenticated users.

## Implementation Steps
1. Define the prompt exposure policy shape.
2. Add policy projection from catalog/runtime.
3. Update schema projection for prompts to filter by exposure policy.
4. Add context inputs for affiliate, media, support, staff ops, admin ops,
   accessibility, and content/factory contexts.
5. Update tests for role execution vs prompt visibility.
6. Update review docs with actual policy assignments.

## Tests
- Positive: `set_theme` is visible for accessibility/theme intent for all roles.
- Positive: affiliate tools are visible for affiliate/referral intent where
  enabled.
- Positive: media tools are visible for media creation intent.
- Negative: `inspect_runtime_logs` is never visible to authenticated users.
- Negative: staff does not get admin-only logs/config by default.
- Edge: hidden prompt tools remain executable by UI/system when policy allows.

## Done Criteria
- Tool execution and prompt exposure are separate.
- Default prompt surface is materially smaller.
- Existing full suite remains green.

